import { defaultSwordParams, type SwordParams } from '../three/SwordGenerator'
import type { Part, MatExt, MaterialVariant } from './types'

export type PresetRenderOverrides = Partial<{
  exposure: number
  ambient: number
  keyIntensity: number
  keyAz: number
  keyEl: number
  rimIntensity: number
  rimAz: number
  rimEl: number
  rimColor: string
  bloomEnabled: boolean
  bloomStrength: number
  bloomThreshold: number
  bloomRadius: number
  envMapIntensity: number
  bgColor: string
  bgBrightness: number
  aaMode: 'none' | 'fxaa' | 'smaa' | 'msaa'
  shadowMapSize: 1024 | 2048 | 4096
  qualityPreset: 'Low' | 'Medium' | 'High'
  toneMapping: 'ACES' | 'Reinhard' | 'Cineon' | 'Linear' | 'None'
}>

export type PresetPostOverrides = Partial<{
  outlineEnabled: boolean
  outlineStrength: number
  outlineThickness: number
  outlineColor: string
  inkEnabled: boolean
  inkThickness: number
  inkColor: string
  vignetteEnabled: boolean
  vignetteStrength: number
  vignetteSoftness: number
  bladeGradientEnabled: boolean
  gradBase: string
  gradEdge: string
  gradFade: number
  gradWear: number
}>

export type PresetAtmosOverrides = Partial<{
  envUrl: string
  envPreset: 'None' | 'Room' | 'Royal Esplanade' | 'Venice Sunset'
  envAsBackground: boolean
  fogColor: string
  fogDensity: number
  fresnelEnabled: boolean
  fresnelColor: string
  fresnelIntensity: number
  fresnelPower: number
  bladeInvisible: boolean
  occludeInvisible: boolean
}>

export type PresetFxOverrides = Partial<{
  innerGlow: Partial<{ enabled: boolean; color: string; min: number; max: number; speed: number }>
  mist: Partial<{
    enabled: boolean
    color: string
    density: number
    speed: number
    spread: number
    size: number
    lifeRate: number
    turbulence: number
    windX: number
    windZ: number
    emission: 'base' | 'edge' | 'tip' | 'full'
    sizeMinRatio: number
    occlude: boolean
  }>
  flame: Partial<{
    enabled: boolean
    color1: string
    color2: string
    intensity: number
    speed: number
    noiseScale: number
    scale: number
    direction: 'Up' | 'Down'
    blend: 'Add' | 'Darken' | 'Multiply'
  }>
  embers: Partial<{ enabled: boolean; count: number; size: number; color: string }>
  selectiveBloom: boolean
  heatHaze: boolean
}>

export type PresetEntry = {
  id: string
  label: string
  build: () => SwordParams
  materials?: Partial<Record<Part, Partial<MatExt>>>
  variants?: Array<{ id?: string; name: string; description?: string; parts: Partial<Record<Part, Partial<MatExt>>> }>
  render?: PresetRenderOverrides
  post?: PresetPostOverrides
  atmos?: PresetAtmosOverrides
  fx?: PresetFxOverrides
}

// --- Preset builders ---

