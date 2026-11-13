//! SW10's monument guards and pommels (bladegen `sword/monument-variety` 38daabe, `src/three/sword/monument/`
//! `strokes.ts`, `guards.ts`, `pommels.ts`), ported 1:1 (SW11).
//!
//! Every part is made of one kernel, the stroke: a closed tube swept along a planar centre line (X across the blade,
//! +Y toward the tip) whose cross-section runs from square flats through round to a diamond ridge, like the forged
//! cross's. A ring is the same tube along a closed circle. Parts are merged into one indexed mesh (position, uv) and
//! `computeVertexNormals` runs once. Everything is computed in f64 in bladegen's operation order and stored as f32
//! once per value, so the port matches bladegen under Node bit for bit (SW10's corpus, `tests/sword.rs`).
//!
//! Guard styles: `recurve`, `crescent`, `halo`, `wings`, `talon`, `ziggurat` (sized from the blade like `forged`; only
//! the span is absolute). Pommel styles: `gem`, `sunwheel`, `horned`, `tiered`.
use super::geom::*;
use super::params::{Blade, Guard, GuardMonument, Pommel};
use std::f64::consts::PI;

/// Midpoint sub-steps per station interval when integrating a turning centre line (`STROKE_SUBSTEPS`).
pub const STROKE_SUBSTEPS: usize = 4;
/// Rings over a knob finial (`KNOB_RINGS`).
pub const KNOB_RINGS: usize = 10;
/// A point tip's apex reaches this x the last ring's larger half-size past the stroke's end (`POINT_RATIO`).
pub const POINT_RATIO: f64 = 3.0;

pub const GUARD_STYLES: [&str; 6] = ["recurve", "crescent", "halo", "wings", "talon", "ziggurat"];
pub const POMMEL_STYLES: [&str; 4] = ["gem", "sunwheel", "horned", "tiered"];

pub fn is_guard_style(s: Option<&str>) -> bool {
    s.is_some_and(|s| GUARD_STYLES.contains(&s))
}

