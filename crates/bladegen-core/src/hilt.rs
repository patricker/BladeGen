//! bladegen's hilt, the subset a monument sword uses: the `bar` guard (`guardGeometry.ts`), the `forged` cross
//! (`guardForged.ts`, SW7: bladegen `sword/monument-guard`), the lathe grip core (`handleGeometry.ts`: segmentation
//! ridges, flare, curvature, oval scale) and the pommel styles orb, disk, wheel, spike, crown and ring
//! (`pommelGeometry.ts`). Ported from bladegen 2eb8d94 (the forged cross from f6b5ec8). SW11: the six monument guard
//! styles and four monument pommels of bladegen `sword/monument-variety` 38daabe dispatch to [`super::monument`].
//! Not ported (refused by [`guard_unsupported`] and friends): the extruded/tube guard styles (winged, claw, disk,
//! knucklebow, swept, basket, shell), guard decorations other than quillons (langets, fillets, habaki, extras), grip
//! wraps other than `wire`, rayskin, menuki, the scentStopper and fishtail pommels, peens, scabbard and tassel.
use super::geom::*;
use super::params::{Blade, Guard, Handle, Pommel};
use std::f64::consts::PI;

pub const GUARD_HEIGHT: f64 = 0.08;

/// Why this port cannot build the guard (with its decorations), or `None`.
pub fn guard_unsupported(g: &Guard) -> Option<String> {
    let s = g.style.as_deref().unwrap_or("bar");
    (!(matches!(s, "bar" | "forged" | "shear") || super::monument::is_guard_style(Some(s))))
        .then(|| format!("guard style {:?}", g.style))
}

/// Why this port cannot build the grip (core and wrap meshes), or `None`.
pub fn handle_unsupported(h: &Handle) -> Option<String> {
    match h.wrap_style.as_deref().unwrap_or("none") {
        "none" | "wire" => None,
        s => Some(format!("handle wrap style {s} (TubeGeometry)")),
    }
}

/// Why this port cannot build the pommel, or `None`.
pub fn pommel_unsupported(p: &Pommel) -> Option<String> {
    if matches!(p.style.as_deref(), Some("scentStopper" | "fishtail")) {
        return Some(format!("pommel style {:?}", p.style));
    }
    p.peen_visible.unwrap_or(false).then(|| "pommel peen".into())
}

/// `decorateGuard` quillons (the only decoration ported): a cylinder and a cone tip per arm, in a group at the
/// sword origin (bar guards have no guard group). Order as bladegen adds them.
pub fn build_quillons(g: &Guard, blade_base_y: f64) -> Vec<(Mesh, Mat4)> {
    let qc = jmax(0.0, jmin(4.0, jround(g.quillon_count.unwrap_or(0.0)))) as usize;
    let mut out = Vec::new();
    if qc == 0 {
        return out;
    }
    let target_top_y = blade_base_y + g.height_offset.unwrap_or(0.0);
    let orn = g.ornamentation.unwrap_or(0.0);
    let q_len = jmax(0.05, g.quillon_length.unwrap_or(0.25));
    let q_rad = jmax(0.01, 0.025 + orn * 0.02);
    let cyl = cylinder_geometry(q_rad, q_rad, q_len, jmax(8.0, jround(12.0 + orn * 12.0)) as usize);
    let sharp = jmax(0.0, jmin(1.0, g.tip_sharpness.unwrap_or(0.5)));
    let cone = cone_geometry(q_rad * (0.8 + 0.4 * sharp), q_len * 0.25 * sharp, 12);
    let mut add = |x_sign: f64, y_off: f64| {
        let rot = [0.0, 0.0, std::f64::consts::PI / 2.0];
        out.push((
            cyl.clone(),
            compose([(g.width * 0.5 + q_len * 0.5) * x_sign, target_top_y + y_off, 0.0], rot, [1.0; 3]),
        ));
        out.push((
            cone.clone(),
            compose([(g.width * 0.5 + q_len) * x_sign, target_top_y + y_off, 0.0], rot, [1.0; 3]),
        ));
    };
    add(1.0, 0.0);
    add(-1.0, 0.0);
    if qc >= 4 {
        add(1.0, 0.08);
        add(-1.0, -0.08);
    }
    out
}

