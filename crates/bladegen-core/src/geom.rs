//! Three.js r180 primitives as bladegen uses them, ported 1:1 (SW2). Attributes are stored as f32 exactly as a
//! `Float32BufferAttribute` stores them, and every derived quantity (normals, bounding boxes) is computed from the
//! stored f32 values in f64, the way Three reads them back. Transcendentals use the `libm` crate (an fdlibm port,
//! the same lineage as V8's `ieee754` math), so the output can match bladegen under Node bit for bit.

/// JS `Math.sin` / `cos` / `pow` / `tan` / `atan2` stand-ins.
#[inline]
pub fn sin(x: f64) -> f64 {
    libm::sin(x)
}
#[inline]
pub fn cos(x: f64) -> f64 {
    libm::cos(x)
}
#[inline]
pub fn tan(x: f64) -> f64 {
    libm::tan(x)
}
#[inline]
pub fn atan2(y: f64, x: f64) -> f64 {
    libm::atan2(y, x)
}
#[inline]
pub fn pow(x: f64, y: f64) -> f64 {
    libm::pow(x, y)
}
#[inline]
pub fn cbrt(x: f64) -> f64 {
    libm::cbrt(x)
}
/// JS `Math.max(a, b)` for finite inputs.
#[inline]
pub fn jmax(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else if a > b {
        a
    } else {
        b
    }
}
#[inline]
pub fn jmin(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else if a < b {
        a
    } else {
        b
    }
}
/// `THREE.MathUtils.clamp`: `Math.max(min, Math.min(max, v))`.
#[inline]
pub fn clamp(v: f64, lo: f64, hi: f64) -> f64 {
    jmax(lo, jmin(hi, v))
}
/// `THREE.MathUtils.lerp`: `(1 - t) * x + t * y`.
#[inline]
pub fn lerp(x: f64, y: f64, t: f64) -> f64 {
    (1.0 - t) * x + t * y
}
/// JS `Math.round` (half rounds up toward +inf).
#[inline]
pub fn jround(x: f64) -> f64 {
    (x + 0.5).floor()
}
/// JS `Math.sign`.
#[inline]
pub fn jsign(x: f64) -> f64 {
    if x > 0.0 {
        1.0
    } else if x < 0.0 {
        -1.0
    } else {
        x
    }
}

/// V8's `Math.hypot` (Torque `MathHypot`): max-abs scaling plus a Kahan-compensated sum of squares, then
/// `sqrt(sum) * max`. Not the same rounding as C's `hypot`.
pub fn v8_hypot(xs: &[f64]) -> f64 {
    let mut max: f64 = 0.0;
    let mut nan = false;
    for &x in xs {
        let a = x.abs();
        if a == f64::INFINITY {
            return f64::INFINITY;
        }
        if a.is_nan() {
            nan = true;
        } else if a > max {
            max = a;
        }
    }
    if nan {
        return f64::NAN;
    }
    if max == 0.0 {
        return 0.0;
    }
    let (mut sum, mut comp) = (0.0f64, 0.0f64);
    for &x in xs {
        let n = x.abs() / max;
        let summand = n * n - comp;
        let prelim = sum + summand;
        comp = (prelim - sum) - summand;
        sum = prelim;
    }
    sum.sqrt() * max
}

/// `Vector3.normalize()`: `divideScalar(length() || 1)` = multiply by `1 / len`.
#[inline]
pub fn normalize3(x: f64, y: f64, z: f64) -> (f64, f64, f64) {
    let l = (x * x + y * y + z * z).sqrt();
    let l = if l == 0.0 || l.is_nan() { 1.0 } else { l };
    let inv = 1.0 / l;
    (x * inv, y * inv, z * inv)
}

/// An indexed triangle mesh as a Three `BufferGeometry` holds it.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Mesh {
    pub pos: Vec<f32>,
    pub nrm: Vec<f32>,
    pub idx: Vec<u32>,
    /// `uv` (2 per vertex), empty when the geometry has none.
    pub uv: Vec<f32>,
    /// `color` (RGBA, 4 per vertex), empty when none.
    pub color: Vec<f32>,
    /// `tangent` (xyzw, 4 per vertex), empty when none.
    pub tangent: Vec<f32>,
}

impl Mesh {
    pub fn vertex_count(&self) -> usize {
        self.pos.len() / 3
    }

