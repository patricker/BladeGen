import { hexToInt } from '../utils/color';

type RenderHooks = {
  setBloom: (enabled: boolean, strength?: number, threshold?: number, radius?: number) => void;
  setOutline: (enabled: boolean, strength?: number, thickness?: number, colorHex?: number) => void;
  setInkOutline: (enabled: boolean, thickness?: number, colorHex?: number) => void;
  setVignette: (enabled: boolean, strength?: number, softness?: number) => void;
};

type RenderState = {
  bloomEnabled: boolean;
  bloomStrength: number;
  bloomThreshold: number;
  bloomRadius: number;
};

type PostState = {
  outlineEnabled: boolean;
  outlineStrength: number;
  outlineThickness: number;
  outlineColor: string;
  inkEnabled: boolean;
  inkThickness: number;
  inkColor: string;
  vignetteEnabled: boolean;
  vignetteStrength: number;
  vignetteSoftness: number;
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

export function attachRenderPostPanel(opts: {
  section: HTMLElement;
  render: RenderHooks;
  rstate: RenderState;
  postState: PostState;
  refreshWarnings: () => void;
  checkbox: Checkbox;
  select: Select;
  slider: Slider;
  colorPicker: ColorPicker;
  rerender: () => void;
}) {
  const {
    section: rPost,
    render,
    rstate,
    postState,
    refreshWarnings,
    checkbox,
    slider,
    colorPicker,
  } = opts;

  // Small visual grouping helper
  const addGroup = (parent: HTMLElement, title: string) => {
    // If not running in a DOM (tests), degrade gracefully by returning parent
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

  // Bloom
  const gBloom = addGroup(rPost, 'Bloom');
  checkbox(
    gBloom,
    'Bloom Enabled',
    rstate.bloomEnabled,
    (v) => {
      rstate.bloomEnabled = v;
      render.setBloom(
        rstate.bloomEnabled,
        rstate.bloomStrength,
        rstate.bloomThreshold,
        rstate.bloomRadius
      );
      refreshWarnings();
    },
    () => {},
    'Enable bloom post-process.'
  );
  slider(
    gBloom,
    'Bloom Strength',
    0,
    3.0,
    0.01,
    rstate.bloomStrength,
    (v) => {
      rstate.bloomStrength = v;
      render.setBloom(
        rstate.bloomEnabled,
        rstate.bloomStrength,
        rstate.bloomThreshold,
        rstate.bloomRadius
      );
    },
    () => {},
    'Bloom intensity.'
  );
  slider(
    gBloom,
    'Bloom Threshold',
    0,
    1.5,
    0.01,
    rstate.bloomThreshold,
    (v) => {
      rstate.bloomThreshold = v;
      render.setBloom(
        rstate.bloomEnabled,
        rstate.bloomStrength,
        rstate.bloomThreshold,
        rstate.bloomRadius
      );
    },
    () => {},
    'Bloom threshold.'
  );
  slider(
    gBloom,
    'Bloom Radius',
    0,
    1.0,
    0.01,
    rstate.bloomRadius,
    (v) => {
      rstate.bloomRadius = v;
      render.setBloom(
        rstate.bloomEnabled,
        rstate.bloomStrength,
        rstate.bloomThreshold,
        rstate.bloomRadius
      );
    },
    () => {},
    'Bloom radius.'
  );

  // Outline
  const gOutline = addGroup(rPost, 'Outline');
  checkbox(
    gOutline,
    'Outline Enabled',
    postState.outlineEnabled,
    (v) => {
      postState.outlineEnabled = v;
      render.setOutline(
        v,
        postState.outlineStrength,
        postState.outlineThickness,
        hexToInt(postState.outlineColor)
      );
      refreshWarnings();
    },
    () => {},
    'Enable Outline pass.'
  );
  slider(
    gOutline,
    'Outline Strength',
    0.0,
    10.0,
    0.1,
    postState.outlineStrength,
    (v) => {
      postState.outlineStrength = v;
      if (postState.outlineEnabled)
        render.setOutline(true, v, postState.outlineThickness, hexToInt(postState.outlineColor));
    },
    () => {},
    'OutlinePass edgeStrength.'
  );
  slider(
    gOutline,
    'Outline Thickness',
    0.0,
    4.0,
    0.05,
    postState.outlineThickness,
    (v) => {
      postState.outlineThickness = v;
      if (postState.outlineEnabled)
        render.setOutline(true, postState.outlineStrength, v, hexToInt(postState.outlineColor));
    },
    () => {},
    'OutlinePass edgeThickness.'
  );
  colorPicker(
    gOutline,
    'Outline Color',
    postState.outlineColor,
    (hex) => {
      postState.outlineColor = hex;
      if (postState.outlineEnabled)
        render.setOutline(
          true,
          postState.outlineStrength,
          postState.outlineThickness,
          hexToInt(hex)
        );
    },
    () => {},
    'Outline visible edge color.'
  );

  // Ink outline (mesh based)
  const gInk = addGroup(rPost, 'Ink Outline');
  checkbox(
    gInk,
    'Ink Outline',
    postState.inkEnabled,
    (v) => {
      postState.inkEnabled = v;
      render.setInkOutline(v, postState.inkThickness, hexToInt(postState.inkColor));
      refreshWarnings();
    },
    () => {},
    'Back-face mesh outline.'
  );
  slider(
    gInk,
    'Ink Thickness',
    0,
    0.2,
    0.005,
    postState.inkThickness,
    (v) => {
      postState.inkThickness = v;
      if (postState.inkEnabled) render.setInkOutline(true, v, hexToInt(postState.inkColor));
    },
    () => {},
    'Scale factor for ink outline.'
  );
  colorPicker(
    gInk,
    'Ink Color',
    postState.inkColor,
    (hex) => {
      postState.inkColor = hex;
      if (postState.inkEnabled) render.setInkOutline(true, postState.inkThickness, hexToInt(hex));
    },
    () => {},
    'Ink outline color.'
  );

  // Vignette
  const gVignette = addGroup(rPost, 'Vignette');
  checkbox(
    gVignette,
    'Vignette',
    postState.vignetteEnabled,
    (v) => {
      postState.vignetteEnabled = v;
      render.setVignette(v, postState.vignetteStrength, postState.vignetteSoftness);
      refreshWarnings();
    },
    () => {},
    'Enable vignette shading.'
  );
  slider(
    gVignette,
    'Vignette Strength',
    0,
    1.0,
    0.01,
    postState.vignetteStrength,
    (v) => {
      postState.vignetteStrength = v;
      if (postState.vignetteEnabled) render.setVignette(true, v, postState.vignetteSoftness);
    },
    () => {},
    'Strength of vignette.'
  );
  slider(
    gVignette,
    'Vignette Softness',
    0,
    1.0,
    0.01,
    postState.vignetteSoftness,
    (v) => {
      postState.vignetteSoftness = v;
      if (postState.vignetteEnabled) render.setVignette(true, postState.vignetteStrength, v);
    },
    () => {},
    'Softness of vignette edge.'
  );
}
