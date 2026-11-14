//! SW12 faultbound (CX1 idea 3, CX2 "keep"; `blade.fracture`): the blade broken into `segments` fragments across
//! zigzag fractures, held apart by open gaps, the free fragments displaced sideways and slightly turned as if a
//! destroyed sword were held under restraint, with glowing rims along every fracture on both faces.
//!
//! Each fragment is bladegen's own blade surface ([`crate::blade::Section`]) between two fracture lines: 13 columns
//! at `s = j / 12`, and per column its own run of `t` from the lower fracture to the upper one, so the fracture
//! faces follow the zigzag exactly and every blade option (profiles, tip, bevel, serration, waves, twist, the glow
//! mask) carries over. Each fragment is a closed, outward-wound solid; the blade mesh is the fragments in order
//! (fragment k's vertices before fragment k + 1's).
//!
//! Fracture k (1..segments-1) is centred at `t = k / segments`, its zigzag a three-segment line through
//! `s = 0, 1/3, 2/3, 1` of height `zigzag`, signed per fracture; the gap is `gap` along the blade. The first
//! fragment (at the guard) and the last (the planted keel with the tip) never move. Every other one moves sideways by
//! `offset` x (0.65..1) and turns by up to `tilt` about its centre, the side and the share from FNV-1a hashes of
//! `"<seed>|fault|<k>|..."` (no PRNG stream, so nothing else's draws move). The zigzag and the turn are limited so
//! that a fracture never closes by more than 70 % of its gap (`tests/sw12.rs` measures it).
use crate::blade::{sweep_segments, Section, COLS};
use crate::geom::{clamp, cos, jmax, jmin, jround, sin, Mesh};
use crate::glow::{hash_seed, normalize_seed};
use crate::params::{Blade, Fracture};
use crate::solid::{edge_strips, glow_offset, sheet_faces, Bands, Build, Sheet};

/// The fracture's parameters, defaulted and clamped (lengths in blade units, along-blade ones also in t).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Faults {
    pub segments: usize,
    pub gap: f64,
    pub offset: f64,
    pub tilt: f64,
    pub zigzag: f64,
    pub seed: u32,
    pub rim: f64,
}

impl Faults {
    /// `w` and `l`: the section's base width and length.
    pub fn of(f: &Fracture, w: f64, l: f64) -> Faults {
        let segments = clamp(jround(f.segments.unwrap_or(4.0)), 2.0, 7.0) as usize;
        let n = segments as f64;
        // the gap at most 60 % of a fragment's share of the blade
        let gap = jmin(clamp(f.gap.unwrap_or(0.24), 0.04, 0.5) * w, 0.6 * l / n);
        let offset = clamp(f.offset.unwrap_or(0.14), 0.0, 0.4) * w;
        // the turn closes a corner by tilt * w / 2 each side: two neighbours at most 40 % of the gap together
        let tilt = jmin(clamp(f.tilt.unwrap_or(0.03), 0.0, 0.1), 0.4 * gap / w);
        // a relative sideways shift of up to 2 * offset slides along the zigzag's slope (3 zigzag / w):
        // at most 30 % of the gap; and the zigzag at most 15 % of a fragment's share
        let mut zigzag = clamp(f.zigzag.unwrap_or(0.07), 0.0, 0.15) * w;
        if offset > 0.0 {
            zigzag = jmin(zigzag, 0.05 * gap * w / offset);
        }
        zigzag = jmin(zigzag, 0.15 * l / n);
        Faults {
            segments,
            gap,
            offset,
            tilt,
            zigzag,
            seed: normalize_seed(f.seed.unwrap_or(1.0)),
            rim: clamp(f.rim.unwrap_or(0.07), 0.0, 0.25) * w,
        }
    }

    fn sign(&self, what: &str, k: usize) -> f64 {
        if hash_seed(&format!("{}|fault|{k}|{what}", self.seed)) & 1 == 0 {
            1.0
        } else {
            -1.0
        }
    }

    fn share(&self, what: &str, k: usize) -> f64 {
        (hash_seed(&format!("{}|fault|{k}|{what}", self.seed)) >> 8) as f64 / 16777216.0
    }
}

/// One fragment: its sheet (already moved), where its vertices start in the blade mesh, and how it was moved.
pub struct Fragment {
    pub sheet: Sheet,
    /// t of the lower and upper fracture per column.
    pub lo: [f64; COLS + 1],
    pub hi: [f64; COLS + 1],
    /// Sideways shift (blade units) and turn (radians) about `pivot` (x, y).
    pub shift: f64,
    pub turn: f64,
    pub pivot: (f64, f64),
}

/// The zigzag's height at s (0 at both edges, -1 at s = 1/3, +1 at s = 2/3).
pub fn zig(s: f64) -> f64 {
    if s <= 1.0 / 3.0 {
        -3.0 * s
    } else if s <= 2.0 / 3.0 {
        -1.0 + 6.0 * (s - 1.0 / 3.0)
    } else {
        1.0 - 3.0 * (s - 2.0 / 3.0)
    }
}

