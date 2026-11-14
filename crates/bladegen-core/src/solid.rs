//! SW12's shared builders: a blade "sheet" (rows x 13 columns x front/back of points on the blade's own surface,
//! [`crate::blade::Section`]) with its faces, and glowing bands laid on it, and flat-shaded prisms for the shear-gate.
//! Everything is computed in f64 and stored as f32 once; no platform maths (libm through `geom`), no hashing of
//! floats, fixed loop orders: the same bytes on every target.
use crate::blade::{glow_mask_at, Section, COLS};
use crate::geom::{jmax, Mesh};
use crate::params::Glow;

/// Points on the blade's surface: `rows` x (COLS + 1) x 2 (front = -Z, back = +Z), each with its station (s, t).
pub struct Sheet {
    pub rows: usize,
    pub pos: Vec<[f64; 3]>,
    pub st: Vec<(f64, f64)>,
}

impl Sheet {
    pub fn new(rows: usize) -> Sheet {
        let n = rows * (COLS + 1) * 2;
        Sheet { rows, pos: vec![[0.0; 3]; n], st: vec![(0.0, 0.0); n] }
    }

    pub fn at(&self, i: usize, j: usize, side: usize) -> usize {
        (i * (COLS + 1) + j) * 2 + side
    }

    /// Sets grid point (i, j) from the blade's section at (s, t).
    pub fn set(&mut self, sec: &Section, i: usize, j: usize, s: f64, t: f64) {
        let r = sec.row(t);
        self.set_row(sec, &r, i, j, s);
    }

    pub fn set_row(&mut self, sec: &Section, r: &crate::blade::Row, i: usize, j: usize, s: f64) {
        let (front, back) = sec.point(r, s);
        let (a, b) = (self.at(i, j, 0), self.at(i, j, 1));
        self.pos[a] = [front.0, r.y, front.1];
        self.pos[b] = [back.0, r.y, back.1];
        self.st[a] = (s, r.t);
        self.st[b] = (s, r.t);
    }

    /// Bilinear point at fractional grid coordinates (gi along the rows, gj across), split along the cell's diagonal
    /// as `buildBladeGlowGeometry` samples the grid; with its (s, t).
    pub fn sample(&self, gi: f64, gj: f64, side: usize) -> ([f64; 3], (f64, f64)) {
        let gi = gi.clamp(0.0, (self.rows - 1) as f64);
        let gj = gj.clamp(0.0, COLS as f64);
        let i0 = (gi.floor() as usize).min(self.rows - 2);
        let j0 = (gj.floor() as usize).min(COLS - 1);
        let bb = gi - i0 as f64;
        let a = gj - j0 as f64;
        let k = |i: usize, j: usize| self.at(i, j, side);
        let (k00, k01, k10, k11) = (k(i0, j0), k(i0, j0 + 1), k(i0 + 1, j0), k(i0 + 1, j0 + 1));
        let mix3 = |p00: [f64; 3], p01: [f64; 3], p10: [f64; 3], p11: [f64; 3]| {
            let mut out = [0.0; 3];
            for c in 0..3 {
                out[c] = if a >= bb {
                    p00[c] + a * (p01[c] - p00[c]) + bb * (p11[c] - p01[c])
                } else {
                    p00[c] + bb * (p10[c] - p00[c]) + a * (p11[c] - p10[c])
                };
            }
            out
        };
        let p = mix3(self.pos[k00], self.pos[k01], self.pos[k10], self.pos[k11]);
        let st = |q: usize| [self.st[q].0, self.st[q].1, 0.0];
        let s = mix3(st(k00), st(k01), st(k10), st(k11));
        (p, (s[0], s[1]))
    }
}

/// A mesh under construction: f64 positions (stored f32 at the end), uv = (s, t), and the faces.
#[derive(Default)]
pub struct Build {
    pub pos: Vec<[f64; 3]>,
    pub uv: Vec<(f64, f64)>,
    pub idx: Vec<u32>,
}

impl Build {
    pub fn vertex(&mut self, p: [f64; 3], uv: (f64, f64)) -> u32 {
        self.pos.push(p);
        self.uv.push(uv);
        (self.pos.len() - 1) as u32
    }

    pub fn tri(&mut self, a: u32, b: u32, c: u32) {
        self.idx.extend_from_slice(&[a, b, c]);
    }

    /// Copies sheet point k as a new vertex.
    pub fn copy_of(&mut self, sh: &Sheet, k: usize) -> u32 {
        self.vertex(sh.pos[k], sh.st[k])
    }

