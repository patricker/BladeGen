type RenderHooks = {
  setRenderMode?: (mode: 'standard'|'pixelArt') => void
  getRenderMode?: () => 'standard'|'pixelArt'
  setPixelArtOptions?: (opts: { pixelSize?: number; posterizeLevels?: number }) => void
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

export function attachRenderPixelArtPanel(opts: {
  section: HTMLElement
  render: RenderHooks
  state: { mode: 'Standard'|'Pixel Art'; pixelSize: number; posterize: number }
  select: Select
  slider: Slider
  rerender: () => void
}) {
  const { section, render, state, select, slider } = opts

  // Group container so we can hide pixel sub-controls when mode is Standard
  const doc: Document | null = (typeof document !== 'undefined') ? document : (section as any).ownerDocument || null
  const group = doc ? doc.createElement('div') : ({} as HTMLElement)
  if (doc) { group.className = 'group' }
  const label = doc ? doc.createElement('div') : ({} as HTMLElement)
  if (doc) { label.className = 'group-label'; label.textContent = 'Pixel Art Options' }
  if ((group as any).appendChild && label) (group as any).appendChild(label)
  if ((section as any).appendChild) (section as any).appendChild(group)

  const setGroupVisible = (on: boolean) => { try { (group as any).style.display = on ? '' : 'none' } catch {} }

  select(section, 'Render Mode', ['Standard','Pixel Art'], state.mode, (v) => {
    state.mode = (v === 'Pixel Art') ? 'Pixel Art' : 'Standard'
    if (state.mode === 'Pixel Art') render.setRenderMode?.('pixelArt'); else render.setRenderMode?.('standard')
    setGroupVisible(state.mode === 'Pixel Art')
  }, () => {}, 'Choose Standard or Pixel Art output (low-res pixel grid).')

  // Sliders live in the group container
  slider(group, 'Pixel Size', 1, 12, 1, state.pixelSize, (v) => {
    state.pixelSize = Math.round(Math.max(1, Math.min(64, v)))
    render.setPixelArtOptions?.({ pixelSize: state.pixelSize })
  }, () => {}, 'Size of one pixel block (screen pixels).')

  slider(group, 'Posterize Levels', 0, 8, 1, state.posterize, (v) => {
    state.posterize = Math.round(Math.max(0, Math.min(32, v)))
    render.setPixelArtOptions?.({ posterizeLevels: state.posterize })
  }, () => {}, 'Reduce colors per channel (0 = off).')

  // Initial visibility
  setGroupVisible(state.mode === 'Pixel Art')
}

