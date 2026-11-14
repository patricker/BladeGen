//! SW12: window-keel (`keel`), faultbound (`fault`) and shear-gate (`shear`), the three CX2 studies made into
//! parameterised features of the core, and their dormant (weight-0) catalogue entries.
//!
//! - topology: every new solid is closed (each directed edge once, its reverse once) and wound outward (positive
//!   signed volume), finite, with unit normals; over defaults, parameter sweeps and every distinct blade of the
//!   committed goldens (182 swords: every blade code path the corpora cover);
//! - the same surface: the window-keel's outer edges and the faultbound's root are bladegen's grid blade, bit for bit;
//! - the shapes: the window is open through the blade and the keel solid; the rails keep `rail`; fragments never
//!   touch (measured gap); the planted fragments do not move; the shear-gate's jaws are point-symmetric, sized from
//!   the blade, the hub on the guard line, the throat a glow part;
//! - the catalogue: the dormant entries are never drawn (12 profiles x 4096 seeds), a forced pick designs and builds a
//!   whole sword, the recipe's values are inside the parameters' ranges;
//! - determinism: every build twice is identical, and `tests/goldens/sw12.json` pins the digests of 24 SW12 swords
//!   (`BLADEGEN_RECORD_GOLDENS=1` re-records; the web app's `core.spec.ts` checks the wasm module against it).
use bladegen_core::blade::{self, build_blade, Section, COLS};
use bladegen_core::families::{self, catalogue, design_monument, Force, PlanetTraits};
use bladegen_core::geom::{world_bbox, Mesh};
use bladegen_core::params::{Aperture, Blade, Fracture, Guard, GuardShear, Sword};
use bladegen_core::{fault, glow, keel, model, shear};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// SW10's pick-table base (bladegen's giant `monument` preset), grip wrap off (the core has no crisscross).
const BASE: &str = r##"{"blade": {"family": "straight", "length": 3.6, "baseWidth": 0.6, "tipWidth": 0.04, "thickness": 0.156,
 "curvature": 0, "tipRampStart": 0.68, "serrationAmplitude": 0, "serrationFrequency": 0, "chaos": 0, "asymmetry": 0,
 "edgeType": "double", "thicknessLeft": 0.156, "thicknessRight": 0.156, "baseAngle": 0, "tipShape": "pointed",
 "kissakiLength": 0.2, "kissakiRoundness": 0.35, "ricassoLength": 0.07, "crossSection": "diamond", "bevel": 0.6,
 "sweepSegments": 128, "glow": {"enabled": true, "color": "#7fd8ff", "intensity": 4.5, "edgeWidth": 0.06,
 "edgeMask": 1, "coreWidth": 0.12, "coreMask": 0.35, "runeCount": 7, "runeSeed": 1066, "runeStart": 0.14,
 "runeEnd": 0.68, "runeScale": 0.5, "runeStroke": 0.15, "runeFaces": "both", "pulseHz": 0.4}},
 "hiltEnabled": true, "guardEnabled": true,
 "guard": {"width": 2.4, "thickness": 0.24, "tilt": 0, "style": "forged", "quillonCount": 0,
  "forged": {"height": 0.45, "depth": 2.4, "block": 0.6, "swell": 1.3, "taper": 0.45, "curl": 0.55, "finial": 0.7,
   "section": 0.6, "segments": 24, "radial": 16}},
 "handle": {"length": 1, "radiusTop": 0.13, "radiusBottom": 0.12, "segmentation": true, "phiSegments": 64,
  "wrapStyle": "none", "ovalRatio": 1},
 "pommel": {"size": 0.3, "elongation": 1.1, "style": "wheel", "shapeMorph": 0.3, "offsetX": 0, "offsetY": 0,
  "facetCount": 32}}"##;

fn base() -> Sword {
    serde_json::from_str(BASE).unwrap()
}

/// The distinct swords of the committed goldens (SW1, SW2, SW7, SW10 corpora).
fn golden_swords() -> Vec<Sword> {
    let p = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/goldens/corpora.json");
    let g: Value = serde_json::from_slice(&std::fs::read(p).unwrap()).unwrap();
    g["params"].as_array().unwrap().iter().map(|v| serde_json::from_value(v.clone()).unwrap()).collect()
}

