//! bladegen's blade: `buildBladeGeometry` (`src/three/sword/bladeGeometry.ts`) and the helpers it uses from
//! `math.ts` (`bendOffsetX`, `tipWidthWithKissaki`, `thicknessScaleAt`, `wavinessAt`, `serrationWave`), ported line
//! by line from bladegen 2eb8d94. Expression order follows the TypeScript so the f64 results round the same way.
//! Not ported: the fuller and hamon overlay ribbons (separate meshes), engravings, and the tangent attribute.
use super::geom::*;
use super::params::{Blade, FullerSlot, Glow, Points};
use std::f64::consts::PI;

/// JS `Number(v) || d` for an optional number: undefined, NaN and 0 take the default.
fn or_num(v: Option<f64>, d: f64) -> f64 {
    match v {
        Some(x) if x != 0.0 && !x.is_nan() => x,
        _ => d,
    }
}

fn sample_profile(points: &Points, t: f64) -> f64 {
    if points.is_empty() {
        return 0.0;
    }
    let tt = jmax(0.0, jmin(1.0, t));
    let n = points.len();
    let mut lo = points[0];
    let mut hi = points[n - 1];
    for i in 0..n - 1 {
        let a = points[i];
        let b = points[i + 1];
        if tt >= a[0] && tt <= b[0] {
            lo = a;
            hi = b;
            break;
        }
        if tt > b[0] {
            lo = b;
            hi = points[(i + 2).min(n - 1)];
        }
    }
    let range = jmax(1e-6, hi[0] - lo[0]);
    let alpha = jmax(0.0, jmin(1.0, (tt - lo[0]) / range));
    lerp(lo[1], hi[1], alpha)
}

fn profile_points(p: &Option<super::params::Profile>) -> Option<&Points> {
    p.as_ref().and_then(|p| p.points.as_ref()).filter(|pts| pts.len() >= 2)
}

/// `bendOffsetX(b, y, L)`.
pub fn bend_offset_x(b: &Blade, y: f64, l: f64) -> f64 {
    let t = clamp(if l > 0.0 { y / l } else { 0.0 }, 0.0, 1.0);
    let prof = b.sori_profile.as_deref().unwrap_or("torii");
    let bias = b.sori_bias.unwrap_or(0.8);
    let (mut a, mut c) = (1.0, 1.0);
    if prof == "koshi" {
        a = bias;
        c = 1.0;
    } else if prof == "saki" {
        a = 1.0;
        c = bias;
    }
    let shape = pow(t, a) * pow(1.0 - t, c);
    let peak = pow(a / (a + c), a) * pow(c / (a + c), c);
    let norm = if peak > 1e-6 { shape / peak } else { shape };
    let curved = -or_num(b.curvature, 0.0) * 0.25 * norm * l;
    let linear = tan(b.base_angle.unwrap_or(0.0)) * y;
    let mut profile = 0.0;
    if let Some(pts) = profile_points(&b.curve_profile) {
        let cp = b.curve_profile.as_ref().unwrap();
        let val = sample_profile(pts, t);
        let relative = cp.mode.as_deref() == Some("relative");
        let scale = cp.scale.unwrap_or(1.0);
        profile = val * scale * (if relative { l } else { 1.0 });
    }
    curved + linear + profile
}

