import * as THREE from 'three';

/**
 * Monument stroke kernel (SW10): the one geometry primitive every monument guard and pommel is made of.
 *
 * A stroke is a closed tube swept along a planar centre line in the XY plane (X across the blade, +Y toward the
 * blade's tip), with a cross-section that runs from square flats through round to a diamond ridge, exactly as the
 * `forged` cross's (guardForged.ts). A ring is the same tube along a closed circle. Parts are merged into one indexed
 * BufferGeometry (position, uv) and `computeVertexNormals` runs once at the end. No three.js primitive is used, so a
 * port can match it bit for bit.
 *
 * Port contract (docs/HEADLESS.md, "Monument strokes"): everything is f64 in the order written here and stored as f32.
 * - Stations along a stroke of length L (s = arc length, u = s / L):
 *   - tip 'flat' and 'point': S + 1 rings at s = L * i / S (i = 0..S), section scale f(u);
 *   - tip 'knob' (the forged finial): rTip = max(hy, hz) * f(1); rk = min(rTip * (1 + knob), 0.45 * L);
 *     tk = L - rk; t0 = tk - rk; S + 1 rings at s = t0 * i / S, then KNOB_RINGS - 1 rings at
 *     s = tk - rk * cos(pi * j / KNOB_RINGS) (j = 1..KNOB_RINGS - 1): sizes max(h * f(s / L), rk * sin) for
 *     2j <= KNOB_RINGS, then max(h * f(tk / L), rk) * sin.
 * - End vertex (the cap's apex): 'flat' at s = L; 'knob' at s = tk + rk; 'point' at
 *   s = L + POINT_RATIO * max(hy, hz) * f(1). The start cap's apex is the centre line at s = 0.
 * - Centre line: theta(s) = heading + turn * u + bend * u * u, integrated from (x, y) with STROKE_SUBSTEPS midpoint
 *   steps per station interval: sub = (s_i - s_(i-1)) / STROKE_SUBSTEPS; for q: th = theta(s_(i-1) + (q + 0.5) * sub);
 *   x = x + cos(th) * sub; y = y + sin(th) * sub (the end apex is the last station).
 * - Ring k of a station: n = (-sin(theta(s)), cos(theta(s))); a = hy_i * secA[k]; vertex = (cx + n.x * a,
 *   cy + n.y * a, z + hz_i * secB[k]); radial + 1 vertices (a seam copy), uv = (ring / (rings - 1), k / radial).
 * - Vertex order per stroke: start apex, rings, end apex. Triangles: start fan (r0[k + 1], r0[k], apex0), tube
 *   (a, c, b), (b, c, d) with a = (r, k), b = (r + 1, k), c = (r, k + 1), d = (r + 1, k + 1), end fan
 *   (rN[k], rN[k + 1], apexN).
 * - Section: phi = (k / radial) * 2 * pi, c = cos(phi), s = sin(phi); section >= 0 mixes (c, s) toward
 *   (c, s) / (|c| + |s|), section < 0 toward (c, s) / max(|c|, |s|), with weight |section|.
 * - Mirroring: x = -x on every vertex of the part and each triangle (i, j, k) becomes (i, k, j).
 */

/** Midpoint sub-steps per station interval when integrating a turning centre line (as the forged cross). */
export const STROKE_SUBSTEPS = 4;
/** Rings over a knob finial (as the forged cross's FORGED_CAP_RINGS). */
export const KNOB_RINGS = 10;
/** A point tip's apex reaches POINT_RATIO x the last ring's larger half-size past the stroke's end. */
export const POINT_RATIO = 3;

export type StrokeTip = 'flat' | 'point' | 'knob';

/**
 * Section scale along a stroke, u = s / L:
 * - 'taper': mix(1, taper, belly ? u * u : u);
 * - 'gem': u < waist ? mix(top, 1, u / waist) : mix(1, taper, (u - waist) / (1 - waist)).
 */
export type SizeLaw =
  | { kind: 'taper'; taper: number; belly?: boolean }
  | { kind: 'gem'; top: number; waist: number; taper: number };