    /// Drops vertices no face uses (order kept), then the mesh: positions, uv, normals; COLOR_0 = the glow mask of
    /// each vertex's s when the glow is on (bladegen's `bladeGlowColors`).
    pub fn finish(self, glow: Option<&Glow>) -> Mesh {
        let n = self.pos.len();
        let mut used = vec![false; n];
        for &i in &self.idx {
            used[i as usize] = true;
        }
        let mut remap = vec![u32::MAX; n];
        let mut m = Mesh::default();
        let mut k = 0u32;
        for v in 0..n {
            if used[v] {
                remap[v] = k;
                k += 1;
                let p = self.pos[v];
                m.pos.extend_from_slice(&[p[0] as f32, p[1] as f32, p[2] as f32]);
                m.uv.extend_from_slice(&[self.uv[v].0 as f32, self.uv[v].1 as f32]);
                if let Some(g) = glow {
                    m.color.extend_from_slice(&[1.0, 1.0, 1.0, glow_mask_at(g, self.uv[v].0) as f32]);
                }
            }
        }
        m.idx = self.idx.iter().map(|&i| remap[i as usize]).collect();
        m.compute_vertex_normals();
        m
    }
}

/// The faces of one sheet as a closed solid, wound outward: the front and back over every cell `keep(i, j)` allows,
/// the two outer side walls (sharing the face vertices, like bladegen's blade), and the two end caps on their own
/// vertices (flat, crisp ends). `vbase` is where the sheet's points start in `out`.
pub fn sheet_faces(out: &mut Build, sh: &Sheet, vbase: u32, keep: &dyn Fn(usize, usize) -> bool, caps: [bool; 2]) {
    let v = |i: usize, j: usize, side: usize| vbase + sh.at(i, j, side) as u32;
    let rows = sh.rows;
    for i in 0..rows - 1 {
        for j in 0..COLS {
            if !keep(i, j) {
                continue;
            }
            let (f00, f01, f10, f11) = (v(i, j, 0), v(i, j + 1, 0), v(i + 1, j, 0), v(i + 1, j + 1, 0));
            let (b00, b01, b10, b11) = (v(i, j, 1), v(i, j + 1, 1), v(i + 1, j, 1), v(i + 1, j + 1, 1));
            out.idx.extend_from_slice(&[f00, f11, f01, f00, f10, f11]);
            out.idx.extend_from_slice(&[b00, b01, b11, b00, b11, b10]);
        }
        let (lf0, lb0, lf1, lb1) = (v(i, 0, 0), v(i, 0, 1), v(i + 1, 0, 0), v(i + 1, 0, 1));
        out.idx.extend_from_slice(&[lf0, lb0, lb1, lf0, lb1, lf1]);
        let (rf0, rb0, rf1, rb1) = (v(i, COLS, 0), v(i, COLS, 1), v(i + 1, COLS, 0), v(i + 1, COLS, 1));
        out.idx.extend_from_slice(&[rf0, rb1, rb0, rf0, rf1, rb1]);
    }
    if caps[0] {
        row_cap(out, sh, 0, 0, COLS, false);
    }
    if caps[1] {
        row_cap(out, sh, rows - 1, 0, COLS, true);
    }
}

/// A wall across row `i` between columns `j0..j1` on its own vertices: facing +Y (`up`) or -Y.
pub fn row_cap(out: &mut Build, sh: &Sheet, i: usize, j0: usize, j1: usize, up: bool) {
    let mut f = Vec::new();
    let mut b = Vec::new();
    for j in j0..=j1 {
        f.push(out.copy_of(sh, sh.at(i, j, 0)));
        b.push(out.copy_of(sh, sh.at(i, j, 1)));
    }
    for k in 0..j1 - j0 {
        let (f0, f1, b0, b1) = (f[k], f[k + 1], b[k], b[k + 1]);
        if up {
            out.idx.extend_from_slice(&[f0, b0, b1, f0, b1, f1]);
        } else {
            out.idx.extend_from_slice(&[f0, b1, b0, f0, f1, b1]);
        }
    }
}

