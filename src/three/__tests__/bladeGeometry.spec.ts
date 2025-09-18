import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import { buildBladeGeometry, bendOffsetX, tipWidthWithKissaki, thicknessScaleAt, buildBladeOutlinePoints, bladeOutlineToSVG, buildHamonOverlays, buildFullerOverlays, serrationWave } from '../../three/sword/bladeGeometry'

const baseBlade = {
  length: 2,
  baseWidth: 0.2,
  tipWidth: 0.05,
  thickness: 0.06,
  curvature: 0,
} as any

const sampleThickness = (geo: THREE.BufferGeometry, rowT = 0.5, colT = 0.5) => {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const cols = 12
  const rowStride = (cols + 1) * 2
  const rows = Math.max(1, pos.count / rowStride)
  const row = Math.max(0, Math.min(rows - 1, Math.round(rowT * (rows - 1))))
  const col = Math.max(0, Math.min(cols, Math.round(colT * cols)))
  const frontIndex = row * rowStride + col * 2
  const backIndex = frontIndex + 1
  const zFront = pos.getZ(frontIndex)
  const zBack = pos.getZ(backIndex)
  return Math.abs(zBack - zFront)
}

describe('bladeGeometry helpers', () => {
  it('bendOffsetX respects curvature and baseAngle', () => {
    const L = 2
    const b1 = { ...baseBlade, curvature: 0.5, baseAngle: 0 } as any
    const b2 = { ...baseBlade, curvature: 0, baseAngle: Math.PI/16 } as any
    const y = 1
    expect(bendOffsetX(b1, y, L)).not.toBe(0)
    expect(bendOffsetX(b2, y, L)).toBeCloseTo(Math.tan(Math.PI/16) * y, 5)
  })

  it('tipWidthWithKissaki blends toward tip width', () => {
    const w0 = tipWidthWithKissaki(baseBlade, 0, baseBlade.baseWidth, baseBlade.tipWidth)
    const w1 = tipWidthWithKissaki(baseBlade, 1, baseBlade.baseWidth, baseBlade.tipWidth)
    expect(w0).toBeCloseTo(baseBlade.baseWidth, 6)
    expect(w1).toBeCloseTo(baseBlade.tipWidth, 6)
  })

  it('tipRampStart holds width until requested ramp region', () => {
    const blade = {
      ...baseBlade,
      baseWidth: 0.24,
      tipWidth: 0.01,
      tipRampStart: 0.8,
      kissakiLength: 0.12,
      kissakiRoundness: 0.05,
      tipShape: 'spear'
    } as any
    const mid = tipWidthWithKissaki(blade, 0.5, blade.baseWidth, blade.tipWidth)
    const preRamp = tipWidthWithKissaki(blade, 0.79, blade.baseWidth, blade.tipWidth)
    const postRamp = tipWidthWithKissaki(blade, 0.9, blade.baseWidth, blade.tipWidth)
    const tip = tipWidthWithKissaki(blade, 1, blade.baseWidth, blade.tipWidth)
    expect(mid).toBeCloseTo(blade.baseWidth, 6)
    expect(preRamp).toBeCloseTo(blade.baseWidth, 6)
    expect(postRamp).toBeLessThan(blade.baseWidth * 0.6)
    expect(tip).toBeCloseTo(blade.tipWidth, 6)
  })

  it('bendOffsetX applies curve profile offsets', () => {
    const blade = {
      ...baseBlade,
      curveProfile: {
        mode: 'absolute',
        scale: 1,
        points: [[0, 0], [1, 0.5]]
      }
    } as any
    const L = blade.length
    expect(bendOffsetX(blade, L, L)).toBeCloseTo(0.5, 6)
  })

  it('tipWidthWithKissaki honors width profile scaling', () => {
    const blade = {
      ...baseBlade,
      widthProfile: {
        mode: 'scale',
        points: [[0, 1], [0.5, 2], [1, 2]]
      }
    } as any
    const baseMid = tipWidthWithKissaki(baseBlade, 0.5, baseBlade.baseWidth, baseBlade.tipWidth)
    const profMid = tipWidthWithKissaki(blade, 0.5, blade.baseWidth, blade.tipWidth)
    expect(profMid).toBeCloseTo(baseMid * 2, 6)
  })

  it('edge thickness overrides do not collapse the spine', () => {
    const blade = {
      ...baseBlade,
      thickness: 0.08,
      thicknessLeft: 0.002,
      thicknessRight: 0.002,
      crossSection: 'diamond',
      bevel: 0.6
    } as any
    const geo = buildBladeGeometry(blade)
    geo.computeBoundingBox()
    const spanZ = geo.boundingBox!.max.z - geo.boundingBox!.min.z
    expect(spanZ).toBeGreaterThan(0.04)
  })

  it('serration sharpness accentuates waveform peaks', () => {
    const t = 0.18
    const smooth = serrationWave(t, 6, 1, 'sine', 0, 0, 0)
    const sharp = serrationWave(t, 6, 1, 'sine', 0, 1, 0)
    expect(Math.abs(sharp)).toBeGreaterThan(Math.abs(smooth))
  })

  it('serration lean skews saw-tooth direction', () => {
    const t = 0.43
    const neutral = serrationWave(t, 4, 1, 'saw', 0, 0, 0)
    const forward = serrationWave(t, 4, 1, 'saw', 0, 0, 0.8)
    const backward = serrationWave(t, 4, 1, 'saw', 0, 0, -0.8)
    expect(Math.abs(forward - neutral)).toBeGreaterThan(0.05)
    expect(Math.abs(backward - neutral)).toBeGreaterThan(0.05)
    expect(Math.sign(forward - neutral)).toBe(-Math.sign(backward - neutral))
  })

  it('thicknessScaleAt interpolates piecewise linear profile', () => {
    const b = { ...baseBlade, thicknessProfile: { points: [[0, 1], [0.5, 0.5], [1, 0.25]] } } as any
    expect(thicknessScaleAt(b, 0)).toBeCloseTo(1)
    expect(thicknessScaleAt(b, 0.5)).toBeCloseTo(0.5)
    expect(thicknessScaleAt(b, 1)).toBeCloseTo(0.25)
  })

  it('buildBladeGeometry returns indexed BufferGeometry with bounds', () => {
    const geo = buildBladeGeometry(baseBlade)
    expect(geo.index).toBeTruthy()
    geo.computeBoundingBox()
    const bb = geo.boundingBox!
    expect(bb.min.y).toBeCloseTo(0)
    expect(bb.max.y).toBeCloseTo(baseBlade.length)
  })

  it('outline points form a closed loop for SVG export', () => {
    const pts = buildBladeOutlinePoints(baseBlade)
    expect(pts.length).toBeGreaterThan(10)
    const svg = bladeOutlineToSVG(pts)
    expect(svg.startsWith('<?xml')).toBeTruthy()
    expect(svg.includes('<path')).toBeTruthy()
  })

  it('hamon overlays produce meshes on requested sides', () => {
    const b = { ...baseBlade, hamonEnabled: true, hamonWidth: 0.01, hamonAmplitude: 0.003, hamonFrequency: 4, edgeType: 'double' } as any
    const g = buildHamonOverlays(b)
    let meshCount = 0
    g.traverse(o => { const m = o as THREE.Mesh; if ((m as any).isMesh) meshCount++ })
    expect(meshCount).toBeGreaterThan(0)
  })

  it('fuller overlays create ribbons within span', () => {
    const b = {
      ...baseBlade,
      fullers: [
        { side: 'both', offsetFromSpine: 0, width: 0.05, depth: 0.01, inset: 0.006, start: 0.1, end: 0.7, profile: 'u', mode: 'overlay', taper: 0 }
      ]
    } as any
    const g = buildFullerOverlays(b)
    let meshCount = 0
    g.traverse(o => { const m = o as THREE.Mesh; if ((m as any).isMesh) meshCount++ })
    expect(meshCount).toBeGreaterThanOrEqual(2)
  })

  it('waviness offsets blade outline laterally', () => {
    const straight = buildBladeOutlinePoints(baseBlade)
    const wavyBlade = {
      ...baseBlade,
      waviness: { amplitude: 0.02, frequency: 6, mode: 'centerline', taper: 0, offset: 0 }
    } as any
    const wavy = buildBladeOutlinePoints(wavyBlade)
    const straightMaxX = Math.max(...straight.map((p) => p.x))
    const wavyMaxX = Math.max(...wavy.map((p) => p.x))
    expect(wavyMaxX).toBeGreaterThan(straightMaxX)
  })

  it('compound cross section thickens the spine relative to flat', () => {
    const flat = buildBladeGeometry({ ...baseBlade, crossSection: 'flat', bevel: 0.4 })
    const compound = buildBladeGeometry({ ...baseBlade, crossSection: 'compound', bevel: 0.6 })
    const flatSpine = sampleThickness(flat, 0.5, 0.5)
    const compoundSpine = sampleThickness(compound, 0.5, 0.5)
    expect(compoundSpine).toBeGreaterThan(flatSpine)
  })

  it('hollow grind reduces face thickness while keeping edges', () => {
    const diamond = buildBladeGeometry({ ...baseBlade, crossSection: 'diamond', bevel: 0.6 })
    const hollow = buildBladeGeometry({
      ...baseBlade,
      crossSection: 'diamond',
      bevel: 0.6,
      hollowGrind: { enabled: true, mix: 1, depth: 0.6, radius: 0.8, bias: 0 }
    })
    const faceIndex = 0.35
    const diamondFace = sampleThickness(diamond, 0.5, faceIndex)
    const hollowFace = sampleThickness(hollow, 0.5, faceIndex)
    expect(hollowFace).toBeLessThan(diamondFace)
  })
})
