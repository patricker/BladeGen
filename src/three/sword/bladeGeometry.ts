import * as THREE from 'three'
import type { BladeParams } from './types'
import { bendOffsetX, tipWidthWithKissaki, thicknessScaleAt, serrationWave, wavinessAt } from './math'

type ResolvedFuller = {
  side: 'left' | 'right';
  offset: number;
  width: number;
  depth: number;
  inset: number;
  start: number;
  end: number;
  profile: 'u' | 'v' | 'flat';
  mode: 'overlay' | 'carve';
  taper: number;
};

const resolveFullers = (b: BladeParams): ResolvedFuller[] => {
  const slots = Array.isArray((b as any).fullers) ? (b.fullers as Array<any>) : []
  const resolved: ResolvedFuller[] = []
  for (const slot of slots) {
    if (!slot) continue
    const width = Math.max(0.005, Number(slot.width) || (b.baseWidth || 0.25) * 0.3)
    const start = THREE.MathUtils.clamp(Number(slot.start) || 0.05, 0, 0.98)
    const endRaw = THREE.MathUtils.clamp(Number(slot.end) || 0.95, start + 0.02, 1)
    if (endRaw <= start) continue
    const depth = Math.max(0, Number(slot.depth) || 0)
    const inset = Math.max(0, Number(slot.inset) || depth)
    const profile: ResolvedFuller['profile'] = slot.profile === 'v' || slot.profile === 'flat' ? slot.profile : 'u'
    const mode: ResolvedFuller['mode'] = slot.mode === 'carve' ? 'carve' : 'overlay'
    const taper = THREE.MathUtils.clamp(Number(slot.taper) || 0, 0, 1)
    const baseOffset = Math.abs(Number(slot.offsetFromSpine) || 0)
    const push = (sign: number, side: 'left' | 'right') => {
      const offset = sign >= 0 ? baseOffset : -baseOffset
      resolved.push({ side, offset, width, depth, inset, start, end: endRaw, profile, mode, taper })
    }
    switch (slot.side) {
      case 'left':
        push(-1, 'left')
        break
      case 'right':
        push(1, 'right')
        break
      default:
        push(-1, 'left')
        push(1, 'right')
        break
    }
  }
  return resolved
}

/**
 * Blade geometry helpers.
 *
 * This module provides pure(ish) functions for generating blade meshes and
 * related overlays. The functions below take only the data they need
 * (BladeParams and numeric inputs) and return Three.js geometry or groups.
 *
 * Notes on coordinates and conventions:
 * - Blade runs along +Y with the base at y=0 and tip at y=length.
 * - Width extends along ±X (left negative, right positive when facing +Y).
 * - Thickness extends along ±Z; by default meshes are double-sided.
 * - Many computations are designed to be deterministic for the same params.
 */

/**
 * Compute lateral X bend offset at longitudinal position y using a shaped
 * profile (sori) plus an optional linear base angle.
 */
export { bendOffsetX } from './math'

/**
 * Compute width at a normalized longitudinal position with optional kissaki
 * (tip) segment controlling the final taper curve.
 */
export { tipWidthWithKissaki } from './math'

/**
 * Evaluate distal taper scale at t based on piecewise linear points.
 * Returns a scalar applied to per-edge thickness across Z.
 */
export { thicknessScaleAt } from './math'

/** Expose serration waveform helper for tests/tools. */
export { serrationWave } from './math'

/**
 * Synthesize a blade mesh (BufferGeometry) using the provided parameters.
 *
 * Returns: BufferGeometry with positions, indices, and computed normals.
 */
