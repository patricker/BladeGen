//! SW10's monument sword families (bladegen `sword/monument-variety` 38daabe, `src/three/sword/monument/design.ts`;
//! BG1: this is now the only implementation, the web app calls it through `bladegen-wasm`): a planet's sword picks a
//! blade family, a guard, a pommel and a grip from the catalogue by planet traits, then reshapes a base design (the
//! galaxy kit's planet design, or any `SwordParams`) with that family's recipe.
//!
//! - **The catalogue** is bladegen's `src/three/sword/monument/catalogue.json` (the owner's tuning table: weights,
//!   trait ramps, affinities, pairs), compiled in with `include_str!`. There is no other copy: after tuning it,
//!   rebuild the crate (and the wasm module, `scripts/build-wasm.sh`) and re-bake the consumers.
//! - **Seed:** `monument_seed(system seed, planet id)` = FNV-1a of `"sword-family|<u64 seed>|<planet id>"`.
//! - **Strengths** in catalogue order; **weights** in array order: `weight x prod (1 + (m - 1) x strength)` over the
//!   affinities, then `x m` per pair whose id was picked earlier.
//! - **Picks:** one PRNG, `Rng32::new(seed)`: blade, guard, pommel, grip, one `next()` each.
//! - **Recipes:** each stage has its own PRNG (`"<seed>|blade"`, `|guard`, `|pommel`, `|grip`, hashed), draws in
//!   statement order, continuous draws through `q3`.
//! - **Identity:** `classic` / `forged` (on a forged base) / `native` / `native` return the base unchanged.
//!
//! The planet traits come from the consumer: the galaxy kit fills them from its census (`mean_temp_k` =
//! `scan::planet_temps(planet, star).0`, `habitability` = `scan::habitability(planet, mean_temp_k)`).
use super::glow::{hash_seed, normalize_seed_str, q3, Rng32};
use super::monument::guard_defaults;
use super::params::*;
use serde::Deserialize;
use std::sync::OnceLock;

/// The tuning table (bladegen's `monument/catalogue.json`, byte for byte).
pub const CATALOGUE_JSON: &str = include_str!("../../../src/three/sword/monument/catalogue.json");

/// SW12 added `window` (window-keel) and `faultbound` to the blades and `shear` (shear-gate) to the guards; the
/// catalogue lists them at weight 0 (dormant: never drawn, so no design moves) until the owner gives them a weight.
pub const BLADES: [&str; 11] = [
    "classic",
    "greatsword",
    "leaf",
    "flamberge",
    "falchion",
    "cleaver",
    "stepped",
    "shard",
    "serpent",
    "window",
    "faultbound",
];
pub const GUARDS: [&str; 8] = ["forged", "recurve", "crescent", "halo", "wings", "talon", "ziggurat", "shear"];
pub const POMMELS: [&str; 5] = ["native", "gem", "sunwheel", "horned", "tiered"];
pub const GRIPS: [&str; 5] = ["native", "ridged", "smooth", "wound", "banded"];
/// The trait inputs a catalogue ramp or flag may read (`PlanetTraits`' numeric and boolean fields).
pub const INPUTS: [&str; 12] = [
    "gravityG",
    "meanTempK",
    "waterMassFraction",
    "locked",
    "hasDynamo",
    "dipoleIndex",
    "volcanismIndex",
    "moons",
    "rings",
    "teffK",
    "eccentricity",
    "habitability",
];