/// `tipWidthWithKissaki(b, t, baseW, tipW)`.
pub fn tip_width_with_kissaki(b: &Blade, t: f64, base_w: f64, tip_w: f64) -> f64 {
    let ramp_start = clamp(b.tip_ramp_start.unwrap_or(0.0), 0.0, 0.98);
    let span = 1.0 - ramp_start;
    let raw_kf = clamp(b.kissaki_length.unwrap_or(0.0), 0.0, 0.35);
    let local_kf = if span > 1e-6 { jmin(1.0, raw_kf / span) } else { 0.0 };
    let local_t = if span > 1e-6 { clamp((t - ramp_start) / span, 0.0, 1.0) } else { 1.0 };
    let tip_shape = b.tip_shape.as_deref().unwrap_or("");
    let mut w;
    if ramp_start > 1e-6 && t < ramp_start {
        w = base_w;
    } else if local_kf <= 1e-6 {
        w = base_w + (tip_w - base_w) * local_t;
    } else {
        let split = jmax(0.0, 1.0 - local_kf);
        let mid_w = base_w + (tip_w - base_w) * split;
        if split > 1e-6 && local_t <= split {
            w = base_w + (mid_w - base_w) * (local_t / split);
        } else {
            let u = (local_t - split) / jmax(1e-6, local_kf);
            let mut r = clamp(b.kissaki_roundness.unwrap_or(0.5), 0.0, 1.0);
            if tip_shape == "rounded" {
                r = 1.0;
            }
            let mut expo = lerp(0.5, 3.0, 1.0 - r);
            match tip_shape {
                "tanto" => expo = 2.2,
                "clip" => expo = 0.8,
                "spear" => expo = 1.4,
                "sheepsfoot" => expo = 3.0,
                _ => {}
            }
            let eased = pow(u, expo);
            w = mid_w + (tip_w - mid_w) * eased;
        }
    }
    if tip_shape == "leaf" {
        let bulge = clamp(b.tip_bulge.unwrap_or(0.2), 0.0, 1.0);
        let bell = 4.0 * t * (1.0 - t);
        w *= 1.0 + bulge * bell;
    }
    if let Some(pts) = profile_points(&b.width_profile) {
        let val = sample_profile(pts, clamp(t, 0.0, 1.0));
        if b.width_profile.as_ref().unwrap().mode.as_deref() == Some("absolute") {
            w = val;
        } else {
            w *= val;
        }
    }
    jmax(0.0005, w)
}

/// `thicknessScaleAt(b, t)`.
pub fn thickness_scale_at(b: &Blade, t: f64) -> f64 {
    let pts: Points = match profile_points(&b.thickness_profile) {
        Some(p) => {
            let mut v = p.clone();
            // Array.prototype.sort is stable
            v.sort_by(|a, c| (a[0] - c[0]).partial_cmp(&0.0).unwrap_or(std::cmp::Ordering::Equal));
            v
        }
        None => vec![[0.0, 1.0], [1.0, 1.0]],
    };
    let tt = jmax(0.0, jmin(1.0, t));
    let n = pts.len();
    let mut i = 0;
    while i < n - 1 && !(tt >= pts[i][0] && tt <= pts[i + 1][0]) {
        i += 1;
    }
    let [t0, s0] = pts[i.min(n - 2)];
    let [t1, s1] = pts[(i + 1).min(n - 1)];
    if (t1 - t0).abs() < 1e-10 {
        return s0;
    }
    let a = (tt - t0) / (t1 - t0);
    lerp(s0, s1, a)
}

/// `wavinessAt(b, t)`: (centerline offset, width offset).
pub fn waviness_at(b: &Blade, t: f64) -> (f64, f64) {
    let Some(w) = &b.waviness else { return (0.0, 0.0) };
    let taper = w.taper.unwrap_or(0.0);
    let envelope = if taper > 0.0 { pow(jmax(0.0, 1.0 - t), taper) } else { 1.0 };
    let phase = w.phase.unwrap_or(0.0);
    let wave = sin(t * w.frequency * PI * 2.0 + phase) * w.amplitude;
    let wave = wave * envelope;
    let offset = w.offset.unwrap_or(0.0) * envelope;
    match w.mode.as_deref() {
        Some("centerline") => (wave + offset, 0.0),
        Some("both") => (wave + offset, wave),
        _ => (offset, wave),
    }
}

/// `serrationWave(t, freq, amp, pattern, seed, sharpness, bias)`.
pub fn serration_wave(
    t: f64,
    freq: f64,
    amp: f64,
    pattern: &str,
    seed: f64,
    sharpness: f64,
    bias: f64,
) -> f64 {
    if amp == 0.0 || amp.is_nan() || freq == 0.0 || freq.is_nan() {
        return 0.0;
    }
    let sharp = clamp(sharpness, 0.0, 1.0);
    let bias_c = clamp(bias, -1.0, 1.0);
    let phase = bias_c * PI * 0.5;
    let ph = t * PI * freq + phase;
    let mut value = match pattern {
        "saw" => {
            let k = ph / PI;
            let frac = k - k.floor();
            let skew = clamp(0.5 + 0.45 * bias_c, 0.05, 0.95);
            let normalized = if frac <= skew {
                frac / jmax(skew, 1e-6)
            } else {
                1.0 - (frac - skew) / jmax(1e-6, 1.0 - skew)
            };
            normalized * 2.0 - 1.0
        }
        "scallop" => {
            let s = sin(ph);
            let v = 1.0 - s.abs();
            v * 2.0 - 1.0
        }
        "random" => {
            let a = sin(ph * 1.7 + seed * 0.1);
            let b = sin(ph * 2.3 + seed * 0.2);
            (a + b) * 0.5
        }
        _ => sin(ph),
    };
    if sharp > 0.0 {
        let p = 1.0 - sharp * 0.7;
        value = jsign(value) * pow(value.abs(), p);
    }
    amp * value
}

