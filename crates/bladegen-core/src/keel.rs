//! SW12 window-keel (CX1 idea 1, CX2's first "keep"; `blade.aperture`): one long opening through the blade between
//! two rails, closing into a solid planted keel toward the tip, with a glowing lip round the opening on both faces.
//!
//! The blade is bladegen's own surface ([`crate::blade::Section`]): the same rows as the grid blade (`sweepSegments`),
//! and 13 columns per row, but the columns are laid out per row so that columns 4 and 8 sit exactly on the opening's
//! edges (4 across each rail, 4 across the opening). Inside the opening the middle cells are left out and the rails'
//! inner walls and the opening's two end walls close the solid on their own vertices (crisp edges); outside it the
//! same 13 columns are an ordinary blade. So every blade option (width profile, tip shape, bevel and cross-section,
//! serration, waves, curvature, twist, the glow mask) carries over, and the result is one closed, outward-wound solid
//! with no Boolean step.
//!
//! The opening: rows `ceil(start * segs)` to `floor(end * segs)`; its half width is `width * W / 2` times an envelope
//! that is 1 in the middle and falls to `point` at both ends over the shoulders (the tip side `shoulder` of the
//! opening's length, the guard side half of it; straight, or arched with `arch`), and never leaves a rail thinner
//! than `rail * W`. The glow mesh gets the edge strips (as bladegen's) and the lip; runes are not drawn on a
//! window-keel (their centre line is the opening).
use crate::blade::{sweep_segments, Section, COLS};
use crate::geom::{clamp, jmax, jmin, lerp, sin, Mesh};
use crate::params::{Aperture, Blade};
use crate::solid::{column_wall, edge_strips, glow_offset, row_cap, sheet_faces, Bands, Build, Sheet};
use std::f64::consts::PI;

/// Columns across each rail (and across the opening): 4 + 4 + 4 = [`COLS`].
pub const RAIL_COLS: usize = 4;

/// The window's parameters, defaulted and clamped.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Window {
    pub start: f64,
    pub end: f64,
    pub width: f64,
    pub shoulder: f64,
    pub point: f64,
    pub arch: f64,
    pub rail: f64,
    pub lip: f64,
}

impl Window {
    pub fn of(a: &Aperture) -> Window {
        let start = clamp(a.start.unwrap_or(0.2), 0.05, 0.6);
        Window {
            start,
            end: clamp(a.end.unwrap_or(0.66), start + 0.12, 0.92),
            width: clamp(a.width.unwrap_or(0.42), 0.05, 0.9),
            shoulder: clamp(a.shoulder.unwrap_or(0.22), 0.0, 0.45),
            point: clamp(a.point.unwrap_or(0.22), 0.02, 1.0),
            arch: clamp(a.arch.unwrap_or(0.0), 0.0, 1.0),
            rail: clamp(a.rail.unwrap_or(0.18), 0.04, 0.45),
            lip: clamp(a.lip.unwrap_or(0.2), 0.0, 0.6),
        }
    }
}

/// The laid-out blade: its sheet (every row of the blade), the opening's first and last rows, and each row's two
/// edge stations (s of columns 4 and 8).
pub struct Layout {
    pub sheet: Sheet,
    pub segs: usize,
    pub i0: usize,
    pub i1: usize,
    pub edges: Vec<(f64, f64)>,
    pub window: Window,
}

fn ramp(x: f64, arch: f64) -> f64 {
    let lin = clamp(x, 0.0, 1.0);
    lerp(lin, sin(lin * PI * 0.5), arch)
}

/// The opening's half-width envelope along it (u = 0 at its guard end, 1 at its tip end).
pub fn envelope(w: &Window, u: f64) -> f64 {
    let sb = w.shoulder;
    let sa = 0.5 * w.shoulder;
    let a = if sa > 0.0 { ramp(u / sa, w.arch) } else { 1.0 };
    let b = if sb > 0.0 { ramp((1.0 - u) / sb, w.arch) } else { 1.0 };
    w.point + (1.0 - w.point) * jmin(a, b)
}

/// Column `j`'s station across a row whose opening edges are at `sl` and `sr`.
pub fn column_s(j: usize, sl: f64, sr: f64) -> f64 {
    let k = RAIL_COLS as f64;
    if j <= RAIL_COLS {
        sl * (j as f64 / k)
    } else if j <= 2 * RAIL_COLS {
        sl + (sr - sl) * ((j - RAIL_COLS) as f64 / k)
    } else if j == COLS {
        1.0
    } else {
        sr + (1.0 - sr) * ((j - 2 * RAIL_COLS) as f64 / k)
    }
}

