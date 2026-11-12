import * as THREE from 'three';
import type { BladeGlow, BladeParams } from './types';
import { tipWidthWithKissaki } from './math';
import { createRng, type Rng } from './rng';

/**
 * Exportable blade glow channel.
 *
 * The blade mesh from `buildBladeGeometry` is a regular grid: `segs + 1` rows
 * along the length (t = i / segs) by `BLADE_GRID_COLS + 1` columns across the
 * width (s = j / cols), with two vertices per grid point (side 0 = front at -Z,
 * side 1 = back at +Z). Vertex index = i * (cols + 1) * 2 + j * 2 + side.
 *
 * Everything here is defined in that (s, t) grid space, so it is cheap to
 * reproduce in a port:
 * - `bladeGridUVs`: u = s, v = t.
 * - `bladeGlowMask`: per-vertex alpha mask from s only (edge band + core band).
 * - `buildBladeGlowGeometry`: emissive edge strips and rune strokes, placed on
 *   the blade surface by interpolating the blade's own triangles.
 */

/** Columns across the blade cross-section; must match `buildBladeGeometry`. */
export const BLADE_GRID_COLS = 12;

/** Longitudinal segment count used by `buildBladeGeometry` for these params. */
export function bladeGridSegments(b: BladeParams): number {
  return Math.max(16, Math.min(512, Math.round(b.sweepSegments ?? 128)));
}

/** Grid UVs for the blade mesh (u across the width, v along the length). */
export function bladeGridUVs(segs: number, cols = BLADE_GRID_COLS): Float32Array {
  const rowStride = (cols + 1) * 2;
  const uvs = new Float32Array((segs + 1) * rowStride * 2);
  for (let i = 0; i <= segs; i++) {
    for (let j = 0; j <= cols; j++) {
      for (let side = 0; side < 2; side++) {
        const k = (i * rowStride + j * 2 + side) * 2;
        uvs[k] = j / cols;
        uvs[k + 1] = i / segs;
      }
    }
  }
  return uvs;
}

/** Glow mask value (0..1) at normalized width position s. */
export function glowMaskAt(glow: BladeGlow, s: number, cols = BLADE_GRID_COLS): number {
  const ew = glow.edgeWidth ?? 0;
  const cw = glow.coreWidth ?? 0;
  const dEdge = Math.min(s, 1 - s);
  const edgeBand = ew > 0 ? Math.max(0, 1 - dEdge / Math.max(1.5 * ew, 1 / cols)) : 0;
  const coreBand = cw > 0 ? Math.max(0, 1 - Math.abs(s - 0.5) / cw) : 0;
  return Math.min(1, (glow.edgeMask ?? 0) * edgeBand + (glow.coreMask ?? 0) * coreBand);
}

/** COLOR_0 for the blade: RGB = 1 (no tint), A = glow mask. */
export function bladeGlowColors(
  glow: BladeGlow,
  segs: number,
  cols = BLADE_GRID_COLS
): Float32Array {
  const rowStride = (cols + 1) * 2;
  const colors = new Float32Array((segs + 1) * rowStride * 4);
  for (let i = 0; i <= segs; i++) {
    for (let j = 0; j <= cols; j++) {
      const a = glowMaskAt(glow, j / cols, cols);
      for (let side = 0; side < 2; side++) {
        const k = (i * rowStride + j * 2 + side) * 4;
        colors[k] = 1;
        colors[k + 1] = 1;
        colors[k + 2] = 1;
        colors[k + 3] = a;
      }
    }
  }
  return colors;
}

/** Attach grid UVs and the glow COLOR_0 to a blade geometry (in place). */
export function applyBladeGlowAttributes(geo: THREE.BufferGeometry, b: BladeParams): void {
  const segs = bladeGridSegments(b);
  geo.setAttribute('uv', new THREE.BufferAttribute(bladeGridUVs(segs), 2));
  if (b.glow)
    geo.setAttribute('color', new THREE.BufferAttribute(bladeGlowColors(b.glow, segs), 4));
}

type Vec3 = [number, number, number];

/**
 * Sample the blade surface at grid coordinates (s, t) on one side, following the
 * blade's own triangulation: in cell (i0, j0) with local (a, b), the triangle
 * (00, 01, 11) covers a >= b and (00, 11, 10) covers a < b.
 */
