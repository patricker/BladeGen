import { defaultSwordParams, type SwordParams } from '../three/SwordGenerator';
import type { Part, MatExt } from './types';

export type PresetRenderOverrides = Partial<{
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
}>;

export type PresetPostOverrides = Partial<{
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
  bladeGradientEnabled: boolean;
  gradBase: string;
  gradEdge: string;
  gradFade: number;
  gradWear: number;
}>;

export type PresetAtmosOverrides = Partial<{
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
}>;

export type PresetFxOverrides = Partial<{
  innerGlow: Partial<{ enabled: boolean; color: string; min: number; max: number; speed: number }>;
  mist: Partial<{
    enabled: boolean;
    color: string;
    density: number;
    speed: number;
    spread: number;
    size: number;
    lifeRate: number;
    turbulence: number;
    windX: number;
    windZ: number;
    emission: 'base' | 'edge' | 'tip' | 'full';
    sizeMinRatio: number;
    occlude: boolean;
  }>;
  flame: Partial<{
    enabled: boolean;
    color1: string;
    color2: string;
    intensity: number;
    speed: number;
    noiseScale: number;
    scale: number;
    direction: 'Up' | 'Down';
    blend: 'Add' | 'Darken' | 'Multiply';
  }>;
  embers: Partial<{ enabled: boolean; count: number; size: number; color: string }>;
  selectiveBloom: boolean;
  heatHaze: boolean;
}>;

export type PresetEntry = {
  id: string;
  label: string;
  build: () => SwordParams;
  materials?: Partial<Record<Part, Partial<MatExt>>>;
  variants?: Array<{
    id?: string;
    name: string;
    description?: string;
    parts: Partial<Record<Part, Partial<MatExt>>>;
  }>;
  render?: PresetRenderOverrides;
  post?: PresetPostOverrides;
  atmos?: PresetAtmosOverrides;
  fx?: PresetFxOverrides;
};

// --- Preset builders ---

