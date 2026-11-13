import * as THREE from 'three';
import type { BladeParams, GuardMonumentParams, GuardParams } from '../types';
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
 * Monument guard styles (SW10): six crossguards with distinct silhouettes at 30-42 m, all built from the stroke
 * kernel (strokes.ts) and sized from the blade like the `forged` cross: with bw = blade base width, bt = the larger
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
const base: Defaults = {
  height: 0.42,
  depth: 2.4,
  block: 0.55,
  swell: 1.25,
  taper: 0.3,
  sweep: 0,
  count: 3,
  spike: 0.7,
  ring: 0.65,
  knob: 0,
  section: 0.5,
  segments: 24,
  radial: 16,
};
/** Per-style defaults (validation writes the whole block back from these). */
export const MONUMENT_GUARD_DEFAULTS: Record<MonumentGuardStyle, Defaults> = {
  recurve: { ...base, height: 0.4, taper: 0.32, sweep: 0.9, section: 0.7, segments: 32 },
  crescent: {
    ...base,
    height: 0.46,
    swell: 1.08,
    taper: 0.12,
    sweep: -1.9,
    section: 0.5,
    segments: 32,
  },
  halo: { ...base, height: 0.4, taper: 0.2, count: 3, spike: 0.7, ring: 0.65, section: 0.8 },
  wings: { ...base, depth: 1.9, swell: 1.1, taper: 0.24, sweep: 1.0, count: 4, section: -0.3 },
  talon: {
    ...base,
    height: 0.54,
    depth: 2.7,
    swell: 1.08,
    taper: 0.09,
    sweep: 2.2,
    count: 2,
    section: 0.6,
  },
  ziggurat: {
    ...base,
    height: 0.5,
    depth: 2.5,
    block: 0.6,
    swell: 1,
    taper: 0.78,
    count: 3,
    spike: 1.0,
    section: -0.9,
  },
};

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export type MonumentGuardBuild = { geometry: THREE.BufferGeometry; halfHeight: number };