export type Stroke = {
  x: number;
  y: number;
  z?: number;
  /** Start direction in the XY plane, radians (0 = +X, pi/2 = +Y toward the blade). */
  heading: number;
  length: number;
  /** Linear turn over the whole length (radians). */
  turn?: number;
  /** Quadratic turn: theta gains bend * u^2 (radians at the end). */
  bend?: number;
  /** Half-sizes at the root: in the plane (across the centre line) and across the flats (Z). */
  hy: number;
  hz: number;
  size: SizeLaw;
  tip: StrokeTip;
  /** Knob tips: knob radius = the tip section x (1 + knob). */
  knob?: number;
  segments: number;
};

export type RingStroke = {
  cx: number;
  cy: number;
  radius: number;
  hy: number;
  hz: number;
  segments: number;
};

/** A part being built: positions, uvs and triangle indices (local to the part). */
export type Part = { pos: number[]; uv: number[]; idx: number[] };

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function sizeAt(law: SizeLaw, u: number): number {
  if (law.kind === 'gem') {
    if (u < law.waist) return mix(law.top, 1, u / law.waist);
    return mix(1, law.taper, (u - law.waist) / (1 - law.waist));
  }
  return mix(1, law.taper, law.belly ? u * u : u);
}

/** The cross-section's unit outline (radial + 1 points with a seam copy), as the forged cross. */
export function sectionOutline(section: number, radial: number): { a: number[]; b: number[] } {
  const a: number[] = [];
  const b: number[] = [];
  for (let k = 0; k <= radial; k++) {
    const phi = (k / radial) * Math.PI * 2;
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    if (section >= 0) {
      const d = Math.abs(c) + Math.abs(s);
      a.push(mix(c, c / d, section));
      b.push(mix(s, s / d, section));
    } else {
      const m = Math.max(Math.abs(c), Math.abs(s));
      a.push(mix(c, c / m, -section));
      b.push(mix(s, s / m, -section));
    }
  }
  return { a, b };
}

/** Sweep one stroke into a new part. */
export function strokePart(st: Stroke, sec: { a: number[]; b: number[] }): Part {
  const radial = sec.a.length - 1;
  const L = st.length;
  const segs = Math.max(1, st.segments);
  const turn = st.turn ?? 0;
  const bend = st.bend ?? 0;
  const z0 = st.z ?? 0;
  const ss: number[] = [];
  const hy: number[] = [];
  const hz: number[] = [];
  let sEnd: number;
  if (st.tip === 'knob') {
    const rTip = Math.max(st.hy, st.hz) * sizeAt(st.size, 1);
    const rk = Math.min(rTip * (1 + (st.knob ?? 0)), 0.45 * L);
    const tk = L - rk;
    const t0 = tk - rk;
    for (let i = 0; i <= segs; i++) {
      const s = (t0 * i) / segs;
      const f = sizeAt(st.size, s / L);
      ss.push(s);
      hy.push(st.hy * f);
      hz.push(st.hz * f);
    }
    const fK = sizeAt(st.size, tk / L);
    const hkY = Math.max(st.hy * fK, rk);
    const hkZ = Math.max(st.hz * fK, rk);
    for (let j = 1; j < KNOB_RINGS; j++) {
      const ang = (Math.PI * j) / KNOB_RINGS;
      const s = tk - rk * Math.cos(ang);
      const k = Math.sin(ang);
      ss.push(s);
      if (2 * j <= KNOB_RINGS) {
        const f = sizeAt(st.size, s / L);
        hy.push(Math.max(st.hy * f, rk * k));
        hz.push(Math.max(st.hz * f, rk * k));
      } else {
        hy.push(hkY * k);
        hz.push(hkZ * k);
      }
    }
    sEnd = tk + rk;
  } else {
    for (let i = 0; i <= segs; i++) {
      const s = (L * i) / segs;
      const f = sizeAt(st.size, s / L);
      ss.push(s);
      hy.push(st.hy * f);
      hz.push(st.hz * f);
    }
    sEnd = st.tip === 'point' ? L + POINT_RATIO * Math.max(st.hy, st.hz) * sizeAt(st.size, 1) : L;
  }
  const theta = (s: number): number => {
    const u = s / L;
    return st.heading + turn * u + bend * u * u;
  };
  // centre line through every ring station, then the end apex
  const stations = ss.concat([sEnd]);
  const cx: number[] = [st.x];
  const cy: number[] = [st.y];
  let x = st.x;
  let y = st.y;
  for (let i = 1; i < stations.length; i++) {
    const sub = (stations[i] - stations[i - 1]) / STROKE_SUBSTEPS;
    for (let q = 0; q < STROKE_SUBSTEPS; q++) {
      const th = theta(stations[i - 1] + (q + 0.5) * sub);
      x = x + Math.cos(th) * sub;
      y = y + Math.sin(th) * sub;
    }
    cx.push(x);
    cy.push(y);
  }
  const rings = ss.length;
  const stride = radial + 1;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  // start apex
  pos.push(cx[0], cy[0], z0);
  uv.push(0, 0.5);
  for (let r = 0; r < rings; r++) {
    const th = theta(ss[r]);
    const nx = -Math.sin(th);
    const ny = Math.cos(th);
    for (let k = 0; k <= radial; k++) {
      const a = hy[r] * sec.a[k];
      pos.push(cx[r] + nx * a, cy[r] + ny * a, z0 + hz[r] * sec.b[k]);
      uv.push(r / (rings - 1), k / radial);
    }
  }
  const apexN = 1 + rings * stride;
  pos.push(cx[rings], cy[rings], z0);
  uv.push(1, 0.5);
  for (let k = 0; k < radial; k++) idx.push(1 + k + 1, 1 + k, 0);
  for (let r = 0; r < rings - 1; r++) {
    for (let k = 0; k < radial; k++) {
      const a = 1 + r * stride + k;
      const b = 1 + (r + 1) * stride + k;
      const c = 1 + r * stride + k + 1;
      const d = 1 + (r + 1) * stride + k + 1;
      idx.push(a, c, b);
      idx.push(b, c, d);
    }
  }
  const last = 1 + (rings - 1) * stride;
  for (let k = 0; k < radial; k++) idx.push(last + k, last + k + 1, apexN);
  return { pos, uv, idx };
}

