import { hexToInt } from '../utils/color';

type AtmosState = {
  envUrl: string;
  envPreset: 'None' | 'Room' | 'Royal Esplanade' | 'Venice Sunset';
  envAsBackground: boolean;
  fogColor: string;
  fogDensity: number;
  fresnelEnabled: boolean;
  fresnelColor: string;
  fresnelIntensity: number;
  fresnelPower: number;
  bladeInvisible: boolean;
  occludeInvisible: boolean;
};

type RenderHooks = {
  setFog?: (colorHex?: number, density?: number) => void;
};

type Checkbox = (
  parent: HTMLElement,
  label: string,
  value: boolean,
  onChange: (v: boolean) => void,
  rerender: () => void,
  tooltip?: string,
  fieldOverride?: string
) => unknown;

type Select = (
  parent: HTMLElement,
  label: string,
  options: string[],
  value: string,
  onChange: (v: string) => void,
  rerender: () => void,
  tooltip?: string,
  fieldOverride?: string
) => unknown;

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
) => unknown;

type ColorPicker = (
  parent: HTMLElement,
  label: string,
  value: string,
  onChange: (hex: string) => void,
  rerender: () => void,
  tooltip?: string,
  fieldOverride?: string
) => unknown;

type TextRow = (
  parent: HTMLElement,
  label: string,
  value: string,
  onChange: (v: string) => void,
  tooltip?: string,
  fieldOverride?: string
) => unknown;

type RegistryLike = { setValue: (ns: string, label: string, value: unknown) => void };

export function attachRenderAtmosPanel(opts: {
  section: HTMLElement;
  render: RenderHooks;
  atmosState: AtmosState;
  applyEnvMap: (url?: string | null, asBackground?: boolean) => void;
  applyEnvPreset: (preset: AtmosState['envPreset'], emitUi?: boolean) => void;
  applyFresnel: () => void;
  applyBladeVisibility: () => void;
  registry: RegistryLike;
  checkbox: Checkbox;
  select: Select;
  slider: Slider;
  colorPicker: ColorPicker;
  textRow: TextRow;
  rerender: () => void;
}) {
  const {
    section: rAtmos,
    render,
    atmosState,
    applyEnvMap,
    applyEnvPreset,
    applyFresnel,
    applyBladeVisibility,
    registry,
    checkbox,
    select,
    slider,
    colorPicker,
    textRow,
  } = opts;

  // Small visual grouping helper
  const addGroup = (parent: HTMLElement, title: string) => {
    const doc: Document | null =
      typeof document !== 'undefined' ? document : (parent as any).ownerDocument || null;
    if (!doc || !(parent as any)?.appendChild) return parent;
    const box = doc.createElement('div') as HTMLElement;
    box.className = 'group';
    const label = doc.createElement('div') as HTMLElement;
    label.className = 'group-label';
    label.textContent = title;
    box.appendChild(label);
    parent.appendChild(box);
    return box;
  };

  // Env Map
  const gEnv = addGroup(rAtmos, 'Environment Map');
  textRow(
    gEnv,
    'EnvMap URL',
    atmosState.envUrl,
    (v) => {
      atmosState.envUrl = v.trim();
      atmosState.envPreset = 'None';
      atmosState.envAsBackground = false;
      applyEnvMap();
      registry.setValue('render-atmospherics', 'Env Preset', 'None');
      registry.setValue('render-atmospherics', 'Env as Background', atmosState.envAsBackground);
    },
    'Equirectangular image URL.'
  );
  select(
    gEnv,
    'Env Preset',
    ['None', 'Room', 'Royal Esplanade', 'Venice Sunset'],
    atmosState.envPreset,
    (v) => {
      applyEnvPreset(v as AtmosState['envPreset'], true);
    },
    () => {},
    'Quick env presets (loads remote HDR).'
  );
  checkbox(
    gEnv,
    'Env as Background',
    atmosState.envAsBackground,
    (v) => {
      atmosState.envAsBackground = v;
      applyEnvMap(undefined, v);
    },
    () => {},
    'Use environment as background. Load URL first, then toggle.'
  );

  // Fog
  const gFog = addGroup(rAtmos, 'Fog');
  colorPicker(
    gFog,
    'Fog Color',
    atmosState.fogColor,
    (hex) => {
      atmosState.fogColor = hex;
      render.setFog?.(hexToInt(atmosState.fogColor), atmosState.fogDensity);
    },
    () => {},
    'Fog base color (exp2).'
  );
  slider(
    gFog,
    'Fog Density',
    0,
    0.1,
    0.001,
    atmosState.fogDensity,
    (v) => {
      atmosState.fogDensity = v;
      render.setFog?.(hexToInt(atmosState.fogColor), atmosState.fogDensity);
    },
    () => {},
    'FogExp2 density (0 disables).'
  );

  // Fresnel edge accent
  const gFresnel = addGroup(rAtmos, 'Fresnel Edge Accent');
  checkbox(
    gFresnel,
    'Fresnel',
    atmosState.fresnelEnabled,
    (v) => {
      atmosState.fresnelEnabled = v;
      applyFresnel();
    },
    () => {},
    'Additive edge accent based on view angle.'
  );
  slider(
    gFresnel,
    'Fresnel Intensity',
    0,
    2.0,
    0.01,
    atmosState.fresnelIntensity,
    (v) => {
      atmosState.fresnelIntensity = v;
      applyFresnel();
    },
    () => {},
    'Fresnel intensity.'
  );
  slider(
    gFresnel,
    'Fresnel Power',
    0.5,
    6.0,
    0.1,
    atmosState.fresnelPower,
    (v) => {
      atmosState.fresnelPower = v;
      applyFresnel();
    },
    () => {},
    'Fresnel power exponent.'
  );
  colorPicker(
    gFresnel,
    'Fresnel Color',
    atmosState.fresnelColor,
    (hex) => {
      atmosState.fresnelColor = hex;
      applyFresnel();
    },
    () => {},
    'Fresnel color.'
  );

  // Blade visibility controls
  const gVis = addGroup(rAtmos, 'Blade Visibility');
  checkbox(
    gVis,
    'Blade Invisible',
    atmosState.bladeInvisible,
    (v) => {
      atmosState.bladeInvisible = v;
      applyBladeVisibility();
    },
    () => {},
    'Hide blade surface but keep effects like aura, glow, mist.'
  );
  checkbox(
    gVis,
    'Occlude When Invisible',
    atmosState.occludeInvisible,
    (v) => {
      atmosState.occludeInvisible = v;
      applyBladeVisibility();
    },
    () => {},
    'When enabled, hidden blade still writes depth (occludes).'
  );
}
