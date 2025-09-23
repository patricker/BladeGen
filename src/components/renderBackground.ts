import { hexToInt } from '../utils/color';

type RenderHooks = {
  setBackgroundColor: (hex: number) => void;
  setBackgroundBrightness: (v: number) => void;
};

type RenderState = {
  bgColor: string;
  bgBrightness: number;
};

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

export function attachRenderBackgroundPanel(opts: {
  section: HTMLElement;
  render: RenderHooks;
  rstate: RenderState;
  colorPicker: ColorPicker;
  slider: Slider;
  rerender: () => void;
}) {
  const { section: rBg, render, rstate, colorPicker, slider } = opts;
  colorPicker(
    rBg,
    'Background Color',
    rstate.bgColor,
    (hex) => {
      rstate.bgColor = hex;
      render.setBackgroundColor(hexToInt(hex));
    },
    () => {},
    'Renderer clear color.'
  );
  slider(
    rBg,
    'Background Bright',
    0,
    1.0,
    0.01,
    rstate.bgBrightness,
    (v) => {
      rstate.bgBrightness = v;
      render.setBackgroundBrightness(v);
    },
    () => {},
    'Lighten/darken the background.'
  );
}
