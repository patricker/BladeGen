import type { SwordParams } from '../types';
import { callCore } from '../core/wasm';
import catalogueJson from './catalogue.json';

/**
 * Monument sword families (SW10): a planet's sword picks a blade family, a guard, a pommel and a grip from the
 * catalogue (catalogue.json, the owner's tuning table) by planet traits, then reshapes a base sword (the engine's
 * own design, `sword::design`) with that family's recipe.
 *
 * The implementation is bladegen-core's (BG1: `crates/bladegen-core/src/families.rs`, through the wasm module);
 * the galaxy kit links the same crate. The contract (docs/HEADLESS.md, "Monument families"):
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
export type Entry = {
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

/** The catalogue argument for the core: none for the compiled-in table (this file's catalogue.json). */
function catArg(cat: Catalogue | undefined): { catalogue?: Catalogue } {
  return cat && cat !== MONUMENT_CATALOGUE ? { catalogue: cat } : {};
}

export function monumentSeed(systemSeed: string, planetId: string): number {
  return callCore<number>('monument_seed', { systemSeed: String(systemSeed), planetId }).value;
}

/** Each catalogue trait's strength, 0..1. */
export function traitStrengths(t: PlanetTraits, cat: Catalogue = MONUMENT_CATALOGUE): Record<string, number> {
  return callCore('trait_strengths', { traits: t, ...catArg(cat) }).value;
}

/** Each entry's weight given the strengths and the ids picked so far. */
export function entryWeights(
  entries: Entry[],
  strengths: Record<string, number>,
  picked: string[]
): Array<[string, number]> {
  return callCore('entry_weights', { entries, strengths, picked }).value;
}

/** The four picks for a planet. */
export function pickMonument(
  t: PlanetTraits,
  seed: number | string,
  cat: Catalogue = MONUMENT_CATALOGUE
): { picks: MonumentPicks; strengths: Record<string, number> } {
  return callCore('pick_monument', { traits: t, seed, ...catArg(cat) }).value;
}

/**
 * Key order of the objects the recipes write whole (the core serialises its structs in field order; the params
 * JSON keeps the order bladegen's recipes always wrote, so exported documents do not change).
 */
const RECIPE_KEY_ORDER: Record<string, string[]> = {
  waviness: ['amplitude', 'frequency', 'mode', 'taper', 'phase', 'offset'],
  widthProfile: ['mode', 'points'],
};

function ordered(key: string, v: unknown): unknown {
  const order = RECIPE_KEY_ORDER[key];
  if (!order || !v || typeof v !== 'object' || Array.isArray(v)) return v;
  const o = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of order) if (k in o) out[k] = o[k];
  for (const k of Object.keys(o)) if (!(k in out)) out[k] = o[k];
  return out;
}

/** Applies the core's patch (`[path, value]` sets, `[path]` deletes) to a deep copy of the base. */
function applyPatch(base: SwordParams, patch: Array<[string[], unknown?]>): SwordParams {
  const out: any = JSON.parse(JSON.stringify(base));
  const touched = new Set<string>();
  for (const [path, ...rest] of patch) {
    let o = out;
    for (const k of path.slice(0, -1)) {
      if (o[k] === undefined || o[k] === null || typeof o[k] !== 'object') o[k] = {};
      o = o[k];
    }
    const last = path[path.length - 1];
    if (rest.length) o[last] = rest[0];
    else delete o[last];
    if (path.length >= 2) touched.add(`${path[0]}.${path[1]}`);
  }
  // a recipe writes these objects whole: the recipe's key order (also when only some fields changed); `waviness`
  // is always written after `straighten` deleted it, so it ends the blade object as it did in the TypeScript
  for (const t of touched) {
    const [part, key] = t.split('.');
    if (out[part] && key in RECIPE_KEY_ORDER && out[part][key] !== undefined) {
      const v = ordered(key, out[part][key]);
      if (key === 'waviness') delete out[part][key];
      out[part][key] = v;
    }
  }
  return out;
}

/** The planet's monument sword: the base sword reshaped by the picked family (see the file comment). */
export function designMonument(
  base: SwordParams,
  traits: PlanetTraits,
  seed: number | string,
  cat: Catalogue = MONUMENT_CATALOGUE,
  force?: Partial<MonumentPicks>
): MonumentDesign {
  const r = callCore<{
    seed: number;
    picks: MonumentPicks;
    strengths: Record<string, number>;
    patch: Array<[string[], unknown?]>;
  }>('design_monument', { base, traits, seed, force: force ?? null, ...catArg(cat) }).value;
  const params = applyPatch(base, r.patch);
  // `straighten` (every blade family but `classic`) also drops `krisWaveCount`, a field the core does not model
  if (r.picks.blade !== 'classic' && params.blade) delete (params.blade as any).krisWaveCount;
  return { seed: r.seed, picks: r.picks, params, strengths: r.strengths };
}
