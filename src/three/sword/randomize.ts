import type { SwordParams, BladeParams, GuardStyle, PommelStyle } from './types';
import { defaultSwordParams } from './defaults';
import { createRng, normalizeSeed, q3, type Rng } from './rng';

/**
 * Seeded sword randomizer.
 *
 * `randomSword(seed)` returns params (plus a material look) that validate
 * cleanly and read well as a giant monument: broad blades, strong crosses,
 * big pommels, low-frequency edge features, carved (not overlay) fullers and an
 * exportable glow channel. Combinations that read as clutter or break at scale
 * (basket/shell/knucklebow/swept guards, high-frequency serration, scabbards,
 * tassels, engravings, canvas textures) are never produced.
 *
 * Determinism contract (for ports): every random draw goes through the mulberry32
 * `Rng` in ./rng.ts, in exactly the order the code below makes them, and every
 * continuous output is quantized with `q3`. A port must transcribe this file
 * statement by statement; reordering draws changes every later value.
 */

export type RandomStyle = 'monument';

export type MonumentArchetype =
  | 'greatsword'
  | 'flamberge'
  | 'leaf'
  | 'kris'
  | 'cleaver'
  | 'spire'
  | 'crescent'
  | 'serrated';

/** Archetype weights: favour the clearest silhouettes. */
export const MONUMENT_ARCHETYPES: ReadonlyArray<readonly [MonumentArchetype, number]> = [
  ['greatsword', 3],
  ['flamberge', 2],
  ['leaf', 2],
  ['kris', 1.5],
  ['cleaver', 1.5],
  ['spire', 1.5],
  ['crescent', 1],
  ['serrated', 1],
];

/** Glow colours (sRGB). Planet code usually overrides this with the star's hue. */
export const GLOW_PALETTE = [
  '#7fd8ff',
  '#5cf2d6',
  '#b48cff',
  '#ffb347',
  '#ffd36e',
  '#ff7aa8',
  '#8dff7a',
  '#9fb4ff',
] as const;

const BLADE_METALS = [
  { color: '#c9d3e6', metalness: 0.9, roughness: 0.28 },
  { color: '#e6e1d3', metalness: 0.85, roughness: 0.32 },
  { color: '#9aa8bf', metalness: 0.92, roughness: 0.24 },
  { color: '#3d414c', metalness: 0.8, roughness: 0.38 },
  { color: '#d6c39a', metalness: 0.88, roughness: 0.3 },
  { color: '#bfe3f2', metalness: 0.6, roughness: 0.18 },
] as const;

const FITTINGS = [
  { color: '#c9a54a', metalness: 0.9, roughness: 0.3 },
  { color: '#a8743a', metalness: 0.85, roughness: 0.38 },
  { color: '#2a2a30', metalness: 0.7, roughness: 0.42 },
  { color: '#b8bcc6', metalness: 0.9, roughness: 0.3 },
  { color: '#4f8a7a', metalness: 0.6, roughness: 0.5 },
  { color: '#d9cfb8', metalness: 0.1, roughness: 0.6 },
] as const;

const GRIPS = ['#2b1d14', '#1c1c22', '#3a2a3a', '#20302c'] as const;

export type RandomSwordResult = {
  seed: number;
  style: RandomStyle;
  archetype: MonumentArchetype;
  params: SwordParams;
  materials: Record<'blade' | 'guard' | 'handle' | 'pommel', Record<string, any>>;
};

const r3 = (rng: Rng, a: number, b: number) => q3(rng.range(a, b));