/// A wall along column `j` between rows `i0..i1` on its own vertices: facing +X (`right`) or -X.
pub fn column_wall(out: &mut Build, sh: &Sheet, j: usize, i0: usize, i1: usize, right: bool) {
    let mut f = Vec::new();
    let mut b = Vec::new();
    for i in i0..=i1 {
        f.push(out.copy_of(sh, sh.at(i, j, 0)));
        b.push(out.copy_of(sh, sh.at(i, j, 1)));
    }
    for k in 0..i1 - i0 {
        let (f0, f1, b0, b1) = (f[k], f[k + 1], b[k], b[k + 1]);
        if right {
            out.idx.extend_from_slice(&[f0, b1, b0, f0, f1, b1]);
        } else {
            out.idx.extend_from_slice(&[f0, b0, b1, f0, b1, f1]);
        }
    }
}

/// Glowing bands laid on sheets, as bladegen's glow mesh is: each point is the surface point pushed out along the
/// front-to-back direction by `off`; normal = that direction; uv = (s, t); COLOR_0 = 1; faces wound outward.
pub struct Bands {
    pub off: f64,
    pos: Vec<[f64; 3]>,
    out: Vec<[f64; 3]>,
    uv: Vec<(f64, f64)>,
    idx: Vec<u32>,
}

impl Bands {
    pub fn new(off: f64) -> Bands {
        Bands { off, pos: Vec::new(), out: Vec::new(), uv: Vec::new(), idx: Vec::new() }
    }

    fn vertex(&mut self, sh: &Sheet, gi: f64, gj: f64, side: usize) -> u32 {
        let (p, st) = sh.sample(gi, gj, side);
        let (o, _) = sh.sample(gi, gj, 1 - side);
        let (mut dx, mut dy, mut dz) = (p[0] - o[0], p[1] - o[1], p[2] - o[2]);
        let len = (dx * dx + dy * dy + dz * dz).sqrt();
        if len > 1e-12 {
            dx /= len;
            dy /= len;
            dz /= len;
        } else {
            dx = 0.0;
            dy = 0.0;
            dz = if side == 0 { -1.0 } else { 1.0 };
        }
        self.pos.push([p[0] + dx * self.off, p[1] + dy * self.off, p[2] + dz * self.off]);
        self.out.push([dx, dy, dz]);
        self.uv.push(st);
        (self.pos.len() - 1) as u32
    }

