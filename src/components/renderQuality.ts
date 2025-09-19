import type { AAMode, QualityPreset, QualityPresetMap } from './renderConfig'
import { makeQualityPresets } from './renderConfig'

type RenderHooks = {
  setAAMode: (mode: AAMode) => void
  setShadowMapSize: (size: 1024|2048|4096) => void
  setBloom: (enabled: boolean, strength?: number, threshold?: number, radius?: number) => void
  setOutline: (enabled: boolean, strength?: number, thickness?: number, colorHex?: number) => void
  setDPRCap: (cap: number) => void
  setShadowBias: (bias: number, normalBias?: number) => void
}

type RenderState = {
  aaMode: AAMode
  shadowMapSize: 1024|2048|4096
  qualityPreset: QualityPreset
  bloomEnabled: boolean
}

type PostState = {
  outlineEnabled: boolean
  outlineStrength: number
  outlineThickness: number
  outlineColor: string
}

type RegistryLike = { setValue: (namespace: string, label: string, value: unknown) => void }

export function createApplyQualityPreset(
  render: RenderHooks,
  rstate: RenderState,
  postState: PostState,
  registry: RegistryLike,
  refreshWarnings: () => void,
  supportedAAModes: AAMode[]
) {
  const QUALITY_PRESETS: QualityPresetMap = makeQualityPresets(supportedAAModes)
  return (preset: QualityPreset, emitUi = false) => {
    const cfg = QUALITY_PRESETS[preset]
    if (!cfg) return
    render.setAAMode(cfg.aa)
    render.setShadowMapSize(cfg.shadow)
    render.setBloom(cfg.bloom, (rstate as any).bloomStrength, (rstate as any).bloomThreshold, (rstate as any).bloomRadius)
    render.setOutline(
      cfg.outline,
      postState.outlineStrength,
      postState.outlineThickness,
      parseInt(postState.outlineColor.replace('#', '0x'))
    )
    render.setDPRCap(cfg.dpr)
    if (cfg.shadowBias !== undefined) render.setShadowBias(cfg.shadowBias)
    rstate.aaMode = cfg.aa
    rstate.shadowMapSize = cfg.shadow
    rstate.qualityPreset = preset
    rstate.bloomEnabled = cfg.bloom
    postState.outlineEnabled = cfg.outline
    if (emitUi) {
      registry.setValue('render-quality-exposure', 'AA Mode', cfg.aa)
      registry.setValue('render-quality-exposure', 'Shadow Map', String(cfg.shadow))
      registry.setValue('render-quality-exposure', 'Quality', preset)
      registry.setValue('render-post', 'Bloom Enabled', cfg.bloom)
      registry.setValue('render-post', 'Outline Enabled', cfg.outline)
    }
    refreshWarnings()
  }
}