/// The `wire` wrap style: ten thin tori around the grip (in the handle group, which sits at the sword origin).
pub fn build_wire_wrap(h: &Handle, handle: &Mesh, handle_m: &Mat4) -> Vec<(Mesh, Mat4)> {
    if h.wrap_style.as_deref() != Some("wire") {
        return Vec::new();
    }
    let (lo, hi) = world_bbox(handle, handle_m);
    let (y_min, y_max) = (lo[1], hi[1]);
    let span = jmax(1e-6, y_max - y_min);
    let flare = jmax(0.0, h.flare.unwrap_or(0.0));
    let radius_at = |t: f64| {
        let c = clamp(t, 0.0, 1.0);
        let base = h.radius_bottom + (h.radius_top - h.radius_bottom) * c;
        jmax(0.02, base + flare * pow(1.0 - c, 2.0))
    };
    (0..10)
        .map(|i| {
            let t = (i as f64 + 0.5) / 10.0;
            let y = y_min + t * span;
            let radius = radius_at((y - y_min) / span) + 0.004;
            (
                torus_geometry(radius, 0.0035, 10, 48),
                compose([0.0, y, 0.0], [std::f64::consts::PI / 2.0, 0.0, 0.0], [1.0; 3]),
            )
        })
        .collect()
}

/// `buildGuard` for style `bar`: a box whose top sits at the blade's base.
pub fn build_guard_bar(g: &Guard, blade_base_y: f64) -> (Mesh, Mat4) {
    let target_top_y = blade_base_y + g.height_offset.unwrap_or(0.0);
    let m = box_geometry(g.width, GUARD_HEIGHT, g.thickness);
    (m, compose([0.0, target_top_y - GUARD_HEIGHT * 0.5, 0.0], [0.0; 3], [1.0; 3]))
}

/// Rings over each finial of the forged cross (`FORGED_CAP_RINGS`).
pub const FORGED_CAP_RINGS: usize = 10;
/// Midpoint sub-steps per station interval of the forged cross's centre line (`FORGED_SUBSTEPS`).
pub const FORGED_SUBSTEPS: usize = 4;
/// The block-to-arm blend, a fraction of the half span (`FORGED_BLEND`).
pub const FORGED_BLEND: f64 = 0.12;

