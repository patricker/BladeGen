import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { defaultSwordParams, SwordGenerator } from '../SwordGenerator'
import { makeSword, partBounds, vertexCount, groupDescendantsCount, greater, less, bladeWidthAt, bladeCenterlineXAt, bladeThicknessAt, bladeHalfWidthsAt, widthsStdDev, bladeThicknessAtXBand } from './helpers/metrics'

describe('Per-setting geometry effects (representative)', () => {
  it('Blade length increases total height', () => {
    const base = defaultSwordParams()
    const s1 = new SwordGenerator(base)
    const b1 = partBounds(s1, 'blade')!
    const taller = defaultSwordParams()
    taller.blade.length = base.blade.length * 1.25
    const s2 = new SwordGenerator(taller)
    const b2 = partBounds(s2, 'blade')!
    expect(greater(b2.size.y, b1.size.y)).toBe(true)
  })

  it('Blade baseWidth increases X span', () => {
    const base = defaultSwordParams()
    const s1 = new SwordGenerator(base)
    const b1 = partBounds(s1, 'blade')!
    const wider = defaultSwordParams()
    wider.blade.baseWidth = base.blade.baseWidth * 1.4
    const s2 = new SwordGenerator(wider)
    const b2 = partBounds(s2, 'blade')!
    expect(greater(b2.size.x, b1.size.x)).toBe(true)
  })

  it('Blade thicknessLeft/Right increase Z depth', () => {
    const base = defaultSwordParams()
    const s1 = new SwordGenerator(base)
    const b1 = partBounds(s1, 'blade')!
    const thicker = defaultSwordParams()
    thicker.blade.thicknessLeft = (base.blade.thicknessLeft ?? base.blade.thickness) * 1.5
    thicker.blade.thicknessRight = (base.blade.thicknessRight ?? base.blade.thickness) * 1.5
    const s2 = new SwordGenerator(thicker)
    const b2 = partBounds(s2, 'blade')!
    expect(greater(b2.size.z, b1.size.z)).toBe(true)
  })

  it('Hollow grind reduces center thickness (Z) when enabled', () => {
    const base = defaultSwordParams()
    base.blade.crossSection = 'diamond'
    const s1 = new SwordGenerator(base)
    const b1 = partBounds(s1, 'blade')!
    const hollow = defaultSwordParams()
    hollow.blade.crossSection = 'diamond'
    hollow.blade.hollowGrind = { enabled: true, mix: 0.8, depth: 0.6, radius: 0.8 }
    const s2 = new SwordGenerator(hollow)
    const b2 = partBounds(s2, 'blade')!
    expect(less(b2.size.z, b1.size.z)).toBe(true)
  })

  it('Fuller overlay appears when enabled with slots', () => {
    const base = defaultSwordParams()
    const s1 = new SwordGenerator(base)
    const overlay1 = ((s1 as any).fullerGroup as THREE.Group | null) ?? null
    const variant = defaultSwordParams()
    // Provide explicit fullers regardless of fullerEnabled to be robust to validation
    ;(variant.blade as any).fullers = [{ side: 'both', width: variant.blade.baseWidth * 0.25, depth: 0.015, inset: 0.008, start: 0.08, end: 0.85, mode: 'overlay' }]
    const s2 = new SwordGenerator(variant)
    const overlay2 = ((s2 as any).fullerGroup as THREE.Group | null) ?? null
    expect(overlay1).toBeNull()
    expect(overlay2).not.toBeNull()
    expect(overlay2!.children.length).toBeGreaterThan(0)
  })

  it('Fuller Mode "none" with fullers disabled yields no overlays', () => {
    const base = defaultSwordParams()
    base.blade.fullerEnabled = false
    ;(base.blade as any).fullerMode = 'none'
    delete (base.blade as any).fullers
    delete (base.blade as any).fullerFaces
    const s = new SwordGenerator(base)
    const overlay = ((s as any).fullerGroup as THREE.Group | null) ?? null
    expect(overlay).toBeNull()
  })

  it('Tip width increases local width near tip', () => {
    const base = defaultSwordParams()
    base.blade.tipWidth = 0.04
    const s1 = new SwordGenerator(base)
    const w1 = bladeWidthAt(s1, 0.95)!
    const widerTip = defaultSwordParams()
    widerTip.blade.tipWidth = 0.12
    const s2 = new SwordGenerator(widerTip)
    const w2 = bladeWidthAt(s2, 0.95)!
    expect(greater(w2, w1)).toBe(true)
  })

  it('Positive curvature bends centerline toward -X', () => {
    const base = defaultSwordParams()
    base.blade.curvature = 0.0
    const s1 = new SwordGenerator(base)
    const c1 = bladeCenterlineXAt(s1, 0.5)!
    const curved = defaultSwordParams()
    curved.blade.curvature = 0.35
    const s2 = new SwordGenerator(curved)
    const c2 = bladeCenterlineXAt(s2, 0.5)!
    expect(c2).toBeLessThan(c1) // more negative X
  })

  it('Distal thickness profile reduces tip thickness', () => {
    const base = defaultSwordParams()
    base.blade.thicknessProfile = { points: [[0, 1], [1, 1]] }
    const s1 = new SwordGenerator(base)
    const t1 = bladeThicknessAt(s1, 0.9)!
    const tapered = defaultSwordParams()
    tapered.blade.thicknessProfile = { points: [[0, 1], [1, 0.5]] }
    const s2 = new SwordGenerator(tapered)
    const t2 = bladeThicknessAt(s2, 0.9)!
    expect(less(t2, t1)).toBe(true)
  })

  it('Leaf tip with bulge increases mid-span width vs pointed', () => {
    const base = defaultSwordParams()
    base.blade.tipShape = 'pointed'
    const s1 = new SwordGenerator(base)
    const w1 = bladeWidthAt(s1, 0.6)!
    const leaf = defaultSwordParams()
    leaf.blade.tipShape = 'leaf'
    leaf.blade.tipBulge = 0.6
    const s2 = new SwordGenerator(leaf)
    const w2 = bladeWidthAt(s2, 0.6)!
    expect(greater(w2, w1)).toBe(true)
  })

  it('Tip ramp start holds base width before ramp', () => {
    const base = defaultSwordParams()
    base.blade.tipRampStart = 0
    const s1 = new SwordGenerator(base)
    const w1 = bladeWidthAt(s1, 0.2)!
    const ramp = defaultSwordParams()
    ramp.blade.tipRampStart = 0.3
    const s2 = new SwordGenerator(ramp)
    const w2 = bladeWidthAt(s2, 0.2)!
    expect(w2).toBeCloseTo(ramp.blade.baseWidth, 4)
    expect(w1).toBeLessThan(base.blade.baseWidth)
  })

  it('Cross-section thickness: tSpine thicker than flat at mid-span', () => {
    const make = (cs: any) => {
      const p = defaultSwordParams()
      ;(p.blade as any).crossSection = cs
      ;(p.blade as any).bevel = 0.5
      return new SwordGenerator(p)
    }
    const flat = make('flat')
    const tSpine = make('tSpine')
    const tf = bladeThicknessAt(flat, 0.5)!
    const ts = bladeThicknessAt(tSpine, 0.5)!
    expect(greater(ts, tf)).toBe(true)
  })

  it('Twist angle increases mid-span Z thickness envelope', () => {
    const base = defaultSwordParams()
    base.blade.twistAngle = 0
    const s1 = new SwordGenerator(base)
    const z1 = bladeThicknessAt(s1, 0.5)!
    const twist = defaultSwordParams()
    twist.blade.twistAngle = Math.PI / 2
    const s2 = new SwordGenerator(twist)
    const z2 = bladeThicknessAt(s2, 0.5)!
    expect(greater(z2, z1)).toBe(true)
  })

  it('Carved fuller reduces thickness within span (local band)', () => {
    const base = defaultSwordParams()
    const s1 = new SwordGenerator(base)
    const t1 = bladeThicknessAt(s1, 0.5)!
    const carved = defaultSwordParams()
    ;(carved.blade as any).fullers = [{ side: 'both', width: carved.blade.baseWidth * 0.25, inset: 0.012, start: 0.3, end: 0.7, mode: 'carve' }]
    const s2 = new SwordGenerator(carved)
    const centerBand = 0.02
    const t2 = bladeThicknessAtXBand(s2, 0.5, 0, centerBand)!
    const t1b = bladeThicknessAtXBand(s1, 0.5, 0, centerBand)!
    expect(less(t2, t1b)).toBe(true)
  })

  it('False edge reduces thickness near tip (near edge band)', () => {
    const base = defaultSwordParams()
    base.blade.falseEdgeLength = 0
    base.blade.falseEdgeDepth = 0
    const s1 = new SwordGenerator(base)
    const t1 = bladeThicknessAt(s1, 0.92)!
    const fe = defaultSwordParams()
    fe.blade.falseEdgeLength = 0.4
    fe.blade.falseEdgeDepth = 0.12
    fe.blade.edgeType = 'single'
    const s2 = new SwordGenerator(fe)
    // Sample near right edge band
    // Sample near (but not at) the right edge to capture false-edge carve
    const tSample = 0.95
    const c2 = bladeCenterlineXAt(s2, tSample)!
    const w2 = bladeWidthAt(s2, tSample)!
    const rightEdge = c2 + w2 * 0.5
    const xNearRight = rightEdge - w2 * 0.1 // 10% in from the edge
    const band = Math.max(0.003, w2 * 0.04)
    const t2 = bladeThicknessAtXBand(s2, tSample, xNearRight, band)!
    const t1b = bladeThicknessAtXBand(s1, tSample, xNearRight, band)!
    expect(less(t2, t1b)).toBe(true)
  })

  it('Hamon enabled adds overlay meshes', () => {
    const base = defaultSwordParams()
    base.blade.hamonEnabled = false
    const s1 = new SwordGenerator(base)
    const c1 = groupDescendantsCount(s1.group)
    const h = defaultSwordParams()
    h.blade.hamonEnabled = true
    h.blade.hamonWidth = 0.02
    h.blade.hamonAmplitude = 0.005
    h.blade.hamonFrequency = 6
    const s2 = new SwordGenerator(h)
    const c2 = groupDescendantsCount(s2.group)
    expect(c2).toBeGreaterThan(c1)
  })

  it('Base angle linearly shifts centerline toward +X along length', () => {
    const base = defaultSwordParams()
    base.blade.baseAngle = 0
    const s1 = new SwordGenerator(base)
    const cx1a = bladeCenterlineXAt(s1, 0.1)!
    const cx1b = bladeCenterlineXAt(s1, 0.9)!
    const ang = defaultSwordParams()
    ang.blade.baseAngle = 0.2
    const s2 = new SwordGenerator(ang)
    const cx2a = bladeCenterlineXAt(s2, 0.1)!
    const cx2b = bladeCenterlineXAt(s2, 0.9)!
    expect(greater(cx2b - cx2a, cx1b - cx1a)).toBe(true)
  })

  it('Curve profile shifts centerline by provided absolute offset', () => {
    const base = defaultSwordParams()
    base.blade.curveProfile = { points: [[0, 0], [1, 0]], mode: 'absolute' }
    const s1 = new SwordGenerator(base)
    const c1 = bladeCenterlineXAt(s1, 0.5)!
    const prof = defaultSwordParams()
    prof.blade.curveProfile = { points: [[0, 0], [1, 0.1]], mode: 'absolute' }
    const s2 = new SwordGenerator(prof)
    const c2 = bladeCenterlineXAt(s2, 0.5)!
    expect(greater(c2, c1)).toBe(true)
  })

  it('Width profile absolute sets width at sample', () => {
    const base = defaultSwordParams()
    base.blade.baseWidth = 0.2
    base.blade.tipWidth = 0.2
    base.blade.tipRampStart = 0
    const s1 = new SwordGenerator(base)
    const w1 = bladeWidthAt(s1, 0.5)!
    const prof = defaultSwordParams()
    prof.blade.baseWidth = 0.2
    prof.blade.tipWidth = 0.2
    prof.blade.tipRampStart = 0
    prof.blade.widthProfile = { mode: 'absolute', points: [[0, 0.2], [0.5, 0.4], [1, 0.2]] }
    const s2 = new SwordGenerator(prof)
    const w2 = bladeWidthAt(s2, 0.5)!
    expect(w1).toBeCloseTo(0.2, 3)
    expect(w2).toBeCloseTo(0.4, 3)
  })

  it('Serration amplitude increases width variance along span', () => {
    const base = defaultSwordParams()
    base.blade.serrationAmplitude = 0
    base.blade.serrationFrequency = 0
    const s1 = new SwordGenerator(base)
    const v1 = widthsStdDev(s1)!
    const ser = defaultSwordParams()
    ser.blade.serrationAmplitude = 0.08
    ser.blade.serrationFrequency = 8
    ser.blade.serrationPattern = 'sine' as any
    const s2 = new SwordGenerator(ser)
    const v2 = widthsStdDev(s2)!
    expect(greater(v2, v1)).toBe(true)
  })

  // Note: asymmetry alters left/right halves but preserves total width; centerline measurement requires surface-aware sampling, which we cover indirectly in curvature tests.

  it('Guard width increases guard X span', () => {
    const base = defaultSwordParams()
    const s1 = new SwordGenerator(base)
    const g1 = partBounds(s1, 'guard')!
    const wider = defaultSwordParams()
    wider.guard.width = base.guard.width * 1.4
    const s2 = new SwordGenerator(wider)
    const g2 = partBounds(s2, 'guard')!
    expect(greater(g2.size.x, g1.size.x)).toBe(true)
  })

  it('Quillon count > 0 adds guard children', () => {
    const base = defaultSwordParams()
    base.guard.quillonCount = 0
    const s1 = new SwordGenerator(base)
    const c1 = groupDescendantsCount(((s1 as any).guardGroup as THREE.Group | null) ?? (s1.guardMesh as any))
    const withQ = defaultSwordParams()
    withQ.guard.quillonCount = 2
    withQ.guard.quillonLength = 0.3
    const s2 = new SwordGenerator(withQ)
    const c2 = groupDescendantsCount(((s2 as any).guardGroup as THREE.Group | null) ?? (s2.guardMesh as any))
    expect(c2).toBeGreaterThan(c1)
  })

  it('Handle wrap depth inflates handle radius (X span)', () => {
    const base = defaultSwordParams()
    base.handle.wrapEnabled = false
    const s1 = new SwordGenerator(base)
    const h1 = partBounds(s1, 'handle')!
    const wrapped = defaultSwordParams()
    wrapped.handle.wrapEnabled = true
    wrapped.handle.wrapTurns = 8
    wrapped.handle.wrapDepth = 0.04
    const s2 = new SwordGenerator(wrapped)
    const h2 = partBounds(s2, 'handle')!
    expect(greater(h2.size.x, h1.size.x)).toBe(true)
  })

  it('Handle ovalRatio > 1 widens X and reduces Z', () => {
    const base = defaultSwordParams()
    base.handle.ovalRatio = 1.0
    const s1 = new SwordGenerator(base)
    const h1 = partBounds(s1, 'handle')!
    const oval = defaultSwordParams()
    oval.handle.ovalRatio = 1.4
    const s2 = new SwordGenerator(oval)
    const h2 = partBounds(s2, 'handle')!
    expect(greater(h2.size.x, h1.size.x)).toBe(true)
    expect(less(h2.size.z, h1.size.z)).toBe(true)
  })

  it('Pommel size scales pommel bounds', () => {
    const base = defaultSwordParams()
    const s1 = new SwordGenerator(base)
    const p1 = partBounds(s1, 'pommel')!
    const bigger = defaultSwordParams()
    bigger.pommel.size = base.pommel.size * 1.8
    const s2 = new SwordGenerator(bigger)
    const p2 = partBounds(s2, 'pommel')!
    expect(greater(p2.size.x + p2.size.y + p2.size.z, p1.size.x + p1.size.y + p1.size.z)).toBe(true)
  })

  it('Scabbard appears when enabled', () => {
    const base = defaultSwordParams()
    base.accessories!.scabbard.enabled = false
    const s1 = new SwordGenerator(base)
    expect(s1.scabbardGroup).toBeNull()
    const withScabbard = defaultSwordParams()
    withScabbard.accessories!.scabbard.enabled = true
    const s2 = new SwordGenerator(withScabbard)
    expect(s2.scabbardGroup).not.toBeNull()
  })
})