    fn push_v(&mut self, x: f64, y: f64, z: f64) {
        self.pos.extend_from_slice(&[x as f32, y as f32, z as f32]);
    }
    fn push_n(&mut self, x: f64, y: f64, z: f64) {
        self.nrm.extend_from_slice(&[x as f32, y as f32, z as f32]);
    }
    fn push_uv(&mut self, u: f64, v: f64) {
        self.uv.extend_from_slice(&[u as f32, v as f32]);
    }

    /// `BufferGeometry.computeVertexNormals()` for indexed geometry, with the f32 round trip of every partial sum
    /// (the normal attribute is a Float32Array that is read, added to and written back per triangle).
    pub fn compute_vertex_normals(&mut self) {
        let n = self.vertex_count();
        let mut nr = vec![0f32; n * 3];
        let p = |i: usize| (self.pos[i * 3] as f64, self.pos[i * 3 + 1] as f64, self.pos[i * 3 + 2] as f64);
        for tri in self.idx.chunks_exact(3) {
            let (va, vb, vc) = (tri[0] as usize, tri[1] as usize, tri[2] as usize);
            let (ax, ay, az) = p(va);
            let (bx, by, bz) = p(vb);
            let (cx, cy, cz) = p(vc);
            // cb = c - b; ab = a - b; cb.cross(ab)
            let (cbx, cby, cbz) = (cx - bx, cy - by, cz - bz);
            let (abx, aby, abz) = (ax - bx, ay - by, az - bz);
            let crx = cby * abz - cbz * aby;
            let cry = cbz * abx - cbx * abz;
            let crz = cbx * aby - cby * abx;
            for v in [va, vb, vc] {
                let k = v * 3;
                nr[k] = (nr[k] as f64 + crx) as f32;
                nr[k + 1] = (nr[k + 1] as f64 + cry) as f32;
                nr[k + 2] = (nr[k + 2] as f64 + crz) as f32;
            }
        }
        for v in 0..n {
            let k = v * 3;
            let (x, y, z) = normalize3(nr[k] as f64, nr[k + 1] as f64, nr[k + 2] as f64);
            nr[k] = x as f32;
            nr[k + 1] = y as f32;
            nr[k + 2] = z as f32;
        }
        self.nrm = nr;
    }

    /// `computeBoundingBox()` over the stored positions: (min, max).
    pub fn bbox(&self) -> ([f64; 3], [f64; 3]) {
        let mut lo = [f64::INFINITY; 3];
        let mut hi = [f64::NEG_INFINITY; 3];
        for v in self.pos.chunks_exact(3) {
            for k in 0..3 {
                lo[k] = lo[k].min(v[k] as f64);
                hi[k] = hi[k].max(v[k] as f64);
            }
        }
        (lo, hi)
    }
}

/// Column-major 4x4 (Three's `Matrix4.elements`).
pub type Mat4 = [f64; 16];

pub const IDENTITY: Mat4 = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];

/// `Object3D.matrix` from position, Euler XYZ rotation and scale (`Quaternion.setFromEuler` + `Matrix4.compose`).
pub fn compose(p: [f64; 3], euler_xyz: [f64; 3], s: [f64; 3]) -> Mat4 {
    let (c1, c2, c3) = (cos(euler_xyz[0] / 2.0), cos(euler_xyz[1] / 2.0), cos(euler_xyz[2] / 2.0));
    let (s1, s2, s3) = (sin(euler_xyz[0] / 2.0), sin(euler_xyz[1] / 2.0), sin(euler_xyz[2] / 2.0));
    let x = s1 * c2 * c3 + c1 * s2 * s3;
    let y = c1 * s2 * c3 - s1 * c2 * s3;
    let z = c1 * c2 * s3 + s1 * s2 * c3;
    let w = c1 * c2 * c3 - s1 * s2 * s3;
    let (x2, y2, z2) = (x + x, y + y, z + z);
    let (xx, xy, xz) = (x * x2, x * y2, x * z2);
    let (yy, yz, zz) = (y * y2, y * z2, z * z2);
    let (wx, wy, wz) = (w * x2, w * y2, w * z2);
    let (sx, sy, sz) = (s[0], s[1], s[2]);
    [
        (1.0 - (yy + zz)) * sx,
        (xy + wz) * sx,
        (xz - wy) * sx,
        0.0,
        (xy - wz) * sy,
        (1.0 - (xx + zz)) * sy,
        (yz + wx) * sy,
        0.0,
        (xz + wy) * sz,
        (yz - wx) * sz,
        (1.0 - (xx + yy)) * sz,
        0.0,
        p[0],
        p[1],
        p[2],
        1.0,
    ]
}

