import * as THREE from 'three'
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

// Mock FontLoader to avoid network
vi.mock('three/examples/jsm/loaders/FontLoader.js', () => {
  class FontLoader {
    load(_url: string, onLoad: (font:any)=>void) {
      const fakeFont = { generateShapes: (_text:string, _size:number) => [new THREE.Shape()] }
      onLoad(fakeFont)
    }
  }
  return { FontLoader }
})

import { buildEngravingsGroup } from '../../three/sword/engravings'

describe('engravings', () => {
  it('returns null when no engravings present', () => {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 0.05))
    const res = buildEngravingsGroup({ length: 2, baseWidth: 0.2, tipWidth: 0.05, thickness: 0.06 } as any, blade)
    expect(res).toBeNull()
  })

  it('builds shape and text engravings on sides', () => {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 0.06))
    const params:any = {
      length: 2, baseWidth: 0.2, tipWidth: 0.05, thickness: 0.06,
      engravings: [
        { type: 'shape', content: 'rect', width: 0.1, height: 0.05, depth: 0.002, offsetY: 0.5, offsetX: 0, side: 'both' },
        { type: 'text', content: 'AB', fontUrl: 'stub://font.json', width: 0.2, height: 0.05, depth: 0.002, offsetY: 0.6, offsetX: 0, side: 'right', letterSpacing: 0.2 }
      ]
    }
    const built = buildEngravingsGroup(params, blade)
    expect(built).toBeTruthy()
    let meshCount = 0
    built!.group.traverse(o=>{ const m = o as THREE.Mesh; if ((m as any).isMesh) meshCount++ })
    expect(meshCount).toBeGreaterThan(0)
  })
})