/** A closed ring tube around (cx, cy) in the XY plane: segments + 1 rings (the last a seam copy of the first). */
export function ringPart(rs: RingStroke, sec: { a: number[]; b: number[] }): Part {
  const radial = sec.a.length - 1;
  const stride = radial + 1;
  const m = Math.max(3, rs.segments);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r <= m; r++) {
    const ang = (Math.PI * 2 * (r % m)) / m;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const ox = rs.cx + rs.radius * c;
    const oy = rs.cy + rs.radius * s;
    // in-plane normal pointing to the centre, so (tangent, normal, +Z) is right-handed like a stroke's
    const nx = -c;
    const ny = -s;
    for (let k = 0; k <= radial; k++) {
      const a = rs.hy * sec.a[k];
      pos.push(ox + nx * a, oy + ny * a, rs.hz * sec.b[k]);
      uv.push(r / m, k / radial);
    }
  }
  for (let r = 0; r < m; r++) {
    for (let k = 0; k < radial; k++) {
      const a = r * stride + k;
      const b = (r + 1) * stride + k;
      const c = r * stride + k + 1;
      const d = (r + 1) * stride + k + 1;
      idx.push(a, c, b);
      idx.push(b, c, d);
    }
  }
  return { pos, uv, idx };
}

/** The part mirrored across X = 0 (x negated, winding swapped so it stays outward). */
export function mirrorPart(p: Part): Part {
  const pos = p.pos.slice();
  for (let i = 0; i < pos.length; i += 3) pos[i] = -pos[i];
  const idx: number[] = [];
  for (let i = 0; i < p.idx.length; i += 3) idx.push(p.idx[i], p.idx[i + 2], p.idx[i + 1]);
  return { pos, uv: p.uv.slice(), idx };
}

/** Merge parts in order into one indexed geometry and compute its vertex normals. */
export function mergeParts(parts: Part[]): THREE.BufferGeometry {
  let nv = 0;
  let ni = 0;
  for (const p of parts) {
    nv += p.pos.length / 3;
    ni += p.idx.length;
  }
  const pos = new Float32Array(nv * 3);
  const uv = new Float32Array(nv * 2);
  const index: number[] = new Array(ni);
  let base = 0;
  let pp = 0;
  let pu = 0;
  let pi = 0;
  for (const p of parts) {
    for (let i = 0; i < p.pos.length; i++) pos[pp++] = p.pos[i];
    for (let i = 0; i < p.uv.length; i++) uv[pu++] = p.uv[i];
    for (let i = 0; i < p.idx.length; i++) index[pi++] = base + p.idx[i];
    base += p.pos.length / 3;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(index);
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}
