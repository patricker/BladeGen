import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { FxManager } from '../../../three/fx/manager'

// Minimal fake renderer methods for no-op composition
class FakeRenderer extends (THREE.WebGLRenderer as any) {
  constructor(){ super({ antialias:false }); }
}

describe('fx/manager', () => {
  it('exposes layers and toggles object layers', () => {
    // Use real renderer to satisfy EffectComposer types, but we won't render.
    const renderer = { getSize: ()=>({x:0,y:0}), setRenderTarget: ()=>{}, setClearColor: ()=>{}, clear: ()=>{}, render: ()=>{} } as any
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    const mgr = new FxManager(renderer, scene, camera)
    const o = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
    expect(mgr.BLOOM_LAYER).toBeGreaterThan(0)
    expect(mgr.HEAT_LAYER).toBeGreaterThan(0)
    mgr.markForBloom(o, true)
    expect(o.layers.mask & (1<<mgr.BLOOM_LAYER)).toBeTruthy()
    mgr.markForHeat(o, true)
    expect(o.layers.mask & (1<<mgr.HEAT_LAYER)).toBeTruthy()
  })
})
