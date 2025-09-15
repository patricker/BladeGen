import * as THREE from 'three'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { makeMistNoiseTexture } from '../../../three/fx/mist'
import { MistShader } from '../../../three/fx/shaders'

const prevDoc = globalThis.document as any

describe('fx/mist', () => {
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

  it('creates a noise texture and can bind to a shader uniform', () => {
    const tex = makeMistNoiseTexture(32, 7)
    expect(tex).toBeInstanceOf(THREE.CanvasTexture)
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone((MistShader as any).uniforms),
      vertexShader: (MistShader as any).vertexShader,
      fragmentShader: (MistShader as any).fragmentShader,
      transparent: true
    })
    ;(mat.uniforms as any).uNoiseTex.value = tex
    expect((mat.uniforms as any).uNoiseTex.value).toBe(tex)
  })
})