export function presetArming(): SwordParams {
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

// Showcase hero default used on initial load (see launch.md)
export function presetShowcaseArming(): SwordParams {
  const p = defaultSwordParams();
  // Blade
  p.blade.length = 2.65;
  p.blade.baseWidth = 0.22;
  p.blade.tipWidth = 0.012;
  p.blade.tipRampStart = 0.82;
  p.blade.tipShape = 'spear';
  p.blade.crossSection = 'diamond' as any;
  p.blade.thickness = 0.07;
  p.blade.thicknessLeft = 0.07;
  p.blade.thicknessRight = 0.07;
  p.blade.fullerEnabled = true;
  p.blade.fullerDepth = 0.015;
  p.blade.fullerLength = 0.55;
  // Some builds expose fullerWidth/count/profile via unions; guard behind any
  ;(p.blade as any).fullerWidth = 0.05;
  p.blade.fullerProfile = 'u' as any;
  p.blade.fullerMode = 'overlay';
  ;(p.blade as any).fullerCount = 1;
  p.blade.ricassoLength = 0.04;
  p.blade.chaos = 0;
  p.blade.edgeType = 'double';

  // Guard
  p.guard.style = 'winged' as any;
  p.guard.width = 1.15;
  p.guard.thickness = 0.18;
  p.guard.curve = 0.0;
  p.guard.tilt = 0.0;
  p.guard.guardBlendFillet = 0.05;
  p.guard.guardBlendFilletStyle = 'smooth';

  // Handle
  p.handle.length = 0.88;
  p.handle.radiusTop = 0.11;
  p.handle.radiusBottom = 0.11;
  p.handle.segmentation = false;
  p.handle.wrapEnabled = true;
  p.handle.wrapTurns = 6;
  p.handle.wrapDepth = 0.01;
  ;(p.handle as any).wrapTexture = true;
  p.handle.wrapTexScale = 9;
  p.handle.wrapTexAngle = Math.PI / 6;
  ;(p.handle as any).ovalRatio = 1.1;

  // Pommel
  p.pommel.style = 'scentStopper' as any;
  p.pommel.size = 0.17;
  p.pommel.elongation = 1.2;
  p.pommel.shapeMorph = 0.25;
  p.pommel.facetCount = 20 as any;
  p.pommel.balance = 0.1 as any;

  return p;
}

export function presetJian(): SwordParams {
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

export function presetGladius(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 2.2;
  p.blade.baseWidth = 0.28;
  p.blade.tipWidth = 0.12;
  p.blade.tipShape = 'leaf';
  p.blade.tipBulge = 0.65;
  p.blade.thickness = 0.08;
  p.blade.thicknessLeft = 0.08;
  p.blade.thicknessRight = 0.08;
  p.blade.curvature = 0;
  p.blade.sweepSegments = 88;
  p.blade.crossSection = 'lenticular';
  p.blade.bevel = 0.5;
  p.blade.fullerEnabled = false;
  p.blade.edgeType = 'double';

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

export function presetKatana(): SwordParams {
  const p = defaultSwordParams();
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

export function presetClaymore(): SwordParams {
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

export function presetRapier(): SwordParams {
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

export function presetDemon(): SwordParams {
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

export function presetLightsaber(): SwordParams {
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

export function presetSabre(): SwordParams {
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
  return p;
}

// --- Gallery presets for launch ---
export function presetRapierCup(): SwordParams {
  const p = defaultSwordParams();
  // Long, slim blade with ricasso
  p.blade.length = 3.35;
  p.blade.baseWidth = 0.18;
  p.blade.tipWidth = 0.045;
  p.blade.crossSection = 'diamond';
  p.blade.bevel = 0.3;
  p.blade.fullerEnabled = false;
  p.blade.ricassoLength = 0.12;
  p.blade.edgeType = 'double';
  p.blade.sweepSegments = 128;

  // Cup/shell guard with extras
  p.guard.style = 'shell';
  (p.guard as any).shellCoverage = 0.85;
  (p.guard as any).shellThickness = 1.0;
  (p.guard as any).shellFlare = 1.2;
  p.guard.width = 1.1;
  p.guard.thickness = 0.2;
  p.guard.tilt = 0.0;
  p.guard.curve = 0.05;
  p.guard.extras = [
    { kind: 'sideRing', radius: 0.14, thickness: 0.018, offsetY: -0.02 },
    { kind: 'fingerGuard', radius: 0.11, thickness: 0.014, offsetY: -0.08 },
  ];
  (p.guard as any).pasDaneCount = 2;
  (p.guard as any).pasDaneRadius = 0.085;
  (p.guard as any).pasDaneThickness = 0.012;
  (p.guard as any).pasDaneOffsetY = -0.02;

  // Handle and pommel
  p.handle.length = 1.02;
  p.handle.radiusTop = 0.105;
  p.handle.radiusBottom = 0.105;
  p.handle.wrapEnabled = false;
  p.pommel.style = 'wheel';
  p.pommel.size = 0.15;
  p.pommel.elongation = 1.0;
  p.pommel.shapeMorph = 0.2;
  (p.pommel as any).peenVisible = true;
  (p.pommel as any).peenSize = 0.02;

  return p;
}

export function presetBasketBroadsword(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 2.6;
  p.blade.baseWidth = 0.27;
  p.blade.tipWidth = 0.06;
  p.blade.crossSection = 'lenticular';
  p.blade.bevel = 0.55;
  p.blade.fullerEnabled = true;
  p.blade.fullerDepth = 0.012;
  p.blade.fullerLength = 0.32;
  p.blade.fullerMode = 'overlay';
  p.blade.fullerCount = 1;

  p.guard.style = 'basket';
  p.guard.width = 1.25;
  p.guard.thickness = 0.22;
  p.guard.curve = 0.1;
  (p.guard as any).basketRodCount = 14;
  (p.guard as any).basketRingCount = 2;
  (p.guard as any).basketRingRadiusAdd = 0.03;
  (p.guard as any).basketRingThickness = 0.012;

  p.handle.length = 0.78;
  p.handle.radiusTop = 0.12;
  p.handle.radiusBottom = 0.12;
  p.handle.wrapEnabled = true;
  p.handle.wrapTurns = 6;
  p.handle.wrapDepth = 0.009;

  p.pommel.style = 'wheel';
  p.pommel.size = 0.18;
  p.pommel.elongation = 1.1;
  p.pommel.shapeMorph = 0.18;
  return p;
}

export function presetJianScholar(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 2.9;
  p.blade.baseWidth = 0.19;
  p.blade.tipWidth = 0.04;
  p.blade.crossSection = 'lenticular';
  p.blade.fullerEnabled = false;
  p.blade.edgeType = 'double';
  p.blade.thickness = 0.065;

  p.guard.style = 'disk';
  p.guard.width = 0.42;
  p.guard.thickness = 0.14;
  p.guard.curve = 0.05;

  p.handle.length = 0.82;
  p.handle.radiusTop = 0.115;
  p.handle.radiusBottom = 0.11;
  p.handle.wrapEnabled = false;
  (p.handle as any).ovalRatio = 1.05;

  p.pommel.style = 'ring';
  p.pommel.size = 0.15;
  p.pommel.elongation = 1.05;
  p.pommel.shapeMorph = 0.2;
  p.pommel.ringInnerRadius = 0.06;

  // Accessories
  p.accessories = {
    scabbard: {
      enabled: true,
      bodyMargin: 0.01,
      bodyThickness: 0.05,
      tipExtension: 0.06,
      throatLength: 0.08,
      throatScale: 1.08,
      locketOffset: 0.22,
      locketLength: 0.12,
      locketScale: 1.06,
      chapeLength: 0.4,
      chapeScale: 0.75,
      bodyRoundness: 0.9,
      offsetX: 0.24,
      offsetZ: -0.02,
      hangAngle: -0.18,
    },
    tassel: {
      enabled: true,
      attachTo: 'guard',
      anchorOffset: 0,
      length: 0.55,
      droop: 0.35,
      sway: 0.2,
      thickness: 0.012,
      tuftSize: 0.03,
      tuftLength: 0.06,
      strands: 20,
    },
  };
  return p;
}

export function presetKatanaMidare(): SwordParams {
  const p = presetKatana();
  (p.blade as any).hamonEnabled = true;
  (p.blade as any).hamonWidth = 0.02;
  (p.blade as any).hamonAmplitude = 0.008;
  (p.blade as any).hamonFrequency = 7;
  (p.blade as any).hamonSide = 'right';
  p.guard.style = 'disk';
  (p.guard as any).habakiEnabled = true;
  (p.guard as any).habakiHeight = 0.06;
  (p.guard as any).habakiMargin = 0.012;
  p.handle.wrapEnabled = true;
  (p.handle as any).wrapStyle = 'hineri';
  (p.handle as any).rayskin = { enabled: true, scale: 8, intensity: 0.5 } as any;
  (p.handle as any).menukiPreset = 'paired';
  return p;
}

export function presetGladiusLeaf(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 2.15;
  p.blade.baseWidth = 0.3;
  p.blade.tipWidth = 0.12;
  p.blade.tipShape = 'leaf';
  p.blade.tipBulge = 0.7;
  p.blade.crossSection = 'lenticular';
  p.blade.bevel = 0.5;
  p.blade.fullerEnabled = false;
  p.guard.style = 'bar';
  p.guard.width = 0.52;
  p.guard.thickness = 0.2;
  p.handle.length = 0.68;
  p.handle.radiusTop = 0.14;
  p.handle.radiusBottom = 0.13;
  p.handle.segmentation = true;
  (p.handle as any).segmentationCount = 6;
  p.pommel.style = 'disk';
  p.pommel.size = 0.2;
  p.pommel.elongation = 0.9;
  p.pommel.shapeMorph = 0.35;
  return p;
}

export function presetKilij(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 3.3;
  p.blade.baseWidth = 0.21;
  p.blade.tipWidth = 0.06;
  p.blade.curvature = 0.42;
  p.blade.crossSection = 'lenticular';
  p.blade.bevel = 0.6;
  p.blade.edgeType = 'single';
  p.blade.falseEdgeLength = 0.18;
  p.blade.falseEdgeDepth = 0.06;
  p.blade.fullerEnabled = true;
  p.blade.fullerDepth = 0.012;
  p.blade.fullerLength = 0.45;
  p.guard.style = 'knucklebow';
  p.guard.width = 1.0;
  p.guard.thickness = 0.2;
  p.guard.curve = 0.1;
  p.handle.length = 0.95;
  p.handle.radiusTop = 0.12;
  p.handle.radiusBottom = 0.11;
  p.handle.wrapEnabled = true;
  p.handle.wrapTurns = 7;
  p.handle.wrapDepth = 0.01;
  p.pommel.style = 'ring';
  p.pommel.size = 0.14;
  p.pommel.ringInnerRadius = 0.05;
  p.pommel.elongation = 1.0;
  p.pommel.shapeMorph = 0.15;
  return p;
}

export function presetFlambergeZweihander(): SwordParams {
  const p = defaultSwordParams();
  p.blade.family = 'flamberge';
  p.blade.length = 3.8;
  p.blade.baseWidth = 0.32;
  p.blade.tipWidth = 0.06;
  p.blade.crossSection = 'diamond';
  p.blade.bevel = 0.45;
  p.blade.ricassoLength = 0.2;
  p.blade.fullerEnabled = false;
  p.blade.waviness = { amplitude: 0.025, frequency: 8, taper: 0.6 };
  p.guard.style = 'swept';
  p.guard.width = 1.6;
  p.guard.thickness = 0.26;
  p.guard.curve = 0.2;
  p.guard.extras = [
    { kind: 'sideRing', radius: 0.18, thickness: 0.02, offsetY: -0.06 },
    { kind: 'loop', radius: 0.14, thickness: 0.018, offsetY: -0.1 },
  ];
  p.handle.length = 1.1;
  p.handle.radiusTop = 0.13;
  p.handle.radiusBottom = 0.13;
  p.handle.wrapEnabled = true;
  p.handle.wrapTurns = 8;
  p.handle.wrapDepth = 0.012;
  p.pommel.style = 'wheel';
  p.pommel.size = 0.2;
  p.pommel.elongation = 1.1;
  p.pommel.shapeMorph = 0.2;
  return p;
}

// Full preset list with materials, variants, and optional render overrides
export const swordPresets: PresetEntry[] = [
  {
    id: 'showcase-arming',
    label: 'Showcase Arming',
    build: presetShowcaseArming,
    materials: {
      blade: {
        color: '#eef4ff',
        metalness: 0.93,
        roughness: 0.15,
        clearcoat: 0.3,
        clearcoatRoughness: 0.28,
        envMapIntensity: 1.6,
        anisotropy: 0.36,
      },
      guard: { color: '#c9a347', metalness: 0.82, roughness: 0.32, anisotropy: 0.28 },
      pommel: { color: '#c9a347', metalness: 0.8, roughness: 0.33, anisotropy: 0.24 },
      handle: { color: '#2f3338', roughness: 0.52, sheen: 0.36, sheenColor: '#556d8a' },
    },
    variants: [
      {
        name: 'Battleworn Steel',
        parts: {
          blade: { color: '#e6ebf5', roughness: 0.24, metalness: 0.88, envMapIntensity: 1.3 },
          guard: { color: '#a6843f', roughness: 0.44, metalness: 0.76 },
          pommel: { color: '#a6843f', roughness: 0.46, metalness: 0.76 },
          handle: { color: '#4a3b2d', roughness: 0.62, sheen: 0.22, sheenColor: '#3d2a1d' },
        },
      },
      {
        name: 'Nocturne',
        parts: {
          blade: {
            color: '#5c6599',
            metalness: 0.7,
            roughness: 0.22,
            envMapIntensity: 1.4,
            anisotropy: 0.18,
          },
          guard: { color: '#3f2a22', metalness: 0.3, roughness: 0.52 },
          pommel: { color: '#3f2a22', metalness: 0.3, roughness: 0.52 },
          handle: { color: '#1f2328', roughness: 0.56, sheen: 0.18 },
        },
      },
      {
        name: 'Ivory & Gold',
        parts: {
          blade: {
            color: '#fdfdf8',
            metalness: 0.95,
            roughness: 0.16,
            envMapIntensity: 1.5,
            anisotropy: 0.24,
          },
          guard: { color: '#e4b972', metalness: 0.86, roughness: 0.32 },
          pommel: { color: '#e4b972', metalness: 0.86, roughness: 0.34 },
          handle: {
            color: '#e8d9b7',
            metalness: 0.02,
            roughness: 0.58,
            sheen: 0.22,
            sheenColor: '#f3e9ce',
          },
        },
      },
      {
        name: 'Damascus Steel',
        description: 'Watered steel with folded pattern and dark fittings.',
        parts: {
          blade: {
            color: '#d0daf0',
            metalness: 0.88,
            roughness: 0.22,
            clearcoat: 0.15,
            clearcoatRoughness: 0.35,
            envMapIntensity: 1.4,
            anisotropy: 0.45,
            anisotropyRotation: 0.1,
            bumpEnabled: true,
            bumpScale: 0.018,
            bumpNoiseScale: 14,
            bumpSeed: 42,
          },
          guard: { color: '#1e1e22', metalness: 0.65, roughness: 0.38, anisotropy: 0.3 },
          pommel: { color: '#1e1e22', metalness: 0.65, roughness: 0.4, anisotropy: 0.28 },
          handle: {
            color: '#1a1416',
            metalness: 0.04,
            roughness: 0.72,
            sheen: 0.18,
            sheenColor: '#2a1e20',
          },
        },
      },
    ],
    render: {
      exposure: 1.15,
      ambient: 0.18,
      keyIntensity: 1.3,
      keyAz: 35,
      keyEl: 22,
      rimIntensity: 0.9,
      rimAz: -145,
      rimEl: 35,
      rimColor: '#9ec9ff',
      envMapIntensity: 1.2,
      bgColor: '#1a202b',
      bgBrightness: 0.6,
    },
    post: {
      vignetteEnabled: true,
      vignetteStrength: 0.15,
      vignetteSoftness: 0.6,
    },
  },
  {
    id: 'rapier-cup',
    label: 'Cup-Hilt Rapier',
    build: presetRapierCup,
    materials: {
      blade: { color: '#edf2ff', metalness: 0.95, roughness: 0.16, envMapIntensity: 1.35, anisotropy: 0.3 },
      guard: { color: '#f2f0eb', metalness: 0.93, roughness: 0.22, anisotropy: 0.6, envMapIntensity: 1.55 },
      handle: { color: '#2f2f3a', metalness: 0.12, roughness: 0.58, sheen: 0.26, sheenColor: '#4c4c61' },
      pommel: { color: '#f2f0eb', metalness: 0.93, roughness: 0.24, anisotropy: 0.5 },
    },
    variants: [
      {
        name: 'Court Gala',
        description: 'Gilt cup, ceremonial finish.',
        parts: {
          guard: { color: '#d5b16a', metalness: 0.9, roughness: 0.28, anisotropy: 0.4 },
          pommel: { color: '#d5b16a', metalness: 0.9, roughness: 0.3 },
          handle: { color: '#332926', roughness: 0.54, sheen: 0.24 },
        },
      },
      {
        name: "Duelist's Shadow",
        description: 'Blackened steel, faint arcane edge.',
        parts: {
          guard: { color: '#1e1e26', metalness: 0.45, roughness: 0.48, anisotropy: 0.25 },
          pommel: { color: '#1e1e26', metalness: 0.45, roughness: 0.5 },
          blade: { color: '#cfd6ff', roughness: 0.18, emissiveColor: '#6a7dff', emissiveIntensity: 0.5 },
        },
      },
    ],
  },
  {
    id: 'basket-broadsword',
    label: 'Basket-Hilt Broadsword',
    build: presetBasketBroadsword,
    materials: {
      blade: { color: '#e0ebff', metalness: 0.9, roughness: 0.2, envMapIntensity: 1.4, anisotropy: 0.28 },
      guard: { color: '#b7c3d9', metalness: 0.82, roughness: 0.3, anisotropy: 0.48 },
      handle: { color: '#3b2e2e', metalness: 0.08, roughness: 0.56, sheen: 0.24, sheenColor: '#523c3c' },
      pommel: { color: '#b7c3d9', metalness: 0.82, roughness: 0.32, anisotropy: 0.46 },
    },
  },
  {
    id: 'jian-scholar',
    label: 'Jian — Scholar\'s Edge',
    build: presetJianScholar,
    materials: {
      blade: { color: '#dbe4ff', metalness: 0.9, roughness: 0.22, envMapIntensity: 1.2, anisotropy: 0.2 },
      guard: { color: '#aab6c7', metalness: 0.82, roughness: 0.32, anisotropy: 0.42 },
      handle: { color: '#463223', metalness: 0.04, roughness: 0.74, sheen: 0.2, sheenColor: '#5f412d' },
      pommel: { color: '#b4bccb', metalness: 0.8, roughness: 0.34, anisotropy: 0.36 },
      scabbard: { color: '#2f2418', metalness: 0.05, roughness: 0.7, sheen: 0.25 },
      tassel: { color: '#7c3f1d', metalness: 0.05, roughness: 0.8, sheen: 0.35, sheenColor: '#d8a273' },
    },
  },
  {
    id: 'katana-midare',
    label: 'Katana — Midare Hamon',
    build: presetKatanaMidare,
    materials: {
      blade: { color: '#d8e6ff', metalness: 0.88, roughness: 0.2, clearcoat: 0.25, clearcoatRoughness: 0.35, envMapIntensity: 1.4, anisotropy: 0.32 },
      guard: { color: '#2f1e14', metalness: 0.4, roughness: 0.46 },
      handle: { color: '#352d25', metalness: 0.05, roughness: 0.58, sheen: 0.28, sheenColor: '#4a3b2d' },
      pommel: { color: '#2c1f16', metalness: 0.45, roughness: 0.42 },
    },
  },
  {
    id: 'gladius-leaf',
    label: 'Gladius (Leaf)',
    build: presetGladiusLeaf,
    materials: {
      blade: { color: '#f0f4ff', metalness: 0.9, roughness: 0.2, envMapIntensity: 1.2 },
      guard: { color: '#d8c4a6', metalness: 0.5, roughness: 0.45 },
      handle: { color: '#9f7a4e', metalness: 0.02, roughness: 0.7 },
      pommel: { color: '#d8c4a6', metalness: 0.5, roughness: 0.45 },
    },
  },
  {
    id: 'kilij',
    label: 'Sabre / Kilij',
    build: presetKilij,
    materials: {
      blade: { color: '#e0ebff', metalness: 0.9, roughness: 0.2, envMapIntensity: 1.4, anisotropy: 0.28 },
      guard: { color: '#b7c3d9', metalness: 0.82, roughness: 0.3, anisotropy: 0.48 },
      handle: { color: '#3b2e2e', metalness: 0.08, roughness: 0.56, sheen: 0.24 },
      pommel: { color: '#b7c3d9', metalness: 0.82, roughness: 0.32 },
    },
  },
  {
    id: 'flamberge-zweihander',
    label: 'Flamberge Zweihänder',
    build: presetFlambergeZweihander,
    materials: {
      blade: { color: '#eef4ff', metalness: 0.93, roughness: 0.16, envMapIntensity: 1.35, anisotropy: 0.24 },
      guard: { color: '#c9a347', metalness: 0.82, roughness: 0.34 },
      handle: { color: '#2f3338', metalness: 0.05, roughness: 0.7, sheen: 0.24 },
      pommel: { color: '#c9a347', metalness: 0.82, roughness: 0.35 },
    },
  },
  {
    id: 'katana',
    label: 'Katana',
    build: presetKatana,
    materials: {
      blade: {
        color: '#d8e6ff',
        metalness: 0.88,
        roughness: 0.2,
        clearcoat: 0.25,
        clearcoatRoughness: 0.35,
        envMapIntensity: 1.4,
        anisotropy: 0.32,
        anisotropyRotation: 0.35,
      },
      guard: {
        color: '#2f1e14',
        metalness: 0.4,
        roughness: 0.46,
        anisotropy: 0.15,
        anisotropyRotation: 0,
        sheen: 0.12,
        sheenColor: '#3d2a1d',
      },
      handle: {
        color: '#352d25',
        metalness: 0.05,
        roughness: 0.58,
        sheen: 0.28,
        sheenColor: '#4a3b2d',
        bumpEnabled: true,
        bumpScale: 0.013,
        bumpNoiseScale: 10,
      },
      pommel: { color: '#2c1f16', metalness: 0.45, roughness: 0.42, anisotropy: 0.22 },
    },
    variants: [
      {
        name: 'Winter Steel',
        description: 'Bright polish with gilt fittings.',
        parts: {
          blade: {
            color: '#eef4ff',
            metalness: 0.93,
            roughness: 0.15,
            clearcoat: 0.3,
            clearcoatRoughness: 0.28,
            envMapIntensity: 1.65,
            anisotropy: 0.38,
            anisotropyRotation: 0.32,
          },
          guard: { color: '#c9a347', metalness: 0.82, roughness: 0.32, anisotropy: 0.28 },
          pommel: { color: '#c9a347', metalness: 0.8, roughness: 0.33, anisotropy: 0.24 },
          handle: { color: '#2f3338', roughness: 0.52, sheen: 0.36, sheenColor: '#556d8a' },
        },
      },
      {
        name: 'Midnight Oni',
        description: 'Indigo temper and lacquered fittings.',
        parts: {
          blade: {
            color: '#5f6aff',
            metalness: 0.72,
            roughness: 0.22,
            emissiveColor: '#4e56ff',
            emissiveIntensity: 1.5,
            anisotropy: 0.24,
            anisotropyRotation: -0.3,
          },
          guard: {
            color: '#140b12',
            metalness: 0.22,
            roughness: 0.56,
            sheen: 0.14,
            sheenColor: '#24121e',
          },
          pommel: { color: '#140b12', metalness: 0.22, roughness: 0.52 },
          handle: { color: '#1c1118', roughness: 0.68, sheen: 0.24, sheenColor: '#391d2e' },
        },
      },
    ],
  },
  {
    id: 'arming',
    label: 'Arming Sword',
    build: presetArming,
    materials: {
      blade: {
        color: '#dde6ff',
        metalness: 0.92,
        roughness: 0.19,
        clearcoat: 0.18,
        clearcoatRoughness: 0.32,
        envMapIntensity: 1.25,
        anisotropy: 0.27,
        anisotropyRotation: 0.02,
      },
      guard: { color: '#c08b2f', metalness: 0.78, roughness: 0.4, anisotropy: 0.24 },
      handle: {
        color: '#4b3526',
        metalness: 0.03,
        roughness: 0.68,
        sheen: 0.3,
        sheenColor: '#5b3e2f',
        bumpEnabled: true,
        bumpScale: 0.011,
        bumpNoiseScale: 9,
      },
      pommel: { color: '#c7a465', metalness: 0.7, roughness: 0.36, anisotropy: 0.3 },
    },
    variants: [
      {
        name: 'Tournament Bright',
        description: 'Polished guard and pommel for ceremony.',
        parts: {
          guard: { color: '#dfe2eb', metalness: 0.92, roughness: 0.24, anisotropy: 0.36 },
          pommel: { color: '#dfe2eb', metalness: 0.92, roughness: 0.26, anisotropy: 0.34 },
          handle: { color: '#3a2b1f', roughness: 0.62, sheen: 0.22 },
        },
      },
      {
        name: 'Battleworn',
        description: 'Patina and soot-stained grip from the field.',
        parts: {
          blade: { color: '#c8ced9', metalness: 0.68, roughness: 0.32 },
          guard: { color: '#5a4332', metalness: 0.45, roughness: 0.58, anisotropy: 0.16 },
          pommel: { color: '#5a4332', metalness: 0.45, roughness: 0.55 },
          handle: { color: '#261710', roughness: 0.76, sheen: 0.16 },
        },
      },
      {
        name: 'Damascus',
        description: 'Folded watered steel with ebony fittings.',
        parts: {
          blade: {
            color: '#c8d4e8',
            metalness: 0.86,
            roughness: 0.24,
            clearcoat: 0.12,
            clearcoatRoughness: 0.38,
            envMapIntensity: 1.35,
            anisotropy: 0.42,
            anisotropyRotation: 0.08,
            bumpEnabled: true,
            bumpScale: 0.016,
            bumpNoiseScale: 14,
            bumpSeed: 42,
          },
          guard: { color: '#2a2024', metalness: 0.6, roughness: 0.42, anisotropy: 0.26 },
          pommel: { color: '#2a2024', metalness: 0.6, roughness: 0.44, anisotropy: 0.24 },
          handle: {
            color: '#1a120e',
            metalness: 0.06,
            roughness: 0.74,
            sheen: 0.15,
            sheenColor: '#3a2a22',
            bumpEnabled: true,
            bumpScale: 0.009,
            bumpNoiseScale: 8,
          },
        },
      },
    ],
  },
  {
    id: 'gladius',
    label: 'Gladius',
    build: presetGladius,
    materials: {
      blade: {
        color: '#f2f5ff',
        metalness: 0.93,
        roughness: 0.18,
        clearcoat: 0.18,
        clearcoatRoughness: 0.3,
        envMapIntensity: 1.35,
        anisotropy: 0.22,
        anisotropyRotation: 0.08,
      },
      guard: { color: '#d1a660', metalness: 0.78, roughness: 0.36, anisotropy: 0.18 },
      handle: {
        color: '#6d4524',
        metalness: 0.05,
        roughness: 0.6,
        sheen: 0.28,
        sheenColor: '#7b512b',
        bumpEnabled: true,
        bumpScale: 0.012,
        bumpNoiseScale: 8,
      },
      pommel: { color: '#d1a660', metalness: 0.78, roughness: 0.38, anisotropy: 0.2 },
    },
    variants: [
      {
        name: 'Legion Standard',
        description: 'Bright blade with bone grip and bronze hardware.',
        parts: {
          blade: {
            color: '#fdfdf8',
            metalness: 0.95,
            roughness: 0.16,
            envMapIntensity: 1.5,
            anisotropy: 0.24,
          },
          handle: {
            color: '#e8d9b7',
            metalness: 0.02,
            roughness: 0.58,
            sheen: 0.22,
            sheenColor: '#f3e9ce',
            bumpEnabled: false,
          },
          guard: { color: '#e4b972', metalness: 0.86, roughness: 0.32 },
          pommel: { color: '#e4b972', metalness: 0.86, roughness: 0.34 },
        },
      },
      {
        name: 'Arena Ember',
        description: 'Heat-blued blade with charred leather grip.',
        parts: {
          blade: {
            color: '#5c6599',
            metalness: 0.7,
            roughness: 0.22,
            emissiveColor: '#ff6b3a',
            emissiveIntensity: 0.6,
            anisotropy: 0.18,
          },
          handle: { color: '#2a1a16', roughness: 0.72, sheen: 0.14 },
          guard: { color: '#3f2a22', metalness: 0.3, roughness: 0.52 },
          pommel: { color: '#3f2a22', metalness: 0.3, roughness: 0.52 },
        },
      },
    ],
  },
  {
    id: 'jian',
    label: 'Jian',
    build: presetJian,
    materials: {
      blade: {
        color: '#e8f0ff',
        metalness: 0.9,
        roughness: 0.2,
        clearcoat: 0.18,
        clearcoatRoughness: 0.32,
        envMapIntensity: 1.3,
        anisotropy: 0.24,
        anisotropyRotation: 0.12,
      },
      guard: { color: '#ad9969', metalness: 0.7, roughness: 0.38, anisotropy: 0.26 },
      handle: {
        color: '#2e342f',
        metalness: 0.08,
        roughness: 0.6,
        sheen: 0.22,
        sheenColor: '#425447',
      },
      pommel: { color: '#ad9969', metalness: 0.7, roughness: 0.36, anisotropy: 0.2 },
    },
    variants: [
      {
        name: "Scholar's River",
        description: 'Blued blade with jade fittings.',
        parts: {
          blade: {
            color: '#b9d7ff',
            emissiveColor: '#53c5ff',
            emissiveIntensity: 0.4,
            anisotropy: 0.3,
            anisotropyRotation: 0.2,
          },
          guard: { color: '#5b8872', metalness: 0.55, roughness: 0.32 },
          pommel: { color: '#5b8872', metalness: 0.55, roughness: 0.32 },
          handle: { color: '#1e2a25', roughness: 0.55 },
        },
      },
      {
        name: 'Imperial Sunset',
        description: 'Gilt fittings and a warm mirror polish.',
        parts: {
          blade: { color: '#f6ede0', metalness: 0.88, roughness: 0.18, envMapIntensity: 1.5 },
          guard: { color: '#e8b055', metalness: 0.9, roughness: 0.3 },
          pommel: { color: '#e8b055', metalness: 0.9, roughness: 0.3 },
          handle: { color: '#3f2116', roughness: 0.64, sheen: 0.24 },
        },
      },
    ],
  },
  {
    id: 'claymore',
    label: 'Claymore',
    build: presetClaymore,
    materials: {
      blade: {
        color: '#dbe4ff',
        metalness: 0.9,
        roughness: 0.22,
        clearcoat: 0.22,
        clearcoatRoughness: 0.38,
        envMapIntensity: 1.2,
        anisotropy: 0.2,
        anisotropyRotation: 0.12,
      },
      guard: {
        color: '#aab6c7',
        metalness: 0.82,
        roughness: 0.32,
        anisotropy: 0.42,
        anisotropyRotation: 1.05,
      },
      handle: {
        color: '#463223',
        metalness: 0.04,
        roughness: 0.74,
        sheen: 0.2,
        sheenColor: '#5f412d',
        bumpEnabled: true,
        bumpScale: 0.013,
        bumpNoiseScale: 8,
      },
      pommel: { color: '#b4bccb', metalness: 0.8, roughness: 0.34, anisotropy: 0.36 },
    },
    variants: [
      {
        name: 'Highland Dawn',
        description: 'Bronzed fittings with a warm blade polish.',
        parts: {
          blade: { color: '#ede2d0', metalness: 0.87, roughness: 0.2 },
          guard: { color: '#c59d64', metalness: 0.78, roughness: 0.38, anisotropy: 0.3 },
          pommel: { color: '#c59d64', metalness: 0.78, roughness: 0.4 },
          handle: { color: '#513a27', roughness: 0.7, sheen: 0.22 },
        },
      },
      {
        name: 'Night Watch',
        description: 'Darkened steel with subtle runic glow.',
        parts: {
          blade: {
            color: '#3f4b60',
            metalness: 0.6,
            roughness: 0.28,
            emissiveColor: '#6586ff',
            emissiveIntensity: 0.8,
            anisotropy: 0.15,
            anisotropyRotation: 0.2,
          },
          guard: { color: '#141820', metalness: 0.3, roughness: 0.6 },
          pommel: { color: '#141820', metalness: 0.3, roughness: 0.55 },
          handle: { color: '#161012', roughness: 0.68 },
        },
      },
    ],
  },
  {
    id: 'rapier',
    label: 'Rapier',
    build: presetRapier,
    materials: {
      blade: {
        color: '#edf2ff',
        metalness: 0.95,
        roughness: 0.16,
        envMapIntensity: 1.35,
        anisotropy: 0.3,
        anisotropyRotation: 0.05,
      },
      guard: {
        color: '#f2f0eb',
        metalness: 0.93,
        roughness: 0.22,
        anisotropy: 0.62,
        anisotropyRotation: 1.3,
        envMapIntensity: 1.55,
      },
      handle: {
        color: '#2f2f3a',
        metalness: 0.12,
        roughness: 0.58,
        sheen: 0.26,
        sheenColor: '#4c4c61',
      },
      pommel: {
        color: '#f2f0eb',
        metalness: 0.93,
        roughness: 0.24,
        anisotropy: 0.5,
        anisotropyRotation: 1.2,
      },
    },
    variants: [
      {
        name: 'Court Gala',
        description: 'Gilt cup hilt for ceremonial display.',
        parts: {
          guard: { color: '#d5b16a', metalness: 0.88, roughness: 0.28, anisotropy: 0.4 },
          pommel: { color: '#d5b16a', metalness: 0.88, roughness: 0.3 },
          handle: { color: '#332926', roughness: 0.54, sheen: 0.24 },
        },
      },
      {
        name: "Duelist's Shadow",
        description: 'Blackened steel with a faint arcane edge.',
        parts: {
          blade: {
            color: '#cfd6ff',
            emissiveColor: '#6a7dff',
            emissiveIntensity: 0.5,
            roughness: 0.18,
          },
          guard: { color: '#1e1e26', metalness: 0.45, roughness: 0.48, anisotropy: 0.25 },
          pommel: { color: '#1e1e26', metalness: 0.45, roughness: 0.5 },
          handle: { color: '#202026', roughness: 0.6 },
        },
      },
    ],
  },
  {
    id: 'demon',
    label: 'Demon Blade',
    build: presetDemon,
    materials: {
      blade: {
        color: '#6f3bff',
        metalness: 0.4,
        roughness: 0.18,
        emissiveColor: '#a64bff',
        emissiveIntensity: 2.8,
        clearcoat: 0.1,
        clearcoatRoughness: 0.6,
        envMapIntensity: 0.9,
      },
      guard: { color: '#2b0d11', metalness: 0.15, roughness: 0.6 },
      handle: {
        color: '#3c0e18',
        metalness: 0.1,
        roughness: 0.7,
        sheen: 0.12,
        sheenColor: '#64162d',
      },
      pommel: { color: '#2b0d11', metalness: 0.2, roughness: 0.55 },
    },
    variants: [
      {
        name: 'Molten Edge',
        description: 'Superheated blade fed by inner fire.',
        parts: {
          blade: {
            color: '#ff8440',
            metalness: 0.35,
            roughness: 0.16,
            emissiveColor: '#ff5a1a',
            emissiveIntensity: 3.6,
          },
          guard: { color: '#3a1208', roughness: 0.58 },
          pommel: { color: '#3a1208', roughness: 0.58 },
        },
      },
      {
        name: 'Voidglass',
        description: 'Translucent blade that siphons light.',
        parts: {
          blade: {
            color: '#3f2b5f',
            metalness: 0.15,
            roughness: 0.08,
            transmission: 0.72,
            ior: 1.48,
            thickness: 0.35,
            attenuationColor: '#6b51bd',
            attenuationDistance: 0.22,
            emissiveColor: '#6f4bff',
            emissiveIntensity: 1.1,
          },
        },
      },
    ],
  },
  {
    id: 'lightsaber',
    label: 'Lightsaber',
    build: presetLightsaber,
    materials: {
      blade: {
        color: '#55ccff',
        metalness: 0.0,
        roughness: 0.15,
        emissiveColor: '#88e5ff',
        emissiveIntensity: 3.0,
        transmission: 0.9,
        ior: 1.15,
        thickness: 0.75,
        clearcoat: 0.0,
        clearcoatRoughness: 0.0,
        envMapIntensity: 0.5,
      },
      handle: {
        color: '#2f2f2f',
        metalness: 0.85,
        roughness: 0.42,
        sheen: 0.2,
        sheenColor: '#444444',
      },
    },
    render: {
      bloomEnabled: true,
      bloomStrength: 1.05,
      bloomThreshold: 0.58,
      bloomRadius: 0.45,
      envMapIntensity: 1.2,
      exposure: 0.95,
    },
  },
  {
    id: 'sabre',
    label: 'Sabre',
    build: presetSabre,
    materials: {
      blade: {
        color: '#e0ebff',
        metalness: 0.9,
        roughness: 0.2,
        clearcoat: 0.2,
        clearcoatRoughness: 0.34,
        envMapIntensity: 1.4,
        anisotropy: 0.28,
        anisotropyRotation: 0.25,
      },
      guard: {
        color: '#b7c3d9',
        metalness: 0.82,
        roughness: 0.3,
        anisotropy: 0.48,
        anisotropyRotation: 1.2,
      },
      handle: {
        color: '#3b2e2e',
        metalness: 0.08,
        roughness: 0.56,
        sheen: 0.24,
        sheenColor: '#523c3c',
      },
      pommel: { color: '#b7c3d9', metalness: 0.82, roughness: 0.32, anisotropy: 0.46 },
    },
    variants: [
      {
        name: 'Cavalry Shine',
        description: 'Highly polished cup hilt with leather grip.',
        parts: {
          blade: {
            color: '#f5f8ff',
            metalness: 0.96,
            roughness: 0.14,
            envMapIntensity: 1.65,
            anisotropy: 0.34,
          },
          guard: { color: '#dde8ff', metalness: 0.95, roughness: 0.24, anisotropy: 0.5 },
          handle: { color: '#36261b', roughness: 0.6, sheen: 0.26, sheenColor: '#5a3c22' },
        },
      },
      {
        name: "Officer's Dress",
        description: 'Gold-plated guard with dark sharkskin grip.',
        parts: {
          guard: { color: '#e2b55a', metalness: 0.9, roughness: 0.32, anisotropy: 0.3 },
          pommel: { color: '#e2b55a', metalness: 0.9, roughness: 0.32, anisotropy: 0.3 },
          handle: { color: '#1b1f23', roughness: 0.52, sheen: 0.28, sheenColor: '#3f4d5c' },
          blade: { color: '#dbe5ff', metalness: 0.88, roughness: 0.18, anisotropy: 0.26 },
        },
      },
    ],
  },
];

// Consumers may compose their own preset arrays using the builders above.
