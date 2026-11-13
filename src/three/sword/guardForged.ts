import * as THREE from 'three';
import type { BladeParams, GuardParams } from './types';

/**
 * Forged cross guard (style 'forged').
 *
 * One closed tube swept from the left quillon tip, through a centre block, to the right tip.
 * Every size comes from the blade: the block's height is `height` x the blade's base width, its
 * depth `depth` x the blade's thickness, the block's half-length `block` x the base width. Only the
 * span (`guard.width`) is absolute, as for every other style. So a 30-42 m monument keeps a guard
 * with real thickness, a profile (`section`: square flats, round or a diamond ridge), arms that
 * taper (`taper`) and turn (`curl`), and a knob (`finial`) at each tip, instead of a thin plate.
 *
 * Port contract (worldgen's Rust port must match it bit for bit; docs/HEADLESS.md):
 * - arc-length stations along one arm: S + 1 arm rings at t = t0 * i / S, then CAP rings at
 *   t = tk - rk * cos(pi * j / CAP) (j = 1..CAP) over the finial;
 * - the centre line turns by theta(t) = curl * (t / half)^2 and is integrated from the centre with
 *   SUBSTEPS midpoint steps per station interval, in f64, in this order;
 * - rings run left tip -> centre -> right tip; each ring has radial + 1 vertices (a seam copy, as
 *   three's primitives), uv = (ring / (rings - 1), k / radial); computeVertexNormals.
 */

/** Defaults (validation writes them back explicitly). */
export const FORGED_DEFAULTS = {
  height: 0.42,
  depth: 2.4,
  block: 0.6,
  swell: 1.25,
  taper: 0.5,
  curl: 0.5,
  finial: 0.6,
  section: 0.5,
  segments: 24,
  radial: 16,
} as const;
/** Rings over each finial (a knob, or the rounded end when finial = 0). */
export const FORGED_CAP_RINGS = 10;
/** Midpoint sub-steps per station interval when integrating the turning centre line. */
export const FORGED_SUBSTEPS = 4;
/** Length of the block-to-arm blend, as a fraction of the half span. */
export const FORGED_BLEND = 0.12;

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export type ForgedGuardBuild = {
  geometry: THREE.BufferGeometry;
  /** Half-height of the centre block (its top sits at the guard line). */
  halfHeight: number;
};