export function buildBladeGeometry(b: BladeParams): THREE.BufferGeometry {
  // Parity with the legacy inline builder in SwordGenerator.ts
  const L = Math.max(0.01, b.length)
  const TL0 = Math.max(0.001, b.thicknessLeft ?? b.thickness ?? 0.08)
  const TR0 = Math.max(0.001, b.thicknessRight ?? b.thickness ?? 0.08)
  const baseW = Math.max(0.002, b.baseWidth)
  const tipW = Math.max(0, b.tipWidth)
  const segs = Math.max(16, Math.min(512, Math.round(b.sweepSegments ?? 128)))
  const cols = 12
  const serrAmp = b.serrationAmplitude ?? 0
  const serrAmpL = b.serrationAmplitudeLeft ?? serrAmp
  const serrAmpR = b.serrationAmplitudeRight ?? serrAmp
  const serrFreq = b.serrationFrequency ?? 0
  const chaos = b.chaos ?? 0

  const rowStride = (cols + 1) * 2
  const positions = new Float32Array((segs + 1) * rowStride * 3)
  const indices: number[] = []

  const vIndex = (i: number, j: number, side: 0 | 1) => (i * rowStride + j * 2 + side)
  const setV = (i: number, j: number, side: 0 | 1, x: number, y: number, z: number) => {
    const idx = vIndex(i, j, side) * 3
    positions[idx + 0] = x
    positions[idx + 1] = y
    positions[idx + 2] = z
  }

  const bevel = THREE.MathUtils.clamp(b.bevel ?? 0.5, 0, 1)
  const shapeFactor = (u: number) => {
    const cs = b.crossSection ?? 'flat'
    const au = Math.abs(u)
    if (cs === 'diamond') {
      const pow = THREE.MathUtils.lerp(1.0, 2.5, bevel)
      return 1 - Math.pow(au, pow)
    }
    if (cs === 'lenticular') {
      const g = THREE.MathUtils.lerp(1.4, 0.8, bevel)
      const base = Math.max(0, 1 - au * au)
      return Math.pow(base, 0.5 * g)
    }
    if (cs === 'hexagonal') {
      const p = THREE.MathUtils.lerp(0.35, 1.1, bevel)
      return Math.pow(Math.max(0, 1 - au), Math.max(0.2, p))
    }
    if (cs === 'compound') {
      const primary = Math.pow(Math.max(0, 1 - Math.pow(au, THREE.MathUtils.lerp(1.0, 1.8, bevel))), 1.1)
      const shoulderWidth = THREE.MathUtils.lerp(0.6, 0.35, bevel)
      const shoulder = Math.pow(Math.max(0, 1 - Math.pow(au / Math.max(0.01, shoulderWidth), 4.0)), 1.8)
      return THREE.MathUtils.lerp(primary, shoulder, 0.55)
    }
    if (cs === 'triangular') {
      const slope = THREE.MathUtils.lerp(1.0, 0.35, bevel)
      return Math.max(0, 1 - Math.pow(au, slope))
    }
    if (cs === 'tSpine') {
      const ridgeWidth = THREE.MathUtils.lerp(0.2, 0.05, bevel)
      const rib = Math.pow(Math.max(0, 1 - Math.pow(au / Math.max(0.01, ridgeWidth), 2)), 1.6)
      const web = Math.pow(Math.max(0, 1 - Math.pow(au, 2.6)), 0.9)
      return Math.max(rib, web * 0.45)
    }
    return 0
  }

  const serPat = b.serrationPattern ?? 'sine'
  const serSeed = (b.serrationSeed ?? 1337)
  const sharp = THREE.MathUtils.clamp((b as any).serrationSharpness ?? 0, 0, 1)
  const biasLeft = THREE.MathUtils.clamp((b as any).serrationLeanLeft ?? 0, -1, 1)
  const biasRight = THREE.MathUtils.clamp((b as any).serrationLeanRight ?? 0, -1, 1)
  const serr = (t:number, freq:number, amp:number, bias:number, seedOffset = 0) => serrationWave(t, freq, amp, serPat, serSeed + seedOffset, sharp, bias)

  const resolvedFullers = resolveFullers(b)
  const carveFullers = resolvedFullers.filter((f) => f.mode === 'carve' && f.inset > 0 && f.end > f.start)
  const ricassoFrac = THREE.MathUtils.clamp((b as any).ricassoLength ?? 0, 0, 0.3)
  const feLen = THREE.MathUtils.clamp((b as any).falseEdgeLength ?? 0, 0, 1)
  const feDepth = THREE.MathUtils.clamp((b as any).falseEdgeDepth ?? 0, 0, 0.2)
  const isSingle = (b.edgeType ?? 'double') === 'single'
  const spineSign: 1 | -1 = isSingle ? ((TR0 >= TL0) ? +1 : -1) : +1

  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const y = t * L
    let w = tipWidthWithKissaki(b, t, baseW, tipW)
    if (ricassoFrac > 0 && t <= ricassoFrac) w = baseW
    const serrL = (ricassoFrac > 0 && t <= ricassoFrac) ? 0 : (serr(t, serrFreq, serrAmpL, biasLeft) * (1 - t))
    const serrR = (ricassoFrac > 0 && t <= ricassoFrac) ? 0 : (serr(t, serrFreq, serrAmpR, biasRight, 7) * (1 - t))
    const c1 = Math.sin(t * Math.PI * 16.0 + 1.3)
    const c2 = Math.sin(t * Math.PI * 9.7 + 0.6)
    const chaosOffset = (c1 * 0.6 + c2 * 0.4) * chaos * 0.08 * baseW * (1.0 - t * 0.6)
    const baseHalf = Math.max(0.001, w * 0.5 + chaosOffset)
    const asym = (b.asymmetry ?? 0)
    let leftHalf = Math.max(0.0005, (baseHalf + serrL) * (1 - 0.5 * asym))
    let rightHalf = Math.max(0.0005, (baseHalf + serrR) * (1 + 0.5 * asym))
    if (b.tipShape === 'clip' || b.tipShape === 'tanto' || b.tipShape === 'sheepsfoot') {
      const tipLen = Math.max(0.05, (b.kissakiLength ?? 0.2) || 0.2)
      const t0 = Math.max(0, 1 - tipLen)
      const tipU = THREE.MathUtils.clamp((t - t0) / Math.max(1e-6, tipLen), 0, 1)
      const spineIsRight = spineSign > 0
      if (b.tipShape === 'clip') {
        const delta = baseHalf * 0.40 * Math.pow(tipU, 0.7)
        if (spineIsRight) rightHalf = Math.max(0.0005, rightHalf - delta); else leftHalf = Math.max(0.0005, leftHalf - delta)
      } else if (b.tipShape === 'sheepsfoot') {
        const delta = baseHalf * 0.50 * Math.pow(tipU, 2.0)
        if (spineIsRight) rightHalf = Math.max(0.0005, rightHalf - delta); else leftHalf = Math.max(0.0005, leftHalf - delta)
      } else if (b.tipShape === 'tanto') {
        const delta = baseHalf * 0.25 * tipU
        const edgeIsRight = !spineIsRight
        if (edgeIsRight) rightHalf = Math.max(0.0005, rightHalf - delta); else leftHalf = Math.max(0.0005, leftHalf - delta)
      }
    }
    const wav = wavinessAt(b, t)
    if (wav.width !== 0) {
      leftHalf = Math.max(0.0005, leftHalf + wav.width)
      rightHalf = Math.max(0.0005, rightHalf + wav.width)
    }
    const bend = bendOffsetX(b, y, L) + wav.center
    const xl = -leftHalf + bend
    const xr = +rightHalf + bend
    const tScale = thicknessScaleAt(b, t)
    const widthRatio = THREE.MathUtils.clamp(w / Math.max(0.0001, baseW), 0, 1)
    const tipThicknessFactor = Math.max(0.05, Math.pow(widthRatio, 0.65))
    const rawHalfEdgeL = (TL0 * tScale) * 0.5
    const rawHalfEdgeR = (TR0 * tScale) * 0.5
    const halfEdgeL = Math.max(0.0005, rawHalfEdgeL * tipThicknessFactor)
    const halfEdgeR = Math.max(0.0005, rawHalfEdgeR * tipThicknessFactor)
    const edgeMidHalf = 0.5 * (halfEdgeL + halfEdgeR)
    const baseSpineTarget = (b.thickness ?? ((TL0 + TR0) * 0.5)) * 0.5 * tScale * tipThicknessFactor
    const baseSpineHalf = Math.max(edgeMidHalf + 0.0005, baseSpineTarget)
    let centerHalf = Math.max(baseSpineHalf, edgeMidHalf * (1 + 2.0 * bevel))
    if ((b.crossSection ?? 'flat') === 'tSpine') {
      const ridgeBoost = Math.max(0.0005, (b.thickness ?? ((TL0 + TR0) * 0.5)) * 0.15)
      centerHalf = Math.max(centerHalf, baseSpineHalf + ridgeBoost)
    }

    const twist = (b.twistAngle ?? 0) * t
    const cosT = Math.cos(twist), sinT = Math.sin(twist)
    const rot = (x: number, z: number) => ({ x: x * cosT - z * sinT, z: x * sinT + z * cosT })

    for (let j = 0; j <= cols; j++) {
      const s = j / cols
      const u = s * 2 - 1
      const xRaw = THREE.MathUtils.lerp(xl, xr, s)
      const edgeHalf = THREE.MathUtils.lerp(halfEdgeL, halfEdgeR, s)
      const f = shapeFactor(u)
      let zHalf = edgeHalf + (centerHalf - edgeMidHalf) * f
      if (b.hollowGrind && (b.hollowGrind.enabled || (b.hollowGrind.mix ?? 0) > 0)) {
        const hgMix = THREE.MathUtils.clamp(b.hollowGrind.mix ?? (b.hollowGrind.enabled ? 0.65 : 0), 0, 1)
        const hgDepth = THREE.MathUtils.clamp(b.hollowGrind.depth ?? 0.45, 0, 1)
        const hgRadius = THREE.MathUtils.clamp(b.hollowGrind.radius ?? 0.6, 0.1, 6)
        const hgBias = THREE.MathUtils.clamp(b.hollowGrind.bias ?? 0, -1, 1)
        if (hgMix > 0 && hgDepth > 0) {
          const edgeDist = Math.abs(u)
          const biased = THREE.MathUtils.clamp(edgeDist + hgBias * 0.5, 0, 1)
          const concave = Math.pow(1 - Math.pow(biased, hgRadius), 1.25)
          const target = edgeHalf + (centerHalf - edgeHalf) * (1 - concave * hgDepth)
          zHalf = THREE.MathUtils.lerp(zHalf, Math.max(edgeHalf, target), hgMix)
        }
      }
      if (carveFullers.length) {
        for (const slot of carveFullers) {
          if (t < slot.start || t > slot.end) continue
          const span = Math.max(1e-6, slot.end - slot.start)
          const along = THREE.MathUtils.clamp((t - slot.start) / span, 0, 1)
          const widthScale = Math.max(0.1, 1 - slot.taper * along)
          const halfW = Math.max(0.002, (slot.width * 0.5) * widthScale)
          const cx = bend + slot.offset
          const dx = Math.abs(xRaw - cx)
          if (dx > halfW) continue
          const inner = 1 - THREE.MathUtils.clamp(dx / Math.max(1e-6, halfW), 0, 1)
          let profile = inner
          if (slot.profile === 'u') profile = Math.sqrt(inner)
          else if (slot.profile === 'flat') profile = inner * 0.85
          const depthScale = Math.max(0, 1 - slot.taper * along)
          const inset = profile * slot.inset * depthScale
          zHalf = Math.max(0.0006, zHalf - inset)
        }
      }
      if (feLen > 0 && feDepth > 0 && t >= (1 - feLen)) {
        const along = THREE.MathUtils.clamp((t - (1 - feLen)) / Math.max(1e-6, feLen), 0, 1)
        const toSpine = spineSign > 0 ? s : (1 - s)
        const across = Math.pow(THREE.MathUtils.clamp(toSpine, 0, 1), 2.0)
        const carve = feDepth * along * across
        zHalf = Math.max(0.0006, zHalf - carve)
      }
      const front = rot(xRaw, -zHalf)
      const back = rot(xRaw, +zHalf)
      setV(i, j, 0, front.x, y, front.z)
      setV(i, j, 1, back.x, y, back.z)
    }
  }

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < cols; j++) {
      const f00 = vIndex(i, j, 0), f01 = vIndex(i, j + 1, 0)
      const f10 = vIndex(i + 1, j, 0), f11 = vIndex(i + 1, j + 1, 0)
      const b00 = vIndex(i, j, 1), b01 = vIndex(i, j + 1, 1)
      const b10 = vIndex(i + 1, j, 1), b11 = vIndex(i + 1, j + 1, 1)
      indices.push(f00, f01, f11, f00, f11, f10)
      indices.push(b00, b11, b01, b00, b10, b11)
    }
    const lf0 = vIndex(i, 0, 0), lb0 = vIndex(i, 0, 1)
    const lf1 = vIndex(i + 1, 0, 0), lb1 = vIndex(i + 1, 0, 1)
    indices.push(lf0, lb0, lb1, lf0, lb1, lf1)
    const rf0 = vIndex(i, cols, 0), rb0 = vIndex(i, cols, 1)
    const rf1 = vIndex(i + 1, cols, 0), rb1 = vIndex(i + 1, cols, 1)
    indices.push(rf0, rb1, rb0, rf0, rf1, rb1)
  }

  for (let j = 0; j < cols; j++) {
    const f0 = vIndex(0, j, 0), b0 = vIndex(0, j, 1)
    const f1 = vIndex(0, j + 1, 0), b1 = vIndex(0, j + 1, 1)
    indices.push(f0, b1, b0, f0, f1, b1)
    const fn0 = vIndex(segs, j, 0), bn0 = vIndex(segs, j, 1)
    const fn1 = vIndex(segs, j + 1, 0), bn1 = vIndex(segs, j + 1, 1)
    indices.push(fn0, bn0, bn1, fn0, bn1, fn1)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  return geo
}

