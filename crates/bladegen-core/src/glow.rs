//! SW1's glow channel (bladegen `sword/planet-swords`, `src/three/sword/glow.ts` and `rng.ts`), ported 1:1: the
//! seeded PRNG (fmix32-scrambled mulberry32), rune glyphs and the emissive glow mesh (edge strips and rune strokes
//! laid on the blade's own triangles). The blade's mask and grid UVs live in [`super::blade`].
use super::blade::{tip_width_with_kissaki, COLS};
use super::geom::*;
use super::params::{Blade, Glow};

/// MurmurHash3's finalizer.
pub fn fmix32(mut h: u32) -> u32 {
    h ^= h >> 16;
    h = h.wrapping_mul(0x85eb_ca6b);
    h ^= h >> 13;
    h = h.wrapping_mul(0xc2b2_ae35);
    h ^= h >> 16;
    h
}

/// FNV-1a over UTF-16 code units (`hashSeed`).
pub fn hash_seed(s: &str) -> u32 {
    let mut h: u32 = 0x811c_9dc5;
    for u in s.encode_utf16() {
        h ^= u as u32;
        h = h.wrapping_mul(0x0100_0193);
    }
    h
}

/// `normalizeSeed` for a number: `floor(abs(x)) mod 2^32`, 0 for a non-finite one.
pub fn normalize_seed(x: f64) -> u32 {
    if !x.is_finite() {
        return 0;
    }
    (x.abs().floor() % 4_294_967_296.0) as u32
}

/// `normalizeSeed` for a string: decimal digits up to 2^32 - 1 are that number, anything else is `hashSeed`.
pub fn normalize_seed_str(s: &str) -> u32 {
    let t = s.trim();
    if !t.is_empty() && t.bytes().all(|b| b.is_ascii_digit()) {
        if let Ok(n) = t.parse::<u64>() {
            if n <= u32::MAX as u64 {
                return n as u32;
            }
        }
    }
    hash_seed(s)
}

/// `createRng(seed)`: mulberry32 from `fmix32(seed)`.
pub struct Rng32 {
    state: u32,
}

impl Rng32 {
    pub fn new(seed: u32) -> Self {
        Self { state: fmix32(seed) }
    }
    /// u32 / 2^32, exactly.
    pub fn next(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6d2b_79f5);
        let mut z = self.state;
        z = (z ^ (z >> 15)).wrapping_mul(z | 1);
        z ^= z.wrapping_add((z ^ (z >> 7)).wrapping_mul(z | 61));
        (z ^ (z >> 14)) as f64 / 4_294_967_296.0
    }
    pub fn range(&mut self, a: f64, b: f64) -> f64 {
        a + (b - a) * self.next()
    }
    pub fn int(&mut self, a: i64, b: i64) -> i64 {
        a + (self.next() * (b - a + 1) as f64).floor() as i64
    }
    pub fn chance(&mut self, p: f64) -> bool {
        self.next() < p
    }
}

/// `q3(x)`: `floor(x * 1000 + 0.5) / 1000`.
pub fn q3(x: f64) -> f64 {
    (x * 1000.0 + 0.5).floor() / 1000.0
}

const RUNE_BRANCHES: [[i32; 4]; 14] = [
    [1, 3, 0, 2],
    [1, 3, 2, 2],
    [1, 2, 0, 1],
    [1, 2, 2, 1],
    [1, 1, 0, 0],
    [1, 1, 2, 0],
    [1, 2, 0, 3],
    [1, 2, 2, 3],
    [1, 1, 0, 2],
    [1, 1, 2, 2],
    [0, 2, 2, 1],
    [0, 1, 2, 1],
    [0, 3, 1, 2],
    [2, 3, 1, 2],
];
const RUNE_BRANCHES_DOUBLE: [[i32; 4]; 6] =
    [[0, 3, 2, 1], [0, 1, 2, 3], [0, 2, 2, 2], [0, 2, 2, 1], [0, 3, 2, 2], [0, 1, 2, 0]];
const RUNE_STROKE_STEPS: usize = 4;
const RUNE_ASPECT: f64 = 1.6;

