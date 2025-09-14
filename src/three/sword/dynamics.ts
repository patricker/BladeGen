import * as THREE from 'three'
import type { BladeParams } from './types'
/**
 * Blade dynamics approximations.
 *
 * Provides a lightweight, parameter-based estimate of mass (proxy), center of
 * mass, inertias, and center of percussion without sampling actual mesh data.
 * The goal is responsiveness and determinism for UI feedback rather than
 * physically exact values.
 */

// Local copy of tipWidthWithKissaki to avoid tight coupling for now.
function tipWidthWithKissaki(b: BladeParams, t: number, baseW: number, tipW: number): number {
  const kf = THREE.MathUtils.clamp(b.kissakiLength ?? 0, 0, 0.35)
  if (kf <= 1e-6) {
    return baseW + (tipW - baseW) * t
  }
  const split = 1 - kf
  const midW = baseW + (tipW - baseW) * split
  if (t <= split) {
    return baseW + (midW - baseW) * (t / Math.max(1e-6, split))
  }
  const u = (t - split) / Math.max(1e-6, kf)
  let r = THREE.MathUtils.clamp(b.kissakiRoundness ?? 0.5, 0, 1)
  if (b.tipShape === 'rounded') r = 1
  let expo = THREE.MathUtils.lerp(0.5, 3.0, 1 - r)
  switch (b.tipShape) {
    case 'tanto': expo = 2.2; break
    case 'clip': expo = 0.8; break
    case 'spear': expo = 1.2; break
    case 'sheepsfoot': expo = 0.6; break
    case 'leaf': expo *= 1.1; break
    default: break
  }
  const s = Math.pow(1 - u, expo)
  return tipW + (midW - tipW) * s
}

/**
 * Lightweight blade dynamics approximation based on geometry parameters.
 * Returns mass proxy, center of mass Y, base and CM inertias, and center of percussion Y.
 */
export function computeBladeDynamics(b: BladeParams) {
  const L = Math.max(0.001, b.length)
  const n = 200
  const TL0 = Math.max(0.001, b.thicknessLeft ?? b.thickness ?? 0.08)
  const TR0 = Math.max(0.001, b.thicknessRight ?? b.thickness ?? 0.08)
  const tipW = Math.max(0, b.tipWidth)
  const baseW = Math.max(0.002, b.baseWidth)
  const serr = (t:number, freq:number, amp:number, pattern: BladeParams['serrationPattern'], seed:number) => {
    if (!amp || !freq) return 0
    const ph = t * Math.PI * freq
    switch(pattern){
      case 'saw': { const k = ph/Math.PI; return amp * (2*(k - Math.floor(k+0.5))) }
      case 'scallop': return amp * (1 - Math.abs(Math.sin(ph)))
      case 'random': return amp * (Math.sin(ph*1.7+seed*0.1)+Math.sin(ph*2.3+seed*0.2))*0.5
      default: return amp * Math.sin(ph)
    }
  }
  const serrAmp = b.serrationAmplitude ?? 0
  const serrAmpL = b.serrationAmplitudeLeft ?? serrAmp
  const serrAmpR = b.serrationAmplitudeRight ?? serrAmp
  const serrFreq = b.serrationFrequency ?? 0
  const serPat = b.serrationPattern ?? 'sine'
  const serSeed = (b.serrationSeed ?? 1337)
  const wAt = (t:number) => tipWidthWithKissaki(b, t, baseW, tipW) + (serr(t, serrFreq, serrAmpL, serPat, serSeed)+serr(t, serrFreq, serrAmpR, serPat, serSeed))
  const tScaleAt = (t:number) => {
    const pts = (b.thicknessProfile?.points && b.thicknessProfile.points.length >= 2)
      ? b.thicknessProfile.points.slice().sort((a, c) => a[0] - c[0])
      : [[0, 1], [1, 1]] as Array<[number, number]>
    const tt = Math.max(0, Math.min(1, t))
    let i = 0; while (i < pts.length - 1 && !(tt >= pts[i][0] && tt <= pts[i+1][0])) i++
    const [t0, s0] = pts[Math.max(0, Math.min(i, pts.length - 2))]
    const [t1, s1] = pts[Math.min(i + 1, pts.length - 1)]
    if (t1 === t0) return s0
    const a = (tt - t0) / (t1 - t0)
    return (THREE as any).MathUtils.lerp(s0, s1, a)
  }
  let M = 0, My = 0, Ibase = 0
  for (let i=0;i<n;i++) {
    const t = (i + 0.5) / n
    const y = t * L
    const ts = tScaleAt(t)
    const thick = 0.5*((TL0*ts)+(TR0*ts))
    const w = Math.max(1e-5, wAt(t))
    const cs = b.crossSection ?? 'flat'
    const q = cs==='diamond'?0.6: cs==='lenticular'?0.7: cs==='hexagonal'?0.8: 1.0
    const dm = w * thick * q
    M += dm; My += dm * y; Ibase += dm * y * y
  }
  const cmY = M > 0 ? (My / M) : L * 0.5
  let Icm = 0
  for (let i=0;i<n;i++) {
    const t = (i + 0.5) / n; const y = t * L
    const ts = tScaleAt(t)
    const thick = 0.5*((TL0*ts)+(TR0*ts))
    const w = Math.max(1e-5, wAt(t))
    const cs = b.crossSection ?? 'flat'
    const q = cs==='diamond'?0.6: cs==='lenticular'?0.7: cs==='hexagonal'?0.8: 1.0
    const dm = w * thick * q
    Icm += dm * (y - cmY) * (y - cmY)
  }
  const copY = (cmY > 1e-6) ? (cmY + Icm / (M * cmY)) : cmY
  return { mass: M, cmY, Ibase, Icm, copY } as any
}
