import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import { SwordGenerator, defaultSwordParams } from '../../three/SwordGenerator'

describe('SwordGenerator', () => {
  it('builds all parts and computes dynamics', () => {
    const params = defaultSwordParams()
    const mats:any = { blade: {}, guard: {}, handle: {}, pommel: {} }
    const gen = new SwordGenerator(params, mats)
    expect(gen.bladeMesh).toBeTruthy()
    expect(gen.handleMesh).toBeTruthy()
    expect(gen.pommelMesh).toBeTruthy()
    expect(gen.group.children.length).toBeGreaterThan(0)
    const dyn = gen.getDerived()
    expect(dyn).toBeTruthy()
    expect(dyn!.mass).toBeGreaterThan(0)
  })
})

