import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import { buildBladeGeometry, bendOffsetX, tipWidthWithKissaki, thicknessScaleAt, buildBladeOutlinePoints, bladeOutlineToSVG, buildHamonOverlays, buildFullerOverlays } from '../../three/sword/bladeGeometry'

const baseBlade = {
  length: 2,
  baseWidth: 0.2,
  tipWidth: 0.05,
  thickness: 0.06,
  curvature: 0,
} as any

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
    const b = { ...baseBlade, fullerEnabled: true, fullerDepth: 0.01, fullerLength: 0.8, fullerCount: 2 } as any
    const g = buildFullerOverlays(b)
    let meshCount = 0
    g.traverse(o => { const m = o as THREE.Mesh; if ((m as any).isMesh) meshCount++ })
    expect(meshCount).toBeGreaterThanOrEqual(2)
  })
})

