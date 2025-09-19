import type { AAMode, QualityPreset } from './renderConfig'

type RenderHooks = {
  setPostFXEnabled?: (enabled: boolean) => void
  setAAMode: (mode: AAMode) => void
  setShadowMapSize: (size: 1024|2048|4096) => void
  setShadowBias: (bias: number, normalBias?: number) => void
  setToneMapping?: (mode: 'ACES'|'Reinhard'|'Cineon'|'Linear'|'None') => void
  setExposure: (v: number) => void
  setEnvIntensity: (v: number) => void
}

type RenderState = {
  postFxEnabled: boolean
  aaMode: AAMode
  qualityPreset: QualityPreset
  shadowMapSize: 1024|2048|4096
  toneMapping: 'ACES'|'Reinhard'|'Cineon'|'Linear'|'None'
  exposure: number
  envMapIntensity: number
}

type PostState = {
  outlineEnabled: boolean
  outlineStrength: number
  outlineThickness: number
  outlineColor: string
}

type Checkbox = (
  parent: HTMLElement,
  label: string,
  value: boolean,
  onChange: (v: boolean) => void,
  rerender: () => void,
  tooltip?: string,
  fieldOverride?: string
) => unknown

type Select = (
  parent: HTMLElement,
  label: string,
  options: string[],
  value: string,
  onChange: (v: string) => void,
  rerender: () => void,
  tooltip?: string,
  fieldOverride?: string
) => unknown

type Slider = (
  parent: HTMLElement,
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
  onChange: (v: number) => void,
  rerender: () => void,
  tooltip?: string,
  fieldOverride?: string
) => unknown

export function attachRenderQualityPanel(opts: {
  section: HTMLElement
  render: RenderHooks
  rstate: RenderState
  postState: PostState
  supportedAAModes: AAMode[]
  applyQualityPreset: (preset: QualityPreset, emitUi?: boolean) => void
  refreshWarnings: () => void
  checkbox: Checkbox
  select: Select
  slider: Slider
  rerender: () => void
}) {
  const { section: rQual, render, rstate, supportedAAModes, applyQualityPreset, refreshWarnings, checkbox, select, slider, rerender } = opts

  checkbox(rQual, 'Post FX Pipeline', rstate.postFxEnabled, (v) => {
    rstate.postFxEnabled = v
    render.setPostFXEnabled?.(v)
    refreshWarnings()
  }, () => {}, 'Disable to render directly without post-processing for a performance boost.')

  select(
    rQual,
    'AA Mode',
    supportedAAModes,
    rstate.aaMode,
    (v) => {
      const next = v as AAMode
      rstate.aaMode = next
      render.setAAMode(next)
    },
    () => {},
    'Anti-aliasing mode. MSAA appears when WebGL2 multisampling is available.'
  )

  select(rQual, 'Quality', ['Low','Medium','High'], rstate.qualityPreset, (v) => {
    applyQualityPreset(v as QualityPreset, true)
  }, () => {}, 'Quality preset (affects AA, shadows, DPR).')

  select(rQual, 'Shadow Map', ['1024','2048','4096'], String(rstate.shadowMapSize), (v) => {
    const size = parseInt(v,10) as 1024|2048|4096
    rstate.shadowMapSize = size
    render.setShadowMapSize(size)
  }, () => {}, 'Shadow map resolution.')

  slider(rQual, 'Shadow Bias', -0.01, 0.01, 0.0001, -0.0005, (v) => { render.setShadowBias(v) }, () => {}, 'Shadow acne/peter-panning tweak.')

  select(rQual, 'Tone Mapping', ['ACES','Reinhard','Cineon','Linear','None'], rstate.toneMapping, (v) => {
    rstate.toneMapping = v as any
    render.setToneMapping?.(v as any)
  }, () => {}, 'Renderer tone mapping curve.')

  slider(rQual, 'Exposure', 0.5, 2.0, 0.01, rstate.exposure, (v) => { rstate.exposure = v; render.setExposure(v) }, () => {}, 'Tone mapping exposure.')

  slider(rQual, 'Env Intensity', 0, 3.0, 0.01, rstate.envMapIntensity, (v) => { rstate.envMapIntensity = v; render.setEnvIntensity(v) }, () => {}, 'Environment map intensity (reflections).')
}

