import * as THREE from 'three';
import { makeQualityPresets, type QualityPreset } from './renderConfig';
import { createApplyQualityPreset } from './renderQuality';
import { attachRenderQualityPanel } from './renderPanel';
import { attachRenderBackgroundPanel } from './renderBackground';
import { attachRenderLightsPanel } from './renderLights';
import { attachRenderPostPanel } from './renderPost';
import { attachRenderPixelArtPanel } from './renderPixelArt';
import { attachRenderAtmosPanel } from './renderAtmos';
import { hexToInt } from '../utils/color';
import { PARTS, type Part, type MatExt } from './types';
import { attachLooksPanel, type LooksStateRefs } from './looksPanel';
import {
  attachModelPanel,
  attachGuardControls,
  attachHandleControls,
  attachPommelControls,
  attachAccessoryControls,
} from './modelPanel';
import {
  presetKatana,
  presetArming,
  presetGladius,
  presetJian,
  presetClaymore,
  presetRapier,
  presetDemon,
  presetLightsaber,
  presetSabre,
  swordPresets as presetList,
  type PresetEntry,
  type PresetRenderOverrides,
  type PresetPostOverrides,
  type PresetAtmosOverrides,
  type PresetFxOverrides,
} from './presets';
import {
  SwordGenerator,
  SwordParams,
  defaultSwordParams,
  buildBladeOutlinePoints,
  bladeOutlineToSVG,
} from '../three/SwordGenerator';
import { createMaterial } from '../three/sword/materials';
import { initHelp, attachHelp } from './help/HelpRegistry';
import { TextureCache } from '../three/sword/textures';
// Re-export ControlRegistry for tests/consumers that import from 'components/controls'
export { ControlRegistry } from './ControlRegistry';
import { exportGLB, exportOBJ, exportSTL, exportSVG, exportJSON } from './exporters';

type Category =
  | 'Blade'
  | 'Engravings'
  | 'Guard'
  | 'Handle'
  | 'Pommel'
  | 'Accessories'
  | 'Other'
  | 'Render';

type RenderHooks = {
  setBladeVisible?: (visible: boolean, occlude?: boolean) => void;
  setExposure: (v: number) => void;
  setAmbient: (v: number) => void;
  setKeyIntensity: (v: number) => void;
  setKeyAngles: (az: number, el: number) => void;
  setRimIntensity: (v: number) => void;
  setRimColor: (hex: number) => void;
  setRimAngles: (az: number, el: number) => void;
  setBloom: (enabled: boolean, strength?: number, threshold?: number, radius?: number) => void;
  setOutline: (enabled: boolean, strength?: number, thickness?: number, colorHex?: number) => void;
  setEnvIntensity: (v: number) => void;
  setBackgroundColor: (hex: number) => void;
  setBackgroundBrightness: (v: number) => void;
  setVignette: (enabled: boolean, strength?: number, softness?: number) => void;
  setInkOutline: (enabled: boolean, thickness?: number, colorHex?: number) => void;
  setAAMode: (mode: 'none' | 'fxaa' | 'smaa' | 'msaa') => void;
  setShadowBias: (bias: number, normalBias?: number) => void;
  setShadowMapSize: (size: 512 | 1024 | 2048 | 4096) => void;
  setDPRCap: (cap: number) => void;
  setPartBump: (
    part: Part,
    enabled: boolean,
    bumpScale?: number,
    noiseScale?: number,
    seed?: number
  ) => void;
  setBladeGradientWear: (
    enabled: boolean,
    base?: number,
    edge?: number,
    edgeFade?: number,
    wear?: number
  ) => void;
  setBladeMistAdvanced?: (cfg: {
    occlude?: boolean;
    lifeRate?: number;
    noiseAmp?: number;
    noiseFreqX?: number;
    noiseFreqZ?: number;
    windX?: number;
    windZ?: number;
    emission?: 'base' | 'edge' | 'tip' | 'full';
    sizeMinRatio?: number;
  }) => void;
  setSelectiveBloom?: (
    enabled: boolean,
    strength?: number,
    threshold?: number,
    radius?: number,
    intensity?: number
  ) => void;
  markForBloom?: (obj: any, enable?: boolean) => void;
  setHeatHaze?: (enabled: boolean, distortion?: number) => void;
  markForHeat?: (obj: any, enable?: boolean) => void;
  setFlameAura?: (
    enabled: boolean,
    opts?: {
      scale?: number;
      color1?: number;
      color2?: number;
      noiseScale?: number;
      speed?: number;
      intensity?: number;
    }
  ) => void;
  setEmbers?: (enabled: boolean, opts?: { count?: number; size?: number; color?: number }) => void;
  setMistTurbulence?: (v: number) => void;
  setPartColor: (part: Part, hex: number) => void;
  setPartMetalness: (part: Part, v: number) => void;
  setPartRoughness: (part: Part, v: number) => void;
  setPartClearcoat: (part: Part, v: number) => void;
  setPartClearcoatRoughness: (part: Part, v: number) => void;
  setPostFXEnabled?: (enabled: boolean) => void;
  supportedAAModes?: Array<'none' | 'fxaa' | 'smaa' | 'msaa'>;
  getAAMode?: () => 'none' | 'fxaa' | 'smaa' | 'msaa';
  setAutoSpinEnabled?: (enabled: boolean) => void;
  getAutoSpinEnabled?: () => boolean;
  setRenderMode?: (mode: 'standard' | 'pixelArt') => void;
  getRenderMode?: () => 'standard' | 'pixelArt';
  setPixelArtOptions?: (opts: { pixelSize?: number; posterizeLevels?: number }) => void;
};

import { ControlRegistry } from './ControlRegistry';

let activeRegistry: ControlRegistry | null = null;

function getActiveRegistry() {
  if (!activeRegistry) {
    throw new Error('Control registry not initialised');
  }
  return activeRegistry;
}

function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '') || 'field'
  );
}