/// Welded at 1e-7: every directed edge once and its reverse once (degenerate slivers skipped).
fn closed(m: &Mesh) -> Result<(), String> {
    let q = |x: f32| (x as f64 * 1e7).round() as i64;
    let key = |i: u32| {
        let i = i as usize * 3;
        (q(m.pos[i]), q(m.pos[i + 1]), q(m.pos[i + 2]))
    };
    let mut directed: HashMap<_, u32> = HashMap::new();
    for t in m.idx.chunks_exact(3) {
        let v = [key(t[0]), key(t[1]), key(t[2])];
        if v[0] == v[1] || v[1] == v[2] || v[0] == v[2] {
            continue;
        }
        for e in 0..3 {
            *directed.entry((v[e], v[(e + 1) % 3])).or_insert(0) += 1;
        }
    }
    for ((a, b), n) in &directed {
        if *n != 1 || directed.get(&(*b, *a)) != Some(&1) {
            return Err(format!("edge {a:?} -> {b:?} x{n}, reverse x{:?}", directed.get(&(*b, *a))));
        }
    }
    Ok(())
}

fn signed_volume(m: &Mesh, tris: std::ops::Range<usize>) -> f64 {
    let p = |i: u32| {
        let i = i as usize * 3;
        [m.pos[i] as f64, m.pos[i + 1] as f64, m.pos[i + 2] as f64]
    };
    let mut v = 0.0;
    for t in m.idx.chunks_exact(3).skip(tris.start).take(tris.len()) {
        let (a, b, c) = (p(t[0]), p(t[1]), p(t[2]));
        v += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0])
            + a[2] * (b[0] * c[1] - b[1] * c[0]);
    }
    v / 6.0
}

/// Closed, outward, finite, unit normals, indices in range, every vertex used.
fn solid(m: &Mesh, what: &str) {
    let n = m.vertex_count();
    assert!(n > 0 && m.idx.len() % 3 == 0, "{what}");
    assert!(m.idx.iter().all(|&i| (i as usize) < n), "{what}: index out of range");
    let mut used = vec![false; n];
    m.idx.iter().for_each(|&i| used[i as usize] = true);
    assert!(used.iter().all(|u| *u), "{what}: unused vertices");
    assert!(m.pos.iter().chain(&m.nrm).all(|x| x.is_finite()), "{what}: not finite");
    for v in m.nrm.chunks_exact(3) {
        let l = (v[0] as f64).hypot(v[1] as f64).hypot(v[2] as f64);
        assert!((l - 1.0).abs() < 1e-4, "{what}: normal length {l}");
    }
    closed(m).unwrap_or_else(|e| panic!("{what}: not closed: {e}"));
    let vol = signed_volume(m, 0..m.idx.len() / 3);
    assert!(vol > 0.0, "{what}: signed volume {vol}");
}

fn with_aperture(mut s: Sword, a: Aperture) -> Sword {
    s.blade.aperture = Some(a);
    s
}

fn with_fracture(mut s: Sword, f: Fracture) -> Sword {
    s.blade.fracture = Some(f);
    s
}

fn bytes(m: &Mesh) -> Vec<u8> {
    let mut out = Vec::new();
    for xs in [&m.pos, &m.nrm, &m.uv, &m.color, &m.tangent] {
        out.extend((xs.len() as u64).to_le_bytes());
        xs.iter().for_each(|x| out.extend(x.to_le_bytes()));
    }
    m.idx.iter().for_each(|i| out.extend(i.to_le_bytes()));
    out
}

// ---------------------------------------------------------------- window-keel

#[test]
fn window_keel_is_one_closed_outward_solid_over_its_parameters() {
    let mut n = 0;
    for start in [0.08, 0.2, 0.35] {
        for end in [0.5, 0.66, 0.8] {
            for width in [0.15, 0.42, 0.65] {
                for (shoulder, point, arch) in [(0.0, 1.0, 0.0), (0.22, 0.22, 0.0), (0.45, 0.05, 1.0)] {
                    let a = Aperture {
                        start: Some(start),
                        end: Some(end),
                        width: Some(width),
                        shoulder: Some(shoulder),
                        point: Some(point),
                        arch: Some(arch),
                        ..Default::default()
                    };
                    let s = with_aperture(base(), a);
                    let m = build_blade(&s.blade);
                    solid(&m, &format!("window {start} {end} {width} {shoulder} {point} {arch}"));
                    assert_eq!(m.uv.len(), m.vertex_count() * 2);
                    assert_eq!(m.color.len(), m.vertex_count() * 4);
                    assert_eq!(m.tangent.len(), m.vertex_count() * 4);
                    n += 1;
                }
            }
        }
    }
    assert_eq!(n, 81);
}