/// `a * b` (Three's `multiplyMatrices`).
pub fn mul(a: &Mat4, b: &Mat4) -> Mat4 {
    let mut o = [0.0; 16];
    for c in 0..4 {
        for r in 0..4 {
            o[c * 4 + r] = a[r] * b[c * 4]
                + a[4 + r] * b[c * 4 + 1]
                + a[8 + r] * b[c * 4 + 2]
                + a[12 + r] * b[c * 4 + 3];
        }
    }
    o
}

pub fn apply_point(m: &Mat4, p: [f64; 3]) -> [f64; 3] {
    let w = 1.0 / (m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]);
    [
        (m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) * w,
        (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) * w,
        (m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]) * w,
    ]
}

/// `Box3.setFromObject(mesh)` (not precise): the geometry's bounding box corners through the world matrix.
pub fn world_bbox(mesh: &Mesh, m: &Mat4) -> ([f64; 3], [f64; 3]) {
    let (lo, hi) = mesh.bbox();
    let mut wlo = [f64::INFINITY; 3];
    let mut whi = [f64::NEG_INFINITY; 3];
    for k in 0..8 {
        let c = [
            if k & 1 == 0 { lo[0] } else { hi[0] },
            if k & 2 == 0 { lo[1] } else { hi[1] },
            if k & 4 == 0 { lo[2] } else { hi[2] },
        ];
        let w = apply_point(m, c);
        for a in 0..3 {
            wlo[a] = wlo[a].min(w[a]);
            whi[a] = whi[a].max(w[a]);
        }
    }
    (wlo, whi)
}

/// `new THREE.BoxGeometry(w, h, d)` with one segment per side.
pub fn box_geometry(width: f64, height: f64, depth: f64) -> Mesh {
    let mut m = Mesh::default();
    let mut nverts = 0u32;
    // (u, v, w axes, udir, vdir, width, height, depth)
    let planes: [([usize; 3], f64, f64, f64, f64, f64); 6] = [
        ([2, 1, 0], -1.0, -1.0, depth, height, width),
        ([2, 1, 0], 1.0, -1.0, depth, height, -width),
        ([0, 2, 1], 1.0, 1.0, width, depth, height),
        ([0, 2, 1], 1.0, -1.0, width, depth, -height),
        ([0, 1, 2], 1.0, -1.0, width, height, depth),
        ([0, 1, 2], -1.0, -1.0, width, height, -depth),
    ];
    for (axes, udir, vdir, pw, ph, pd) in planes {
        let (gx, gy) = (1usize, 1usize);
        let (sw, sh) = (pw / gx as f64, ph / gy as f64);
        let (wh, hh, dh) = (pw / 2.0, ph / 2.0, pd / 2.0);
        for iy in 0..=gy {
            let y = iy as f64 * sh - hh;
            for ix in 0..=gx {
                let x = ix as f64 * sw - wh;
                let mut v = [0.0; 3];
                v[axes[0]] = x * udir;
                v[axes[1]] = y * vdir;
                v[axes[2]] = dh;
                m.push_v(v[0], v[1], v[2]);
                let mut n = [0.0; 3];
                n[axes[2]] = if pd > 0.0 { 1.0 } else { -1.0 };
                m.push_n(n[0], n[1], n[2]);
                m.push_uv(ix as f64 / gx as f64, 1.0 - iy as f64 / gy as f64);
            }
        }
        let gx1 = gx as u32 + 1;
        for iy in 0..gy as u32 {
            for ix in 0..gx as u32 {
                let a = nverts + ix + gx1 * iy;
                let b = nverts + ix + gx1 * (iy + 1);
                let c = nverts + (ix + 1) + gx1 * (iy + 1);
                let d = nverts + (ix + 1) + gx1 * iy;
                m.idx.extend_from_slice(&[a, b, d, b, c, d]);
            }
        }
        nverts += ((gx + 1) * (gy + 1)) as u32;
    }
    m
}