/**
 * Build overlay ribbons for fullers (grooves) that sit slightly above the blade
 * surface using polygon offset to avoid z-fighting.
 */
export function buildFullerOverlays(b: BladeParams): THREE.Group {
  const group = new THREE.Group()
  const totalLen = b.length
  const resolved = resolveFullers(b)
  if (!resolved.length) return group

  const color = 0xdfe6ff
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide })

  const halfTL = Math.max(0.001, (b.thicknessLeft ?? b.thickness ?? 0.08) * 0.5)
  const halfTR = Math.max(0.001, (b.thicknessRight ?? b.thickness ?? 0.08) * 0.5)
  const eps = 0.0006
  const zFrontL = halfTL - eps
  const zFrontR = halfTR - eps

  const buildRibbon = (slot: ResolvedFuller, faceZ: number) => {
    const positions: number[] = []
    const index: number[] = []
    const steps = 120
    for (let i = 0; i <= steps; i++) {
      const u = i / steps
      const t = slot.start + (slot.end - slot.start) * u
      const y = t * totalLen
      let width = tipWidthWithKissaki(b, t, b.baseWidth, b.tipWidth)
      const wav = wavinessAt(b, t)
      if (wav.width !== 0) width = Math.max(0.0005, width + wav.width * 2)
      const availableHalf = Math.max(0.001, width * 0.5)
      const bend = bendOffsetX(b, y, totalLen) + wav.center
      const span = Math.max(1e-6, slot.end - slot.start)
      const along = THREE.MathUtils.clamp((t - slot.start) / span, 0, 1)
      const widthScale = Math.max(0.1, 1 - slot.taper * along)
      const halfSlot = Math.min(availableHalf * 0.95, Math.max(0.002, (slot.width * 0.5) * widthScale))
      const cx = bend + slot.offset
      const left = cx - halfSlot
      const right = cx + halfSlot
      positions.push(left, y, faceZ, right, y, faceZ)
      if (i > 0) {
        const a = (i - 1) * 2; const bI = a + 1; const c = a + 2; const d = a + 3
        index.push(a, bI, d, a, d, c)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setIndex(index)
    geo.computeVertexNormals()
    return new THREE.Mesh(geo, mat)
  }

  for (const slot of resolved) {
    if (slot.mode !== 'overlay' && slot.depth <= 0) continue
    const depthNorm = Math.max(0, Math.min(1, slot.depth / Math.max(1e-3, (b.thickness ?? 0.08))))
    const frontBase = slot.side === 'right' ? zFrontR : zFrontL
    const offsetZ = depthNorm * 0.5 * (slot.side === 'right' ? halfTR : halfTL)
    const frontZ = frontBase - Math.max(0.001, offsetZ + 0.001)
    const backZ = -frontZ
    group.add(buildRibbon(slot, frontZ), buildRibbon(slot, backZ))
  }

  return group
}

/**
 * Build hamon overlays: thin, slightly offset ribbons that follow each edge
 * with a wavy inner boundary.
 */
export function buildHamonOverlays(b: BladeParams): THREE.Group {
  const group = new THREE.Group()
  const totalLen = b.length
  const segments = 96
  const width = Math.max(0.002, b.hamonWidth ?? 0.015)
  const amp = Math.max(0, b.hamonAmplitude ?? 0.006)
  const freq = Math.max(0, b.hamonFrequency ?? 6)
  const color = 0xe3e7f3
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide })

  const halfTL = Math.max(0.001, (b.thicknessLeft ?? b.thickness ?? 0.08) * 0.5)
  const halfTR = Math.max(0.001, (b.thicknessRight ?? b.thickness ?? 0.08) * 0.5)
  const eps = 0.0006
  const zFrontL = halfTL - eps
  const zFrontR = halfTR - eps

  const serrAmp = b.serrationAmplitude ?? 0
  const serrAmpL = b.serrationAmplitudeLeft ?? serrAmp
  const serrAmpR = b.serrationAmplitudeRight ?? serrAmp
  const serrFreq = b.serrationFrequency ?? 0

  const buildEdgeRibbon = (side: 'left' | 'right', z: number) => {
    const positions: number[] = []
    const index: number[] = []
    const pushV = (x: number, y: number) => { positions.push(x, y, z) }
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const y = t * totalLen
      let widthAt = tipWidthWithKissaki(b, t, b.baseWidth, b.tipWidth)
      const waviness = wavinessAt(b, t)
      if (waviness.width !== 0) widthAt = Math.max(0.0005, widthAt + waviness.width * 2)
      const bend = bendOffsetX(b, y, totalLen) + waviness.center
      const serr = side === 'right' ? serrAmpR : serrAmpL
      const serrX = serr > 0 && serrFreq > 0 ? Math.sin(t * Math.PI * serrFreq) * serr * (1 - t) : 0
      const halfBase = Math.max(0.001, widthAt * 0.5 + serrX)
      const edgeHalf = Math.max(0.001, halfBase + waviness.width)
      const edgeX = side === 'right' ? bend + edgeHalf : bend - edgeHalf
      const dir = side === 'right' ? -1 : 1
      const hamonWave = amp > 0 && freq > 0 ? Math.sin(t * Math.PI * freq) * amp : 0
      const outer = edgeX + dir * 0.002
      const inner = edgeX + dir * (width + hamonWave)
      pushV(outer, y)
      pushV(inner, y)
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 2; const bIdx = a + 1; const c = a + 2; const d = a + 3
      index.push(a, bIdx, d, a, d, c)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setIndex(index)
    geo.computeVertexNormals()
    return new THREE.Mesh(geo, mat)
  }

  const sidePref = (b.hamonSide ?? 'auto')
  const single = b.edgeType === 'single'
  const thinnerRight = (b.thicknessRight ?? b.thickness ?? 0.08) < (b.thicknessLeft ?? b.thickness ?? 0.08)
  const autoSide: 'left' | 'right' = thinnerRight ? 'right' : 'left'

  const wantLeft = sidePref === 'left' || sidePref === 'both' || (sidePref === 'auto' && (!single || autoSide === 'left'))
  const wantRight = sidePref === 'right' || sidePref === 'both' || (sidePref === 'auto' && (!single || autoSide === 'right'))

  if (wantLeft) { group.add(buildEdgeRibbon('left', zFrontL), buildEdgeRibbon('left', -zFrontL)) }
  if (wantRight) { group.add(buildEdgeRibbon('right', zFrontR), buildEdgeRibbon('right', -zFrontR)) }
  return group
}

