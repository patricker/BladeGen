import * as THREE from 'three';
import type { BladeParams, BladeWaviness } from './types';

function sampleProfile(points: Array<[number, number]>, t: number): number {
  if (!points.length) return 0;
  const tt = Math.max(0, Math.min(1, t));
  let lo = points[0];
  let hi = points[points.length - 1];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (tt >= a[0] && tt <= b[0]) {
      lo = a;
      hi = b;
      break;
    }
    if (tt > b[0]) {
      lo = b;
      hi = points[Math.min(i + 2, points.length - 1)];
    }
  }
  const range = Math.max(1e-6, hi[0] - lo[0]);
  const alpha = Math.max(0, Math.min(1, (tt - lo[0]) / range));
  return THREE.MathUtils.lerp(lo[1], hi[1], alpha);
}

/**
 * Shared math helpers for blade geometry and dynamics.
 *
 * Centralizes param-driven computations so geometry modules and dynamics share
 * identical behavior. All functions are pure and unit-testable.
 */

/** Compute lateral X bend offset at longitudinal position y. */
export function bendOffsetX(b: BladeParams, y: number, L: number): number {
  const t = THREE.MathUtils.clamp(L > 0 ? y / L : 0, 0, 1);
  const prof = b.soriProfile ?? 'torii';
  const bias = b.soriBias ?? 0.8;
  let a = 1,
    c = 1;
  if (prof === 'koshi') {
    a = bias;
    c = 1;
  } else if (prof === 'saki') {
    a = 1;
    c = bias;
  }
  const shape = Math.pow(t, a) * Math.pow(1 - t, c);
  const peak = Math.pow(a / (a + c), a) * Math.pow(c / (a + c), c);
  const norm = peak > 1e-6 ? shape / peak : shape;
  const curved = -(b.curvature || 0) * 0.25 * norm * L;
  const linear = Math.tan(b.baseAngle ?? 0) * y;
  let profile = 0;
  if (b.curveProfile?.points && b.curveProfile.points.length >= 2) {
    const val = sampleProfile(b.curveProfile.points, t);
    const mode = b.curveProfile.mode ?? 'absolute';
    const scale = b.curveProfile.scale ?? 1;
    profile = val * scale * (mode === 'relative' ? L : 1);
  }
  return curved + linear + profile;
}

/**
 * Compute width at a normalized longitudinal position with optional kissaki
 * segment controlling the final taper curve.
 */
export function tipWidthWithKissaki(
  b: BladeParams,
  t: number,
  baseW: number,
  tipW: number
): number {
  const rampStart = THREE.MathUtils.clamp(b.tipRampStart ?? 0, 0, 0.98);
  const span = 1 - rampStart;
  const rawKf = THREE.MathUtils.clamp(b.kissakiLength ?? 0, 0, 0.35);
  const localKf = span > 1e-6 ? Math.min(1, rawKf / span) : 0;
  const localT = span > 1e-6 ? THREE.MathUtils.clamp((t - rampStart) / span, 0, 1) : 1;

  let w: number;
  if (rampStart > 1e-6 && t < rampStart) {
    w = baseW;
  } else if (localKf <= 1e-6) {
    w = baseW + (tipW - baseW) * localT;
  } else {
    const split = Math.max(0, 1 - localKf);
    const midW = baseW + (tipW - baseW) * split;
    if (split > 1e-6 && localT <= split) {
      w = baseW + (midW - baseW) * (localT / split);
    } else {
      const u = (localT - split) / Math.max(1e-6, localKf);
      let r = THREE.MathUtils.clamp(b.kissakiRoundness ?? 0.5, 0, 1);
      if (b.tipShape === 'rounded') r = 1;
      let expo = THREE.MathUtils.lerp(0.5, 3.0, 1 - r);
      switch (b.tipShape) {
        case 'tanto':
          expo = 2.2;
          break;
        case 'clip':
          expo = 0.8;
          break;
        case 'spear':
          expo = 1.4;
          break;
        case 'sheepsfoot':
          expo = 3.0;
          break;
      }
      const eased = Math.pow(u, expo);
      w = midW + (tipW - midW) * eased;
    }
  }
  if (b.tipShape === 'leaf') {
    const bulge = THREE.MathUtils.clamp(b.tipBulge ?? 0.2, 0, 1);
    const bell = 4 * t * (1 - t);
    w *= 1 + bulge * bell;
  }
  if (b.widthProfile?.points && b.widthProfile.points.length >= 2) {
    const val = sampleProfile(b.widthProfile.points, THREE.MathUtils.clamp(t, 0, 1));
    const mode = b.widthProfile.mode ?? 'scale';
    if (mode === 'absolute') {
      w = val;
    } else {
      w *= val;
    }
  }
  w = Math.max(0.0005, w);
  return w;
}