function makeSurfaceSampler(pos: ArrayLike<number>, segs: number, cols: number) {
  const rowStride = (cols + 1) * 2;
  const P = (i: number, j: number, side: number): Vec3 => {
    const k = (i * rowStride + j * 2 + side) * 3;
    return [pos[k], pos[k + 1], pos[k + 2]];
  };
  return (s: number, t: number, side: number): Vec3 => {
    const gi = Math.min(1, Math.max(0, t)) * segs;
    const gj = Math.min(1, Math.max(0, s)) * cols;
    const i0 = Math.min(Math.floor(gi), segs - 1);
    const j0 = Math.min(Math.floor(gj), cols - 1);
    const b = gi - i0;
    const a = gj - j0;
    const p00 = P(i0, j0, side);
    const p01 = P(i0, j0 + 1, side);
    const p10 = P(i0 + 1, j0, side);
    const p11 = P(i0 + 1, j0 + 1, side);
    const out: Vec3 = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      out[c] =
        a >= b
          ? p00[c] + a * (p01[c] - p00[c]) + b * (p11[c] - p01[c])
          : p00[c] + b * (p10[c] - p00[c]) + a * (p11[c] - p10[c]);
    }
    return out;
  };
}

/** Candidate rune strokes on a 3 x 4 point grid: [x0, y0, x1, y1]. */
const RUNE_BRANCHES: ReadonlyArray<readonly [number, number, number, number]> = [
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
const RUNE_BRANCHES_DOUBLE: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 3, 2, 1],
  [0, 1, 2, 3],
  [0, 2, 2, 2],
  [0, 2, 2, 1],
  [0, 3, 2, 2],
  [0, 1, 2, 0],
];

/**
 * Generate rune glyph strokes in grid units. RNG draw order (must be matched by
 * ports): chance(0.25) for a double stave, int(1, 3) for the branch count
 * (int(1, 2) for double staves), then a partial Fisher-Yates over the branch
 * pool: for k in 0..count-1, swap pool[k] with pool[int(k, len-1)].
 */
export function runeGlyph(rng: Rng): Array<[number, number, number, number]> {
  const double = rng.chance(0.25);
  const strokes: Array<[number, number, number, number]> = double
    ? [
        [0, 0, 0, 3],
        [2, 0, 2, 3],
      ]
    : [[1, 0, 1, 3]];
  const pool = (double ? RUNE_BRANCHES_DOUBLE : RUNE_BRANCHES).map(
    (s) => [s[0], s[1], s[2], s[3]] as [number, number, number, number]
  );
  const count = double ? rng.int(1, 2) : rng.int(1, 3);
  for (let k = 0; k < count; k++) {
    const r = rng.int(k, pool.length - 1);
    const tmp = pool[k];
    pool[k] = pool[r];
    pool[r] = tmp;
    strokes.push(pool[k]);
  }
  return strokes;
}

/** Subdivisions along each rune stroke so it follows the blade surface. */
const RUNE_STROKE_STEPS = 4;
/** Glyph height / width. */
const RUNE_ASPECT = 1.6;

/**
 * Build the emissive glow geometry for a validated blade (edge strips plus rune
 * strokes) on top of `bladeGeo` (the output of `buildBladeGeometry` for `b`).
 * Returns null when the glow has nothing to draw.
 *
 * Attributes: position, normal (outward from the blade mid-plane), uv (grid s, t),
 * color (RGBA = 1). Each vertex is the surface sample on its side, pushed out by
 * `off = 0.004 + 0.025 * b.thickness` along `normalize(P(side) - P(other side))`.
 * Each triangle's winding is chosen so its geometric normal faces that outward
 * direction (tested in f64 before the f32 store).
 */