export function presetArming(): SwordParams {
  const p = defaultSwordParams()
  p.blade.length = 2.6
  p.blade.baseWidth = 0.22
  p.blade.tipWidth = 0.01
  p.blade.tipRampStart = 0.82
  p.blade.kissakiLength = 0.16
  p.blade.kissakiRoundness = 0.05
  p.blade.tipShape = 'spear'
  p.blade.crossSection = 'diamond'
  p.blade.thickness = 0.07
  p.blade.thicknessLeft = 0.07
  p.blade.thicknessRight = 0.07
  p.blade.fullerEnabled = true
  p.blade.fullerDepth = 0.015
  p.blade.fullerLength = 0.55
  p.blade.fullerWidth = 0.05
  p.blade.fullerMode = 'overlay'
  p.blade.fullerCount = 1
  p.blade.chaos = 0
  p.blade.edgeType = 'double'
  p.blade.ricassoLength = 0.04
  p.blade.falseEdgeLength = 0
  p.blade.falseEdgeDepth = 0

  p.guard.style = 'bar'
  p.guard.width = 1.15
  p.guard.thickness = 0.18
  p.guard.curve = 0
  p.guard.tilt = 0
  p.guard.guardBlendFillet = 0.05
  p.guard.guardBlendFilletStyle = 'smooth'
  p.guard.ornamentation = 0.1

  p.handle.length = 0.85
  p.handle.radiusTop = 0.11
  p.handle.radiusBottom = 0.11
  p.handle.segmentation = false
  p.handle.wrapEnabled = true
  p.handle.wrapTurns = 6
  p.handle.wrapDepth = 0.01
  p.handle.wrapTexture = true
  p.handle.wrapTexScale = 9
  p.handle.wrapTexAngle = Math.PI / 6
  ;(p.handle as any).ovalRatio = 1.1

  p.pommel.style = 'scentStopper'
  p.pommel.size = 0.17
  p.pommel.elongation = 1.2
  p.pommel.shapeMorph = 0.25
  p.pommel.facetCount = 20
  p.pommel.balance = 0.1

  return p
}

export function presetJian(): SwordParams {
  const p = defaultSwordParams()
  p.blade.length = 2.9
  p.blade.baseWidth = 0.19
  p.blade.tipWidth = 0.04
  p.blade.tipRampStart = 0.78
  p.blade.crossSection = 'diamond'
  p.blade.bevel = 0.45
  p.blade.fullerEnabled = true
  p.blade.fullerDepth = 0.012
  p.blade.fullerLength = 0.55
  p.blade.fullerWidth = 0.035
  p.blade.fullerMode = 'overlay'
  p.blade.fullerCount = 1
  p.blade.chaos = 0
  p.blade.edgeType = 'double'
  p.blade.thickness = 0.065
  p.blade.thicknessLeft = 0.065
  p.blade.thicknessRight = 0.065

  p.guard.style = 'bar'
  p.guard.width = 0.42
  p.guard.thickness = 0.14
  p.guard.curve = 0.05
  p.guard.tilt = 0
  p.guard.guardBlendFillet = 0.12
  p.guard.guardBlendFilletStyle = 'smooth'
  p.guard.ornamentation = 0.25

  p.handle.length = 0.8
  p.handle.radiusTop = 0.115
  p.handle.radiusBottom = 0.11
  p.handle.segmentation = false
  p.handle.wrapEnabled = false
  ;(p.handle as any).ovalRatio = 1.05

  p.pommel.style = 'ring'
  p.pommel.size = 0.15
  p.pommel.elongation = 1.05
  p.pommel.shapeMorph = 0.2
  p.pommel.ringInnerRadius = 0.06
  p.pommel.balance = 0.08

  return p
}

export function presetGladius(): SwordParams {
  const p = defaultSwordParams()
  p.blade.length = 2.2
  p.blade.baseWidth = 0.28
  p.blade.tipWidth = 0.12
  p.blade.tipShape = 'leaf'
  p.blade.tipBulge = 0.65
  p.blade.thickness = 0.08
  p.blade.thicknessLeft = 0.08
  p.blade.thicknessRight = 0.08
  p.blade.curvature = 0
  p.blade.sweepSegments = 88
  p.blade.crossSection = 'lenticular'
  p.blade.bevel = 0.5
  p.blade.fullerEnabled = false
  p.blade.edgeType = 'double'

  p.guard.style = 'disk'
  p.guard.width = 0.48
  p.guard.thickness = 0.18
  p.guard.curve = 0.12
  p.guard.guardBlendFillet = 0.18
  p.guard.guardBlendFilletStyle = 'smooth'

  p.handle.length = 0.7
  p.handle.radiusTop = 0.14
  p.handle.radiusBottom = 0.13
  p.handle.segmentation = true
  ;(p.handle as any).segmentationCount = 6
  ;(p.handle as any).flare = 0.04
  p.handle.wrapEnabled = false

  p.pommel.style = 'orb'
  p.pommel.size = 0.2
  p.pommel.elongation = 0.9
  p.pommel.shapeMorph = 0.35
  ;(p.pommel as any).balance = 0.12

  return p
}

