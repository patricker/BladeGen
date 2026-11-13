import * as THREE from 'three';
import type { PommelParams } from '../types';
import { callCore, toGeometry } from '../core/wasm';

/**
 * Monument pommel styles (SW10), built from the stroke kernel (bladegen-core
 * `monument.rs`; BG1: the geometry is the core's, through the wasm module). With se = the pommel's effective size (the same
 * `sizeEff` as every pommel: lerp(size, auto, balance) clamped to 0.05..1), e = clamp(elongation, 0.5, 2),
 * m = shapeMorph. Pommel-local space: the attachment point (the grip's end) at the origin, -Y away from the blade
 * (skyward when the monument stands tip down). The mesh sits at (offsetX, gripBottom + 0.04 * se + offsetY, 0).
 *
 * Part order (each right-hand part followed by its mirror):
 * - gem:      one stroke down the axis, hexagonal (radial 6, round section), a 'gem' size law and a point.
 * - sunwheel: ring; axis bar; rays k = 0..spikes-1 at -pi/2 + 2 pi k / spikes, skipping those within 0.6 rad of
 *             +pi/2 (the grip).
 * - horned:   bulb (knob tip); horn R, horn L turning toward -Y.
 * - tiered:   tiers 0..n-1 (n = clamp(round(crownSpikes), 3, 5)); spire.
 */
export const MONUMENT_POMMEL_STYLES = ['gem', 'sunwheel', 'horned', 'tiered'] as const;
export type MonumentPommelStyle = (typeof MONUMENT_POMMEL_STYLES)[number];

export function isMonumentPommelStyle(s: unknown): s is MonumentPommelStyle {
  return (MONUMENT_POMMEL_STYLES as readonly unknown[]).includes(s);
}

export function buildMonumentPommelGeometry(p: PommelParams, se: number): THREE.BufferGeometry {
  const r = callCore('pommel_monument', { pommel: p, se });
  return toGeometry(r, r.meshes[0], ['index', 'position', 'uv', 'normal']);
}