/** The forged cross's geometry in guard-local space: centre block at the origin, span along X. */
export function buildForgedGuardGeometry(
  g: GuardParams,
  blade?: BladeParams | null
): ForgedGuardBuild {
  const f = g.forged ?? {};
  const height = f.height ?? FORGED_DEFAULTS.height;
  const depth = f.depth ?? FORGED_DEFAULTS.depth;
  const block = f.block ?? FORGED_DEFAULTS.block;
  const swell = f.swell ?? FORGED_DEFAULTS.swell;
  const taper = f.taper ?? FORGED_DEFAULTS.taper;
  const curl = f.curl ?? FORGED_DEFAULTS.curl;
  const finial = f.finial ?? FORGED_DEFAULTS.finial;
  const section = f.section ?? FORGED_DEFAULTS.section;
  const segs = Math.max(2, Math.round(f.segments ?? FORGED_DEFAULTS.segments));
  const radial = Math.max(4, Math.round(f.radial ?? FORGED_DEFAULTS.radial));

  const bw = blade?.baseWidth ?? 0.25;
  const bt = Math.max(blade?.thicknessLeft ?? 0.08, blade?.thicknessRight ?? 0.08);
  const half = Math.max(0.1, g.width * 0.5);
  const hy0 = 0.5 * height * bw;
  const hz0 = 0.5 * depth * bt;
  const uBlock = Math.min(0.9, (block * bw) / half);
  const root = 1 / swell;
  // section scale along the arm (1 = the block); u = arc length / half span
  const armSize = (u: number): number => {
    const sb = smooth(uBlock, uBlock + FORGED_BLEND, u);
    const tu = Math.min(1, Math.max(0, (u - uBlock) / Math.max(1e-6, 1 - uBlock)));
    return mix(1, root * mix(1, taper, tu), sb);
  };
  const sTip = armSize(1);
  const rTip = Math.max(hy0 * sTip, hz0 * sTip);
  const rk = Math.min(rTip * (1 + finial), 0.45 * half);
  const tk = half - rk;
  const t0 = tk - rk;

  // stations along one arm: arc length, section half-sizes
  const n = segs + FORGED_CAP_RINGS;
  const ts: number[] = [];
  const hy: number[] = [];
  const hz: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = (t0 * i) / segs;
    const s = armSize(t / half);
    ts.push(t);
    hy.push(hy0 * s);
    hz.push(hz0 * s);
  }
  const sK = armSize(tk / half);
  const hkY = Math.max(hy0 * sK, rk);
  const hkZ = Math.max(hz0 * sK, rk);
  for (let j = 1; j <= FORGED_CAP_RINGS; j++) {
    const a = (Math.PI * j) / FORGED_CAP_RINGS;
    const t = tk - rk * Math.cos(a);
    const k = Math.sin(a);
    if (2 * j <= FORGED_CAP_RINGS) {
      const s = armSize(t / half);
      ts.push(t);
      hy.push(Math.max(hy0 * s, rk * k));
      hz.push(Math.max(hz0 * s, rk * k));
    } else {
      ts.push(t);
      hy.push(hkY * k);
      hz.push(hkZ * k);
    }
  }

  // the turning centre line (right arm), integrated from the centre
  const theta = (t: number): number => {
    const u = t / half;
    return curl * u * u;
  };
  const cx: number[] = [0];
  const cy: number[] = [0];
  let x = 0;
  let y = 0;
  for (let i = 1; i <= n; i++) {
    const sub = (ts[i] - ts[i - 1]) / FORGED_SUBSTEPS;
    for (let q = 0; q < FORGED_SUBSTEPS; q++) {
      const th = theta(ts[i - 1] + (q + 0.5) * sub);
      x = x + Math.cos(th) * sub;
      y = y + Math.sin(th) * sub;
    }
    cx.push(x);
    cy.push(y);
  }

  // the cross-section: round, mixed toward a diamond (section > 0) or a square (section < 0)
  const secA: number[] = [];
  const secB: number[] = [];
  for (let k = 0; k <= radial; k++) {
    const phi = (k / radial) * Math.PI * 2;
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    if (section >= 0) {
      const d = Math.abs(c) + Math.abs(s);
      secA.push(mix(c, c / d, section));
      secB.push(mix(s, s / d, section));
    } else {
      const m = Math.max(Math.abs(c), Math.abs(s));
      secA.push(mix(c, c / m, -section));
      secB.push(mix(s, s / m, -section));
    }
  }

  const rings = 2 * n + 1;
  const stride = radial + 1;
  const pos = new Float32Array(rings * stride * 3);
  const uv = new Float32Array(rings * stride * 2);
  let p = 0;
  let w = 0;
  for (let r = 0; r < rings; r++) {
    const i = r < n ? n - r : r - n;
    const side = r < n ? -1 : 1;
    const th = theta(ts[i]);
    const nx = -side * Math.sin(th);
    const ny = Math.cos(th);
    const ox = side * cx[i];
    const oy = cy[i];
    for (let k = 0; k <= radial; k++) {
      const a = hy[i] * secA[k];
      pos[p++] = ox + nx * a;
      pos[p++] = oy + ny * a;
      pos[p++] = hz[i] * secB[k];
      uv[w++] = r / (rings - 1);
      uv[w++] = k / radial;
    }
  }
  const index: number[] = [];
  for (let r = 0; r < rings - 1; r++) {
    for (let k = 0; k < radial; k++) {
      const a = r * stride + k;
      const b = (r + 1) * stride + k;
      const c = r * stride + k + 1;
      const d = (r + 1) * stride + k + 1;
      index.push(a, c, b);
      index.push(b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(index);
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return { geometry, halfHeight: hy0 };
}
