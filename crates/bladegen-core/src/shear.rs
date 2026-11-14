//! SW12 shear-gate guard (CX1 idea 6, CX2 "keep"; `guard.style = "shear"`, `guard.shear`): a deep hub round the
//! blade's root with a glowing throat on both faces, and two thick stepped jaws, one each side, set point-symmetric
//! like the blades of a pair of shears: the right jaw sits toward the tip with its tooth rising toward the tip, the
//! left one toward the grip with its tooth toward the grip.
//!
//! Sized from the blade like SW10's monument guards: heights and the hub's width from the base width (W), depths from
//! the blade thickness (T), the span from `guard.width`; placed the same way (the hub's blade-side face on the guard
//! line, tilted about Z). Every part is a flat-shaded prism (chamfered polygon, ear-clipped in a fixed order) in one
//! mesh: hub, right jaw, left jaw. The jaws' roots run into the hub (a bearing, the overlap is intended). The throat
//! is a separate glowing mesh (two thin plates on the hub's faces), drawn with the glow material.
use crate::geom::{clamp, compose, jmax, jmin, Mat4, Mesh};
use crate::params::{Blade, Guard, GuardShear};
use crate::solid::{dedup, prism, Build};

/// The shear-gate's parameters, defaulted and clamped.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Gate {
    pub height: f64,
    pub depth: f64,
    pub block: f64,
    pub tooth: f64,
    pub at: f64,
    pub span: f64,
    pub stagger: f64,
    pub chamfer: f64,
    pub throat: f64,
}

impl Gate {
    pub fn of(g: &GuardShear) -> Gate {
        Gate {
            height: clamp(g.height.unwrap_or(0.46), 0.1, 1.2),
            depth: clamp(g.depth.unwrap_or(2.6), 0.5, 6.0),
            block: clamp(g.block.unwrap_or(0.6), 0.2, 1.2),
            tooth: clamp(g.tooth.unwrap_or(0.95), 0.0, 2.0),
            at: clamp(g.at.unwrap_or(0.58), 0.1, 0.9),
            span: clamp(g.span.unwrap_or(0.3), 0.05, 0.6),
            stagger: clamp(g.stagger.unwrap_or(0.18), 0.0, 0.8),
            chamfer: clamp(g.chamfer.unwrap_or(0.18), 0.0, 0.45),
            throat: clamp(g.throat.unwrap_or(0.62), 0.0, 0.95),
        }
    }
}

/// The defaults the family recipe and the web app's validation write back (`GuardShear` in full, in field order).
pub fn defaults() -> GuardShear {
    GuardShear {
        height: Some(0.46),
        depth: Some(2.6),
        block: Some(0.6),
        tooth: Some(0.95),
        at: Some(0.58),
        span: Some(0.3),
        stagger: Some(0.18),
        chamfer: Some(0.18),
        throat: Some(0.62),
    }
}

