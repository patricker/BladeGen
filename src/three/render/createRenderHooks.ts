import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import type { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import type { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'
import type { SwordGenerator } from '../SwordGenerator'
import { buildPixelatePass } from './passes/pixelate'
import { FxManager } from '../fx/manager'
import { buildBladeGradientWearOverlay } from '../fx/overlays'
import { makeValueNoiseTexture } from '../fx/noise'
import { setPartBump, setPartClearcoat, setPartClearcoatRoughness, setPartColor, setPartMetalness, setPartRoughness } from './materialMutators'

export type MaterialPatch = Partial<{
  color: number
  metalness: number
  roughness: number
  clearcoat: number
  clearcoatRoughness: number
  envMapIntensity: number
  anisotropy: number
  anisotropyRotation: number
  emissiveColor: number | string
  emissiveIntensity: number
  transmission: number
  ior: number
  thickness: number
  attenuationColor: number | string
  attenuationDistance: number
  sheen: number
  sheenColor: number | string
  iridescence: number
  iridescenceIOR: number
  iridescenceThicknessMin: number
  iridescenceThicknessMax: number
  map: string
  normalMap: string
  roughnessMap: string
  metalnessMap: string
  aoMap: string
  bumpMap: string
  displacementMap: string
  alphaMap: string
  clearcoatNormalMap: string
}>

export type RenderHooks = {
  setPartMaterial: (part: 'blade'|'guard'|'handle'|'pommel'|'scabbard'|'tassel', patch: MaterialPatch) => void
  setBladeVisible: (visible: boolean, occlude?: boolean) => void
  setExposure: (v: number) => void
  setToneMapping: (mode: 'None'|'Linear'|'Reinhard'|'Cineon'|'ACES') => void
  setAmbient: (v: number) => void
  setKeyIntensity: (v: number) => void
  setKeyAngles: (az: number, el: number) => void
  setRimIntensity: (v: number) => void
  setRimColor: (hex: number) => void
  setRimAngles: (az: number, el: number) => void
  setBloom: (enabled: boolean, strength?: number, threshold?: number, radius?: number) => void
  setVignette: (enabled: boolean, strength?: number, softness?: number) => void
  setSelectiveBloom: (enabled: boolean, strength?: number, threshold?: number, radius?: number, intensity?: number) => void
  markForBloom: (obj: THREE.Object3D, enable?: boolean) => void
  setHeatHaze: (enabled: boolean, distortion?: number) => void
  markForHeat: (obj: THREE.Object3D, enable?: boolean) => void
  setFlameAura: (enabled: boolean, opts?: { scale?: number; color1?: number; color2?: number; noiseScale?: number; speed?: number; intensity?: number; direction?: 'up'|'down'; blend?: 'add'|'normal'|'multiply' }) => void
  setEmbers: (enabled: boolean, opts?: { count?: number; size?: number; color?: number }) => void
  setMistTurbulence: (v: number) => void
  setBackgroundColor: (hex: number) => void
  setBackgroundBrightness: (v: number) => void
  setBackgroundTargetColor: (hex: number) => void
  setBaseColor: (hex: number) => void
  setAAMode: (mode: 'none'|'fxaa'|'smaa'|'msaa') => void
  setShadowBias: (bias: number, normalBias?: number) => void
  setShadowMapSize: (size: 512|1024|2048|4096) => void
  setEnvMap: (url?: string, asBackground?: boolean) => Promise<void>
  setFog: (colorHex?: number, density?: number) => void
  setInnerGlow: (enabled: boolean, colorHex?: number, iMin?: number, iMax?: number, speed?: number) => void
  setOutline: (enabled: boolean, strength?: number, thickness?: number, colorHex?: number) => void
  setInkOutline: (enabled: boolean, thickness?: number, colorHex?: number) => void
  setEnvIntensity: (v: number) => void
  setPartColor: (part: 'blade'|'guard'|'handle'|'pommel'|'scabbard'|'tassel', hex: number) => void
  setPartMetalness: (part: 'blade'|'guard'|'handle'|'pommel'|'scabbard'|'tassel', v: number) => void
  setPartRoughness: (part: 'blade'|'guard'|'handle'|'pommel'|'scabbard'|'tassel', v: number) => void
  setPartClearcoat: (part: 'blade'|'guard'|'handle'|'pommel'|'scabbard'|'tassel', v: number) => void
  setPartClearcoatRoughness: (part: 'blade'|'guard'|'handle'|'pommel'|'scabbard'|'tassel', v: number) => void
  setDPRCap: (cap: number) => void
  getDPRCap?: () => number
  setRenderMode?: (mode: 'standard'|'pixelArt') => void
  getRenderMode?: () => 'standard'|'pixelArt'
  setPixelArtOptions?: (opts: { pixelSize?: number; posterizeLevels?: number }) => void
  setBladeGradientWear: (enabled: boolean, baseHex?: number, edgeHex?: number, edgeFade?: number, wear?: number) => void
  setPartBump: (part: 'blade'|'guard'|'handle'|'pommel'|'scabbard'|'tassel', enabled: boolean, bumpScale?: number, noiseScale?: number, seed?: number) => void
  setFresnel: (enabled: boolean, colorHex?: number, intensity?: number, power?: number) => void
  setBladeMist: (enabled: boolean, colorHex?: number, density?: number, speed?: number, spread?: number, size?: number) => void
  setBladeMistAdvanced: (cfg: { occlude?: boolean; lifeRate?: number; noiseAmp?: number; noiseFreqX?: number; noiseFreqZ?: number; windX?: number; windZ?: number; emission?: 'base'|'edge'|'tip'|'full'; sizeMinRatio?: number }) => void
  setPostFXEnabled: (enabled: boolean) => void
  supportedAAModes?: Array<'none'|'fxaa'|'smaa'|'msaa'>
  getAAMode?: () => 'none'|'fxaa'|'smaa'|'msaa'
  setAutoSpinEnabled: (enabled: boolean) => void
  getAutoSpinEnabled: () => boolean
}

export interface RenderHookFlags {
  selectiveBloom: boolean
  heatHaze: boolean
}

interface BackgroundState {
  base: THREE.Color
  target: THREE.Color
  getBrightness: () => number
  setBrightness: (v: number) => void
  apply: () => void
  groundMaterial: THREE.MeshStandardMaterial
}

export interface RenderHookContext {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  sword: SwordGenerator
  materials: Record<string, any>
  composer: EffectComposer
  bloom: UnrealBloomPass
  outline: OutlinePass
  vignette: ShaderPass
  ambientLight: THREE.HemisphereLight
  keyLight: THREE.DirectionalLight
  rimLight: THREE.DirectionalLight
  fx: FxManager
  fxLayers: { bloom: number; heat: number }
  flags: RenderHookFlags
  flameMesh: { current: THREE.Mesh | null }
  setFlameAura: (enabled: boolean, opts?: { scale?: number; color1?: number; color2?: number; noiseScale?: number; speed?: number; intensity?: number; direction?: 'up'|'down'; blend?: 'add'|'normal'|'multiply' }) => void
  setEmbers: (enabled: boolean, opts?: { count?: number; size?: number; color?: number }) => void
  mistState: any
  rebuildMist: (count: number) => void
  background: BackgroundState
  aaPasses: { fxaa: ShaderPass | null; smaa: SMAAPass | null }
  updateFXAA: () => void
  msaa: { supported: boolean; maxSamples: number; setSamples: (samples: number) => void; getSamples: () => number }
  envTex: THREE.Texture
  currentEnvTex: { current: THREE.Texture | null }
  buildInkOutline: (scale: number, colorHex: number) => THREE.Group | null
  inkOutlineGroup: { current: THREE.Group | null }
  buildFresnel: (colorHex: number, intensity: number, power: number) => THREE.Group | null
  fresnelGroup: { current: THREE.Group | null }
  innerGlowState: { enabled: boolean; time: number; speed: number; color: number; iMin: number; iMax: number }
  buildInnerGlow: (colorHex: number, iMin: number, iMax: number, speed: number) => THREE.Group | null
  innerGlowGroup: { current: THREE.Group | null }
  innerGlowMaterial: { current: THREE.ShaderMaterial | null }
  buildBladeGradient: (baseHex: number, edgeHex: number, edgeFade: number, wear: number) => THREE.Group | null
  bladeVisibility: { visible: boolean; occlude: boolean }
  applyBladeVisibility: (visible: boolean, occlude: boolean) => void
  setKeyLightAngles: (az: number, el: number) => void
  setRimLightAngles: (az: number, el: number) => void
  setPostFXEnabled: (enabled: boolean) => void
  autoSpin: { setEnabled: (enabled: boolean) => void; getEnabled: () => boolean }
}

export function createRenderHooks(context: RenderHookContext): RenderHooks {
  const {
    renderer,
    scene,
    sword,
    materials,
    composer,
    bloom,
    outline,
    vignette,
    ambientLight,
    keyLight,
    rimLight,
    fx,
    fxLayers,
    flags,
    flameMesh,
    setFlameAura,
    setEmbers,
    mistState,
    rebuildMist,
    background,
  aaPasses,
  updateFXAA,
  msaa,
  envTex,
    currentEnvTex,
    buildInkOutline,
    inkOutlineGroup,
    buildFresnel,
    fresnelGroup,
    innerGlowState,
    buildInnerGlow,
    innerGlowGroup,
    innerGlowMaterial,
    buildBladeGradient,
    bladeVisibility,
    applyBladeVisibility,
    setKeyLightAngles,
    setRimLightAngles,
    setPostFXEnabled,
    autoSpin
  } = context

  // Keep a tracked DPR cap for external readers (e.g., resize logic)
  let dprCap = 2

  const desiredMsaaSamples = () => {
    const { maxSamples } = msaa
    if (!msaa.supported) return 0
    if (!Number.isFinite(maxSamples) || maxSamples <= 0) return 0
    return Math.max(1, Math.min(4, Math.round(maxSamples)))
  }

  const ensureFxaa = () => {
    if (!aaPasses.fxaa) {
      aaPasses.fxaa = new ShaderPass(FXAAShader)
      composer.addPass(aaPasses.fxaa)
      updateFXAA()
    }
    aaPasses.fxaa.enabled = true
  }

  const ensureSmaa = () => {
    if (!aaPasses.smaa) {
      aaPasses.smaa = new SMAAPass(1, 1)
      composer.addPass(aaPasses.smaa)
      updateFXAA()
    }
    aaPasses.smaa.enabled = true
  }

  const disablePostAA = () => {
    if (aaPasses.fxaa) aaPasses.fxaa.enabled = false
    if (aaPasses.smaa) aaPasses.smaa.enabled = false
  }

  const deactivateMsaa = () => {
    if (!msaa.supported) return
    if (msaa.getSamples() !== 0) {
      msaa.setSamples(0)
    }
  }

  const activateMsaa = () => {
    if (!msaa.supported) return false
    const target = desiredMsaaSamples()
    if (target <= 0) return false
    if (msaa.getSamples() !== target) {
      msaa.setSamples(target)
    }
    return true
  }

  let currentAaMode: 'none' | 'fxaa' | 'smaa' | 'msaa' = 'none'

  const setAAModeInternal = (mode: 'none' | 'fxaa' | 'smaa' | 'msaa') => {
    let appliedMode: 'none' | 'fxaa' | 'smaa' | 'msaa' = mode
    if (mode === 'msaa') {
      const enabled = activateMsaa()
      if (!enabled) {
        appliedMode = 'fxaa'
        ensureFxaa()
      } else {
        disablePostAA()
      }
    } else if (mode === 'fxaa') {
      deactivateMsaa()
      ensureFxaa()
      if (aaPasses.smaa) aaPasses.smaa.enabled = false
      appliedMode = 'fxaa'
    } else if (mode === 'smaa') {
      deactivateMsaa()
      // Temporarily fall back to FXAA until SMAA is re-evaluated for stability across presets.
      ensureFxaa()
      if (aaPasses.smaa) aaPasses.smaa.enabled = false
      appliedMode = 'fxaa'
    } else {
      deactivateMsaa()
      disablePostAA()
      appliedMode = 'none'
    }
    currentAaMode = appliedMode
  }

  const renderHooks: RenderHooks = {
    setPartMaterial: (part, patch) => {
      let nextPatch = patch || {}
      // Guard against anisotropy artifacts on geometry without tangents (e.g., blade)
      if (part === 'blade') {
        const geom: any = sword.bladeMesh?.geometry
        const hasTangents = !!geom?.getAttribute?.('tangent')
        if (!hasTangents && (nextPatch.anisotropy !== undefined || nextPatch.anisotropyRotation !== undefined)) {
          nextPatch = { ...nextPatch }
          delete (nextPatch as any).anisotropy
          delete (nextPatch as any).anisotropyRotation
        }
      }
      (materials as any)[part] = { ...(materials as any)[part], ...nextPatch }
      ;(scene as any).__materials = materials
      sword.setMaterials(materials)
      if (part === 'blade' && !bladeVisibility.visible) {
        applyBladeVisibility(false, bladeVisibility.occlude)
      }
    },
    setBladeVisible: (visible, occlude) => {
      bladeVisibility.visible = !!visible
      bladeVisibility.occlude = !!occlude
      applyBladeVisibility(!!visible, !!occlude)
    },
    setExposure: (v) => { renderer.toneMappingExposure = v },
    setPartColor: (part, hex) => {
      (materials as any)[part] = { ...(materials as any)[part], color: hex }
      setPartColor(sword, part, hex)
    },
    setPartMetalness: (part, value) => {
      (materials as any)[part] = { ...(materials as any)[part], metalness: value }
      setPartMetalness(sword, part, value)
    },
    setPartRoughness: (part, value) => {
      (materials as any)[part] = { ...(materials as any)[part], roughness: value }
      setPartRoughness(sword, part, value)
    },
    setPartClearcoat: (part, value) => {
      (materials as any)[part] = { ...(materials as any)[part], clearcoat: value }
      setPartClearcoat(sword, part, value)
    },
    setPartClearcoatRoughness: (part, value) => {
      (materials as any)[part] = { ...(materials as any)[part], clearcoatRoughness: value }
      setPartClearcoatRoughness(sword, part, value)
    },
    setToneMapping: (mode) => {
      const map: Record<string, any> = {
        None: THREE.NoToneMapping,
        Linear: THREE.LinearToneMapping,
        Reinhard: THREE.ReinhardToneMapping,
        Cineon: THREE.CineonToneMapping,
        ACES: THREE.ACESFilmicToneMapping
      }
      renderer.toneMapping = map[mode] ?? THREE.ACESFilmicToneMapping
    },
    setAmbient: (v) => { ambientLight.intensity = v },
    setKeyIntensity: (v) => { keyLight.intensity = v },
    setKeyAngles: (az, el) => setKeyLightAngles(az, el),
    setRimIntensity: (v) => { rimLight.intensity = v },
    setRimColor: (hex) => { rimLight.color.setHex(hex) },
    setRimAngles: (az, el) => setRimLightAngles(az, el),
    setBloom: (enabled, strength, threshold, radius) => {
      bloom.enabled = enabled
      if (strength !== undefined) bloom.strength = strength
      if (threshold !== undefined) bloom.threshold = threshold
      if (radius !== undefined) bloom.radius = radius
    },
    setVignette: (enabled, strength, softness) => {
      vignette.enabled = enabled
      if (strength !== undefined) (vignette.uniforms as any).strength.value = strength
      if (softness !== undefined) (vignette.uniforms as any).softness.value = softness
    },
    setSelectiveBloom: (enabled, strength, threshold, radius, intensity) => {
      flags.selectiveBloom = enabled
      fx.setSelectiveBloom(enabled, { strength, threshold, radius, intensity })
      const target = flameMesh.current ?? sword.bladeMesh
      if (target) {
        if (enabled) target.layers.enable(fxLayers.bloom)
        else target.layers.disable(fxLayers.bloom)
      }
    },
    markForBloom: (obj, enable = true) => { fx.markForBloom(obj, enable) },
    setHeatHaze: (enabled, distortion) => {
      flags.heatHaze = enabled
      fx.setHeatHaze(enabled, distortion)
      const target = flameMesh.current ?? sword.bladeMesh
      if (target) {
        if (enabled) target.layers.enable(fxLayers.heat)
        else target.layers.disable(fxLayers.heat)
      }
    },
    markForHeat: (obj, enable = true) => { fx.markForHeat(obj, enable) },
    setFlameAura: (enabled, opts) => { setFlameAura(enabled, opts) },
    setEmbers: (enabled, opts) => { setEmbers(enabled, opts) },
    setMistTurbulence: (v) => { (mistState as any).turbulence = Math.max(0, v) },
    setBackgroundColor: (hex) => { background.base.setHex(hex); background.apply() },
    setBackgroundBrightness: (v) => { background.setBrightness(v); background.apply() },
    setBackgroundTargetColor: (hex) => { background.target.setHex(hex); background.apply() },
    setBaseColor: (hex) => { background.groundMaterial.color.setHex(hex); background.groundMaterial.needsUpdate = true },
    setAAMode: setAAModeInternal,
    setShadowBias: (bias, normalBias) => {
      if (keyLight.shadow) {
        keyLight.shadow.bias = bias
        if (normalBias !== undefined) keyLight.shadow.normalBias = normalBias
      }
    },
    setShadowMapSize: (size) => {
      if (keyLight.shadow) {
        keyLight.shadow.mapSize.set(size, size)
        keyLight.shadow.dispose?.()
      }
    },
    setEnvMap: async (url, asBackground) => {
      try {
        if (!url) {
          scene.environment = envTex
          if (asBackground) scene.background = null
          if (currentEnvTex.current) currentEnvTex.current.dispose?.()
          currentEnvTex.current = null
          return
        }
        const isHDR = url.toLowerCase().endsWith('.hdr')
        const applyTexture = (tex: THREE.Texture) => {
          const pm = new THREE.PMREMGenerator(renderer)
          const rt = pm.fromEquirectangular(tex)
          const pmtex = rt.texture
          scene.environment = pmtex
          scene.background = asBackground ? pmtex : null
          if (currentEnvTex.current) currentEnvTex.current.dispose?.()
          currentEnvTex.current = pmtex
          tex.dispose()
          pm.dispose()
        }
        if (isHDR) {
          const hdr = new RGBELoader()
          await new Promise<void>((resolve, reject) => {
            hdr.load(url, (hdrTex: any) => {
              hdrTex.mapping = THREE.EquirectangularReflectionMapping
              applyTexture(hdrTex as THREE.Texture)
              resolve()
            }, undefined, reject)
          })
        } else {
          const loader = new THREE.TextureLoader()
          await new Promise<void>((resolve, reject) => {
            loader.load(url, (tex) => {
              tex.mapping = THREE.EquirectangularReflectionMapping
              applyTexture(tex)
              resolve()
            }, undefined, reject)
          })
        }
      } catch (e) {
        console.warn('EnvMap load failed', e)
      }
    },
    setFog: (colorHex, density) => {
      if (!density || density <= 0) { scene.fog = null as any; return }
      scene.fog = new THREE.FogExp2(new THREE.Color(colorHex ?? 0xffffff), density)
    },
    setInnerGlow: (enabled, colorHex, iMin, iMax, speed) => {
      if (innerGlowGroup.current) {
        (innerGlowGroup.current.parent as any)?.remove(innerGlowGroup.current)
        innerGlowGroup.current = null
        innerGlowMaterial.current = null
      }
      innerGlowState.enabled = enabled
      innerGlowState.time = 0
      if (speed !== undefined) innerGlowState.speed = speed
      if (colorHex !== undefined) innerGlowState.color = colorHex
      if (iMin !== undefined) innerGlowState.iMin = iMin
      if (iMax !== undefined) innerGlowState.iMax = iMax
      if (enabled) {
        const built = buildInnerGlow(innerGlowState.color, innerGlowState.iMin, innerGlowState.iMax, innerGlowState.speed)
        if (built) {
          innerGlowGroup.current = built
          innerGlowMaterial.current = (built.children[0] as any)?.material ?? null
          sword.group.add(built)
        }
      }
    },
    setOutline: (enabled, strength, thickness, colorHex) => {
      outline.enabled = enabled
      if (strength !== undefined) outline.edgeStrength = strength
      if (thickness !== undefined) outline.edgeThickness = thickness
      if (colorHex !== undefined) outline.visibleEdgeColor.setHex(colorHex)
      outline.selectedObjects = []
      if (sword?.group) outline.selectedObjects.push(sword.group)
    },
    setInkOutline: (enabled, thickness, colorHex) => {
      if (inkOutlineGroup.current) {
        (inkOutlineGroup.current.parent as any)?.remove(inkOutlineGroup.current)
        inkOutlineGroup.current.traverse((o) => {
          const mesh = o as THREE.Mesh
          if (mesh.isMesh) {
            mesh.geometry?.dispose?.()
            mesh.material?.dispose?.()
          }
        })
        inkOutlineGroup.current = null
      }
      if (enabled) {
        const sIn = Math.max(0.0, Math.min(0.2, thickness ?? 0.02))
        const color = colorHex ?? 0x000000
        // Snap thickness to a step derived from pixel size when in Pixel Art mode
        const quantize = (v: number) => {
          if ((renderHooks as any).getRenderMode?.() !== 'pixelArt') return v
          const px = Math.max(1, (renderHooks as any).getRenderMode ? (pixelOpts.pixelSize || 4) : 4)
          const step = Math.max(0.0025, Math.min(0.025, px * 0.0025))
          return Math.max(0.0, Math.min(0.2, Math.round(v / step) * step))
        }
        const s = quantize(sIn)
        // Persist state for reapplication when pixel size changes
        ;(renderHooks as any)._inkOutlineState = { enabled: true, thickness: sIn, color }
        const group = buildInkOutline(s, color)
        if (group) {
          inkOutlineGroup.current = group
          sword.group.add(group)
        }
      }
    },
    setEnvIntensity: (v) => {
      sword.group.traverse((obj) => {
        const mat = (obj as any).material as THREE.Material | THREE.Material[] | undefined
        const apply = (material: any) => {
          if (!material || !('envMapIntensity' in material)) return
          if (material.__baseEnvMapIntensity === undefined) {
            const current = typeof material.envMapIntensity === 'number' ? material.envMapIntensity : 1
            material.__baseEnvMapIntensity = current
          }
          material.envMapIntensity = material.__baseEnvMapIntensity * v
          material.needsUpdate = true
        }
        if (Array.isArray(mat)) mat.forEach(apply); else apply(mat)
      })
    },
    setDPRCap: (cap) => {
      dprCap = cap
      // Back-compat shim in case any legacy code still reads this
      ;(renderer as any)._dprCap = cap
      updateFXAA()
    },
    getDPRCap: () => dprCap,
    // Render mode will be attached below once closures are available
    setBladeGradientWear: (() => {
      let gwGroup: THREE.Group | null = null
      let gwLast: { enabled: boolean; base: number; edge: number; edgeFade: number; wear: number } | null = null
      const apply = (enabled: boolean, base?: number, edge?: number, edgeFade?: number, wear?: number) => {
        if (gwGroup) {
          (gwGroup.parent as any)?.remove(gwGroup)
          gwGroup = null
        }
        if (enabled) {
          const b = base ?? 0xb9c6ff
          const e = edge ?? 0xffffff
          const ef = edgeFade ?? 0.2
          const w = wear ?? 0.2
          gwLast = { enabled: true, base: b, edge: e, edgeFade: ef, wear: w }
          gwGroup = buildBladeGradient(b, e, ef, w)
        } else {
          gwLast = { enabled: false, base: 0, edge: 0, edgeFade: 0, wear: 0 }
        }
      }
      ;(scene as any).__rebuildBladeGradient = () => {
        if (gwLast?.enabled) apply(true, gwLast.base, gwLast.edge, gwLast.edgeFade, gwLast.wear)
      }
      return apply
    })(),
    setPartBump: (part, enabled, bumpScale, noiseScale, seed) => {
      setPartBump(sword, part, enabled, { bumpScale, noiseScale, seed }, makeValueNoiseTexture)
    },
    setFresnel: (enabled, colorHex, intensity, power) => {
      if (fresnelGroup.current) {
        (fresnelGroup.current.parent as any)?.remove(fresnelGroup.current)
        fresnelGroup.current = null
      }
      ;(renderHooks as any)._fresnelState = { enabled, color: colorHex ?? 0xffffff, intensity: intensity ?? 0.6, power: power ?? 2.0 }
      if (enabled) {
        const group = buildFresnel(colorHex ?? 0xffffff, intensity ?? 0.6, power ?? 2.0)
        if (group) {
          fresnelGroup.current = group
          sword.group.add(group)
        }
      }
    },
    setBladeMist: (enabled, colorHex, density, speed, spread, size) => {
      const state = mistState
      if (enabled) state.enabled = true; else state.enabled = false
      if (colorHex !== undefined) state.color = colorHex
      if (density !== undefined) state.density = Math.max(0, Math.min(1, density))
      if (speed !== undefined) state.speed = Math.max(0, speed)
      if (spread !== undefined) state.spread = Math.max(0, spread)
      if (size !== undefined) state.size = size
      const d = Math.max(0.0001, state.density)
      state.alphaScale = 0.35 / Math.sqrt(d * 1.25)
      if (enabled) {
        const count = Math.max(10, Math.floor(400 * state.density))
        rebuildMist(count)
      }
    },
    setBladeMistAdvanced: (cfg) => {
      if (cfg.occlude !== undefined) mistState.occlude = !!cfg.occlude
      if (cfg.lifeRate !== undefined) mistState.lifeRate = Math.max(0.01, cfg.lifeRate)
      if (cfg.noiseAmp !== undefined) mistState.noiseAmp = Math.max(0, cfg.noiseAmp)
      if (cfg.noiseFreqX !== undefined) mistState.noiseFreqX = Math.max(0, cfg.noiseFreqX)
      if (cfg.noiseFreqZ !== undefined) mistState.noiseFreqZ = Math.max(0, cfg.noiseFreqZ)
      if (cfg.windX !== undefined) mistState.windX = cfg.windX
      if (cfg.windZ !== undefined) mistState.windZ = cfg.windZ
      if (cfg.emission !== undefined) mistState.emission = cfg.emission
      if (cfg.sizeMinRatio !== undefined) mistState.sizeMinRatio = Math.max(0, Math.min(1, cfg.sizeMinRatio))
    },
    setPostFXEnabled: (enabled) => {
      setPostFXEnabled(enabled)
    },
    setAutoSpinEnabled: (enabled) => {
      autoSpin.setEnabled(enabled)
    },
    getAutoSpinEnabled: () => autoSpin.getEnabled()
  }

  const supportedModes: Array<'none'|'fxaa'|'smaa'|'msaa'> = msaa.supported
    ? ['none', 'fxaa', 'smaa', 'msaa']
    : ['none', 'fxaa']
  renderHooks.supportedAAModes = supportedModes
  renderHooks.getAAMode = () => currentAaMode

  // Render Mode scaffolding (Standard vs Pixel Art)
  let renderMode: 'standard'|'pixelArt' = 'standard'
  let savedStandard: { aa: 'none'|'fxaa'|'smaa'|'msaa'; bloom: boolean; selectiveBloom: boolean; heat: boolean; dprCap: number } | null = null
  let pixelatePass: ShaderPass | null = null
  let pixelOpts = { pixelSize: 4, posterizeLevels: 0 }
  const applyRenderMode = (mode: 'standard'|'pixelArt') => {
    if (mode === renderMode) return
    if (mode === 'pixelArt') {
      // Save current policies on first switch
      savedStandard = {
        aa: currentAaMode,
        bloom: !!bloom.enabled,
        selectiveBloom: !!flags.selectiveBloom,
        heat: !!flags.heatHaze,
        dprCap
      }
      // Apply pixel art policies
      setAAModeInternal('none')
      bloom.enabled = false
      if (flags.selectiveBloom) {
        flags.selectiveBloom = false
        fx.setSelectiveBloom(false)
      }
      if (flags.heatHaze) {
        flags.heatHaze = false
        fx.setHeatHaze(false)
      }
      // Ensure pixelate pass exists and is enabled (after vignette, before any AA)
      if (!pixelatePass) {
        pixelatePass = buildPixelatePass(pixelOpts.pixelSize, pixelOpts.posterizeLevels)
        composer.addPass(pixelatePass)
        // Initialize resolution from current size
        const size = new THREE.Vector2()
        renderer.getSize(size)
        ;(pixelatePass as any).setSize?.(size.x, size.y)
      }
      pixelatePass.enabled = true
      dprCap = 1
      ;(renderer as any)._dprCap = 1
      updateFXAA()
      renderMode = 'pixelArt'
      return
    }
    // Restore standard policies if we have them
    if (savedStandard) {
      const prev = savedStandard
      setAAModeInternal(prev.aa)
      bloom.enabled = prev.bloom
      if (flags.selectiveBloom !== prev.selectiveBloom) {
        flags.selectiveBloom = prev.selectiveBloom
        fx.setSelectiveBloom(prev.selectiveBloom)
      }
      if (flags.heatHaze !== prev.heat) {
        flags.heatHaze = prev.heat
        fx.setHeatHaze(prev.heat)
      }
      dprCap = prev.dprCap
      ;(renderer as any)._dprCap = dprCap
      updateFXAA()
      if (pixelatePass) pixelatePass.enabled = false
      savedStandard = null
    }
    renderMode = 'standard'
  }
  ;(renderHooks as any).setRenderMode = (mode: 'standard'|'pixelArt') => applyRenderMode(mode)
  ;(renderHooks as any).getRenderMode = () => renderMode

  // Optional tuning for pixel art mode
  ;(renderHooks as any).setPixelArtOptions = (opts: { pixelSize?: number; posterizeLevels?: number }) => {
    pixelOpts.pixelSize = Math.max(1, opts.pixelSize ?? pixelOpts.pixelSize)
    pixelOpts.posterizeLevels = Math.max(0, opts.posterizeLevels ?? pixelOpts.posterizeLevels)
    if (pixelatePass) {
      ;(pixelatePass.uniforms as any).pixelSize.value = pixelOpts.pixelSize
      ;(pixelatePass.uniforms as any).posterizeLevels.value = pixelOpts.posterizeLevels
    }
    // If Ink Outline is active, rebuild it to respect new snapping in Pixel Art mode
    const inkState = (renderHooks as any)._inkOutlineState as { enabled: boolean; thickness: number; color: number } | undefined
    if ((renderHooks as any).getRenderMode?.() === 'pixelArt' && inkState?.enabled) {
      // Re-apply with the original UI thickness (snapping happens inside setInkOutline)
      ;(renderHooks as any).setInkOutline?.(true, inkState.thickness, inkState.color)
    }
  }

  return renderHooks
}
