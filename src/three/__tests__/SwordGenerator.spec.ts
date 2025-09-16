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

  it('supports blade-only (no hilt) when hiltEnabled=false', () => {
    const params = defaultSwordParams()
    ;(params as any).hiltEnabled = false
    const gen = new SwordGenerator(params, { blade: {}, guard: {}, handle: {}, pommel: {} } as any)
    expect(gen.bladeMesh).toBeTruthy()
    expect(gen.handleMesh).toBeFalsy()
    expect(gen.pommelMesh).toBeFalsy()
    expect(gen['guardMesh' as any]).toBeFalsy()
  })

  it('removes existing hilt when toggled off', () => {
    const params = defaultSwordParams()
    const gen = new SwordGenerator(params, { blade: {}, guard: {}, handle: {}, pommel: {} } as any)
    expect(gen.handleMesh).toBeTruthy()
    params.hiltEnabled = false as any
    gen.updateGeometry(params as any)
    expect(gen.handleMesh).toBeFalsy()
    expect(gen.pommelMesh).toBeFalsy()
  })

  it('supports disabling only the guard (handle+pommel remain)', () => {
    const params = defaultSwordParams()
    params.guardEnabled = false as any
    const gen = new SwordGenerator(params, { blade: {}, guard: {}, handle: {}, pommel: {} } as any)
    expect(gen.bladeMesh).toBeTruthy()
    expect(gen.handleMesh).toBeTruthy()
    expect(gen.pommelMesh).toBeTruthy()
    expect(gen['guardMesh' as any]).toBeFalsy()
    // Toggling back on rebuilds guard
    params.guardEnabled = true as any
    gen.updateGeometry(params as any)
    expect(gen['guardMesh' as any] || gen['guardGroup' as any]).toBeTruthy()
  })
})