/// `new THREE.SphereGeometry(radius, widthSegments, heightSegments)` (full sphere).
pub fn sphere_geometry(radius: f64, width_segments: usize, height_segments: usize) -> Mesh {
    let ws = width_segments.max(3);
    let hs = height_segments.max(2);
    let (phi_len, theta_len) = (std::f64::consts::PI * 2.0, std::f64::consts::PI);
    let mut m = Mesh::default();
    let mut grid = Vec::new();
    let mut index = 0u32;
    for iy in 0..=hs {
        let mut row = Vec::new();
        let v = iy as f64 / hs as f64;
        let u_offset = if iy == 0 {
            0.5 / ws as f64
        } else if iy == hs {
            -0.5 / ws as f64
        } else {
            0.0
        };
        for ix in 0..=ws {
            let u = ix as f64 / ws as f64;
            let x = -radius * cos(u * phi_len) * sin(v * theta_len);
            let y = radius * cos(v * theta_len);
            let z = radius * sin(u * phi_len) * sin(v * theta_len);
            m.push_v(x, y, z);
            let (nx, ny, nz) = normalize3(x, y, z);
            m.push_n(nx, ny, nz);
            m.push_uv(u + u_offset, 1.0 - v);
            row.push(index);
            index += 1;
        }
        grid.push(row);
    }
    for iy in 0..hs {
        for ix in 0..ws {
            let a = grid[iy][ix + 1];
            let b = grid[iy][ix];
            let c = grid[iy + 1][ix];
            let d = grid[iy + 1][ix + 1];
            if iy != 0 {
                m.idx.extend_from_slice(&[a, b, d]);
            }
            if iy != hs - 1 {
                m.idx.extend_from_slice(&[b, c, d]);
            }
        }
    }
    m
}

/// `new THREE.CylinderGeometry(rTop, rBottom, height, radialSegments)` (one height segment, closed).
pub fn cylinder_geometry(radius_top: f64, radius_bottom: f64, height: f64, radial_segments: usize) -> Mesh {
    let rs = radial_segments;
    let hseg = 1usize;
    let theta_len = std::f64::consts::PI * 2.0;
    let half = height / 2.0;
    let mut m = Mesh::default();
    let mut index = 0u32;
    let mut rows: Vec<Vec<u32>> = Vec::new();
    let slope = (radius_bottom - radius_top) / height;
    for y in 0..=hseg {
        let mut row = Vec::new();
        let v = y as f64 / hseg as f64;
        let radius = v * (radius_bottom - radius_top) + radius_top;
        for x in 0..=rs {
            let u = x as f64 / rs as f64;
            let theta = u * theta_len;
            let (st, ct) = (sin(theta), cos(theta));
            m.push_v(radius * st, -v * height + half, radius * ct);
            let (nx, ny, nz) = normalize3(st, slope, ct);
            m.push_n(nx, ny, nz);
            m.push_uv(u, 1.0 - v);
            row.push(index);
            index += 1;
        }
        rows.push(row);
    }
    for x in 0..rs {
        for y in 0..hseg {
            let a = rows[y][x];
            let b = rows[y + 1][x];
            let c = rows[y + 1][x + 1];
            let d = rows[y][x + 1];
            if radius_top > 0.0 || y != 0 {
                m.idx.extend_from_slice(&[a, b, d]);
            }
            if radius_bottom > 0.0 || y != hseg - 1 {
                m.idx.extend_from_slice(&[b, c, d]);
            }
        }
    }
    let cap = |m: &mut Mesh, index: &mut u32, top: bool| {
        let center_start = *index;
        let radius = if top { radius_top } else { radius_bottom };
        let sign = if top { 1.0 } else { -1.0 };
        for _ in 1..=rs {
            m.push_v(0.0, half * sign, 0.0);
            m.push_n(0.0, sign, 0.0);
            m.push_uv(0.5, 0.5);
            *index += 1;
        }
        let center_end = *index;
        for x in 0..=rs {
            let u = x as f64 / rs as f64;
            let theta = u * theta_len;
            let (ct, st) = (cos(theta), sin(theta));
            m.push_v(radius * st, half * sign, radius * ct);
            m.push_n(0.0, sign, 0.0);
            m.push_uv(ct * 0.5 + 0.5, st * 0.5 * sign + 0.5);
            *index += 1;
        }
        for x in 0..rs as u32 {
            let c = center_start + x;
            let i = center_end + x;
            if top {
                m.idx.extend_from_slice(&[i, i + 1, c]);
            } else {
                m.idx.extend_from_slice(&[i + 1, i, c]);
            }
        }
    };
    if radius_top > 0.0 {
        cap(&mut m, &mut index, true);
    }
    if radius_bottom > 0.0 {
        cap(&mut m, &mut index, false);
    }
    m
}

/// `new THREE.ConeGeometry(radius, height, radialSegments)` = a cylinder with a zero top radius.
pub fn cone_geometry(radius: f64, height: f64, radial_segments: usize) -> Mesh {
    cylinder_geometry(0.0, radius, height, radial_segments)
}

