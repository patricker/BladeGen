import { hexToInt } from '../utils/color'

type AtmosState = {
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
}

type RenderHooks = {
  setFog?: (colorHex?: number, density?: number) => void
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

type ColorPicker = (
  parent: HTMLElement,
  label: string,
  value: string,
  onChange: (hex: string) => void,
  rerender: () => void,
  tooltip?: string,
  fieldOverride?: string
) => unknown

type TextRow = (
  parent: HTMLElement,
  label: string,
  value: string,
  onChange: (v: string) => void,
  tooltip?: string,
  fieldOverride?: string
) => unknown

type RegistryLike = { setValue: (ns: string, label: string, value: unknown) => void }

export function attachRenderAtmosPanel(opts: {
  section: HTMLElement
  render: RenderHooks
  atmosState: AtmosState
  applyEnvMap: (url?: string | null, asBackground?: boolean) => void
  applyEnvPreset: (preset: AtmosState['envPreset'], emitUi?: boolean) => void
  applyFresnel: () => void
  applyBladeVisibility: () => void
  registry: RegistryLike
  checkbox: Checkbox
  select: Select
  slider: Slider
  colorPicker: ColorPicker
  textRow: TextRow
  rerender: () => void
}) {
  const { section: rAtmos, render, atmosState, applyEnvMap, applyEnvPreset, applyFresnel, applyBladeVisibility, registry, checkbox, select, slider, colorPicker, textRow } = opts

  // Env Map
  textRow(rAtmos, 'EnvMap URL', atmosState.envUrl, (v) => {
    atmosState.envUrl = v.trim()
    atmosState.envPreset = 'None'
    atmosState.envAsBackground = false
    applyEnvMap()
    registry.setValue('render-atmospherics', 'Env Preset', 'None')
    registry.setValue('render-atmospherics', 'Env as Background', atmosState.envAsBackground)
  }, 'Equirectangular image URL.')
  select(rAtmos, 'Env Preset', ['None','Room','Royal Esplanade','Venice Sunset'], atmosState.envPreset, (v) => {
    applyEnvPreset(v as AtmosState['envPreset'], true)
  }, () => {}, 'Quick env presets (loads remote HDR).')
  checkbox(rAtmos, 'Env as Background', atmosState.envAsBackground, (v) => {
    atmosState.envAsBackground = v
    applyEnvMap(undefined, v)
  }, () => {}, 'Use environment as background. Load URL first, then toggle.')

  // Fog
  colorPicker(rAtmos, 'Fog Color', atmosState.fogColor, (hex) => {
    atmosState.fogColor = hex
    render.setFog?.(hexToInt(atmosState.fogColor), atmosState.fogDensity)
  }, () => {}, 'Fog base color (exp2).')
  slider(rAtmos, 'Fog Density', 0, 0.1, 0.001, atmosState.fogDensity, (v) => {
    atmosState.fogDensity = v
    render.setFog?.(hexToInt(atmosState.fogColor), atmosState.fogDensity)
  }, () => {}, 'FogExp2 density (0 disables).')

  // Fresnel edge accent
  checkbox(rAtmos, 'Fresnel', atmosState.fresnelEnabled, (v) => {
    atmosState.fresnelEnabled = v
    applyFresnel()
  }, () => {}, 'Additive edge accent based on view angle.')
  slider(rAtmos, 'Fresnel Intensity', 0, 2.0, 0.01, atmosState.fresnelIntensity, (v) => {
    atmosState.fresnelIntensity = v
    applyFresnel()
  }, () => {}, 'Fresnel intensity.')
  slider(rAtmos, 'Fresnel Power', 0.5, 6.0, 0.1, atmosState.fresnelPower, (v) => {
    atmosState.fresnelPower = v
    applyFresnel()
  }, () => {}, 'Fresnel power exponent.')
  colorPicker(rAtmos, 'Fresnel Color', atmosState.fresnelColor, (hex) => {
    atmosState.fresnelColor = hex
    applyFresnel()
  }, () => {}, 'Fresnel color.')

  // Blade visibility controls
  checkbox(rAtmos, 'Blade Invisible', atmosState.bladeInvisible, (v) => {
    atmosState.bladeInvisible = v
    applyBladeVisibility()
  }, () => {}, 'Hide blade surface but keep effects like aura, glow, mist.')
  checkbox(rAtmos, 'Occlude When Invisible', atmosState.occludeInvisible, (v) => {
    atmosState.occludeInvisible = v
    applyBladeVisibility()
  }, () => {}, 'When enabled, hidden blade still writes depth (occludes).')
}

