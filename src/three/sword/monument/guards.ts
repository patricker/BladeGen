import * as THREE from 'three';
import type { BladeParams, GuardMonumentParams, GuardParams } from '../types';
import { callCore, toGeometry } from '../core/wasm';
import { bladeOrDefault } from '../guardForged';

/**
 * Monument guard styles (SW10): six crossguards with distinct silhouettes at 30-42 m, all built from the stroke
 * kernel (bladegen-core `monument.rs`; BG1: the geometry is the core's, through the wasm module) and sized from the blade like the `forged` cross: with bw = blade base width, bt = the larger
 * blade thickness, half = max(0.1, guard.width / 2):
 *   hy0 = 0.5 * height * bw (the centre block's half-height along the blade), hz0 = 0.5 * depth * bt,
 *   bl = block * bw (the block's half-length), hyR = hy0 / swell, hzR = hz0 / swell (arm roots).
 * Guard-local space: the block's centre at the origin, span along X, +Y toward the blade. The mesh sits at
 * (0, guardLine - hy0, 0) with rotation.z = tilt, so the block's blade-side face is on the guard line.
 *
 * Part order (the port must emit the same order; each right-hand part is followed by its mirror):
 * - recurve:  block; arm R, arm L; counter R, counter L. S-swept arms (they dip one way, then turn the other by
 *             `sweep`) and short counter-quillons swept against them: an X at distance.
 * - crescent: block; horn R, horn L. Thick horns turning by `sweep` (negative = toward the grip, skyward).
 * - halo:     block; ring; bar R, bar L; for each ray i: ray R, ray L. A sun disc: a ring round the blade's base,
 *             crossed by the bar, with `count` rays per side.
 * - wings:    block; for each feather i: feather R, feather L. A fan of `count` flat feathers per side.
 * - talon:    block; for each talon i: talon R, talon L. Hooked claws turning toward the blade (the ground).
 * - ziggurat: tiers 0..count-1 (no block); pylon R, pylon L. Stepped slabs toward the grip and two obelisks.
 */

export const MONUMENT_GUARD_STYLES = [
  'recurve',
  'crescent',
  'halo',
  'wings',
  'talon',
  'ziggurat',
] as const;
export type MonumentGuardStyle = (typeof MONUMENT_GUARD_STYLES)[number];

export function isMonumentGuardStyle(s: unknown): s is MonumentGuardStyle {
  return (MONUMENT_GUARD_STYLES as readonly unknown[]).includes(s);
}

type Defaults = Required<GuardMonumentParams>;
/** Per-style defaults (validation writes the whole block back from these): bladegen-core `monument::guard_defaults`. */
export const MONUMENT_GUARD_DEFAULTS: Record<MonumentGuardStyle, Defaults> = Object.freeze(
  callCore<Record<MonumentGuardStyle, Defaults>>('guard_defaults').value
);

export type MonumentGuardBuild = { geometry: THREE.BufferGeometry; halfHeight: number };

/** The guard's geometry in guard-local space (see the file comment). */
export function buildMonumentGuardGeometry(
  g: GuardParams,
  blade?: BladeParams | null
): MonumentGuardBuild {
  const r = callCore<{ halfHeight: number }>('guard_monument', { guard: g, blade: bladeOrDefault(blade) });
  return { geometry: toGeometry(r, r.meshes[0], ['index', 'position', 'uv', 'normal']), halfHeight: r.value.halfHeight };
}