#[derive(Clone, Debug)]
struct Fuller {
    offset: f64,
    width: f64,
    inset: f64,
    start: f64,
    end: f64,
    profile: &'static str,
    carve: bool,
    taper: f64,
}

fn resolve_fullers(b: &Blade) -> Vec<Fuller> {
    let mut out = Vec::new();
    let slots: &[FullerSlot] = b.fullers.as_deref().unwrap_or(&[]);
    for slot in slots {
        let width = jmax(0.005, or_num(slot.width, or_num(Some(b.base_width), 0.25) * 0.3));
        let start = clamp(or_num(slot.start, 0.05), 0.0, 0.98);
        let end = clamp(or_num(slot.end, 0.95), start + 0.02, 1.0);
        if end <= start {
            continue;
        }
        let depth = jmax(0.0, or_num(slot.depth, 0.0));
        let inset = jmax(0.0, or_num(slot.inset, depth));
        let profile = match slot.profile.as_deref() {
            Some("v") => "v",
            Some("flat") => "flat",
            _ => "u",
        };
        let carve = slot.mode.as_deref() == Some("carve");
        let taper = clamp(or_num(slot.taper, 0.0), 0.0, 1.0);
        let base = or_num(slot.offset_from_spine, 0.0).abs();
        let f = |sign: f64| Fuller {
            offset: if sign >= 0.0 { base } else { -base },
            width,
            inset,
            start,
            end,
            profile,
            carve,
            taper,
        };
        match slot.side.as_deref() {
            Some("left") => out.push(f(-1.0)),
            Some("right") => out.push(f(1.0)),
            _ => {
                out.push(f(-1.0));
                out.push(f(1.0));
            }
        }
    }
    out
}

/// Columns across the blade (`cols` in bladegen): 13 stations per side, front and back.
pub const COLS: usize = 12;

/// Per-vertex position across and along the blade, for the glow mask: (t along 0..1, u across -1..1).
pub fn blade_station(vertex: usize, segs: usize) -> (f64, f64) {
    let stride = (COLS + 1) * 2;
    let i = vertex / stride;
    let j = (vertex % stride) / 2;
    (i as f64 / segs as f64, j as f64 / COLS as f64 * 2.0 - 1.0)
}

/// Sweep segments actually used (`Math.max(16, Math.min(512, Math.round(sweepSegments ?? 128)))`).
pub fn sweep_segments(b: &Blade) -> usize {
    jmax(16.0, jmin(512.0, jround(b.sweep_segments.unwrap_or(128.0)))) as usize
}

