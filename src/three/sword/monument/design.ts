import type { BladeParams, GuardParams, HandleParams, PommelParams, SwordParams } from '../types';
import { createRng, hashSeed, normalizeSeed, q3, type Rng } from '../rng';
import { FORGED_DEFAULTS } from '../guardForged';
import { MONUMENT_GUARD_DEFAULTS, type MonumentGuardStyle } from './guards';
import catalogueJson from './catalogue.json';

/**
 * Monument sword families (SW10): a planet's sword picks a blade family, a guard, a pommel and a grip from the
 * catalogue (catalogue.json, the owner's tuning table) by planet traits, then reshapes a base sword (the engine's
 * own design, `sword::design`) with that family's recipe.
 *
 * Port contract (docs/HEADLESS.md, "Monument families"):
 * - seed: `monumentSeed(systemSeed, planetId)` = hashSeed("sword-family|" + systemSeed + "|" + planetId), with the
 *   system seed as its u64 decimal string. Any u32 (or string) seed works for `designMonument`.
 * - strengths: `traitStrengths` in catalogue order; weights: `entryWeights` in array order, f64.
 * - picks: one PRNG, createRng(seed); blade, guard, pommel, grip in that order, one `next()` each: r = next() * total,
 *   walk the entries, return the first with r < w (else r -= w); total 0 picks the first entry.
 * - recipes: each stage has its own PRNG, createRng(`${seed}|blade`), `|guard`, `|pommel`, `|grip` (seed = the u32
 *   seed in decimal); draws in statement order; every drawn continuous value goes through q3.
 * - identity: blade 'classic', guard 'forged' (when the base guard is forged), pommel 'native' and grip 'native' keep
 *   the base's values untouched, so a sword that picks all four is the base sword, byte for byte.
 */

export type PlanetTraits = {
  /** worldgen archetype: temperate, ocean, eyeball, desert, barren, ice, lava, hothouse, gas_giant, ... */
  archetype: string;
  gravityG: number;
  /** Mean surface temperature (K): `scan::planet_temps(planet, star).0`. */
  meanTempK: number;
  waterMassFraction: number;
  locked: boolean;
  hasDynamo: boolean;
  dipoleIndex: number;
  volcanismIndex: number;
  moons: number;
  rings: boolean;
  teffK: number;
  eccentricity: number;
  /** 0..1, `scan::habitability(planet, meanTempK)`. */
  habitability: number;
};

type TraitDef = {
  id: string;
  kind: 'ramp' | 'flag' | 'archetype';
  input?: string;
  from?: number;
  to?: number;
  is?: string[];
  gate?: string;
};
type Entry = {
  id: string;
  weight: number;
  affinity: Array<[string, number]>;
  pairs: Array<[string, number]>;
};
export type Catalogue = {
  version: number;
  traits: TraitDef[];
  blades: Entry[];
  guards: Entry[];
  pommels: Entry[];
  grips: Entry[];
};

export const MONUMENT_CATALOGUE = catalogueJson as unknown as Catalogue;

export type MonumentPicks = { blade: string; guard: string; pommel: string; grip: string };
export type MonumentDesign = {
  seed: number;
  picks: MonumentPicks;
  params: SwordParams;
  strengths: Record<string, number>;
};

export function monumentSeed(systemSeed: string, planetId: string): number {
  return hashSeed(`sword-family|${systemSeed}|${planetId}`);
}