#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct TraitDef {
    pub id: String,
    pub kind: String,
    #[serde(default)]
    pub input: Option<String>,
    #[serde(default)]
    pub from: Option<f64>,
    #[serde(default)]
    pub to: Option<f64>,
    #[serde(default)]
    pub is: Option<Vec<String>>,
    #[serde(default)]
    pub gate: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct Entry {
    pub id: String,
    pub weight: f64,
    pub affinity: Vec<(String, f64)>,
    pub pairs: Vec<(String, f64)>,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct Catalogue {
    pub version: u32,
    pub traits: Vec<TraitDef>,
    pub blades: Vec<Entry>,
    pub guards: Vec<Entry>,
    pub pommels: Vec<Entry>,
    pub grips: Vec<Entry>,
}

impl Catalogue {
    pub fn parse(text: &str) -> anyhow::Result<Catalogue> {
        let c: Catalogue = serde_json::from_str(text)?;
        c.check()?;
        Ok(c)
    }

    /// Every id is one the recipes know, every affinity names a trait, every input is a trait field.
    pub fn check(&self) -> anyhow::Result<()> {
        let traits: Vec<&str> = self.traits.iter().map(|t| t.id.as_str()).collect();
        for t in &self.traits {
            match t.kind.as_str() {
                "archetype" => {}
                "ramp" | "flag" => {
                    for i in t.input.iter().chain(t.gate.iter()) {
                        anyhow::ensure!(INPUTS.contains(&i.as_str()), "trait {}: unknown input {i}", t.id);
                    }
                }
                k => anyhow::bail!("trait {}: unknown kind {k}", t.id),
            }
        }
        let all: Vec<&str> = BLADES.iter().chain(&GUARDS).chain(&POMMELS).chain(&GRIPS).copied().collect();
        for (list, known) in [
            (&self.blades, &BLADES[..]),
            (&self.guards, &GUARDS[..]),
            (&self.pommels, &POMMELS[..]),
            (&self.grips, &GRIPS[..]),
        ] {
            anyhow::ensure!(!list.is_empty(), "an empty stage");
            for e in list {
                anyhow::ensure!(known.contains(&e.id.as_str()), "unknown entry {}", e.id);
                for (k, _) in &e.affinity {
                    anyhow::ensure!(traits.contains(&k.as_str()), "{}: unknown trait {k}", e.id);
                }
                for (k, _) in &e.pairs {
                    anyhow::ensure!(all.contains(&k.as_str()), "{}: unknown pair {k}", e.id);
                }
            }
        }
        Ok(())
    }
}

impl Catalogue {
    /// The entries a draw can pick: every stage without its weight-0 (dormant) entries. A weight-0 entry adds 0 to
    /// the total and is never chosen (the draw is `r < w` with `r >= 0`, and the fallback skips `w <= 0`), so a
    /// catalogue and its `drawable()` pick, weigh and design every planet the same; SW12's conformance compares this
    /// with the corpora, which predate the dormant entries.
    pub fn drawable(&self) -> Catalogue {
        let keep = |list: &Vec<Entry>| list.iter().filter(|e| e.weight != 0.0).cloned().collect::<Vec<_>>();
        Catalogue {
            version: self.version,
            traits: self.traits.clone(),
            blades: keep(&self.blades),
            guards: keep(&self.guards),
            pommels: keep(&self.pommels),
            grips: keep(&self.grips),
        }
    }

    /// The ids listed at weight 0, in catalogue order.
    pub fn dormant(&self) -> Vec<&str> {
        [&self.blades, &self.guards, &self.pommels, &self.grips]
            .into_iter()
            .flatten()
            .filter(|e| e.weight == 0.0)
            .map(|e| e.id.as_str())
            .collect()
    }
}

/// The compiled-in catalogue (checked once; a bad table fails the first sword and `tests/sword.rs`).
pub fn catalogue() -> &'static Catalogue {
    static CAT: OnceLock<Catalogue> = OnceLock::new();
    CAT.get_or_init(|| Catalogue::parse(CATALOGUE_JSON).expect("bladegen src/three/sword/monument/catalogue.json"))
}

/// bladegen's `PlanetTraits`.
#[derive(Clone, Debug, PartialEq)]
pub struct PlanetTraits {
    pub archetype: String,
    pub gravity_g: f64,
    pub mean_temp_k: f64,
    pub water_mass_fraction: f64,
    pub locked: bool,
    pub has_dynamo: bool,
    pub dipole_index: f64,
    pub volcanism_index: f64,
    pub moons: f64,
    pub rings: bool,
    pub teff_k: f64,
    pub eccentricity: f64,
    pub habitability: f64,
}

impl PlanetTraits {
    /// From bladegen's JSON form (camelCase keys; a missing number reads 0, a missing flag false).
    pub fn from_json(v: &serde_json::Value) -> PlanetTraits {
        let n = |k: &str| v.get(k).and_then(|x| x.as_f64()).unwrap_or(0.0);
        let b = |k: &str| v.get(k).and_then(|x| x.as_bool()).unwrap_or(false);
        PlanetTraits {
            archetype: v.get("archetype").and_then(|x| x.as_str()).unwrap_or("").to_string(),
            gravity_g: n("gravityG"),
            mean_temp_k: n("meanTempK"),
            water_mass_fraction: n("waterMassFraction"),
            locked: b("locked"),
            has_dynamo: b("hasDynamo"),
            dipole_index: n("dipoleIndex"),
            volcanism_index: n("volcanismIndex"),
            moons: n("moons"),
            rings: b("rings"),
            teff_k: n("teffK"),
            eccentricity: n("eccentricity"),
            habitability: n("habitability"),
        }
    }

