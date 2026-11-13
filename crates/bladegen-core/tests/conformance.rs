//! Conformance of bladegen's geometry on the frozen corpora (moved from the galaxy kit's `tests/sword.rs`, BG1).
//!
//! The corpora were written by bladegen's TypeScript before it was retired (SW1's mesh-dump pipeline:
//! `validateSwordParams` -> `SwordGenerator` -> `prepareExport` -> `dumpMeshes`, under Node with three r180), and the
//! Rust matched them bit for bit; they are now the reference this crate must keep reproducing:
//! - SW1's 20 seeded monument swords (`sword/planet-swords` f6f3e54): `BLADEGEN_SW1`, default `vtuber-stack/reviews/sw1/fixtures`;
//! - SW2's corpus (every blade code path, the ported hilt, the 17 presets, 13 engine designs): `BLADEGEN_FIXTURES`,
//!   default `vtuber-stack/reviews/sw2/corpus`;
//! - SW7's corpus (`sword/monument-guard` f6b5ec8, the forged cross): `BLADEGEN_SW7`, default `vtuber-stack/reviews/sw7/corpus`;
//! - SW10's corpus (`sword/monument-variety` 38daabe: the monument families, 576 pick-table rows, 66 mesh cases):
//!   `BLADEGEN_SW10`, default `vtuber-stack/reviews/sw10/corpus`.
//!
//! The kit's names (`WORLDGEN_BLADEGEN_SW1`, ...) are read too. The default paths are beside a checkout in
//! `vtuber-stack/forks/bladegen` or `vtuber-stack/deps/bladegen`. A missing corpus skips its test with a message,
//! unless `BLADEGEN_REQUIRE_CORPORA` is set; `tests/goldens.rs` checks the committed digests of the same corpora
//! without them.
//!
//! Meshes are matched by name (`<part>#<k>`). Vertex counts and indices must be equal; every float attribute within
//! `TOL_ULP` f32 ulps or `TOL_ABS` (each run reports how many are bit-exact: all of them, so far); matrices within
//! 1e-12. bladegen meshes this crate does not build are counted and listed; a mesh it builds that bladegen did not
//! is a failure.
use bladegen_core::{model, params::Sword};
use serde_json::Value;
use std::path::{Path, PathBuf};

/// Float attributes: at most this many f32 ulps apart ...
const TOL_ULP: u32 = 4;
/// ... or this close in absolute value (bladegen units; 1e-6 u is about 5 µm on a 16 m blade).
const TOL_ABS: f32 = 1e-6;

fn ulps(a: f32, b: f32) -> u32 {
    if a == b {
        return 0;
    }
    let key = |x: f32| {
        let i = x.to_bits() as i32;
        if i < 0 {
            i32::MIN.wrapping_sub(i) as i64
        } else {
            i as i64
        }
    };
    (key(a) - key(b)).unsigned_abs().min(u32::MAX as u64) as u32
}

#[derive(Default)]
struct Stats {
    values: usize,
    exact: usize,
    max_ulp: u32,
    max_abs: f32,
}

fn compare(what: &str, ours: &[f32], theirs: &[f32], st: &mut Stats) -> Result<(), String> {
    if ours.len() != theirs.len() {
        return Err(format!("{what}: {} values, bladegen {}", ours.len(), theirs.len()));
    }
    for (k, (a, b)) in ours.iter().zip(theirs).enumerate() {
        st.values += 1;
        let u = ulps(*a, *b);
        let d = (a - b).abs();
        if u == 0 {
            st.exact += 1;
        }
        st.max_ulp = st.max_ulp.max(u);
        st.max_abs = st.max_abs.max(d);
        if u > TOL_ULP && d > TOL_ABS {
            return Err(format!("{what}[{k}]: {a} vs bladegen {b} ({u} ulp, {d:e})"));
        }
    }
    Ok(())
}