function input(t: PlanetTraits, name: string): number {
  const v = (t as any)[name];
  if (typeof v === 'boolean') return v ? 1 : 0;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Each catalogue trait's strength, 0..1. */
export function traitStrengths(t: PlanetTraits, cat: Catalogue = MONUMENT_CATALOGUE) {
  const out: Record<string, number> = {};
  for (const d of cat.traits) {
    let s = 0;
    if (d.kind === 'archetype') {
      s = (d.is ?? []).includes(t.archetype) ? 1 : 0;
    } else if (d.kind === 'flag') {
      s = input(t, d.input ?? '') !== 0 ? 1 : 0;
    } else {
      const from = d.from ?? 0;
      const to = d.to ?? 1;
      s = Math.min(1, Math.max(0, (input(t, d.input ?? '') - from) / (to - from)));
    }
    if (d.gate && input(t, d.gate) === 0) s = 0;
    out[d.id] = s;
  }
  return out;
}

/** Each entry's weight given the strengths and the ids picked so far. */
export function entryWeights(
  entries: Entry[],
  strengths: Record<string, number>,
  picked: string[]
): Array<[string, number]> {
  return entries.map((e) => {
    let w = e.weight;
    for (const [k, m] of e.affinity) w = w * (1 + (m - 1) * (strengths[k] ?? 0));
    for (const [id, m] of e.pairs) if (picked.includes(id)) w = w * m;
    return [e.id, w] as [string, number];
  });
}

function pickWeighted(rng: Rng, ws: Array<[string, number]>): string {
  let total = 0;
  for (const [, w] of ws) total += w;
  let r = rng.next() * total;
  if (!(total > 0)) return ws[0][0];
  for (const [id, w] of ws) {
    if (r < w) return id;
    r -= w;
  }
  for (let i = ws.length - 1; i >= 0; i--) if (ws[i][1] > 0) return ws[i][0];
  return ws[0][0];
}

/** The four picks for a planet. */
export function pickMonument(
  t: PlanetTraits,
  seed: number | string,
  cat: Catalogue = MONUMENT_CATALOGUE
): { picks: MonumentPicks; strengths: Record<string, number> } {
  const strengths = traitStrengths(t, cat);
  const rng = createRng(normalizeSeed(seed));
  const blade = pickWeighted(rng, entryWeights(cat.blades, strengths, []));
  const guard = pickWeighted(rng, entryWeights(cat.guards, strengths, [blade]));
  const pommel = pickWeighted(rng, entryWeights(cat.pommels, strengths, [blade, guard]));
  const grip = pickWeighted(rng, entryWeights(cat.grips, strengths, [blade, guard, pommel]));
  return { picks: { blade, guard, pommel, grip }, strengths };
}

const r3 = (rng: Rng, a: number, b: number) => q3(rng.range(a, b));

/** Drops the engine's per-archetype silhouette (waves, curve, single edge) before a family reshapes the blade. */
function straighten(b: BladeParams) {
  b.family = 'straight';
  delete b.waviness;
  delete b.krisWaveCount;
  b.curvature = 0;
  b.baseAngle = 0;
  b.edgeType = 'double';
  b.thicknessLeft = b.thickness;
  b.thicknessRight = b.thickness;
  b.asymmetry = 0;
}

function noFullers(b: BladeParams) {
  b.fullerEnabled = false;
  delete b.fullers;
}

function shapeBlade(id: string, b: BladeParams, rng: Rng) {
  const bw0 = b.baseWidth;
  const t = b.thickness;
  straighten(b);
  switch (id) {
    case 'greatsword': {
      b.baseWidth = q3(bw0 * rng.range(1.05, 1.2));
      b.tipWidth = q3(b.baseWidth * rng.range(0.06, 0.12));
      b.tipRampStart = r3(rng, 0.6, 0.8);
      b.kissakiLength = r3(rng, 0.12, 0.22);
      b.kissakiRoundness = r3(rng, 0.2, 0.5);
      b.ricassoLength = r3(rng, 0.07, 0.12);
      b.crossSection = rng.pick(['diamond', 'hexagonal'] as const);
      b.bevel = r3(rng, 0.5, 0.85);
      b.tipShape = 'pointed';
      break;
    }
    case 'leaf': {
      b.baseWidth = q3(bw0 * rng.range(1.0, 1.15));
      b.tipWidth = q3(b.baseWidth * rng.range(0.05, 0.1));
      b.tipShape = 'leaf';
      b.tipBulge = r3(rng, 0.45, 0.75);
      b.kissakiLength = r3(rng, 0.1, 0.2);
      b.tipRampStart = 0;
      b.crossSection = rng.pick(['lenticular', 'diamond'] as const);
      break;
    }
    case 'flamberge': {
      b.family = 'flamberge';
      b.waviness = {
        amplitude: q3(b.baseWidth * rng.range(0.12, 0.2)),
        frequency: rng.int(6, 11),
        mode: 'both',
        taper: r3(rng, 0.8, 1.3),
        phase: 0,
        offset: 0,
      };
      b.sweepSegments = 192;
      b.crossSection = 'diamond';
      break;
    }
    case 'falchion': {
      b.edgeType = 'single';
      b.curvature = r3(rng, 0.15, 0.3);
      b.soriProfile = 'saki';
      b.soriBias = r3(rng, 0.8, 1.4);
      b.tipWidth = q3(b.baseWidth * rng.range(0.55, 0.85));
      b.tipShape = 'clip';
      b.kissakiLength = r3(rng, 0.18, 0.3);
      b.kissakiRoundness = r3(rng, 0.3, 0.6);
      b.asymmetry = r3(rng, 0.15, 0.3);
      b.thicknessLeft = q3(t * 0.7);
      b.thicknessRight = q3(t * 1.15);
      b.crossSection = rng.pick(['flat', 'lenticular'] as const);
      break;
    }
    case 'cleaver': {
      b.baseWidth = q3(bw0 * rng.range(1.15, 1.35));
      b.tipWidth = q3(b.baseWidth * rng.range(0.75, 1.0));
      b.tipShape = rng.pick(['rounded', 'sheepsfoot'] as const);
      b.kissakiLength = r3(rng, 0.06, 0.12);
      b.crossSection = 'lenticular';
      b.bevel = r3(rng, 0.3, 0.5);
      b.ricassoLength = r3(rng, 0.1, 0.16);
      break;
    }
    case 'stepped': {
      b.baseWidth = q3(bw0 * rng.range(1.1, 1.25));
      b.tipWidth = q3(b.baseWidth * rng.range(0.05, 0.1));
      const steps = rng.int(2, 3);
      const u1 = r3(rng, 0.22, 0.32);
      const s1 = r3(rng, 0.64, 0.76);
      const pts: Array<[number, number]> = [
        [0, 1],
        [q3(u1 - 0.012), 1],
        [u1, q3(s1 * 0.55)],
        [q3(u1 + 0.015), s1],
      ];
      let last = s1;
      if (steps === 3) {
        const u2 = q3(u1 + rng.range(0.2, 0.28));
        const s2 = q3(s1 * rng.range(0.66, 0.78));
        pts.push([q3(u2 - 0.012), s1], [u2, q3(s2 * 0.55)], [q3(u2 + 0.015), s2]);
        last = s2;
      }
      pts.push([1, last]);
      b.widthProfile = { mode: 'scale', points: pts };
      b.crossSection = 'hexagonal';
      b.bevel = r3(rng, 0.55, 0.8);
      b.sweepSegments = 192;
      b.tipShape = 'pointed';
      noFullers(b);
      break;
    }
    case 'shard': {
      b.baseWidth = q3(bw0 * rng.range(1.05, 1.15));
      b.tipWidth = q3(b.baseWidth * rng.range(0.05, 0.1));
      const k = rng.int(4, 6);
      const pts: Array<[number, number]> = [[0, 1]];
      for (let j = 1; j < k; j++) {
        const u = q3(j / k + rng.range(-0.04, 0.04));
        const v = j % 2 === 1 ? r3(rng, 0.66, 0.78) : r3(rng, 1.15, 1.3);
        pts.push([u, v]);
      }
      pts.push([1, r3(rng, 0.8, 1.0)]);
      b.widthProfile = { mode: 'scale', points: pts };
      b.crossSection = 'diamond';
      b.bevel = r3(rng, 0.85, 1.0);
      const th = q3(t * 1.35);
      b.thickness = th;
      b.thicknessLeft = th;
      b.thicknessRight = th;
      b.chaos = 0;
      b.serrationAmplitude = 0;
      b.serrationAmplitudeLeft = 0;
      b.serrationAmplitudeRight = 0;
      b.serrationFrequency = 0;
      b.serrationSharpness = 0;
      b.serrationPattern = 'sine';
      b.tipShape = 'spear';
      delete b.hollowGrind;
      noFullers(b);
      break;
    }
    case 'serpent': {
      b.family = 'kris';
      b.waviness = {
        amplitude: q3(b.baseWidth * rng.range(0.22, 0.32)),
        frequency: rng.pick([3, 5, 7] as const),
        mode: 'centerline',
        taper: r3(rng, 0.3, 0.7),
        phase: 0,
        offset: 0,
      };
      b.sweepSegments = 192;
      b.crossSection = rng.pick(['diamond', 'hexagonal'] as const);
      break;
    }
    default:
      throw new Error(`unknown monument blade family ${id}`);
  }
  if (b.glow) b.glow.runeStart = q3((b.ricassoLength ?? 0) + 0.06);
}

function shapeGuard(id: string, g: GuardParams, t: PlanetTraits, rng: Rng, widthScale: number) {
  if (id === 'forged') {
    if (g.style !== 'forged') {
      g.style = 'forged';
      g.forged = { ...FORGED_DEFAULTS };
    }
    if (widthScale !== 1) g.width = q3(g.width * widthScale);
    return;
  }
  const span = (a: number, b: number) => (g.width = q3(g.width * widthScale * rng.range(a, b)));
  const m: NonNullable<GuardParams['monument']> = {};
  switch (id) {
    case 'recurve':
      span(1.15, 1.35);
      m.height = r3(rng, 0.34, 0.44);
      m.depth = r3(rng, 2.0, 2.6);
      m.block = r3(rng, 0.45, 0.6);
      m.swell = r3(rng, 1.2, 1.45);
      m.taper = r3(rng, 0.25, 0.4);
      m.sweep = q3(rng.range(0.7, 1.1) * (t.locked ? -1 : 1));
      m.count = 1;
      m.knob = rng.chance(0.4) ? r3(rng, 0.2, 0.5) : 0;
      m.section = r3(rng, 0.4, 1.0);
      m.segments = 32;
      break;
    case 'crescent':
      span(0.85, 1.0);
      m.height = r3(rng, 0.4, 0.5);
      m.depth = r3(rng, 2.2, 2.8);
      m.block = r3(rng, 0.45, 0.6);
      m.swell = r3(rng, 1.0, 1.15);
      m.taper = r3(rng, 0.08, 0.15);
      m.sweep = -r3(rng, 1.7, 2.2);
      m.count = 1;
      m.knob = 0;
      m.section = r3(rng, 0.2, 0.8);
      m.segments = 32;
      break;
    case 'halo':
      span(0.85, 1.05);
      m.height = r3(rng, 0.36, 0.46);
      m.depth = r3(rng, 2.0, 2.6);
      m.block = r3(rng, 0.4, 0.55);
      m.swell = r3(rng, 1.2, 1.4);
      m.taper = 0.2;
      m.sweep = r3(rng, -0.4, 0.4);
      m.count = Math.min(4, 2 + (t.moons >= 2 ? 1 : 0) + (t.moons >= 4 ? 1 : 0));
      m.spike = r3(rng, 0.5, 0.85);
      m.ring = r3(rng, 0.55, 0.75);
      m.section = r3(rng, 0.5, 1.0);
      break;
    case 'wings':
      span(1.2, 1.45);
      m.height = r3(rng, 0.36, 0.46);
      m.depth = r3(rng, 1.6, 2.2);
      m.block = r3(rng, 0.4, 0.55);
      m.swell = r3(rng, 1.0, 1.2);
      m.taper = r3(rng, 0.18, 0.3);
      m.sweep = r3(rng, 0.8, 1.2);
      m.count = rng.int(3, 5);
      m.section = r3(rng, -0.4, 0.1);
      m.segments = 24;
      break;
    case 'talon':
      span(0.8, 0.95);
      m.height = r3(rng, 0.48, 0.6);
      m.depth = r3(rng, 2.4, 3.0);
      m.block = r3(rng, 0.5, 0.65);
      m.swell = r3(rng, 1.0, 1.15);
      m.taper = r3(rng, 0.06, 0.12);
      m.sweep = r3(rng, 1.9, 2.5);
      m.count = rng.int(2, 3);
      m.section = r3(rng, 0.3, 0.9);
      m.segments = 24;
      break;
    case 'ziggurat':
      span(0.9, 1.05);
      m.height = r3(rng, 0.44, 0.56);
      m.depth = r3(rng, 2.2, 2.8);
      m.block = r3(rng, 0.5, 0.7);
      m.swell = 1;
      m.taper = r3(rng, 0.7, 0.85);
      m.count = rng.int(2, 4);
      m.spike = r3(rng, 0.6, 1.4);
      m.section = r3(rng, -1.0, -0.8);
      break;
    default:
      throw new Error(`unknown monument guard ${id}`);
  }
  g.style = id as GuardParams['style'];
  delete g.forged;
  // written in full, in the defaults' key order, as validation writes it back (the engine stores it so)
  g.monument = { ...MONUMENT_GUARD_DEFAULTS[id as MonumentGuardStyle], ...m };
  g.quillonCount = 0;
}

function shapePommel(id: string, p: PommelParams, t: PlanetTraits, rng: Rng) {
  if (id === 'native') return;
  const size0 = p.size;
  switch (id) {
    case 'gem':
      p.size = q3(size0 * rng.range(1.0, 1.2));
      p.elongation = r3(rng, 1.0, 1.4);
      p.shapeMorph = r3(rng, 0, 1);
      break;
    case 'sunwheel':
      p.size = q3(size0 * rng.range(1.0, 1.2));
      p.crownSpikes = Math.min(12, 6 + t.moons);
      p.crownSharpness = r3(rng, 0.4, 0.9);
      break;
    case 'horned':
      p.size = q3(size0 * rng.range(0.9, 1.1));
      p.elongation = r3(rng, 0.9, 1.3);
      p.shapeMorph = r3(rng, 0, 1);
      break;
    case 'tiered':
      p.size = q3(size0 * rng.range(1.0, 1.2));
      p.elongation = r3(rng, 1.0, 1.5);
      p.crownSpikes = rng.int(3, 5);
      break;
    default:
      throw new Error(`unknown monument pommel ${id}`);
  }
  p.style = id as PommelParams['style'];
  delete p.ringInnerRadius;
}

function shapeGrip(id: string, h: HandleParams, rng: Rng) {
  const hh = h as HandleParams & { segmentationCount?: number; flare?: number };
  switch (id) {
    case 'native':
      return;
    case 'ridged':
      hh.segmentation = true;
      hh.segmentationCount = rng.int(8, 14);
      hh.flare = r3(rng, 0, 0.02);
      hh.wrapStyle = 'none';
      break;
    case 'smooth':
      hh.segmentation = false;
      hh.flare = r3(rng, 0.02, 0.05);
      hh.ovalRatio = r3(rng, 1.0, 1.1);
      hh.wrapStyle = 'none';
      break;
    case 'wound':
      hh.segmentation = true;
      hh.segmentationCount = rng.int(4, 6);
      hh.wrapStyle = 'wire';
      break;
    case 'banded':
      hh.segmentation = true;
      hh.segmentationCount = rng.int(3, 5);
      hh.ovalRatio = r3(rng, 1.1, 1.25);
      hh.flare = 0;
      hh.wrapStyle = 'none';
      break;
    default:
      throw new Error(`unknown monument grip ${id}`);
  }
}

/** The planet's monument sword: the base sword reshaped by the picked family (see the file comment). */
export function designMonument(
  base: SwordParams,
  traits: PlanetTraits,
  seed: number | string,
  cat: Catalogue = MONUMENT_CATALOGUE,
  force?: Partial<MonumentPicks>
): MonumentDesign {
  const s = normalizeSeed(seed);
  const picked = pickMonument(traits, s, cat);
  const strengths = picked.strengths;
  // `force` (catalogue sheets, the site, tests) overrides picks after the draws; the recipes are the same
  const picks: MonumentPicks = { ...picked.picks, ...(force ?? {}) };
  const params: SwordParams = JSON.parse(JSON.stringify(base));
  const bw0 = params.blade.baseWidth;
  if (picks.blade !== 'classic') shapeBlade(picks.blade, params.blade, createRng(`${s}|blade`));
  const widthScale = params.blade.baseWidth / bw0;
  shapeGuard(picks.guard, params.guard, traits, createRng(`${s}|guard`), widthScale);
  shapePommel(picks.pommel, params.pommel, traits, createRng(`${s}|pommel`));
  shapeGrip(picks.grip, params.handle, createRng(`${s}|grip`));
  return { seed: s, picks, params, strengths };
}