/// `buildBladeGeometry(b)`: positions, indices and `computeVertexNormals()`.
pub fn build_blade(b: &Blade) -> Mesh {
    let l = jmax(0.01, b.length);
    let tl0 = jmax(0.001, b.thickness_left.or(b.thickness).unwrap_or(0.08));
    let tr0 = jmax(0.001, b.thickness_right.or(b.thickness).unwrap_or(0.08));
    let base_w = jmax(0.002, b.base_width);
    let tip_w = jmax(0.0, b.tip_width);
    let segs = sweep_segments(b);
    let cols = COLS;
    let serr_amp = b.serration_amplitude.unwrap_or(0.0);
    let serr_amp_l = b.serration_amplitude_left.unwrap_or(serr_amp);
    let serr_amp_r = b.serration_amplitude_right.unwrap_or(serr_amp);
    let serr_freq = b.serration_frequency.unwrap_or(0.0);
    let chaos = b.chaos.unwrap_or(0.0);
    let row_stride = (cols + 1) * 2;
    let mut pos = vec![0f32; (segs + 1) * row_stride * 3];
    let vi = |i: usize, j: usize, side: usize| (i * row_stride + j * 2 + side) as u32;

    let bevel = clamp(b.bevel.unwrap_or(0.5), 0.0, 1.0);
    let cs = b.cross_section.as_deref().unwrap_or("flat");
    let shape_factor = |u: f64| -> f64 {
        let au = u.abs();
        match cs {
            "diamond" => 1.0 - pow(au, lerp(1.0, 2.5, bevel)),
            "lenticular" => {
                let g = lerp(1.4, 0.8, bevel);
                pow(jmax(0.0, 1.0 - au * au), 0.5 * g)
            }
            "hexagonal" => {
                let p = lerp(0.35, 1.1, bevel);
                pow(jmax(0.0, 1.0 - au), jmax(0.2, p))
            }
            "compound" => {
                let primary = pow(jmax(0.0, 1.0 - pow(au, lerp(1.0, 1.8, bevel))), 1.1);
                let shoulder_width = lerp(0.6, 0.35, bevel);
                let shoulder = pow(jmax(0.0, 1.0 - pow(au / jmax(0.01, shoulder_width), 4.0)), 1.8);
                lerp(primary, shoulder, 0.55)
            }
            "triangular" => jmax(0.0, 1.0 - pow(au, lerp(1.0, 0.35, bevel))),
            "tSpine" => {
                let ridge_width = lerp(0.2, 0.05, bevel);
                let rib = pow(jmax(0.0, 1.0 - pow(au / jmax(0.01, ridge_width), 2.0)), 1.6);
                let web = pow(jmax(0.0, 1.0 - pow(au, 2.6)), 0.9);
                jmax(rib, web * 0.45)
            }
            _ => 0.0,
        }
    };

    let ser_pat = b.serration_pattern.as_deref().unwrap_or("sine");
    let ser_seed = b.serration_seed.unwrap_or(1337.0);
    let sharp = clamp(b.serration_sharpness.unwrap_or(0.0), 0.0, 1.0);
    let bias_left = clamp(b.serration_lean_left.unwrap_or(0.0), -1.0, 1.0);
    let bias_right = clamp(b.serration_lean_right.unwrap_or(0.0), -1.0, 1.0);
    let serr = |t: f64, freq: f64, amp: f64, bias: f64, seed_offset: f64| {
        serration_wave(t, freq, amp, ser_pat, ser_seed + seed_offset, sharp, bias)
    };

    let has_explicit = b.fullers.as_ref().is_some_and(|f| !f.is_empty());
    let active = b.fuller_enabled.unwrap_or(false) || has_explicit;
    let resolved = if active { resolve_fullers(b) } else { Vec::new() };
    let carve: Vec<&Fuller> =
        resolved.iter().filter(|f| f.carve && f.inset > 0.0 && f.end > f.start).collect();
    let ricasso = clamp(b.ricasso_length.unwrap_or(0.0), 0.0, 0.3);
    let fe_len = clamp(b.false_edge_length.unwrap_or(0.0), 0.0, 1.0);
    let fe_depth = clamp(b.false_edge_depth.unwrap_or(0.0), 0.0, 0.2);
    let single = b.edge_type.as_deref().unwrap_or("double") == "single";
    let spine_sign = if single {
        if tr0 >= tl0 {
            1.0
        } else {
            -1.0
        }
    } else {
        1.0
    };
    let tip_shape = b.tip_shape.as_deref().unwrap_or("");
    let asym = b.asymmetry.unwrap_or(0.0);
    let twist_angle = b.twist_angle.unwrap_or(0.0);
    let hollow = b.hollow_grind.as_ref().filter(|h| h.enabled.unwrap_or(false) || h.mix.unwrap_or(0.0) > 0.0);

    for i in 0..=segs {
        let t = i as f64 / segs as f64;
        let y = t * l;
        let mut w = tip_width_with_kissaki(b, t, base_w, tip_w);
        let in_ricasso = ricasso > 0.0 && t <= ricasso;
        if in_ricasso {
            w = base_w;
        }
        let serr_l =
            if in_ricasso { 0.0 } else { serr(t, serr_freq, serr_amp_l, bias_left, 0.0) * (1.0 - t) };
        let serr_r =
            if in_ricasso { 0.0 } else { serr(t, serr_freq, serr_amp_r, bias_right, 7.0) * (1.0 - t) };
        let c1 = sin(t * PI * 16.0 + 1.3);
        let c2 = sin(t * PI * 9.7 + 0.6);
        let chaos_offset = (c1 * 0.6 + c2 * 0.4) * chaos * 0.08 * base_w * (1.0 - t * 0.6);
        let base_half = jmax(0.001, w * 0.5 + chaos_offset);
        let mut left_half = jmax(0.0005, (base_half + serr_l) * (1.0 - 0.5 * asym));
        let mut right_half = jmax(0.0005, (base_half + serr_r) * (1.0 + 0.5 * asym));
        if matches!(tip_shape, "clip" | "tanto" | "sheepsfoot") {
            let tip_len = jmax(0.05, or_num(Some(b.kissaki_length.unwrap_or(0.2)), 0.2));
            let t0 = jmax(0.0, 1.0 - tip_len);
            let tip_u = clamp((t - t0) / jmax(1e-6, tip_len), 0.0, 1.0);
            let spine_is_right = spine_sign > 0.0;
            match tip_shape {
                "clip" => {
                    let delta = base_half * 0.4 * pow(tip_u, 0.7);
                    if spine_is_right {
                        right_half = jmax(0.0005, right_half - delta);
                    } else {
                        left_half = jmax(0.0005, left_half - delta);
                    }
                }
                "sheepsfoot" => {
                    let delta = base_half * 0.5 * pow(tip_u, 2.0);
                    if spine_is_right {
                        right_half = jmax(0.0005, right_half - delta);
                    } else {
                        left_half = jmax(0.0005, left_half - delta);
                    }
                }
                _ => {
                    let delta = base_half * 0.25 * tip_u;
                    if !spine_is_right {
                        right_half = jmax(0.0005, right_half - delta);
                    } else {
                        left_half = jmax(0.0005, left_half - delta);
                    }
                }
            }
        }
        let (wav_c, wav_w) = waviness_at(b, t);
        if wav_w != 0.0 {
            left_half = jmax(0.0005, left_half + wav_w);
            right_half = jmax(0.0005, right_half + wav_w);
        }
        let bend = bend_offset_x(b, y, l) + wav_c;
        let xl = -left_half + bend;
        let xr = right_half + bend;
        let t_scale = thickness_scale_at(b, t);
        let width_ratio = clamp(w / jmax(0.0001, base_w), 0.0, 1.0);
        let tip_thick = jmax(0.05, pow(width_ratio, 0.65));
        let half_edge_l = jmax(0.0005, tl0 * t_scale * 0.5 * tip_thick);
        let half_edge_r = jmax(0.0005, tr0 * t_scale * 0.5 * tip_thick);
        let edge_mid_half = 0.5 * (half_edge_l + half_edge_r);
        let thick = b.thickness.unwrap_or((tl0 + tr0) * 0.5);
        let base_spine_target = thick * 0.5 * t_scale * tip_thick;
        let base_spine_half = jmax(edge_mid_half + 0.0005, base_spine_target);
        let mut center_half = jmax(base_spine_half, edge_mid_half * (1.0 + 2.0 * bevel));
        if cs == "tSpine" {
            let ridge_boost = jmax(0.0005, thick * 0.15);
            center_half = jmax(center_half, base_spine_half + ridge_boost);
        }
        let twist = twist_angle * t;
        let (cos_t, sin_t) = (cos(twist), sin(twist));

        for j in 0..=cols {
            let s = j as f64 / cols as f64;
            let u = s * 2.0 - 1.0;
            let x_raw = lerp(xl, xr, s);
            let edge_half = lerp(half_edge_l, half_edge_r, s);
            let f = shape_factor(u);
            let mut z_half = edge_half + (center_half - edge_mid_half) * f;
            if let Some(h) = hollow {
                let mix =
                    clamp(h.mix.unwrap_or(if h.enabled.unwrap_or(false) { 0.65 } else { 0.0 }), 0.0, 1.0);
                let depth = clamp(h.depth.unwrap_or(0.45), 0.0, 1.0);
                let radius = clamp(h.radius.unwrap_or(0.6), 0.1, 6.0);
                let hbias = clamp(h.bias.unwrap_or(0.0), -1.0, 1.0);
                if mix > 0.0 && depth > 0.0 {
                    let biased = clamp(u.abs() + hbias * 0.5, 0.0, 1.0);
                    let concave = pow(1.0 - pow(biased, radius), 1.25);
                    let target = edge_half + (center_half - edge_half) * (1.0 - concave * depth);
                    z_half = lerp(z_half, jmax(edge_half, target), mix);
                }
            }
            for slot in &carve {
                if t < slot.start || t > slot.end {
                    continue;
                }
                let span = jmax(1e-6, slot.end - slot.start);
                let along = clamp((t - slot.start) / span, 0.0, 1.0);
                let width_scale = jmax(0.1, 1.0 - slot.taper * along);
                let half_w = jmax(0.002, slot.width * 0.5 * width_scale);
                let cx = bend + slot.offset;
                let dx = (x_raw - cx).abs();
                if dx > half_w {
                    continue;
                }
                let inner = 1.0 - clamp(dx / jmax(1e-6, half_w), 0.0, 1.0);
                let profile = match slot.profile {
                    "u" => inner.sqrt(),
                    "flat" => inner * 0.85,
                    _ => inner,
                };
                let depth_scale = jmax(0.0, 1.0 - slot.taper * along);
                let inset = profile * slot.inset * depth_scale;
                z_half = jmax(0.0006, z_half - inset);
            }
            if fe_len > 0.0 && fe_depth > 0.0 && t >= 1.0 - fe_len {
                let along = clamp((t - (1.0 - fe_len)) / jmax(1e-6, fe_len), 0.0, 1.0);
                let to_spine = if spine_sign > 0.0 { s } else { 1.0 - s };
                let across = pow(clamp(to_spine, 0.0, 1.0), 2.0);
                let carve = fe_depth * along * across;
                z_half = jmax(0.0006, z_half - carve);
            }
            let rot = |x: f64, z: f64| (x * cos_t - z * sin_t, x * sin_t + z * cos_t);
            let front = rot(x_raw, -z_half);
            let back = rot(x_raw, z_half);
            let k = vi(i, j, 0) as usize * 3;
            pos[k] = front.0 as f32;
            pos[k + 1] = y as f32;
            pos[k + 2] = front.1 as f32;
            let k = vi(i, j, 1) as usize * 3;
            pos[k] = back.0 as f32;
            pos[k + 1] = y as f32;
            pos[k + 2] = back.1 as f32;
        }
    }

    let mut idx: Vec<u32> = Vec::with_capacity(segs * (cols * 12 + 12) + cols * 12);
    for i in 0..segs {
        for j in 0..cols {
            let (f00, f01, f10, f11) = (vi(i, j, 0), vi(i, j + 1, 0), vi(i + 1, j, 0), vi(i + 1, j + 1, 0));
            let (b00, b01, b10, b11) = (vi(i, j, 1), vi(i, j + 1, 1), vi(i + 1, j, 1), vi(i + 1, j + 1, 1));
            idx.extend_from_slice(&[f00, f01, f11, f00, f11, f10]);
            idx.extend_from_slice(&[b00, b11, b01, b00, b10, b11]);
        }
        let (lf0, lb0, lf1, lb1) = (vi(i, 0, 0), vi(i, 0, 1), vi(i + 1, 0, 0), vi(i + 1, 0, 1));
        idx.extend_from_slice(&[lf0, lb0, lb1, lf0, lb1, lf1]);
        let (rf0, rb0, rf1, rb1) = (vi(i, cols, 0), vi(i, cols, 1), vi(i + 1, cols, 0), vi(i + 1, cols, 1));
        idx.extend_from_slice(&[rf0, rb1, rb0, rf0, rf1, rb1]);
    }
    for j in 0..cols {
        let (f0, b0, f1, b1) = (vi(0, j, 0), vi(0, j, 1), vi(0, j + 1, 0), vi(0, j + 1, 1));
        idx.extend_from_slice(&[f0, b1, b0, f0, f1, b1]);
        let (fn0, bn0, fn1, bn1) = (vi(segs, j, 0), vi(segs, j, 1), vi(segs, j + 1, 0), vi(segs, j + 1, 1));
        idx.extend_from_slice(&[fn0, bn0, bn1, fn0, bn1, fn1]);
    }
    let mut m = Mesh { pos, idx, ..Default::default() };
    m.compute_vertex_normals();
    compute_blade_tangents(&mut m);
    // SW1 (bladegen sword/planet-swords cbfe895): the optional glow channel, grid UVs plus a COLOR_0 mask
    if let Some(g) = b.glow.as_ref().filter(|g| g.enabled != Some(false)) {
        m.uv = grid_uvs(segs);
        m.color = glow_colors(g, segs);
    }
    m
}