#[test]
fn window_keel_holds_on_every_golden_blade() {
    let swords = golden_swords();
    for (k, s) in swords.iter().enumerate() {
        let s = with_aperture(s.clone(), Aperture::default());
        solid(&build_blade(&s.blade), &format!("golden sword {k} with a window"));
        let g = glow::build_glow(&s.blade, &[]);
        if s.blade.glow.as_ref().is_some_and(|g| g.enabled != Some(false)) {
            let g = g.expect("glow");
            assert!(g.pos.iter().all(|x| x.is_finite()));
        }
    }
    eprintln!("window-keel on {} golden blades: closed and outward", swords.len());
}

/// Ray along Z at (x, y) through the mesh: does it hit a triangle?
fn hits(m: &Mesh, x: f64, y: f64) -> bool {
    let p = |i: u32| {
        let i = i as usize * 3;
        (m.pos[i] as f64, m.pos[i + 1] as f64)
    };
    m.idx.chunks_exact(3).any(|t| {
        let (a, b, c) = (p(t[0]), p(t[1]), p(t[2]));
        let d = (b.0 - a.0) * (c.1 - a.1) - (b.1 - a.1) * (c.0 - a.0);
        if d.abs() < 1e-18 {
            return false;
        }
        let u = ((b.0 - x) * (c.1 - y) - (b.1 - y) * (c.0 - x)) / d;
        let v = ((c.0 - x) * (a.1 - y) - (c.1 - y) * (a.0 - x)) / d;
        u >= 0.0 && v >= 0.0 && u + v <= 1.0
    })
}

#[test]
fn the_window_is_open_the_rails_hold_and_the_keel_is_solid() {
    for width in [0.2, 0.42, 0.6] {
        let a = Aperture { width: Some(width), ..Default::default() };
        let s = with_aperture(base(), a);
        let b = &s.blade;
        let m = build_blade(b);
        let lay = keel::layout(b);
        let sec = Section::new(b);
        let w = sec.base_width();
        let l = sec.length();
        // through the opening's middle: nothing; through each rail: the blade
        let tm = 0.5 * (lay.window.start + lay.window.end);
        let r = sec.row(tm);
        assert!(!hits(&m, r.bend, tm * l), "width {width}: the opening is closed");
        assert!(hits(&m, r.xl + 0.03 * w, tm * l) && hits(&m, r.xr - 0.03 * w, tm * l), "width {width}: no rails");
        // the opening spans start..end, the keel below the tip is solid, the root above the guard too
        assert!(hits(&m, sec.row(0.05).bend, 0.05 * l), "width {width}: no root");
        assert!(hits(&m, sec.row(0.85).bend, 0.85 * l), "width {width}: no keel");
        // every row's rails: at least `rail` W wide (or 20 % of the half width where the blade narrows)
        for i in lay.i0..=lay.i1 {
            let r = sec.row(i as f64 / lay.segs as f64);
            let (sl, sr) = lay.edges[i];
            let wid = r.xr - r.xl;
            let (left, right) = (sl * wid, (1.0 - sr) * wid);
            let local = (r.bend - r.xl).min(r.xr - r.bend);
            let need = (lay.window.rail * w).min(0.2 * local) - 1e-12;
            assert!(left >= need && right >= need, "width {width} row {i}: rails {left} {right} < {need}");
        }
        // the opening is as wide as asked in its middle (where the rails allow)
        let (sl, sr) = lay.edges[(lay.i0 + lay.i1) / 2];
        let ri = sec.row(((lay.i0 + lay.i1) / 2) as f64 / lay.segs as f64);
        let open = (sr - sl) * (ri.xr - ri.xl);
        let local = (ri.bend - ri.xl).min(ri.xr - ri.bend);
        let want = (width * w).min(2.0 * (local - lay.window.rail * w));
        assert!((open - want).abs() < 1e-9 * l, "width {width}: opening {open} vs {want}");
    }
}

