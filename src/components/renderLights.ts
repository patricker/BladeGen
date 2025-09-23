import { hexToInt } from '../utils/color';

type RenderHooks = {
  setAmbient: (v: number) => void;
  setKeyIntensity: (v: number) => void;
  setKeyAngles: (az: number, el: number) => void;
  setRimIntensity: (v: number) => void;
  setRimAngles: (az: number, el: number) => void;
  setRimColor: (hex: number) => void;
};

type RenderState = {
  ambient: number;
  keyIntensity: number;
  keyAz: number;
  keyEl: number;
  rimIntensity: number;
  rimAz: number;
  rimEl: number;
  rimColor: string;
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

export function attachRenderLightsPanel(opts: {
  section: HTMLElement;
  render: RenderHooks;
  rstate: RenderState;
  slider: Slider;
  colorPicker: ColorPicker;
  rerender: () => void;
}) {
  const { section: rLights, render, rstate, slider, colorPicker } = opts;

  // Lights
  slider(
    rLights,
    'Ambient Intensity',
    0,
    2.0,
    0.01,
    rstate.ambient,
    (v) => {
      rstate.ambient = v;
      render.setAmbient(v);
    },
    () => {},
    'Hemisphere ambient light.'
  );

  slider(
    rLights,
    'Key Intensity',
    0,
    4.0,
    0.01,
    rstate.keyIntensity,
    (v) => {
      rstate.keyIntensity = v;
      render.setKeyIntensity(v);
    },
    () => {},
    'Directional key light intensity.'
  );

  slider(
    rLights,
    'Key Azimuth',
    -180,
    180,
    1,
    rstate.keyAz,
    (v) => {
      rstate.keyAz = v;
      render.setKeyAngles(rstate.keyAz, rstate.keyEl);
    },
    () => {},
    'Key light horizontal angle (deg).'
  );

  slider(
    rLights,
    'Key Elevation',
    -10,
    85,
    1,
    rstate.keyEl,
    (v) => {
      rstate.keyEl = v;
      render.setKeyAngles(rstate.keyAz, rstate.keyEl);
    },
    () => {},
    'Key light elevation (deg).'
  );

  slider(
    rLights,
    'Rim Intensity',
    0,
    3.0,
    0.01,
    rstate.rimIntensity,
    (v) => {
      rstate.rimIntensity = v;
      render.setRimIntensity(v);
    },
    () => {},
    'Back/rim light intensity.'
  );

  slider(
    rLights,
    'Rim Azimuth',
    -180,
    180,
    1,
    rstate.rimAz,
    (v) => {
      rstate.rimAz = v;
      render.setRimAngles(rstate.rimAz, rstate.rimEl);
    },
    () => {},
    'Rim light horizontal angle (deg).'
  );

  slider(
    rLights,
    'Rim Elevation',
    -10,
    85,
    1,
    rstate.rimEl,
    (v) => {
      rstate.rimEl = v;
      render.setRimAngles(rstate.rimAz, rstate.rimEl);
    },
    () => {},
    'Rim light elevation (deg).'
  );

  colorPicker(
    rLights,
    'Rim Color',
    rstate.rimColor,
    (hex) => {
      rstate.rimColor = hex;
      render.setRimColor(hexToInt(hex));
    },
    () => {},
    'Rim light color.'
  );
}
