import * as THREE from 'three'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { makeValueNoiseTexture } from '../../../three/fx/noise'

const prevDoc = globalThis.document as any

describe('fx/noise', () => {
  beforeAll(() => {
    const ctx2d = {
      createImageData: (w:number,h:number)=>({ width:w, height:h, data: new Uint8ClampedArray(w*h*4) }),
      putImageData: (_:ImageData,_x:number,_y:number)=>{},
      getImageData: (_x:number,_y:number,_w:number,_h:number)=>({} as any),
      fillRect: (_x:number,_y:number,_w:number,_h:number)=>{},
    } as any
    const canvas = { width: 0, height: 0, getContext: (_:string)=>ctx2d }
    ;(globalThis as any).document = { createElement: (_:string)=>canvas }
  })
  afterAll(() => { (globalThis as any).document = prevDoc })

  it('creates a repeating value noise texture', () => {
    const tex = makeValueNoiseTexture(8, 1337, 64)
    expect(tex).toBeInstanceOf(THREE.CanvasTexture)
    expect(tex.wrapS).toBe(THREE.RepeatWrapping)
    expect(tex.wrapT).toBe(THREE.RepeatWrapping)
  })
})