pub fn layout(b: &Blade) -> Layout {
    let window = Window::of(b.aperture.as_ref().expect("keel::layout: blade.aperture"));
    let sec = Section::new(b);
    let segs = sweep_segments(b);
    let w_base = sec.base_width();
    let mut i0 = ((window.start * segs as f64).ceil() as usize).clamp(1, segs - 3);
    let i1 = ((window.end * segs as f64).floor() as usize).clamp(i0 + 2, segs - 1);
    if i1 < i0 + 2 {
        i0 = i1 - 2;
    }
    let rows: Vec<_> = (0..=segs).map(|i| sec.row(i as f64 / segs as f64)).collect();
    // the opening's half width in x on its own rows, then held at the ends' values beyond them
    let half_of = |i: usize, target: f64| {
        let r = &rows[i];
        let local = jmin(r.bend - r.xl, r.xr - r.bend);
        let h = jmin(target, local - window.rail * w_base);
        jmin(jmax(h, 0.012 * w_base), 0.8 * local)
    };
    let span = (i1 - i0) as f64;
    let mut half = vec![0.0; segs + 1];
    for i in i0..=i1 {
        let u = (i - i0) as f64 / span;
        half[i] = half_of(i, 0.5 * window.width * w_base * envelope(&window, u));
    }
    for i in 0..i0 {
        half[i] = half_of(i, half[i0]);
    }
    for i in i1 + 1..=segs {
        half[i] = half_of(i, half[i1]);
    }
    let mut sheet = Sheet::new(segs + 1);
    let mut edges = Vec::with_capacity(segs + 1);
    for (i, r) in rows.iter().enumerate() {
        let wdt = jmax(1e-9, r.xr - r.xl);
        let sl = (r.bend - half[i] - r.xl) / wdt;
        let sr = (r.bend + half[i] - r.xl) / wdt;
        edges.push((sl, sr));
        for j in 0..=COLS {
            sheet.set_row(&sec, r, i, j, column_s(j, sl, sr));
        }
    }
    Layout { sheet, segs, i0, i1, edges, window }
}

/// The window-keel blade: one closed solid, wound outward, with normals, tangents, uv = (s, t) and the glow mask.
pub fn build_blade(b: &Blade) -> Mesh {
    let lay = layout(b);
    let (i0, i1) = (lay.i0, lay.i1);
    let mut out = Build::default();
    for k in 0..lay.sheet.pos.len() {
        out.copy_of(&lay.sheet, k);
    }
    let hole = |i: usize, j: usize| i >= i0 && i < i1 && j >= RAIL_COLS && j < 2 * RAIL_COLS;
    sheet_faces(&mut out, &lay.sheet, 0, &|i, j| !hole(i, j), [true, true]);
    // the left rail's inner wall faces +X into the opening, the right rail's -X; the end walls face into it
    column_wall(&mut out, &lay.sheet, RAIL_COLS, i0, i1, true);
    column_wall(&mut out, &lay.sheet, 2 * RAIL_COLS, i0, i1, false);
    row_cap(&mut out, &lay.sheet, i0, RAIL_COLS, 2 * RAIL_COLS, true);
    row_cap(&mut out, &lay.sheet, i1, RAIL_COLS, 2 * RAIL_COLS, false);
    let glow = b.glow.as_ref().filter(|g| g.enabled != Some(false));
    let mut m = out.finish(glow);
    crate::blade::compute_blade_tangents(&mut m);
    m
}

/// The window-keel's glow mesh: bladegen's edge strips on the outer edges and the lip round the opening on both
/// faces. `None` when the glow is off or draws nothing.
pub fn build_glow(b: &Blade) -> Option<Mesh> {
    let g = b.glow.as_ref().filter(|g| g.enabled != Some(false))?;
    let lay = layout(b);
    let sh = &lay.sheet;
    let mut bands = Bands::new(glow_offset(b.thickness));
    let k = RAIL_COLS as f64;
    // s -> fractional column on row i (the rails' columns are spread over [0, sl] and [sr, 1])
    let col = |i: usize, s: f64| {
        let (sl, sr) = lay.edges[i];
        if s <= sl {
            k * s / jmax(1e-9, sl)
        } else if s >= sr {
            2.0 * k + k * (s - sr) / jmax(1e-9, 1.0 - sr)
        } else {
            k + k * (s - sl) / jmax(1e-9, sr - sl)
        }
    };
    edge_strips(&mut bands, sh, g.edge_width.unwrap_or(0.0), &col);
    let lip = lay.window.lip;
    if lip > 0.0 {
        let (i0, i1) = (lay.i0 as f64, lay.i1 as f64);
        let (jl, jr) = (k, 2.0 * k);
        let (ol, or) = (k - k * lip, 2.0 * k + k * lip);
        // the lip's width along the blade at the ends, in rows: the rail's lip width at that row
        let rows_of = |i: usize| {
            let (sl, _) = lay.edges[i];
            let p = sh.pos[sh.at(i, 0, 0)];
            let q = sh.pos[sh.at(i, COLS, 0)];
            let w = (q[0] - p[0]).abs();
            let dy = lay.sheet.pos[sh.at(1, 0, 0)][1] - lay.sheet.pos[sh.at(0, 0, 0)][1];
            clamp(lip * sl * w / jmax(1e-9, dy.abs()), 0.5, 6.0)
        };
        let (d0, d1) = (jmin(rows_of(lay.i0), i0 - 0.25), jmin(rows_of(lay.i1), (lay.segs as f64 - 0.25) - i1));
        let mut inner = Vec::new();
        let mut outer = Vec::new();
        let mut push = |a: (f64, f64), b: (f64, f64)| {
            inner.push(a);
            outer.push(b);
        };
        for i in lay.i0..=lay.i1 {
            push((i as f64, jl), (i as f64, ol));
        }
        for j in RAIL_COLS..=2 * RAIL_COLS {
            let f = (j - RAIL_COLS) as f64 / k;
            push((i1, j as f64), (i1 + d1, lerp(ol, or, f)));
        }
        for i in (lay.i0..=lay.i1).rev() {
            push((i as f64, jr), (i as f64, or));
        }
        for j in (RAIL_COLS..=2 * RAIL_COLS).rev() {
            let f = (j - RAIL_COLS) as f64 / k;
            push((i0, j as f64), (i0 - d0, lerp(ol, or, f)));
        }
        push((i0, jl), (i0, ol));
        for side in 0..2 {
            bands.band(sh, &inner, &outer, side);
        }
    }
    bands.finish()
}