fn dump_dir(var: &str, default: &str) -> Option<PathBuf> {
    let ours = var.replace("WORLDGEN_BLADEGEN_", "BLADEGEN_");
    let d = std::env::var_os(&ours)
        .or_else(|| std::env::var_os(var))
        .map(PathBuf::from)
        .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../..").join(default));
    if d.join("index.json").exists() {
        return Some(d);
    }
    assert!(
        std::env::var_os("BLADEGEN_REQUIRE_CORPORA").is_none(),
        "bladegen corpus missing at {}: set {ours} to vtuber-stack/{default}",
        d.display()
    );
    eprintln!("skipped: no corpus at {} (set {ours}, or BLADEGEN_REQUIRE_CORPORA=1 to fail)", d.display());
    None
}

fn sw1_dir() -> Option<PathBuf> {
    dump_dir("WORLDGEN_BLADEGEN_SW1", "reviews/sw1/fixtures")
}

fn attr_f32(bin: &[u8], a: &Value) -> Vec<f32> {
    let (o, n) = (a["byteOffset"].as_u64().unwrap() as usize, a["byteLength"].as_u64().unwrap() as usize);
    bin[o..o + n].chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect()
}

fn attr_u32(bin: &[u8], a: &Value) -> Vec<u32> {
    let (o, n) = (a["byteOffset"].as_u64().unwrap() as usize, a["byteLength"].as_u64().unwrap() as usize);
    bin[o..o + n].chunks_exact(4).map(|c| u32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect()
}

/// Every case of a dump directory (`index.json`: an array of rows with `id`): `<id>.validated.json` in,
/// `<id>.mesh.json` + `<id>.mesh.bin` to match. Returns (meshes compared, meshes in the dumps).
fn check_dump_dir(label: &str, dir: &Path) -> (usize, usize) {
    check_dump_dir_with(label, dir, &|_, s| Ok(s))
}

/// [`check_dump_dir`] with the swords to build given by `ours(id, validated params)` (SW11's end to end: the engine's
/// own design for a case, not bladegen's).
fn check_dump_dir_with(label: &str, dir: &Path, ours_of: &dyn Fn(&str, Sword) -> Result<Sword, String>) -> (usize, usize) {
    let index: Value = serde_json::from_slice(&std::fs::read(dir.join("index.json")).unwrap()).unwrap();
    let rows = index.as_array().unwrap();
    let mut failures = Vec::new();
    let mut st = Stats::default();
    let (mut compared, mut total) = (0usize, 0usize);
    let mut unported: std::collections::BTreeMap<String, usize> = Default::default();
    let mut reasons: std::collections::BTreeSet<String> = Default::default();
    let mut by_attr: std::collections::BTreeMap<String, usize> = Default::default();
    for row in rows {
        let id = row["id"].as_str().unwrap();
        let v: Value =
            serde_json::from_slice(&std::fs::read(dir.join(format!("{id}.validated.json"))).unwrap())
                .unwrap();
        let s: Sword = match serde_json::from_value(v.get("model").cloned().unwrap_or(v))
            .map_err(|e| e.to_string())
            .and_then(|s| ours_of(id, s))
        {
            Ok(s) => s,
            Err(e) => {
                failures.push(format!("{id}: params: {e}"));
                continue;
            }
        };
        let dump: Value =
            serde_json::from_slice(&std::fs::read(dir.join(format!("{id}.mesh.json"))).unwrap()).unwrap();
        let bin = std::fs::read(dir.join(format!("{id}.mesh.bin"))).unwrap();
        let (parts, skipped) = model::build_parts(&s, true);
        reasons.extend(skipped);
        let mut k_of: std::collections::BTreeMap<&str, usize> = Default::default();
        let mut ours: std::collections::BTreeMap<String, &model::Part> = Default::default();
        for p in &parts {
            let k = k_of.entry(p.name).or_insert(0);
            ours.insert(format!("{}#{}", p.name, k), p);
            *k += 1;
        }
        for m in dump["meshes"].as_array().unwrap() {
            total += 1;
            let name = m["name"].as_str().unwrap();
            let Some(p) = ours.remove(name) else {
                *unported.entry(name.split('#').next().unwrap().to_string()).or_insert(0) += 1;
                continue;
            };
            compared += 1;
            let r = (|| -> Result<(), String> {
                if m["vertexCount"].as_u64().unwrap() as usize != p.mesh.vertex_count() {
                    return Err(format!("{} vertices, bladegen {}", p.mesh.vertex_count(), m["vertexCount"]));
                }
                if m["index"].is_null() || p.mesh.idx != attr_u32(&bin, &m["index"]) {
                    return Err("indices differ".into());
                }
                let attrs = m["attributes"].as_object().unwrap();
                for (k, a) in attrs {
                    let mine = match k.as_str() {
                        "position" => &p.mesh.pos,
                        "normal" => &p.mesh.nrm,
                        "uv" => &p.mesh.uv,
                        "color" => &p.mesh.color,
                        "tangent" => &p.mesh.tangent,
                        _ => return Err(format!("unknown attribute {k}")),
                    };
                    compare(k, mine, &attr_f32(&bin, a), &mut st)?;
                    *by_attr.entry(k.clone()).or_insert(0) += 1;
                }
                for (k, mine) in [("uv", &p.mesh.uv), ("color", &p.mesh.color), ("tangent", &p.mesh.tangent)]
                {
                    if !mine.is_empty() && !attrs.contains_key(k) {
                        return Err(format!("the port has {k}, bladegen does not"));
                    }
                }
                for (i, v) in m["matrix"].as_array().unwrap().iter().enumerate() {
                    let b = v.as_f64().unwrap();
                    if (p.matrix[i] - b).abs() > 1e-12 {
                        return Err(format!("matrix[{i}] {} vs bladegen {b}", p.matrix[i]));
                    }
                }
                Ok(())
            })();
            if let Err(e) = r {
                failures.push(format!("{id} {name}: {e}"));
            }
        }
        for name in ours.keys() {
            failures.push(format!("{id}: the port built {name}, bladegen has no such mesh"));
        }
    }
    eprintln!(
        "{label}: {} cases; {compared} of {total} meshes compared {by_attr:?}; values {}/{} bit-exact (max {} ulp, {:e}); \
         not ported, by part: {unported:?}; why: {reasons:?}",
        rows.len(), st.exact, st.values, st.max_ulp, st.max_abs
    );
    assert!(failures.is_empty(), "{} failures:\n{}", failures.len(), failures.join("\n"));
    (compared, total)
}

/// SW1's 20 seeded monument swords (bladegen sword/planet-swords f6f3e54).
#[test]
fn port_matches_sw1_fixtures() {
    let Some(dir) = sw1_dir() else { return };
    let (compared, _) = check_dump_dir("SW1 fixtures", &dir);
    // every blade, glow mesh and grip core of the 20 seeds, and the ported guards, wraps and pommels
    assert!(compared >= 160, "only {compared} meshes compared");
}

/// SW2's corpus: every blade code path, the ported hilt, bladegen's presets and the engine's own designs.
#[test]
fn port_matches_sw2_corpus() {
    let Some(dir) = dump_dir("WORLDGEN_BLADEGEN_FIXTURES", "reviews/sw2/corpus") else { return };
    let (compared, _) = check_dump_dir("SW2 corpus", &dir);
    assert!(compared >= 200, "only {compared} meshes compared");
}

/// SW7's corpus: SW2's cases regenerated on bladegen `sword/monument-guard`, the forged cross's code paths, the
/// giant `monument` preset and the engine's designs with the forged cross. Every forged guard must be compared.
#[test]
fn port_matches_sw7_corpus() {
    let Some(dir) = dump_dir("WORLDGEN_BLADEGEN_SW7", "reviews/sw7/corpus") else { return };
    let (compared, _) = check_dump_dir("SW7 corpus", &dir);
    assert!(compared >= 250, "only {compared} meshes compared");
    let index: Value = serde_json::from_slice(&std::fs::read(dir.join("index.json")).unwrap()).unwrap();
    let mut forged = 0;
    for row in index.as_array().unwrap() {
        let id = row["id"].as_str().unwrap();
        let v: Value =
            serde_json::from_slice(&std::fs::read(dir.join(format!("{id}.validated.json"))).unwrap()).unwrap();
        if v["guard"]["style"] == "forged" {
            forged += 1;
            assert!(v["guard"]["forged"].is_object(), "{id}: no forged block");
        }
    }
    // 10 feature cases, the giant preset, 13 designs
    assert!(forged >= 24, "only {forged} forged-cross cases");
}

fn sw10_dir() -> Option<PathBuf> {
    dump_dir("WORLDGEN_BLADEGEN_SW10", "reviews/sw10/corpus")
}

/// JSON with every number parsed by `str::parse::<f64>` (correctly rounded), so values written by JavaScript's
/// `JSON.stringify` compare bit for bit (serde_json's default float parser is within 1 ulp, not exact).
fn exact_json(text: &str) -> Value {
    let mut q = String::with_capacity(text.len() + text.len() / 4);
    let mut chars = text.chars().peekable();
    let mut in_str = false;
    while let Some(c) = chars.next() {
        if in_str {
            q.push(c);
            if c == '\\' {
                q.push(chars.next().unwrap());
            } else if c == '"' {
                in_str = false;
            }
        } else if c == '"' {
            in_str = true;
            q.push(c);
        } else if c == '-' || c.is_ascii_digit() {
            q.push_str("\"\\u0001");
            q.push(c);
            while let Some(&d) = chars.peek() {
                if d.is_ascii_digit() || matches!(d, '.' | 'e' | 'E' | '+' | '-') {
                    q.push(d);
                    chars.next();
                } else {
                    break;
                }
            }
            q.push('"');
        } else {
            q.push(c);
        }
    }
    fn conv(v: Value) -> Value {
        match v {
            Value::String(s) if s.starts_with('\u{1}') => {
                if let Ok(n) = s[1..].parse::<u64>() {
                    return Value::from(n);
                }
                if let Ok(n) = s[1..].parse::<i64>() {
                    return Value::from(n);
                }
                let x: f64 = s[1..].parse().unwrap();
                serde_json::Number::from_f64(x).map(Value::Number).unwrap()
            }
            Value::Array(a) => Value::Array(a.into_iter().map(conv).collect()),
            Value::Object(m) => Value::Object(m.into_iter().map(|(k, v)| (k, conv(v))).collect()),
            v => v,
        }
    }
    conv(serde_json::from_str(&q).unwrap())
}

fn read_exact(p: &Path) -> Value {
    exact_json(&std::fs::read_to_string(p).unwrap_or_else(|e| panic!("{}: {e}", p.display())))
}

fn sword_of(v: &Value) -> Sword {
    serde_json::from_value(v.clone()).unwrap()
}

fn force_of(v: &Value) -> Option<bladegen_core::families::Force> {
    let o = v.as_object()?;
    let g = |k: &str| o.get(k).and_then(|x| x.as_str()).map(String::from);
    Some(bladegen_core::families::Force { blade: g("blade"), guard: g("guard"), pommel: g("pommel"), grip: g("grip") })
}

fn picks_of(v: &Value) -> bladegen_core::families::Picks {
    let g = |k: &str| v[k].as_str().unwrap().to_string();
    bladegen_core::families::Picks { blade: g("blade"), guard: g("guard"), pommel: g("pommel"), grip: g("grip") }
}

/// The engine's tuning table is bladegen's (`sword/catalogue.json` = the corpus's `catalogue.json`, entry for entry
/// and number for number), and it passes the engine's own check.
#[test]
fn the_catalogue_is_bladegens() {
    let Some(dir) = sw10_dir() else { return };
    use bladegen_core::families::{catalogue, Catalogue};
    let theirs: Catalogue = serde_json::from_value(read_exact(&dir.join("catalogue.json"))).unwrap();
    let ours: Catalogue = serde_json::from_value(exact_json(bladegen_core::families::CATALOGUE_JSON)).unwrap();
    assert_eq!(ours, theirs, "src/three/sword/monument/catalogue.json differs from the corpus's");
    assert_eq!(catalogue(), &theirs);
    theirs.check().unwrap();
    // a bad table is refused
    let bad = bladegen_core::families::CATALOGUE_JSON.replace("\"talon\"", "\"claw\"");
    assert!(Catalogue::parse(&bad).is_err());
}

/// SW10's pick table: 12 trait profiles x 48 seeds on the giant `monument` preset. Strengths and every stage's
/// weights bit-equal (f64), the picks equal and the designed params equal as numbers.
#[test]
fn families_match_sw10_pick_table() {
    let Some(dir) = sw10_dir() else { return };
    use bladegen_core::families::{catalogue, design_monument, entry_weights, trait_strengths, PlanetTraits};
    let t = read_exact(&dir.join("picks.json"));
    let base = sword_of(&t["base"]);
    let cat = catalogue();
    let rows = t["rows"].as_array().unwrap();
    let mut seen: std::collections::BTreeSet<String> = Default::default();
    let mut values = 0usize;
    for (i, row) in rows.iter().enumerate() {
        let traits = PlanetTraits::from_json(&row["traits"]);
        let seed = row["seed"].as_f64().unwrap() as u32;
        let d = design_monument(&base, &traits, seed, cat, None);
        let what = format!("row {i} ({} seed {seed})", row["profile"]);
        // strengths, in catalogue order
        let st = trait_strengths(&traits, cat);
        let theirs = row["strengths"].as_object().unwrap();
        assert_eq!(st.len(), theirs.len(), "{what}");
        for ((id, s), (tid, ts)) in st.iter().zip(theirs) {
            assert_eq!(id, tid, "{what}");
            assert_eq!(s.to_bits(), ts.as_f64().unwrap().to_bits(), "{what}: strength {id} {s} vs {ts}");
            values += 1;
        }
        assert_eq!(d.strengths, st, "{what}");
        // weights per stage, with the earlier picks
        let picks = picks_of(&row["picks"]);
        assert_eq!(d.picks, picks, "{what}: picks");
        let order = [picks.blade.as_str(), picks.guard.as_str(), picks.pommel.as_str(), picks.grip.as_str()];
        for (k, (stage, list)) in
            [("blades", &cat.blades), ("guards", &cat.guards), ("pommels", &cat.pommels), ("grips", &cat.grips)]
                .into_iter()
                .enumerate()
        {
            let ws = entry_weights(list, &st, &order[..k]);
            let theirs = row["weights"][stage].as_array().unwrap();
            assert_eq!(ws.len(), theirs.len(), "{what} {stage}");
            for ((id, w), tw) in ws.iter().zip(theirs) {
                assert_eq!(id, tw[0].as_str().unwrap(), "{what} {stage}");
                let tw = tw[1].as_f64().unwrap();
                assert_eq!(w.to_bits(), tw.to_bits(), "{what} {stage} {id}: {w} vs {tw}");
                values += 1;
            }
        }
        for p in order {
            seen.insert(p.to_string());
        }
        assert_eq!(d.params, sword_of(&row["params"]), "{what}: designed params");
    }
    eprintln!("SW10 pick table: {} rows, {values} strengths and weights bit-equal; ids drawn: {seen:?}", rows.len());
    assert_eq!(rows.len(), 576);
}

/// SW10's mesh cases' designs: `design_monument(base, traits, seed, force)` gives the corpus's picks and params.
#[test]
fn families_match_sw10_cases() {
    use bladegen_core::families::{catalogue, design_monument, PlanetTraits};
    let Some(dir) = sw10_dir() else { return };
    let index = read_exact(&dir.join("index.json"));
    let mut n = 0;
    for row in index.as_array().unwrap() {
        let id = row["id"].as_str().unwrap();
        let c = read_exact(&dir.join(format!("{id}.case.json")));
        let f = force_of(&c["force"]);
        let d = design_monument(
            &sword_of(&c["base"]),
            &PlanetTraits::from_json(&c["traits"]),
            c["seed"].as_f64().unwrap() as u32,
            catalogue(),
            f.as_ref(),
        );
        assert_eq!(d.picks, picks_of(&c["picks"]), "{id}: picks");
        assert_eq!(d.params, sword_of(&c["params"]), "{id}: params");
        n += 1;
    }
    eprintln!("SW10 cases: {n} designs equal");
    assert_eq!(n, 66);
}

/// SW10's corpus meshes: every monument guard, pommel, blade family and grip, and 31 engine designs, bit for bit. The
/// only meshes left out are the giant `monument` preset's crisscross grip wraps (TubeGeometry; the preset is the
/// feature cases' base, no planet design uses them).
#[test]
fn port_matches_sw10_corpus() {
    let Some(dir) = sw10_dir() else { return };
    let (compared, total) = check_dump_dir("SW10 corpus", &dir);
    assert!(compared >= 400, "only {compared} of {total} meshes compared");
    let index: Value = serde_json::from_slice(&std::fs::read(dir.join("index.json")).unwrap()).unwrap();
    let mut styles: std::collections::BTreeSet<String> = Default::default();
    for row in index.as_array().unwrap() {
        let id = row["id"].as_str().unwrap();
        let v: Value =
            serde_json::from_slice(&std::fs::read(dir.join(format!("{id}.validated.json"))).unwrap()).unwrap();
        styles.insert(format!("guard:{}", v["guard"]["style"].as_str().unwrap()));
        styles.insert(format!("pommel:{}", v["pommel"]["style"].as_str().unwrap()));
    }
    for g in bladegen_core::monument::GUARD_STYLES {
        assert!(styles.contains(&format!("guard:{g}")), "no {g} guard in the corpus");
    }
    for p in bladegen_core::monument::POMMEL_STYLES {
        assert!(styles.contains(&format!("pommel:{p}")), "no {p} pommel in the corpus");
    }
}

/// SW1's PRNG test vectors (`rng.json`).
#[test]
fn rng_matches_sw1_vectors() {
    use bladegen_core::glow::{fmix32, hash_seed, normalize_seed_str, q3, Rng32};
    let Some(dir) = sw1_dir() else { return };
    let v: Value = serde_json::from_slice(&std::fs::read(dir.join("rng.json")).unwrap()).unwrap();
    for c in v["fmix32"].as_array().unwrap() {
        assert_eq!(fmix32(c["in"].as_u64().unwrap() as u32) as u64, c["out"].as_u64().unwrap());
    }
    for c in v["hashSeed"].as_array().unwrap() {
        assert_eq!(hash_seed(c["in"].as_str().unwrap()) as u64, c["out"].as_u64().unwrap());
    }
    for c in v["q3"].as_array().unwrap() {
        assert_eq!(q3(c["in"].as_f64().unwrap()), c["out"].as_f64().unwrap());
    }
    for c in v["sequences"].as_array().unwrap() {
        let seed = match &c["seed"] {
            Value::String(s) => normalize_seed_str(s),
            n => n.as_u64().unwrap() as u32,
        };
        let mut r = Rng32::new(seed);
        for x in c["next"].as_array().unwrap() {
            // next() is u32 / 2^32 exactly; compare the integer (serde_json parses floats best-effort, within 1 ulp)
            assert_eq!(
                r.next() * 4_294_967_296.0,
                (x.as_f64().unwrap() * 4_294_967_296.0).round(),
                "seed {}",
                c["seed"]
            );
        }
    }
}