pub fn is_pommel_style(s: Option<&str>) -> bool {
    s.is_some_and(|s| POMMEL_STYLES.contains(&s))
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Tip {
    Flat,
    Point,
    Knob,
}

/// Section scale along a stroke (`SizeLaw`), u = s / L.
#[derive(Clone, Copy, Debug)]
pub enum SizeLaw {
    /// mix(1, taper, belly ? u * u : u)
    Taper { taper: f64, belly: bool },
    /// u < waist ? mix(top, 1, u / waist) : mix(1, taper, (u - waist) / (1 - waist))
    Gem { top: f64, waist: f64, taper: f64 },
}

fn taper(t: f64) -> SizeLaw {
    SizeLaw::Taper { taper: t, belly: false }
}

fn belly(t: f64) -> SizeLaw {
    SizeLaw::Taper { taper: t, belly: true }
}

#[derive(Clone, Copy, Debug)]
pub struct Stroke {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub heading: f64,
    pub length: f64,
    pub turn: f64,
    pub bend: f64,
    pub hy: f64,
    pub hz: f64,
    pub size: SizeLaw,
    pub tip: Tip,
    pub knob: f64,
    pub segments: f64,
}

impl Stroke {
    /// A stroke with bladegen's `??` defaults: z 0, turn 0, bend 0, knob 0.
    #[allow(clippy::too_many_arguments)]
    fn new(
        x: f64,
        y: f64,
        heading: f64,
        length: f64,
        hy: f64,
        hz: f64,
        size: SizeLaw,
        tip: Tip,
        segments: f64,
    ) -> Self {
        Stroke { x, y, z: 0.0, heading, length, turn: 0.0, bend: 0.0, hy, hz, size, tip, knob: 0.0, segments }
    }
}

pub struct RingStroke {
    pub cx: f64,
    pub cy: f64,
    pub radius: f64,
    pub hy: f64,
    pub hz: f64,
    pub segments: f64,
}

/// A part being built, in f64: positions, uvs and triangle indices local to the part.
#[derive(Clone, Debug, Default)]
pub struct Part {
    pub pos: Vec<f64>,
    pub uv: Vec<f64>,
    pub idx: Vec<u32>,
}

pub struct Section {
    pub a: Vec<f64>,
    pub b: Vec<f64>,
}

fn mix(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

pub fn size_at(law: &SizeLaw, u: f64) -> f64 {
    match *law {
        SizeLaw::Gem { top, waist, taper } => {
            if u < waist {
                mix(top, 1.0, u / waist)
            } else {
                mix(1.0, taper, (u - waist) / (1.0 - waist))
            }
        }
        SizeLaw::Taper { taper, belly } => mix(1.0, taper, if belly { u * u } else { u }),
    }
}

/// `sectionOutline`: the cross-section's unit outline, radial + 1 points (a seam copy).
pub fn section_outline(section: f64, radial: usize) -> Section {
    let mut a = Vec::with_capacity(radial + 1);
    let mut b = Vec::with_capacity(radial + 1);
    for k in 0..=radial {
        let phi = (k as f64 / radial as f64) * PI * 2.0;
        let c = cos(phi);
        let s = sin(phi);
        if section >= 0.0 {
            let d = c.abs() + s.abs();
            a.push(mix(c, c / d, section));
            b.push(mix(s, s / d, section));
        } else {
            let m = jmax(c.abs(), s.abs());
            a.push(mix(c, c / m, -section));
            b.push(mix(s, s / m, -section));
        }
    }
    Section { a, b }
}

/// `strokePart`: sweep one stroke into a new part.
pub fn stroke_part(st: &Stroke, sec: &Section) -> Part {
    let radial = sec.a.len() - 1;
    let l = st.length;
    let segs = jmax(1.0, st.segments) as usize;
    let (turn, bend, z0) = (st.turn, st.bend, st.z);
    let mut ss: Vec<f64> = Vec::new();
    let mut hy: Vec<f64> = Vec::new();
    let mut hz: Vec<f64> = Vec::new();
    let s_end;
    if st.tip == Tip::Knob {
        let r_tip = jmax(st.hy, st.hz) * size_at(&st.size, 1.0);
        let rk = jmin(r_tip * (1.0 + st.knob), 0.45 * l);
        let tk = l - rk;
        let t0 = tk - rk;
        for i in 0..=segs {
            let s = (t0 * i as f64) / segs as f64;
            let f = size_at(&st.size, s / l);
            ss.push(s);
            hy.push(st.hy * f);
            hz.push(st.hz * f);
        }
        let f_k = size_at(&st.size, tk / l);
        let hk_y = jmax(st.hy * f_k, rk);
        let hk_z = jmax(st.hz * f_k, rk);
        for j in 1..KNOB_RINGS {
            let ang = (PI * j as f64) / KNOB_RINGS as f64;
            let s = tk - rk * cos(ang);
            let k = sin(ang);
            ss.push(s);
            if 2 * j <= KNOB_RINGS {
                let f = size_at(&st.size, s / l);
                hy.push(jmax(st.hy * f, rk * k));
                hz.push(jmax(st.hz * f, rk * k));
            } else {
                hy.push(hk_y * k);
                hz.push(hk_z * k);
            }
        }
        s_end = tk + rk;
    } else {
        for i in 0..=segs {
            let s = (l * i as f64) / segs as f64;
            let f = size_at(&st.size, s / l);
            ss.push(s);
            hy.push(st.hy * f);
            hz.push(st.hz * f);
        }
        s_end = if st.tip == Tip::Point {
            l + POINT_RATIO * jmax(st.hy, st.hz) * size_at(&st.size, 1.0)
        } else {
            l
        };
    }
    let theta = |s: f64| {
        let u = s / l;
        st.heading + turn * u + bend * u * u
    };
    // the centre line through every ring station, then the end apex
    let mut stations = ss.clone();
    stations.push(s_end);
    let (mut cx, mut cy) = (vec![st.x], vec![st.y]);
    let (mut x, mut y) = (st.x, st.y);
    for i in 1..stations.len() {
        let sub = (stations[i] - stations[i - 1]) / STROKE_SUBSTEPS as f64;
        for q in 0..STROKE_SUBSTEPS {
            let th = theta(stations[i - 1] + (q as f64 + 0.5) * sub);
            x = x + cos(th) * sub;
            y = y + sin(th) * sub;
        }
        cx.push(x);
        cy.push(y);
    }
    let rings = ss.len();
    let stride = radial + 1;
    let mut p = Part::default();
    p.pos.reserve((rings * stride + 2) * 3);
    p.uv.reserve((rings * stride + 2) * 2);
    // start apex
    p.pos.extend_from_slice(&[cx[0], cy[0], z0]);
    p.uv.extend_from_slice(&[0.0, 0.5]);
    for r in 0..rings {
        let th = theta(ss[r]);
        let nx = -sin(th);
        let ny = cos(th);
        for k in 0..=radial {
            let a = hy[r] * sec.a[k];
            p.pos.extend_from_slice(&[cx[r] + nx * a, cy[r] + ny * a, z0 + hz[r] * sec.b[k]]);
            p.uv.extend_from_slice(&[r as f64 / (rings - 1) as f64, k as f64 / radial as f64]);
        }
    }
    let apex_n = (1 + rings * stride) as u32;
    p.pos.extend_from_slice(&[cx[rings], cy[rings], z0]);
    p.uv.extend_from_slice(&[1.0, 0.5]);
    for k in 0..radial {
        p.idx.extend_from_slice(&[(1 + k + 1) as u32, (1 + k) as u32, 0]);
    }
    for r in 0..rings - 1 {
        for k in 0..radial {
            let a = (1 + r * stride + k) as u32;
            let b = (1 + (r + 1) * stride + k) as u32;
            let c = (1 + r * stride + k + 1) as u32;
            let d = (1 + (r + 1) * stride + k + 1) as u32;
            p.idx.extend_from_slice(&[a, c, b, b, c, d]);
        }
    }
    let last = 1 + (rings - 1) * stride;
    for k in 0..radial {
        p.idx.extend_from_slice(&[(last + k) as u32, (last + k + 1) as u32, apex_n]);
    }
    p
}

/// `ringPart`: a closed ring tube around (cx, cy) in the XY plane, segments + 1 rings (the last a seam copy).
pub fn ring_part(rs: &RingStroke, sec: &Section) -> Part {
    let radial = sec.a.len() - 1;
    let stride = radial + 1;
    let m = jmax(3.0, rs.segments) as usize;
    let mut p = Part::default();
    for r in 0..=m {
        let ang = (PI * 2.0 * (r % m) as f64) / m as f64;
        let c = cos(ang);
        let s = sin(ang);
        let ox = rs.cx + rs.radius * c;
        let oy = rs.cy + rs.radius * s;
        // the in-plane normal points to the centre, so (tangent, normal, +Z) is right-handed like a stroke's
        let nx = -c;
        let ny = -s;
        for k in 0..=radial {
            let a = rs.hy * sec.a[k];
            p.pos.extend_from_slice(&[ox + nx * a, oy + ny * a, rs.hz * sec.b[k]]);
            p.uv.extend_from_slice(&[r as f64 / m as f64, k as f64 / radial as f64]);
        }
    }
    for r in 0..m {
        for k in 0..radial {
            let a = (r * stride + k) as u32;
            let b = ((r + 1) * stride + k) as u32;
            let c = (r * stride + k + 1) as u32;
            let d = ((r + 1) * stride + k + 1) as u32;
            p.idx.extend_from_slice(&[a, c, b, b, c, d]);
        }
    }
    p
}

/// `mirrorPart`: the part mirrored across X = 0 (x negated, winding swapped so it stays outward).
pub fn mirror_part(p: &Part) -> Part {
    let mut pos = p.pos.clone();
    for v in pos.chunks_exact_mut(3) {
        v[0] = -v[0];
    }
    let mut idx = Vec::with_capacity(p.idx.len());
    for t in p.idx.chunks_exact(3) {
        idx.extend_from_slice(&[t[0], t[2], t[1]]);
    }
    Part { pos, uv: p.uv.clone(), idx }
}

/// `mergeParts`: the parts in order as one indexed mesh (f32 stores), with its vertex normals.
pub fn merge_parts(parts: &[Part]) -> Mesh {
    let mut m = Mesh::default();
    let nv: usize = parts.iter().map(|p| p.pos.len() / 3).sum();
    m.pos.reserve(nv * 3);
    m.uv.reserve(nv * 2);
    let mut base = 0u32;
    for p in parts {
        m.pos.extend(p.pos.iter().map(|&v| v as f32));
        m.uv.extend(p.uv.iter().map(|&v| v as f32));
        m.idx.extend(p.idx.iter().map(|&i| base + i));
        base += (p.pos.len() / 3) as u32;
    }
    m.compute_vertex_normals();
    m
}

// ---------------------------------------------------------------- guards

/// `MONUMENT_GUARD_DEFAULTS[style]` (unknown styles: `recurve`'s), every field set, in the defaults' key order.
pub fn guard_defaults(style: &str) -> GuardMonument {
    // (height, depth, block, swell, taper, sweep, count, spike, ring, knob, section, segments, radial): bladegen's
    // `base` with each style's overrides
    let v: [f64; 13] = match style {
        "crescent" => [0.46, 2.4, 0.55, 1.08, 0.12, -1.9, 3.0, 0.7, 0.65, 0.0, 0.5, 32.0, 16.0],
        "halo" => [0.4, 2.4, 0.55, 1.25, 0.2, 0.0, 3.0, 0.7, 0.65, 0.0, 0.8, 24.0, 16.0],
        "wings" => [0.42, 1.9, 0.55, 1.1, 0.24, 1.0, 4.0, 0.7, 0.65, 0.0, -0.3, 24.0, 16.0],
        "talon" => [0.54, 2.7, 0.55, 1.08, 0.09, 2.2, 2.0, 0.7, 0.65, 0.0, 0.6, 24.0, 16.0],
        "ziggurat" => [0.5, 2.5, 0.6, 1.0, 0.78, 0.0, 3.0, 1.0, 0.65, 0.0, -0.9, 24.0, 16.0],
        // recurve (and bladegen's fallback for an unknown style)
        _ => [0.4, 2.4, 0.55, 1.25, 0.32, 0.9, 3.0, 0.7, 0.65, 0.0, 0.7, 32.0, 16.0],
    };
    GuardMonument {
        height: Some(v[0]),
        depth: Some(v[1]),
        block: Some(v[2]),
        swell: Some(v[3]),
        taper: Some(v[4]),
        sweep: Some(v[5]),
        count: Some(v[6]),
        spike: Some(v[7]),
        ring: Some(v[8]),
        knob: Some(v[9]),
        section: Some(v[10]),
        segments: Some(v[11]),
        radial: Some(v[12]),
    }
}

/// `buildGuard` for the monument styles (`buildMonumentGuardGeometry`): the mesh in guard-local space (the block's
/// centre at the origin) and its matrix, which puts the block's blade-side face on the guard line, tilted about Z.
pub fn build_guard_monument(g: &Guard, blade: &Blade, blade_base_y: f64) -> (Mesh, Mat4) {
    let (mesh, hy0) = monument_guard_geometry(g, blade);
    let target_top_y = blade_base_y + g.height_offset.unwrap_or(0.0);
    (mesh, compose([0.0, target_top_y - hy0, 0.0], [0.0, 0.0, g.tilt.unwrap_or(0.0)], [1.0; 3]))
}

/// A monument guard in guard-local space and its block's half height (`buildMonumentGuardGeometry`: `geometry`,
/// `halfHeight`); [`build_guard_monument`] places it.
pub fn monument_guard_geometry(g: &Guard, blade: &Blade) -> (Mesh, f64) {
    let style = g.style.as_deref().unwrap_or("");
    let d = guard_defaults(style);
    let m = g.monument.clone().unwrap_or_default();
    let pick = |v: Option<f64>, dv: Option<f64>| v.or(dv).unwrap();
    let height = pick(m.height, d.height);
    let depth = pick(m.depth, d.depth);
    let block = pick(m.block, d.block);
    let swell = pick(m.swell, d.swell);
    let taper_v = pick(m.taper, d.taper);
    let sweep = pick(m.sweep, d.sweep);
    let count = jmax(1.0, jround(pick(m.count, d.count))) as usize;
    let spike = pick(m.spike, d.spike);
    let ring = pick(m.ring, d.ring);
    let knob = pick(m.knob, d.knob);
    let section = pick(m.section, d.section);
    let segs = jmax(4.0, jround(pick(m.segments, d.segments)));
    let radial = jmax(4.0, jround(pick(m.radial, d.radial))) as usize;

    let bw = blade.base_width;
    let bt = jmax(blade.thickness_left.unwrap_or(0.08), blade.thickness_right.unwrap_or(0.08));
    let half = jmax(0.1, g.width * 0.5);
    let hy0 = 0.5 * height * bw;
    let hz0 = 0.5 * depth * bt;
    let bl = block * bw;
    let hy_r = hy0 / swell;
    let hz_r = hz0 / swell;
    let sec = section_outline(section, radial);
    let mut parts: Vec<Part> = Vec::new();
    let pair = |parts: &mut Vec<Part>, st: Stroke| {
        let p = stroke_part(&st, &sec);
        let q = mirror_part(&p);
        parts.push(p);
        parts.push(q);
    };
    let arm_tip = if knob > 0.0 { Tip::Knob } else { Tip::Point };

    if style == "ziggurat" {
        // tiers stacked toward the grip, each as tall as the block at the bottom and 0.6 of it at the top
        let mut yc = 0.0;
        let mut h_prev = 0.0;
        for t in 0..count {
            let v = if count > 1 { t as f64 / (count - 1) as f64 } else { 0.0 };
            let ht = jmax(1.2 * bl, mix(half, jmax(1.2 * bl, 0.35 * half), v));
            let hh = hy0 * mix(1.0, 0.6, v);
            if t > 0 {
                yc = yc - h_prev - hh;
            }
            h_prev = hh;
            parts.push(stroke_part(
                &Stroke::new(
                    -ht,
                    yc,
                    0.0,
                    2.0 * ht,
                    hh,
                    hz0 * (1.0 - 0.12 * t as f64),
                    taper(1.0),
                    Tip::Flat,
                    2.0,
                ),
                &sec,
            ));
        }
        // obelisks at the ends of the bottom tier, rising toward the grip from its blade-side face
        let pw = 0.42 * hy0;
        pair(
            &mut parts,
            Stroke::new(
                half - pw,
                hy0,
                -PI / 2.0,
                2.0 * hy0 + spike * 4.0 * hy0,
                pw,
                0.85 * hz0,
                taper(taper_v),
                Tip::Point,
                4.0,
            ),
        );
    } else {
        parts.push(stroke_part(
            &Stroke::new(-bl, 0.0, 0.0, 2.0 * bl, hy0, hz0, taper(1.0), Tip::Flat, 2.0),
            &sec,
        ));
        let x0 = 0.5 * bl;
        match style {
            "crescent" => {
                let mut st = Stroke::new(
                    0.4 * bl,
                    0.0,
                    0.25,
                    half * 1.25,
                    hy_r * 1.3,
                    hz_r,
                    belly(taper_v),
                    arm_tip,
                    segs,
                );
                st.turn = 0.55 * sweep;
                st.bend = 0.45 * sweep;
                st.knob = knob;
                pair(&mut parts, st);
            }
            "halo" => {
                let r = jmax(ring * half, 1.3 * bl);
                parts.push(ring_part(
                    &RingStroke {
                        cx: 0.0,
                        cy: 0.0,
                        radius: r,
                        hy: hy_r * 0.6,
                        hz: hz_r * 0.8,
                        segments: 2.0 * segs,
                    },
                    &sec,
                ));
                pair(
                    &mut parts,
                    Stroke::new(x0, 0.0, 0.0, r - x0, hy_r * 0.8, hz_r * 0.9, taper(1.0), Tip::Flat, 2.0),
                );
                let a_max = 1.05;
                for i in 0..count {
                    let w = (2.0 * (i as f64 + 0.5)) / count as f64 - 1.0;
                    let a = a_max * w;
                    let mut st = Stroke::new(
                        r * cos(a),
                        r * sin(a),
                        a,
                        spike * r * (1.0 - 0.45 * w.abs()),
                        hy_r * 0.75,
                        hz_r * 0.7,
                        taper(taper_v),
                        Tip::Point,
                        jmax(4.0, jround(segs / 3.0)),
                    );
                    st.bend = 0.3 * sweep;
                    pair(&mut parts, st);
                }
            }
            "wings" => {
                for i in 0..count {
                    let v = if count > 1 { i as f64 / (count - 1) as f64 } else { 0.0 };
                    let mut st = Stroke::new(
                        x0 * 0.8,
                        0.0,
                        -v * sweep,
                        half * 1.05 * mix(1.0, 0.62, v),
                        hy_r * 1.25 * mix(1.0, 0.7, v),
                        hz_r * 0.45,
                        taper(taper_v),
                        Tip::Point,
                        segs,
                    );
                    st.z = hz_r * 0.25 * (v - 0.5);
                    st.bend = 0.3;
                    pair(&mut parts, st);
                }
            }
            "talon" => {
                for i in 0..count {
                    let v = if count > 1 { i as f64 / (count - 1) as f64 } else { 0.5 };
                    let mut st = Stroke::new(
                        1.2 * x0,
                        0.2 * hy0,
                        mix(-0.35, 0.45, v),
                        half * mix(1.0, 0.72, v),
                        hy_r * mix(1.0, 0.8, v),
                        hz_r * 0.9,
                        belly(taper_v),
                        Tip::Point,
                        segs,
                    );
                    st.bend = sweep;
                    pair(&mut parts, st);
                }
            }
            "recurve" => {
                let sgn = if sweep >= 0.0 { 1.0 } else { -1.0 };
                let mut st = Stroke::new(
                    x0,
                    0.0,
                    -0.45 * sweep,
                    (half - x0) * 1.08,
                    hy_r,
                    hz_r,
                    taper(taper_v),
                    arm_tip,
                    segs,
                );
                st.bend = 1.5 * sweep;
                st.knob = knob;
                pair(&mut parts, st);
                // counter-quillons swept the other way, so the cross reads as an X at distance
                let mut st = Stroke::new(
                    x0,
                    0.0,
                    -0.9 * sgn,
                    0.45 * (half - x0),
                    hy_r * 0.75,
                    hz_r * 0.85,
                    taper(taper_v),
                    Tip::Point,
                    jmax(4.0, jround(segs / 2.0)),
                );
                st.bend = -0.4 * sgn;
                pair(&mut parts, st);
            }
            // not a monument style: the block alone (as bladegen)
            _ => {}
        }
    }
    (merge_parts(&parts), hy0)
}

// ---------------------------------------------------------------- pommels

const DOWN: f64 = -PI / 2.0;
const POMMEL_RADIAL: usize = 16;

/// `buildMonumentPommelGeometry`: the pommel in pommel-local space (the grip's end at the origin, -Y away from the
/// blade). `se` is the pommel's effective size (`sizeEff`).
pub fn build_pommel_monument_geometry(p: &Pommel, se: f64) -> Mesh {
    let e = jmin(2.0, jmax(0.5, p.elongation));
    let m = p.shape_morph;
    let mut parts: Vec<Part> = Vec::new();
    match p.style.as_deref() {
        Some("gem") => {
            let sec = section_outline(0.0, 6);
            parts.push(stroke_part(
                &Stroke::new(
                    0.0,
                    0.0,
                    DOWN,
                    se * 2.0 * e,
                    se * 0.75,
                    se * 0.75,
                    SizeLaw::Gem { top: 0.45, waist: 0.3 + 0.15 * m, taper: 0.12 },
                    Tip::Point,
                    6.0,
                ),
                &sec,
            ));
        }
        Some("sunwheel") => {
            let sec = section_outline(0.4, POMMEL_RADIAL);
            let r = se * 1.1;
            let tube = se * 0.16;
            parts.push(ring_part(
                &RingStroke { cx: 0.0, cy: -r, radius: r, hy: tube, hz: tube, segments: 48.0 },
                &sec,
            ));
            parts.push(stroke_part(
                &Stroke::new(0.0, 0.0, DOWN, 2.0 * r, se * 0.14, se * 0.14, taper(1.0), Tip::Flat, 2.0),
                &sec,
            ));
            let spikes = jmax(3.0, jround(p.crown_spikes.unwrap_or(8.0)));
            let sharp = jmin(1.0, jmax(0.0, p.crown_sharpness.unwrap_or(0.6)));
            let n = spikes as usize;
            for k in 0..n {
                let a = DOWN + (2.0 * PI * k as f64) / spikes;
                // distance to straight up the grip (+pi/2), folded into 0..pi
                let mut dist = (a - PI / 2.0).abs();
                if dist > PI {
                    dist = 2.0 * PI - dist;
                }
                if dist < 0.6 {
                    continue;
                }
                parts.push(stroke_part(
                    &Stroke::new(
                        r * cos(a),
                        -r + r * sin(a),
                        a,
                        se * (0.5 + 0.7 * sharp),
                        se * 0.13,
                        se * 0.13,
                        taper(0.2),
                        Tip::Point,
                        4.0,
                    ),
                    &sec,
                ));
            }
        }
        Some("horned") => {
            let sec = section_outline(0.3, POMMEL_RADIAL);
            let mut bulb =
                Stroke::new(0.0, 0.0, DOWN, se * 0.9, se * 0.45, se * 0.45, taper(1.0), Tip::Knob, 6.0);
            bulb.knob = 0.3;
            parts.push(stroke_part(&bulb, &sec));
            let mut horn = Stroke::new(
                se * 0.3,
                -se * 0.45,
                0.0,
                se * 2.2 * e,
                se * 0.28,
                se * 0.28,
                belly(0.15),
                Tip::Point,
                16.0,
            );
            horn.bend = -(1.6 + 0.6 * m);
            let h = stroke_part(&horn, &sec);
            let hm = mirror_part(&h);
            parts.push(h);
            parts.push(hm);
        }
        // tiered
        _ => {
            let sec = section_outline(-0.85, POMMEL_RADIAL);
            let n = jmin(5.0, jmax(3.0, jround(p.crown_spikes.unwrap_or(3.0)))) as usize;
            let th = se * 0.32;
            let mut y = -0.5 * th;
            for t in 0..n {
                let v = t as f64 / (n - 1) as f64;
                let w = se * (1.2 - 0.6 * v);
                parts.push(stroke_part(
                    &Stroke::new(-w, y, 0.0, 2.0 * w, 0.5 * th, w * 0.8, taper(1.0), Tip::Flat, 2.0),
                    &sec,
                ));
                y = y - th;
            }
            parts.push(stroke_part(
                &Stroke::new(
                    0.0,
                    y + 0.5 * th,
                    DOWN,
                    se * 1.4 * e,
                    se * 0.3,
                    se * 0.3,
                    taper(0.6),
                    Tip::Point,
                    4.0,
                ),
                &sec,
            ));
        }
    }
    merge_parts(&parts)
}

/// The monument pommel placed below the grip: (offsetX, gripBottom + 0.04 * se + offsetY, 0); `grip_bottom` is the
/// handle's world bounding box minimum y (-1 without a handle).
pub fn build_pommel_monument(p: &Pommel, se: f64, grip_bottom: f64) -> (Mesh, Mat4) {
    let mesh = build_pommel_monument_geometry(p, se);
    let y = grip_bottom + 0.04 * se + p.offset_y.unwrap_or(0.0);
    (mesh, compose([p.offset_x.unwrap_or(0.0), y, 0.0], [0.0; 3], [1.0; 3]))
}