#[test]
fn window_keel_is_the_grid_blades_surface() {
    // columns 0 and 12 are s = 0 and 1 on every row: the same outline and edge thickness as the grid blade
    for s in golden_swords().into_iter().take(40).chain([base()]) {
        let grid = build_blade(&s.blade);
        let s = with_aperture(s, Aperture::default());
        let lay = keel::layout(&s.blade);
        let stride = (COLS + 1) * 2;
        for i in 0..=lay.segs {
            for (j, side) in [(0, 0), (0, 1), (COLS, 0), (COLS, 1)] {
                let g = &grid.pos[(i * stride + j * 2 + side) * 3..][..3];
                let k = lay.sheet.pos[lay.sheet.at(i, j, side)];
                assert_eq!([g[0], g[1], g[2]], [k[0] as f32, k[1] as f32, k[2] as f32], "row {i} col {j}");
            }
        }
    }
}

// ---------------------------------------------------------------- faultbound

/// Fragment k's triangles: [`fault::build_blade`] writes each fragment's faces in order, 13 x rows x 4 broad, 4 side
/// and 2 x 12 x 2 cap triangles.
fn fragment_tris(b: &Blade) -> Vec<std::ops::Range<usize>> {
    let (_, frags) = fault::fragments(b);
    let mut at = 0;
    frags
        .iter()
        .map(|f| {
            let rows = f.sheet.rows - 1;
            let n = rows * (COLS * 4 + 4) + 2 * COLS * 2;
            at += n;
            at - n..at
        })
        .collect()
}

#[test]
fn faultbound_fragments_are_closed_outward_solids_over_its_parameters() {
    let mut n = 0;
    for segments in [2.0, 4.0, 7.0] {
        for gap in [0.08, 0.24, 0.4] {
            for (offset, tilt, zigzag) in [(0.0, 0.0, 0.0), (0.14, 0.03, 0.07), (0.35, 0.08, 0.12)] {
                for seed in [1.0, 7.0, 65535.0] {
                    let f = Fracture {
                        segments: Some(segments),
                        gap: Some(gap),
                        offset: Some(offset),
                        tilt: Some(tilt),
                        zigzag: Some(zigzag),
                        seed: Some(seed),
                        ..Default::default()
                    };
                    let s = with_fracture(base(), f);
                    let m = build_blade(&s.blade);
                    let what = format!("fault {segments} {gap} {offset} {tilt} {zigzag} {seed}");
                    solid(&m, &what);
                    let ranges = fragment_tris(&s.blade);
                    assert_eq!(ranges.len(), segments as usize, "{what}");
                    assert_eq!(ranges.last().unwrap().end, m.idx.len() / 3, "{what}");
                    for (k, r) in ranges.into_iter().enumerate() {
                        assert!(signed_volume(&m, r) > 0.0, "{what}: fragment {k} inward");
                    }
                    let vr = fault::fragment_ranges(&s.blade);
                    assert_eq!(vr.iter().map(|r| r.1).sum::<usize>(), m.vertex_count(), "{what}");
                    n += 1;
                }
            }
        }
    }
    assert_eq!(n, 81);
}

#[test]
fn faultbound_holds_on_every_golden_blade() {
    let swords = golden_swords();
    for (k, s) in swords.iter().enumerate() {
        let s = with_fracture(s.clone(), Fracture::default());
        solid(&build_blade(&s.blade), &format!("golden sword {k} broken"));
        if let Some(g) = glow::build_glow(&s.blade, &[]) {
            assert!(g.pos.iter().all(|x| x.is_finite()));
        }
    }
}

fn seg_dist(p: (f64, f64), a: (f64, f64), b: (f64, f64)) -> f64 {
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let l2 = dx * dx + dy * dy;
    let t = if l2 > 0.0 { (((p.0 - a.0) * dx + (p.1 - a.1) * dy) / l2).clamp(0.0, 1.0) } else { 0.0 };
    let (x, y) = (a.0 + t * dx - p.0, a.1 + t * dy - p.1);
    (x * x + y * y).sqrt()
}