/// `new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments)` (full arc).
pub fn torus_geometry(radius: f64, tube: f64, radial_segments: usize, tubular_segments: usize) -> Mesh {
    let arc = std::f64::consts::PI * 2.0;
    let mut m = Mesh::default();
    for j in 0..=radial_segments {
        for i in 0..=tubular_segments {
            let u = i as f64 / tubular_segments as f64 * arc;
            let v = j as f64 / radial_segments as f64 * std::f64::consts::PI * 2.0;
            let x = (radius + tube * cos(v)) * cos(u);
            let y = (radius + tube * cos(v)) * sin(u);
            let z = tube * sin(v);
            m.push_v(x, y, z);
            let (cx, cy) = (radius * cos(u), radius * sin(u));
            let (nx, ny, nz) = normalize3(x - cx, y - cy, z);
            m.push_n(nx, ny, nz);
            m.push_uv(i as f64 / tubular_segments as f64, j as f64 / radial_segments as f64);
        }
    }
    let ts = tubular_segments as u32;
    for j in 1..=radial_segments as u32 {
        for i in 1..=ts {
            let a = (ts + 1) * j + i - 1;
            let b = (ts + 1) * (j - 1) + i - 1;
            let c = (ts + 1) * (j - 1) + i;
            let d = (ts + 1) * j + i;
            m.idx.extend_from_slice(&[a, b, d, b, c, d]);
        }
    }
    m
}

/// `new THREE.LatheGeometry(points, segments)` (full turn). `points` are (x = radius, y).
pub fn lathe_geometry(points: &[(f64, f64)], segments: usize) -> Mesh {
    let np = points.len();
    let phi_len = std::f64::consts::PI * 2.0;
    let inv = 1.0 / segments as f64;
    let mut init = Vec::with_capacity(np * 3);
    let mut prev = (0.0, 0.0, 0.0);
    for j in 0..np {
        if j == 0 {
            let dx = points[j + 1].0 - points[j].0;
            let dy = points[j + 1].1 - points[j].1;
            let n = (dy * 1.0, -dx, dy * 0.0);
            prev = n;
            let (x, y, z) = normalize3(n.0, n.1, n.2);
            init.extend_from_slice(&[x, y, z]);
        } else if j == np - 1 {
            init.extend_from_slice(&[prev.0, prev.1, prev.2]);
        } else {
            let dx = points[j + 1].0 - points[j].0;
            let dy = points[j + 1].1 - points[j].1;
            let cur = (dy * 1.0, -dx, dy * 0.0);
            let (x, y, z) = normalize3(cur.0 + prev.0, cur.1 + prev.1, cur.2 + prev.2);
            init.extend_from_slice(&[x, y, z]);
            prev = cur;
        }
    }
    let mut m = Mesh::default();
    for i in 0..=segments {
        let phi = i as f64 * inv * phi_len;
        let (s, c) = (sin(phi), cos(phi));
        for (j, p) in points.iter().enumerate() {
            m.push_v(p.0 * s, p.1, p.0 * c);
            m.push_uv(i as f64 / segments as f64, j as f64 / (np - 1) as f64);
            m.push_n(init[3 * j] * s, init[3 * j + 1], init[3 * j] * c);
        }
    }
    let npu = np as u32;
    for i in 0..segments as u32 {
        for j in 0..npu - 1 {
            let base = j + i * npu;
            let (a, b, c, d) = (base, base + npu, base + npu + 1, base + 1);
            m.idx.extend_from_slice(&[a, b, d, c, d, b]);
        }
    }
    m
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compose_identity_and_translation() {
        assert_eq!(compose([0.0; 3], [0.0; 3], [1.0; 3]), IDENTITY);
        let m = compose([1.0, 2.0, 3.0], [0.0; 3], [1.0; 3]);
        assert_eq!(apply_point(&m, [1.0, 1.0, 1.0]), [2.0, 3.0, 4.0]);
    }

    #[test]
    fn box_has_24_vertices_and_12_triangles() {
        let b = box_geometry(1.0, 2.0, 3.0);
        assert_eq!(b.vertex_count(), 24);
        assert_eq!(b.idx.len(), 36);
        let (lo, hi) = b.bbox();
        assert_eq!((lo, hi), ([-0.5, -1.0, -1.5], [0.5, 1.0, 1.5]));
    }

    #[test]
    fn vertex_normals_of_a_flat_quad_point_up() {
        let mut m = Mesh {
            pos: vec![0., 0., 0., 1., 0., 0., 1., 0., 1., 0., 0., 1.],
            idx: vec![0, 2, 1, 0, 3, 2],
            ..Default::default()
        };
        m.compute_vertex_normals();
        for n in m.nrm.chunks(3) {
            assert_eq!(n, [0.0, 1.0, 0.0]);
        }
    }
}