/**
 * Sample a dense outline of the blade cross-section for 2D export or UI display.
 * Returns points in scene coordinates around the full closed outline.
 */
export function buildBladeOutlinePoints(b: BladeParams): THREE.Vector2[] {
  const length = Math.max(0.01, b.length)
  const baseW = Math.max(0.002, b.baseWidth)
  const tipW = Math.max(0, b.tipWidth)
  const steps = 200
  const serrAmp = b.serrationAmplitude ?? 0
  const serrAmpL = b.serrationAmplitudeLeft ?? serrAmp
  const serrAmpR = b.serrationAmplitudeRight ?? serrAmp
  const serrFreq = b.serrationFrequency ?? 0
  const serPat = b.serrationPattern ?? 'sine'
  const serSeed = b.serrationSeed ?? 1337
  const sharpOutline = THREE.MathUtils.clamp((b as any).serrationSharpness ?? 0, 0, 1)
  const biasOutlineL = THREE.MathUtils.clamp((b as any).serrationLeanLeft ?? 0, -1, 1)
  const biasOutlineR = THREE.MathUtils.clamp((b as any).serrationLeanRight ?? 0, -1, 1)
  const serr = (t:number, freq:number, amp:number, bias:number, offset = 0) => serrationWave(t, freq, amp, serPat, serSeed + offset, sharpOutline, bias)
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const y = t * length
    let w = tipWidthWithKissaki(b, t, baseW, tipW)
    const wav = wavinessAt(b, t)
    if (wav.width !== 0) w = Math.max(0.0005, w + wav.width * 2)
    const serrR = serr(t, serrFreq, serrAmpR, biasOutlineR) * (1 - t)
    const half = Math.max(0.001, w * 0.5)
    const asym = (b.asymmetry ?? 0)
    let rightHalf = Math.max(0.0005, (half + serrR) * (1 + 0.5 * asym))
    rightHalf = Math.max(0.0005, rightHalf + wav.width)
    const bend = bendOffsetX(b, y, length) + wav.center
    pts.push(new THREE.Vector2(+rightHalf + bend, y))
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps
    const y = t * length
    let w = tipWidthWithKissaki(b, t, baseW, tipW)
    const wav = wavinessAt(b, t)
    if (wav.width !== 0) w = Math.max(0.0005, w + wav.width * 2)
    const serrL = serr(t, serrFreq, serrAmpL, biasOutlineL, 7) * (1 - t)
    const half = Math.max(0.001, w * 0.5)
    const asym = (b.asymmetry ?? 0)
    let leftHalf = Math.max(0.0005, (half + serrL) * (1 - 0.5 * asym))
    leftHalf = Math.max(0.0005, leftHalf + wav.width)
    const bend = bendOffsetX(b, y, length) + wav.center
    pts.push(new THREE.Vector2(-leftHalf + bend, y))
  }
  return pts
}

/**
 * Convert a closed polyline outline into a simple SVG path string wrapped in an SVG document.
 */
export function bladeOutlineToSVG(points: THREE.Vector2[], stroke = '#111827'): string {
  if (!points.length) return ''
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) }
  const pad = 10
  const width = maxX - minX
  const height = maxY - minY
  const sx = pad - minX
  const sy = pad - minY
  let d = ''
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    d += (i === 0 ? 'M' : 'L') + (p.x + sx).toFixed(3) + ' ' + (height + pad * 2 - (p.y + sy)).toFixed(3) + ' '
  }
  d += 'Z'
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${(width + pad * 2).toFixed(2)}" height="${(height + pad * 2).toFixed(2)}" viewBox="0 0 ${(width + pad * 2).toFixed(2)} ${(height + pad * 2).toFixed(2)}" preserveAspectRatio="xMidYMid meet">\n  <path d="${d}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>\n</svg>`
  return svg
}