/** The guard's geometry in guard-local space (see the file comment). */
export function buildMonumentGuardGeometry(
  g: GuardParams,
  blade?: BladeParams | null
): MonumentGuardBuild {
  const style = g.style as MonumentGuardStyle;
  const d = MONUMENT_GUARD_DEFAULTS[style] ?? MONUMENT_GUARD_DEFAULTS.recurve;
  const m = g.monument ?? {};
  const height = m.height ?? d.height;
  const depth = m.depth ?? d.depth;
  const block = m.block ?? d.block;
  const swell = m.swell ?? d.swell;
  const taper = m.taper ?? d.taper;
  const sweep = m.sweep ?? d.sweep;
  const count = Math.max(1, Math.round(m.count ?? d.count));
  const spike = m.spike ?? d.spike;
  const ring = m.ring ?? d.ring;
  const knob = m.knob ?? d.knob;
  const section = m.section ?? d.section;
  const segs = Math.max(4, Math.round(m.segments ?? d.segments));
  const radial = Math.max(4, Math.round(m.radial ?? d.radial));

  const bw = blade?.baseWidth ?? 0.25;
  const bt = Math.max(blade?.thicknessLeft ?? 0.08, blade?.thicknessRight ?? 0.08);
  const half = Math.max(0.1, g.width * 0.5);
  const hy0 = 0.5 * height * bw;
  const hz0 = 0.5 * depth * bt;
  const bl = block * bw;
  const hyR = hy0 / swell;
  const hzR = hz0 / swell;
  const sec = sectionOutline(section, radial);
  const parts: Part[] = [];
  const pair = (st: Stroke) => {
    const p = strokePart(st, sec);
    parts.push(p, mirrorPart(p));
  };
  const blockStroke = (): Stroke => ({
    x: -bl,
    y: 0,
    heading: 0,
    length: 2 * bl,
    hy: hy0,
    hz: hz0,
    size: { kind: 'taper', taper: 1 },
    tip: 'flat',
    segments: 2,
  });
  const armTip = knob > 0 ? ('knob' as const) : ('point' as const);

  if (style === 'ziggurat') {
    // tiers stacked toward the grip, each as tall as the block at the bottom and 0.6 of it at the top
    let yc = 0;
    let hPrev = 0;
    for (let t = 0; t < count; t++) {
      const v = count > 1 ? t / (count - 1) : 0;
      const ht = Math.max(1.2 * bl, mix(half, Math.max(1.2 * bl, 0.35 * half), v));
      const hh = hy0 * mix(1, 0.6, v);
      if (t > 0) yc = yc - hPrev - hh;
      hPrev = hh;
      parts.push(
        strokePart(
          {
            x: -ht,
            y: yc,
            heading: 0,
            length: 2 * ht,
            hy: hh,
            hz: hz0 * (1 - 0.12 * t),
            size: { kind: 'taper', taper: 1 },
            tip: 'flat',
            segments: 2,
          },
          sec
        )
      );
    }
    // obelisks at the ends of the bottom tier, rising toward the grip from its blade-side face
    const pw = 0.42 * hy0;
    pair({
      x: half - pw,
      y: hy0,
      heading: -Math.PI / 2,
      length: 2 * hy0 + spike * 4 * hy0,
      hy: pw,
      hz: 0.85 * hz0,
      size: { kind: 'taper', taper },
      tip: 'point',
      segments: 4,
    });
    return finish(parts, hy0);
  }

  parts.push(strokePart(blockStroke(), sec));
  const x0 = 0.5 * bl;
  if (style === 'recurve') {
    const sgn = sweep >= 0 ? 1 : -1;
    pair({
      x: x0,
      y: 0,
      heading: -0.45 * sweep,
      length: (half - x0) * 1.08,
      bend: 1.5 * sweep,
      hy: hyR,
      hz: hzR,
      size: { kind: 'taper', taper },
      tip: armTip,
      knob,
      segments: segs,
    });
    // counter-quillons swept the other way, so the cross reads as an X at distance
    pair({
      x: x0,
      y: 0,
      heading: -0.9 * sgn,
      length: 0.45 * (half - x0),
      bend: -0.4 * sgn,
      hy: hyR * 0.75,
      hz: hzR * 0.85,
      size: { kind: 'taper', taper },
      tip: 'point',
      segments: Math.max(4, Math.round(segs / 2)),
    });
  } else if (style === 'crescent') {
    pair({
      x: 0.4 * bl,
      y: 0,
      heading: 0.25,
      length: half * 1.25,
      turn: 0.55 * sweep,
      bend: 0.45 * sweep,
      hy: hyR * 1.3,
      hz: hzR,
      size: { kind: 'taper', taper, belly: true },
      tip: armTip,
      knob,
      segments: segs,
    });
  } else if (style === 'halo') {
    const R = Math.max(ring * half, 1.3 * bl);
    parts.push(
      ringPart({ cx: 0, cy: 0, radius: R, hy: hyR * 0.6, hz: hzR * 0.8, segments: 2 * segs }, sec)
    );
    pair({
      x: x0,
      y: 0,
      heading: 0,
      length: R - x0,
      hy: hyR * 0.8,
      hz: hzR * 0.9,
      size: { kind: 'taper', taper: 1 },
      tip: 'flat',
      segments: 2,
    });
    const A = 1.05;
    for (let i = 0; i < count; i++) {
      const w = (2 * (i + 0.5)) / count - 1;
      const a = A * w;
      pair({
        x: R * Math.cos(a),
        y: R * Math.sin(a),
        heading: a,
        length: spike * R * (1 - 0.45 * Math.abs(w)),
        bend: 0.3 * sweep,
        hy: hyR * 0.75,
        hz: hzR * 0.7,
        size: { kind: 'taper', taper },
        tip: 'point',
        segments: Math.max(4, Math.round(segs / 3)),
      });
    }
  } else if (style === 'wings') {
    for (let i = 0; i < count; i++) {
      const v = count > 1 ? i / (count - 1) : 0;
      pair({
        x: x0 * 0.8,
        y: 0,
        z: hzR * 0.25 * (v - 0.5),
        heading: -v * sweep,
        length: half * 1.05 * mix(1, 0.62, v),
        bend: 0.3,
        hy: hyR * 1.25 * mix(1, 0.7, v),
        hz: hzR * 0.45,
        size: { kind: 'taper', taper },
        tip: 'point',
        segments: segs,
      });
    }
  } else if (style === 'talon') {
    for (let i = 0; i < count; i++) {
      const v = count > 1 ? i / (count - 1) : 0.5;
      pair({
        x: 1.2 * x0,
        y: 0.2 * hy0,
        heading: mix(-0.35, 0.45, v),
        length: half * mix(1, 0.72, v),
        bend: sweep,
        hy: hyR * mix(1, 0.8, v),
        hz: hzR * 0.9,
        size: { kind: 'taper', taper, belly: true },
        tip: 'point',
        segments: segs,
      });
    }
  }
  return finish(parts, hy0);
}

function finish(parts: Part[], hy0: number): MonumentGuardBuild {
  return { geometry: mergeParts(parts), halfHeight: hy0 };
}
