import * as THREE from 'three';
import type { BladeParams, GuardParams } from './types';
import { callCore, toGeometry } from './core/wasm';

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
 * The geometry is bladegen-core's (BG1: `hilt::forged_guard_geometry`, through the wasm module); the algorithm is
 * documented there and in docs/HEADLESS.md:
 * - arc-length stations along one arm: S + 1 arm rings at t = t0 * i / S, then CAP rings at
 *   t = tk - rk * cos(pi * j / CAP) (j = 1..CAP) over the finial;
 * - the centre line turns by theta(t) = curl * (t / half)^2 and is integrated from the centre with
 *   SUBSTEPS midpoint steps per station interval, in f64, in this order;
 * - rings run left tip -> centre -> right tip; each ring has radial + 1 vertices (a seam copy, as
 *   three's primitives), uv = (ring / (rings - 1), k / radial); computeVertexNormals.
 */

/** Defaults (validation writes them back explicitly): bladegen-core's `families::forged_defaults`. */
export const FORGED_DEFAULTS = Object.freeze(
  callCore<{
    height: number;
    depth: number;
    block: number;
    swell: number;
    taper: number;
    curl: number;
    finial: number;
    section: number;
    segments: number;
    radial: number;
  }>('forged_defaults').value
);
/** Rings over each finial (a knob, or the rounded end when finial = 0): bladegen-core `hilt::FORGED_CAP_RINGS`. */
export const FORGED_CAP_RINGS = 10;
/** Midpoint sub-steps per station interval (`hilt::FORGED_SUBSTEPS`). */
export const FORGED_SUBSTEPS = 4;
/** Length of the block-to-arm blend, as a fraction of the half span (`hilt::FORGED_BLEND`). */
export const FORGED_BLEND = 0.12;

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
  const r = callCore<{ halfHeight: number }>('guard_forged', { guard: g, blade: bladeOrDefault(blade) });
  return { geometry: toGeometry(r, r.meshes[0], ['index', 'position', 'uv', 'normal']), halfHeight: r.value.halfHeight };
}

/**
 * The blade the guard is sized from. Without one the builders used `baseWidth ?? 0.25` and the thickness
 * defaults (0.08); a blade with those values gives the same sizes in the core.
 */
export function bladeOrDefault(blade?: BladeParams | null): Partial<BladeParams> {
  return blade ?? { length: 3, baseWidth: 0.25, tipWidth: 0.05, thickness: 0.08 };
}