pub fn fragments(b: &Blade) -> (Faults, Vec<Fragment>) {
    let sec = Section::new(b);
    let (w, l) = (sec.base_width(), sec.length());
    let f = Faults::of(b.fracture.as_ref().expect("fault::fragments: blade.fracture"), w, l);
    let n = f.segments;
    let segs = sweep_segments(b);
    let (gap_t, zig_t) = (f.gap / l, f.zigzag / l);
    let line = |k: usize, j: usize| {
        let s = j as f64 / COLS as f64;
        k as f64 / n as f64 + f.sign("zig", k) * zig_t * zig(s)
    };
    let mut out = Vec::with_capacity(n);
    for k in 0..n {
        let mut lo = [0.0; COLS + 1];
        let mut hi = [1.0; COLS + 1];
        let mut mean = 0.0;
        for j in 0..=COLS {
            if k > 0 {
                lo[j] = line(k, j) + 0.5 * gap_t;
            }
            if k + 1 < n {
                hi[j] = line(k + 1, j) - 0.5 * gap_t;
            }
            mean += (hi[j] - lo[j]) / (COLS + 1) as f64;
        }
        let rows = jmax(4.0, (mean * segs as f64).ceil()) as usize;
        let mut sheet = Sheet::new(rows + 1);
        for r in 0..=rows {
            for j in 0..=COLS {
                let t = if r == rows { hi[j] } else { lo[j] + (hi[j] - lo[j]) * (r as f64 / rows as f64) };
                sheet.set(&sec, r, j, j as f64 / COLS as f64, t);
            }
        }
        let free = k > 0 && k + 1 < n;
        let (shift, turn) = if free {
            (
                f.sign("side", k) * f.offset * (0.65 + 0.35 * f.share("side", k)),
                f.sign("turn", k) * f.tilt * (0.5 + 0.5 * f.share("turn", k)),
            )
        } else {
            (0.0, 0.0)
        };
        let tm = 0.5 * (lo[COLS / 2] + hi[COLS / 2]);
        let pivot = (sec.row(tm).bend, tm * l);
        if free {
            let (c, s) = (cos(turn), sin(turn));
            for p in sheet.pos.iter_mut() {
                let (dx, dy) = (p[0] - pivot.0, p[1] - pivot.1);
                p[0] = pivot.0 + (dx * c - dy * s) + shift;
                p[1] = pivot.1 + (dx * s + dy * c);
            }
        }
        out.push(Fragment { sheet, lo, hi, shift, turn, pivot });
    }
    (f, out)
}

/// The faultbound blade: the fragments, each a closed solid wound outward, with normals, tangents, uv = (s, t) and
/// the glow mask.
pub fn build_blade(b: &Blade) -> Mesh {
    let (_, frags) = fragments(b);
    let mut out = Build::default();
    for fr in &frags {
        let base = out.pos.len() as u32;
        for k in 0..fr.sheet.pos.len() {
            out.copy_of(&fr.sheet, k);
        }
        sheet_faces(&mut out, &fr.sheet, base, &|_, _| true, [true, true]);
    }
    let glow = b.glow.as_ref().filter(|g| g.enabled != Some(false));
    let mut m = out.finish(glow);
    crate::blade::compute_blade_tangents(&mut m);
    m
}

/// The vertex range of each fragment in [`build_blade`]'s mesh (first vertex, count), for consumers that move them.
pub fn fragment_ranges(b: &Blade) -> Vec<(usize, usize)> {
    let (_, frags) = fragments(b);
    let mut first = 0;
    frags
        .iter()
        .map(|fr| {
            // the sheet's points, then each end cap's own copies (2 x 13 x 2)
            let count = fr.sheet.pos.len() + 2 * (COLS + 1) * 2;
            let r = (first, count);
            first += count;
            r
        })
        .collect()
}

/// The faultbound's glow mesh: bladegen's edge strips on every fragment and a rim along each fracture on both
/// faces. `None` when the glow is off or draws nothing.
pub fn build_glow(b: &Blade) -> Option<Mesh> {
    let g = b.glow.as_ref().filter(|g| g.enabled != Some(false))?;
    let (f, frags) = fragments(b);
    let l = jmax(0.01, b.length);
    let mut bands = Bands::new(glow_offset(b.thickness));
    let ew = g.edge_width.unwrap_or(0.0);
    let rim_t = f.rim / l;
    for (k, fr) in frags.iter().enumerate() {
        let sh = &fr.sheet;
        let rows = (sh.rows - 1) as f64;
        edge_strips(&mut bands, sh, ew, &|_, s| s * COLS as f64);
        if rim_t <= 0.0 {
            continue;
        }
        // rows per unit t differ per column: the rim is rim_t deep along the blade at every column
        let depth = |j: usize| jmin(0.45 * rows, rim_t * rows / jmax(1e-9, fr.hi[j] - fr.lo[j]));
        for (end, at_end) in [(k > 0, false), (k + 1 < frags.len(), true)] {
            if !end {
                continue;
            }
            let edge: Vec<(f64, f64)> =
                (0..=COLS).map(|j| (if at_end { rows } else { 0.0 }, j as f64)).collect();
            let inset: Vec<(f64, f64)> =
                (0..=COLS).map(|j| (if at_end { rows - depth(j) } else { depth(j) }, j as f64)).collect();
            for side in 0..2 {
                bands.band(sh, &edge, &inset, side);
            }
        }
    }
    bands.finish()
}

/// The defaults `blade.fracture` reads (`Faults::of` of an empty block), written in full: what the web app's
/// validation writes back.
pub fn defaults() -> Fracture {
    Fracture {
        segments: Some(4.0),
        gap: Some(0.24),
        offset: Some(0.14),
        tilt: Some(0.03),
        zigzag: Some(0.07),
        seed: Some(1.0),
        rim: Some(0.07),
    }
}
