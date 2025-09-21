import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { defaultSwordParams, SwordGenerator } from '../SwordGenerator'
import { partBounds, groupDescendantsCount, totalVertices, greater, boundsOf } from './helpers/metrics'

function makeWithGuard(mutator: (p: ReturnType<typeof defaultSwordParams>) => void): SwordGenerator {
  const p = defaultSwordParams()
  // Keep defaults deterministic and avoid accidental extras
  p.guard.quillonCount = 0
  ;(p.guard as any).extras = []
  mutator(p)
  return new SwordGenerator(p)
}

describe('Guard settings affect geometry as expected', () => {
  it('Basket style builds many child rods vs bar', () => {
    const sBar = makeWithGuard((p) => { p.guard.style = 'bar'; p.guard.width = 1.0; p.guard.thickness = 0.2 })
    const sBasket = makeWithGuard((p) => { (p.guard as any).style = 'basket'; p.guard.width = 1.0; p.guard.thickness = 0.2; (p.guard as any).basketRodCount = 12 })
    const barObj = (sBar as any).guardGroup ?? sBar.guardMesh
    const basketObj = (sBasket as any).guardGroup ?? sBasket.guardMesh
    expect(barObj).toBeTruthy()
    expect(basketObj).toBeTruthy()
    expect(groupDescendantsCount(basketObj)).toBeGreaterThan(groupDescendantsCount(barObj))
  })

  it('Disk cutouts increase vertex count for disk guard', () => {
    const s0 = makeWithGuard((p) => { p.guard.style = 'disk'; p.guard.width = 1.2; p.guard.thickness = 0.15; (p.guard as any).cutoutCount = 0 })
    const s8 = makeWithGuard((p) => { p.guard.style = 'disk'; p.guard.width = 1.2; p.guard.thickness = 0.15; (p.guard as any).cutoutCount = 8; (p.guard as any).cutoutRadius = 0.4; p.guard.curveSegments = 24 })
    const v0 = totalVertices((s0 as any).guardMesh ?? (s0 as any).guardGroup)
    const v8 = totalVertices((s8 as any).guardMesh ?? (s8 as any).guardGroup)
    expect(greater(v8, v0)).toBe(true)
  })

  it('Extras (side rings) add child meshes', () => {
    const sBase = makeWithGuard((p) => { p.guard.style = 'bar'; (p.guard as any).extras = [] })
    const sRings = makeWithGuard((p) => { p.guard.style = 'bar'; (p.guard as any).extras = [{ kind:'sideRing', radius: 0.08, thickness: 0.03, offsetY: 0 }] })
    const baseCount = groupDescendantsCount((sBase as any).guardGroup ?? sBase.guardMesh)
    const ringCount = groupDescendantsCount((sRings as any).guardGroup ?? sRings.guardMesh)
    expect(ringCount).toBeGreaterThan(baseCount)
  })

  it('Pas d’âne rings increase child meshes', () => {
    const s0 = makeWithGuard((p) => { p.guard.style = 'bar'; (p.guard as any).pasDaneCount = 0 })
    const s2 = makeWithGuard((p) => { p.guard.style = 'bar'; (p.guard as any).pasDaneCount = 2; (p.guard as any).pasDaneRadius = 0.05; (p.guard as any).pasDaneThickness = 0.01 })
    const c0 = groupDescendantsCount((s0 as any).guardGroup ?? s0.guardMesh)
    const c2 = groupDescendantsCount((s2 as any).guardGroup ?? s2.guardMesh)
    expect(c2).toBeGreaterThan(c0)
  })

  it('Langets enabled adds two meshes hugging blade', () => {
    const s0 = makeWithGuard((p) => { p.guard.style = 'bar'; (p.guard as any).langets = { enabled: false } })
    const s1 = makeWithGuard((p) => { p.guard.style = 'bar'; (p.guard as any).langets = { enabled: true, length: 0.12, width: 0.04, thickness: 0.01 } })
    const c0 = groupDescendantsCount((s0 as any).guardGroup ?? s0.guardMesh)
    const c1 = groupDescendantsCount((s1 as any).guardGroup ?? s1.guardMesh)
    expect(c1).toBeGreaterThan(c0)
  })

  it('Guard fillet adds an extra mesh in the sword group', () => {
    const base = defaultSwordParams()
    base.guard.style = 'bar'
    ;(base.guard as any).guardBlendFillet = 0
    base.guard.quillonCount = 0
    const s0 = new SwordGenerator(base)
    const baseChildren = groupDescendantsCount(s0.group)

    const withFillet = defaultSwordParams()
    withFillet.guard.style = 'bar'
    withFillet.guard.quillonCount = 0
    ;(withFillet.guard as any).guardBlendFillet = 0.8
    ;(withFillet.guard as any).guardBlendFilletStyle = 'box'
    const s1 = new SwordGenerator(withFillet)
    const filletChildren = groupDescendantsCount(s1.group)
    expect(filletChildren).toBeGreaterThan(baseChildren)
  })

  it('Winged style curve increases vertical span', () => {
    const s0 = makeWithGuard((p) => { p.guard.style = 'winged'; p.guard.curve = 0.0; p.guard.tipSharpness = 0.4 })
    const sC = makeWithGuard((p) => { p.guard.style = 'winged'; p.guard.curve = 0.7; p.guard.tipSharpness = 0.4 })
    const b0 = boundsOf(((s0 as any).guardGroup ?? s0.guardMesh) as THREE.Object3D)!
    const bC = boundsOf(((sC as any).guardGroup ?? sC.guardMesh) as THREE.Object3D)!
    const span0 = b0.max.y - b0.min.y
    const spanC = bC.max.y - bC.min.y
    expect(greater(spanC, span0)).toBe(true)
  })

  it('Higher curveSegments increases vertex count for extruded winged guard', () => {
    const s12 = makeWithGuard((p) => { p.guard.style = 'winged'; p.guard.curveSegments = 8 })
    const s48 = makeWithGuard((p) => { p.guard.style = 'winged'; p.guard.curveSegments = 32 })
    const v12 = totalVertices((s12 as any).guardGroup ?? (s12 as any).guardMesh)
    const v48 = totalVertices((s48 as any).guardGroup ?? (s48 as any).guardMesh)
    expect(greater(v48, v12)).toBe(true)
  })
})