#[test]
fn fragments_never_touch_and_the_ends_stay_planted() {
    for segments in [2.0, 3.0, 4.0, 5.0, 7.0] {
        for gap in [0.08, 0.2, 0.3, 0.4] {
            for (offset, tilt, zigzag) in [(0.0, 0.0, 0.12), (0.14, 0.03, 0.07), (0.4, 0.1, 0.15), (0.35, 0.0, 0.15)] {
                for seed in 1..=12 {
                    let f = Fracture {
                        segments: Some(segments),
                        gap: Some(gap),
                        offset: Some(offset),
                        tilt: Some(tilt),
                        zigzag: Some(zigzag),
                        seed: Some(seed as f64),
                        ..Default::default()
                    };
                    let s = with_fracture(base(), f);
                    let (faults, frags) = fault::fragments(&s.blade);
                    let what = format!("{segments} {gap} {offset} {tilt} {zigzag} seed {seed}");
                    let last = frags.len() - 1;
                    assert!(frags[0].shift == 0.0 && frags[0].turn == 0.0, "{what}");
                    assert!(frags[last].shift == 0.0 && frags[last].turn == 0.0, "{what}");
                    // the closest approach across each fracture, in the blade's plane (the solids are thin
                    // along Z), from every end point of one fragment to the other's end polyline, both ways
                    for k in 0..last {
                        let (a, b) = (&frags[k].sheet, &frags[k + 1].sheet);
                        let line = |sh: &fault::Fragment, r: usize| -> Vec<(f64, f64)> {
                            (0..=COLS)
                                .flat_map(|j| {
                                    [0, 1].map(|side| {
                                        let p = sh.sheet.pos[sh.sheet.at(r, j, side)];
                                        (p[0], p[1])
                                    })
                                })
                                .collect()
                        };
                        let top = line(&frags[k], a.rows - 1);
                        let bottom = line(&frags[k + 1], 0);
                        let mut d = f64::INFINITY;
                        for (pts, poly) in [(&top, &bottom), (&bottom, &top)] {
                            for p in pts.iter() {
                                for w in poly.windows(2) {
                                    d = d.min(seg_dist(*p, w[0], w[1]));
                                }
                            }
                        }
                        let _ = b;
                        assert!(d >= 0.25 * faults.gap, "{what}: fracture {k} closes to {d} (gap {})", faults.gap);
                    }
                }
            }
        }
    }
}

#[test]
fn faultbound_root_is_the_grid_blades_surface() {
    let s = with_fracture(base(), Fracture::default());
    let grid = build_blade(&base().blade);
    let (_, frags) = fault::fragments(&s.blade);
    // fragment 0's first row is the grid blade's row 0, the last fragment's last row its tip row
    for j in 0..=COLS {
        for side in 0..2 {
            let g = &grid.pos[(j * 2 + side) * 3..][..3];
            let p = frags[0].sheet.pos[frags[0].sheet.at(0, j, side)];
            assert_eq!([g[0], g[1], g[2]], [p[0] as f32, p[1] as f32, p[2] as f32]);
            let segs = blade::sweep_segments(&s.blade);
            let g = &grid.pos[((segs * (COLS + 1) + j) * 2 + side) * 3..][..3];
            let f = frags.last().unwrap();
            let p = f.sheet.pos[f.sheet.at(f.sheet.rows - 1, j, side)];
            assert_eq!([g[0], g[1], g[2]], [p[0] as f32, p[1] as f32, p[2] as f32]);
        }
    }
}

// ---------------------------------------------------------------- shear-gate

fn shear_guard(sh: GuardShear) -> Guard {
    let mut g = base().guard;
    g.style = Some("shear".into());
    g.forged = None;
    g.shear = Some(sh);
    g
}