export function presetKatana(): SwordParams {
  const p = defaultSwordParams()
  p.blade.length = 3.3
  p.blade.baseWidth = 0.22
  p.blade.tipWidth = 0.06
  p.blade.curvature = 0.25
  p.blade.thickness = 0.08
  ;(p.blade as any).crossSection = 'lenticular'
  ;(p.blade as any).bevel = 0.6
  p.blade.fullerEnabled = false
  p.blade.fullerDepth = 0
  p.blade.fullerLength = 0
  ;(p.blade as any).asymmetry = 0.2
  p.blade.chaos = 0.05
  ;(p.blade as any).edgeType = 'single'
  p.blade.thicknessLeft = 0.1
  p.blade.thicknessRight = 0.02
  ;(p.blade as any).hamonEnabled = true
  ;(p.blade as any).hamonWidth = 0.018
  ;(p.blade as any).hamonAmplitude = 0.007
  ;(p.blade as any).hamonFrequency = 6
  ;(p.blade as any).hamonSide = 'right'
  p.guard.style = 'disk'
  p.guard.width = 0.36
  p.guard.thickness = 0.1
  p.guard.curve = 0
  p.guard.tilt = 0
  ;(p.blade as any).baseAngle = 0.05
  ;(p.blade as any).soriProfile = 'koshi'
  ;(p.blade as any).soriBias = 0.7
  ;(p.blade as any).kissakiLength = 0.12
  ;(p.blade as any).kissakiRoundness = 0.6
  ;(p.guard as any).habakiEnabled = true
  ;(p.guard as any).habakiHeight = 0.06
  ;(p.guard as any).habakiMargin = 0.012
  p.handle.length = 1.1
  p.handle.radiusTop = 0.11
  p.handle.radiusBottom = 0.11
  p.handle.segmentation = false
  p.handle.wrapEnabled = true
  ;(p.handle as any).wrapTexture = true
  p.handle.wrapTurns = 10
  p.handle.wrapDepth = 0.012
  ;(p.handle as any).ovalRatio = 1.2
  p.pommel.style = 'disk'
  p.pommel.size = 0.12
  p.pommel.elongation = 1.0
  p.pommel.shapeMorph = 0.1
  return p
}

export function presetClaymore(): SwordParams {
  const p = defaultSwordParams()
  p.blade.length = 2.8
  p.blade.baseWidth = 0.32
  p.blade.tipWidth = 0.08
  p.blade.curvature = 0.0
  ;(p.blade as any).crossSection = 'diamond'
  ;(p.blade as any).bevel = 0.5
  p.blade.fullerEnabled = true
  p.blade.fullerDepth = 0.03
  p.blade.fullerLength = 0.6
  p.guard.style = 'winged'
  p.guard.width = 1.6
  p.guard.thickness = 0.24
  p.guard.curve = 0.15
  p.handle.length = 0.9
  p.handle.radiusTop = 0.13
  p.handle.radiusBottom = 0.13
  p.handle.segmentation = false
  p.pommel.style = 'orb'
  p.pommel.size = 0.18
  p.pommel.elongation = 1.0
  p.pommel.shapeMorph = 0.1
  return p
}

