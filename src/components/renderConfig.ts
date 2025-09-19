export type AAMode = 'none' | 'fxaa' | 'smaa' | 'msaa'

export type QualityPreset = 'Low' | 'Medium' | 'High'

export type QualityPresetEntry = {
  aa: AAMode
  shadow: 1024 | 2048 | 4096
  bloom: boolean
  outline: boolean
  dpr: number
  shadowBias?: number
}

export type QualityPresetMap = Record<QualityPreset, QualityPresetEntry>

export function makeQualityPresets(supportedAAModes: AAMode[]): QualityPresetMap {
  const has = (mode: AAMode) => supportedAAModes.includes(mode)
  const lowAa: AAMode = has('none') ? 'none' : supportedAAModes[0]
  const mediumAa: AAMode = has('fxaa') ? 'fxaa' : supportedAAModes[0]
  const highAa: AAMode = mediumAa
  return {
    Low:    { aa: lowAa,    shadow: 1024, bloom: false, outline: false, dpr: 1.0, shadowBias: -0.0005 },
    Medium: { aa: mediumAa, shadow: 2048, bloom: false, outline: false, dpr: 1.5, shadowBias: -0.0005 },
    High:   { aa: highAa,   shadow: 2048, bloom: false, outline: false, dpr: 2.0, shadowBias: -0.0005 }
  }
}