/// `computeBladeTangents`: +Y projected onto each vertex's tangent plane (falls back to +X), w = 1.
pub fn compute_blade_tangents(m: &mut Mesh) {
    let n = m.vertex_count();
    let mut out = Vec::with_capacity(n * 4);
    for v in 0..n {
        let (nx, ny, nz) = (m.nrm[v * 3] as f64, m.nrm[v * 3 + 1] as f64, m.nrm[v * 3 + 2] as f64);
        let (mut tx, mut ty, mut tz) = (0.0, 1.0, 0.0);
        let dot = nx * tx + ny * ty + nz * tz;
        let (mut px, mut py, mut pz) = (tx - nx * dot, ty - ny * dot, tz - nz * dot);
        let mut len = v8_hypot(&[px, py, pz]);
        if len < 1e-6 {
            tx = 1.0;
            ty = 0.0;
            tz = 0.0;
            let dot2 = nx * tx + ny * ty + nz * tz;
            px = tx - nx * dot2;
            py = ty - ny * dot2;
            pz = tz - nz * dot2;
            len = v8_hypot(&[px, py, pz]);
        }
        if len > 1e-12 {
            px /= len;
            py /= len;
            pz /= len;
        }
        out.extend_from_slice(&[px as f32, py as f32, pz as f32, 1.0]);
    }
    m.tangent = out;
}