#[test]
fn shear_gate_is_closed_outward_sized_from_the_blade_and_point_symmetric() {
    let b = base().blade;
    for (height, tooth, stagger, chamfer, throat) in
        [(0.46, 0.95, 0.18, 0.18, 0.62), (0.25, 0.0, 0.0, 0.0, 0.0), (0.8, 1.6, 0.5, 0.35, 0.9), (0.4, 0.3, 0.3, 0.1, 0.3)]
    {
        let sh = GuardShear {
            height: Some(height),
            tooth: Some(tooth),
            stagger: Some(stagger),
            chamfer: Some(chamfer),
            throat: Some(throat),
            ..shear::defaults()
        };
        let g = shear_guard(sh.clone());
        let what = format!("{height} {tooth} {stagger} {chamfer} {throat}");
        let (m, t, hy) = shear::geometry(&g, &b);
        // three prisms (hub, right jaw, left jaw), each closed: welded together they stay closed
        solid(&m, &what);
        match t {
            Some(t) => {
                solid(&t, &format!("{what} throat"));
                assert!(throat > 0.0);
                assert!(t.color.iter().all(|c| *c == 1.0));
            }
            None => assert_eq!(throat, 0.0),
        }
        // point symmetry: the vertex set maps to itself under (x, y) -> (-x, -y), apart from the hub's own
        let q = |x: f32| (x as f64 * 1e6).round() as i64;
        let set: std::collections::HashSet<_> =
            m.pos.chunks_exact(3).map(|v| (q(v[0]), q(v[1]), q(v[2]))).collect();
        assert!(m.pos.chunks_exact(3).all(|v| set.contains(&(q(-v[0]), q(-v[1]), q(v[2])))), "{what}: symmetry");
        // sized from the blade: twice the blade (width, thickness, span) is twice the guard
        let mut b2 = b.clone();
        b2.base_width *= 2.0;
        b2.thickness_left = b2.thickness_left.map(|x| x * 2.0);
        b2.thickness_right = b2.thickness_right.map(|x| x * 2.0);
        let mut g2 = g.clone();
        g2.width *= 2.0;
        let (m2, _, hy2) = shear::geometry(&g2, &b2);
        assert!((hy2 - 2.0 * hy).abs() < 1e-12, "{what}");
        let (lo, hi) = m.bbox();
        let (lo2, hi2) = m2.bbox();
        for a in 0..3 {
            assert!((lo2[a] - 2.0 * lo[a]).abs() < 1e-5 && (hi2[a] - 2.0 * hi[a]).abs() < 1e-5, "{what}");
        }
        // the span is the guard's width
        assert!((hi[0] - 0.5 * g.width).abs() < 1e-6 && (lo[0] + 0.5 * g.width).abs() < 1e-6, "{what}");
    }
}

#[test]
fn shear_gate_sits_on_the_guard_line_and_its_throat_glows() {
    let mut s = base();
    s.guard = shear_guard(shear::defaults());
    let (parts, skipped) = model::build_parts(&s, true);
    assert!(skipped.is_empty(), "{skipped:?}");
    let names: Vec<&str> = parts.iter().map(|p| p.name).collect();
    assert_eq!(names, ["blade", "glow", "handle", "guard", "glow", "pommel"]);
    let blade_base = world_bbox(&parts[0].mesh, &parts[0].matrix).0[1];
    let (_, _, hy) = shear::geometry(&s.guard, &s.blade);
    assert_eq!(parts[3].matrix[13], blade_base - hy);
    assert_eq!(parts[4].matrix, parts[3].matrix);
    // no glow, no throat
    s.blade.glow.as_mut().unwrap().enabled = Some(false);
    let names: Vec<&str> = model::build_parts(&s, true).0.iter().map(|p| p.name).collect();
    assert_eq!(names, ["blade", "handle", "guard", "pommel"]);
}

// ---------------------------------------------------------------- the catalogue

fn profiles() -> Vec<PlanetTraits> {
    let t = |a: &str, g: f64, temp: f64, w: f64, locked: bool, dip: f64, volc: f64, moons: f64, rings: bool,
             teff: f64, ecc: f64, hab: f64| {
        PlanetTraits::from_json(&json!({"archetype": a, "gravityG": g, "meanTempK": temp, "waterMassFraction": w,
            "locked": locked, "hasDynamo": dip > 0.0, "dipoleIndex": dip, "volcanismIndex": volc, "moons": moons,
            "rings": rings, "teffK": teff, "eccentricity": ecc, "habitability": hab}))
    };
    vec![
        t("temperate", 1.0, 288.0, 0.02, false, 0.5, 0.2, 1.0, false, 5600.0, 0.02, 0.82),
        t("barren", 2.0, 400.0, 0.0, true, 0.0, 0.1, 0.0, false, 3200.0, 0.3, 0.0),
        t("lava", 1.4, 900.0, 0.0, false, 0.9, 1.0, 0.0, false, 6000.0, 0.28, 0.0),
        t("ice", 0.3, 120.0, 0.1, false, 0.95, 0.0, 5.0, true, 9800.0, 0.0, 0.1),
        t("gas_giant_ringed", 2.5, 140.0, 0.0, false, 0.9, 0.0, 8.0, true, 5000.0, 0.1, 0.0),
    ]
}