/// The shear-gate in guard-local space (the hub's centre at the origin, +Y toward the blade): the metal mesh, the
/// throat's glowing mesh (or none) and the hub's half height (the placement's `halfHeight`).
pub fn geometry(g: &Guard, blade: &Blade) -> (Mesh, Option<Mesh>, f64) {
    let p = Gate::of(&g.shear.clone().unwrap_or_default());
    let bw = blade.base_width;
    let bt = jmax(blade.thickness_left.unwrap_or(0.08), blade.thickness_right.unwrap_or(0.08));
    let half = jmax(0.1, g.width * 0.5);
    let hb = 0.5 * p.height * bw;
    let ys = 0.5 * p.stagger * bw;
    let bl = p.block * bw;
    let hy = hb + ys + 0.08 * bw;
    let hz_jaw = 0.5 * p.depth * bt;
    let hz_hub = 1.15 * hz_jaw;
    let mut m = Build::default();
    // the hub: a chamfered block
    let ch = 0.22 * jmin(bl, hy);
    let hub = dedup(vec![
        [-bl + ch, -hy],
        [bl - ch, -hy],
        [bl, -hy + ch],
        [bl, hy - ch],
        [bl - ch, hy],
        [-bl + ch, hy],
        [-bl, hy - ch],
        [-bl, -hy + ch],
    ]);
    prism(&mut m, &hub, -hz_hub, hz_hub, bw);
    // the right jaw: a bar from inside the hub to the span's end, a tooth rising toward +Y; chamfered corners
    let x0 = 0.55 * bl;
    let x1 = jmax(half, 1.3 * bl);
    let arm = x1 - x0;
    let c = jmin(p.chamfer * 2.0 * hb, 0.45 * jmin(2.0 * hb, arm));
    let ht = p.tooth * 2.0 * hb;
    let mut xs0 = x0 + (p.at - 0.5 * p.span) * arm;
    let mut xs1 = x0 + (p.at + 0.5 * p.span) * arm;
    xs0 = jmax(xs0, bl + 0.04 * arm);
    xs1 = jmin(xs1, x1 - c - 0.04 * arm);
    let jaw: Vec<[f64; 2]> = if ht > 0.0 && xs1 - xs0 > 0.02 * arm {
        let c2 = jmin(c, jmin(0.45 * (xs1 - xs0), 0.45 * ht));
        vec![
            [x0, -hb],
            [x1 - c, -hb],
            [x1, -hb + c],
            [x1, hb - c],
            [x1 - c, hb],
            [xs1, hb],
            [xs1, hb + ht - c2],
            [xs1 - c2, hb + ht],
            [xs0 + c2, hb + ht],
            [xs0, hb + ht - c2],
            [xs0, hb],
            [x0, hb],
        ]
    } else {
        vec![[x0, -hb], [x1 - c, -hb], [x1, -hb + c], [x1, hb - c], [x1 - c, hb], [x0, hb]]
    };
    let right: Vec<[f64; 2]> = dedup(jaw.iter().map(|q| [q[0], q[1] + ys]).collect());
    // the left jaw: the right one turned half a turn about Z (point symmetric, still counter-clockwise)
    let left: Vec<[f64; 2]> = right.iter().map(|q| [-q[0], -q[1]]).collect();
    prism(&mut m, &right, -hz_jaw, hz_jaw, bw);
    prism(&mut m, &left, -hz_jaw, hz_jaw, bw);
    let metal = m.finish(None);
    // the throat: a tall hexagonal slot on each face of the hub, a thin plate standing just proud of it
    let throat = if p.throat > 0.0 {
        let th = p.throat * 2.0 * hy;
        let tw = jmin(0.36 * bl, 0.5 * th);
        let slot = dedup(vec![
            [0.0, -0.5 * th],
            [0.5 * tw, -0.5 * th + 0.5 * tw],
            [0.5 * tw, 0.5 * th - 0.5 * tw],
            [0.0, 0.5 * th],
            [-0.5 * tw, 0.5 * th - 0.5 * tw],
            [-0.5 * tw, -0.5 * th + 0.5 * tw],
        ]);
        let plate = 0.04 * hz_hub;
        let mut t = Build::default();
        prism(&mut t, &slot, hz_hub - 0.5 * plate, hz_hub + plate, bw);
        prism(&mut t, &slot, -hz_hub - plate, -hz_hub + 0.5 * plate, bw);
        let mut tm = t.finish(None);
        tm.color = vec![1.0; tm.vertex_count() * 4];
        Some(tm)
    } else {
        None
    };
    (metal, throat, hy)
}

/// The shear-gate placed like the monument guards (`buildMonumentGuardGeometry`'s placement): the hub's blade-side
/// face on the guard line (`blade_base_y + heightOffset`), tilted about Z. (metal, throat, matrix).
pub fn build_guard(g: &Guard, blade: &Blade, blade_base_y: f64) -> (Mesh, Option<Mesh>, Mat4) {
    let (m, t, hy) = geometry(g, blade);
    let target_top_y = blade_base_y + g.height_offset.unwrap_or(0.0);
    (m, t, compose([0.0, target_top_y - hy, 0.0], [0.0, 0.0, g.tilt.unwrap_or(0.0)], [1.0; 3]))
}