/** Evaluate distal taper scale at t based on piecewise linear points. */
export function thicknessScaleAt(b: BladeParams, t: number): number {
  const pts =
    b.thicknessProfile?.points && b.thicknessProfile.points.length >= 2
      ? b.thicknessProfile.points.slice().sort((a, c) => a[0] - c[0])
      : ([
          [0, 1],
          [1, 1],
        ] as Array<[number, number]>);
  const tt = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < pts.length - 1 && !(tt >= pts[i][0] && tt <= pts[i + 1][0])) i++;
  const [t0, s0] = pts[Math.max(0, Math.min(i, pts.length - 2))];
  const [t1, s1] = pts[Math.min(i + 1, pts.length - 1)];
  if (Math.abs(t1 - t0) < 1e-10) return s0;
  const a = (tt - t0) / (t1 - t0);
  return (THREE as any).MathUtils.lerp(s0, s1, a);
}

const computeWavinessWave = (waviness: BladeWaviness, t: number) => {
  const taper = waviness.taper ?? 0;
  const envelope = taper > 0 ? Math.pow(Math.max(0, 1 - t), taper) : 1;
  const phase = waviness.phase ?? 0;
  const wave = Math.sin(t * waviness.frequency * Math.PI * 2 + phase) * waviness.amplitude;
  return { wave: wave * envelope, envelope };
};

/**
 * Sample the waviness profile, returning centerline and width offsets.
 */
export function wavinessAt(b: BladeParams, t: number): { center: number; width: number } {
  if (!b.waviness) return { center: 0, width: 0 };
  const { wave, envelope } = computeWavinessWave(b.waviness, t);
  const offset = (b.waviness.offset ?? 0) * envelope;
  switch (b.waviness.mode) {
    case 'centerline':
      return { center: wave + offset, width: 0 };
    case 'both':
      return { center: wave + offset, width: wave };
    default:
      return { center: offset, width: wave };
  }
}

/** Serration waveforms used by blade edge features. */
export function serrationWave(
  t: number,
  freq: number,
  amp: number,
  pattern: BladeParams['serrationPattern'],
  seed: number,
  sharpness = 0,
  bias = 0
): number {
  if (!amp || !freq) return 0;
  const sharp = THREE.MathUtils.clamp(sharpness, 0, 1);
  const biasClamped = THREE.MathUtils.clamp(bias, -1, 1);
  const phase = biasClamped * Math.PI * 0.5;
  const ph = t * Math.PI * freq + phase;

  let value: number;
  switch (pattern) {
    case 'saw': {
      const k = ph / Math.PI;
      const frac = k - Math.floor(k);
      const skew = THREE.MathUtils.clamp(0.5 + 0.45 * biasClamped, 0.05, 0.95);
      let normalized: number;
      if (frac <= skew) {
        normalized = frac / Math.max(skew, 1e-6);
      } else {
        normalized = 1 - (frac - skew) / Math.max(1e-6, 1 - skew);
      }
      value = normalized * 2 - 1;
      break;
    }
    case 'scallop': {
      const s = Math.sin(ph);
      value = 1 - Math.abs(s);
      value = value * 2 - 1;
      break;
    }
    case 'random': {
      const a = Math.sin(ph * 1.7 + seed * 0.1);
      const b = Math.sin(ph * 2.3 + seed * 0.2);
      value = (a + b) * 0.5;
      break;
    }
    default: {
      value = Math.sin(ph);
    }
  }

  if (sharp > 0) {
    const pow = 1 - sharp * 0.7;
    value = Math.sign(value) * Math.pow(Math.abs(value), pow);
  }

  return amp * value;
}
