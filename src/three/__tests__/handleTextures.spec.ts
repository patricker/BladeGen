import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as THREE from 'three'
import { makeWrapTexture } from '../../three/sword/handleTextures'

const prevDoc = globalThis.document as any

describe('handleTextures', () => {
  beforeAll(() => {
    // Minimal canvas stub for CanvasTexture
    const ctx2d = {
      fillStyle: '#000',
      translate: (_x:number,_y:number)=>{},
      rotate: (_r:number)=>{},
      save:()=>{},
      restore:()=>{},
      fillRect: (_x:number,_y:number,_w:number,_h:number)=>{},
    }
    const canvas = { width: 0, height: 0, getContext: (_:string)=>ctx2d }
    ;(globalThis as any).document = { createElement: (_:string)=>canvas }
  })
  afterAll(() => { (globalThis as any).document = prevDoc })

  it('creates a repeating sRGB canvas texture', () => {
    const tex = makeWrapTexture(8, Math.PI/4)
    expect(tex).toBeInstanceOf(THREE.CanvasTexture)
    expect(tex.wrapS).toBe(THREE.RepeatWrapping)
    expect(tex.wrapT).toBe(THREE.RepeatWrapping)
  })
})