export function presetRapier(): SwordParams {
  const p = defaultSwordParams()
  p.blade.length = 3.2
  p.blade.baseWidth = 0.18
  p.blade.tipWidth = 0.05
  p.blade.curvature = 0.0
  ;(p.blade as any).crossSection = 'diamond'
  ;(p.blade as any).bevel = 0.3
  p.blade.fullerEnabled = false
  p.blade.fullerDepth = 0.0
  p.blade.fullerLength = 0.0
  p.guard.style = 'claw'
  p.guard.width = 1.2
  p.guard.thickness = 0.18
  p.guard.curve = 0.3
  p.guard.tilt = 0.1
  p.handle.length = 1.0
  p.handle.radiusTop = 0.11
  p.handle.radiusBottom = 0.11
  p.handle.segmentation = false
  p.pommel.style = 'disk'
  p.pommel.size = 0.16
  p.pommel.elongation = 1.0
  p.pommel.shapeMorph = 0.3
  return p
}

export function presetDemon(): SwordParams {
  const p = defaultSwordParams()
  p.blade.length = 3.6
  p.blade.baseWidth = 0.28
  p.blade.tipWidth = 0.02
  p.blade.curvature = -0.2
  p.blade.serrationAmplitude = 0.08
  p.blade.serrationFrequency = 10
  p.blade.fullerEnabled = true
  p.blade.fullerDepth = 0.02
  p.blade.fullerLength = 0.4
  p.guard.style = 'claw'
  p.guard.width = 1.8
  p.guard.thickness = 0.28
  p.guard.curve = -0.5
  p.guard.tilt = -0.2
  p.handle.length = 0.9
  p.handle.radiusTop = 0.13
  p.handle.radiusBottom = 0.12
  p.handle.segmentation = true
  p.pommel.style = 'spike'
  p.pommel.size = 0.18
  p.pommel.elongation = 1.2
  p.pommel.shapeMorph = 0.7
  return p
}

export function presetLightsaber(): SwordParams {
  const p = defaultSwordParams()
  p.blade.length = 3.05
  p.blade.baseWidth = 0.085
  p.blade.tipWidth = 0.085
  p.blade.tipShape = 'rounded'
  p.blade.thickness = 0.05
  p.blade.thicknessLeft = 0.05
  p.blade.thicknessRight = 0.05
  p.blade.curvature = 0
  p.blade.sweepSegments = 96
  ;(p.blade as any).crossSection = 'hexagonal'
  ;(p.blade as any).bevel = 0.1
  p.blade.fullerEnabled = false
  p.blade.edgeType = 'double'
  ;(p.blade as any).chaos = 0
  ;(p.blade as any).tipRampStart = 0.92
  p.guardEnabled = false
  p.handle.length = 1.05
  p.handle.radiusTop = 0.11
  p.handle.radiusBottom = 0.11
  p.handle.segmentation = false
  p.handle.wrapEnabled = false
  ;(p.handle as any).phiSegments = 48
  ;(p.handle as any).ovalRatio = 1.0
  p.pommel.style = 'disk'
  p.pommel.size = 0.12
  p.pommel.elongation = 1.05
  p.pommel.shapeMorph = 0.15
  p.pommel.balance = 0.05
  return p
}

export function presetSabre(): SwordParams {
  const p = defaultSwordParams()
  p.blade.length = 3.2
  p.blade.baseWidth = 0.19
  p.blade.tipWidth = 0.06
  p.blade.curvature = 0.32
  p.blade.edgeType = 'single'
  p.blade.crossSection = 'lenticular'
  p.blade.bevel = 0.6
  p.blade.thickness = 0.07
  p.blade.thicknessLeft = 0.09
  p.blade.thicknessRight = 0.04
  p.blade.tipRampStart = 0.7
  p.blade.fullerEnabled = true
  p.blade.fullerDepth = 0.012
  p.blade.fullerLength = 0.5
  p.blade.fullerMode = 'overlay'
  p.blade.fullerCount = 1
  p.blade.ricassoLength = 0.03
  return p
}

// Consumers may compose their own preset arrays using the builders above.
