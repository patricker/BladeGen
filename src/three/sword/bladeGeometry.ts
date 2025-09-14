import * as THREE from 'three'
import type { BladeParams } from './types'
import { bendOffsetX, tipWidthWithKissaki, thicknessScaleAt, serrationWave } from './math'

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
    if (cs === 'diamond') { const pow = THREE.MathUtils.lerp(1.0, 2.5, bevel); return 1 - Math.pow(au, pow) }
    if (cs === 'lenticular') { const g = THREE.MathUtils.lerp(1.4, 0.8, bevel); const base = Math.max(0, 1 - au * au); return Math.pow(base, 0.5 * g) }
    if (cs === 'hexagonal') { const p = THREE.MathUtils.lerp(0.4, 1.0, bevel); return Math.pow(1 - au, Math.max(0.2, p)) }
    return 0
  }

  const serr = (t:number, freq:number, amp:number, pattern: BladeParams['serrationPattern'], seed:number) => serrationWave(t, freq, amp, pattern, seed)
  const serPat = b.serrationPattern ?? 'sine'
  const serSeed = (b.serrationSeed ?? 1337)

  const wantCarve = (b.fullerMode ?? 'overlay') === 'carve' && (b.fullerEnabled ?? false) && (b.fullerLength ?? 0) > 0 && (b.fullerInset ?? b.fullerDepth ?? 0) > 0
  const carveWidth = (b.fullerWidth && b.fullerWidth > 0) ? b.fullerWidth : (b.baseWidth || 0.25) * 0.3
  const insetBase = Math.min(Math.max(0, b.fullerInset ?? b.fullerDepth ?? 0), 0.2)
  const prof = b.fullerProfile ?? 'u'
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
    const serrL = (ricassoFrac > 0 && t <= ricassoFrac) ? 0 : (serr(t, serrFreq, serrAmpL, serPat, serSeed) * (1 - t))
    const serrR = (ricassoFrac > 0 && t <= ricassoFrac) ? 0 : (serr(t, serrFreq, serrAmpR, serPat, serSeed) * (1 - t))
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
    const bend = bendOffsetX(b, y, L)
    const xl = -leftHalf + bend
    const xr = +rightHalf + bend
    const tScale = thicknessScaleAt(b, t)
    const halfEdgeL = (TL0 * tScale) * 0.5
    const halfEdgeR = (TR0 * tScale) * 0.5
    const edgeMidHalf = 0.5 * (halfEdgeL + halfEdgeR)
    const centerHalf = edgeMidHalf * (1 + 2.0 * bevel)

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
      if (wantCarve) {
        const y0 = Math.max(0, (b.fullerLength ?? 0) * 0.0 * L + 0.05 * L)
        const y1 = L - Math.max(0, 0.12 * (b.baseWidth || 0.2))
        if (y >= y0 && y <= y1) {
          const cx = bend
          const halfW = carveWidth * 0.5
          const dx = Math.abs(xRaw - cx)
          if (dx <= halfW) {
            const tX = 1 - THREE.MathUtils.clamp(dx / Math.max(1e-6, halfW), 0, 1)
            let profile = tX
            if (prof === 'u') profile = Math.sqrt(tX)
            else if (prof === 'v') profile = tX
            const inset = profile * insetBase
            zHalf = Math.max(0.0006, zHalf - inset)
          }
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
  const y0 = Math.max(0, (b.fullerLength ?? 0) * 0.0 * totalLen + 0.05 * totalLen)
  const y1 = totalLen - Math.max(0, 0.12 * (b.baseWidth || 0.2))
  const color = 0xdfe6ff
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide })

  const halfTL = Math.max(0.001, (b.thicknessLeft ?? b.thickness ?? 0.08) * 0.5)
  const halfTR = Math.max(0.001, (b.thicknessRight ?? b.thickness ?? 0.08) * 0.5)
  const eps = 0.0006
  const zFrontL = halfTL - eps
  const zFrontR = halfTR - eps

  const widthAcrossX = (b.fullerWidth && b.fullerWidth > 0) ? b.fullerWidth : (b.baseWidth || 0.25) * 0.3
  const halfW = Math.max(0.005, widthAcrossX * 0.5)
  const thNorm = Math.max(0.05, Math.min(0.7, (b.fullerDepth ?? 0.02) / Math.max(1e-3, (b.thickness ?? 0.08))))
  const buildRibbon = (dx: number, z: number) => {
    const positions: number[] = []
    const index: number[] = []
    const pushV = (x: number, y: number) => { positions.push(x, y, z) }
    const steps = 120
    let last: THREE.Vector3 | null = null
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const y = y0 + (y1 - y0) * t
      const w = tipWidthWithKissaki(b, Math.max(0, Math.min(1, y / totalLen)), b.baseWidth, b.tipWidth)
      const half = Math.max(0.001, w * 0.5)
      const bend = bendOffsetX(b, y, totalLen)
      const cx = bend + dx
      const left = cx - halfW
      const right = cx + halfW
      pushV(left, y); pushV(right, y)
      if (i > 0) {
        const a = (i - 1) * 2; const bI = a + 1; const c = a + 2; const d = a + 3
        index.push(a, bI, d, a, d, c)
      }
      last = new THREE.Vector3(cx, y, z)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setIndex(index)
    geo.computeVertexNormals()
    return new THREE.Mesh(geo, mat)
  }

  const inset = thNorm * (halfTL - eps * 8) * 0.8
  const frontZ = zFrontR - inset // use right side as reference; inset symmetric
  const backZ = -frontZ
  const count = Math.max(0, Math.min(3, Math.round(b.fullerCount ?? 1)))
  if (count === 1) {
    group.add(buildRibbon(0, frontZ), buildRibbon(0, backZ))
  } else if (count === 2) {
    const off = (b.baseWidth || 0.3) * 0.12
    group.add(buildRibbon(-off, frontZ), buildRibbon(-off, backZ))
    group.add(buildRibbon(+off, frontZ), buildRibbon(+off, backZ))
  } else if (count >= 3) {
    const off = (b.baseWidth || 0.3) * 0.14
    group.add(buildRibbon(0, frontZ), buildRibbon(0, backZ))
    group.add(buildRibbon(-off, frontZ), buildRibbon(-off, backZ))
    group.add(buildRibbon(+off, frontZ), buildRibbon(+off, backZ))
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
      const w = tipWidthWithKissaki(b, t, b.baseWidth, b.tipWidth)
      const serr = (side === 'right' ? serrAmpR : serrAmpL)
      const serrX = serr > 0 && serrFreq > 0 ? Math.sin(t * Math.PI * serrFreq) * serr * (1 - t) : 0
      const halfBase = Math.max(0.001, w * 0.5 + serrX)
      const bend = bendOffsetX(b, y, totalLen)
      const edgeX = side === 'right' ? (bend + halfBase) : (bend - halfBase)
      const dir = side === 'right' ? -1 : +1
      const wav = amp > 0 && freq > 0 ? Math.sin(t * Math.PI * freq) * amp : 0
      const outer = edgeX + dir * 0.002
      const inner = edgeX + dir * (width + wav)
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
  const serr = (t:number, freq:number, amp:number) => serrationWave(t, freq, amp, serPat, serSeed)
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const y = t * length
    const w = tipWidthWithKissaki(b, t, baseW, tipW)
    const serrR = serr(t, serrFreq, serrAmpR) * (1 - t)
    const half = Math.max(0.001, w * 0.5)
    const asym = (b.asymmetry ?? 0)
    let rightHalf = Math.max(0.0005, (half + serrR) * (1 + 0.5 * asym))
    const bend = bendOffsetX(b, y, length)
    pts.push(new THREE.Vector2(+rightHalf + bend, y))
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps
    const y = t * length
    const w = tipWidthWithKissaki(b, t, baseW, tipW)
    const serrL = serr(t, serrFreq, serrAmpL) * (1 - t)
    const half = Math.max(0.001, w * 0.5)
    const asym = (b.asymmetry ?? 0)
    let leftHalf = Math.max(0.0005, (half + serrL) * (1 - 0.5 * asym))
    const bend = bendOffsetX(b, y, length)
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