    fn tri(&mut self, a: u32, b: u32, c: u32) {
        let (pa, pb, pc) = (self.pos[a as usize], self.pos[b as usize], self.pos[c as usize]);
        let (ux, uy, uz) = (pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
        let (vx, vy, vz) = (pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]);
        let (nx, ny, nz) = (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
        let area2 = nx * nx + ny * ny + nz * nz;
        if !(area2 > 1e-24) {
            return; // a corner's repeated inner point: no triangle
        }
        let o = self.out[a as usize];
        if nx * o[0] + ny * o[1] + nz * o[2] < 0.0 {
            self.idx.extend_from_slice(&[a, c, b]);
        } else {
            self.idx.extend_from_slice(&[a, b, c]);
        }
    }

    /// A band between two paths of grid coordinates (gi, gj) on one face: quad k joins pair k and pair k + 1.
    pub fn band(&mut self, sh: &Sheet, inner: &[(f64, f64)], outer: &[(f64, f64)], side: usize) {
        let mut prev: Option<(u32, u32)> = None;
        for (a, b) in inner.iter().zip(outer) {
            let p = self.vertex(sh, a.0, a.1, side);
            let q = self.vertex(sh, b.0, b.1, side);
            if let Some((p0, q0)) = prev {
                self.tri(p0, q0, q);
                self.tri(p0, q, p);
            }
            prev = Some((p, q));
        }
    }


    pub fn finish(self) -> Option<Mesh> {
        if self.idx.is_empty() {
            return None;
        }
        let mut m = Mesh::default();
        for k in 0..self.pos.len() {
            let (p, o, uv) = (self.pos[k], self.out[k], self.uv[k]);
            m.pos.extend_from_slice(&[p[0] as f32, p[1] as f32, p[2] as f32]);
            m.nrm.extend_from_slice(&[o[0] as f32, o[1] as f32, o[2] as f32]);
            m.uv.extend_from_slice(&[uv.0 as f32, uv.1 as f32]);
        }
        m.color = vec![1.0; self.pos.len() * 4];
        m.idx = self.idx;
        Some(m)
    }
}

/// bladegen's glow offset off the blade surface (`0.004 + 0.025 * thickness`).
pub fn glow_offset(thickness: Option<f64>) -> f64 {
    0.004 + 0.025 * thickness.unwrap_or(0.08)
}

/// The glow's edge strips on a sheet whose columns are `s(i, j)` across (bladegen's two strips of `edgeWidth`):
/// `col(i, s)` gives the fractional column of s on row i.
pub fn edge_strips(bands: &mut Bands, sh: &Sheet, ew: f64, col: &dyn Fn(usize, f64) -> f64) {
    if !(ew > 0.0) {
        return;
    }
    for side in 0..2 {
        for (s0, s1) in [(0.0, ew), (1.0 - ew, 1.0)] {
            let inner: Vec<(f64, f64)> = (0..sh.rows).map(|i| (i as f64, col(i, s0))).collect();
            let outer: Vec<(f64, f64)> = (0..sh.rows).map(|i| (i as f64, col(i, s1))).collect();
            bands.band(sh, &inner, &outer, side);
        }
    }
}

// ---------------------------------------------------------------- prisms (the shear-gate)

/// A simple polygon (counter-clockwise in X/Y) cut into triangles by ear clipping in a fixed order (the first ear
/// from the start of the remaining list), so the result never depends on the platform.
pub fn triangulate(poly: &[[f64; 2]]) -> Vec<[usize; 3]> {
    let cross = |a: [f64; 2], b: [f64; 2], c: [f64; 2]| (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    let mut rem: Vec<usize> = (0..poly.len()).collect();
    let mut out = Vec::new();
    while rem.len() > 3 {
        let n = rem.len();
        let mut cut = None;
        for i in 0..n {
            let (a, b, c) = (rem[(i + n - 1) % n], rem[i], rem[(i + 1) % n]);
            if cross(poly[a], poly[b], poly[c]) <= 1e-12 {
                continue;
            }
            let inside = rem.iter().any(|&p| {
                p != a
                    && p != b
                    && p != c
                    && cross(poly[a], poly[b], poly[p]) >= -1e-12
                    && cross(poly[b], poly[c], poly[p]) >= -1e-12
                    && cross(poly[c], poly[a], poly[p]) >= -1e-12
            });
            if !inside {
                cut = Some(i);
                out.push([a, b, c]);
                break;
            }
        }
        let i = cut.expect("triangulate: not a simple counter-clockwise polygon");
        rem.remove(i);
    }
    out.push([rem[0], rem[1], rem[2]]);
    out
}

/// Consecutive repeated points dropped (a zero chamfer), the closing one too.
pub fn dedup(poly: Vec<[f64; 2]>) -> Vec<[f64; 2]> {
    let mut out: Vec<[f64; 2]> = Vec::with_capacity(poly.len());
    for p in poly {
        if out.last().is_none_or(|q| (q[0] - p[0]).abs() > 1e-12 || (q[1] - p[1]).abs() > 1e-12) {
            out.push(p);
        }
    }
    while out.len() > 1 {
        let (f, l) = (out[0], out[out.len() - 1]);
        if (f[0] - l[0]).abs() > 1e-12 || (f[1] - l[1]).abs() > 1e-12 {
            break;
        }
        out.pop();
    }
    out
}

/// A prism: the polygon extruded between z = z0 and z = z1 (z0 < z1), flat-shaded (every face on its own vertices),
/// wound outward, appended to `m`; uv = (x, y) / `uv_scale`.
pub fn prism(m: &mut Build, poly: &[[f64; 2]], z0: f64, z1: f64, uv_scale: f64) {
    let tris = triangulate(poly);
    let k = jmax(1e-9, uv_scale);
    let n = poly.len();
    // front (+Z) and back (-Z) caps
    for (z, front) in [(z1, true), (z0, false)] {
        let base = m.pos.len() as u32;
        for p in poly {
            m.vertex([p[0], p[1], z], (p[0] / k, p[1] / k));
        }
        for t in &tris {
            let (a, b, c) = (base + t[0] as u32, base + t[1] as u32, base + t[2] as u32);
            if front {
                m.tri(a, b, c);
            } else {
                m.tri(a, c, b);
            }
        }
    }
    // the sides, one quad per edge
    for e in 0..n {
        let (a, b) = (poly[e], poly[(e + 1) % n]);
        let (ex, ey) = (b[0] - a[0], b[1] - a[1]);
        let len = (ex * ex + ey * ey).sqrt();
        let a0 = m.vertex([a[0], a[1], z0], (0.0, z0 / k));
        let b0 = m.vertex([b[0], b[1], z0], (len / k, z0 / k));
        let b1 = m.vertex([b[0], b[1], z1], (len / k, z1 / k));
        let a1 = m.vertex([a[0], a[1], z1], (0.0, z1 / k));
        m.tri(a0, b0, b1);
        m.tri(a0, b1, a1);
    }
}