/// `runeGlyph(rng)`: strokes on a 3 x 4 grid. Draw order: chance(0.25), the branch count, a partial Fisher-Yates.
pub fn rune_glyph(rng: &mut Rng32) -> Vec<[i32; 4]> {
    let double = rng.chance(0.25);
    let mut strokes: Vec<[i32; 4]> =
        if double { vec![[0, 0, 0, 3], [2, 0, 2, 3]] } else { vec![[1, 0, 1, 3]] };
    let mut pool: Vec<[i32; 4]> = if double { RUNE_BRANCHES_DOUBLE.to_vec() } else { RUNE_BRANCHES.to_vec() };
    let count = if double { rng.int(1, 2) } else { rng.int(1, 3) } as usize;
    for k in 0..count {
        let r = rng.int(k as i64, pool.len() as i64 - 1) as usize;
        pool.swap(k, r);
        strokes.push(pool[k]);
    }
    strokes
}

/// `buildBladeGlowGeometry(b, bladeGeo)`: `None` when the glow is off or draws nothing. `blade_pos` is the blade
/// mesh's f32 positions (unchanged by the winding fix).
pub fn build_glow(b: &Blade, blade_pos: &[f32]) -> Option<Mesh> {
    // SW12: the window-keel and faultbound blades lay their glow on their own surfaces (`blade_pos` unused)
    match super::blade::topology(b) {
        super::blade::Topology::Keel => return super::keel::build_glow(b),
        super::blade::Topology::Fault => return super::fault::build_glow(b),
        super::blade::Topology::Grid => {}
    }
    let g: &Glow = b.glow.as_ref().filter(|g| g.enabled != Some(false))?;
    let segs = super::blade::sweep_segments(b);
    let cols = COLS;
    let row_stride = (cols + 1) * 2;
    let p_at = |i: usize, j: usize, side: usize| -> [f64; 3] {
        let k = (i * row_stride + j * 2 + side) * 3;
        [blade_pos[k] as f64, blade_pos[k + 1] as f64, blade_pos[k + 2] as f64]
    };
    let sample = |s: f64, t: f64, side: usize| -> [f64; 3] {
        let gi = jmin(1.0, jmax(0.0, t)) * segs as f64;
        let gj = jmin(1.0, jmax(0.0, s)) * cols as f64;
        let i0 = (gi.floor() as usize).min(segs - 1);
        let j0 = (gj.floor() as usize).min(cols - 1);
        let bb = gi - i0 as f64;
        let a = gj - j0 as f64;
        let (p00, p01, p10, p11) =
            (p_at(i0, j0, side), p_at(i0, j0 + 1, side), p_at(i0 + 1, j0, side), p_at(i0 + 1, j0 + 1, side));
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
    let off = 0.004 + 0.025 * b.thickness.unwrap_or(0.08);
    let l = jmax(0.01, b.length);
    let base_w = jmax(0.002, b.base_width);
    let tip_w = jmax(0.0, b.tip_width);

    let mut m = Mesh::default();
    let mut world: Vec<[f64; 3]> = Vec::new();
    let mut outward: Vec<[f64; 3]> = Vec::new();
    let mut add_vertex = |m: &mut Mesh, s: f64, t: f64, side: usize| -> u32 {
        let p = sample(s, t, side);
        let o = sample(s, t, 1 - side);
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
        let w = [p[0] + dx * off, p[1] + dy * off, p[2] + dz * off];
        m.pos.extend_from_slice(&[w[0] as f32, w[1] as f32, w[2] as f32]);
        m.nrm.extend_from_slice(&[dx as f32, dy as f32, dz as f32]);
        m.uv.extend_from_slice(&[s as f32, t as f32]);
        world.push(w);
        outward.push([dx, dy, dz]);
        (world.len() - 1) as u32
    };
    fn add_tri(m: &mut Mesh, world: &[[f64; 3]], outward: &[[f64; 3]], a: u32, b: u32, c: u32) {
        let (pa, pb, pc) = (world[a as usize], world[b as usize], world[c as usize]);
        let (ux, uy, uz) = (pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
        let (vx, vy, vz) = (pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]);
        let (nx, ny, nz) = (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
        let o = outward[a as usize];
        if nx * o[0] + ny * o[1] + nz * o[2] < 0.0 {
            m.idx.extend_from_slice(&[a, c, b]);
        } else {
            m.idx.extend_from_slice(&[a, b, c]);
        }
    }
    // quads are added once the vertices exist (the closure holds `world`/`outward` mutably meanwhile)
    let mut quads: Vec<[u32; 4]> = Vec::new();

    // 1) edge strips
    let ew = g.edge_width.unwrap_or(0.0);
    if ew > 0.0 {
        let strips = [(0.0, ew), (1.0 - ew, 1.0)];
        for side in 0..2 {
            for &(s0, s1) in &strips {
                let (mut pa, mut pb) = (0u32, 0u32);
                for i in 0..=segs {
                    let t = i as f64 / segs as f64;
                    let a = add_vertex(&mut m, s0, t, side);
                    let c = add_vertex(&mut m, s1, t, side);
                    if i > 0 {
                        quads.push([pa, pb, a, c]);
                    }
                    pa = a;
                    pb = c;
                }
            }
        }
    }
    // 2) runes along the centre line
    let count = jmax(0.0, jround(g.rune_count.unwrap_or(0.0))) as usize;
    if count > 0 {
        let mut rng = Rng32::new(normalize_seed(g.rune_seed.unwrap_or(1.0)));
        let t0 = g.rune_start.unwrap_or(0.12);
        let t1 = g.rune_end.unwrap_or(0.7);
        let slot = (t1 - t0) / count as f64;
        let slot_h = slot * l;
        let faces: &[usize] = match g.rune_faces.as_deref() {
            Some("front") => &[0],
            Some("back") => &[1],
            _ => &[0, 1],
        };
        let scale = g.rune_scale.unwrap_or(0.5);
        let stroke_frac = g.rune_stroke.unwrap_or(0.14);
        for k in 0..count {
            let strokes = rune_glyph(&mut rng);
            let tc = t0 + (k as f64 + 0.5) * slot;
            let w = tip_width_with_kissaki(b, tc, base_w, tip_w);
            let mut gw = scale * w;
            let mut gh = gw * RUNE_ASPECT;
            if gh > 0.8 * slot_h {
                gh = 0.8 * slot_h;
                gw = gh / RUNE_ASPECT;
            }
            let hw = stroke_frac * gw * 0.5;
            for &side in faces {
                let mirror = if side == 0 { 1.0 } else { -1.0 };
                for st in &strokes {
                    let (x0g, y0g, x1g, y1g) = (st[0] as f64, st[1] as f64, st[2] as f64, st[3] as f64);
                    let (ax, ay) = ((x0g - 1.0) * (gw * 0.5), (y0g - 1.5) * (gh / 3.0));
                    let (bx, by) = ((x1g - 1.0) * (gw * 0.5), (y1g - 1.5) * (gh / 3.0));
                    let (mut dx, mut dy) = (bx - ax, by - ay);
                    let len = (dx * dx + dy * dy).sqrt();
                    if len < 1e-12 {
                        continue;
                    }
                    dx /= len;
                    dy /= len;
                    let (nx, ny) = (-dy, dx);
                    let (sx, sy) = (ax - dx * hw, ay - dy * hw);
                    let (ex, ey) = (bx + dx * hw, by + dy * hw);
                    let (mut pa, mut pb) = (0u32, 0u32);
                    for mm in 0..=RUNE_STROKE_STEPS {
                        let f = mm as f64 / RUNE_STROKE_STEPS as f64;
                        let px = sx + (ex - sx) * f;
                        let py = sy + (ey - sy) * f;
                        let (lx, ly) = (px + nx * hw, py + ny * hw);
                        let (rx, ry) = (px - nx * hw, py - ny * hw);
                        let a = add_vertex(&mut m, 0.5 + (mirror * lx) / w, tc + ly / l, side);
                        let c = add_vertex(&mut m, 0.5 + (mirror * rx) / w, tc + ry / l, side);
                        if mm > 0 {
                            quads.push([pa, pb, a, c]);
                        }
                        pa = a;
                        pb = c;
                    }
                }
            }
        }
    }
    drop(add_vertex);
    // addQuad(p0, q0, p1, q1): (p0, q0, q1), (p0, q1, p1), in the order the quads were made
    for [p0, q0, p1, q1] in quads {
        add_tri(&mut m, &world, &outward, p0, q0, q1);
        add_tri(&mut m, &world, &outward, p0, q1, p1);
    }
    if m.idx.is_empty() {
        return None;
    }
    m.color = vec![1.0; world.len() * 4];
    Some(m)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fmix32_matches_sw1_vectors() {
        assert_eq!(fmix32(0), 0);
        assert_eq!(fmix32(1), 1364076727);
        assert_eq!(fmix32(42), 142593372);
        assert_eq!(fmix32(3735928559), 233162409);
        assert_eq!(hash_seed("b"), 3876335077);
        assert_eq!(hash_seed(""), 2166136261);
    }
}