export function createSidebar(
  el: HTMLElement,
  sword: SwordGenerator,
  params: SwordParams,
  render?: RenderHooks
) {
  // Initialize contextual help wiring with 3D highlighter hookup
  initHelp({
    highlighter: (parts) => {
      const part = (parts && parts[0]) as any;
      try {
        sword.setHighlight(part ?? null);
      } catch {}
    },
  });
  // Lazy-load Help Panel on first use; set up lightweight shortcuts that import on demand
  let helpPanelLoaded = false;
  let helpPanelInitPromise: Promise<any> | null = null;
  const loadHelpPanel = async () => {
    if (helpPanelInitPromise) return helpPanelInitPromise;
    helpPanelInitPromise = import('./help/HelpPanel').then((mod) => {
      mod.initHelpPanel({
        highlighter: (parts?: string[] | null) => {
          const part = (parts && (parts[0] as any)) as any;
          try {
            sword.setHighlight(part ?? null);
          } catch {}
        },
      });
      helpPanelLoaded = true;
      return mod;
    });
    return helpPanelInitPromise;
  };
  const registry = new ControlRegistry();
  const previousRegistry = activeRegistry;
  activeRegistry = registry;
  const state: SwordParams = JSON.parse(JSON.stringify(params));
  const defaults = defaultSwordParams();
  const rstate = {
    exposure: 1.0,
    bgColor: '#0f1115',
    bgBrightness: 0.0,
    ambient: 0.4,
    keyIntensity: 1.6,
    keyAz: 40,
    keyEl: 40,
    rimIntensity: 0.5,
    rimAz: -135,
    rimEl: 20,
    rimColor: '#ffffff',
    bloomEnabled: false,
    bloomStrength: 0.6,
    bloomThreshold: 0.85,
    bloomRadius: 0.2,
    envMapIntensity: 1.0,
    aaMode: 'fxaa' as 'none' | 'fxaa' | 'smaa' | 'msaa',
    shadowMapSize: 2048 as 1024 | 2048 | 4096,
    qualityPreset: 'Medium' as 'Low' | 'Medium' | 'High',
    toneMapping: 'ACES' as 'ACES' | 'Reinhard' | 'Cineon' | 'Linear' | 'None',
    postFxEnabled: true,
  };
  const pixelState = {
    mode: 'Standard' as 'Standard' | 'Pixel Art',
    pixelSize: 4,
    posterize: 0,
  };
  const postState = {
    outlineEnabled: false,
    outlineStrength: 2.5,
    outlineThickness: 1.0,
    outlineColor: '#ffffff',
    inkEnabled: false,
    inkThickness: 0.02,
    inkColor: '#000000',
    vignetteEnabled: false,
    vignetteStrength: 0.25,
    vignetteSoftness: 0.5,
    bladeGradientEnabled: false,
    gradBase: '#b9c6ff',
    gradEdge: '#ffffff',
    gradFade: 0.2,
    gradWear: 0.2,
  };
  const atmosState = {
    envUrl: '',
    envPreset: 'None' as 'None' | 'Room' | 'Royal Esplanade' | 'Venice Sunset',
    envAsBackground: false,
    fogColor: '#ffffff',
    fogDensity: 0.03,
    fresnelEnabled: false,
    fresnelColor: '#ffffff',
    fresnelIntensity: 0.6,
    fresnelPower: 2.0,
    bladeInvisible: false,
    occludeInvisible: false,
  };

  const supportedAAModes = (render?.supportedAAModes ?? ['none', 'fxaa']) as Array<
    'none' | 'fxaa' | 'smaa' | 'msaa'
  >;
  const initialAAMode = render?.getAAMode?.() ?? rstate.aaMode;
  if (supportedAAModes.includes(initialAAMode)) {
    rstate.aaMode = initialAAMode;
  } else {
    rstate.aaMode = supportedAAModes.includes('fxaa') ? 'fxaa' : supportedAAModes[0];
  }
  const fxState = {
    innerGlow: { enabled: false, color: '#88ccff', min: 0.2, max: 0.9, speed: 1.5 },
    mist: {
      enabled: false,
      color: '#88aadd',
      density: 0.4,
      speed: 0.6,
      spread: 0.08,
      size: 6.0,
      lifeRate: 0.25,
      turbulence: 0.08,
      windX: 0,
      windZ: 0,
      emission: 'base' as 'base' | 'edge' | 'tip' | 'full',
      sizeMinRatio: 0.5,
      occlude: false,
    },
    flame: {
      enabled: false,
      color1: '#ff5a00',
      color2: '#fff18a',
      intensity: 1.0,
      speed: 1.6,
      noiseScale: 2.2,
      scale: 1.05,
      direction: 'Up' as 'Up' | 'Down',
      blend: 'Add' as 'Add' | 'Darken' | 'Multiply',
    },
    selectiveBloom: false,
    heatHaze: false,
    embers: { enabled: false, count: 120, size: 3, color: '#ffaa55' },
  };

  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  const rstateDefaults = clone(rstate);
  const postStateDefaults = clone(postState);
  const atmosStateDefaults = clone(atmosState);
  const fxStateDefaults = clone(fxState);
  const resetStateOnly = () => {
    Object.assign(rstate, clone(rstateDefaults));
    Object.assign(postState, clone(postStateDefaults));
    Object.assign(atmosState, clone(atmosStateDefaults));
    Object.assign(fxState, clone(fxStateDefaults));
  };
  let resetRenderAndFx = resetStateOnly;

  type PresetRenderOverrides = Partial<{
    exposure: number;
    ambient: number;
    keyIntensity: number;
    keyAz: number;
    keyEl: number;
    rimIntensity: number;
    rimAz: number;
    rimEl: number;
    rimColor: string;
    bloomEnabled: boolean;
    bloomStrength: number;
    bloomThreshold: number;
    bloomRadius: number;
    envMapIntensity: number;
    bgColor: string;
    bgBrightness: number;
    aaMode: 'none' | 'fxaa' | 'smaa' | 'msaa';
    shadowMapSize: 1024 | 2048 | 4096;
    qualityPreset: 'Low' | 'Medium' | 'High';
    toneMapping: 'ACES' | 'Reinhard' | 'Cineon' | 'Linear' | 'None';
  }> & { shadowBias?: number; dprCap?: number };

  const matState: Record<Part, MatExt> = {
    blade: {
      color: '#b9c6ff',
      metalness: 0.8,
      roughness: 0.25,
      clearcoat: 0.0,
      clearcoatRoughness: 0.5,
      preset: 'None',
      bumpEnabled: false,
      bumpScale: 0.02,
      bumpNoiseScale: 8,
      bumpSeed: 1337,
      envMapIntensity: 1,
      anisotropy: 0,
      anisotropyRotation: 0,
    },
    guard: {
      color: '#8892b0',
      metalness: 0.6,
      roughness: 0.45,
      clearcoat: 0.0,
      clearcoatRoughness: 0.5,
      preset: 'None',
      bumpEnabled: false,
      bumpScale: 0.02,
      bumpNoiseScale: 8,
      bumpSeed: 1337,
      envMapIntensity: 1,
      anisotropy: 0,
      anisotropyRotation: 0,
    },
    handle: {
      color: '#5a6b78',
      metalness: 0.1,
      roughness: 0.85,
      clearcoat: 0.0,
      clearcoatRoughness: 0.6,
      preset: 'None',
      bumpEnabled: false,
      bumpScale: 0.02,
      bumpNoiseScale: 8,
      bumpSeed: 1337,
      envMapIntensity: 1,
      anisotropy: 0,
      anisotropyRotation: 0,
    },
    pommel: {
      color: '#9aa4b2',
      metalness: 0.75,
      roughness: 0.35,
      clearcoat: 0.0,
      clearcoatRoughness: 0.5,
      preset: 'None',
      bumpEnabled: false,
      bumpScale: 0.02,
      bumpNoiseScale: 8,
      bumpSeed: 1337,
      envMapIntensity: 1,
      anisotropy: 0,
      anisotropyRotation: 0,
    },
    scabbard: {
      color: '#3a2c1c',
      metalness: 0.2,
      roughness: 0.65,
      clearcoat: 0.05,
      clearcoatRoughness: 0.7,
      preset: 'None',
      bumpEnabled: false,
      bumpScale: 0.015,
      bumpNoiseScale: 9,
      bumpSeed: 1337,
      envMapIntensity: 1,
      anisotropy: 0.12,
      anisotropyRotation: 0,
    },
    tassel: {
      color: '#7c3f1d',
      metalness: 0.05,
      roughness: 0.8,
      clearcoat: 0.0,
      clearcoatRoughness: 0.7,
      preset: 'None',
      bumpEnabled: false,
      bumpScale: 0.01,
      bumpNoiseScale: 10,
      bumpSeed: 777,
      envMapIntensity: 1,
      sheen: 0.35,
      sheenColor: '#d8a273',
      anisotropy: 0,
      anisotropyRotation: 0,
    },
  };
  const matDefaults: Record<Part, MatExt> = JSON.parse(JSON.stringify(matState));

  // PresetEntry type imported from './presets'; PARTS imported from './types'

  /* MOVED to presets.ts
  const swordPresetsLegacy: PresetEntry[] = [
    {
      id: 'katana',
      label: 'Katana',
      build: presetKatana,
      materials: {
        blade: { color: '#d8e6ff', metalness: 0.88, roughness: 0.2, clearcoat: 0.25, clearcoatRoughness: 0.35, envMapIntensity: 1.4, anisotropy: 0.32, anisotropyRotation: 0.35 },
        guard: { color: '#2f1e14', metalness: 0.4, roughness: 0.46, anisotropy: 0.15, anisotropyRotation: 0, sheen: 0.12, sheenColor: '#3d2a1d' },
        handle: { color: '#352d25', metalness: 0.05, roughness: 0.58, sheen: 0.28, sheenColor: '#4a3b2d', bumpEnabled: true, bumpScale: 0.013, bumpNoiseScale: 10 },
        pommel: { color: '#2c1f16', metalness: 0.45, roughness: 0.42, anisotropy: 0.22 }
      },
      variants: [
        {
          name: 'Winter Steel',
          description: 'Bright polish with gilt fittings.',
          parts: {
            blade: { color: '#eef4ff', metalness: 0.93, roughness: 0.15, clearcoat: 0.3, clearcoatRoughness: 0.28, envMapIntensity: 1.65, anisotropy: 0.38, anisotropyRotation: 0.32 },
            guard: { color: '#c9a347', metalness: 0.82, roughness: 0.32, anisotropy: 0.28 },
            pommel: { color: '#c9a347', metalness: 0.8, roughness: 0.33, anisotropy: 0.24 },
            handle: { color: '#2f3338', roughness: 0.52, sheen: 0.36, sheenColor: '#556d8a' }
          }
        },
        {
          name: 'Midnight Oni',
          description: 'Indigo temper and lacquered fittings.',
          parts: {
            blade: { color: '#5f6aff', metalness: 0.72, roughness: 0.22, emissiveColor: '#4e56ff', emissiveIntensity: 1.5, anisotropy: 0.24, anisotropyRotation: -0.3 },
            guard: { color: '#140b12', metalness: 0.22, roughness: 0.56, sheen: 0.14, sheenColor: '#24121e' },
            pommel: { color: '#140b12', metalness: 0.22, roughness: 0.52 },
            handle: { color: '#1c1118', roughness: 0.68, sheen: 0.24, sheenColor: '#391d2e' }
          }
        }
      ]
    },
    {
      id: 'arming',
      label: 'Arming Sword',
      build: presetArming,
      materials: {
        blade: { color: '#dde6ff', metalness: 0.92, roughness: 0.19, clearcoat: 0.18, clearcoatRoughness: 0.32, envMapIntensity: 1.25, anisotropy: 0.27, anisotropyRotation: 0.02 },
        guard: { color: '#c08b2f', metalness: 0.78, roughness: 0.4, anisotropy: 0.24 },
        handle: { color: '#4b3526', metalness: 0.03, roughness: 0.68, sheen: 0.3, sheenColor: '#5b3e2f', bumpEnabled: true, bumpScale: 0.011, bumpNoiseScale: 9 },
        pommel: { color: '#c7a465', metalness: 0.7, roughness: 0.36, anisotropy: 0.3 }
      },
      variants: [
        {
          name: 'Tournament Bright',
          description: 'Polished guard and pommel for ceremony.',
          parts: {
            guard: { color: '#dfe2eb', metalness: 0.92, roughness: 0.24, anisotropy: 0.36 },
            pommel: { color: '#dfe2eb', metalness: 0.92, roughness: 0.26, anisotropy: 0.34 },
            handle: { color: '#3a2b1f', roughness: 0.62, sheen: 0.22 }
          }
        },
        {
          name: 'Battleworn',
          description: 'Patina and soot-stained grip from the field.',
          parts: {
            blade: { color: '#c8ced9', metalness: 0.68, roughness: 0.32 },
            guard: { color: '#5a4332', metalness: 0.45, roughness: 0.58, anisotropy: 0.16 },
            pommel: { color: '#5a4332', metalness: 0.45, roughness: 0.55 },
            handle: { color: '#261710', roughness: 0.76, sheen: 0.16 }
          }
        }
      ]
    },
    {
      id: 'gladius',
      label: 'Gladius',
      build: presetGladius,
      materials: {
        blade: { color: '#f2f5ff', metalness: 0.93, roughness: 0.18, clearcoat: 0.18, clearcoatRoughness: 0.3, envMapIntensity: 1.35, anisotropy: 0.22, anisotropyRotation: 0.08 },
        guard: { color: '#d1a660', metalness: 0.78, roughness: 0.36, anisotropy: 0.18 },
        handle: { color: '#6d4524', metalness: 0.05, roughness: 0.6, sheen: 0.28, sheenColor: '#7b512b', bumpEnabled: true, bumpScale: 0.012, bumpNoiseScale: 8 },
        pommel: { color: '#d1a660', metalness: 0.78, roughness: 0.38, anisotropy: 0.2 }
      },
      variants: [
        {
          name: 'Legion Standard',
          description: 'Bright blade with bone grip and bronze hardware.',
          parts: {
            blade: { color: '#fdfdf8', metalness: 0.95, roughness: 0.16, envMapIntensity: 1.5, anisotropy: 0.24 },
            handle: { color: '#e8d9b7', metalness: 0.02, roughness: 0.58, sheen: 0.22, sheenColor: '#f3e9ce', bumpEnabled: false },
            guard: { color: '#e4b972', metalness: 0.86, roughness: 0.32 },
            pommel: { color: '#e4b972', metalness: 0.86, roughness: 0.34 }
          }
        },
        {
          name: 'Arena Ember',
          description: 'Heat-blued blade with charred leather grip.',
          parts: {
            blade: { color: '#5c6599', metalness: 0.7, roughness: 0.22, emissiveColor: '#ff6b3a', emissiveIntensity: 0.6, anisotropy: 0.18 },
            handle: { color: '#2a1a16', roughness: 0.72, sheen: 0.14 },
            guard: { color: '#3f2a22', metalness: 0.3, roughness: 0.52 },
            pommel: { color: '#3f2a22', metalness: 0.3, roughness: 0.52 }
          }
        }
      ]
    },
    {
      id: 'jian',
      label: 'Jian',
      build: presetJian,
      materials: {
        blade: { color: '#e8f0ff', metalness: 0.9, roughness: 0.2, clearcoat: 0.18, clearcoatRoughness: 0.32, envMapIntensity: 1.3, anisotropy: 0.24, anisotropyRotation: 0.12 },
        guard: { color: '#ad9969', metalness: 0.7, roughness: 0.38, anisotropy: 0.26 },
        handle: { color: '#2e342f', metalness: 0.08, roughness: 0.6, sheen: 0.22, sheenColor: '#425447' },
        pommel: { color: '#ad9969', metalness: 0.7, roughness: 0.36, anisotropy: 0.2 }
      },
      variants: [
        {
          name: 'Scholar\'s River',
          description: 'Blued blade with jade fittings.',
          parts: {
            blade: { color: '#b9d7ff', emissiveColor: '#53c5ff', emissiveIntensity: 0.4, anisotropy: 0.3, anisotropyRotation: 0.2 },
            guard: { color: '#5b8872', metalness: 0.55, roughness: 0.32 },
            pommel: { color: '#5b8872', metalness: 0.55, roughness: 0.32 },
            handle: { color: '#1e2a25', roughness: 0.55 }
          }
        },
        {
          name: 'Imperial Sunset',
          description: 'Gilt fittings and a warm mirror polish.',
          parts: {
            blade: { color: '#f6ede0', metalness: 0.88, roughness: 0.18, envMapIntensity: 1.5 },
            guard: { color: '#e8b055', metalness: 0.9, roughness: 0.3 },
            pommel: { color: '#e8b055', metalness: 0.9, roughness: 0.3 },
            handle: { color: '#3f2116', roughness: 0.64, sheen: 0.24 }
          }
        }
      ]
    },
    {
      id: 'claymore',
      label: 'Claymore',
      build: presetClaymore,
      materials: {
        blade: { color: '#dbe4ff', metalness: 0.9, roughness: 0.22, clearcoat: 0.22, clearcoatRoughness: 0.38, envMapIntensity: 1.2, anisotropy: 0.2, anisotropyRotation: 0.12 },
        guard: { color: '#aab6c7', metalness: 0.82, roughness: 0.32, anisotropy: 0.42, anisotropyRotation: 1.05 },
        handle: { color: '#463223', metalness: 0.04, roughness: 0.74, sheen: 0.2, sheenColor: '#5f412d', bumpEnabled: true, bumpScale: 0.013, bumpNoiseScale: 8 },
        pommel: { color: '#b4bccb', metalness: 0.8, roughness: 0.34, anisotropy: 0.36 }
      },
      variants: [
        {
          name: 'Highland Dawn',
          description: 'Bronzed fittings with a warm blade polish.',
          parts: {
            blade: { color: '#ede2d0', metalness: 0.87, roughness: 0.2 },
            guard: { color: '#c59d64', metalness: 0.78, roughness: 0.38, anisotropy: 0.3 },
            pommel: { color: '#c59d64', metalness: 0.78, roughness: 0.4 },
            handle: { color: '#513a27', roughness: 0.7, sheen: 0.22 }
          }
        },
        {
          name: 'Night Watch',
          description: 'Darkened steel with subtle runic glow.',
          parts: {
            blade: { color: '#3f4b60', metalness: 0.6, roughness: 0.28, emissiveColor: '#6586ff', emissiveIntensity: 0.8, anisotropy: 0.15, anisotropyRotation: 0.2 },
            guard: { color: '#141820', metalness: 0.3, roughness: 0.6 },
            pommel: { color: '#141820', metalness: 0.3, roughness: 0.55 },
            handle: { color: '#161012', roughness: 0.68 }
          }
        }
      ]
    },
    {
      id: 'rapier',
      label: 'Rapier',
      build: presetRapier,
      materials: {
        blade: { color: '#edf2ff', metalness: 0.95, roughness: 0.16, envMapIntensity: 1.35, anisotropy: 0.3, anisotropyRotation: 0.05 },
        guard: { color: '#f2f0eb', metalness: 0.93, roughness: 0.22, anisotropy: 0.62, anisotropyRotation: 1.3, envMapIntensity: 1.55 },
        handle: { color: '#2f2f3a', metalness: 0.12, roughness: 0.58, sheen: 0.26, sheenColor: '#4c4c61' },
        pommel: { color: '#f2f0eb', metalness: 0.93, roughness: 0.24, anisotropy: 0.5, anisotropyRotation: 1.2 }
      },
      variants: [
        {
          name: 'Court Gala',
          description: 'Gilt cup hilt for ceremonial display.',
          parts: {
            guard: { color: '#d5b16a', metalness: 0.88, roughness: 0.28, anisotropy: 0.4 },
            pommel: { color: '#d5b16a', metalness: 0.88, roughness: 0.3 },
            handle: { color: '#332926', roughness: 0.54, sheen: 0.24 }
          }
        },
        {
          name: 'Duelist\'s Shadow',
          description: 'Blackened steel with a faint arcane edge.',
          parts: {
            blade: { color: '#cfd6ff', emissiveColor: '#6a7dff', emissiveIntensity: 0.5, roughness: 0.18 },
            guard: { color: '#1e1e26', metalness: 0.45, roughness: 0.48, anisotropy: 0.25 },
            pommel: { color: '#1e1e26', metalness: 0.45, roughness: 0.5 },
            handle: { color: '#202026', roughness: 0.6 }
          }
        }
      ]
    },
    {
      id: 'demon',
      label: 'Demon Blade',
      build: presetDemon,
      materials: {
        blade: { color: '#6f3bff', metalness: 0.4, roughness: 0.18, emissiveColor: '#a64bff', emissiveIntensity: 2.8, clearcoat: 0.1, clearcoatRoughness: 0.6, envMapIntensity: 0.9 },
        guard: { color: '#2b0d11', metalness: 0.15, roughness: 0.6 },
        handle: { color: '#3c0e18', metalness: 0.1, roughness: 0.7, sheen: 0.12, sheenColor: '#64162d' },
        pommel: { color: '#2b0d11', metalness: 0.2, roughness: 0.55 }
      },
      variants: [
        {
          name: 'Molten Edge',
          description: 'Superheated blade fed by inner fire.',
          parts: {
            blade: { color: '#ff8440', metalness: 0.35, roughness: 0.16, emissiveColor: '#ff5a1a', emissiveIntensity: 3.6 },
            guard: { color: '#3a1208', roughness: 0.58 },
            pommel: { color: '#3a1208', roughness: 0.58 }
          }
        },
        {
          name: 'Voidglass',
          description: 'Translucent blade that siphons light.',
          parts: {
            blade: { color: '#3f2b5f', metalness: 0.15, roughness: 0.08, transmission: 0.72, ior: 1.48, thickness: 0.35, attenuationColor: '#6b51bd', attenuationDistance: 0.22, emissiveColor: '#6f4bff', emissiveIntensity: 1.1 },
            guard: { color: '#120712', metalness: 0.1, roughness: 0.62 },
            handle: { color: '#1d0a1d', roughness: 0.68 }
          }
        }
      ]
    },
    {
      id: 'lightsaber',
      label: 'Lightsaber',
      build: presetLightsaber,
      materials: {
        blade: { color: '#00d9ff', metalness: 0.0, roughness: 0.1, clearcoat: 0.0, clearcoatRoughness: 1.0, transmission: 0.6, ior: 1.35, thickness: 0.22, attenuationColor: '#7ef5ff', attenuationDistance: 0.35, emissiveColor: '#78f9ff', emissiveIntensity: 6.0, envMapIntensity: 0.7 },
        guard: { color: '#2b2e32', metalness: 0.6, roughness: 0.3, anisotropy: 0.4, anisotropyRotation: 1.57 },
        handle: { color: '#1d1f22', metalness: 0.5, roughness: 0.4, anisotropy: 0.3, anisotropyRotation: 1.57 },
        pommel: { color: '#1a1c1f', metalness: 0.55, roughness: 0.38, anisotropy: 0.34 }
      },
      variants: [
        {
          name: 'Verdant Guardian',
          description: 'Emerald plasma tuned for balance.',
          parts: {
            blade: { color: '#26ff9c', emissiveColor: '#3bffac', emissiveIntensity: 6.0, attenuationColor: '#4dffb5' },
            handle: { color: '#202622', roughness: 0.42 }
          }
        },
        {
          name: 'Crimson Fury',
          description: 'Unstable red blade for the dark side.',
          parts: {
            blade: { color: '#ff3145', emissiveColor: '#ff192d', emissiveIntensity: 7.5, attenuationColor: '#ff5263', attenuationDistance: 0.28 },
            handle: { color: '#261a1a', roughness: 0.46 }
          }
        },
        {
          name: 'Amethyst Dawn',
          description: 'Violet crystal with prismatic bloom.',
          parts: {
            blade: { color: '#b06fff', emissiveColor: '#c38aff', emissiveIntensity: 6.5, attenuationColor: '#c992ff', attenuationDistance: 0.32 },
            handle: { color: '#232034', roughness: 0.44 }
          }
        }
      ],
      render: {
        bloomEnabled: true,
        bloomStrength: 1.05,
        bloomThreshold: 0.58,
        bloomRadius: 0.45,
        envMapIntensity: 1.2,
        exposure: 0.95
      }
    },
    {
      id: 'sabre',
      label: 'Sabre',
      build: presetSabre,
      materials: {
        blade: { color: '#e0ebff', metalness: 0.9, roughness: 0.2, clearcoat: 0.2, clearcoatRoughness: 0.34, envMapIntensity: 1.4, anisotropy: 0.28, anisotropyRotation: 0.25 },
        guard: { color: '#b7c3d9', metalness: 0.82, roughness: 0.3, anisotropy: 0.48, anisotropyRotation: 1.2 },
        handle: { color: '#3b2e2e', metalness: 0.08, roughness: 0.56, sheen: 0.24, sheenColor: '#523c3c' },
        pommel: { color: '#b7c3d9', metalness: 0.82, roughness: 0.32, anisotropy: 0.46 }
      },
      variants: [
        {
          name: 'Cavalry Shine',
          description: 'Highly polished cup hilt with leather grip.',
          parts: {
            blade: { color: '#f5f8ff', metalness: 0.96, roughness: 0.14, envMapIntensity: 1.65, anisotropy: 0.34 },
            guard: { color: '#dde8ff', metalness: 0.95, roughness: 0.24, anisotropy: 0.5 },
            handle: { color: '#36261b', roughness: 0.6, sheen: 0.26, sheenColor: '#5a3c22' }
          }
        },
        {
          name: 'Officer\'s Dress',
          description: 'Gold-plated guard with dark sharkskin grip.',
          parts: {
            guard: { color: '#e2b55a', metalness: 0.9, roughness: 0.32, anisotropy: 0.3 },
            pommel: { color: '#e2b55a', metalness: 0.9, roughness: 0.32, anisotropy: 0.3 },
            handle: { color: '#1b1f23', roughness: 0.52, sheen: 0.28, sheenColor: '#3f4d5c' },
            blade: { color: '#dbe5ff', metalness: 0.88, roughness: 0.18, anisotropy: 0.26 }
          }
        }
      ]
    }
  ]; */
  const swordPresets: PresetEntry[] = presetList;

  const looksState: LooksStateRefs = {
    matVariants: [],
    currentVariantId: null,
    baseSnapshot: null,
  };
  let matPart: Part = 'blade';
  let raf = 0;
  let needs = false;
  let renderVariantList = () => {};
  let syncLookDropdown = () => {};
  let applyLook: (variantId: string | null) => void = () => {};
  let applyVisualOverrides = (_entry: PresetEntry) => {
    resetStateOnly();
  };
  let autoSpinCheckbox: HTMLInputElement | null = null;
  const applyMaterialStateToRenderer = (part: Part, state: MatExt) => {
    if (!render) return;
    const col = hexToInt(state.color || '#ffffff');
    render.setPartColor(part, col);
    render.setPartMetalness(part, state.metalness);
    render.setPartRoughness(part, state.roughness);
    render.setPartClearcoat(part, state.clearcoat);
    render.setPartClearcoatRoughness(part, state.clearcoatRoughness);
    render.setPartBump(
      part,
      state.bumpEnabled,
      state.bumpScale,
      state.bumpNoiseScale,
      state.bumpSeed
    );
    (render as any).setPartMaterial?.(part, {
      emissiveColor: state.emissiveColor,
      emissiveIntensity: state.emissiveIntensity,
      transmission: state.transmission,
      ior: state.ior,
      thickness: state.thickness,
      attenuationColor: state.attenuationColor,
      attenuationDistance: state.attenuationDistance,
      sheen: state.sheen,
      sheenColor: state.sheenColor,
      iridescence: state.iridescence,
      iridescenceIOR: state.iridescenceIOR,
      iridescenceThicknessMin: state.iridescenceThicknessMin,
      iridescenceThicknessMax: state.iridescenceThicknessMax,
      envMapIntensity: state.envMapIntensity,
      anisotropy: state.anisotropy,
      anisotropyRotation: state.anisotropyRotation,
    });
  };

  type VariantExportConfig = {
    name: string;
    description?: string;
    mappings: Array<{ mesh: THREE.Mesh; material: THREE.Material }>;
  };

  class KHRMaterialsVariantsExporter {
    private readonly writer: any;
    private readonly name = 'KHR_materials_variants';
    private readonly meshMappings = new Map<
      THREE.Object3D,
      Array<{ variant: number; material: THREE.Material }>
    >();
    private readonly configs: VariantExportConfig[];
    private readonly ownedMaterials: THREE.Material[];

    constructor(writer: any, configs: VariantExportConfig[], ownedMaterials: THREE.Material[]) {
      this.writer = writer;
      this.configs = configs;
      this.ownedMaterials = ownedMaterials;
      configs.forEach((cfg, variantIndex) => {
        for (const mapping of cfg.mappings) {
          const list = this.meshMappings.get(mapping.mesh) ?? [];
          list.push({ variant: variantIndex, material: mapping.material });
          this.meshMappings.set(mapping.mesh, list);
        }
      });
    }

    beforeParse() {
      if (!this.configs.length) return;
      const json = this.writer.json;
      const extensionsUsed = this.writer.extensionsUsed;
      json.extensions = json.extensions || {};
      json.extensions[this.name] = {
        variants: this.configs.map((cfg) => {
          const def: any = { name: cfg.name };
          if (cfg.description) def.extras = { description: cfg.description };
          return def;
        }),
      };
      extensionsUsed[this.name] = true;
    }

    async writeMesh(mesh: THREE.Object3D, meshDef: any) {
      const entries = this.meshMappings.get(mesh);
      if (!entries || entries.length === 0) return;
      const mappings: Array<{ material: number; variants: number[] }> = [];
      for (const entry of entries) {
        const materialIndex = await this.writer.processMaterialAsync(entry.material);
        if (materialIndex === null || materialIndex === undefined) continue;
        let mapping = mappings.find((m) => m.material === materialIndex);
        if (!mapping) {
          mapping = { material: materialIndex, variants: [entry.variant] };
          mappings.push(mapping);
        } else if (!mapping.variants.includes(entry.variant)) {
          mapping.variants.push(entry.variant);
        }
      }
      if (!mappings.length) return;
      meshDef.extensions = meshDef.extensions || {};
      meshDef.extensions[this.name] = { mappings };
    }

    afterParse() {
      for (const mat of this.ownedMaterials) {
        mat.dispose?.();
      }
      this.ownedMaterials.length = 0;
    }
  }
  const flush = () => {
    raf = 0;
    if (!needs) return;
    needs = false;
    sword.updateGeometry(state);
    updateWarnings();
    updateDynamics();
    try {
      syncVisibility();
    } catch {}
  };
  const refreshWarnings = () => {
    try {
      updateWarnings();
    } catch {}
    try {
      syncVisibility();
    } catch {}
  };
  const rerender = () => {
    needs = true;
    if (!raf) raf = requestAnimationFrame(flush);
  };

  el.innerHTML = '';
  const title = document.createElement('h2');
  title.textContent = 'Controls';
  el.appendChild(title);

  // Tabs: Model vs Render
  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  const tabModel = document.createElement('button');
  tabModel.className = 'tab-btn active';
  tabModel.textContent = 'Model';
  const tabRender = document.createElement('button');
  tabRender.className = 'tab-btn';
  tabRender.textContent = 'Render';
  tabs.appendChild(tabModel);
  tabs.appendChild(tabRender);
  el.appendChild(tabs);

  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  toolbar.dataset.fieldNamespace = 'toolbar';
  el.appendChild(toolbar);

  // Presets dropdown
  const presetSel = document.createElement('select');
  const customOption = document.createElement('option');
  customOption.value = 'custom';
  customOption.textContent = 'Preset: Custom';
  presetSel.appendChild(customOption);
  for (const preset of swordPresets) {
    const opt = document.createElement('option');
    opt.value = preset.id;
    opt.textContent = preset.label;
    presetSel.appendChild(opt);
  }
  toolbar.appendChild(presetSel);

  const BASE_LOOK_VALUE = '__base';
  const lookSel = document.createElement('select');
  lookSel.className = 'look-select';
  lookSel.style.marginLeft = '8px';
  lookSel.disabled = true;
  lookSel.appendChild(new Option('Look: Base', BASE_LOOK_VALUE));
  toolbar.appendChild(lookSel);

  const btnSave = document.createElement('button');
  btnSave.textContent = 'Save Preset';
  toolbar.appendChild(btnSave);

  const btnHelp = document.createElement('button');
  btnHelp.textContent = 'Help';
  btnHelp.title = 'Open Help (Cmd/Ctrl+/)';
  btnHelp.style.marginLeft = '8px';
  btnHelp.addEventListener('click', async () => {
    try {
      const mod = await loadHelpPanel();
      mod.openHelpPanel();
    } catch {}
  });
  toolbar.appendChild(btnHelp);

  // Explain Mode toggle
  let explainEnabled = false;
  const btnExplain = document.createElement('button');
  btnExplain.textContent = 'Explain';
  btnExplain.title = 'Toggle Explain Mode (E)';
  btnExplain.style.marginLeft = '8px';
  btnExplain.addEventListener('click', async () => {
    explainEnabled = !explainEnabled;
    try {
      (render as any).setExplainEnabled?.(explainEnabled);
      btnExplain.classList.toggle('active', explainEnabled);
      // Wire label click/hover to Help and highlight on first enable
      (render as any).setExplainHandlers?.(
        async (id: string) => {
          try {
            const mod = await loadHelpPanel();
            // Map generic part ids to representative docs or index
            const map: Record<string, string | null> = {
              blade: null,
              guard: 'guard.width',
              handle: 'handle.wrap-style',
              pommel: 'pommel.style',
              'blade.fuller': 'concept.fuller',
              'blade.edge': 'blade.edge-bevel',
              'blade.edge-left': 'blade.edge-bevel',
              'blade.edge-right': 'blade.edge-bevel',
              'blade.tip': 'blade.tip-shape',
              'guard.quillon': 'guard.style',
              'guard.fillet': 'guard.blend-fillet',
            };
            const target = map[id];
            if (target === null)
              mod.openHelpPanel(); // open index
            else if (target) mod.openHelpPanel(target);
            else mod.openHelpPanel(id);
          } catch {}
        },
        (parts: string[] | null) => {
          const part = (parts && (parts[0] as any)) as any;
          try {
            sword.setHighlight(part ?? null);
          } catch {}
        }
      );
    } catch {}
  });
  toolbar.appendChild(btnExplain);

  // First-run tour prompt (non-blocking)
  try {
    const ls = window.localStorage;
    // Disable guided tour auto-start in automated/browser-driven environments (e2e)
    const isAutomated = (navigator as any).webdriver === true;
    if (isAutomated) {
      try {
        ls.setItem('bladegen.tourPrompt', 'disabled');
        ls.setItem('bladegen.tourAutoStart', 'done');
      } catch {}
    }
    // Migrate selected storage keys to new prefix
    const migrateKey = (oldKey: string, newKey: string) => {
      try {
        const v = ls.getItem(newKey);
        if (v == null) {
          const o = ls.getItem(oldKey);
          if (o != null) ls.setItem(newKey, o);
        }
      } catch {}
    };
    const tourKey = 'bladegen.tourPrompt';
    const state = ls.getItem(tourKey); // 'dismissed' | 'completed' | null
    if (!state && !isAutomated) {
      const prompt = document.createElement('div');
      prompt.style.display = 'flex';
      prompt.style.alignItems = 'center';
      prompt.style.gap = '6px';
      prompt.style.padding = '4px 8px';
      prompt.style.border = '1px solid #475569';
      prompt.style.borderRadius = '6px';
      prompt.style.background = '#1f2430';
      prompt.style.color = '#e5e7eb';
      const text = document.createElement('span');
      text.textContent = 'New here? Take a quick tour.';
      const dont = document.createElement('label');
      dont.style.display = 'inline-flex';
      dont.style.alignItems = 'center';
      dont.style.gap = '4px';
      const dontCb = document.createElement('input');
      dontCb.type = 'checkbox';
      const dontTx = document.createElement('span');
      dontTx.textContent = "Don't show again";
      dont.appendChild(dontCb);
      dont.appendChild(dontTx);
      const start = document.createElement('button');
      start.textContent = 'Start Tour';
      start.addEventListener('click', async () => {
        try {
          const mod = await import('./help/HelpTourDriver');
          mod.startIntroTourDriver?.();
          ls.setItem(tourKey, dontCb.checked ? 'disabled' : 'completed');
        } catch {}
        prompt.remove();
      });
      const skip = document.createElement('button');
      skip.textContent = 'Skip';
      skip.addEventListener('click', () => {
        try {
          ls.setItem(tourKey, dontCb.checked ? 'disabled' : 'dismissed');
        } catch {}
        prompt.remove();
      });
      prompt.appendChild(text);
      prompt.appendChild(dont);
      prompt.appendChild(start);
      prompt.appendChild(skip);
      toolbar.appendChild(prompt);
      // Auto-start once after a short delay if not dismissed
      const autoKey = 'bladegen.tourAutoStart';
      const autoState = ls.getItem(autoKey); // 'done' | null
      if (!autoState) {
        setTimeout(async () => {
          // if prompt still exists and not disabled, start automatically
          if (document.body.contains(prompt) && !dontCb.checked) {
            try {
              const mod = await import('./help/HelpTourDriver');
              mod.startIntroTourDriver?.();
              ls.setItem(tourKey, 'completed');
            } catch {}
            prompt.remove();
          }
          ls.setItem(autoKey, 'done');
        }, 6000);
      }
    }
  } catch {}

  if (render?.setAutoSpinEnabled && render.getAutoSpinEnabled) {
    const autoSpinWrap = document.createElement('label');
    autoSpinWrap.style.display = 'flex';
    autoSpinWrap.style.alignItems = 'center';
    autoSpinWrap.style.gap = '4px';
    autoSpinWrap.style.marginLeft = '12px';
    autoSpinWrap.title = 'Toggle automatic turntable spin';

    autoSpinCheckbox = document.createElement('input');
    autoSpinCheckbox.type = 'checkbox';
    autoSpinCheckbox.checked = !!render.getAutoSpinEnabled();
    autoSpinCheckbox.setAttribute('aria-label', 'Auto Spin');
    autoSpinCheckbox.addEventListener('change', () => {
      render.setAutoSpinEnabled?.(autoSpinCheckbox!.checked);
    });

    const autoSpinLabel = document.createElement('span');
    autoSpinLabel.textContent = 'Auto Spin';

    autoSpinWrap.appendChild(autoSpinCheckbox);
    autoSpinWrap.appendChild(autoSpinLabel);
    toolbar.appendChild(autoSpinWrap);
  }

  const btnRandom = document.createElement('button');
  btnRandom.textContent = 'Randomize (full)';
  btnRandom.classList.add('model-only');
  toolbar.appendChild(btnRandom);

  const btnRandomSafe = document.createElement('button');
  btnRandomSafe.textContent = 'Randomize (safe)';
  btnRandomSafe.classList.add('model-only');
  toolbar.appendChild(btnRandomSafe);

  // lookSel change handled by looksPanel

  // Export dropdown (combo button)
  const exportWrap = document.createElement('div');
  exportWrap.className = 'dropdown model-only';
  const btnExportMenu = document.createElement('button');
  btnExportMenu.textContent = 'Export ▾';
  exportWrap.appendChild(btnExportMenu);
  const exportMenu = document.createElement('div');
  exportMenu.className = 'menu';
  const makeMenuBtn = (label: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    return b;
  };
  const menuGLB = makeMenuBtn('GLB');
  const menuOBJ = makeMenuBtn('OBJ');
  const menuSTL = makeMenuBtn('STL');
  const menuSVG = makeMenuBtn('SVG Blueprint');
  const menuJSON = makeMenuBtn('JSON (Model + Render + Materials)');
  exportMenu.appendChild(menuGLB);
  exportMenu.appendChild(menuOBJ);
  exportMenu.appendChild(menuSTL);
  exportMenu.appendChild(menuSVG);
  exportMenu.appendChild(menuJSON);
  exportWrap.appendChild(exportMenu);
  toolbar.appendChild(exportWrap);

  // JSON Import
  const btnImportJSON = document.createElement('button');
  btnImportJSON.textContent = 'Import JSON';
  toolbar.appendChild(btnImportJSON);
  const fileJSON = document.createElement('input');
  fileJSON.type = 'file';
  fileJSON.accept = 'application/json';
  fileJSON.style.display = 'none';
  el.appendChild(fileJSON);

  // Sections
  const sections: Record<Category, HTMLElement> = {
    Blade: addSection(el, 'Blade'),
    Engravings: addSection(el, 'Engravings'),
    Guard: addSection(el, 'Guard'),
    Handle: addSection(el, 'Handle'),
    Pommel: addSection(el, 'Pommel'),
    Accessories: addSection(el, 'Accessories'),
    Other: addSection(el, 'Other'),
    Render: addSection(el, 'Render'),
  };

  const showTab = (name: 'Model' | 'Render') => {
    const isRender = name === 'Render';
    tabModel.classList.toggle('active', !isRender);
    tabRender.classList.toggle('active', isRender);
    // Toggle section visibility
    sections.Blade.style.display = isRender ? 'none' : '';
    sections.Engravings.style.display = isRender ? 'none' : '';
    sections.Guard.style.display = isRender ? 'none' : '';
    sections.Handle.style.display = isRender ? 'none' : '';
    sections.Pommel.style.display = isRender ? 'none' : '';
    sections.Accessories.style.display = isRender ? 'none' : '';
    sections.Other.style.display = isRender ? 'none' : '';
    sections.Render.style.display = isRender ? '' : 'none';
    // Hide model-only toolbar items on Render tab
    const modelOnly = toolbar.querySelectorAll('.model-only');
    modelOnly.forEach((b) => {
      (b as HTMLElement).style.display = isRender ? 'none' : '';
    });
    try {
      syncVisibility();
    } catch {}
  };
  tabModel.addEventListener('click', () => {
    try {
      localStorage.setItem('bladegen.ui.tab', 'Model');
    } catch {}
    try {
      const t = localStorage.getItem('bladegen.ui.tab');
      showTab(t === 'Render' ? 'Render' : 'Model');
    } catch {
      showTab('Model');
    }
  });
  tabRender.addEventListener('click', () => {
    try {
      localStorage.setItem('bladegen.ui.tab', 'Render');
    } catch {}
    showTab('Render');
  });
  showTab('Model');

  // Per-section shuffle buttons
  addShuffleButton(sections.Blade, () => {
    randomizeBlade(state, true);
    rerender();
    syncUi();
  });
  addShuffleButton(sections.Guard, () => {
    randomizeGuard(state, true);
    rerender();
    syncUi();
  });
  addShuffleButton(sections.Handle, () => {
    randomizeHandle(state, true);
    rerender();
    syncUi();
  });
  addShuffleButton(sections.Pommel, () => {
    randomizePommel(state, true);
    rerender();
    syncUi();
  });
  addShuffleButton(sections.Accessories, () => {
    randomizeAccessories(state, true);
    rerender();
    syncUi();
  });

  // Section highlight (mouseenter/leave)
  const highlight = (part: Part | null) => {
    (sword as any)?.setHighlight?.(part);
  };
  sections.Blade.addEventListener('mouseenter', () => highlight('blade'));
  sections.Blade.addEventListener('mouseleave', () => highlight(null));
  sections.Guard.addEventListener('mouseenter', () => highlight('guard'));
  sections.Guard.addEventListener('mouseleave', () => highlight(null));
  sections.Handle.addEventListener('mouseenter', () => highlight('handle'));
  sections.Handle.addEventListener('mouseleave', () => highlight(null));
  sections.Pommel.addEventListener('mouseenter', () => highlight('pommel'));
  sections.Pommel.addEventListener('mouseleave', () => highlight(null));
  sections.Accessories.addEventListener('mouseenter', () => highlight('scabbard'));
  sections.Accessories.addEventListener('mouseleave', () => highlight(null));
  sections.Render.addEventListener('mouseenter', () => highlight(null));
  sections.Render.addEventListener('mouseleave', () => {});

  const warningsBox = document.createElement('div');
  warningsBox.style.fontSize = '12px';
  warningsBox.style.color = '#eab308';
  warningsBox.style.marginTop = '4px';
  sections.Other.appendChild(warningsBox);
  const dynamicsBox = document.createElement('div');
  dynamicsBox.style.fontSize = '12px';
  dynamicsBox.style.color = '#93c5fd';
  dynamicsBox.style.marginTop = '6px';
  sections.Other.appendChild(dynamicsBox);
  const fxSyncBox = document.createElement('div');
  fxSyncBox.style.fontSize = '12px';
  fxSyncBox.style.color = '#10b981';
  fxSyncBox.style.marginTop = '4px';
  fxSyncBox.textContent = '';
  sections.Other.appendChild(fxSyncBox);
  try {
    window.addEventListener('bladegen:fx-synced' as any, (e: any) => {
      const when = new Date();
      const hh = String(when.getHours()).padStart(2, '0');
      const mm = String(when.getMinutes()).padStart(2, '0');
      const ss = String(when.getSeconds()).padStart(2, '0');
      const parts = (e?.detail?.parts || []).join(', ');
      fxSyncBox.textContent = `FX synced ${hh}:${mm}:${ss}` + (parts ? ` (${parts})` : '');
    });
    window.addEventListener('bladegen:fx-synced' as any, (e: any) => {
      const when = new Date();
      const hh = String(when.getHours()).padStart(2, '0');
      const mm = String(when.getMinutes()).padStart(2, '0');
      const ss = String(when.getSeconds()).padStart(2, '0');
      const parts = (e?.detail?.parts || []).join(', ');
      fxSyncBox.textContent = `FX synced ${hh}:${mm}:${ss}` + (parts ? ` (${parts})` : '');
    });
  } catch {}

  // Render controls (if hooks available)
  // Keep handles to Render subsections needed later
  let rMatSec: HTMLElement | null = null;
  let rGradSec: HTMLElement | null = null;
  function syncAllMaterialInputs() {
    const slug = (p: Part) => `materials-${p}`;
    for (const p of PARTS) {
      const m = matState[p];
      registry.setValue(slug(p), 'Base Color', m.color);
      registry.setValue(slug(p), 'Metalness', m.metalness);
      registry.setValue(slug(p), 'Roughness', m.roughness);
      registry.setValue(slug(p), 'Clearcoat', m.clearcoat);
      registry.setValue(slug(p), 'Clearcoat Rough', m.clearcoatRoughness);
      registry.setValue(slug(p), 'Mat Preset', m.preset || 'None');
      registry.setValue(slug(p), 'Bump Enabled', m.bumpEnabled);
      registry.setValue(slug(p), 'Bump Scale', m.bumpScale);
      registry.setValue(slug(p), 'Noise Scale', m.bumpNoiseScale);
      registry.setValue(slug(p), 'Noise Seed', m.bumpSeed);
      registry.setValue(slug(p), 'Emissive', (m.emissiveIntensity ?? 0) > 0);
      registry.setValue(slug(p), 'Emissive Color', m.emissiveColor ?? '#000000');
      registry.setValue(slug(p), 'Emissive Intensity', m.emissiveIntensity ?? 0);
      registry.setValue(slug(p), 'Transmission', m.transmission ?? 0);
      registry.setValue(slug(p), 'IOR', m.ior ?? 1.5);
      registry.setValue(slug(p), 'Thickness', m.thickness ?? 0);
      registry.setValue(slug(p), 'Atten Color', m.attenuationColor ?? '#ffffff');
      registry.setValue(slug(p), 'Atten Dist', m.attenuationDistance ?? 1);
      registry.setValue(slug(p), 'Sheen', m.sheen ?? 0);
      registry.setValue(slug(p), 'Sheen Color', m.sheenColor ?? '#ffffff');
      registry.setValue(slug(p), 'Iridescence', m.iridescence ?? 0);
      registry.setValue(slug(p), 'Iridescence IOR', m.iridescenceIOR ?? 1.3);
      registry.setValue(slug(p), 'Iridescence Min', m.iridescenceThicknessMin ?? 100);
      registry.setValue(slug(p), 'Iridescence Max', m.iridescenceThicknessMax ?? 400);
      registry.setValue(slug(p), 'EnvMap Intensity', m.envMapIntensity ?? 1);
      registry.setValue(slug(p), 'Anisotropy', m.anisotropy ?? 0);
      registry.setValue(slug(p), 'Aniso Rotation', m.anisotropyRotation ?? 0);
    }
  }

  const syncRenderControls = () => {
    registry.setValue('render-quality-exposure', 'AA Mode', rstate.aaMode);
    registry.setValue('render-quality-exposure', 'Quality', rstate.qualityPreset);
    registry.setValue('render-quality-exposure', 'Shadow Map', String(rstate.shadowMapSize));
    registry.setValue('render-quality-exposure', 'Tone Mapping', rstate.toneMapping);
    registry.setValue('render-quality-exposure', 'Exposure', rstate.exposure);
    registry.setValue('render-quality-exposure', 'Env Intensity', rstate.envMapIntensity);
    registry.setValue('render-background', 'Background Color', rstate.bgColor);
    registry.setValue('render-background', 'Background Bright', rstate.bgBrightness);
    registry.setValue('render-lights', 'Ambient Intensity', rstate.ambient);
    registry.setValue('render-lights', 'Key Intensity', rstate.keyIntensity);
    registry.setValue('render-lights', 'Key Azimuth', rstate.keyAz);
    registry.setValue('render-lights', 'Key Elevation', rstate.keyEl);
    registry.setValue('render-lights', 'Rim Intensity', rstate.rimIntensity);
    registry.setValue('render-lights', 'Rim Azimuth', rstate.rimAz);
    registry.setValue('render-lights', 'Rim Elevation', rstate.rimEl);
    registry.setValue('render-lights', 'Rim Color', rstate.rimColor);
    registry.setValue('render-post', 'Bloom Enabled', rstate.bloomEnabled);
    registry.setValue('render-post', 'Bloom Strength', rstate.bloomStrength);
    registry.setValue('render-post', 'Bloom Threshold', rstate.bloomThreshold);
    registry.setValue('render-post', 'Bloom Radius', rstate.bloomRadius);
    registry.setValue('render-post', 'Outline Enabled', postState.outlineEnabled);
    registry.setValue('render-post', 'Outline Strength', postState.outlineStrength);
    registry.setValue('render-post', 'Outline Thickness', postState.outlineThickness);
    registry.setValue('render-post', 'Outline Color', postState.outlineColor);
    registry.setValue('render-post', 'Ink Outline', postState.inkEnabled);
    registry.setValue('render-post', 'Ink Thickness', postState.inkThickness);
    registry.setValue('render-post', 'Ink Color', postState.inkColor);
    registry.setValue('render-post', 'Vignette', postState.vignetteEnabled);
    registry.setValue('render-post', 'Vignette Strength', postState.vignetteStrength);
    registry.setValue('render-post', 'Vignette Softness', postState.vignetteSoftness);
    registry.setValue('render-blade-gradient', 'Blade Gradient', postState.bladeGradientEnabled);
    registry.setValue('render-blade-gradient', 'Grad Base', postState.gradBase);
    registry.setValue('render-blade-gradient', 'Grad Edge', postState.gradEdge);
    registry.setValue('render-blade-gradient', 'Grad Edge Fade', postState.gradFade);
    registry.setValue('render-blade-gradient', 'Wear Intensity', postState.gradWear);
    registry.setValue('render-atmospherics', 'EnvMap URL', atmosState.envUrl);
    registry.setValue('render-atmospherics', 'Env Preset', atmosState.envPreset);
    registry.setValue('render-atmospherics', 'Env as Background', atmosState.envAsBackground);
    registry.setValue('render-atmospherics', 'Fog Color', atmosState.fogColor);
    registry.setValue('render-atmospherics', 'Fog Density', atmosState.fogDensity);
    registry.setValue('render-atmospherics', 'Fresnel', atmosState.fresnelEnabled);
    registry.setValue('render-atmospherics', 'Fresnel Intensity', atmosState.fresnelIntensity);
    registry.setValue('render-atmospherics', 'Fresnel Power', atmosState.fresnelPower);
    registry.setValue('render-atmospherics', 'Fresnel Color', atmosState.fresnelColor);
    registry.setValue('render-atmospherics', 'Blade Invisible', atmosState.bladeInvisible);
    registry.setValue('render-atmospherics', 'Occlude When Invisible', atmosState.occludeInvisible);
    registry.setValue('render-fx', 'Inner Glow', fxState.innerGlow.enabled);
    registry.setValue('render-fx', 'Glow Color', fxState.innerGlow.color);
    registry.setValue('render-fx', 'Glow Min', fxState.innerGlow.min);
    registry.setValue('render-fx', 'Glow Max', fxState.innerGlow.max);
    registry.setValue('render-fx', 'Glow Speed', fxState.innerGlow.speed);
    registry.setValue('render-fx', 'Blade Mist', fxState.mist.enabled);
    registry.setValue('render-fx', 'Mist Color', fxState.mist.color);
    registry.setValue('render-fx', 'Mist Density', fxState.mist.density);
    registry.setValue('render-fx', 'Mist Speed', fxState.mist.speed);
    registry.setValue('render-fx', 'Mist Spread', fxState.mist.spread);
    registry.setValue('render-fx', 'Mist Size', fxState.mist.size);
    registry.setValue('render-fx', 'Mist Life Rate', fxState.mist.lifeRate);
    registry.setValue('render-fx', 'Mist Turbulence', fxState.mist.turbulence);
    registry.setValue('render-fx', 'Wind X', fxState.mist.windX);
    registry.setValue('render-fx', 'Wind Z', fxState.mist.windZ);
    registry.setValue('render-fx', 'Emit Region', fxState.mist.emission);
    registry.setValue('render-fx', 'Size Min Ratio', fxState.mist.sizeMinRatio);
    registry.setValue('render-fx', 'Occlude by Blade', fxState.mist.occlude);
    registry.setValue('render-fx', 'Flame Aura', fxState.flame.enabled);
    registry.setValue('render-fx', 'Flame Color A', fxState.flame.color1);
    registry.setValue('render-fx', 'Flame Color B', fxState.flame.color2);
    registry.setValue('render-fx', 'Flame Intensity', fxState.flame.intensity);
    registry.setValue('render-fx', 'Flame Speed', fxState.flame.speed);
    registry.setValue('render-fx', 'Flame NoiseScale', fxState.flame.noiseScale);
    registry.setValue('render-fx', 'Flame Scale', fxState.flame.scale);
    registry.setValue('render-fx', 'Flame Direction', fxState.flame.direction);
    registry.setValue('render-fx', 'Flame Blend', fxState.flame.blend);
    registry.setValue('render-fx', 'Selective Bloom', fxState.selectiveBloom);
    registry.setValue('render-fx', 'Heat Haze', fxState.heatHaze);
    registry.setValue('render-fx', 'Embers', fxState.embers.enabled);
    registry.setValue('render-fx', 'Ember Count', fxState.embers.count);
    registry.setValue('render-fx', 'Ember Size', fxState.embers.size);
    registry.setValue('render-fx', 'Ember Color', fxState.embers.color);
  };

  const syncUi = () => {
    refreshInputs(registry, state);
    syncEngravingControls();
    if (render) {
      if (autoSpinCheckbox && render.getAutoSpinEnabled) {
        const spin = render.getAutoSpinEnabled();
        if (typeof spin === 'boolean') {
          autoSpinCheckbox.checked = spin;
        }
      }
      syncRenderControls();
      syncAllMaterialInputs();
      renderVariantList();
    }
    try {
      syncVisibility();
    } catch {}
  };

  if (render) {
    const renderResetRow = document.createElement('div');
    renderResetRow.className = 'row full';
    renderResetRow.style.marginBottom = '8px';
    const renderResetBtn = document.createElement('button');
    renderResetBtn.type = 'button';
    renderResetBtn.textContent = 'Reset Render';
    renderResetBtn.addEventListener('click', () => {
      resetRenderAndFx();
      syncUi();
    });
    const resetHint = document.createElement('span');
    resetHint.style.marginLeft = '8px';
    resetHint.style.fontSize = '12px';
    resetHint.textContent = 'Reload render defaults & effects';
    renderResetRow.appendChild(renderResetBtn);
    renderResetRow.appendChild(resetHint);
    sections.Render.appendChild(renderResetRow);

    // Subsections for Render tab
    const rQual = addSection(sections.Render, 'Render: Quality & Exposure');
    const rMode = addSection(sections.Render, 'Render: Mode');
    const rBg = addSection(sections.Render, 'Render: Background');
    const rLights = addSection(sections.Render, 'Render: Lights');
    const rPost = addSection(sections.Render, 'Render: Post');
    const rAtmos = addSection(sections.Render, 'Render: Atmospherics');
    const rGrad = addSection(sections.Render, 'Render: Blade Gradient');
    const rFX = addSection(sections.Render, 'Render: FX');
    const rMat = addSection(sections.Render, 'Render: Materials');
    const rVariants = addSection(sections.Render, 'Render: Material Variants');
    rMatSec = rMat;
    rGradSec = rGrad;

    // hexToInt imported from ../utils/color
    const applyEnvMap = (url?: string | null, asBackground?: boolean) => {
      if (!render?.setEnvMap) return;
      const effectiveUrl = url === undefined ? atmosState.envUrl : url || '';
      const background = asBackground === undefined ? atmosState.envAsBackground : asBackground;
      render.setEnvMap(effectiveUrl ? effectiveUrl : undefined, background);
    };
    const applyFresnel = () => {
      (render as any).setFresnel?.(
        atmosState.fresnelEnabled,
        hexToInt(atmosState.fresnelColor),
        atmosState.fresnelIntensity,
        atmosState.fresnelPower
      );
    };
    const applyBladeVisibility = () => {
      render.setBladeVisible?.(!atmosState.bladeInvisible, atmosState.occludeInvisible);
    };
    const applyInnerGlow = () => {
      const ig = fxState.innerGlow;
      (render as any).setInnerGlow?.(ig.enabled, hexToInt(ig.color), ig.min, ig.max, ig.speed);
    };
    const applyMist = () => {
      const m = fxState.mist;
      (render as any).setBladeMist?.(
        m.enabled,
        hexToInt(m.color),
        m.density,
        m.speed,
        m.spread,
        m.size
      );
      (render as any).setBladeMistAdvanced?.({
        lifeRate: m.lifeRate,
        noiseAmp: m.turbulence,
        windX: m.windX,
        windZ: m.windZ,
        emission: m.emission,
        sizeMinRatio: m.sizeMinRatio,
        occlude: m.occlude,
      });
    };
    const applyFlame = () => {
      const f = fxState.flame;
      const blendMap: Record<'Add' | 'Darken' | 'Multiply', string> = {
        Add: 'add',
        Darken: 'normal',
        Multiply: 'multiply',
      };
      (render as any).setFlameAura?.(f.enabled, {
        scale: f.scale,
        color1: hexToInt(f.color1),
        color2: hexToInt(f.color2),
        noiseScale: f.noiseScale,
        speed: f.speed,
        intensity: f.intensity,
        direction: f.direction === 'Down' ? 'down' : 'up',
        blend: blendMap[f.blend],
      });
    };
    const applyEmbers = () => {
      const e = fxState.embers;
      (render as any).setEmbers?.(e.enabled, {
        count: Math.max(1, Math.floor(e.count)),
        size: e.size,
        color: hexToInt(e.color),
      });
    };

    const envPresetOptions: Record<
      typeof atmosState.envPreset,
      { url?: string; asBackground: boolean }
    > = {
      None: { url: '', asBackground: false },
      Room: { url: '', asBackground: false },
      'Royal Esplanade': {
        url: 'https://threejs.org/examples/textures/equirectangular/royal_esplanade_1k.hdr',
        asBackground: true,
      },
      'Venice Sunset': {
        url: 'https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr',
        asBackground: true,
      },
    };

    const applyEnvPreset = (preset: typeof atmosState.envPreset, emitUi = false) => {
      const config = envPresetOptions[preset] ?? envPresetOptions.None;
      atmosState.envPreset = preset;
      atmosState.envUrl = config.url ?? '';
      atmosState.envAsBackground = config.asBackground;
      applyEnvMap(atmosState.envUrl, atmosState.envAsBackground);
      if (emitUi) {
        registry.setValue('render-atmospherics', 'EnvMap URL', atmosState.envUrl);
        registry.setValue('render-atmospherics', 'Env as Background', atmosState.envAsBackground);
        registry.setValue('render-atmospherics', 'Env Preset', preset);
      }
    };

    const QUALITY_PRESETS = makeQualityPresets(supportedAAModes);

    const applyQualityPreset = createApplyQualityPreset(
      render as any,
      rstate as any,
      postState as any,
      registry as any,
      refreshWarnings,
      supportedAAModes
    );

    const applyRenderOverrides = (overrides?: PresetRenderOverrides) => {
      if (!overrides) return;
      if (overrides.qualityPreset) {
        applyQualityPreset(overrides.qualityPreset, false);
      }
      if (overrides.aaMode !== undefined) {
        rstate.aaMode = overrides.aaMode;
        render.setAAMode(rstate.aaMode);
      }
      if (overrides.shadowMapSize !== undefined) {
        rstate.shadowMapSize = overrides.shadowMapSize;
        render.setShadowMapSize(rstate.shadowMapSize);
      }
      if (overrides.toneMapping !== undefined) {
        rstate.toneMapping = overrides.toneMapping;
        (render as any).setToneMapping?.(overrides.toneMapping);
      }
      if (overrides.dprCap !== undefined) {
        render.setDPRCap(overrides.dprCap);
      }
      if (overrides.shadowBias !== undefined) {
        render.setShadowBias(overrides.shadowBias);
      }

      const applyNumeric = <K extends keyof PresetRenderOverrides>(
        key: K,
        setter: (value: NonNullable<PresetRenderOverrides[K]>) => void
      ) => {
        const val = overrides[key];
        if (val !== undefined) setter(val as NonNullable<PresetRenderOverrides[K]>);
      };

      applyNumeric('exposure', (v) => {
        rstate.exposure = v;
        render.setExposure(v);
      });
      applyNumeric('ambient', (v) => {
        rstate.ambient = v;
        render.setAmbient(v);
      });
      applyNumeric('keyIntensity', (v) => {
        rstate.keyIntensity = v;
        render.setKeyIntensity(v);
      });
      applyNumeric('keyAz', (v) => {
        rstate.keyAz = v;
        render.setKeyAngles(rstate.keyAz, rstate.keyEl);
      });
      applyNumeric('keyEl', (v) => {
        rstate.keyEl = v;
        render.setKeyAngles(rstate.keyAz, rstate.keyEl);
      });
      applyNumeric('rimIntensity', (v) => {
        rstate.rimIntensity = v;
        render.setRimIntensity(v);
      });
      applyNumeric('rimAz', (v) => {
        rstate.rimAz = v;
        render.setRimAngles(rstate.rimAz, rstate.rimEl);
      });
      applyNumeric('rimEl', (v) => {
        rstate.rimEl = v;
        render.setRimAngles(rstate.rimAz, rstate.rimEl);
      });
      if (overrides.rimColor !== undefined) {
        rstate.rimColor = overrides.rimColor;
        render.setRimColor(hexToInt(rstate.rimColor));
      }
      applyNumeric('envMapIntensity', (v) => {
        rstate.envMapIntensity = v;
        render.setEnvIntensity(v);
      });
      if (overrides.bgColor !== undefined) {
        rstate.bgColor = overrides.bgColor;
        render.setBackgroundColor(hexToInt(rstate.bgColor));
      }
      applyNumeric('bgBrightness', (v) => {
        rstate.bgBrightness = v;
        render.setBackgroundBrightness(v);
      });

      let bloomDirty = false;
      if (overrides.bloomEnabled !== undefined) {
        rstate.bloomEnabled = overrides.bloomEnabled;
        bloomDirty = true;
      }
      if (overrides.bloomStrength !== undefined) {
        rstate.bloomStrength = overrides.bloomStrength;
        bloomDirty = true;
      }
      if (overrides.bloomThreshold !== undefined) {
        rstate.bloomThreshold = overrides.bloomThreshold;
        bloomDirty = true;
      }
      if (overrides.bloomRadius !== undefined) {
        rstate.bloomRadius = overrides.bloomRadius;
        bloomDirty = true;
      }
      if (bloomDirty) {
        render.setBloom(
          rstate.bloomEnabled,
          rstate.bloomStrength,
          rstate.bloomThreshold,
          rstate.bloomRadius
        );
      }
    };

    const applyPostOverrides = (overrides?: PresetPostOverrides) => {
      if (!overrides) return;
      Object.assign(postState, overrides);
      render.setOutline(
        postState.outlineEnabled,
        postState.outlineStrength,
        postState.outlineThickness,
        hexToInt(postState.outlineColor)
      );
      render.setInkOutline(
        postState.inkEnabled,
        postState.inkThickness,
        hexToInt(postState.inkColor)
      );
      render.setVignette(
        postState.vignetteEnabled,
        postState.vignetteStrength,
        postState.vignetteSoftness
      );
      render.setBladeGradientWear(
        postState.bladeGradientEnabled,
        hexToInt(postState.gradBase),
        hexToInt(postState.gradEdge),
        postState.gradFade,
        postState.gradWear
      );
    };

    const applyAtmosOverrides = (overrides?: PresetAtmosOverrides) => {
      if (!overrides) return;
      if (overrides.envPreset !== undefined) {
        applyEnvPreset(overrides.envPreset, false);
      }
      let envUpdated = false;
      if (overrides.envUrl !== undefined) {
        atmosState.envUrl = overrides.envUrl;
        envUpdated = true;
      }
      if (overrides.envAsBackground !== undefined) {
        atmosState.envAsBackground = overrides.envAsBackground;
        envUpdated = true;
      }
      if (envUpdated) {
        applyEnvMap(atmosState.envUrl, atmosState.envAsBackground);
      }
      if (overrides.fogColor !== undefined) atmosState.fogColor = overrides.fogColor;
      if (overrides.fogDensity !== undefined) atmosState.fogDensity = overrides.fogDensity;
      (render as any).setFog?.(hexToInt(atmosState.fogColor), atmosState.fogDensity);
      if (overrides.fresnelColor !== undefined) atmosState.fresnelColor = overrides.fresnelColor;
      if (overrides.fresnelIntensity !== undefined)
        atmosState.fresnelIntensity = overrides.fresnelIntensity;
      if (overrides.fresnelPower !== undefined) atmosState.fresnelPower = overrides.fresnelPower;
      if (overrides.fresnelEnabled !== undefined)
        atmosState.fresnelEnabled = overrides.fresnelEnabled;
      applyFresnel();
      if (overrides.bladeInvisible !== undefined)
        atmosState.bladeInvisible = overrides.bladeInvisible;
      if (overrides.occludeInvisible !== undefined)
        atmosState.occludeInvisible = overrides.occludeInvisible;
      applyBladeVisibility();
    };

    const applyFxOverrides = (overrides?: PresetFxOverrides) => {
      if (!overrides) return;
      if (overrides.innerGlow) Object.assign(fxState.innerGlow, overrides.innerGlow);
      if (overrides.mist) Object.assign(fxState.mist, overrides.mist);
      if (overrides.flame) Object.assign(fxState.flame, overrides.flame);
      if (overrides.embers) Object.assign(fxState.embers, overrides.embers);
      if (overrides.selectiveBloom !== undefined) fxState.selectiveBloom = overrides.selectiveBloom;
      if (overrides.heatHaze !== undefined) fxState.heatHaze = overrides.heatHaze;
      applyInnerGlow();
      applyMist();
      applyFlame();
      applyEmbers();
      (render as any).setSelectiveBloom?.(fxState.selectiveBloom, 1.1, 0.8, 0.35, 1.0);
      (render as any).setHeatHaze?.(fxState.heatHaze, 0.004);
    };

    resetRenderAndFx = () => {
      resetStateOnly();
      applyQualityPreset(rstate.qualityPreset, false);
      // Ensure Standard render mode by default and reset pixel-art options
      try {
        (render as any).setRenderMode?.('standard');
        (render as any).setPixelArtOptions?.({
          pixelSize: pixelState.pixelSize,
          posterizeLevels: pixelState.posterize,
        });
      } catch {}
      render.setExposure(rstate.exposure);
      render.setAmbient(rstate.ambient);
      render.setKeyIntensity(rstate.keyIntensity);
      render.setKeyAngles(rstate.keyAz, rstate.keyEl);
      render.setRimIntensity(rstate.rimIntensity);
      render.setRimAngles(rstate.rimAz, rstate.rimEl);
      render.setRimColor(hexToInt(rstate.rimColor));
      render.setBloom(
        rstate.bloomEnabled,
        rstate.bloomStrength,
        rstate.bloomThreshold,
        rstate.bloomRadius
      );
      render.setEnvIntensity(rstate.envMapIntensity);
      render.setBackgroundBrightness(rstate.bgBrightness);
      render.setBackgroundColor(hexToInt(rstate.bgColor));
      render.setAAMode?.(rstate.aaMode);
      render.setShadowMapSize?.(rstate.shadowMapSize);
      (render as any).setToneMapping?.(rstate.toneMapping);

      applyEnvPreset(atmosState.envPreset, false);
      (render as any).setFog?.(hexToInt(atmosState.fogColor), atmosState.fogDensity);
      applyFresnel();
      applyBladeVisibility();

      render.setOutline(
        postState.outlineEnabled,
        postState.outlineStrength,
        postState.outlineThickness,
        hexToInt(postState.outlineColor)
      );
      render.setInkOutline(
        postState.inkEnabled,
        postState.inkThickness,
        hexToInt(postState.inkColor)
      );
      render.setVignette(
        postState.vignetteEnabled,
        postState.vignetteStrength,
        postState.vignetteSoftness
      );
      render.setBladeGradientWear(
        postState.bladeGradientEnabled,
        hexToInt(postState.gradBase),
        hexToInt(postState.gradEdge),
        postState.gradFade,
        postState.gradWear
      );

      applyInnerGlow();
      applyMist();
      applyFlame();
      applyEmbers();
      (render as any).setSelectiveBloom?.(fxState.selectiveBloom, 1.1, 0.8, 0.35, 1.0);
      (render as any).setHeatHaze?.(fxState.heatHaze, 0.004);
    };

    applyVisualOverrides = (entry) => {
      resetRenderAndFx();
      applyRenderOverrides(entry.render);
      applyPostOverrides(entry.post);
      applyAtmosOverrides(entry.atmos);
      applyFxOverrides(entry.fx);
    };

    // Material panels per part
    const partLabel = (p: Part) => p.charAt(0).toUpperCase() + p.slice(1);
    const buildMaterialPanel = (parent: HTMLElement, part: Part) => {
      const sect = addSection(parent, `Materials: ${partLabel(part)}`);
      const sslug = sect.dataset.fieldNamespace || `materials-${part}`;
      const m = matState[part];
      const gBase = addGroup(sect, 'Base PBR');
      colorPicker(
        gBase,
        'Base Color',
        m.color,
        (hex) => {
          m.color = hex;
          render.setPartColor(part, hexToInt(hex));
        },
        () => {},
        'Albedo color.'
      );
      slider(
        gBase,
        'Metalness',
        0,
        1,
        0.01,
        m.metalness,
        (v) => {
          m.metalness = v;
          render.setPartMetalness(part, v);
        },
        () => {},
        'PBR metalness.'
      );
      slider(
        gBase,
        'Roughness',
        0,
        1,
        0.01,
        m.roughness,
        (v) => {
          m.roughness = v;
          render.setPartRoughness(part, v);
        },
        () => {},
        'PBR roughness.'
      );
      slider(
        gBase,
        'Clearcoat',
        0,
        1,
        0.01,
        m.clearcoat,
        (v) => {
          m.clearcoat = v;
          render.setPartClearcoat(part, v);
        },
        () => {},
        'Clearcoat layer (if supported).'
      );
      slider(
        gBase,
        'Clearcoat Rough',
        0,
        1,
        0.01,
        m.clearcoatRoughness,
        (v) => {
          m.clearcoatRoughness = v;
          render.setPartClearcoatRoughness(part, v);
        },
        () => {},
        'Clearcoat roughness (if supported).'
      );

      // Material presets
      select(
        gBase,
        'Mat Preset',
        ['None', 'Steel', 'Iron', 'Bronze', 'Brass', 'Leather', 'Wood', 'Matte', 'Glass', 'Gem'],
        m.preset || 'None',
        (v) => {
          const apply = (
            c: number,
            mn: number,
            r: number,
            cc: number,
            ccr: number,
            extra?: Partial<MatExt>
          ) => {
            const target = matState[part];
            target.color = '#' + c.toString(16).padStart(6, '0');
            target.metalness = mn;
            target.roughness = r;
            target.clearcoat = cc;
            target.clearcoatRoughness = ccr;
            target.preset = v;
            render.setPartColor(part, c);
            render.setPartMetalness(part, mn);
            render.setPartRoughness(part, r);
            render.setPartClearcoat(part, cc);
            render.setPartClearcoatRoughness(part, ccr);
            const extras = extra ?? {};
            Object.assign(target, extras);
            const patch: Record<string, unknown> = {};
            const keys: Array<keyof MatExt> = [
              'emissiveColor',
              'emissiveIntensity',
              'transmission',
              'ior',
              'thickness',
              'attenuationColor',
              'attenuationDistance',
              'sheen',
              'sheenColor',
              'iridescence',
              'iridescenceIOR',
              'iridescenceThicknessMin',
              'iridescenceThicknessMax',
              'envMapIntensity',
              'anisotropy',
              'anisotropyRotation',
            ];
            for (const k of keys) {
              const val = (extras as any)[k];
              if (val !== undefined) (patch as any)[k] = val;
            }
            if (Object.keys(patch).length) (render as any).setPartMaterial?.(part, patch);
            try {
              syncVisibility();
            } catch {}
          };
          if (v === 'Steel')
            apply(0xb9c6ff, 0.9, 0.25, 0.2, 0.4, { anisotropy: 0.35, anisotropyRotation: 0 });
          else if (v === 'Iron')
            apply(0x9aa4b2, 0.8, 0.45, 0.05, 0.6, { anisotropy: 0.18, anisotropyRotation: 0 });
          else if (v === 'Bronze')
            apply(0xcd7f32, 0.6, 0.5, 0.05, 0.6, { anisotropy: 0.22, anisotropyRotation: 0 });
          else if (v === 'Brass')
            apply(0xb5a642, 0.6, 0.5, 0.05, 0.6, { anisotropy: 0.28, anisotropyRotation: 0 });
          else if (v === 'Leather') apply(0x6b4f3a, 0.05, 0.85, 0.0, 0.8);
          else if (v === 'Wood') apply(0x8b6f47, 0.02, 0.8, 0.0, 0.8);
          else if (v === 'Matte') apply(0xbfbfbf, 0.0, 0.9, 0.0, 1.0);
          else if (v === 'Glass')
            apply(0xffffff, 0.0, 0.05, 0.0, 1.0, {
              transmission: 0.95,
              ior: 1.5,
              thickness: 0.2,
              attenuationColor: '#ffffff',
              attenuationDistance: 1.0,
              envMapIntensity: 1.5,
              anisotropy: 0,
              anisotropyRotation: 0,
            });
          else if (v === 'Gem')
            apply(0xc0e0ff, 0.0, 0.02, 0.1, 0.2, {
              transmission: 0.98,
              ior: 2.3,
              thickness: 0.4,
              attenuationColor: '#a0c8ff',
              attenuationDistance: 0.2,
              iridescence: 0.2,
              anisotropy: 0,
              anisotropyRotation: 0,
            });
          else {
            matState[part].preset = 'None';
            try {
              syncVisibility();
            } catch {}
          }
        },
        () => {},
        'Quick material presets'
      );

      const resetBtn = document.createElement('button');
      resetBtn.textContent = 'Reset Material';
      resetBtn.title = `Reset ${partLabel(part)} material to defaults`;
      resetBtn.style.margin = '4px 0';
      resetBtn.addEventListener('click', () => {
        const def = JSON.parse(JSON.stringify(matDefaults[part])) as MatExt;
        matState[part] = def;
        const c = hexToInt(def.color);
        render.setPartColor(part, c);
        render.setPartMetalness(part, def.metalness);
        render.setPartRoughness(part, def.roughness);
        render.setPartClearcoat(part, def.clearcoat);
        render.setPartClearcoatRoughness(part, def.clearcoatRoughness);
        (render as any).setPartMaterial?.(part, {
          emissiveColor: def.emissiveColor,
          emissiveIntensity: def.emissiveIntensity,
          transmission: def.transmission,
          ior: def.ior,
          thickness: def.thickness,
          attenuationColor: def.attenuationColor,
          attenuationDistance: def.attenuationDistance,
          sheen: def.sheen,
          sheenColor: def.sheenColor,
          iridescence: def.iridescence,
          iridescenceIOR: def.iridescenceIOR,
          iridescenceThicknessMin: def.iridescenceThicknessMin,
          iridescenceThicknessMax: def.iridescenceThicknessMax,
          envMapIntensity: def.envMapIntensity,
          anisotropy: def.anisotropy,
          anisotropyRotation: def.anisotropyRotation,
        });
        try {
          syncVisibility();
        } catch {}
      });
      sect.appendChild(resetBtn);
      // Bump
      const gBump = addGroup(sect, 'Bump');
      checkbox(
        gBump,
        'Bump Enabled',
        m.bumpEnabled,
        (v) => {
          m.bumpEnabled = v;
          render.setPartBump(part, v, m.bumpScale, m.bumpNoiseScale, m.bumpSeed);
          try {
            syncVisibility();
          } catch {}
        },
        () => {},
        'Procedural noise bump.'
      );
      slider(
        gBump,
        'Bump Scale',
        0,
        0.08,
        0.001,
        m.bumpScale,
        (v) => {
          m.bumpScale = v;
          render.setPartBump(part, m.bumpEnabled, v, m.bumpNoiseScale, m.bumpSeed);
        },
        () => {},
        'Bump map scale.'
      );
      slider(
        gBump,
        'Noise Scale',
        1,
        32,
        1,
        m.bumpNoiseScale,
        (v) => {
          m.bumpNoiseScale = Math.round(v);
          render.setPartBump(part, m.bumpEnabled, m.bumpScale, m.bumpNoiseScale, m.bumpSeed);
        },
        () => {},
        'Noise frequency.'
      );
      slider(
        gBump,
        'Noise Seed',
        0,
        9999,
        1,
        m.bumpSeed,
        (v) => {
          m.bumpSeed = Math.round(v);
          render.setPartBump(part, m.bumpEnabled, m.bumpScale, m.bumpNoiseScale, m.bumpSeed);
        },
        () => {},
        'Noise seed.'
      );

      // Emissive
      const gEmis = addGroup(sect, 'Emissive');
      const emissiveOn = (m.emissiveIntensity ?? 0) > 0;
      checkbox(
        gEmis,
        'Emissive',
        emissiveOn,
        (v) => {
          if (!v) {
            m.emissiveIntensity = 0;
            (render as any).setPartMaterial?.(part, { emissiveIntensity: 0 });
          } else {
            m.emissiveIntensity =
              m.emissiveIntensity && m.emissiveIntensity > 0 ? m.emissiveIntensity : 1.0;
            (render as any).setPartMaterial?.(part, { emissiveIntensity: m.emissiveIntensity });
          }
          try {
            syncVisibility();
          } catch {}
        },
        () => {},
        'Enable emissive glow.'
      );
      colorPicker(
        gEmis,
        'Emissive Color',
        m.emissiveColor ?? '#000000',
        (hex) => {
          m.emissiveColor = hex;
          (render as any).setPartMaterial?.(part, { emissiveColor: hex });
        },
        () => {},
        'Glow color.'
      );
      slider(
        gEmis,
        'Emissive Intensity',
        0,
        10,
        0.01,
        m.emissiveIntensity ?? 0,
        (v) => {
          m.emissiveIntensity = v;
          (render as any).setPartMaterial?.(part, { emissiveIntensity: v });
          try {
            syncVisibility();
          } catch {}
        },
        () => {},
        'Glow intensity.'
      );

      // Transmission / volume
      const gTrans = addGroup(sect, 'Transmission / Volume');
      slider(
        gTrans,
        'Transmission',
        0,
        1,
        0.01,
        m.transmission ?? 0,
        (v) => {
          m.transmission = v;
          (render as any).setPartMaterial?.(part, { transmission: v });
          try {
            syncVisibility();
          } catch {}
        },
        () => {},
        'Glass-like transmission.'
      );
      slider(
        gTrans,
        'IOR',
        1,
        2.5,
        0.01,
        m.ior ?? 1.5,
        (v) => {
          m.ior = v;
          (render as any).setPartMaterial?.(part, { ior: v });
        },
        () => {},
        'Index of refraction.'
      );
      slider(
        gTrans,
        'Thickness',
        0,
        5,
        0.01,
        m.thickness ?? 0.2,
        (v) => {
          m.thickness = v;
          (render as any).setPartMaterial?.(part, { thickness: v });
        },
        () => {},
        'Volume thickness.'
      );
      colorPicker(
        gTrans,
        'Atten Color',
        m.attenuationColor ?? '#ffffff',
        (hex) => {
          m.attenuationColor = hex;
          (render as any).setPartMaterial?.(part, { attenuationColor: hex });
        },
        () => {},
        'Transmission attenuation color.'
      );
      slider(
        gTrans,
        'Atten Dist',
        0,
        10,
        0.01,
        m.attenuationDistance ?? 0,
        (v) => {
          m.attenuationDistance = v;
          (render as any).setPartMaterial?.(part, { attenuationDistance: v });
        },
        () => {},
        'Attenuation distance.'
      );

      // Sheen
      const gSheen = addGroup(sect, 'Sheen');
      slider(
        gSheen,
        'Sheen',
        0,
        1,
        0.01,
        m.sheen ?? 0,
        (v) => {
          m.sheen = v;
          (render as any).setPartMaterial?.(part, { sheen: v });
          try {
            syncVisibility();
          } catch {}
        },
        () => {},
        'Cloth sheen.'
      );
      colorPicker(
        gSheen,
        'Sheen Color',
        m.sheenColor ?? '#ffffff',
        (hex) => {
          m.sheenColor = hex;
          (render as any).setPartMaterial?.(part, { sheenColor: hex });
        },
        () => {},
        'Sheen color.'
      );

      // Iridescence
      const gIri = addGroup(sect, 'Iridescence');
      slider(
        gIri,
        'Iridescence',
        0,
        1,
        0.01,
        m.iridescence ?? 0,
        (v) => {
          m.iridescence = v;
          (render as any).setPartMaterial?.(part, { iridescence: v });
          try {
            syncVisibility();
          } catch {}
        },
        () => {},
        'Iridescent layer strength.'
      );
      slider(
        gIri,
        'Iridescence IOR',
        1,
        2.5,
        0.01,
        m.iridescenceIOR ?? 1.3,
        (v) => {
          m.iridescenceIOR = v;
          (render as any).setPartMaterial?.(part, { iridescenceIOR: v });
        },
        () => {},
        'Iridescence index of refraction.'
      );
      slider(
        gIri,
        'Iridescence Min',
        0,
        1200,
        1,
        m.iridescenceThicknessMin ?? 100,
        (v) => {
          m.iridescenceThicknessMin = Math.round(v);
          (render as any).setPartMaterial?.(part, { iridescenceThicknessMin: Math.round(v) });
        },
        () => {},
        'Thin-film min thickness (nm).'
      );
      slider(
        gIri,
        'Iridescence Max',
        0,
        1200,
        1,
        m.iridescenceThicknessMax ?? 400,
        (v) => {
          m.iridescenceThicknessMax = Math.round(v);
          (render as any).setPartMaterial?.(part, { iridescenceThicknessMax: Math.round(v) });
        },
        () => {},
        'Thin-film max thickness (nm).'
      );

      // Environment / anisotropy
      const gEnvAni = addGroup(sect, 'Environment & Anisotropy');
      slider(
        gEnvAni,
        'EnvMap Intensity',
        0,
        3,
        0.01,
        m.envMapIntensity ?? 1,
        (v) => {
          m.envMapIntensity = v;
          (render as any).setPartMaterial?.(part, { envMapIntensity: v });
        },
        () => {},
        'Boost environment reflections.'
      );
      slider(
        gEnvAni,
        'Anisotropy',
        0,
        1,
        0.01,
        m.anisotropy ?? 0,
        (v) => {
          m.anisotropy = v;
          (render as any).setPartMaterial?.(part, { anisotropy: v });
          try {
            syncVisibility();
          } catch {}
        },
        () => {},
        'Brushed highlight strength (0 = isotropic, 1 = strong anisotropy).'
      );
      slider(
        gEnvAni,
        'Aniso Rotation',
        -Math.PI,
        Math.PI,
        0.01,
        m.anisotropyRotation ?? 0,
        (v) => {
          m.anisotropyRotation = typeof v === 'number' ? v : 0;
          (render as any).setPartMaterial?.(part, { anisotropyRotation: m.anisotropyRotation });
        },
        () => {},
        'Anisotropy direction in radians (0 aligns with +X).'
      );
    };
    for (const p of PARTS) buildMaterialPanel(rMatSec || sections.Render, p);

    const looks = attachLooksPanel({
      section: rVariants,
      lookSelect: lookSel,
      matState,
      stateRefs: looksState,
      applyMaterialStateToRenderer,
      syncAllMaterialInputs,
      rerender,
    });
    renderVariantList = looks.renderVariantList;
    syncLookDropdown = looks.syncLookDropdown;
    applyLook = looks.applyLook;

    // Apply defaults on first load so launch baseline matches desired render settings (FXAA, fog, etc.)
    try {
      resetRenderAndFx();
    } catch {}

    attachRenderQualityPanel({
      section: rQual,
      render: render as any,
      rstate: rstate as any,
      postState: postState as any,
      supportedAAModes,
      applyQualityPreset,
      refreshWarnings,
      checkbox,
      select,
      slider,
      rerender,
    });

    attachRenderPixelArtPanel({
      section: rMode,
      render: render as any,
      state: pixelState,
      select,
      slider,
      rerender,
    });

    attachRenderBackgroundPanel({
      section: rBg,
      render: render as any,
      rstate: rstate as any,
      colorPicker,
      slider,
      rerender,
    });

    attachRenderLightsPanel({
      section: rLights,
      render: render as any,
      rstate: rstate as any,
      slider,
      colorPicker,
      rerender,
    });

    attachRenderPostPanel({
      section: rPost,
      render: render as any,
      rstate: rstate as any,
      postState: postState as any,
      refreshWarnings,
      checkbox,
      select,
      slider,
      colorPicker,
      rerender,
    });
    // Blade gradient/wear overlay (moved to rGrad below)
    attachRenderAtmosPanel({
      section: rAtmos,
      render: render as any,
      atmosState: atmosState as any,
      applyEnvMap,
      applyEnvPreset: applyEnvPreset as any,
      applyFresnel,
      applyBladeVisibility,
      registry,
      checkbox,
      select,
      slider,
      colorPicker,
      textRow,
      rerender,
    });

    // FX: Inner Glow (pulsing)
    const fxInner = addGroup(rFX, 'Inner Glow');
    checkbox(
      fxInner,
      'Inner Glow',
      fxState.innerGlow.enabled,
      (v) => {
        fxState.innerGlow.enabled = v;
        applyInnerGlow();
        try {
          syncVisibility();
        } catch {}
      },
      () => {},
      'Pulsing fresnel-like inner glow overlay.'
    );
    colorPicker(
      fxInner,
      'Glow Color',
      fxState.innerGlow.color,
      (hex) => {
        fxState.innerGlow.color = hex;
        applyInnerGlow();
      },
      () => {},
      'Inner glow color.'
    );
    slider(
      fxInner,
      'Glow Min',
      0,
      2.0,
      0.01,
      fxState.innerGlow.min,
      (v) => {
        fxState.innerGlow.min = v;
        applyInnerGlow();
      },
      () => {},
      'Minimum intensity.'
    );
    slider(
      fxInner,
      'Glow Max',
      0,
      2.0,
      0.01,
      fxState.innerGlow.max,
      (v) => {
        fxState.innerGlow.max = v;
        applyInnerGlow();
      },
      () => {},
      'Maximum intensity.'
    );
    slider(
      fxInner,
      'Glow Speed',
      0,
      10.0,
      0.01,
      fxState.innerGlow.speed,
      (v) => {
        fxState.innerGlow.speed = v;
        applyInnerGlow();
      },
      () => {},
      'Pulse speed.'
    );

    // FX: Blade Mist
    const fxMist = addGroup(rFX, 'Blade Mist');
    checkbox(
      fxMist,
      'Blade Mist',
      fxState.mist.enabled,
      (v) => {
        fxState.mist.enabled = v;
        applyMist();
        try {
          syncVisibility();
        } catch {}
      },
      () => {},
      'Subtle mist particles rising from blade.'
    );
    colorPicker(
      fxMist,
      'Mist Color',
      fxState.mist.color,
      (hex) => {
        fxState.mist.color = hex;
        applyMist();
      },
      () => {},
      'Mist color.'
    );
    slider(
      fxMist,
      'Mist Density',
      0,
      1.0,
      0.01,
      fxState.mist.density,
      (v) => {
        fxState.mist.density = v;
        applyMist();
      },
      () => {},
      'Particle count factor.'
    );
    slider(
      fxMist,
      'Mist Speed',
      0,
      2.0,
      0.01,
      fxState.mist.speed,
      (v) => {
        fxState.mist.speed = v;
        applyMist();
      },
      () => {},
      'Rise speed.'
    );
    slider(
      fxMist,
      'Mist Spread',
      0,
      0.2,
      0.001,
      fxState.mist.spread,
      (v) => {
        fxState.mist.spread = v;
        applyMist();
      },
      () => {},
      'Horizontal drift factor.'
    );
    slider(
      fxMist,
      'Mist Size',
      1,
      16,
      0.1,
      fxState.mist.size,
      (v) => {
        fxState.mist.size = v;
        applyMist();
      },
      () => {},
      'Sprite size (px-scaled).'
    );
    // Advanced mist shaping
    slider(
      fxMist,
      'Mist Life Rate',
      0.05,
      1.0,
      0.01,
      fxState.mist.lifeRate,
      (v) => {
        fxState.mist.lifeRate = v;
        applyMist();
      },
      () => {},
      'How fast particles age (fade in/out).'
    );
    slider(
      fxMist,
      'Mist Turbulence',
      0.0,
      0.3,
      0.005,
      fxState.mist.turbulence,
      (v) => {
        fxState.mist.turbulence = v;
        applyMist();
      },
      () => {},
      'Wavy drift amplitude.'
    );
    slider(
      fxMist,
      'Wind X',
      -0.5,
      0.5,
      0.01,
      fxState.mist.windX,
      (v) => {
        fxState.mist.windX = v;
        applyMist();
      },
      () => {},
      'Constant push along X.'
    );
    slider(
      fxMist,
      'Wind Z',
      -0.5,
      0.5,
      0.01,
      fxState.mist.windZ,
      (v) => {
        fxState.mist.windZ = v;
        applyMist();
      },
      () => {},
      'Constant push along Z.'
    );
    select(
      fxMist,
      'Emit Region',
      ['base', 'edge', 'tip', 'full'],
      fxState.mist.emission,
      (v) => {
        fxState.mist.emission = v as typeof fxState.mist.emission;
        applyMist();
      },
      () => {},
      'Where to spawn mist.'
    );
    slider(
      fxMist,
      'Size Min Ratio',
      0.0,
      1.0,
      0.01,
      fxState.mist.sizeMinRatio,
      (v) => {
        fxState.mist.sizeMinRatio = v;
        applyMist();
      },
      () => {},
      'Min size as ratio of mist size.'
    );
    checkbox(
      fxMist,
      'Occlude by Blade',
      fxState.mist.occlude,
      (v) => {
        fxState.mist.occlude = v;
        applyMist();
      },
      () => {},
      'When on, mist hides behind geometry.'
    );

    // FX: Flame Aura & Selective Bloom & Heat Haze & Embers
    const fxFlame = addGroup(rFX, 'Flame Aura');
    checkbox(
      fxFlame,
      'Flame Aura',
      fxState.flame.enabled,
      (v) => {
        fxState.flame.enabled = v;
        applyFlame();
        try {
          syncVisibility();
        } catch {}
      },
      () => {},
      'Animated aura overlay around blade.'
    );
    colorPicker(
      fxFlame,
      'Flame Color A',
      fxState.flame.color1,
      (hex) => {
        fxState.flame.color1 = hex;
        applyFlame();
      },
      () => {},
      'Inner flame color.'
    );
    colorPicker(
      fxFlame,
      'Flame Color B',
      fxState.flame.color2,
      (hex) => {
        fxState.flame.color2 = hex;
        applyFlame();
      },
      () => {},
      'Outer flame color.'
    );
    slider(
      fxFlame,
      'Flame Intensity',
      0.0,
      3.0,
      0.01,
      fxState.flame.intensity,
      (v) => {
        fxState.flame.intensity = v;
        applyFlame();
      },
      () => {},
      'Brightness scaling for aura.'
    );
    slider(
      fxFlame,
      'Flame Speed',
      0.0,
      8.0,
      0.01,
      fxState.flame.speed,
      (v) => {
        fxState.flame.speed = v;
        applyFlame();
      },
      () => {},
      'Noise scroll speed.'
    );
    slider(
      fxFlame,
      'Flame NoiseScale',
      0.2,
      8.0,
      0.01,
      fxState.flame.noiseScale,
      (v) => {
        fxState.flame.noiseScale = v;
        applyFlame();
      },
      () => {},
      'Spatial scale of flame noise.'
    );
    slider(
      fxFlame,
      'Flame Scale',
      1.0,
      1.2,
      0.001,
      fxState.flame.scale,
      (v) => {
        fxState.flame.scale = v;
        applyFlame();
      },
      () => {},
      'Mesh scale factor for aura shell.'
    );
    select(
      fxFlame,
      'Flame Direction',
      ['Up', 'Down'],
      fxState.flame.direction,
      (v) => {
        fxState.flame.direction = v as typeof fxState.flame.direction;
        applyFlame();
      },
      () => {},
      'Flow direction along blade. Up = rise; Down = fall.'
    );
    select(
      fxFlame,
      'Flame Blend',
      ['Add', 'Darken', 'Multiply'],
      fxState.flame.blend,
      (v) => {
        fxState.flame.blend = v as typeof fxState.flame.blend;
        applyFlame();
      },
      () => {},
      'Add: bright glow. Darken: normal blend (black flames visible). Multiply: strong darkening.'
    );
    checkbox(
      fxFlame,
      'Selective Bloom',
      fxState.selectiveBloom,
      (v) => {
        fxState.selectiveBloom = v;
        (render as any).setSelectiveBloom?.(v, 1.1, 0.8, 0.35, 1.0);
      },
      () => {},
      'Use bloom only on marked objects.'
    );
    checkbox(
      fxFlame,
      'Heat Haze',
      fxState.heatHaze,
      (v) => {
        fxState.heatHaze = v;
        (render as any).setHeatHaze?.(v, 0.004);
      },
      () => {},
      'Mask-based refractive shimmer.'
    );
    const fxEmbers = addGroup(rFX, 'Embers');
    checkbox(
      fxEmbers,
      'Embers',
      fxState.embers.enabled,
      (v) => {
        fxState.embers.enabled = v;
        applyEmbers();
        try {
          syncVisibility();
        } catch {}
      },
      () => {},
      'Floating sparks/embers.'
    );
    slider(
      fxEmbers,
      'Ember Count',
      10,
      400,
      1,
      fxState.embers.count,
      (v) => {
        fxState.embers.count = v;
        applyEmbers();
      },
      () => {},
      'Number of ember particles.'
    );
    slider(
      fxEmbers,
      'Ember Size',
      1,
      12,
      0.1,
      fxState.embers.size,
      (v) => {
        fxState.embers.size = v;
        applyEmbers();
      },
      () => {},
      'Ember sprite size.'
    );
    colorPicker(
      fxEmbers,
      'Ember Color',
      fxState.embers.color,
      (hex) => {
        fxState.embers.color = hex;
        applyEmbers();
      },
      () => {},
      'Ember tint.'
    );
  }

  // Blade helpers moved to modelPanel (ensureHollow, fuller faces/slots)

  const modelSections = {
    Blade: sections.Blade,
    Guard: sections.Guard,
    Handle: sections.Handle,
    Pommel: sections.Pommel,
    Accessories: sections.Accessories,
  };

  // Rebuild Blade section using extracted Model panel (clears previous Blade rows/groups)
  try {
    const header = modelSections.Blade.querySelector('h2');
    for (const child of Array.from(modelSections.Blade.children)) {
      if (child !== header) modelSections.Blade.removeChild(child);
    }
    attachModelPanel({
      sections: modelSections,
      state,
      defaults,
      helpers: { addGroup, addSubheading, slider, select, checkbox, colorPicker, textRow },
      rerender,
    });
  } catch {}

  // Text Engraving (simple)
  checkbox(
    sections.Engravings,
    'Text Engraving',
    false,
    (v) => {
      const list = ((state.blade as any).engravings || []) as any[];
      const rest = list.filter((e: any) => e.type !== 'text');
      if (v)
        rest.push({
          type: 'text',
          // Use ASCII default to avoid unsupported glyphs rendering as '???'
          content: 'TEST',
          fontUrl:
            'https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json',
          // Safer default sizing so it fits most blades without spilling
          width: 0.10,
          height: 0.02,
          depth: 0.002,
          offsetY: state.blade.length * 0.5,
          offsetX: 0,
          offsetZ: 0,
          rotation: 0,
          side: 'right',
        });
      (state.blade as any).engravings = rest;
      // Keep the edit controls in sync with the actual engraving array
      try {
        syncEngravingControls();
      } catch {}
    },
    rerender,
    'Adds a text engraving (provide font URL and content).'
  );
  // Manage multiple engravings: add/remove/reorder and edit index
  const engrRow = document.createElement('div');
  engrRow.className = 'row full';
  const engrToolbar = document.createElement('div');
  engrToolbar.className = 'toolbar';
  const engrAddBtn = document.createElement('button');
  engrAddBtn.textContent = 'Add Engraving';
  engrAddBtn.onclick = (e) => {
    e.stopPropagation();
    const arr = ((state.blade as any).engravings || []) as any[];
    arr.push({
      type: 'text',
      content: 'TEXT',
      fontUrl: '',
      width: 0.1,
      height: 0.02,
      depth: 0.002,
      offsetY: state.blade.length * 0.5,
      offsetX: 0,
      offsetZ: 0,
      rotation: 0,
      side: 'right',
      align: 'center',
    });
    (state.blade as any).engravings = arr;
    engrIndex = arr.length - 1;
    rerender();
    syncEngravingControls();
  };
  const engrRemoveBtn = document.createElement('button');
  engrRemoveBtn.textContent = 'Remove This';
  engrRemoveBtn.onclick = (e) => {
    e.stopPropagation();
    const arr = ((state.blade as any).engravings || []) as any[];
    if (!arr.length) return;
    if (engrIndex < 0 || engrIndex >= arr.length) return;
    arr.splice(engrIndex, 1);
    (state.blade as any).engravings = arr;
    engrIndex = Math.max(0, Math.min(engrIndex, arr.length - 1));
    rerender();
    syncEngravingControls();
    // If no engravings remain, reflect that in the simple toggle
    if (arr.length === 0) {
      try {
        registry.setValue('engravings', 'Text Engraving', false);
      } catch {}
    }
  };
  const engrUpBtn = document.createElement('button');
  engrUpBtn.textContent = 'Move Up';
  engrUpBtn.onclick = (e) => {
    e.stopPropagation();
    const arr = ((state.blade as any).engravings || []) as any[];
    if (engrIndex > 0) {
      const t = arr[engrIndex];
      arr[engrIndex] = arr[engrIndex - 1];
      arr[engrIndex - 1] = t;
      engrIndex--;
      (state.blade as any).engravings = arr;
      rerender();
      syncEngravingControls();
    }
  };
  const engrDownBtn = document.createElement('button');
  engrDownBtn.textContent = 'Move Down';
  engrDownBtn.onclick = (e) => {
    e.stopPropagation();
    const arr = ((state.blade as any).engravings || []) as any[];
    if (engrIndex < arr.length - 1) {
      const t = arr[engrIndex];
      arr[engrIndex] = arr[engrIndex + 1];
      arr[engrIndex + 1] = t;
      engrIndex++;
      (state.blade as any).engravings = arr;
      rerender();
      syncEngravingControls();
    }
  };
  engrToolbar.appendChild(engrAddBtn);
  engrToolbar.appendChild(engrRemoveBtn);
  engrToolbar.appendChild(engrUpBtn);
  engrToolbar.appendChild(engrDownBtn);
  engrRow.appendChild(engrToolbar);
  sections.Engravings.appendChild(engrRow);
  let engrIndex = 0;
  const getEngr = () => {
    const arr = ((state.blade as any).engravings || []) as any[];
    if (!arr.length) return null;
    if (engrIndex >= arr.length) engrIndex = arr.length - 1;
    return arr[engrIndex];
  };
  const engrFields = {
    index: '',
    type: '',
    text: '',
    font: '',
    width: '',
    height: '',
    depth: '',
    spacing: '',
    offsetY: '',
    offsetX: '',
    rotY: '',
    side: '',
    align: '',
  };
  const engrContent = addGroup(sections.Engravings, 'Engraving Content');
  const engrTransform = addGroup(sections.Engravings, 'Engraving Placement');
  engrFields.index = slider(
    engrContent,
    'Engrave Index',
    0,
    10,
    1,
    0,
    (v) => {
      engrIndex = Math.max(0, Math.round(v));
      syncEngravingControls();
    },
    () => {},
    'Which engraving to edit (0..N-1).'
  );
  engrFields.type = select(
    engrContent,
    'Engrave Type',
    ['text', 'shape', 'decal'],
    'text',
    (v) => {
      const e = getEngr();
      if (!e) return;
      e.type = v;
      rerender();
    },
    () => {},
    'Type of engraving primitive.'
  );
  engrFields.text = textRow(
    engrContent,
    'Engrave Text',
    'TEST',
    (v) => {
      const e = getEngr();
      if (!e) return;
      e.content = v;
      rerender();
    },
    'Unicode supported by the chosen font.'
  );
  engrFields.font = textRow(
    engrContent,
    'Font URL',
    'https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json',
    (v) => {
      const e = getEngr();
      if (!e) return;
      e.fontUrl = v;
      rerender();
    },
    'Typeface JSON URL (typeface.js format). For full Unicode, supply a suitable font.'
  );
  engrFields.width = slider(
    engrTransform,
    'Engrave Width',
    0.02,
    0.6,
    0.001,
    0.18,
    (val) => {
      const e = getEngr();
      if (!e) return;
      e.width = val;
      rerender();
    },
    rerender,
    'Max width of text region.'
  );
  engrFields.height = slider(
    engrTransform,
    'Engrave Height',
    0.005,
    0.1,
    0.001,
    0.03,
    (val) => {
      const e = getEngr();
      if (!e) return;
      e.height = val;
      rerender();
    },
    rerender,
    'Text letter height.'
  );
  engrFields.depth = slider(
    engrTransform,
    'Engrave Depth',
    0.0005,
    0.02,
    0.0005,
    0.002,
    (val) => {
      const e = getEngr();
      if (!e) return;
      e.depth = val;
      rerender();
    },
    rerender,
    'Extrusion depth of the engraving.'
  );
  engrFields.spacing = slider(
    engrTransform,
    'Letter Spacing',
    0,
    0.3,
    0.005,
    0.05,
    (val) => {
      const e = getEngr();
      if (!e) return;
      (e as any).letterSpacing = val;
      rerender();
    },
    rerender,
    'Additional spacing between characters (in letter heights).'
  );
  engrFields.offsetY = slider(
    engrTransform,
    'Engrave OffsetY',
    0,
    1,
    0.001,
    0.5,
    (val) => {
      const e = getEngr();
      if (!e) return;
      e.offsetY = state.blade.length * val;
      rerender();
    },
    rerender,
    'Position along blade length (0..1).'
  );
  engrFields.offsetX = slider(
    engrTransform,
    'Engrave OffsetX',
    -0.4,
    0.4,
    0.001,
    0,
    (val) => {
      const e = getEngr();
      if (!e) return;
      e.offsetX = val;
      rerender();
    },
    rerender,
    'Lateral offset across blade width.'
  );
  engrFields.offsetZ = slider(
    engrTransform,
    'Engrave OffsetZ',
    -0.02,
    0.02,
    0.0005,
    0,
    (val) => {
      const e = getEngr();
      if (!e) return;
      (e as any).offsetZ = val;
      rerender();
    },
    rerender,
    'Positive sinks into blade (depth bias); negative lifts outward.'
  );
  engrFields.rotY = slider(
    engrTransform,
    'Engrave RotY',
    -180,
    180,
    1,
    0,
    (deg) => {
      const e = getEngr();
      if (!e) return;
      e.rotation = (deg * Math.PI) / 180;
      rerender();
    },
    rerender,
    'Rotation around Y axis (deg).'
  );
  engrFields.side = select(
    engrTransform,
    'Engrave Side',
    ['left', 'right', 'both'],
    'right',
    (v) => {
      const e = getEngr();
      if (!e) return;
      e.side = v;
      rerender();
    },
    rerender,
    'Which blade face.'
  );
  engrFields.align = select(
    engrTransform,
    'Text Align',
    ['left', 'center', 'right'],
    'center',
    (v) => {
      const e = getEngr();
      if (!e) return;
      e.align = v as any;
      rerender();
    },
    rerender,
    'Horizontal alignment for text.'
  );

  function syncEngravingControls() {
    const arr = ((state.blade as any).engravings || []) as any[];
    const bladeLen = state.blade.length || 1;
    if (!arr.length) {
      engrIndex = 0;
      registry.setValue('engravings', 'Engrave Index', 0);
      registry.setValue('engravings', 'Engrave Type', 'text');
      registry.setValue('engravings', 'Engrave Text', '');
      registry.setValue('engravings', 'Font URL', '');
      registry.setValue('engravings', 'Engrave Width', 0.18);
      registry.setValue('engravings', 'Engrave Height', 0.03);
      registry.setValue('engravings', 'Engrave Depth', 0.002);
      registry.setValue('engravings', 'Letter Spacing', 0);
      registry.setValue('engravings', 'Engrave OffsetY', 0.5);
      registry.setValue('engravings', 'Engrave OffsetX', 0);
      registry.setValue('engravings', 'Engrave RotY', 0);
      registry.setValue('engravings', 'Engrave Side', 'right');
      registry.setValue('engravings', 'Text Align', 'center');
      return;
    }
    if (engrIndex >= arr.length) engrIndex = arr.length - 1;
    if (engrIndex < 0) engrIndex = 0;
    const e = arr[engrIndex] || {};
    registry.setValue('engravings', 'Engrave Index', engrIndex);
    registry.setValue('engravings', 'Engrave Type', e.type ?? 'text');
    registry.setValue('engravings', 'Engrave Text', e.content ?? '');
    registry.setValue('engravings', 'Font URL', e.fontUrl ?? '');
    registry.setValue('engravings', 'Engrave Width', e.width ?? 0.18);
    registry.setValue('engravings', 'Engrave Height', e.height ?? 0.03);
    registry.setValue('engravings', 'Engrave Depth', e.depth ?? 0.002);
    registry.setValue('engravings', 'Letter Spacing', e.letterSpacing ?? 0);
    registry.setValue('engravings', 'Engrave OffsetY', (e.offsetY ?? bladeLen * 0.5) / bladeLen);
    registry.setValue('engravings', 'Engrave OffsetX', e.offsetX ?? 0);
    registry.setValue('engravings', 'Engrave OffsetZ', (e as any).offsetZ ?? 0);
    registry.setValue('engravings', 'Engrave RotY', ((e.rotation ?? 0) * 180) / Math.PI);
    registry.setValue('engravings', 'Engrave Side', e.side ?? 'right');
    registry.setValue('engravings', 'Text Align', e.align ?? 'center');
  }

  syncEngravingControls();
  // Rebuild Guard section using extracted Model panel (clear then attach)
  try {
    const headerG = modelSections.Guard.querySelector('h2');
    for (const child of Array.from(modelSections.Guard.children)) {
      if (child !== headerG) modelSections.Guard.removeChild(child);
    }
    attachGuardControls({
      sections: modelSections,
      state,
      helpers: { addGroup, addSubheading, slider, select, checkbox, colorPicker, textRow },
      rerender,
    });
  } catch {}

  // Handle controls moved to modelPanel
  try {
    const headerH = modelSections.Handle.querySelector('h2');
    for (const child of Array.from(modelSections.Handle.children)) {
      if (child !== headerH) modelSections.Handle.removeChild(child);
    }
    attachHandleControls({
      sections: modelSections,
      state,
      helpers: { addGroup, addSubheading, slider, select, checkbox, colorPicker, textRow },
      rerender,
      syncUi,
    });
  } catch {}

  // Pommel controls moved to modelPanel
  try {
    const headerP = modelSections.Pommel.querySelector('h2');
    for (const child of Array.from(modelSections.Pommel.children)) {
      if (child !== headerP) modelSections.Pommel.removeChild(child);
    }
    attachPommelControls({
      sections: modelSections,
      state,
      helpers: { addGroup, addSubheading, slider, select, checkbox, colorPicker, textRow },
      rerender,
    });
  } catch {}

  // Accessories controls moved to modelPanel
  try {
    const headerA = modelSections.Accessories.querySelector('h2');
    for (const child of Array.from(modelSections.Accessories.children)) {
      if (child !== headerA) modelSections.Accessories.removeChild(child);
    }
    attachAccessoryControls({
      sections: modelSections,
      state,
      defaults,
      helpers: { addGroup, addSubheading, slider, select, checkbox, colorPicker, textRow },
      rerender,
    });
  } catch {}

  // Other controls
  // Taper ratio helper: 0 => tip equals base; 1 => tip tapers to 0
  slider(
    sections.Other,
    'Taper Ratio',
    0,
    1,
    0.01,
    state.blade.baseWidth > 0 ? 1 - state.blade.tipWidth / state.blade.baseWidth : 0,
    (v) => {
      state.blade.tipWidth = Math.max(0, state.blade.baseWidth * (1 - v));
    },
    rerender,
    '0 = no taper, 1 = tip at 0 width'
  );
  slider(
    sections.Other,
    'Stylization',
    0,
    1,
    0.01,
    (state as any).styleFactor ?? 0,
    (v) => ((state as any).styleFactor = v),
    rerender,
    'Exaggerates proportions (guard width, curvature, pommel size).'
  );
  slider(
    sections.Other,
    'Blade Detail',
    16,
    512,
    1,
    state.blade.sweepSegments ?? 128,
    (v) => (state.blade.sweepSegments = Math.round(v)),
    rerender,
    'Controls blade tessellation along its length.'
  );
  // Proportional ratios (see newfeatures.md §6)
  checkbox(
    sections.Other,
    'Use Ratios',
    (state as any).useRatios ?? false,
    (v) => ((state as any).useRatios = v),
    rerender,
    'Drive key sizes from blade length.'
  );
  slider(
    sections.Other,
    'Guard:Blade',
    0.1,
    0.8,
    0.01,
    (state as any).ratios?.guardWidthToBlade ?? 0.35,
    (v) => {
      (state as any).ratios = { ...(state as any).ratios, guardWidthToBlade: v };
    },
    rerender,
    'Guard width = v * blade.length'
  );
  slider(
    sections.Other,
    'Handle:Blade',
    0.1,
    0.6,
    0.01,
    (state as any).ratios?.handleLengthToBlade ?? 0.3,
    (v) => {
      (state as any).ratios = { ...(state as any).ratios, handleLengthToBlade: v };
    },
    rerender,
    'Handle length = v * blade.length'
  );
  slider(
    sections.Other,
    'Pommel:Blade',
    0.01,
    0.2,
    0.001,
    (state as any).ratios?.pommelSizeToBlade ?? 0.05,
    (v) => {
      (state as any).ratios = { ...(state as any).ratios, pommelSizeToBlade: v };
    },
    rerender,
    'Pommel size = v * blade.length'
  );

  // Presets handling
  presetSel.addEventListener('change', () => {
    const selected = presetSel.value;
    if (selected === 'custom') return;
    const entry = swordPresets.find((preset) => preset.id === selected);
    if (!entry) return;

    const next = entry.build();
    assignParams(state, next);
    matPart = 'blade';

    applyVisualOverrides(entry);

    for (const part of PARTS) {
      const base = JSON.parse(JSON.stringify(matDefaults[part])) as MatExt;
      const overrides = entry.materials?.[part];
      const merged = overrides ? { ...base, ...overrides } : base;
      matState[part] = merged;
      applyMaterialStateToRenderer(part, merged);
    }

    looksState.currentVariantId = null;
    looksState.baseSnapshot = null;
    looksState.matVariants.splice(0, looksState.matVariants.length);
    if (entry.variants?.length) {
      for (const variant of entry.variants) {
        const variantId =
          variant.id ??
          `${entry.id}-${
            variant.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '') || 'alt'
          }`;
        const parts: Partial<Record<Part, MatExt>> = {};
        for (const part of PARTS) {
          const baseMaterial = entry.materials?.[part]
            ? { ...JSON.parse(JSON.stringify(matDefaults[part])), ...entry.materials[part]! }
            : JSON.parse(JSON.stringify(matDefaults[part]));
          const overrides = variant.parts[part];
          if (overrides) {
            parts[part] = { ...baseMaterial, ...overrides } as MatExt;
          }
        }
        if (Object.keys(parts).length) {
          looksState.matVariants.push({
            id: variantId,
            name: variant.name,
            description: variant.description,
            parts,
          });
        }
      }
    }

    renderVariantList();
    syncLookDropdown();

    if (render) {
      if (entry.render) {
        const R = entry.render;
        if (R.exposure !== undefined) {
          rstate.exposure = R.exposure;
          render.setExposure(R.exposure);
        }
        if (R.ambient !== undefined) {
          rstate.ambient = R.ambient;
          render.setAmbient(R.ambient);
        }
        if (R.keyIntensity !== undefined) {
          rstate.keyIntensity = R.keyIntensity;
          render.setKeyIntensity(R.keyIntensity);
        }
        if (R.keyAz !== undefined || R.keyEl !== undefined) {
          rstate.keyAz = R.keyAz ?? rstate.keyAz;
          rstate.keyEl = R.keyEl ?? rstate.keyEl;
          render.setKeyAngles(rstate.keyAz, rstate.keyEl);
        }
        if (R.rimIntensity !== undefined) {
          rstate.rimIntensity = R.rimIntensity;
          render.setRimIntensity(R.rimIntensity);
        }
        if (R.rimAz !== undefined || R.rimEl !== undefined) {
          rstate.rimAz = R.rimAz ?? rstate.rimAz;
          rstate.rimEl = R.rimEl ?? rstate.rimEl;
          render.setRimAngles(rstate.rimAz, rstate.rimEl);
        }
        if (R.rimColor !== undefined) {
          rstate.rimColor = R.rimColor;
          render.setRimColor(parseInt(R.rimColor.replace('#', '0x')));
        }
        if (
          R.bloomEnabled !== undefined ||
          R.bloomStrength !== undefined ||
          R.bloomThreshold !== undefined ||
          R.bloomRadius !== undefined
        ) {
          if (R.bloomEnabled !== undefined) rstate.bloomEnabled = R.bloomEnabled;
          if (R.bloomStrength !== undefined) rstate.bloomStrength = R.bloomStrength;
          if (R.bloomThreshold !== undefined) rstate.bloomThreshold = R.bloomThreshold;
          if (R.bloomRadius !== undefined) rstate.bloomRadius = R.bloomRadius;
          render.setBloom(
            rstate.bloomEnabled,
            rstate.bloomStrength,
            rstate.bloomThreshold,
            rstate.bloomRadius
          );
        }
        const envIntensityValue = (R as any).envMapIntensity ?? (R as any).envIntensity;
        if (envIntensityValue !== undefined) {
          rstate.envMapIntensity = envIntensityValue;
          render.setEnvIntensity(envIntensityValue);
        }
        if (R.bgBrightness !== undefined) {
          rstate.bgBrightness = R.bgBrightness;
          render.setBackgroundBrightness(R.bgBrightness);
        }
        if (R.bgColor !== undefined) {
          rstate.bgColor = R.bgColor;
          render.setBackgroundColor(parseInt(R.bgColor.replace('#', '0x')));
        }
      }
      renderVariantList();
    }

    rerender();
    syncUi();
  });
  btnSave.addEventListener('click', () => {
    localStorage.setItem('bladegen.preset.custom', JSON.stringify(state));
    presetSel.value = 'custom';
  });
  btnRandom.addEventListener('click', () => {
    randomize(state, false);
    rerender();
    syncUi();
  });
  btnRandomSafe.addEventListener('click', () => {
    randomize(state, true);
    rerender();
    syncUi();
  });
  // Export helpers for dropdown
  const doExportGLB = async () => {
    try {
      await exportGLB(sword, looksState.matVariants);
    } catch (e) {
      console.error('GLB export error', e);
    }
  };
  const doExportOBJ = () => { exportOBJ(sword); };
  const doExportSTL = () => { exportSTL(sword); };
  const doExportSVG = () => exportSVG(state);
  const doExportJSON = () =>
    exportJSON(state, rstate as any, matState, looksState.matVariants, looksState.currentVariantId);
  // Dropdown interactions
  btnExportMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = exportMenu.style.display === 'block';
    exportMenu.style.display = isOpen ? 'none' : 'block';
  });
  document.addEventListener('click', () => {
    exportMenu.style.display = 'none';
  });
  menuGLB.addEventListener('click', () => {
    exportMenu.style.display = 'none';
    doExportGLB();
  });
  menuOBJ.addEventListener('click', () => {
    exportMenu.style.display = 'none';
    doExportOBJ();
  });
  menuSTL.addEventListener('click', () => {
    exportMenu.style.display = 'none';
    doExportSTL();
  });
  menuSVG.addEventListener('click', () => {
    exportMenu.style.display = 'none';
    doExportSVG();
  });
  menuJSON.addEventListener('click', () => {
    exportMenu.style.display = 'none';
    doExportJSON();
  });
  btnImportJSON.addEventListener('click', () => fileJSON.click());
  fileJSON.addEventListener('change', async () => {
    const f = fileJSON.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const obj = JSON.parse(text);
      // Validate against JSON Schema using Ajv
      try {
        const schemaUrl = obj?.$schema || 'schema/sword.schema.json';
        const res = await fetch(schemaUrl);
        const schema = await res.json();
        const { default: Ajv2020 } = await import('ajv/dist/2020');
        const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
        const validate = ajv.compile(schema);
        const valid = validate(obj);
        const dbgWin = window as typeof window & { __swordDebug?: Record<string, unknown> };
        const swordDebug = (dbgWin.__swordDebug = dbgWin.__swordDebug ?? {});
        swordDebug.lastImportValid = valid;
        swordDebug.lastImportErrors = valid ? null : validate.errors || [];
        if (!valid) {
          const errs = (validate.errors || [])
            .map((e: any) => `- ${e.instancePath || e.schemaPath}: ${e.message}`)
            .join('\n');
          alert('Import failed: JSON does not match schema.\n' + errs);
          return;
        }
      } catch (e) {
        console.warn('Schema validation skipped or failed to load:', e);
      }
      if (obj?.model) {
        assignParams(state, obj.model);
        rerender();
      }
      if (obj?.materials) {
        const parts: Part[] = [...PARTS];
        for (const part of parts) {
          const m = obj.materials[part];
          if (!m) continue;
          matState[part] = { ...matState[part], ...m };
          applyMaterialStateToRenderer(part, matState[part]);
        }
        looksState.currentVariantId = null;
        looksState.baseSnapshot = null;
        looksState.matVariants.splice(0, looksState.matVariants.length);
        if (Array.isArray(obj.materials.variants)) {
          for (const entry of obj.materials.variants) {
            if (!entry || typeof entry !== 'object' || typeof entry.name !== 'string') continue;
            const partsMap: Partial<Record<Part, MatExt>> = {};
            for (const part of parts) {
              const source = entry.parts?.[part];
              if (!source) continue;
              partsMap[part] = JSON.parse(JSON.stringify({ ...matDefaults[part], ...source }));
            }
            if (!Object.keys(partsMap).length) continue;
            looksState.matVariants.push({
              id:
                typeof entry.id === 'string'
                  ? entry.id
                  : `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: entry.name,
              description: typeof entry.description === 'string' ? entry.description : undefined,
              parts: partsMap,
            });
          }
        }
        renderVariantList();
        const activeVariantId =
          typeof obj.materials.activeVariant === 'string' ? obj.materials.activeVariant : null;
        if (activeVariantId) {
          applyLook(activeVariantId);
        } else {
          looksState.currentVariantId = null;
          looksState.baseSnapshot = null;
          syncLookDropdown();
        }
      }
      if (obj?.render && render) {
        const R = obj.render;
        const col = typeof R.bgColor === 'string' ? hexToInt(R.bgColor) : undefined;
        if (typeof R.exposure === 'number') {
          rstate.exposure = R.exposure;
          render.setExposure(R.exposure);
        }
        if (typeof R.ambient === 'number') {
          rstate.ambient = R.ambient;
          render.setAmbient(R.ambient);
        }
        if (typeof R.keyIntensity === 'number') {
          rstate.keyIntensity = R.keyIntensity;
          render.setKeyIntensity(R.keyIntensity);
        }
        if (typeof R.keyAz === 'number' || typeof R.keyEl === 'number') {
          rstate.keyAz = R.keyAz ?? rstate.keyAz;
          rstate.keyEl = R.keyEl ?? rstate.keyEl;
          render.setKeyAngles(rstate.keyAz, rstate.keyEl);
        }
        if (typeof R.rimIntensity === 'number') {
          rstate.rimIntensity = R.rimIntensity;
          render.setRimIntensity(R.rimIntensity);
        }
        if (typeof R.rimAz === 'number' || typeof R.rimEl === 'number') {
          rstate.rimAz = R.rimAz ?? rstate.rimAz;
          rstate.rimEl = R.rimEl ?? rstate.rimEl;
          render.setRimAngles(rstate.rimAz, rstate.rimEl);
        }
        if (typeof R.rimColor === 'string') {
          rstate.rimColor = R.rimColor;
          render.setRimColor(hexToInt(R.rimColor));
        }
        if (typeof R.bgBrightness === 'number') {
          rstate.bgBrightness = R.bgBrightness;
          render.setBackgroundBrightness(R.bgBrightness);
        }
        if (typeof col === 'number') {
          rstate.bgColor = R.bgColor;
          render.setBackgroundColor(col);
        }
        if (
          typeof R.bloomEnabled === 'boolean' ||
          typeof R.bloomStrength === 'number' ||
          typeof R.bloomThreshold === 'number' ||
          typeof R.bloomRadius === 'number'
        ) {
          rstate.bloomEnabled = R.bloomEnabled ?? rstate.bloomEnabled;
          rstate.bloomStrength = R.bloomStrength ?? rstate.bloomStrength;
          rstate.bloomThreshold = R.bloomThreshold ?? rstate.bloomThreshold;
          rstate.bloomRadius = R.bloomRadius ?? rstate.bloomRadius;
          render.setBloom(
            rstate.bloomEnabled,
            rstate.bloomStrength,
            rstate.bloomThreshold,
            rstate.bloomRadius
          );
        }
      }
      syncUi();
    } catch (e) {
      console.error('Import JSON failed', e);
    } finally {
      fileJSON.value = '';
    }
  });

  const updateWarnings = () => {
    const w: string[] = [];
    const blade = state.blade;
    const guard = state.guard;
    const handle = state.handle;
    // Clear existing inline warn styles
    registry.clearWarnings();
    // General proportion hints
    if (guard.width > blade.length) {
      w.push('Guard very wide vs. blade length');
      registry.setWarning('guard', 'Guard Width', true, 'Guard width is large vs. blade length');
    }
    if (handle.length > blade.length * 0.8) {
      w.push('Handle unusually long for blade');
      registry.setWarning(
        'handle',
        'Handle Length',
        true,
        'Handle length is large relative to blade'
      );
    }
    if (blade.tipWidth > blade.baseWidth * 0.8) {
      w.push('Tip width close to base width');
      registry.setWarning('blade', 'Tip Width', true, 'Tip nearly as wide as base');
    }
    // Serration sanity
    const serrL = blade.serrationAmplitudeLeft ?? blade.serrationAmplitude ?? 0;
    const serrR = blade.serrationAmplitudeRight ?? blade.serrationAmplitude ?? 0;
    const serrMax = Math.max(serrL, serrR);
    if (serrMax > blade.baseWidth * 0.2) {
      w.push('Serration amplitude high for base width');
      registry.setWarning(
        'blade',
        'Serration Left',
        serrL > blade.baseWidth * 0.2,
        'Left serration amplitude is high'
      );
      registry.setWarning(
        'blade',
        'Serration Right',
        serrR > blade.baseWidth * 0.2,
        'Right serration amplitude is high'
      );
    }
    // Disabled/ineffective controls hints (Blade)
    const hamonOn = !!blade.hamonEnabled;
    registry.setWarning('blade', 'Hamon Width', !hamonOn, 'Enable Hamon to see effect');
    registry.setWarning('blade', 'Hamon Amp', !hamonOn, 'Enable Hamon to see effect');
    registry.setWarning('blade', 'Hamon Freq', !hamonOn, 'Enable Hamon to see effect');
    registry.setWarning('blade', 'Hamon Side', !hamonOn, 'Enable Hamon to see effect');
    // Leaf bulge only for leaf tip
    registry.setWarning(
      'blade',
      'Leaf Bulge',
      (blade.tipShape ?? 'pointed') !== 'leaf',
      'Only affects Leaf tip shape'
    );
    // False edge coupling
    const feLen = (blade as any).falseEdgeLength ?? 0;
    const feDepth = (blade as any).falseEdgeDepth ?? 0;
    registry.setWarning(
      'blade',
      'False Edge Depth',
      feLen <= 0,
      'Set False Edge % > 0 for depth to do anything'
    );
    registry.setWarning(
      'blade',
      'False Edge %',
      feDepth <= 0 && feLen > 0,
      'Depth is 0; no visible effect'
    );
    // Sori disabled when curvature ~ 0
    const curvZero = Math.abs(blade.curvature || 0) < 1e-6;
    registry.setWarning(
      'blade',
      'Sori Profile',
      curvZero,
      'Curvature is 0; profile has no visible effect'
    );
    registry.setWarning(
      'blade',
      'Sori Bias',
      curvZero,
      'Curvature is 0; bias has no visible effect'
    );
    // Fullers dependencies
    const fEnabled = !!blade.fullerEnabled;
    const fLen = blade.fullerLength ?? 0;
    const fMode = blade.fullerMode ?? 'overlay';
    const fDepth = blade.fullerDepth ?? 0;
    const fInset = blade.fullerInset ?? fDepth;
    const noFuller = !fEnabled || fLen <= 0;
    registry.setWarning('blade', 'Fuller Count', noFuller, 'Enable Fullers and set Length > 0');
    registry.setWarning('blade', 'Fuller Length', !fEnabled, 'Enable Fullers');
    registry.setWarning('blade', 'Fuller Mode', !fEnabled, 'Enable Fullers');
    registry.setWarning(
      'blade',
      'Fuller Depth',
      !fEnabled || fMode !== 'overlay' || (fMode === 'overlay' && (fLen <= 0 || fDepth <= 0)),
      fMode === 'overlay'
        ? 'Enable Fullers, Length > 0, set Depth > 0'
        : 'Depth is used only in Overlay mode'
    );
    registry.setWarning(
      'blade',
      'Fuller Profile',
      !fEnabled || fMode !== 'carve' || (fMode === 'carve' && fLen <= 0),
      fMode === 'carve' ? 'Set Length > 0' : 'Profile is used only in Carve mode'
    );
    registry.setWarning(
      'blade',
      'Fuller Width',
      !fEnabled || fMode !== 'carve' || (fMode === 'carve' && fLen <= 0),
      fMode === 'carve' ? 'Set Length > 0 to see carving width' : 'Width is used only in Carve mode'
    );
    registry.setWarning(
      'blade',
      'Fuller Inset',
      !fEnabled || fMode !== 'carve' || (fMode === 'carve' && (fLen <= 0 || fInset <= 0)),
      fMode === 'carve'
        ? 'Set Length > 0 and Inset > 0 to carve'
        : 'Inset is used only in Carve mode'
    );
    // Engravings
    const engr = ((state.blade as any).engravings || []) as any[];
    const engrEmpty = engr.length === 0;
    const engrLabels = [
      'Engrave Index',
      'Engrave Type',
      'Engrave Text',
      'Font URL',
      'Engrave Width',
      'Engrave Height',
      'Engrave Depth',
      'Letter Spacing',
      'Engrave OffsetY',
      'Engrave OffsetX',
      'Engrave RotY',
      'Engrave Side',
      'Text Align',
    ];
    engrLabels.forEach((lab) =>
      registry.setWarning('engravings', lab, engrEmpty, 'No engravings — add one first')
    );
    // Render dependent warnings
    registry.setWarning(
      'render-post',
      'Bloom Strength',
      !rstate.bloomEnabled,
      'Enable Bloom to see effect'
    );
    registry.setWarning(
      'render-post',
      'Bloom Threshold',
      !rstate.bloomEnabled,
      'Enable Bloom to see effect'
    );
    registry.setWarning(
      'render-post',
      'Bloom Radius',
      !rstate.bloomEnabled,
      'Enable Bloom to see effect'
    );
    registry.setWarning(
      'render-post',
      'Outline Strength',
      !postState.outlineEnabled,
      'Enable Outline to see effect'
    );
    registry.setWarning(
      'render-post',
      'Outline Thickness',
      !postState.outlineEnabled,
      'Enable Outline to see effect'
    );
    registry.setWarning(
      'render-post',
      'Outline Color',
      !postState.outlineEnabled,
      'Enable Outline to see effect'
    );
    registry.setWarning(
      'render-post',
      'Ink Thickness',
      !postState.inkEnabled,
      'Enable Ink Outline to see effect'
    );
    registry.setWarning(
      'render-post',
      'Ink Color',
      !postState.inkEnabled,
      'Enable Ink Outline to see effect'
    );
    registry.setWarning(
      'render-post',
      'Vignette Strength',
      !postState.vignetteEnabled,
      'Enable Vignette to see effect'
    );
    registry.setWarning(
      'render-post',
      'Vignette Softness',
      !postState.vignetteEnabled,
      'Enable Vignette to see effect'
    );
    if (!rstate.postFxEnabled) {
      w.push('Post FX pipeline disabled: bloom, outline, ink and vignette are skipped.');
      registry.setWarning(
        'render-quality-exposure',
        'Post FX Pipeline',
        true,
        'Enable to restore bloom, outline, ink outline, vignette and selective FX.'
      );
      if (rstate.bloomEnabled) {
        registry.setWarning('render-post', 'Bloom Enabled', true, 'Post FX Pipeline is disabled');
      }
      if (postState.outlineEnabled) {
        registry.setWarning('render-post', 'Outline Enabled', true, 'Post FX Pipeline is disabled');
      }
      if (postState.inkEnabled) {
        registry.setWarning('render-post', 'Ink Outline', true, 'Post FX Pipeline is disabled');
      }
      if (postState.vignetteEnabled) {
        registry.setWarning('render-post', 'Vignette', true, 'Post FX Pipeline is disabled');
      }
    }
    registry.setWarning(
      'render-blade-gradient',
      'Grad Base',
      !postState.bladeGradientEnabled,
      'Enable Blade Gradient to see effect'
    );
    registry.setWarning(
      'render-blade-gradient',
      'Grad Edge',
      !postState.bladeGradientEnabled,
      'Enable Blade Gradient to see effect'
    );
    registry.setWarning(
      'render-blade-gradient',
      'Grad Edge Fade',
      !postState.bladeGradientEnabled,
      'Enable Blade Gradient to see effect'
    );
    registry.setWarning(
      'render-blade-gradient',
      'Wear Intensity',
      !postState.bladeGradientEnabled,
      'Enable Blade Gradient to see effect'
    );
    warningsBox.innerHTML = w.length
      ? ('Warnings:\n- ' + w.join('\n- ')).replace(/\n/g, '<br/>')
      : 'No warnings';
  };
  // Dependency-based visibility helpers
  const rowFor = (field: string | undefined) =>
    field ? (el.querySelector(`[data-field="${field}"]`) as HTMLElement | null) : null;
  const toggleRow = (section: string, label: string, visible: boolean, tag?: string) => {
    const field = registry.getField(section, label);
    const row = rowFor(field);
    if (!row) return;
    row.style.display = visible ? '' : 'none';
    if (tag) {
      const prev = row.dataset.tags || '';
      if (!prev.split(',').includes(tag)) row.dataset.tags = prev ? `${prev},${tag}` : tag;
    }
  };
  const syncVisibility = () => {
    // Blade dependencies
    const blade = state.blade as any;
    const hamonOn = !!blade.hamonEnabled;
    toggleRow('blade', 'Hamon Width', hamonOn, 'dep:hamon');
    toggleRow('blade', 'Hamon Amp', hamonOn, 'dep:hamon');
    toggleRow('blade', 'Hamon Freq', hamonOn, 'dep:hamon');
    toggleRow('blade', 'Hamon Side', hamonOn, 'dep:hamon');
    toggleRow('blade', 'Leaf Bulge', (blade.tipShape ?? 'pointed') === 'leaf', 'dep:leaf');
    toggleRow('blade', 'Kris Waves', (blade.family ?? 'straight') === 'kris', 'dep:kris');
    const curvZero = Math.abs(blade.curvature || 0) < 1e-6;
    toggleRow('blade', 'Sori Profile', !curvZero, 'dep:curvature');
    toggleRow('blade', 'Sori Bias', !curvZero, 'dep:curvature');
    const feLen = blade.falseEdgeLength ?? 0;
    toggleRow('blade', 'False Edge Depth', feLen > 0, 'dep:false-edge');
    // Fullers
    const fEnabled = !!blade.fullerEnabled;
    const fMode = blade.fullerMode ?? 'overlay';
    toggleRow('blade', 'Fuller Count', fEnabled, 'dep:fuller');
    toggleRow('blade', 'Fuller Length', fEnabled, 'dep:fuller');
    toggleRow('blade', 'Fuller Mode', fEnabled, 'dep:fuller');
    toggleRow('blade', 'Fuller Depth', fEnabled && fMode === 'overlay', 'dep:fuller:overlay');
    toggleRow('blade', 'Fuller Profile', fEnabled && fMode === 'carve', 'dep:fuller:carve');
    toggleRow('blade', 'Fuller Inset', fEnabled && fMode === 'carve', 'dep:fuller:carve');
    // Per-face fuller row gating
    const faces = blade.fullerFaces || ({} as any);
    const faceEnabled = (side: 'left' | 'right', idx: number) =>
      !!(faces[side] && faces[side][idx]);
    for (let i = 0; i < 3; i++) {
      const onL = faceEnabled('left', i);
      toggleRow('blade', `Left F${i + 1} Width`, onL, 'dep:fuller:left');
      toggleRow('blade', `Left F${i + 1} Offset`, onL, 'dep:fuller:left');
      toggleRow('blade', `Left F${i + 1} Taper`, onL, 'dep:fuller:left');
      const onR = faceEnabled('right', i);
      toggleRow('blade', `Right F${i + 1} Width`, onR, 'dep:fuller:right');
      toggleRow('blade', `Right F${i + 1} Offset`, onR, 'dep:fuller:right');
      toggleRow('blade', `Right F${i + 1} Taper`, onR, 'dep:fuller:right');
    }
    // Hollow Grind
    const hg = (blade as any).hollowGrind;
    const hgOn = !!(hg && hg.enabled);
    toggleRow('blade', 'Hollow Mix', hgOn, 'dep:hollow');
    toggleRow('blade', 'Hollow Depth', hgOn, 'dep:hollow');
    toggleRow('blade', 'Hollow Radius', hgOn, 'dep:hollow');
    toggleRow('blade', 'Hollow Bias', hgOn, 'dep:hollow');

    // Guard dependencies
    const guard = state.guard as any;
    toggleRow('guard', 'Fillet Style', (guard.guardBlendFillet ?? 0) > 0, 'dep:fillet');
    const hasSideRings = (guard.extras ?? []).some((e: any) => e?.kind === 'sideRing');
    toggleRow('guard', 'Ring Radius', hasSideRings, 'dep:side-rings');
    toggleRow('guard', 'Ring Thick', hasSideRings, 'dep:side-rings');
    toggleRow('guard', 'Ring OffsetY', hasSideRings, 'dep:side-rings');
    const hasLoops = (guard.extras ?? []).some((e: any) => e?.kind === 'loop');
    toggleRow('guard', 'Loop Radius', hasLoops, 'dep:loops');
    toggleRow('guard', 'Loop Thick', hasLoops, 'dep:loops');
    toggleRow('guard', 'Loop OffsetY', hasLoops, 'dep:loops');
    toggleRow('guard', 'Habaki Height', !!guard.habakiEnabled, 'dep:habaki');
    toggleRow('guard', 'Habaki Margin', !!guard.habakiEnabled, 'dep:habaki');
    toggleRow('guard', 'Arm Asymmetry', !!guard.asymmetricArms, 'dep:asym-arms');
    toggleRow('guard', 'Quillon Length', Math.round(guard.quillonCount ?? 0) > 0, 'dep:quillons');
    const gStyle = guard.style ?? 'bar';
    const isDisk = gStyle === 'disk';
    toggleRow('guard', 'Cutouts', isDisk, 'dep:disk');
    toggleRow('guard', 'Cutout Radius', isDisk, 'dep:disk');
    const isBasket = gStyle === 'basket';
    toggleRow('guard', 'Basket Rods', isBasket, 'dep:basket');
    toggleRow('guard', 'Basket Rod Thick', isBasket, 'dep:basket');
    toggleRow('guard', 'Basket Rings', isBasket, 'dep:basket');
    toggleRow('guard', 'Ring Thickness', isBasket, 'dep:basket');
    toggleRow('guard', 'Ring Radius +', isBasket, 'dep:basket');

    // Handle dependencies
    const handle = state.handle as any;
    toggleRow('handle', 'Ridge Count', !!handle.segmentation, 'dep:ridges');
    const wrapOn = !!handle.wrapEnabled;
    toggleRow('handle', 'Wrap Turns', wrapOn, 'dep:wrap');
    toggleRow('handle', 'Wrap Depth', wrapOn, 'dep:wrap');
    toggleRow('handle', 'Wrap Texture', wrapOn, 'dep:wrap');
    toggleRow('handle', 'Wrap Tex Scale', wrapOn && !!handle.wrapTexture, 'dep:wrap-texture');
    toggleRow('handle', 'Wrap Tex Angle', wrapOn && !!handle.wrapTexture, 'dep:wrap-texture');
    toggleRow('handle', 'Wrap Style', wrapOn, 'dep:wrap');
    // Wrap preset row (no registry field)
    try {
      const presetRow = Array.from(sections.Handle.querySelectorAll('.row.full')).find((r) =>
        (r as HTMLElement).textContent?.includes('Wrap Presets')
      ) as HTMLElement | undefined;
      if (presetRow) presetRow.style.display = wrapOn ? '' : 'none';
    } catch {}

    // Accessories dependencies
    const scabbard = state.accessories?.scabbard ?? defaults.accessories.scabbard;
    const tassel = state.accessories?.tassel ?? defaults.accessories.tassel;
    const scOn = !!scabbard.enabled;
    const tsOn = !!tassel.enabled;
    const tsAttachScabbard = (tassel.attachTo ?? 'guard') === 'scabbard';
    const acc = 'accessories';
    // Scabbard
    toggleRow(acc, 'Scabbard Margin', scOn, 'dep:scabbard');
    toggleRow(acc, 'Scabbard Thickness', scOn, 'dep:scabbard');
    toggleRow(acc, 'Scabbard Tip %', scOn, 'dep:scabbard');
    toggleRow(acc, 'Throat Length %', scOn, 'dep:scabbard');
    toggleRow(acc, 'Throat Scale', scOn, 'dep:scabbard');
    toggleRow(acc, 'Locket Offset %', scOn, 'dep:scabbard');
    toggleRow(acc, 'Locket Length %', scOn, 'dep:scabbard');
    toggleRow(acc, 'Locket Scale', scOn, 'dep:scabbard');
    toggleRow(acc, 'Chape Length %', scOn, 'dep:scabbard');
    toggleRow(acc, 'Chape Scale', scOn, 'dep:scabbard');
    toggleRow(acc, 'Scabbard Roundness', scOn, 'dep:scabbard');
    toggleRow(acc, 'Scabbard Offset X', scOn, 'dep:scabbard');
    toggleRow(acc, 'Scabbard Offset Z', scOn, 'dep:scabbard');
    toggleRow(acc, 'Scabbard Hang °', scOn, 'dep:scabbard');
    // Tassel
    toggleRow(acc, 'Tassel Attach', tsOn, 'dep:tassel');
    toggleRow(acc, 'Tassel Anchor %', tsOn && tsAttachScabbard, 'dep:tassel');
    toggleRow(acc, 'Tassel Length %', tsOn, 'dep:tassel');
    toggleRow(acc, 'Tassel Droop', tsOn, 'dep:tassel');
    toggleRow(acc, 'Tassel Sway', tsOn, 'dep:tassel');
    toggleRow(acc, 'Tassel Thickness', tsOn, 'dep:tassel');
    toggleRow(acc, 'Tuft Radius', tsOn, 'dep:tassel');
    toggleRow(acc, 'Tuft Length', tsOn, 'dep:tassel');
    toggleRow(acc, 'Tassel Strands', tsOn, 'dep:tassel');

    // Render: Post FX dependencies
    const post = postState as any;
    // Single-layer gating: only the feature's own toggle controls visibility
    toggleRow('render-post', 'Bloom Strength', !!rstate.bloomEnabled, 'dep:bloom');
    toggleRow('render-post', 'Bloom Threshold', !!rstate.bloomEnabled, 'dep:bloom');
    toggleRow('render-post', 'Bloom Radius', !!rstate.bloomEnabled, 'dep:bloom');
    toggleRow('render-post', 'Outline Strength', !!post.outlineEnabled, 'dep:outline');
    toggleRow('render-post', 'Outline Thickness', !!post.outlineEnabled, 'dep:outline');
    toggleRow('render-post', 'Outline Color', !!post.outlineEnabled, 'dep:outline');
    toggleRow('render-post', 'Ink Thickness', !!post.inkEnabled, 'dep:ink');
    toggleRow('render-post', 'Ink Color', !!post.inkEnabled, 'dep:ink');
    toggleRow('render-post', 'Vignette Strength', !!post.vignetteEnabled, 'dep:vignette');
    toggleRow('render-post', 'Vignette Softness', !!post.vignetteEnabled, 'dep:vignette');
    // Render: Blade Gradient
    toggleRow(
      'render-blade-gradient',
      'Grad Base',
      !!post.bladeGradientEnabled,
      'dep:blade-gradient'
    );
    toggleRow(
      'render-blade-gradient',
      'Grad Edge',
      !!post.bladeGradientEnabled,
      'dep:blade-gradient'
    );
    toggleRow(
      'render-blade-gradient',
      'Grad Edge Fade',
      !!post.bladeGradientEnabled,
      'dep:blade-gradient'
    );
    toggleRow(
      'render-blade-gradient',
      'Wear Intensity',
      !!post.bladeGradientEnabled,
      'dep:blade-gradient'
    );
    // Render: FX
    const fx = fxState as any;
    toggleRow('render-fx', 'Mist Color', !!fx.mist.enabled, 'dep:mist');
    toggleRow('render-fx', 'Mist Density', !!fx.mist.enabled, 'dep:mist');
    toggleRow('render-fx', 'Mist Speed', !!fx.mist.enabled, 'dep:mist');
    toggleRow('render-fx', 'Mist Spread', !!fx.mist.enabled, 'dep:mist');
    toggleRow('render-fx', 'Mist Size', !!fx.mist.enabled, 'dep:mist');
    toggleRow('render-fx', 'Mist Life Rate', !!fx.mist.enabled, 'dep:mist');
    toggleRow('render-fx', 'Mist Turbulence', !!fx.mist.enabled, 'dep:mist');
    toggleRow('render-fx', 'Noise Freq X', !!fx.mist.enabled, 'dep:mist');
    toggleRow('render-fx', 'Noise Freq Z', !!fx.mist.enabled, 'dep:mist');
    toggleRow('render-fx', 'Wind X', !!fx.mist.enabled, 'dep:mist');
    toggleRow('render-fx', 'Wind Z', !!fx.mist.enabled, 'dep:mist');
    toggleRow('render-fx', 'Emission Area', !!fx.mist.enabled, 'dep:mist');
    toggleRow('render-fx', 'Size Min Ratio', !!fx.mist.enabled, 'dep:mist');
    // Flame controls cluster
    toggleRow('render-fx', 'Flame Color A', !!fx.flame.enabled, 'dep:flame');
    toggleRow('render-fx', 'Flame Color B', !!fx.flame.enabled, 'dep:flame');
    toggleRow('render-fx', 'Flame Intensity', !!fx.flame.enabled, 'dep:flame');
    toggleRow('render-fx', 'Flame Speed', !!fx.flame.enabled, 'dep:flame');
    toggleRow('render-fx', 'Flame NoiseScale', !!fx.flame.enabled, 'dep:flame');
    toggleRow('render-fx', 'Flame Scale', !!fx.flame.enabled, 'dep:flame');
    toggleRow('render-fx', 'Flame Direction', !!fx.flame.enabled, 'dep:flame');
    toggleRow('render-fx', 'Flame Blend', !!fx.flame.enabled, 'dep:flame');
    // Embers
    toggleRow('render-fx', 'Ember Count', !!fx.embers.enabled, 'dep:embers');
    toggleRow('render-fx', 'Ember Size', !!fx.embers.enabled, 'dep:embers');
    toggleRow('render-fx', 'Ember Color', !!fx.embers.enabled, 'dep:embers');

    // Materials per part: gate rows within each part section
    const parts: Part[] = ['blade', 'guard', 'handle', 'pommel', 'scabbard', 'tassel'];
    for (const p of parts) {
      const sec = `materials-${p}`;
      const m = matState[p];
      const bumpOn = !!m.bumpEnabled;
      toggleRow(sec, 'Bump Scale', bumpOn, 'dep:bump');
      toggleRow(sec, 'Noise Scale', bumpOn, 'dep:bump');
      toggleRow(sec, 'Noise Seed', bumpOn, 'dep:bump');
      const emOn = (m.emissiveIntensity ?? 0) > 0;
      toggleRow(sec, 'Emissive Color', emOn, 'dep:emissive');
      toggleRow(sec, 'Emissive Intensity', emOn, 'dep:emissive');
      const tOn = (m.transmission ?? 0) > 0;
      toggleRow(sec, 'IOR', tOn, 'dep:transmission');
      toggleRow(sec, 'Thickness', tOn, 'dep:transmission');
      toggleRow(sec, 'Atten Color', tOn, 'dep:transmission');
      toggleRow(sec, 'Atten Dist', tOn, 'dep:transmission');
      const sheenOn = (m.sheen ?? 0) > 0;
      toggleRow(sec, 'Sheen Color', sheenOn, 'dep:sheen');
      const irOn = (m.iridescence ?? 0) > 0;
      toggleRow(sec, 'Iridescence IOR', irOn, 'dep:iridescence');
      toggleRow(sec, 'Iridescence Min', irOn, 'dep:iridescence');
      toggleRow(sec, 'Iridescence Max', irOn, 'dep:iridescence');
      const anisoOn = (m.anisotropy ?? 0) > 0;
      toggleRow(sec, 'Aniso Rotation', anisoOn, 'dep:aniso');
    }

    // Engravings: hide property rows when no engravings exist
    const engr = ((state.blade as any).engravings || []) as any[];
    const engrEmpty = engr.length === 0;
    const engrLabels = [
      'Engrave Index',
      'Engrave Type',
      'Engrave Text',
      'Font URL',
      'Engrave Width',
      'Engrave Height',
      'Engrave Depth',
      'Letter Spacing',
      'Engrave OffsetY',
      'Engrave OffsetX',
      'Engrave RotY',
      'Engrave Side',
      'Text Align',
    ];
    for (const lab of engrLabels) toggleRow('engravings', lab, !engrEmpty, 'dep:engraving');
  };
  const updateDynamics = () => {
    const d = (sword as any)?.getDerived?.();
    if (!d) {
      dynamicsBox.textContent = '';
      return;
    }
    const L = state.blade.length || 1;
    const fmt = (x: number) => (Math.round(x * 100) / 100).toFixed(2);
    const pct = (x: number) => Math.round((x / L) * 100);
    const text =
      'Dynamics: PoB ' +
      fmt(d.cmY) +
      ' (' +
      pct(d.cmY) +
      '%), CoP ' +
      fmt(d.copY) +
      ' (' +
      pct(d.copY) +
      '%), Ibase ' +
      fmt(d.Ibase) +
      ', Icm ' +
      fmt(d.Icm);
    dynamicsBox.textContent = text;
  };

  syncUi();
  rerender();
  // Handle deep links like #help=blade.curvature
  try {
    handleHelpHash();
  } catch {}
  try {
    window.addEventListener('hashchange', () => handleHelpHash());
  } catch {}
  activeRegistry = previousRegistry;
}

function addSection(root: HTMLElement, title: string) {
  const wrap = document.createElement('div');
  wrap.className = 'section';
  wrap.dataset.fieldNamespace = slugify(title);
  const h = document.createElement('h2');
  const caret = document.createElement('span');
  caret.className = 'caret';
  caret.textContent = '▾';
  const text = document.createElement('span');
  text.textContent = ' ' + title;
  h.appendChild(caret);
  h.appendChild(text);
  // Persisted collapsed state
  const key = `bladegen.ui.section.${title}.collapsed`;
  try {
    const col = localStorage.getItem(key);
    if (col === '1') wrap.classList.add('collapsed');
  } catch {}
  h.addEventListener('click', (e) => {
    // Ignore clicks originating from buttons within the header
    if ((e.target as HTMLElement).closest('button')) return;
    wrap.classList.toggle('collapsed');
    // Defensive: ensure immediate children visibility is reset when expanding
    if (!wrap.classList.contains('collapsed')) {
      const kids = Array.from(wrap.children) as HTMLElement[];
      kids.forEach((child) => {
        if (child.tagName !== 'H2') (child as HTMLElement).style.removeProperty('display');
      });
    }
    try {
      localStorage.setItem(key, wrap.classList.contains('collapsed') ? '1' : '0');
    } catch {}
  });
  // Alt+double-click to reset entire section to defaults
  h.addEventListener('dblclick', (e) => {
    if ((e as MouseEvent).altKey) {
      resetSection(wrap);
    }
  });
  wrap.appendChild(h);
  root.appendChild(wrap);
  return wrap;
}

// Simple non-collapsible subheading within a section
function addSubheading(parent: HTMLElement, title: string) {
  const row = document.createElement('div');
  row.className = 'subheading';
  const h = document.createElement('h3');
  h.textContent = title;
  row.appendChild(h);
  parent.appendChild(row);
  // Return the same parent as the target container for subsequent controls
  return parent;
}

// Small visual group box with a label; returns the group container
function addGroup(parent: HTMLElement, title: string) {
  const box = document.createElement('div');
  box.className = 'group';
  const label = document.createElement('div');
  label.className = 'group-label';
  label.textContent = title;
  box.appendChild(label);
  parent.appendChild(box);
  return box;
}

function addShuffleButton(section: HTMLElement, onClick: () => void) {
  const header = section.querySelector('h2');
  if (!header) return;
  const btn = document.createElement('button');
  btn.textContent = 'Shuffle';
  btn.style.marginLeft = '8px';
  btn.title = 'Randomize values in this section';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  header.appendChild(btn);
}

function resetRow(row: HTMLElement) {
  const type = row.dataset.type;
  const def = row.dataset.defaultValue;
  if (def === undefined || !type) return;
  if (type === 'slider') {
    const range = row.querySelector('input[type="range"]') as HTMLInputElement | null;
    const num = row.querySelector('input[type="number"]') as HTMLInputElement | null;
    if (range && num) {
      range.value = def;
      num.value = def;
      range.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } else if (type === 'select') {
    const sel = row.querySelector('select') as HTMLSelectElement | null;
    if (sel) {
      sel.value = def;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } else if (type === 'checkbox') {
    const chk = row.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    if (chk) {
      chk.checked = def === 'true';
      chk.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } else if (type === 'color') {
    const col = row.querySelector('input[type="color"]') as HTMLInputElement | null;
    if (col) {
      col.value = def;
      col.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } else if (type === 'text') {
    const inp = row.querySelector('input[type="text"]') as HTMLInputElement | null;
    if (inp) {
      inp.value = def;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

function resetSection(section: HTMLElement) {
  const rows = Array.from(section.querySelectorAll('.row')) as HTMLElement[];
  rows.forEach(resetRow);
}

function slider(
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
) {
  const registry = getActiveRegistry();
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.type = 'slider';
  row.dataset.defaultValue = String(value);
  const lab = document.createElement('label');
  lab.textContent = label;
  let hi: HTMLElement | undefined;
  if (tooltip) {
    const icon = document.createElement('span');
    icon.className = 'help-icon';
    icon.textContent = '?';
    hi = icon;
    lab.appendChild(icon);
  }
  lab.addEventListener('dblclick', (e) => {
    if (!(e as MouseEvent).altKey) resetRow(row);
  });
  const range = document.createElement('input');
  range.type = 'range';
  range.min = String(min);
  range.max = String(max);
  range.step = String(step);
  range.value = String(value);
  const num = document.createElement('input');
  num.type = 'number';
  num.min = String(min);
  num.max = String(max);
  num.step = String(step);
  num.value = String(value);

  const commit = (raw: unknown, emit = true) => {
    const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw));
    if (!Number.isFinite(parsed)) return;
    const clamped = clamp(parsed, min, max);
    range.value = String(clamped);
    num.value = String(clamped);
    if (emit) {
      onChange(clamped);
      rerender();
    }
  };

  range.addEventListener('input', () => {
    commit(range.value);
  });

  num.addEventListener('input', () => {
    if (!num.value.trim()) return;
    commit(num.value);
  });

  num.addEventListener('blur', () => {
    if (!num.value.trim()) {
      commit(range.value, false);
      return;
    }
    commit(num.value);
  });

  const field = registry.registerControl(
    parent,
    row,
    label,
    'slider',
    (val) => commit(val, false),
    fieldOverride
  );
  // Attach contextual help (micro‑tooltip + popover on '?')
  attachHelp(row, lab, hi, tooltip ? tooltip + ' — Double‑click label to reset' : undefined);
  row.appendChild(lab);
  row.appendChild(range);
  row.appendChild(num);
  parent.appendChild(row);
  return field;
}

function select(
  parent: HTMLElement,
  label: string,
  options: string[],
  value: string,
  onChange: (v: string) => void,
  rerender: () => void,
  tooltip?: string,
  fieldOverride?: string
) {
  const registry = getActiveRegistry();
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.type = 'select';
  row.dataset.defaultValue = String(value);
  const lab = document.createElement('label');
  lab.textContent = label;
  let hi: HTMLElement | undefined;
  if (tooltip) {
    const icon = document.createElement('span');
    icon.className = 'help-icon';
    icon.textContent = '?';
    hi = icon;
    lab.appendChild(icon);
  }
  lab.addEventListener('dblclick', (e) => {
    if (!(e as MouseEvent).altKey) resetRow(row);
  });
  const sel = document.createElement('select');
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    if (opt === value) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => {
    onChange(sel.value);
    rerender();
  });

  const setValue = (val: unknown) => {
    if (val === undefined || val === null) return;
    const str = String(val);
    const opts = Array.from(sel.options).map((o) => o.value);
    if (!opts.includes(str)) return;
    sel.value = str;
  };

  const field = registry.registerControl(parent, row, label, 'select', setValue, fieldOverride);
  attachHelp(row, lab, hi, tooltip ? tooltip + ' — Double‑click label to reset' : undefined);
  row.appendChild(lab);
  row.appendChild(sel);
  parent.appendChild(row);
  return field;
}

function checkbox(
  parent: HTMLElement,
  label: string,
  value: boolean,
  onChange: (v: boolean) => void,
  rerender: () => void,
  tooltip?: string,
  fieldOverride?: string
) {
  const registry = getActiveRegistry();
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.type = 'checkbox';
  row.dataset.defaultValue = String(!!value);
  const lab = document.createElement('label');
  lab.textContent = label;
  let hi: HTMLElement | undefined;
  if (tooltip) {
    const icon = document.createElement('span');
    icon.className = 'help-icon';
    icon.textContent = '?';
    hi = icon;
    lab.appendChild(icon);
  }
  lab.addEventListener('dblclick', (e) => {
    if (!(e as MouseEvent).altKey) resetRow(row);
  });
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = value;
  input.addEventListener('change', () => {
    onChange(input.checked);
    rerender();
  });
  const field = registry.registerControl(
    parent,
    row,
    label,
    'checkbox',
    (val) => {
      input.checked = !!val;
    },
    fieldOverride
  );
  attachHelp(row, lab, hi, tooltip ? tooltip + ' — Double‑click label to reset' : undefined);
  row.appendChild(lab);
  const span = document.createElement('span');
  span.appendChild(input);
  row.appendChild(span);
  parent.appendChild(row);
  return field;
}

function colorPicker(
  parent: HTMLElement,
  label: string,
  value: string,
  onChange: (hex: string) => void,
  rerender: () => void,
  tooltip?: string,
  fieldOverride?: string
) {
  const registry = getActiveRegistry();
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.type = 'color';
  const normalize = (val: unknown) => {
    if (typeof val === 'number') {
      return (
        '#' +
        Math.max(0, Math.min(0xffffff, Math.floor(val)))
          .toString(16)
          .padStart(6, '0')
      );
    }
    if (typeof val === 'string') {
      return val.startsWith('#') ? val : `#${val}`;
    }
    return value;
  };
  const initial = normalize(value);
  row.dataset.defaultValue = initial;
  const lab = document.createElement('label');
  lab.textContent = label;
  let hi: HTMLElement | undefined;
  if (tooltip) {
    const icon = document.createElement('span');
    icon.className = 'help-icon';
    icon.textContent = '?';
    hi = icon;
    lab.appendChild(icon);
  }
  lab.addEventListener('dblclick', (e) => {
    if (!(e as MouseEvent).altKey) resetRow(row);
  });
  const input = document.createElement('input');
  input.type = 'color';
  input.value = initial;
  input.addEventListener('input', () => {
    onChange(input.value);
    rerender();
  });

  const field = registry.registerControl(
    parent,
    row,
    label,
    'color',
    (val) => {
      input.value = normalize(val);
    },
    fieldOverride
  );
  attachHelp(row, lab, hi, tooltip ? tooltip + ' — Double‑click label to reset' : undefined);
  row.appendChild(lab);
  const span = document.createElement('span');
  span.appendChild(input);
  row.appendChild(span);
  parent.appendChild(row);
  return field;
}

function textRow(
  parent: HTMLElement,
  label: string,
  value: string,
  onChange: (v: string) => void,
  tooltip?: string,
  fieldOverride?: string
) {
  const registry = getActiveRegistry();
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.type = 'text';
  row.dataset.defaultValue = value || '';
  const lab = document.createElement('label');
  lab.textContent = label;
  // Attach micro‑tooltip even for text rows (no '?' icon)
  attachHelp(row, lab, null, tooltip ? tooltip + ' — Double‑click label to reset' : undefined);
  lab.addEventListener('dblclick', (e) => {
    if (!(e as MouseEvent).altKey) resetRow(row);
  });
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
  input.placeholder = 'http(s):// or relative path';
  const commit = () => onChange(input.value);
  input.addEventListener('change', commit);
  input.addEventListener('input', commit);
  input.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') commit();
  });
  const field = registry.registerControl(
    parent,
    row,
    label,
    'text',
    (val) => {
      input.value = val == null ? '' : String(val);
    },
    fieldOverride
  );
  row.appendChild(lab);
  const span = document.createElement('span');
  span.appendChild(input);
  row.appendChild(span);
  parent.appendChild(row);
  return field;
}

function refreshInputs(registry: ControlRegistry, params: SwordParams) {
  const set = (section: string, label: string, value: number | string | boolean) => {
    registry.setValue(section, label, value);
  };
  const toDeg = (rad: number | undefined) => ((rad ?? 0) * 180) / Math.PI;
  const defaults = defaultSwordParams();
  const blade = params.blade as typeof params.blade & Record<string, any>;
  const guard = params.guard as typeof params.guard & Record<string, any>;
  const handle = params.handle as typeof params.handle & Record<string, any>;
  const pommel = params.pommel as typeof params.pommel & Record<string, any>;
  const extras = params as Record<string, any>;
  const ratios = extras.ratios ?? {};
  const accessories = (params.accessories ?? defaults.accessories) as NonNullable<
    typeof defaults.accessories
  >;
  const scabbard = (accessories.scabbard ??
    defaults.accessories.scabbard) as typeof defaults.accessories.scabbard;
  const tassel = (accessories.tassel ??
    defaults.accessories.tassel) as typeof defaults.accessories.tassel;

  const getTaper = (): [number, number, number] => {
    const pts = blade.thicknessProfile?.points as Array<[number, number]> | undefined;
    if (!pts || pts.length < 2) return [100, 100, 100];
    const base = Math.round((pts[0]?.[1] ?? 1) * 100);
    const tip = Math.round((pts[pts.length - 1]?.[1] ?? 1) * 100);
    let mid = 100;
    for (const [t, s] of pts) {
      if (t >= 0.5 && t <= 0.7) {
        mid = Math.round(s * 100);
        break;
      }
    }
    return [base, mid, tip];
  };
  const [taperBase, taperMid, taperTip] = getTaper();

  const guardExtras = (guard.extras ?? []) as any[];
  const guardExtra = (kind: string) => guardExtras.find((e: any) => e.kind === kind);
  const hasGuardExtra = (kind: string) => guardExtras.some((e: any) => e.kind === kind);
  const sideRing = guardExtra('sideRing');
  const loopExtra = guardExtra('loop');

  const handleLayersList = (handle.handleLayers ?? []) as any[];
  const findHandleLayer = (kind: string, predicate?: (layer: any) => boolean) =>
    handleLayersList.find((layer) => layer.kind === kind && (!predicate || predicate(layer)));
  const crisscross = findHandleLayer('wrap', (layer) => layer.wrapPattern === 'crisscross');
  const ringLayers = handleLayersList.filter((layer) => layer.kind === 'ring');
  const firstRing = ringLayers[0];
  const menukiLayers = (handle.menuki ?? []) as any[];
  const rivetLayers = (handle.rivets ?? []) as any[];

  const sections: Record<string, Record<string, number | string | boolean>> = {
    blade: {
      'Blade Length': blade.length,
      'Base Width': blade.baseWidth,
      'Tip Width': blade.tipWidth,
      'Blade Family': blade.family ?? 'straight',
      'Kris Waves': blade.family === 'kris' ? (blade.krisWaveCount ?? 7) : 'n/a',
      'Tip Shape': blade.tipShape ?? 'pointed',
      'Leaf Bulge': blade.tipBulge ?? 0.2,
      'Cross Section': blade.crossSection ?? 'flat',
      'Edge Bevel': blade.bevel ?? 0.5,
      'Blade Thickness': blade.thickness,
      'Left Thickness': blade.thicknessLeft ?? blade.thickness,
      'Right Thickness': blade.thicknessRight ?? blade.thickness,
      Curvature: blade.curvature,
      'Base Angle': toDeg(blade.baseAngle),
      'Sori Profile': blade.soriProfile ?? 'torii',
      'Sori Bias': blade.soriBias ?? 0.8,
      'Kissaki Length': blade.kissakiLength ?? 0,
      'Kissaki Round': blade.kissakiRoundness ?? 0.5,
      'Tip Ramp %': Math.round((blade.tipRampStart ?? 0) * 100),
      'Edge Type': blade.edgeType ?? 'double',
      'Hamon Enabled': blade.hamonEnabled ?? false,
      'Hamon Width': blade.hamonWidth ?? 0.02,
      'Hamon Amp': blade.hamonAmplitude ?? 0.008,
      'Hamon Freq': blade.hamonFrequency ?? 6,
      'Hamon Side': blade.hamonSide ?? 'auto',
      Asymmetry: blade.asymmetry ?? 0,
      Chaos: blade.chaos ?? 0,
      'Serration Pattern': blade.serrationPattern ?? blade.serrationMode ?? 'sine',
      'Serration Seed': blade.serrationSeed ?? 1337,
      'Fuller Mode': blade.fullerMode ?? 'overlay',
      'Fuller Profile': blade.fullerProfile ?? 'u',
      'Fuller Width': blade.fullerWidth ?? 0,
      'Fuller Inset': blade.fullerInset ?? blade.fullerDepth ?? 0,
      'Enable Fullers': blade.fullerEnabled ?? false,
      'Fuller Depth': blade.fullerDepth ?? 0,
      'Fuller Length': blade.fullerLength ?? 0,
      'Fuller Count': blade.fullerCount ?? 1,
      'Serration Left': blade.serrationAmplitudeLeft ?? blade.serrationAmplitude ?? 0,
      'Serration Right': blade.serrationAmplitudeRight ?? blade.serrationAmplitude ?? 0,
      'Serration Freq': blade.serrationFrequency ?? 0,
      'Serration Sharpness': (blade as any).serrationSharpness ?? 0,
      'Serration Lean L': (blade as any).serrationLeanLeft ?? 0,
      'Serration Lean R': (blade as any).serrationLeanRight ?? 0,
      'Taper Base %': taperBase,
      'Taper Mid %': taperMid,
      'Taper Tip %': taperTip,
      'Ricasso %': Math.round((blade.ricassoLength ?? 0) * 100),
      'False Edge %': Math.round((blade.falseEdgeLength ?? 0) * 100),
      'False Edge Depth': blade.falseEdgeDepth ?? 0,
      'Hollow Enabled': blade.hollowGrind?.enabled ?? false,
      'Hollow Mix': blade.hollowGrind?.mix ?? 0.65,
      'Hollow Depth': blade.hollowGrind?.depth ?? 0.45,
      'Hollow Radius': blade.hollowGrind?.radius ?? 0.6,
      'Hollow Bias': blade.hollowGrind?.bias ?? 0,
      'Twist Angle': toDeg(blade.twistAngle ?? 0),
    },
    guard: {
      'Guard Width': guard.width,
      'Guard Thickness': guard.thickness,
      Curve: guard.curve,
      Tilt: guard.tilt,
      Style: guard.style,
      'Asymmetric Arms': guard.asymmetricArms ?? false,
      'Arm Asymmetry': guard.asymmetry ?? 0,
      'Guard Detail': guard.curveSegments ?? 12,
      Habaki: guard.habakiEnabled ?? false,
      'Habaki Height': guard.habakiHeight ?? 0.06,
      'Habaki Margin': guard.habakiMargin ?? 0.01,
      'Guard Height': guard.heightOffset ?? 0,
      'Quillon Count': guard.quillonCount ?? 0,
      'Quillon Length': guard.quillonLength ?? 0.25,
      Ornamentation: guard.ornamentation ?? 0,
      'Tip Sharpness': guard.tipSharpness ?? 0.5,
      Cutouts: guard.cutoutCount ?? 0,
      'Cutout Radius': guard.cutoutRadius ?? 0.5,
      'Blend Fillet': guard.guardBlendFillet ?? 0,
      'Fillet Style': guard.guardBlendFilletStyle ?? 'box',
      'Finger Guard': hasGuardExtra('fingerGuard'),
      'Side Rings': hasGuardExtra('sideRing'),
      'Ring Radius': sideRing?.radius ?? 0.12,
      'Ring Thick': sideRing?.thickness ?? 0.03,
      'Ring OffsetY': sideRing?.offsetY ?? 0,
      Loops: hasGuardExtra('loop'),
      'Loop Radius': loopExtra?.radius ?? 0.12,
      'Loop Thick': loopExtra?.thickness ?? 0.02,
      'Loop OffsetY': loopExtra?.offsetY ?? 0,
      'Basket Rods': guard.basketRodCount ?? 12,
      'Basket Rod Thick': guard.basketRodRadius ?? 0.02,
      'Basket Rings': guard.basketRingCount ?? 1,
      'Ring Thickness': guard.basketRingThickness ?? 0.012,
      'Ring Radius +': guard.basketRingRadiusAdd ?? 0,
    },
    handle: {
      'Handle Length': handle.length,
      'Radius Top': handle.radiusTop,
      'Radius Bottom': handle.radiusBottom,
      Ridges: handle.segmentation ?? false,
      'Ridge Count': handle.segmentationCount ?? 8,
      'Wrap Enabled': handle.wrapEnabled ?? false,
      'Wrap Style': handle.wrapStyle ?? 'none',
      'Wrap Turns': handle.wrapTurns ?? 6,
      'Wrap Depth': handle.wrapDepth ?? 0.015,
      'Handle Sides': handle.phiSegments ?? 64,
      'Oval Ratio': handle.ovalRatio ?? 1,
      Flare: handle.flare ?? 0,
      'Handle Curvature': handle.curvature ?? 0,
      'Tang Visible': handle.tangVisible ?? false,
      'Tang Width': handle.tangWidth ?? 0.05,
      'Tang Thickness': handle.tangThickness ?? 0.02,
      'Wrap Texture': handle.wrapTexture ?? false,
      'Wrap Tex Scale': handle.wrapTexScale ?? 10,
      'Wrap Tex Angle': toDeg(handle.wrapTexAngle ?? Math.PI / 4),
      'Crisscross Wrap Layer': !!crisscross,
      'Wrap Turns L': Math.round(crisscross?.turns ?? 7),
      'Wrap Y0 %': Math.round((crisscross?.y0Frac ?? 0) * 100),
      'Wrap Len %': Math.round((crisscross?.lengthFrac ?? 1) * 100),
      'Handle Ring': ringLayers.length > 0,
      'Ring Y %': Math.round((firstRing?.y0Frac ?? 0.5) * 100),
      'Ring Radius +': firstRing?.radiusAdd ?? 0.0,
      'Rings Count': ringLayers.length,
      Menuki: menukiLayers.length > 0,
      Rivets: rivetLayers.length > 0,
      'Rivets Count': Math.round(rivetLayers[0]?.count ?? 8),
      'Rivets Y %': Math.round((rivetLayers[0]?.ringFrac ?? 0.3) * 100),
      'Rivet Size': rivetLayers[0]?.radius ?? 0.01,
    },
    pommel: {
      Style: pommel.style,
      'Pommel Size': pommel.size,
      Elongation: pommel.elongation,
      Morph: pommel.shapeMorph,
      'Offset X': pommel.offsetX ?? 0,
      'Offset Y': pommel.offsetY ?? 0,
      'Facet Count': pommel.facetCount ?? 32,
      'Spike Length': pommel.spikeLength ?? 1.0,
      Balance: pommel.balance ?? 0,
      'Ring Inner R': pommel.ringInnerRadius ?? 0.08,
      'Crown Spikes': pommel.crownSpikes ?? 8,
      'Crown Sharp': pommel.crownSharpness ?? 0.6,
    },
    accessories: {
      'Scabbard Enabled': scabbard.enabled ?? false,
      'Scabbard Margin': scabbard.bodyMargin ?? defaults.accessories.scabbard.bodyMargin,
      'Scabbard Thickness': scabbard.bodyThickness ?? defaults.accessories.scabbard.bodyThickness,
      'Scabbard Tip %': Math.round((scabbard.tipExtension ?? 0) * 100),
      'Throat Length %': Math.round((scabbard.throatLength ?? 0) * 100),
      'Throat Scale': scabbard.throatScale ?? defaults.accessories.scabbard.throatScale,
      'Locket Offset %': Math.round((scabbard.locketOffset ?? 0) * 100),
      'Locket Length %': Math.round((scabbard.locketLength ?? 0) * 100),
      'Locket Scale': scabbard.locketScale ?? defaults.accessories.scabbard.locketScale,
      'Chape Length %': Math.round((scabbard.chapeLength ?? 0) * 100),
      'Chape Scale': scabbard.chapeScale ?? defaults.accessories.scabbard.chapeScale,
      'Scabbard Roundness': scabbard.bodyRoundness ?? defaults.accessories.scabbard.bodyRoundness,
      'Scabbard Offset X': scabbard.offsetX ?? 0,
      'Scabbard Offset Z': scabbard.offsetZ ?? 0,
      'Scabbard Hang °': Math.round(
        toDeg(scabbard.hangAngle ?? defaults.accessories.scabbard.hangAngle)
      ),
      'Tassel Enabled': tassel.enabled ?? false,
      'Tassel Attach': tassel.attachTo ?? 'guard',
      'Tassel Anchor %': Math.round((tassel.anchorOffset ?? 0) * 100),
      'Tassel Length %': Math.round((tassel.length ?? defaults.accessories.tassel.length) * 100),
      'Tassel Droop': tassel.droop ?? defaults.accessories.tassel.droop,
      'Tassel Sway': tassel.sway ?? defaults.accessories.tassel.sway,
      'Tassel Thickness': tassel.thickness ?? defaults.accessories.tassel.thickness,
      'Tuft Radius': tassel.tuftSize ?? defaults.accessories.tassel.tuftSize,
      'Tuft Length': tassel.tuftLength ?? defaults.accessories.tassel.tuftLength,
      'Tassel Strands': tassel.strands ?? defaults.accessories.tassel.strands,
    },
    other: {
      Stylization: extras.styleFactor ?? 0,
      'Taper Ratio': blade.baseWidth > 0 ? 1 - blade.tipWidth / blade.baseWidth : 0,
      'Blade Detail': blade.sweepSegments ?? 128,
      'Use Ratios': extras.useRatios ?? false,
      'Guard:Blade': ratios.guardWidthToBlade ?? 0.35,
      'Handle:Blade': ratios.handleLengthToBlade ?? 0.3,
      'Pommel:Blade': ratios.pommelSizeToBlade ?? 0.05,
    },
  };

  const applyFullerFaceSummary = (side: 'left' | 'right', label: 'Left' | 'Right') => {
    const arr = (blade.fullerFaces?.[side] ?? []) as Array<any>;
    for (let i = 0; i < 3; i++) {
      const slot = arr[i];
      sections.blade[`${label} Fuller ${i + 1}`] = !!slot;
      sections.blade[`${label} F${i + 1} Width`] = slot?.width ?? 0;
      sections.blade[`${label} F${i + 1} Offset`] = slot?.offsetFromSpine ?? 0;
      sections.blade[`${label} F${i + 1} Taper`] = slot?.taper ?? 0;
    }
  };
  applyFullerFaceSummary('left', 'Left');
  applyFullerFaceSummary('right', 'Right');

  for (const [section, entries] of Object.entries(sections)) {
    for (const [label, value] of Object.entries(entries)) {
      set(section, label, value);
    }
  }

  registry.setValueByField('handle.layer-wrap-depth', crisscross?.depth ?? 0.012);
}

function assignParams(dst: SwordParams, src: SwordParams) {
  dst.blade = { ...dst.blade, ...src.blade };
  dst.guard = { ...dst.guard, ...src.guard } as any;
  dst.handle = { ...dst.handle, ...src.handle } as any;
  dst.pommel = { ...dst.pommel, ...src.pommel } as any;
  if (src.hiltEnabled !== undefined) dst.hiltEnabled = src.hiltEnabled;
  if (src.guardEnabled !== undefined) dst.guardEnabled = src.guardEnabled;
  if (src.useRatios !== undefined) dst.useRatios = src.useRatios;
  if (src.ratios) dst.ratios = { ...(dst.ratios ?? {}), ...src.ratios };
  if (src.accessories) {
    const defaults = defaultSwordParams().accessories;
    if (!dst.accessories) {
      dst.accessories = JSON.parse(JSON.stringify(defaults));
    }
    if (src.accessories.scabbard) {
      dst.accessories!.scabbard = {
        ...defaults.scabbard,
        ...(dst.accessories?.scabbard ?? {}),
        ...src.accessories.scabbard,
      };
    }
    if (src.accessories.tassel) {
      dst.accessories!.tassel = {
        ...defaults.tassel,
        ...(dst.accessories?.tassel ?? {}),
        ...src.accessories.tassel,
      };
    }
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function randomize(p: SwordParams, safe: boolean) {
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  randomizeBlade(p, safe);
  randomizeGuard(p, safe);
  randomizeHandle(p, safe);
  randomizePommel(p, safe);
  randomizeAccessories(p, safe);
}

function randomizeBlade(p: SwordParams, safe: boolean) {
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  p.blade.length = safe ? r(0.8, 3.5) : r(0.3, 5.5);
  p.blade.baseWidth = safe ? r(0.15, 0.35) : r(0.05, 0.8);
  p.blade.tipWidth = clamp(r(0, p.blade.baseWidth * (safe ? 0.6 : 1)), 0, 1);
  p.blade.thickness = safe ? r(0.05, 0.12) : r(0.02, 0.18);
  if (Math.random() > 0.5) {
    // slight asymmetry in edge thickness
    const baseT = p.blade.thickness;
    p.blade.thicknessLeft = clamp(baseT * r(0.6, 1.4), 0.003, 0.2);
    p.blade.thicknessRight = clamp(baseT * r(0.6, 1.4), 0.003, 0.2);
  } else {
    p.blade.thicknessLeft = p.blade.thickness;
    p.blade.thicknessRight = p.blade.thickness;
  }
  p.blade.curvature = safe ? r(-0.2, 0.4) : r(-0.8, 0.8);
  p.blade.chaos = safe ? r(0, 0.2) : r(0, 0.6);
  const amp = safe ? 0 : r(0, 0.15);
  const sideMode = Math.random();
  if (sideMode < 0.33) {
    p.blade.serrationAmplitudeLeft = amp;
    p.blade.serrationAmplitudeRight = 0;
  } else if (sideMode < 0.66) {
    p.blade.serrationAmplitudeLeft = 0;
    p.blade.serrationAmplitudeRight = amp;
  } else {
    p.blade.serrationAmplitudeLeft = amp;
    p.blade.serrationAmplitudeRight = amp;
  }
  p.blade.serrationFrequency =
    p.blade.serrationAmplitudeLeft! > 0 || p.blade.serrationAmplitudeRight! > 0
      ? Math.floor(r(2, safe ? 8 : 20))
      : 0;
  p.blade.fullerEnabled = Math.random() > 0.6;
  p.blade.fullerDepth = p.blade.fullerEnabled ? (safe ? r(0.01, 0.04) : r(0, 0.08)) : 0;
  p.blade.fullerLength = p.blade.fullerEnabled ? (safe ? r(0.4, 0.8) : r(0, 1)) : 0;
  p.blade.sweepSegments = Math.round(safe ? r(96, 160) : r(64, 192));
}

function randomizeGuard(p: SwordParams, safe: boolean) {
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  p.guard.width = safe ? r(0.8, 1.6) : r(0.4, 2.5);
  p.guard.thickness = safe ? r(0.1, 0.25) : r(0.08, 0.5);
  p.guard.curve = safe ? r(-0.3, 0.6) : r(-1, 1);
  p.guard.tilt = safe ? r(-0.2, 0.2) : r(-0.6, 0.6);
  const styles = ['bar', 'winged', 'claw', 'disk', 'knucklebow', 'swept', 'basket'] as const;
  p.guard.style = (styles as any)[Math.floor(r(0, styles.length))] as any;
}

function randomizeHandle(p: SwordParams, safe: boolean) {
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  p.handle.length = safe ? r(0.7, 1.2) : r(0.4, 1.6);
  p.handle.radiusTop = safe ? r(0.1, 0.18) : r(0.08, 0.25);
  p.handle.radiusBottom = safe ? r(0.1, 0.18) : r(0.08, 0.25);
  p.handle.segmentation = Math.random() > 0.5;
  p.handle.wrapEnabled = Math.random() > 0.5;
  p.handle.wrapTurns = p.handle.wrapEnabled ? Math.floor(r(4, 12)) : 6;
  p.handle.wrapDepth = p.handle.wrapEnabled ? (safe ? r(0.006, 0.02) : r(0.003, 0.035)) : 0.015;
  p.handle.wrapTexture = Math.random() > 0.5;
  p.handle.wrapTexScale = p.handle.wrapTexture ? Math.floor(r(6, 16)) : 10;
  p.handle.wrapTexAngle = p.handle.wrapTexture ? (r(-60, 60) * Math.PI) / 180 : Math.PI / 4;
}

function randomizePommel(p: SwordParams, safe: boolean) {
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  p.pommel.style = (['orb', 'disk', 'spike'] as const)[Math.floor(r(0, 3))];
  p.pommel.size = safe ? r(0.12, 0.22) : r(0.08, 0.3);
  p.pommel.elongation = safe ? r(0.8, 1.3) : r(0.5, 1.6);
  p.pommel.shapeMorph = safe ? r(0.1, 0.6) : r(0, 1);
}

function randomizeAccessories(p: SwordParams, safe: boolean) {
  const defaults = defaultSwordParams();
  if (!p.accessories) {
    p.accessories = JSON.parse(JSON.stringify(defaults.accessories));
  }
  if (!p.accessories.scabbard) {
    p.accessories.scabbard = JSON.parse(JSON.stringify(defaults.accessories.scabbard));
  }
  if (!p.accessories.tassel) {
    p.accessories.tassel = JSON.parse(JSON.stringify(defaults.accessories.tassel));
  }
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  const scabbard = p.accessories.scabbard;
  const tassel = p.accessories.tassel;

  scabbard.enabled = Math.random() > (safe ? 0.55 : 0.35);
  scabbard.bodyMargin = safe ? r(0.02, 0.045) : r(0.01, 0.07);
  scabbard.bodyThickness = safe ? r(0.11, 0.22) : r(0.08, 0.32);
  scabbard.tipExtension = safe ? r(0.02, 0.08) : r(0, 0.18);
  scabbard.throatLength = safe ? r(0.04, 0.16) : r(0, 0.3);
  scabbard.throatScale = safe ? r(1.05, 1.4) : r(1.0, 1.9);
  scabbard.locketOffset = safe ? r(0.12, 0.35) : r(0.02, 0.55);
  scabbard.locketLength = safe ? r(0.05, 0.12) : r(0.02, 0.2);
  scabbard.locketScale = safe ? r(1.0, 1.35) : r(1.0, 1.8);
  scabbard.chapeLength = safe ? r(0.14, 0.24) : r(0.08, 0.32);
  scabbard.chapeScale = safe ? r(0.35, 0.6) : r(0.2, 0.75);
  scabbard.bodyRoundness = safe ? r(0.35, 0.7) : r(0.1, 0.9);
  scabbard.offsetX = (Math.random() > 0.5 ? 1 : -1) * (safe ? r(0.1, 0.22) : r(0.08, 0.3));
  scabbard.offsetZ = safe ? r(-0.06, 0.06) : r(-0.12, 0.12);
  scabbard.hangAngle = ((safe ? r(-40, 40) : r(-65, 65)) * Math.PI) / 180;

  tassel.enabled = Math.random() > (safe ? 0.7 : 0.45);
  tassel.attachTo =
    tassel.enabled && scabbard.enabled && Math.random() > 0.5 ? 'scabbard' : 'guard';
  tassel.anchorOffset = safe ? r(0.2, 0.65) : r(0, 1);
  tassel.length = safe ? r(0.4, 0.8) : r(0.25, 1.2);
  tassel.droop = safe ? r(0.45, 0.7) : r(0.25, 0.9);
  tassel.sway = safe ? r(-0.45, 0.45) : r(-0.85, 0.85);
  tassel.thickness = safe ? r(0.01, 0.025) : r(0.006, 0.05);
  tassel.tuftSize = safe ? r(0.035, 0.08) : r(0.02, 0.12);
  tassel.tuftLength = safe ? r(0.08, 0.16) : r(0.05, 0.26);
  tassel.strands = Math.max(1, Math.round(safe ? r(6, 14) : r(4, 20)));
}

function presetArming(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 2.6;
  p.blade.baseWidth = 0.22;
  p.blade.tipWidth = 0.01;
  p.blade.tipRampStart = 0.82;
  p.blade.kissakiLength = 0.16;
  p.blade.kissakiRoundness = 0.05;
  p.blade.tipShape = 'spear';
  p.blade.crossSection = 'diamond';
  p.blade.thickness = 0.07;
  p.blade.thicknessLeft = 0.07;
  p.blade.thicknessRight = 0.07;
  p.blade.fullerEnabled = true;
  p.blade.fullerDepth = 0.015;
  p.blade.fullerLength = 0.55;
  p.blade.fullerWidth = 0.05;
  p.blade.fullerMode = 'overlay';
  p.blade.fullerCount = 1;
  p.blade.chaos = 0;
  p.blade.edgeType = 'double';
  p.blade.ricassoLength = 0.04;
  p.blade.falseEdgeLength = 0;
  p.blade.falseEdgeDepth = 0;

  p.guard.style = 'bar';
  p.guard.width = 1.15;
  p.guard.thickness = 0.18;
  p.guard.curve = 0;
  p.guard.tilt = 0;
  p.guard.guardBlendFillet = 0.05;
  p.guard.guardBlendFilletStyle = 'smooth';
  p.guard.ornamentation = 0.1;

  p.handle.length = 0.85;
  p.handle.radiusTop = 0.11;
  p.handle.radiusBottom = 0.11;
  p.handle.segmentation = false;
  p.handle.wrapEnabled = true;
  p.handle.wrapTurns = 6;
  p.handle.wrapDepth = 0.01;
  p.handle.wrapTexture = true;
  p.handle.wrapTexScale = 9;
  p.handle.wrapTexAngle = Math.PI / 6;
  (p.handle as any).ovalRatio = 1.1;

  p.pommel.style = 'scentStopper';
  p.pommel.size = 0.17;
  p.pommel.elongation = 1.2;
  p.pommel.shapeMorph = 0.25;
  p.pommel.facetCount = 20;
  p.pommel.balance = 0.1;

  return p;
}

function presetJian(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 2.9;
  p.blade.baseWidth = 0.19;
  p.blade.tipWidth = 0.04;
  p.blade.tipRampStart = 0.78;
  p.blade.crossSection = 'diamond';
  p.blade.bevel = 0.45;
  p.blade.fullerEnabled = true;
  p.blade.fullerDepth = 0.012;
  p.blade.fullerLength = 0.55;
  p.blade.fullerWidth = 0.035;
  p.blade.fullerMode = 'overlay';
  p.blade.fullerCount = 1;
  p.blade.chaos = 0;
  p.blade.edgeType = 'double';
  p.blade.thickness = 0.065;
  p.blade.thicknessLeft = 0.065;
  p.blade.thicknessRight = 0.065;

  p.guard.style = 'bar';
  p.guard.width = 0.42;
  p.guard.thickness = 0.14;
  p.guard.curve = 0.05;
  p.guard.tilt = 0;
  p.guard.guardBlendFillet = 0.12;
  p.guard.guardBlendFilletStyle = 'smooth';
  p.guard.ornamentation = 0.25;

  p.handle.length = 0.8;
  p.handle.radiusTop = 0.115;
  p.handle.radiusBottom = 0.11;
  p.handle.segmentation = false;
  p.handle.wrapEnabled = false;
  (p.handle as any).ovalRatio = 1.05;

  p.pommel.style = 'ring';
  p.pommel.size = 0.15;
  p.pommel.elongation = 1.05;
  p.pommel.shapeMorph = 0.2;
  p.pommel.ringInnerRadius = 0.06;
  p.pommel.balance = 0.08;

  return p;
}

function presetGladius(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 2.2;
  p.blade.baseWidth = 0.28;
  p.blade.tipWidth = 0.12;
  p.blade.tipShape = 'leaf';
  p.blade.tipBulge = 0.65;
  p.blade.tipRampStart = 0.46;
  p.blade.crossSection = 'lenticular';
  p.blade.bevel = 0.55;
  p.blade.fullerEnabled = true;
  p.blade.fullerDepth = 0.014;
  p.blade.fullerLength = 0.58;
  p.blade.fullerWidth = 0.04;
  p.blade.fullerMode = 'overlay';
  p.blade.fullerCount = 1;
  p.blade.edgeType = 'double';
  p.blade.sweepSegments = 88;

  p.guard.style = 'disk';
  p.guard.width = 0.48;
  p.guard.thickness = 0.18;
  p.guard.curve = 0.12;
  p.guard.guardBlendFillet = 0.18;
  p.guard.guardBlendFilletStyle = 'smooth';

  p.handle.length = 0.7;
  p.handle.radiusTop = 0.14;
  p.handle.radiusBottom = 0.13;
  p.handle.segmentation = true;
  (p.handle as any).segmentationCount = 6;
  (p.handle as any).flare = 0.04;
  p.handle.wrapEnabled = false;

  p.pommel.style = 'orb';
  p.pommel.size = 0.2;
  p.pommel.elongation = 0.9;
  p.pommel.shapeMorph = 0.35;
  (p.pommel as any).balance = 0.12;

  return p;
}

function presetKatana(): SwordParams {
  const p = defaultSwordParams();
  // Katana: curved, single-edged look, slender blade, tsuba disk guard, long wrapped handle
  p.blade.length = 3.3;
  p.blade.baseWidth = 0.22;
  p.blade.tipWidth = 0.06;
  p.blade.curvature = 0.25;
  p.blade.thickness = 0.08;
  (p.blade as any).crossSection = 'lenticular';
  (p.blade as any).bevel = 0.6;
  p.blade.fullerEnabled = false;
  p.blade.fullerDepth = 0;
  p.blade.fullerLength = 0;
  (p.blade as any).asymmetry = 0.2;
  p.blade.chaos = 0.05;
  (p.blade as any).edgeType = 'single';
  p.blade.thicknessLeft = 0.1;
  p.blade.thicknessRight = 0.02;
  (p.blade as any).hamonEnabled = true;
  (p.blade as any).hamonWidth = 0.018;
  (p.blade as any).hamonAmplitude = 0.007;
  (p.blade as any).hamonFrequency = 6;
  (p.blade as any).hamonSide = 'right';
  p.guard.style = 'disk';
  p.guard.width = 0.36;
  p.guard.thickness = 0.1;
  p.guard.curve = 0;
  p.guard.tilt = 0;
  (p.blade as any).baseAngle = 0.05;
  (p.blade as any).soriProfile = 'koshi';
  (p.blade as any).soriBias = 0.7;
  (p.blade as any).kissakiLength = 0.12;
  (p.blade as any).kissakiRoundness = 0.6;
  (p.guard as any).habakiEnabled = true;
  (p.guard as any).habakiHeight = 0.06;
  (p.guard as any).habakiMargin = 0.012;
  p.handle.length = 1.1;
  p.handle.radiusTop = 0.11;
  p.handle.radiusBottom = 0.11;
  p.handle.segmentation = false;
  p.handle.wrapEnabled = true;
  (p.handle as any).wrapTexture = true;
  p.handle.wrapTurns = 10;
  p.handle.wrapDepth = 0.012;
  (p.handle as any).ovalRatio = 1.2;
  p.pommel.style = 'disk';
  p.pommel.size = 0.12;
  p.pommel.elongation = 1.0;
  p.pommel.shapeMorph = 0.1;
  return p;
}

function presetClaymore(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 2.8;
  p.blade.baseWidth = 0.32;
  p.blade.tipWidth = 0.08;
  p.blade.curvature = 0.0;
  (p.blade as any).crossSection = 'diamond';
  (p.blade as any).bevel = 0.5;
  p.blade.fullerEnabled = true;
  p.blade.fullerDepth = 0.03;
  p.blade.fullerLength = 0.6;
  p.guard.style = 'winged';
  p.guard.width = 1.6;
  p.guard.thickness = 0.24;
  p.guard.curve = 0.15;
  p.handle.length = 0.9;
  p.handle.radiusTop = 0.13;
  p.handle.radiusBottom = 0.13;
  p.handle.segmentation = false;
  p.pommel.style = 'orb';
  p.pommel.size = 0.18;
  p.pommel.elongation = 1.0;
  p.pommel.shapeMorph = 0.1;
  return p;
}

function presetRapier(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 3.2;
  p.blade.baseWidth = 0.18;
  p.blade.tipWidth = 0.05;
  p.blade.curvature = 0.0;
  (p.blade as any).crossSection = 'diamond';
  (p.blade as any).bevel = 0.3;
  p.blade.fullerEnabled = false;
  p.blade.fullerDepth = 0.0;
  p.blade.fullerLength = 0.0;
  p.guard.style = 'claw';
  p.guard.width = 1.2;
  p.guard.thickness = 0.18;
  p.guard.curve = 0.3;
  p.guard.tilt = 0.1;
  p.handle.length = 1.0;
  p.handle.radiusTop = 0.11;
  p.handle.radiusBottom = 0.11;
  p.handle.segmentation = false;
  p.pommel.style = 'disk';
  p.pommel.size = 0.16;
  p.pommel.elongation = 1.0;
  p.pommel.shapeMorph = 0.3;
  return p;
}

function presetDemon(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 3.6;
  p.blade.baseWidth = 0.28;
  p.blade.tipWidth = 0.02;
  p.blade.curvature = -0.2;
  p.blade.serrationAmplitude = 0.08;
  p.blade.serrationFrequency = 10;
  p.blade.fullerEnabled = true;
  p.blade.fullerDepth = 0.02;
  p.blade.fullerLength = 0.4;
  p.guard.style = 'claw';
  p.guard.width = 1.8;
  p.guard.thickness = 0.28;
  p.guard.curve = -0.5;
  p.guard.tilt = -0.2;
  p.handle.length = 0.9;
  p.handle.radiusTop = 0.13;
  p.handle.radiusBottom = 0.12;
  p.handle.segmentation = true;
  p.pommel.style = 'spike';
  p.pommel.size = 0.18;
  p.pommel.elongation = 1.2;
  p.pommel.shapeMorph = 0.7;
  return p;
}

function presetLightsaber(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 3.05;
  p.blade.baseWidth = 0.085;
  p.blade.tipWidth = 0.085;
  p.blade.tipShape = 'rounded';
  p.blade.thickness = 0.05;
  p.blade.thicknessLeft = 0.05;
  p.blade.thicknessRight = 0.05;
  p.blade.curvature = 0;
  p.blade.sweepSegments = 96;
  (p.blade as any).crossSection = 'hexagonal';
  (p.blade as any).bevel = 0.1;
  p.blade.fullerEnabled = false;
  p.blade.edgeType = 'double';
  (p.blade as any).chaos = 0;
  (p.blade as any).tipRampStart = 0.92;

  p.guardEnabled = false;

  p.handle.length = 1.05;
  p.handle.radiusTop = 0.11;
  p.handle.radiusBottom = 0.11;
  p.handle.segmentation = false;
  p.handle.wrapEnabled = false;
  (p.handle as any).phiSegments = 48;
  (p.handle as any).ovalRatio = 1.0;

  p.pommel.style = 'disk';
  p.pommel.size = 0.12;
  p.pommel.elongation = 1.05;
  p.pommel.shapeMorph = 0.15;
  p.pommel.balance = 0.05;

  return p;
}

function presetSabre(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 3.2;
  p.blade.baseWidth = 0.19;
  p.blade.tipWidth = 0.06;
  p.blade.curvature = 0.32;
  p.blade.edgeType = 'single';
  p.blade.crossSection = 'lenticular';
  p.blade.bevel = 0.6;
  p.blade.thickness = 0.07;
  p.blade.thicknessLeft = 0.09;
  p.blade.thicknessRight = 0.04;
  p.blade.tipRampStart = 0.7;
  p.blade.fullerEnabled = true;
  p.blade.fullerDepth = 0.012;
  p.blade.fullerLength = 0.5;
  p.blade.fullerMode = 'overlay';
  p.blade.fullerCount = 1;
  p.blade.ricassoLength = 0.03;

  p.guard.style = 'knucklebow';
  p.guard.width = 0.75;
  p.guard.thickness = 0.14;
  p.guard.curve = 0.25;
  p.guard.guardBlendFillet = 0.15;
  p.guard.guardBlendFilletStyle = 'smooth';
  (p.guard as any).basketRodCount = 14;
  (p.guard as any).basketRodRadius = 0.018;
  (p.guard as any).basketRingCount = 1;

  p.handle.length = 0.95;
  p.handle.radiusTop = 0.12;
  p.handle.radiusBottom = 0.11;
  p.handle.wrapEnabled = true;
  p.handle.wrapTurns = 7;
  p.handle.wrapDepth = 0.011;
  p.handle.wrapTexture = true;
  p.handle.wrapTexScale = 8;
  p.handle.wrapTexAngle = Math.PI / 5;
  (p.handle as any).ovalRatio = 1.18;

  p.pommel.style = 'wheel';
  p.pommel.size = 0.17;
  p.pommel.elongation = 1.1;
  p.pommel.shapeMorph = 0.22;
  (p.pommel as any).balance = 0.12;

  return p;
}
// Keyboard shortcuts (lazy import): Cmd/Ctrl+/ opens panel, Cmd/Ctrl+K opens search
try {
  window.addEventListener('keydown', async (e) => {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && (e.key === '/' || e.code === 'Slash')) {
      e.preventDefault();
      const mod = await loadHelpPanel();
      mod.openHelpPanel();
    }
    if (meta && e.key?.toLowerCase?.() === 'k') {
      e.preventDefault();
      const mod = await loadHelpPanel();
      mod.openHelpSearch();
    }
    // F1: open help for the focused control row, else open Help panel
    if (e.key === 'F1') {
      e.preventDefault();
      const t = e.target as HTMLElement | null;
      const row = (t && t.closest('.row')) as HTMLElement | null;
      if (row) {
        // Prefer opening the popover via the help icon when present
        const icon = row.querySelector('.help-icon') as HTMLElement | null;
        if (icon) {
          icon.click();
          return;
        }
        // Fallback: open Help panel at this control's topic if possible
        const helpId = row.dataset.field;
        try {
          const mod = await loadHelpPanel();
          if (helpId) mod.openHelpPanel(helpId);
          else mod.openHelpPanel();
        } catch {}
        return;
      }
      // No focused row: act like clicking the Help button
      try {
        const mod = await loadHelpPanel();
        mod.openHelpPanel();
      } catch {}
      return;
    }
    // Explain Mode hotkey (E), ignore when typing in inputs
    if (!meta && !e.altKey && !e.shiftKey && e.key?.toLowerCase?.() === 'e') {
      const t = e.target as HTMLElement | null;
      const tag = (t && (t.tagName || '')).toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable))
        return;
      e.preventDefault();
      btnExplain.click();
    }
  });
} catch {}
// Deep link handler for #help=<id>
const hasHelpHash = () => {
  try {
    return /(?:^|&)help=([^&]+)/.test((location.hash || '').slice(1));
  } catch {
    return false;
  }
};
if (hasHelpHash()) {
  try {
    loadHelpPanel().then((mod) => mod.handleHelpHash());
  } catch {}
}
try {
  window.addEventListener('hashchange', () => {
    if (hasHelpHash()) loadHelpPanel().then((mod) => mod.handleHelpHash());
  });
} catch {}