/// `bladeGridUVs(segs)`: u = j / cols across, v = i / segs along.
pub fn grid_uvs(segs: usize) -> Vec<f32> {
    let mut uv = Vec::with_capacity((segs + 1) * (COLS + 1) * 4);
    for i in 0..=segs {
        for j in 0..=COLS {
            for _side in 0..2 {
                uv.push((j as f64 / COLS as f64) as f32);
                uv.push((i as f64 / segs as f64) as f32);
            }
        }
    }
    uv
}

/// `glowMaskAt(glow, s)`: an edge band plus a core band.
pub fn glow_mask_at(g: &Glow, s: f64) -> f64 {
    let ew = g.edge_width.unwrap_or(0.0);
    let cw = g.core_width.unwrap_or(0.0);
    let d_edge = jmin(s, 1.0 - s);
    let edge_band = if ew > 0.0 { jmax(0.0, 1.0 - d_edge / jmax(1.5 * ew, 1.0 / COLS as f64)) } else { 0.0 };
    let core_band = if cw > 0.0 { jmax(0.0, 1.0 - (s - 0.5).abs() / cw) } else { 0.0 };
    jmin(1.0, g.edge_mask.unwrap_or(0.0) * edge_band + g.core_mask.unwrap_or(0.0) * core_band)
}

/// `bladeGlowColors`: RGB 1, A = the mask, per grid vertex.
pub fn glow_colors(g: &Glow, segs: usize) -> Vec<f32> {
    let mut c = Vec::with_capacity((segs + 1) * (COLS + 1) * 8);
    for _i in 0..=segs {
        for j in 0..=COLS {
            let a = glow_mask_at(g, j as f64 / COLS as f64) as f32;
            for _side in 0..2 {
                c.extend_from_slice(&[1.0, 1.0, 1.0, a]);
            }
        }
    }
    c
}

/// `fixBladeWinding` (SW1's export preparation): reverse the broad-face triangles (the first `cols * 4` of each
/// row block of `cols * 4 + 4`), then recompute normals and tangents. Grid UVs are added when missing, as
/// `prepareExport` does before the fix.
pub fn prepare_export(m: &mut Mesh, segs: usize) {
    if m.uv.is_empty() {
        m.uv = grid_uvs(segs);
    }
    let row_tris = COLS * 4 + 4;
    for i in 0..segs {
        for t in 0..COLS * 4 {
            let k = (i * row_tris + t) * 3;
            m.idx.swap(k + 1, k + 2);
        }
    }
    m.compute_vertex_normals();
    compute_blade_tangents(m);
}