function shapeBlade(rng: Rng, kind: MonumentArchetype, b: BladeParams) {
  b.sweepSegments = 128;
  switch (kind) {
    case 'greatsword': {
      b.length = r3(rng, 3.0, 4.0);
      b.baseWidth = r3(rng, 0.38, 0.55);
      b.tipWidth = r3(rng, 0.02, 0.06);
      b.tipRampStart = r3(rng, 0.55, 0.8);
      b.kissakiLength = r3(rng, 0.12, 0.25);
      b.kissakiRoundness = r3(rng, 0.2, 0.6);
      b.ricassoLength = r3(rng, 0.05, 0.1);
      b.crossSection = rng.pick(['diamond', 'hexagonal', 'lenticular'] as const);
      break;
    }
    case 'flamberge': {
      b.family = 'flamberge';
      b.length = r3(rng, 3.2, 4.2);
      b.baseWidth = r3(rng, 0.34, 0.48);
      b.tipWidth = r3(rng, 0.02, 0.05);
      b.ricassoLength = r3(rng, 0.08, 0.14);
      b.crossSection = rng.pick(['diamond', 'lenticular'] as const);
      b.waviness = {
        amplitude: q3(b.baseWidth * rng.range(0.12, 0.2)),
        frequency: rng.int(6, 10),
        mode: 'both',
        taper: r3(rng, 0.8, 1.4),
        phase: 0,
        offset: 0,
      };
      b.sweepSegments = 192;
      break;
    }
    case 'leaf': {
      b.length = r3(rng, 2.8, 3.6);
      b.baseWidth = r3(rng, 0.34, 0.48);
      b.tipWidth = r3(rng, 0.02, 0.06);
      b.tipShape = 'leaf';
      b.tipBulge = r3(rng, 0.35, 0.7);
      b.crossSection = rng.pick(['diamond', 'lenticular', 'compound'] as const);
      break;
    }
    case 'kris': {
      b.family = 'kris';
      b.krisWaveCount = rng.pick([5, 7, 9] as const);
      b.length = r3(rng, 3.0, 3.8);
      b.baseWidth = r3(rng, 0.4, 0.55);
      b.tipWidth = r3(rng, 0.02, 0.05);
      b.crossSection = rng.pick(['diamond', 'hexagonal'] as const);
      b.sweepSegments = 192;
      break;
    }
    case 'cleaver': {
      b.length = r3(rng, 2.8, 3.5);
      b.baseWidth = r3(rng, 0.45, 0.65);
      b.tipWidth = q3(b.baseWidth * rng.range(0.6, 0.9));
      b.edgeType = 'single';
      const t = r3(rng, 0.09, 0.14);
      b.thickness = t;
      b.thicknessLeft = q3(t * 0.7);
      b.thicknessRight = q3(t * 1.3);
      b.tipShape = rng.pick(['clip', 'sheepsfoot', 'tanto'] as const);
      b.kissakiLength = r3(rng, 0.15, 0.3);
      b.curvature = r3(rng, 0, 0.15);
      b.crossSection = 'flat';
      b.bevel = r3(rng, 0.5, 0.9);
      break;
    }
    case 'spire': {
      b.length = r3(rng, 3.6, 4.4);
      b.baseWidth = r3(rng, 0.3, 0.4);
      b.tipWidth = 0.01;
      b.tipShape = 'spear';
      b.tipRampStart = r3(rng, 0.5, 0.7);
      b.kissakiLength = r3(rng, 0.2, 0.3);
      b.crossSection = 'diamond';
      b.bevel = r3(rng, 0.6, 1.0);
      if (rng.chance(0.25)) b.twistAngle = r3(rng, 0.4, 1.2);
      break;
    }
    case 'crescent': {
      b.length = r3(rng, 3.0, 3.8);
      b.baseWidth = r3(rng, 0.32, 0.45);
      b.tipWidth = r3(rng, 0.03, 0.08);
      b.curvature = r3(rng, 0.25, 0.45);
      b.soriProfile = rng.pick(['torii', 'saki'] as const);
      b.edgeType = 'single';
      const t = r3(rng, 0.08, 0.12);
      b.thickness = t;
      b.thicknessLeft = q3(t * 0.75);
      b.thicknessRight = q3(t * 1.25);
      b.tipShape = rng.pick(['pointed', 'clip'] as const);
      b.kissakiLength = r3(rng, 0.1, 0.2);
      b.crossSection = 'lenticular';
      break;
    }
    case 'serrated': {
      b.length = r3(rng, 3.0, 3.8);
      b.baseWidth = r3(rng, 0.42, 0.58);
      b.tipWidth = r3(rng, 0.03, 0.07);
      b.tipRampStart = r3(rng, 0.6, 0.8);
      b.kissakiLength = r3(rng, 0.12, 0.2);
      b.serrationPattern = rng.pick(['scallop', 'saw'] as const);
      b.serrationFrequency = rng.int(8, 16);
      const amp = q3(b.baseWidth * rng.range(0.06, 0.1));
      b.serrationAmplitude = amp;
      b.serrationAmplitudeLeft = amp;
      b.serrationAmplitudeRight = amp;
      b.serrationSharpness = r3(rng, 0.4, 0.8);
      b.crossSection = rng.pick(['diamond', 'hexagonal'] as const);
      break;
    }
  }
  if (b.edgeType !== 'single') {
    const t = q3(b.baseWidth * rng.range(0.22, 0.32));
    b.thickness = t;
    b.thicknessLeft = t;
    b.thicknessRight = t;
  }
  if (b.bevel === undefined) b.bevel = r3(rng, 0.4, 0.8);
}

