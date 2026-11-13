import * as THREE from 'three';
import type { BladeGlow, BladeParams } from './types';
import { callCore, toGeometry } from './core/wasm';

/**
 * Exportable blade glow channel.
 *
 * The blade mesh from `buildBladeGeometry` is a regular grid: `segs + 1` rows
 * along the length (t = i / segs) by `BLADE_GRID_COLS + 1` columns across the
 * width (s = j / cols), with two vertices per grid point (side 0 = front at -Z,
 * side 1 = back at +Z). Vertex index = i * (cols + 1) * 2 + j * 2 + side.
 *
 * The geometry is bladegen-core's (BG1: `crates/bladegen-core/src/glow.rs` and `blade.rs`, through the wasm
 * module): the blade's grid UVs (u = s, v = t) and COLOR_0 mask (an edge band plus a core band, from s only) come
 * with `buildBladeGeometry` when the glow is on, and `buildBladeGlowGeometry` returns the emissive edge strips and
 * seeded rune strokes laid on the blade's own triangles. The algorithm is documented in docs/HEADLESS.md.
 */

/** Columns across the blade cross-section (bladegen-core `blade::COLS`). */
export const BLADE_GRID_COLS = 12;

/** Longitudinal segment count used by `buildBladeGeometry` for these params. */
export function bladeGridSegments(b: BladeParams): number {
  return Math.max(16, Math.min(512, Math.round(b.sweepSegments ?? 128)));
}

/**
 * The glow mesh for a blade (edge strips and rune strokes, emissive), or null when the glow is off or empty.
 * `bladeGeo` is the blade's own geometry; the core rebuilds the same blade from `b`, so it is not read.
 */
export function buildBladeGlowGeometry(
  b: BladeParams,
  _bladeGeo?: THREE.BufferGeometry
): THREE.BufferGeometry | null {
  const glow = b.glow;
  if (!glow || glow.enabled === false) return null;
  const r = callCore<boolean>('glow', b);
  if (!r.value) return null;
  return toGeometry(r, r.meshes[0], ['position', 'normal', 'uv', 'color', 'index'], {
    boundingBox: true,
    float32Attribute: true,
  });
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
