//! The whole sword: bladegen's `SwordGenerator` part order for the subset this crate builds, SW1's export preparation
//! and SW1's monument transform (`monumentTransform`, `src/headless/index.ts`). Moved from the galaxy kit's
//! `sword/mod.rs` (BG1); the code is unchanged.
use crate::geom::{self, Mat4, Mesh};
use crate::params;
use crate::{blade, glow, hilt, monument as mon};

/// One mesh of the sword in bladegen's scene coordinates (units, blade along +Y from the guard line at y = 0).
/// `name` is the part (`blade`, `glow`, `handle`, `guard`, `pommel`); the k-th part of a name is bladegen's
/// `<name>#<k>` in SW1's mesh dump and GLB.
pub struct Part {
    pub name: &'static str,
    pub mesh: Mesh,
    pub matrix: Mat4,
}

/// bladegen's `SwordGenerator` plus SW1's export preparation (`export`: grid UVs and the blade winding fix), for the
/// ported subset, in bladegen's mesh order: blade, glow, handle (core, wire wrap), guard (bar, forged or one of SW10's
/// monument styles; quillons), pommel.
/// Parts the port does not have are left out and named in the second list.
pub fn build_parts(s: &params::Sword, export: bool) -> (Vec<Part>, Vec<String>) {
    let mut parts = Vec::new();
    let mut skipped = Vec::new();
    let mut b = blade::build_blade(&s.blade);
    let segs = blade::sweep_segments(&s.blade);
    let glow_mesh = glow::build_glow(&s.blade, &b.pos);
    if export {
        blade::prepare_export(&mut b, segs);
    }
    let base_y = geom::world_bbox(&b, &geom::IDENTITY).0[1];
    parts.push(Part { name: "blade", mesh: b, matrix: geom::IDENTITY });
    if let Some(g) = glow_mesh {
        parts.push(Part { name: "glow", mesh: g, matrix: geom::IDENTITY });
    }
    if s.hilt_enabled == Some(false) {
        return (parts, skipped);
    }
    let (hm, hmat) = hilt::build_handle(&s.handle);
    let wraps = match hilt::handle_unsupported(&s.handle) {
        None => hilt::build_wire_wrap(&s.handle, &hm, &hmat),
        Some(why) => {
            skipped.push(why);
            Vec::new()
        }
    };
    let (pm, pmat) = hilt::build_pommel(&s.pommel, Some((&hm, &hmat)), &s.blade);
    parts.push(Part { name: "handle", mesh: hm, matrix: hmat });
    parts.extend(wraps.into_iter().map(|(mesh, matrix)| Part { name: "handle", mesh, matrix }));
    if s.guard_enabled != Some(false) {
        match hilt::guard_unsupported(&s.guard) {
            None => {
                let (gm, gmat) = if s.guard.style.as_deref() == Some("forged") {
                    hilt::build_guard_forged(&s.guard, &s.blade, base_y)
                } else if mon::is_guard_style(s.guard.style.as_deref()) {
                    mon::build_guard_monument(&s.guard, &s.blade, base_y)
                } else {
                    hilt::build_guard_bar(&s.guard, base_y)
                };
                parts.push(Part { name: "guard", mesh: gm, matrix: gmat });
                for (mesh, matrix) in hilt::build_quillons(&s.guard, base_y) {
                    parts.push(Part { name: "guard", mesh, matrix });
                }
            }
            Some(why) => skipped.push(why),
        }
    }
    match hilt::pommel_unsupported(&s.pommel) {
        None => parts.push(Part { name: "pommel", mesh: pm, matrix: pmat }),
        Some(why) => skipped.push(why),
    }
    (parts, skipped)
}

/// The exported model; an error when any part is not ported (the planet designs only use ported parts).
pub fn build_model(s: &params::Sword) -> anyhow::Result<Vec<Part>> {
    let (parts, skipped) = build_parts(s, true);
    if !skipped.is_empty() {
        anyhow::bail!("bladegen features not ported: {}", skipped.join(", "));
    }
    Ok(parts)
}

/// (min y, max y) of the whole model in bladegen units.
pub fn model_y_extent(s: &params::Sword) -> (f64, f64) {
    let mut lo = f64::INFINITY;
    let mut hi = f64::NEG_INFINITY;
    for p in build_parts(s, false).0 {
        let (a, b) = geom::world_bbox(&p.mesh, &p.matrix);
        lo = lo.min(a[1]);
        hi = hi.max(b[1]);
    }
    (lo, hi)
}

/// SW1's monument transform (`monumentTransform`): turn pi about +Z (tip down), scale so the blade is `height_m`
/// long, and move the blade's centre line at `y = L (1 - sink)` to the origin. (scale, translation).
pub fn monument(b: &params::Blade, height_m: f64, sink: f64) -> (f64, [f64; 3]) {
    let l = geom::jmax(0.01, b.length);
    let sink = sink.clamp(0.0, 0.6);
    let scale = geom::jmax(1e-6, height_m) / l;
    let y_ground = l * (1.0 - sink);
    let t_ground = y_ground / l;
    let x_ground = blade::bend_offset_x(b, y_ground, l) + blade::waviness_at(b, t_ground).0;
    (scale, [x_ground * scale, y_ground * scale, 0.0])
}