    /// bladegen's camelCase JSON form (the corpus's `traits`).
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({"archetype": self.archetype, "gravityG": self.gravity_g, "meanTempK": self.mean_temp_k,
            "waterMassFraction": self.water_mass_fraction, "locked": self.locked, "hasDynamo": self.has_dynamo,
            "dipoleIndex": self.dipole_index, "volcanismIndex": self.volcanism_index, "moons": self.moons,
            "rings": self.rings, "teffK": self.teff_k, "eccentricity": self.eccentricity,
            "habitability": self.habitability})
    }

    /// `input(t, name)`: a number (non-finite reads 0), a flag as 0/1, anything else 0.
    fn input(&self, name: &str) -> f64 {
        let v = match name {
            "gravityG" => self.gravity_g,
            "meanTempK" => self.mean_temp_k,
            "waterMassFraction" => self.water_mass_fraction,
            "locked" => self.locked as u8 as f64,
            "hasDynamo" => self.has_dynamo as u8 as f64,
            "dipoleIndex" => self.dipole_index,
            "volcanismIndex" => self.volcanism_index,
            "moons" => self.moons,
            "rings" => self.rings as u8 as f64,
            "teffK" => self.teff_k,
            "eccentricity" => self.eccentricity,
            "habitability" => self.habitability,
            _ => 0.0,
        };
        if v.is_finite() {
            v
        } else {
            0.0
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Picks {
    pub blade: String,
    pub guard: String,
    pub pommel: String,
    pub grip: String,
}

impl Picks {
    /// The picks that keep a forged-cross base sword as it is (`classic` / `forged` / `native` / `native`).
    pub fn identity() -> Picks {
        Picks {
            blade: "classic".into(),
            guard: "forged".into(),
            pommel: "native".into(),
            grip: "native".into(),
        }
    }

    /// sword.json's `blade.family` block: the picks, the family seed and the catalogue's version.
    pub fn to_json(&self, seed: u32) -> serde_json::Value {
        serde_json::json!({"blade": self.blade, "guard": self.guard, "pommel": self.pommel, "grip": self.grip,
            "seed": seed, "catalogue": catalogue().version})
    }
}

/// `force`: picks that override the drawn ones (catalogue sheets, tests).
#[derive(Clone, Debug, Default)]
pub struct Force {
    pub blade: Option<String>,
    pub guard: Option<String>,
    pub pommel: Option<String>,
    pub grip: Option<String>,
}

#[derive(Clone, Debug)]
pub struct MonumentDesign {
    pub seed: u32,
    pub picks: Picks,
    pub params: Sword,
    pub strengths: Vec<(String, f64)>,
}

/// `monumentSeed(systemSeed, planetId)`.
pub fn monument_seed(sys_seed: u64, planet_id: &str) -> u32 {
    hash_seed(&format!("sword-family|{sys_seed}|{planet_id}"))
}

fn jmin(a: f64, b: f64) -> f64 {
    super::geom::jmin(a, b)
}

fn jmax(a: f64, b: f64) -> f64 {
    super::geom::jmax(a, b)
}

/// `traitStrengths`: each catalogue trait's strength, 0..1, in catalogue order.
pub fn trait_strengths(t: &PlanetTraits, cat: &Catalogue) -> Vec<(String, f64)> {
    cat.traits
        .iter()
        .map(|d| {
            let mut s = match d.kind.as_str() {
                "archetype" => {
                    d.is.as_ref().is_some_and(|is| is.iter().any(|a| *a == t.archetype)) as u8 as f64
                }
                "flag" => (t.input(d.input.as_deref().unwrap_or("")) != 0.0) as u8 as f64,
                _ => {
                    let from = d.from.unwrap_or(0.0);
                    let to = d.to.unwrap_or(1.0);
                    jmin(1.0, jmax(0.0, (t.input(d.input.as_deref().unwrap_or("")) - from) / (to - from)))
                }
            };
            if let Some(g) = d.gate.as_deref() {
                if !g.is_empty() && t.input(g) == 0.0 {
                    s = 0.0;
                }
            }
            (d.id.clone(), s)
        })
        .collect()
}

/// `entryWeights`: each entry's weight given the strengths and the ids picked so far.
pub fn entry_weights(entries: &[Entry], strengths: &[(String, f64)], picked: &[&str]) -> Vec<(String, f64)> {
    let strength = |k: &str| strengths.iter().find(|(id, _)| id == k).map_or(0.0, |(_, s)| *s);
    entries
        .iter()
        .map(|e| {
            let mut w = e.weight;
            for (k, m) in &e.affinity {
                w = w * (1.0 + (m - 1.0) * strength(k));
            }
            for (id, m) in &e.pairs {
                if picked.contains(&id.as_str()) {
                    w = w * m;
                }
            }
            (e.id.clone(), w)
        })
        .collect()
}

/// `pickWeighted` (the draw is made before the total is checked, as bladegen).
fn pick_weighted(rng: &mut Rng32, ws: &[(String, f64)]) -> String {
    let mut total = 0.0;
    for (_, w) in ws {
        total += w;
    }
    let mut r = rng.next() * total;
    if !(total > 0.0) {
        return ws[0].0.clone();
    }
    for (id, w) in ws {
        if r < *w {
            return id.clone();
        }
        r -= w;
    }
    for (id, w) in ws.iter().rev() {
        if *w > 0.0 {
            return id.clone();
        }
    }
    ws[0].0.clone()
}

/// `pickMonument`: the four picks and the strengths.
pub fn pick_monument(t: &PlanetTraits, seed: u32, cat: &Catalogue) -> (Picks, Vec<(String, f64)>) {
    let strengths = trait_strengths(t, cat);
    let mut rng = Rng32::new(seed);
    let blade = pick_weighted(&mut rng, &entry_weights(&cat.blades, &strengths, &[]));
    let guard = pick_weighted(&mut rng, &entry_weights(&cat.guards, &strengths, &[&blade]));
    let pommel = pick_weighted(&mut rng, &entry_weights(&cat.pommels, &strengths, &[&blade, &guard]));
    let grip = pick_weighted(&mut rng, &entry_weights(&cat.grips, &strengths, &[&blade, &guard, &pommel]));
    (Picks { blade, guard, pommel, grip }, strengths)
}

fn r3(rng: &mut Rng32, a: f64, b: f64) -> f64 {
    q3(rng.range(a, b))
}

/// `rng.pick(items)`: `items[floor(next() * len)]`.
fn pick<T: Copy>(rng: &mut Rng32, items: &[T]) -> T {
    items[(rng.next() * items.len() as f64).floor() as usize]
}

fn int(rng: &mut Rng32, a: i64, b: i64) -> f64 {
    rng.int(a, b) as f64
}

fn stage_rng(seed: u32, stage: &str) -> Rng32 {
    Rng32::new(normalize_seed_str(&format!("{seed}|{stage}")))
}

/// Drops the engine's per-archetype silhouette (waves, curve, single edge) before a family reshapes the blade.
fn straighten(b: &mut Blade) {
    b.family = Some("straight".into());
    b.waviness = None;
    b.curvature = Some(0.0);
    b.base_angle = Some(0.0);
    b.edge_type = Some("double".into());
    b.thickness_left = b.thickness;
    b.thickness_right = b.thickness;
    b.asymmetry = Some(0.0);
    b.aperture = None;
    b.fracture = None;
}

fn no_fullers(b: &mut Blade) {
    b.fuller_enabled = Some(false);
    b.fullers = None;
}

fn s(x: &str) -> Option<String> {
    Some(x.to_string())
}

fn shape_blade(id: &str, b: &mut Blade, rng: &mut Rng32) {
    let bw0 = b.base_width;
    let t = b.thickness.unwrap_or(f64::NAN);
    straighten(b);
    match id {
        "greatsword" => {
            b.base_width = q3(bw0 * rng.range(1.05, 1.2));
            b.tip_width = q3(b.base_width * rng.range(0.06, 0.12));
            b.tip_ramp_start = Some(r3(rng, 0.6, 0.8));
            b.kissaki_length = Some(r3(rng, 0.12, 0.22));
            b.kissaki_roundness = Some(r3(rng, 0.2, 0.5));
            b.ricasso_length = Some(r3(rng, 0.07, 0.12));
            b.cross_section = s(pick(rng, &["diamond", "hexagonal"]));
            b.bevel = Some(r3(rng, 0.5, 0.85));
            b.tip_shape = s("pointed");
        }
        "leaf" => {
            b.base_width = q3(bw0 * rng.range(1.0, 1.15));
            b.tip_width = q3(b.base_width * rng.range(0.05, 0.1));
            b.tip_shape = s("leaf");
            b.tip_bulge = Some(r3(rng, 0.45, 0.75));
            b.kissaki_length = Some(r3(rng, 0.1, 0.2));
            b.tip_ramp_start = Some(0.0);
            b.cross_section = s(pick(rng, &["lenticular", "diamond"]));
        }
        "flamberge" => {
            b.family = s("flamberge");
            let amplitude = q3(b.base_width * rng.range(0.12, 0.2));
            let frequency = int(rng, 6, 11);
            let taper = r3(rng, 0.8, 1.3);
            b.waviness = Some(Waviness {
                amplitude,
                frequency,
                mode: s("both"),
                taper: Some(taper),
                phase: Some(0.0),
                offset: Some(0.0),
            });
            b.sweep_segments = Some(192.0);
            b.cross_section = s("diamond");
        }
        "falchion" => {
            b.edge_type = s("single");
            b.curvature = Some(r3(rng, 0.15, 0.3));
            b.sori_profile = s("saki");
            b.sori_bias = Some(r3(rng, 0.8, 1.4));
            b.tip_width = q3(b.base_width * rng.range(0.55, 0.85));
            b.tip_shape = s("clip");
            b.kissaki_length = Some(r3(rng, 0.18, 0.3));
            b.kissaki_roundness = Some(r3(rng, 0.3, 0.6));
            b.asymmetry = Some(r3(rng, 0.15, 0.3));
            b.thickness_left = Some(q3(t * 0.7));
            b.thickness_right = Some(q3(t * 1.15));
            b.cross_section = s(pick(rng, &["flat", "lenticular"]));
        }
        "cleaver" => {
            b.base_width = q3(bw0 * rng.range(1.15, 1.35));
            b.tip_width = q3(b.base_width * rng.range(0.75, 1.0));
            b.tip_shape = s(pick(rng, &["rounded", "sheepsfoot"]));
            b.kissaki_length = Some(r3(rng, 0.06, 0.12));
            b.cross_section = s("lenticular");
            b.bevel = Some(r3(rng, 0.3, 0.5));
            b.ricasso_length = Some(r3(rng, 0.1, 0.16));
        }
        "stepped" => {
            b.base_width = q3(bw0 * rng.range(1.1, 1.25));
            b.tip_width = q3(b.base_width * rng.range(0.05, 0.1));
            let steps = rng.int(2, 3);
            let u1 = r3(rng, 0.22, 0.32);
            let s1 = r3(rng, 0.64, 0.76);
            let mut pts: Points =
                vec![[0.0, 1.0], [q3(u1 - 0.012), 1.0], [u1, q3(s1 * 0.55)], [q3(u1 + 0.015), s1]];
            let mut last = s1;
            if steps == 3 {
                let u2 = q3(u1 + rng.range(0.2, 0.28));
                let s2 = q3(s1 * rng.range(0.66, 0.78));
                pts.extend_from_slice(&[[q3(u2 - 0.012), s1], [u2, q3(s2 * 0.55)], [q3(u2 + 0.015), s2]]);
                last = s2;
            }
            pts.push([1.0, last]);
            b.width_profile = Some(Profile { points: Some(pts), mode: s("scale"), scale: None });
            b.cross_section = s("hexagonal");
            b.bevel = Some(r3(rng, 0.55, 0.8));
            b.sweep_segments = Some(192.0);
            b.tip_shape = s("pointed");
            no_fullers(b);
        }
        "shard" => {
            b.base_width = q3(bw0 * rng.range(1.05, 1.15));
            b.tip_width = q3(b.base_width * rng.range(0.05, 0.1));
            let k = rng.int(4, 6);
            let mut pts: Points = vec![[0.0, 1.0]];
            for j in 1..k {
                let u = q3(j as f64 / k as f64 + rng.range(-0.04, 0.04));
                let v = if j % 2 == 1 { r3(rng, 0.66, 0.78) } else { r3(rng, 1.15, 1.3) };
                pts.push([u, v]);
            }
            pts.push([1.0, r3(rng, 0.8, 1.0)]);
            b.width_profile = Some(Profile { points: Some(pts), mode: s("scale"), scale: None });
            b.cross_section = s("diamond");
            b.bevel = Some(r3(rng, 0.85, 1.0));
            let th = q3(t * 1.35);
            b.thickness = Some(th);
            b.thickness_left = Some(th);
            b.thickness_right = Some(th);
            b.chaos = Some(0.0);
            b.serration_amplitude = Some(0.0);
            b.serration_amplitude_left = Some(0.0);
            b.serration_amplitude_right = Some(0.0);
            b.serration_frequency = Some(0.0);
            b.serration_sharpness = Some(0.0);
            b.serration_pattern = s("sine");
            b.tip_shape = s("spear");
            b.hollow_grind = None;
            no_fullers(b);
        }
        "serpent" => {
            b.family = s("kris");
            let amplitude = q3(b.base_width * rng.range(0.22, 0.32));
            let frequency = pick(rng, &[3.0, 5.0, 7.0]);
            let taper = r3(rng, 0.3, 0.7);
            b.waviness = Some(Waviness {
                amplitude,
                frequency,
                mode: s("centerline"),
                taper: Some(taper),
                phase: Some(0.0),
                offset: Some(0.0),
            });
            b.sweep_segments = Some(192.0);
            b.cross_section = s(pick(rng, &["diamond", "hexagonal"]));
        }
        // SW12 window-keel: a broad blade, parallel to the shoulders, with one long opening between two rails
        "window" => {
            b.base_width = q3(bw0 * rng.range(1.15, 1.35));
            b.tip_width = q3(b.base_width * rng.range(0.05, 0.1));
            b.tip_ramp_start = Some(r3(rng, 0.7, 0.82));
            b.kissaki_length = Some(r3(rng, 0.1, 0.18));
            b.cross_section = s(pick(rng, &["diamond", "hexagonal", "lenticular"]));
            b.bevel = Some(r3(rng, 0.4, 0.75));
            b.tip_shape = s("pointed");
            b.sweep_segments = Some(192.0);
            no_fullers(b);
            let start = r3(rng, 0.16, 0.26);
            let end = r3(rng, 0.6, 0.7);
            let width = r3(rng, 0.36, 0.5);
            let shoulder = r3(rng, 0.15, 0.3);
            let point = r3(rng, 0.12, 0.3);
            let arch = if rng.chance(0.35) { r3(rng, 0.6, 1.0) } else { 0.0 };
            let lip = r3(rng, 0.16, 0.26);
            b.aperture = Some(Aperture {
                start: Some(start),
                end: Some(end),
                width: Some(width),
                shoulder: Some(shoulder),
                point: Some(point),
                arch: Some(arch),
                rail: Some(0.18),
                lip: Some(lip),
            });
        }
        // SW12 faultbound: a heavy blade broken into 3-5 fragments held apart across glowing fractures
        "faultbound" => {
            b.base_width = q3(bw0 * rng.range(1.05, 1.2));
            b.tip_width = q3(b.base_width * rng.range(0.05, 0.1));
            b.tip_ramp_start = Some(r3(rng, 0.65, 0.8));
            b.kissaki_length = Some(r3(rng, 0.12, 0.2));
            b.cross_section = s(pick(rng, &["diamond", "hexagonal"]));
            b.bevel = Some(r3(rng, 0.5, 0.9));
            b.tip_shape = s("pointed");
            b.sweep_segments = Some(192.0);
            no_fullers(b);
            let segments = int(rng, 3, 5);
            let gap = r3(rng, 0.2, 0.3);
            let offset = r3(rng, 0.08, 0.2);
            let tilt = r3(rng, 0.015, 0.045);
            let zigzag = r3(rng, 0.04, 0.09);
            let seed = int(rng, 1, 65535);
            let rim = r3(rng, 0.05, 0.09);
            b.fracture = Some(Fracture {
                segments: Some(segments),
                gap: Some(gap),
                offset: Some(offset),
                tilt: Some(tilt),
                zigzag: Some(zigzag),
                seed: Some(seed),
                rim: Some(rim),
            });
        }
        _ => unreachable!("unknown monument blade family {id} (Catalogue::check)"),
    }
    if let Some(g) = b.glow.as_mut() {
        g.rune_start = Some(q3(b.ricasso_length.unwrap_or(0.0) + 0.06));
    }
}

/// bladegen's `FORGED_DEFAULTS` (`guardForged.ts`).
pub fn forged_defaults() -> Forged {
    Forged {
        height: Some(0.42),
        depth: Some(2.4),
        block: Some(0.6),
        swell: Some(1.25),
        taper: Some(0.5),
        curl: Some(0.5),
        finial: Some(0.6),
        section: Some(0.5),
        segments: Some(24.0),
        radial: Some(16.0),
    }
}

fn shape_guard(id: &str, g: &mut Guard, t: &PlanetTraits, rng: &mut Rng32, width_scale: f64) {
    if id == "forged" {
        if g.style.as_deref() != Some("forged") {
            g.style = s("forged");
            g.forged = Some(forged_defaults());
            g.shear = None;
        }
        if width_scale != 1.0 {
            g.width = q3(g.width * width_scale);
        }
        return;
    }
    if id == "shear" {
        // SW12 shear-gate: two stepped jaws either side of a hub with a glowing throat
        g.width = q3(g.width * width_scale * rng.range(1.0, 1.2));
        let height = r3(rng, 0.4, 0.54);
        let depth = r3(rng, 2.2, 3.0);
        let block = r3(rng, 0.5, 0.7);
        let tooth = r3(rng, 0.7, 1.2);
        let at = r3(rng, 0.5, 0.68);
        let span = r3(rng, 0.24, 0.36);
        let stagger = r3(rng, 0.1, 0.26);
        let chamfer = r3(rng, 0.12, 0.24);
        let throat = r3(rng, 0.5, 0.75);
        g.style = s("shear");
        g.forged = None;
        g.monument = None;
        g.shear = Some(GuardShear {
            height: Some(height),
            depth: Some(depth),
            block: Some(block),
            tooth: Some(tooth),
            at: Some(at),
            span: Some(span),
            stagger: Some(stagger),
            chamfer: Some(chamfer),
            throat: Some(throat),
        });
        g.quillon_count = Some(0.0);
        return;
    }
    let mut span = |rng: &mut Rng32, a: f64, b: f64| g.width = q3(g.width * width_scale * rng.range(a, b));
    let mut m = GuardMonument::default();
    match id {
        "recurve" => {
            span(rng, 1.15, 1.35);
            m.height = Some(r3(rng, 0.34, 0.44));
            m.depth = Some(r3(rng, 2.0, 2.6));
            m.block = Some(r3(rng, 0.45, 0.6));
            m.swell = Some(r3(rng, 1.2, 1.45));
            m.taper = Some(r3(rng, 0.25, 0.4));
            m.sweep = Some(q3(rng.range(0.7, 1.1) * if t.locked { -1.0 } else { 1.0 }));
            m.count = Some(1.0);
            m.knob = Some(if rng.chance(0.4) { r3(rng, 0.2, 0.5) } else { 0.0 });
            m.section = Some(r3(rng, 0.4, 1.0));
            m.segments = Some(32.0);
        }
        "crescent" => {
            span(rng, 0.85, 1.0);
            m.height = Some(r3(rng, 0.4, 0.5));
            m.depth = Some(r3(rng, 2.2, 2.8));
            m.block = Some(r3(rng, 0.45, 0.6));
            m.swell = Some(r3(rng, 1.0, 1.15));
            m.taper = Some(r3(rng, 0.08, 0.15));
            m.sweep = Some(-r3(rng, 1.7, 2.2));
            m.count = Some(1.0);
            m.knob = Some(0.0);
            m.section = Some(r3(rng, 0.2, 0.8));
            m.segments = Some(32.0);
        }
        "halo" => {
            span(rng, 0.85, 1.05);
            m.height = Some(r3(rng, 0.36, 0.46));
            m.depth = Some(r3(rng, 2.0, 2.6));
            m.block = Some(r3(rng, 0.4, 0.55));
            m.swell = Some(r3(rng, 1.2, 1.4));
            m.taper = Some(0.2);
            m.sweep = Some(r3(rng, -0.4, 0.4));
            m.count = Some(jmin(
                4.0,
                2.0 + (if t.moons >= 2.0 { 1.0 } else { 0.0 }) + (if t.moons >= 4.0 { 1.0 } else { 0.0 }),
            ));
            m.spike = Some(r3(rng, 0.5, 0.85));
            m.ring = Some(r3(rng, 0.55, 0.75));
            m.section = Some(r3(rng, 0.5, 1.0));
        }
        "wings" => {
            span(rng, 1.2, 1.45);
            m.height = Some(r3(rng, 0.36, 0.46));
            m.depth = Some(r3(rng, 1.6, 2.2));
            m.block = Some(r3(rng, 0.4, 0.55));
            m.swell = Some(r3(rng, 1.0, 1.2));
            m.taper = Some(r3(rng, 0.18, 0.3));
            m.sweep = Some(r3(rng, 0.8, 1.2));
            m.count = Some(int(rng, 3, 5));
            m.section = Some(r3(rng, -0.4, 0.1));
            m.segments = Some(24.0);
        }
        "talon" => {
            span(rng, 0.8, 0.95);
            m.height = Some(r3(rng, 0.48, 0.6));
            m.depth = Some(r3(rng, 2.4, 3.0));
            m.block = Some(r3(rng, 0.5, 0.65));
            m.swell = Some(r3(rng, 1.0, 1.15));
            m.taper = Some(r3(rng, 0.06, 0.12));
            m.sweep = Some(r3(rng, 1.9, 2.5));
            m.count = Some(int(rng, 2, 3));
            m.section = Some(r3(rng, 0.3, 0.9));
            m.segments = Some(24.0);
        }
        "ziggurat" => {
            span(rng, 0.9, 1.05);
            m.height = Some(r3(rng, 0.44, 0.56));
            m.depth = Some(r3(rng, 2.2, 2.8));
            m.block = Some(r3(rng, 0.5, 0.7));
            m.swell = Some(1.0);
            m.taper = Some(r3(rng, 0.7, 0.85));
            m.count = Some(int(rng, 2, 4));
            m.spike = Some(r3(rng, 0.6, 1.4));
            m.section = Some(r3(rng, -1.0, -0.8));
        }
        _ => unreachable!("unknown monument guard {id} (Catalogue::check)"),
    }
    g.style = s(id);
    g.forged = None;
    g.shear = None;
    // written in full, in the defaults' key order, as validation writes it back (the engine stores it so)
    let d = guard_defaults(id);
    g.monument = Some(GuardMonument {
        height: m.height.or(d.height),
        depth: m.depth.or(d.depth),
        block: m.block.or(d.block),
        swell: m.swell.or(d.swell),
        taper: m.taper.or(d.taper),
        sweep: m.sweep.or(d.sweep),
        count: m.count.or(d.count),
        spike: m.spike.or(d.spike),
        ring: m.ring.or(d.ring),
        knob: m.knob.or(d.knob),
        section: m.section.or(d.section),
        segments: m.segments.or(d.segments),
        radial: m.radial.or(d.radial),
    });
    g.quillon_count = Some(0.0);
}

fn shape_pommel(id: &str, p: &mut Pommel, t: &PlanetTraits, rng: &mut Rng32) {
    if id == "native" {
        return;
    }
    let size0 = p.size;
    match id {
        "gem" => {
            p.size = q3(size0 * rng.range(1.0, 1.2));
            p.elongation = r3(rng, 1.0, 1.4);
            p.shape_morph = r3(rng, 0.0, 1.0);
        }
        "sunwheel" => {
            p.size = q3(size0 * rng.range(1.0, 1.2));
            p.crown_spikes = Some(jmin(12.0, 6.0 + t.moons));
            p.crown_sharpness = Some(r3(rng, 0.4, 0.9));
        }
        "horned" => {
            p.size = q3(size0 * rng.range(0.9, 1.1));
            p.elongation = r3(rng, 0.9, 1.3);
            p.shape_morph = r3(rng, 0.0, 1.0);
        }
        "tiered" => {
            p.size = q3(size0 * rng.range(1.0, 1.2));
            p.elongation = r3(rng, 1.0, 1.5);
            p.crown_spikes = Some(int(rng, 3, 5));
        }
        _ => unreachable!("unknown monument pommel {id} (Catalogue::check)"),
    }
    p.style = s(id);
    p.ring_inner_radius = None;
}

fn shape_grip(id: &str, h: &mut Handle, rng: &mut Rng32) {
    match id {
        "native" => {}
        "ridged" => {
            h.segmentation = Some(true);
            h.segmentation_count = Some(int(rng, 8, 14));
            h.flare = Some(r3(rng, 0.0, 0.02));
            h.wrap_style = s("none");
        }
        "smooth" => {
            h.segmentation = Some(false);
            h.flare = Some(r3(rng, 0.02, 0.05));
            h.oval_ratio = Some(r3(rng, 1.0, 1.1));
            h.wrap_style = s("none");
        }
        "wound" => {
            h.segmentation = Some(true);
            h.segmentation_count = Some(int(rng, 4, 6));
            h.wrap_style = s("wire");
        }
        "banded" => {
            h.segmentation = Some(true);
            h.segmentation_count = Some(int(rng, 3, 5));
            h.oval_ratio = Some(r3(rng, 1.1, 1.25));
            h.flare = Some(0.0);
            h.wrap_style = s("none");
        }
        _ => unreachable!("unknown monument grip {id} (Catalogue::check)"),
    }
}

/// `designMonument(base, traits, seed, cat, force)`: the base sword reshaped by the picked family.
pub fn design_monument(
    base: &Sword,
    traits: &PlanetTraits,
    seed: u32,
    cat: &Catalogue,
    force: Option<&Force>,
) -> MonumentDesign {
    let (mut picks, strengths) = pick_monument(traits, seed, cat);
    if let Some(f) = force {
        let over = |slot: &mut String, v: &Option<String>| {
            if let Some(v) = v {
                *slot = v.clone();
            }
        };
        over(&mut picks.blade, &f.blade);
        over(&mut picks.guard, &f.guard);
        over(&mut picks.pommel, &f.pommel);
        over(&mut picks.grip, &f.grip);
    }
    let mut params = base.clone();
    let bw0 = params.blade.base_width;
    if picks.blade != "classic" {
        shape_blade(&picks.blade, &mut params.blade, &mut stage_rng(seed, "blade"));
    }
    let width_scale = params.blade.base_width / bw0;
    shape_guard(&picks.guard, &mut params.guard, traits, &mut stage_rng(seed, "guard"), width_scale);
    shape_pommel(&picks.pommel, &mut params.pommel, traits, &mut stage_rng(seed, "pommel"));
    shape_grip(&picks.grip, &mut params.handle, &mut stage_rng(seed, "grip"));
    MonumentDesign { seed, picks, params, strengths }
}