#[test]
fn dormant_entries_are_never_drawn() {
    let cat = catalogue();
    assert_eq!(cat.dormant(), ["window", "faultbound", "shear"]);
    for t in profiles() {
        // the strongest pull the new entries have (magnetic, light, volcanic, eccentric, heavy, barren) included
        for seed in 0..4096u32 {
            let (p, _) = families::pick_monument(&t, seed.wrapping_mul(2654435761), cat);
            assert!(!["window", "faultbound"].contains(&p.blade.as_str()), "{p:?}");
            assert_ne!(p.guard, "shear");
            // and the drawable table picks the same
            assert_eq!(families::pick_monument(&t, seed.wrapping_mul(2654435761), &cat.drawable()).0, p);
        }
    }
}

fn forced(blade: &str, guard: &str, seed: u32) -> Sword {
    let f = Force { blade: Some(blade.into()), guard: Some(guard.into()), ..Default::default() };
    design_monument(&base(), &profiles()[seed as usize % 5], seed, catalogue(), Some(&f)).params
}

#[test]
fn forced_picks_design_and_build_whole_swords_inside_the_ranges() {
    let inr = |v: Option<f64>, lo: f64, hi: f64| v.is_some_and(|x| (lo..=hi).contains(&x));
    for seed in 0..60u32 {
        for (bl, gu) in [("window", "shear"), ("faultbound", "shear"), ("window", "halo"), ("faultbound", "talon")] {
            let s = forced(bl, gu, seed);
            let what = format!("{bl}/{gu} seed {seed}");
            let (parts, skipped) = model::build_parts(&s, true);
            assert!(skipped.is_empty(), "{what}: {skipped:?}");
            solid(&parts[0].mesh, &what);
            if bl == "window" {
                let a = s.blade.aperture.as_ref().expect("aperture");
                assert!(s.blade.fracture.is_none());
                assert!(inr(a.start, 0.08, 0.4) && inr(a.end, 0.4, 0.8) && a.end.unwrap() - a.start.unwrap() >= 0.2);
                assert!(inr(a.width, 0.15, 0.65) && inr(a.shoulder, 0.0, 0.45) && inr(a.point, 0.05, 1.0));
                assert!(inr(a.arch, 0.0, 1.0) && inr(a.rail, 0.08, 0.4) && inr(a.lip, 0.0, 0.6), "{what} {a:?}");
                // the recipe's values are used as written (no clamping)
                let w = keel::Window::of(a);
                assert_eq!((w.start, w.end, w.width), (a.start.unwrap(), a.end.unwrap(), a.width.unwrap()));
            } else {
                let f = s.blade.fracture.as_ref().expect("fracture");
                assert!(inr(f.segments, 2.0, 7.0) && inr(f.gap, 0.08, 0.4) && inr(f.offset, 0.0, 0.35));
                assert!(inr(f.tilt, 0.0, 0.08) && inr(f.zigzag, 0.0, 0.12) && inr(f.rim, 0.0, 0.2), "{what} {f:?}");
                assert!(f.seed.is_some_and(|x| x >= 1.0 && x.fract() == 0.0));
            }
            if gu == "shear" {
                let sh = s.guard.shear.as_ref().expect("shear");
                assert_eq!(s.guard.style.as_deref(), Some("shear"));
                assert!(s.guard.forged.is_none() && s.guard.monument.is_none());
                assert!(inr(sh.height, 0.25, 0.8) && inr(sh.depth, 1.2, 4.0) && inr(sh.block, 0.35, 0.9));
                assert!(inr(sh.tooth, 0.3, 1.6) && inr(sh.at, 0.25, 0.8) && inr(sh.span, 0.12, 0.45));
                assert!(inr(sh.stagger, 0.0, 0.5) && inr(sh.chamfer, 0.0, 0.35) && inr(sh.throat, 0.0, 0.9));
                assert_eq!(shear::Gate::of(sh).height, sh.height.unwrap());
                assert!(parts.iter().filter(|p| p.name == "glow").count() == 2, "{what}: blade glow + throat");
                solid(&parts.iter().find(|p| p.name == "guard").unwrap().mesh, &what);
            } else {
                assert!(s.guard.shear.is_none());
            }
            // the glow mesh: finite, outward-facing normals, uv and COLOR_0 per vertex
            let g = &parts[1].mesh;
            assert_eq!(parts[1].name, "glow");
            assert!(g.pos.iter().chain(&g.nrm).all(|x| x.is_finite()));
            assert_eq!(g.uv.len(), g.vertex_count() * 2);
            assert_eq!(g.color.len(), g.vertex_count() * 4);
        }
    }
}