fn mix(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

fn smooth(e0: f64, e1: f64, x: f64) -> f64 {
    let t = jmin(1.0, jmax(0.0, (x - e0) / (e1 - e0)));
    t * t * (3.0 - 2.0 * t)
}

/// `buildGuard` for style `forged` (`buildForgedGuardGeometry`): one closed tube swept from the left quillon tip
/// through the centre block to the right tip, sized from the blade (block height x base width, depth x thickness),
/// its arms tapering, turning by `curl` and ending in knob finials. The block's top sits at the blade's base.
/// Every operation in bladegen's order, in f64, stored as f32 (bit-exact on SW7's corpus).
pub fn build_guard_forged(g: &Guard, blade: &Blade, blade_base_y: f64) -> (Mesh, Mat4) {
    let (m, hy0) = forged_guard_geometry(g, blade);
    let target_top_y = blade_base_y + g.height_offset.unwrap_or(0.0);
    (m, compose([0.0, target_top_y - hy0, 0.0], [0.0, 0.0, g.tilt.unwrap_or(0.0)], [1.0; 3]))
}

/// The forged cross in guard-local space and its block's half height (`buildForgedGuardGeometry`: `geometry`,
/// `halfHeight`); [`build_guard_forged`] places it with the block's top on the guard line, tilted about Z.
pub fn forged_guard_geometry(g: &Guard, blade: &Blade) -> (Mesh, f64) {
    let f = g.forged.clone().unwrap_or_default();
    let height = f.height.unwrap_or(0.42);
    let depth = f.depth.unwrap_or(2.4);
    let block = f.block.unwrap_or(0.6);
    let swell = f.swell.unwrap_or(1.25);
    let taper = f.taper.unwrap_or(0.5);
    let curl = f.curl.unwrap_or(0.5);
    let finial = f.finial.unwrap_or(0.6);
    let section = f.section.unwrap_or(0.5);
    let segs = jmax(2.0, jround(f.segments.unwrap_or(24.0))) as usize;
    let radial = jmax(4.0, jround(f.radial.unwrap_or(16.0))) as usize;

    let bw = blade.base_width;
    let bt = jmax(blade.thickness_left.unwrap_or(0.08), blade.thickness_right.unwrap_or(0.08));
    let half = jmax(0.1, g.width * 0.5);
    let hy0 = 0.5 * height * bw;
    let hz0 = 0.5 * depth * bt;
    let u_block = jmin(0.9, (block * bw) / half);
    let root = 1.0 / swell;
    let arm_size = |u: f64| {
        let sb = smooth(u_block, u_block + FORGED_BLEND, u);
        let tu = jmin(1.0, jmax(0.0, (u - u_block) / jmax(1e-6, 1.0 - u_block)));
        mix(1.0, root * mix(1.0, taper, tu), sb)
    };
    let s_tip = arm_size(1.0);
    let r_tip = jmax(hy0 * s_tip, hz0 * s_tip);
    let rk = jmin(r_tip * (1.0 + finial), 0.45 * half);
    let tk = half - rk;
    let t0 = tk - rk;

    // stations along one arm: arc length and the section half-sizes
    let n = segs + FORGED_CAP_RINGS;
    let (mut ts, mut hy, mut hz) = (Vec::with_capacity(n + 1), Vec::with_capacity(n + 1), Vec::with_capacity(n + 1));
    for i in 0..=segs {
        let t = (t0 * i as f64) / segs as f64;
        let s = arm_size(t / half);
        ts.push(t);
        hy.push(hy0 * s);
        hz.push(hz0 * s);
    }
    let s_k = arm_size(tk / half);
    let hk_y = jmax(hy0 * s_k, rk);
    let hk_z = jmax(hz0 * s_k, rk);
    for j in 1..=FORGED_CAP_RINGS {
        let a = (PI * j as f64) / FORGED_CAP_RINGS as f64;
        let t = tk - rk * cos(a);
        let k = sin(a);
        ts.push(t);
        if 2 * j <= FORGED_CAP_RINGS {
            let s = arm_size(t / half);
            hy.push(jmax(hy0 * s, rk * k));
            hz.push(jmax(hz0 * s, rk * k));
        } else {
            hy.push(hk_y * k);
            hz.push(hk_z * k);
        }
    }

    // the turning centre line (right arm), integrated from the centre
    let theta = |t: f64| {
        let u = t / half;
        curl * u * u
    };
    let (mut cx, mut cy) = (vec![0.0f64], vec![0.0f64]);
    let (mut x, mut y) = (0.0f64, 0.0f64);
    for i in 1..=n {
        let sub = (ts[i] - ts[i - 1]) / FORGED_SUBSTEPS as f64;
        for q in 0..FORGED_SUBSTEPS {
            let th = theta(ts[i - 1] + (q as f64 + 0.5) * sub);
            x = x + cos(th) * sub;
            y = y + sin(th) * sub;
        }
        cx.push(x);
        cy.push(y);
    }

    // the cross-section: round, mixed toward a diamond (section > 0) or a square (section < 0)
    let (mut sec_a, mut sec_b) = (Vec::with_capacity(radial + 1), Vec::with_capacity(radial + 1));
    for k in 0..=radial {
        let phi = (k as f64 / radial as f64) * PI * 2.0;
        let (c, s) = (cos(phi), sin(phi));
        if section >= 0.0 {
            let d = c.abs() + s.abs();
            sec_a.push(mix(c, c / d, section));
            sec_b.push(mix(s, s / d, section));
        } else {
            let m = jmax(c.abs(), s.abs());
            sec_a.push(mix(c, c / m, -section));
            sec_b.push(mix(s, s / m, -section));
        }
    }

    let rings = 2 * n + 1;
    let stride = radial + 1;
    let mut m = Mesh::default();
    m.pos.reserve(rings * stride * 3);
    m.uv.reserve(rings * stride * 2);
    for r in 0..rings {
        let i = if r < n { n - r } else { r - n };
        let side = if r < n { -1.0 } else { 1.0 };
        let th = theta(ts[i]);
        let nx = -side * sin(th);
        let ny = cos(th);
        let (ox, oy) = (side * cx[i], cy[i]);
        for k in 0..=radial {
            let a = hy[i] * sec_a[k];
            m.pos.extend_from_slice(&[(ox + nx * a) as f32, (oy + ny * a) as f32, (hz[i] * sec_b[k]) as f32]);
            m.uv.extend_from_slice(&[(r as f64 / (rings - 1) as f64) as f32, (k as f64 / radial as f64) as f32]);
        }
    }
    for r in 0..rings - 1 {
        for k in 0..radial {
            let a = (r * stride + k) as u32;
            let b = ((r + 1) * stride + k) as u32;
            let c = (r * stride + k + 1) as u32;
            let d = ((r + 1) * stride + k + 1) as u32;
            m.idx.extend_from_slice(&[a, c, b, b, c, d]);
        }
    }
    m.compute_vertex_normals();
    (m, hy0)
}

/// `buildHandle`: the grip core (lathe), its matrix inside the (identity) handle group.
pub fn build_handle(h: &Handle) -> (Mesh, Mat4) {
    let ridges = if h.segmentation.unwrap_or(false) { h.segmentation_count.unwrap_or(8.0) } else { 0.0 };
    let segments = 32;
    let flare = jmax(0.0, h.flare.unwrap_or(0.0));
    let mut profile = Vec::with_capacity(segments + 1);
    for i in 0..=segments {
        let t = i as f64 / segments as f64;
        let y = -h.length / 2.0 + t * h.length;
        let base_r = h.radius_bottom + (h.radius_top - h.radius_bottom) * t;
        let bump = if ridges > 0.0 { sin(t * PI * ridges) * 0.03 } else { 0.0 };
        let r = jmax(0.02, base_r + bump + flare * pow(1.0 - t, 2.0));
        profile.push((r, y));
    }
    let phi = jmax(8.0, jmin(128.0, jround(h.phi_segments.unwrap_or(64.0)))) as usize;
    let mut m = lathe_geometry(&profile, phi);
    // the helical wrap deformation: raise and sink the surface along a helix
    if h.wrap_enabled.unwrap_or(false)
        && h.wrap_depth.unwrap_or(0.0) > 0.0
        && h.wrap_turns.unwrap_or(0.0) > 0.0
    {
        let (mut y_min, mut y_max) = (f64::INFINITY, f64::NEG_INFINITY);
        for v in m.pos.chunks_exact(3) {
            let y = v[1] as f64;
            if y < y_min {
                y_min = y;
            }
            if y > y_max {
                y_max = y;
            }
        }
        let num_or_0 = |v: Option<f64>| v.filter(|x| *x != 0.0 && !x.is_nan()).unwrap_or(0.0);
        let turns = jmax(0.0, num_or_0(h.wrap_turns));
        let amp = jmin(0.1, jmax(0.0, num_or_0(h.wrap_depth)));
        for v in m.pos.chunks_exact_mut(3) {
            let (x, y, z) = (v[0] as f64, v[1] as f64, v[2] as f64);
            let t = (y - y_min) / jmax(1e-6, y_max - y_min);
            let base_r = jmax(0.01, v8_hypot(&[x, z]));
            let phi = atan2(z, x) + 2.0 * PI * turns * t;
            let offset = amp * sin(phi);
            let scale = (base_r + offset) / base_r;
            v[0] = (x * scale) as f32;
            v[2] = (z * scale) as f32;
        }
        m.compute_vertex_normals();
    }
    let curvature = h.curvature.unwrap_or(0.0);
    if curvature != 0.0 && !curvature.is_nan() {
        let (mut min_y, mut max_y) = (f64::INFINITY, f64::NEG_INFINITY);
        for v in m.pos.chunks_exact(3) {
            let y = v[1] as f64;
            if y < min_y {
                min_y = y;
            }
            if y > max_y {
                max_y = y;
            }
        }
        for v in m.pos.chunks_exact_mut(3) {
            let y = v[1] as f64;
            let t = (y - min_y) / jmax(1e-6, max_y - min_y);
            let bend = curvature * (t * t - t) * (max_y - min_y);
            v[0] = (v[0] as f64 + bend) as f32;
        }
        m.compute_vertex_normals();
    }
    let oval = jmax(1.0, h.oval_ratio.unwrap_or(1.0));
    let (sx, sz) = if oval != 1.0 { (oval, 1.0 / oval) } else { (1.0, 1.0) };
    (m, compose([0.0, -h.length * 0.5, 0.0], [0.0; 3], [sx, 1.0, sz]))
}

/// `buildPommel`, placed below the handle's world bounding box.
pub fn build_pommel(p: &Pommel, handle: Option<(&Mesh, &Mat4)>, blade: &Blade) -> (Mesh, Mat4) {
    let facets = jmax(6.0, jround(p.facet_count.unwrap_or(32.0))) as usize;
    let bal = clamp(p.balance.unwrap_or(0.0), 0.0, 1.0);
    let th = blade.thickness;
    let mass = blade.length
        * ((blade.base_width + blade.tip_width) * 0.5)
        * ((blade.thickness_left.or(th).unwrap_or(0.08) + blade.thickness_right.or(th).unwrap_or(0.08))
            * 0.5);
    let size_auto = cbrt(jmax(1e-6, mass)) * 0.35;
    let se = clamp(lerp(p.size, size_auto, bal), 0.05, 1.0);
    if super::monument::is_pommel_style(p.style.as_deref()) {
        // SW10's monument pommels hang from the grip's end (monument.rs)
        let mut yb = -1.0;
        if let Some((hm, hmat)) = handle {
            let (lo, _) = world_bbox(hm, hmat);
            if lo[1].is_finite() {
                yb = lo[1];
            }
        }
        return super::monument::build_pommel_monument(p, se, yb);
    }
    let morph = p.shape_morph;
    let style = p.style.as_deref().unwrap_or("orb");
    let mut rot = [0.0; 3];
    let mut scale = [1.0, 1.0, 1.0];
    let mesh = match style {
        "disk" => {
            let hy = jmax(0.02, se * 0.15);
            cylinder_geometry(se * (1.0 + morph), se * (1.0 + morph), hy, facets)
        }
        "spike" => {
            let height = se * (1.2 + morph) * p.spike_length.unwrap_or(1.0);
            rot[2] = PI;
            cone_geometry(se * (0.8 + 0.4 * morph), height, facets)
        }
        "wheel" => {
            let height = jmax(0.02, se * 0.18);
            let radius = se * (1.0 + 0.2 * morph);
            cylinder_geometry(radius, radius, height, facets)
        }
        "ring" => {
            let inner = jmax(0.01, p.ring_inner_radius.unwrap_or(se * 0.4));
            let tube = jmax(0.004, se * 0.12);
            rot[0] = PI / 2.0;
            torus_geometry(inner + tube, tube, 12, jmax(12.0, jround(facets as f64)) as usize)
        }
        "crown" => {
            let spikes = jmax(5.0, jround(p.crown_spikes.unwrap_or(8.0))) as usize;
            let sharp = clamp(p.crown_sharpness.unwrap_or(0.6), 0.0, 1.0);
            let height = se * (0.18 + 0.3 * sharp);
            rot[2] = PI;
            cone_geometry(se * (0.9 + 0.2 * morph), height, spikes)
        }
        _ => {
            let s = 1.0 + (morph - 0.5) * 0.6;
            scale = [1.0 * s, 1.0, 1.0 * s];
            sphere_geometry(se, facets, jmax(8.0, jround(facets as f64 / 2.0)) as usize)
        }
    };
    if !matches!(style, "disk" | "wheel" | "ring" | "crown" | "scentStopper") {
        scale[1] *= clamp(p.elongation, 0.5, 2.0);
    }
    let geo_top = if style == "ring" { jmax(0.004, se * 0.12) } else { mesh.bbox().1[1] };
    let mut y = -1.0;
    if let Some((hm, hmat)) = handle {
        let (lo, _) = world_bbox(hm, hmat);
        if lo[1].is_finite() {
            y = lo[1];
        }
    }
    let flat = matches!(style, "ring" | "disk" | "wheel");
    let off_y = p.offset_y.unwrap_or(0.0);
    let py = if flat { y - geo_top * 0.5 + off_y } else { y - se * 0.3 * p.elongation + off_y };
    (mesh, compose([p.offset_x.unwrap_or(0.0), py, 0.0], rot, scale))
}
