import * as THREE from 'three';
import type { PommelParams } from '../types';
import {
  mergeParts,
  mirrorPart,
  ringPart,
  sectionOutline,
  strokePart,
  type Part,
  type Stroke,
} from './strokes';

/**
 * Monument pommel styles (SW10), built from the stroke kernel. With se = the pommel's effective size (the same
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

const DOWN = -Math.PI / 2;
const RADIAL = 16;

export function buildMonumentPommelGeometry(p: PommelParams, se: number): THREE.BufferGeometry {
  const e = Math.min(2, Math.max(0.5, p.elongation));
  const m = p.shapeMorph ?? 0;
  const parts: Part[] = [];
  if (p.style === 'gem') {
    const sec = sectionOutline(0, 6);
    parts.push(
      strokePart(
        {
          x: 0,
          y: 0,
          heading: DOWN,
          length: se * 2 * e,
          hy: se * 0.75,
          hz: se * 0.75,
          size: { kind: 'gem', top: 0.45, waist: 0.3 + 0.15 * m, taper: 0.12 },
          tip: 'point',
          segments: 6,
        },
        sec
      )
    );
  } else if (p.style === 'sunwheel') {
    const sec = sectionOutline(0.4, RADIAL);
    const R = se * 1.1;
    const tube = se * 0.16;
    parts.push(ringPart({ cx: 0, cy: -R, radius: R, hy: tube, hz: tube, segments: 48 }, sec));
    parts.push(
      strokePart(
        {
          x: 0,
          y: 0,
          heading: DOWN,
          length: 2 * R,
          hy: se * 0.14,
          hz: se * 0.14,
          size: { kind: 'taper', taper: 1 },
          tip: 'flat',
          segments: 2,
        },
        sec
      )
    );
    const spikes = Math.max(3, Math.round(p.crownSpikes ?? 8));
    const sharp = Math.min(1, Math.max(0, p.crownSharpness ?? 0.6));
    for (let k = 0; k < spikes; k++) {
      const a = DOWN + (2 * Math.PI * k) / spikes;
      // distance to straight up the grip (+pi/2), folded into 0..pi
      let dist = Math.abs(a - Math.PI / 2);
      if (dist > Math.PI) dist = 2 * Math.PI - dist;
      if (dist < 0.6) continue;
      parts.push(
        strokePart(
          {
            x: R * Math.cos(a),
            y: -R + R * Math.sin(a),
            heading: a,
            length: se * (0.5 + 0.7 * sharp),
            hy: se * 0.13,
            hz: se * 0.13,
            size: { kind: 'taper', taper: 0.2 },
            tip: 'point',
            segments: 4,
          },
          sec
        )
      );
    }
  } else if (p.style === 'horned') {
    const sec = sectionOutline(0.3, RADIAL);
    parts.push(
      strokePart(
        {
          x: 0,
          y: 0,
          heading: DOWN,
          length: se * 0.9,
          hy: se * 0.45,
          hz: se * 0.45,
          size: { kind: 'taper', taper: 1 },
          tip: 'knob',
          knob: 0.3,
          segments: 6,
        },
        sec
      )
    );
    const horn: Stroke = {
      x: se * 0.3,
      y: -se * 0.45,
      heading: 0,
      length: se * 2.2 * e,
      bend: -(1.6 + 0.6 * m),
      hy: se * 0.28,
      hz: se * 0.28,
      size: { kind: 'taper', taper: 0.15, belly: true },
      tip: 'point',
      segments: 16,
    };
    const h = strokePart(horn, sec);
    parts.push(h, mirrorPart(h));
  } else {
    // tiered
    const sec = sectionOutline(-0.85, RADIAL);
    const n = Math.min(5, Math.max(3, Math.round(p.crownSpikes ?? 3)));
    const th = se * 0.32;
    let y = -0.5 * th;
    for (let t = 0; t < n; t++) {
      const v = t / (n - 1);
      const w = se * (1.2 - 0.6 * v);
      parts.push(
        strokePart(
          {
            x: -w,
            y,
            heading: 0,
            length: 2 * w,
            hy: 0.5 * th,
            hz: w * 0.8,
            size: { kind: 'taper', taper: 1 },
            tip: 'flat',
            segments: 2,
          },
          sec
        )
      );
      y = y - th;
    }
    parts.push(
      strokePart(
        {
          x: 0,
          y: y + 0.5 * th,
          heading: DOWN,
          length: se * 1.4 * e,
          hy: se * 0.3,
          hz: se * 0.3,
          size: { kind: 'taper', taper: 0.6 },
          tip: 'point',
          segments: 4,
        },
        sec
      )
    );
  }
  return mergeParts(parts);
}