function guardStyleFor(rng: Rng, kind: MonumentArchetype): GuardStyle {
  switch (kind) {
    case 'spire':
      return rng.weighted([
        ['disk', 3],
        ['bar', 1],
      ] as const);
    case 'kris':
    case 'serrated':
      return rng.weighted([
        ['claw', 2],
        ['winged', 1],
      ] as const);
    case 'cleaver':
      return rng.weighted([
        ['bar', 2],
        ['claw', 1],
      ] as const);
    default:
      return rng.weighted([
        ['winged', 3],
        ['bar', 2],
        ['claw', 1],
        ['disk', 0.5],
      ] as const);
  }
}

function pommelStyleFor(rng: Rng, kind: MonumentArchetype): PommelStyle {
  switch (kind) {
    case 'spire':
      return rng.pick(['ring', 'wheel', 'scentStopper'] as const);
    case 'flamberge':
    case 'serrated':
      return rng.pick(['crown', 'spike', 'orb'] as const);
    case 'cleaver':
      return rng.pick(['fishtail', 'disk', 'wheel'] as const);
    default:
      return rng.weighted([
        ['orb', 2],
        ['wheel', 2],
        ['scentStopper', 1.5],
        ['crown', 1],
        ['ring', 1],
        ['disk', 1],
      ] as const);
  }
}