#[test]
fn the_new_blocks_are_absent_from_old_json_and_round_trip() {
    let s = base();
    let v = serde_json::to_value(&s).unwrap();
    assert!(v["blade"].get("aperture").is_none() && v["blade"].get("fracture").is_none());
    assert!(v["guard"].get("shear").is_none());
    for (b, g) in [("window", "shear"), ("faultbound", "halo")] {
        let s = forced(b, g, 3);
        let back: Sword = serde_json::from_value(serde_json::to_value(&s).unwrap()).unwrap();
        assert_eq!(back, s);
    }
}

// ---------------------------------------------------------------- determinism

/// The SW12 swords pinned in `tests/goldens/sw12.json`: forced families on the base and on golden swords.
fn pinned() -> Vec<(String, Sword)> {
    let mut out = Vec::new();
    for seed in 0..6u32 {
        out.push((format!("window-shear-{seed}"), forced("window", "shear", seed)));
        out.push((format!("faultbound-shear-{seed}"), forced("faultbound", "shear", seed)));
    }
    let golden = golden_swords();
    for k in [0usize, 20, 40, 60, 90, 120] {
        let mut s = golden[k].clone();
        s.blade.aperture = Some(Aperture::default());
        out.push((format!("golden{k}-window"), s.clone()));
        s.blade.aperture = None;
        s.blade.fracture = Some(Fracture { seed: Some(k as f64 + 1.0), ..Default::default() });
        out.push((format!("golden{k}-fault"), s));
    }
    out
}

fn goldens_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/goldens/sw12.json")
}

#[test]
fn sw12_swords_build_the_same_bytes_every_time_and_match_their_goldens() {
    let cases = pinned();
    assert_eq!(cases.len(), 24);
    // twice in a row, and once more on another thread: the same bytes
    for (id, s) in &cases {
        let a: Vec<Vec<u8>> = model::build_parts(s, true).0.iter().map(|p| bytes(&p.mesh)).collect();
        let b: Vec<Vec<u8>> = model::build_parts(s, true).0.iter().map(|p| bytes(&p.mesh)).collect();
        let s2 = s.clone();
        let c: Vec<Vec<u8>> = std::thread::spawn(move || {
            model::build_parts(&s2, true).0.iter().map(|p| bytes(&p.mesh)).collect::<Vec<_>>()
        })
        .join()
        .unwrap();
        assert!(a == b && a == c, "{id}");
    }
    let now: Vec<Value> = cases
        .iter()
        .map(|(id, s)| {
            let d: Vec<Value> = model::digests(s).into_iter().map(|(n, c, h)| json!([n, c, h])).collect();
            json!({"id": id, "params": s, "meshes": d})
        })
        .collect();
    if std::env::var_os("BLADEGEN_RECORD_GOLDENS").is_some() {
        let out = json!({"format": 1, "note": "bladegen-core tests/sw12.rs: SW12 swords (window-keel, faultbound, \
            shear-gate) and their model::digests", "cases": now});
        std::fs::write(goldens_path(), serde_json::to_string(&out).unwrap() + "\n").unwrap();
        eprintln!("recorded {} SW12 cases -> {}", now.len(), goldens_path().display());
    }
    let g: Value = serde_json::from_slice(&std::fs::read(goldens_path()).unwrap()).unwrap();
    let want = g["cases"].as_array().unwrap();
    assert_eq!(want.len(), now.len());
    for (w, n) in want.iter().zip(&now) {
        assert_eq!(w["id"], n["id"]);
        // the params as recorded rebuild the recorded meshes
        let s: Sword = serde_json::from_value(w["params"].clone()).unwrap();
        let d: Vec<Value> = model::digests(&s).into_iter().map(|(n, c, h)| json!([n, c, h])).collect();
        assert_eq!(Value::Array(d), w["meshes"], "{}", w["id"]);
        assert_eq!(w["meshes"], n["meshes"], "{}", w["id"]);
    }
}