export function buildBladeGlowGeometry(
  b: BladeParams,
  bladeGeo: THREE.BufferGeometry
): THREE.BufferGeometry | null {
  const glow = b.glow;
  if (!glow || glow.enabled === false) return null;
  const segs = bladeGridSegments(b);
  const cols = BLADE_GRID_COLS;
  const pos = (bladeGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
  const sample = makeSurfaceSampler(pos, segs, cols);
  const off = 0.004 + 0.025 * (b.thickness ?? 0.08);
  const L = Math.max(0.01, b.length);
  const baseW = Math.max(0.002, b.baseWidth);
  const tipW = Math.max(0, b.tipWidth);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const outward: Vec3[] = [];
  const world: Vec3[] = [];

  const addVertex = (s: number, t: number, side: number) => {
    const p = sample(s, t, side);
    const o = sample(s, t, 1 - side);
    let dx = p[0] - o[0],
      dy = p[1] - o[1],
      dz = p[2] - o[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len > 1e-12) {
      dx /= len;
      dy /= len;
      dz /= len;
    } else {
      dx = 0;
      dy = 0;
      dz = side === 0 ? -1 : 1;
    }
    const w: Vec3 = [p[0] + dx * off, p[1] + dy * off, p[2] + dz * off];
    positions.push(w[0], w[1], w[2]);
    normals.push(dx, dy, dz);
    uvs.push(s, t);
    world.push(w);
    outward.push([dx, dy, dz]);
    return world.length - 1;
  };
  const addTri = (a: number, bI: number, c: number) => {
    const A = world[a],
      B = world[bI],
      C = world[c];
    const ux = B[0] - A[0],
      uy = B[1] - A[1],
      uz = B[2] - A[2];
    const vx = C[0] - A[0],
      vy = C[1] - A[1],
      vz = C[2] - A[2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const o = outward[a];
    if (nx * o[0] + ny * o[1] + nz * o[2] < 0) index.push(a, c, bI);
    else index.push(a, bI, c);
  };
  // Quad from two consecutive vertex pairs (p0, q0) and (p1, q1).
  const addQuad = (p0: number, q0: number, p1: number, q1: number) => {
    addTri(p0, q0, q1);
    addTri(p0, q1, p1);
  };

  // 1) Edge strips: s in [0, ew] and [1 - ew, 1], every grid row, both sides.
  const ew = glow.edgeWidth ?? 0;
  if (ew > 0) {
    const strips: Array<[number, number]> = [
      [0, ew],
      [1 - ew, 1],
    ];
    for (let side = 0; side < 2; side++) {
      for (const [s0, s1] of strips) {
        let prevA = -1,
          prevB = -1;
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          const a = addVertex(s0, t, side);
          const c = addVertex(s1, t, side);
          if (i > 0) addQuad(prevA, prevB, a, c);
          prevA = a;
          prevB = c;
        }
      }
    }
  }

  // 2) Runes along the centre line.
  const count = Math.max(0, Math.round(glow.runeCount ?? 0));
  if (count > 0) {
    const rng = createRng(glow.runeSeed ?? 1);
    const t0 = glow.runeStart ?? 0.12;
    const t1 = glow.runeEnd ?? 0.7;
    const slot = (t1 - t0) / count;
    const slotH = slot * L;
    const faces = glow.runeFaces === 'front' ? [0] : glow.runeFaces === 'back' ? [1] : [0, 1];
    const scale = glow.runeScale ?? 0.5;
    const strokeFrac = glow.runeStroke ?? 0.14;
    for (let k = 0; k < count; k++) {
      const strokes = runeGlyph(rng);
      const tc = t0 + (k + 0.5) * slot;
      const W = tipWidthWithKissaki(b, tc, baseW, tipW);
      let gw = scale * W;
      let gh = gw * RUNE_ASPECT;
      if (gh > 0.8 * slotH) {
        gh = 0.8 * slotH;
        gw = gh / RUNE_ASPECT;
      }
      const hw = strokeFrac * gw * 0.5;
      for (const side of faces) {
        const mirror = side === 0 ? 1 : -1;
        for (const [x0g, y0g, x1g, y1g] of strokes) {
          const ax = (x0g - 1) * (gw * 0.5),
            ay = (y0g - 1.5) * (gh / 3);
          const bx = (x1g - 1) * (gw * 0.5),
            by = (y1g - 1.5) * (gh / 3);
          let dx = bx - ax,
            dy = by - ay;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1e-12) continue;
          dx /= len;
          dy /= len;
          const nx = -dy,
            ny = dx;
          const sx = ax - dx * hw,
            sy = ay - dy * hw;
          const ex = bx + dx * hw,
            ey = by + dy * hw;
          let prevA = -1,
            prevB = -1;
          for (let m = 0; m <= RUNE_STROKE_STEPS; m++) {
            const f = m / RUNE_STROKE_STEPS;
            const px = sx + (ex - sx) * f;
            const py = sy + (ey - sy) * f;
            const lx = px + nx * hw,
              ly = py + ny * hw;
            const rx = px - nx * hw,
              ry = py - ny * hw;
            const a = addVertex(0.5 + (mirror * lx) / W, tc + ly / L, side);
            const c = addVertex(0.5 + (mirror * rx) / W, tc + ry / L, side);
            if (m > 0) addQuad(prevA, prevB, a, c);
            prevA = a;
            prevB = c;
          }
        }
      }
    }
  }

  if (!index.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const colors = new Float32Array(world.length * 4).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  geo.setIndex(index);
  geo.computeBoundingBox();
  return geo;
}

/** Emissive material for the glow mesh. */
export function createGlowMaterial(glow: BladeGlow): THREE.MeshStandardMaterial {
  const color = new THREE.Color(glow.color ?? '#7fd8ff');
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: glow.intensity ?? 4,
    metalness: 0,
    roughness: 0.5,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  mat.name = 'glow';
  mat.userData = { bladegenGlow: { pulseHz: glow.pulseHz ?? 0 } };
  return mat;
}