/** Seed in, valid giant-sword params and look out. */
export function randomSword(
  seed: number | string,
  opts: { style?: RandomStyle } = {}
): RandomSwordResult {
  const style: RandomStyle = opts.style ?? 'monument';
  const seed32 = normalizeSeed(seed);
  const rng = createRng(seed32);
  const archetype = rng.weighted(MONUMENT_ARCHETYPES);
  const p = defaultSwordParams();
  const b = p.blade;
  shapeBlade(rng, archetype, b);

  // Carved fullers on straight double-edged blades (overlay ribbons read as strips).
  const fullerOk = archetype === 'greatsword' || archetype === 'leaf' || archetype === 'serrated';
  if (fullerOk && rng.chance(0.6)) {
    b.fullerEnabled = true;
    b.fullerMode = 'carve';
    b.fullerCount = rng.chance(0.75) ? 1 : 2;
    b.fullerProfile = rng.pick(['u', 'v'] as const);
    b.fullerWidth = q3(b.baseWidth * rng.range(0.16, 0.26));
    b.fullerInset = q3(b.thickness * rng.range(0.18, 0.3));
    // Depth 0: carve only. A non-zero depth also adds overlay ribbons (pale strips).
    b.fullerDepth = 0;
    b.fullerLength = r3(rng, 0.55, 0.8);
  }
  b.chaos = rng.chance(0.3) ? r3(rng, 0.02, 0.1) : 0;

  // Guard: a strong cross several blade-widths wide.
  const g = p.guard;
  g.style = guardStyleFor(rng, archetype);
  g.width = q3(Math.min(2.6, Math.max(1.0, b.baseWidth * rng.range(3.2, 5.0))));
  g.thickness = r3(rng, 0.16, 0.3);
  g.curve = g.style === 'bar' || g.style === 'disk' ? 0 : r3(rng, -0.6, 0.6);
  g.tipSharpness = r3(rng, 0.3, 0.9);
  g.ornamentation = r3(rng, 0, 0.6);
  // decorateGuard places quillons at width/2 + length/2, which only meets a bar's ends.
  g.quillonCount = g.style === 'bar' && rng.chance(0.5) ? 2 : 0;
  g.quillonLength = r3(rng, 0.15, 0.35);
  if (g.style === 'disk') {
    g.width = q3(Math.min(1.8, Math.max(0.9, b.baseWidth * rng.range(2.6, 3.6))));
    g.thickness = r3(rng, 0.12, 0.2);
    g.cutoutCount = rng.int(0, 8);
    g.cutoutRadius = r3(rng, 0.3, 0.6);
  }

  // Grip: long two-hander proportions.
  const h = p.handle;
  h.length = q3(b.length * rng.range(0.24, 0.32));
  h.radiusTop = r3(rng, 0.1, 0.14);
  h.radiusBottom = q3(h.radiusTop * rng.range(0.85, 1.05));
  h.segmentation = rng.chance(0.5);
  h.wrapStyle = rng.weighted([
    ['none', 2],
    ['crisscross', 2],
    ['wire', 1],
  ] as const);
  h.wrapTurns = rng.int(5, 9);
  h.wrapTexture = false;

  // Pommel: big enough to read as a counterweight.
  const pm = p.pommel;
  pm.style = pommelStyleFor(rng, archetype);
  pm.size = q3(Math.min(0.34, b.baseWidth * rng.range(0.45, 0.7)));
  pm.shapeMorph = r3(rng, 0, 0.6);
  pm.elongation = r3(rng, 0.9, 1.3);
  pm.crownSpikes = rng.int(5, 9);
  pm.crownSharpness = r3(rng, 0.4, 0.9);
  pm.spikeLength = r3(rng, 0.6, 1.2);
  pm.ringInnerRadius = q3(pm.size * rng.range(0.35, 0.55));

  // Glow channel.
  const glowColor = rng.pick(GLOW_PALETTE);
  b.glow = {
    enabled: true,
    color: glowColor,
    intensity: r3(rng, 3, 6),
    edgeWidth: r3(rng, 0.04, 0.08),
    edgeMask: 1,
    coreWidth: r3(rng, 0.08, 0.16),
    coreMask: r3(rng, 0.2, 0.5),
    runeCount: rng.int(5, 9),
    runeSeed: Math.floor(rng.next() * 4294967296),
    runeStart: r3(rng, 0.1, 0.18),
    runeEnd: r3(rng, 0.6, 0.75),
    runeScale: r3(rng, 0.4, 0.6),
    runeStroke: r3(rng, 0.12, 0.18),
    runeFaces: 'both',
    pulseHz: r3(rng, 0.2, 0.8),
  };

  const metal = rng.pick(BLADE_METALS);
  const fit = rng.pick(FITTINGS);
  const grip = rng.pick(GRIPS);
  const materials = {
    blade: { ...metal },
    guard: { ...fit },
    pommel: { ...fit },
    handle: { color: grip, metalness: 0.05, roughness: 0.75 },
  };
  return { seed: seed32, style, archetype, params: p, materials };
}
