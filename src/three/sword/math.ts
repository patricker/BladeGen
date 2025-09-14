import * as THREE from 'three'
import type { BladeParams } from './types'

/**
 * Shared math helpers for blade geometry and dynamics.
 *
 * Centralizes param-driven computations so geometry modules and dynamics share
 * identical behavior. All functions are pure and unit-testable.
 */

/** Compute lateral X bend offset at longitudinal position y. */
export function bendOffsetX(b: BladeParams, y: number, L: number): number {
  const t = THREE.MathUtils.clamp(L > 0 ? y / L : 0, 0, 1)
  const prof = b.soriProfile ?? 'torii'
  const bias = b.soriBias ?? 0.8
  let a = 1, c = 1
  if (prof === 'koshi') { a = bias; c = 1 }
  else if (prof === 'saki') { a = 1; c = bias }
  const shape = Math.pow(t, a) * Math.pow(1 - t, c)
  const peak = Math.pow(a / (a + c), a) * Math.pow(c / (a + c), c)
  const norm = peak > 1e-6 ? shape / peak : shape
  const curved = -(b.curvature || 0) * 0.25 * norm * L
  const linear = Math.tan(b.baseAngle ?? 0) * y
  return curved + linear
}

/**
 * Compute width at a normalized longitudinal position with optional kissaki
 * segment controlling the final taper curve.
 */
export function tipWidthWithKissaki(b: BladeParams, t: number, baseW: number, tipW: number): number {
  const kf = THREE.MathUtils.clamp(b.kissakiLength ?? 0, 0, 0.35)
  let w: number
  if (kf <= 1e-6) {
    w = baseW + (tipW - baseW) * t
  } else {
    const split = 1 - kf
    const midW = baseW + (tipW - baseW) * split
    if (t <= split) {
      w = baseW + (midW - baseW) * (t / Math.max(1e-6, split))
    } else {
      const u = (t - split) / Math.max(1e-6, kf)
      let r = THREE.MathUtils.clamp(b.kissakiRoundness ?? 0.5, 0, 1)
      if (b.tipShape === 'rounded') r = 1
      let expo = THREE.MathUtils.lerp(0.5, 3.0, 1 - r)
      switch (b.tipShape) {
        case 'tanto': expo = 2.2; break
        case 'clip': expo = 0.8; break
        case 'spear': expo = 1.4; break
        case 'sheepsfoot': expo = 3.0; break
      }
      const eased = Math.pow(u, expo)
      w = midW + (tipW - midW) * eased
    }
  }
  if (b.tipShape === 'leaf') {
    const bulge = THREE.MathUtils.clamp(b.tipBulge ?? 0.2, 0, 1)
    const bell = 4 * t * (1 - t)
    w *= 1 + bulge * bell
  }
  return w
}

/** Evaluate distal taper scale at t based on piecewise linear points. */
export function thicknessScaleAt(b: BladeParams, t: number): number {
  const pts = (b.thicknessProfile?.points && b.thicknessProfile.points.length >= 2)
    ? b.thicknessProfile.points.slice().sort((a, c) => a[0] - c[0])
    : [[0, 1], [1, 1]] as Array<[number, number]>
  const tt = Math.max(0, Math.min(1, t))
  let i = 0; while (i < pts.length - 1 && !(tt >= pts[i][0] && tt <= pts[i + 1][0])) i++
  const [t0, s0] = pts[Math.max(0, Math.min(i, pts.length - 2))]
  const [t1, s1] = pts[Math.min(i + 1, pts.length - 1)]
  if (t1 === t0) return s0
  const a = (tt - t0) / (t1 - t0)
  return (THREE as any).MathUtils.lerp(s0, s1, a)
}

/** Serration waveforms used by blade edge features. */
export function serrationWave(t: number, freq: number, amp: number, pattern: BladeParams['serrationPattern'], seed: number): number {
  if (!amp || !freq) return 0
  const ph = t * Math.PI * freq
  switch (pattern) {
    case 'saw': {
      const k = ph / Math.PI
      return amp * (2 * (k - Math.floor(k + 0.5)))
    }
    case 'scallop':
      return amp * (1 - Math.abs(Math.sin(ph)))
    case 'random':
      return amp * (Math.sin(ph * 1.7 + seed * 0.1) + Math.sin(ph * 2.3 + seed * 0.2)) * 0.5
    default:
      return amp * Math.sin(ph)
  }
}

