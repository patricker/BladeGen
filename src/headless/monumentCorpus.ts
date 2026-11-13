/**
 * Monument family conformance corpus (SW10) for ports of `monument/` (strokes, guards, pommels, design).
 *
 *   npm run monument-corpus -- --out <dir> [--designs <designs.json>] [--seeds 48] [--glb]
 *
 * Writes into <dir>:
 *   picks.json        the pick table: for each trait profile x seed (on the giant `monument` preset base):
 *                     traits, seed, strengths, every stage's weights, picks and the designed params. A port must
 *                     match every row exactly (JSON equality; numbers are f64 written by JSON.stringify).
 *   <id>.case.json    a mesh case's inputs and outputs: {base, traits, seed, force, picks, params}
 *   <id>.validated.json, <id>.mesh.json, <id>.mesh.bin   as the SW1 fixtures (docs/HEADLESS.md, mesh dump v1)
 *   <id>.glb          with --glb, the monument export (the base doc's monument, else heightM 36, sink 0.12)
 *   index.json        one row per mesh case: id, kind, picks, mesh names
 *   catalogue.json    the catalogue the corpus was made with (monument/catalogue.json)
 * Mesh cases: every guard style (defaults and a variant), every pommel style (two variants), every blade family,
 * and, with --designs, real engine designs ([{id, system_seed, planet_id, traits, base: {model, materials,
 * monument}}]) designed with `monumentSeed(system_seed, planet_id)`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { validateSwordParams } from '../three/sword/validation';
import { giantPresets } from '../components/presets';
import {
  MONUMENT_CATALOGUE,
  designMonument,
  entryWeights,
  monumentSeed,
  traitStrengths,
  type MonumentPicks,
  type PlanetTraits,
} from '../three/sword/monument/design';
import { MONUMENT_GUARD_STYLES } from '../three/sword/monument/guards';
import { MONUMENT_POMMEL_STYLES } from '../three/sword/monument/pommels';
import type { SwordParams } from '../three/sword/types';
import { buildSword, dumpMeshes, exportGLB, prepareExport } from './index';
import { parseArgs } from './gen';

const baseDir = process.env.INIT_CWD || process.cwd();

/** Trait profiles: together they put every catalogue trait at 0, in between and at 1. */
export const TRAIT_PROFILES: Array<[string, PlanetTraits]> = [
  [
    'temperate',
    {
      archetype: 'temperate',
      gravityG: 1.0,
      meanTempK: 288,
      waterMassFraction: 0.02,
      locked: false,
      hasDynamo: true,
      dipoleIndex: 0.5,
      volcanismIndex: 0.2,
      moons: 1,
      rings: false,
      teffK: 5600,
      eccentricity: 0.02,
      habitability: 0.82,
    },
  ],
  [
    'ocean',
    {
      archetype: 'ocean',
      gravityG: 1.1,
      meanTempK: 300,
      waterMassFraction: 0.08,
      locked: false,
      hasDynamo: true,
      dipoleIndex: 0.3,
      volcanismIndex: 0.1,
      moons: 2,
      rings: false,
      teffK: 5100,
      eccentricity: 0.04,
      habitability: 0.45,
    },
  ],
  [
    'eyeball',
    {
      archetype: 'eyeball',
      gravityG: 1.3,
      meanTempK: 260,
      waterMassFraction: 0.01,
      locked: true,
      hasDynamo: false,
      dipoleIndex: 0,
      volcanismIndex: 0.35,
      moons: 0,
      rings: false,
      teffK: 3300,
      eccentricity: 0.08,
      habitability: 0.3,
    },
  ],
  [
    'desert',
    {
      archetype: 'desert',
      gravityG: 0.9,
      meanTempK: 340,
      waterMassFraction: 0.001,
      locked: false,
      hasDynamo: false,
      dipoleIndex: 0,
      volcanismIndex: 0.4,
      moons: 1,
      rings: false,
      teffK: 4200,
      eccentricity: 0.15,
      habitability: 0.12,
    },
  ],
  [
    'barren',
    {
      archetype: 'barren',
      gravityG: 2.0,
      meanTempK: 465,
      waterMassFraction: 0.017,
      locked: true,
      hasDynamo: false,
      dipoleIndex: 0,
      volcanismIndex: 0.35,
      moons: 1,
      rings: false,
      teffK: 3566,
      eccentricity: 0.014,
      habitability: 0,
    },
  ],
  [
    'ice',
    {
      archetype: 'ice',
      gravityG: 0.55,
      meanTempK: 120,
      waterMassFraction: 0.2,
      locked: false,
      hasDynamo: true,
      dipoleIndex: 0.9,
      volcanismIndex: 0.05,
      moons: 3,
      rings: false,
      teffK: 9000,
      eccentricity: 0.2,
      habitability: 0,
    },
  ],
  [
    'lava',
    {
      archetype: 'lava',
      gravityG: 1.6,
      meanTempK: 1400,
      waterMassFraction: 0,
      locked: true,
      hasDynamo: false,
      dipoleIndex: 0,
      volcanismIndex: 0.95,
      moons: 0,
      rings: false,
      teffK: 5800,
      eccentricity: 0.01,
      habitability: 0,
    },
  ],
  [
    'hothouse',
    {
      archetype: 'hothouse',
      gravityG: 0.95,
      meanTempK: 690,
      waterMassFraction: 0.002,
      locked: false,
      hasDynamo: true,
      dipoleIndex: 0.2,
      volcanismIndex: 0.7,
      moons: 0,
      rings: false,
      teffK: 6000,
      eccentricity: 0.03,
      habitability: 0,
    },
  ],
  [
    'gas_giant',
    {
      archetype: 'gas_giant',
      gravityG: 2.5,
      meanTempK: 150,
      waterMassFraction: 0,
      locked: false,
      hasDynamo: true,
      dipoleIndex: 1,
      volcanismIndex: 0,
      moons: 8,
      rings: false,
      teffK: 7000,
      eccentricity: 0.05,
      habitability: 0,
    },
  ],
  [
    'gas_giant_ringed',
    {
      archetype: 'gas_giant_ringed',
      gravityG: 1.4,
      meanTempK: 110,
      waterMassFraction: 0,
      locked: false,
      hasDynamo: true,
      dipoleIndex: 0.6,
      volcanismIndex: 0,
      moons: 4,
      rings: true,
      teffK: 4800,
      eccentricity: 0.3,
      habitability: 0,
    },
  ],
  [
    'ice_giant',
    {
      archetype: 'ice_giant',
      gravityG: 1.1,
      meanTempK: 70,
      waterMassFraction: 0,
      locked: false,
      hasDynamo: false,
      dipoleIndex: 0.7,
      volcanismIndex: 0,
      moons: 2,
      rings: false,
      teffK: 3100,
      eccentricity: 0.12,
      habitability: 0,
    },
  ],
  [
    'light_ringed',
    {
      archetype: 'barren',
      gravityG: 0.35,
      meanTempK: 200,
      waterMassFraction: 0.004,
      locked: false,
      hasDynamo: true,
      dipoleIndex: 0.45,
      volcanismIndex: 0.55,
      moons: 5,
      rings: true,
      teffK: 12000,
      eccentricity: 0.11,
      habitability: 0.2,
    },
  ],
];

type MeshCase = {
  id: string;
  kind: string;
  base: SwordParams;
  materials?: any;
  monument?: { heightM: number; sink: number };
  traits: PlanetTraits;
  seed: number;
  force?: Partial<MonumentPicks>;
};

function monumentPreset(): SwordParams {
  return giantPresets.find((p) => p.id === 'monument')!.build();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outArg = typeof args.out === 'string' ? args.out : 'monument-corpus';
  const out = isAbsolute(outArg) ? outArg : resolve(baseDir, outArg);
  const seeds = Number(args.seeds ?? 48);
  mkdirSync(out, { recursive: true });
  const base = monumentPreset();
  const cat = MONUMENT_CATALOGUE;

  // 1. the pick table
  const rows: any[] = [];
  for (const [profile, traits] of TRAIT_PROFILES) {
    for (let k = 0; k < seeds; k++) {
      const seed = monumentSeed(`${1000003 * (k + 1)}`, `P${(k % 4) + 1}`);
      const d = designMonument(base, traits, seed);
      const strengths = traitStrengths(traits);
      const picked: string[] = [];
      const weights: Record<string, Array<[string, number]>> = {};
      for (const [stage, list] of [
        ['blades', cat.blades],
        ['guards', cat.guards],
        ['pommels', cat.pommels],
        ['grips', cat.grips],
      ] as const) {
        weights[stage] = entryWeights(list, strengths, picked);
        picked.push(d.picks[stage.slice(0, -1) as keyof MonumentPicks]);
      }
      rows.push({ profile, traits, seed, strengths, weights, picks: d.picks, params: d.params });
    }
  }
  writeFileSync(join(out, 'picks.json'), JSON.stringify({ base, rows }, null, 1) + '\n');

  // 2. mesh cases
  const t = TRAIT_PROFILES[0][1];
  const cases: MeshCase[] = [];
  for (const style of ['forged', ...MONUMENT_GUARD_STYLES]) {
    cases.push({
      id: `guard-${style}`,
      kind: 'guard',
      base,
      traits: t,
      seed: 101,
      force: { blade: 'greatsword', guard: style, pommel: 'native', grip: 'native' },
    });
  }
  // variants: other seeds and traits flip sweep signs, counts, knobs and sections
  for (const style of MONUMENT_GUARD_STYLES) {
    cases.push({
      id: `guard-${style}-b`,
      kind: 'guard',
      base,
      traits: TRAIT_PROFILES[4][1],
      seed: 202,
      force: { blade: 'classic', guard: style, pommel: 'native', grip: 'native' },
    });
  }
  for (const style of MONUMENT_POMMEL_STYLES) {
    cases.push({
      id: `pommel-${style}`,
      kind: 'pommel',
      base,
      traits: t,
      seed: 303,
      force: { blade: 'classic', guard: 'forged', pommel: style, grip: 'native' },
    });
    cases.push({
      id: `pommel-${style}-b`,
      kind: 'pommel',
      base,
      traits: TRAIT_PROFILES[9][1],
      seed: 404,
      force: { blade: 'leaf', guard: 'halo', pommel: style, grip: 'banded' },
    });
  }
  for (const e of cat.blades) {
    cases.push({
      id: `blade-${e.id}`,
      kind: 'blade',
      base,
      traits: t,
      seed: 505,
      force: { blade: e.id, guard: 'forged', pommel: 'native', grip: 'native' },
    });
  }
  for (const e of cat.grips) {
    cases.push({
      id: `grip-${e.id}`,
      kind: 'grip',
      base,
      traits: TRAIT_PROFILES[5][1],
      seed: 606,
      force: { blade: 'classic', guard: 'forged', pommel: 'native', grip: e.id },
    });
  }
  if (typeof args.designs === 'string') {
    const p = isAbsolute(args.designs) ? args.designs : resolve(baseDir, args.designs);
    for (const d of JSON.parse(readFileSync(p, 'utf8'))) {
      cases.push({
        id: `design-${d.id}`,
        kind: 'design',
        base: d.base.model,
        materials: d.base.materials,
        monument: d.base.monument,
        traits: d.traits,
        seed: monumentSeed(d.system_seed, d.planet_id),
      });
    }
  }
  const index: any[] = [];
  for (const c of cases) {
    const d = designMonument(c.base, c.traits, c.seed, cat, c.force);
    const model = JSON.parse(JSON.stringify(d.params));
    const validated = validateSwordParams(model);
    const sword = buildSword(model, c.materials);
    const monument = c.monument ?? { heightM: 36, sink: 0.12 };
    const root = prepareExport(sword, model, { monument });
    const { json, bin } = dumpMeshes(sword);
    const caseDoc = {
      id: c.id,
      kind: c.kind,
      base: c.base,
      traits: c.traits,
      seed: c.seed,
      force: c.force ?? null,
      picks: d.picks,
      params: d.params,
      monument,
    };
    writeFileSync(join(out, `${c.id}.case.json`), JSON.stringify(caseDoc, null, 1) + '\n');
    writeFileSync(join(out, `${c.id}.validated.json`), JSON.stringify(validated, null, 1) + '\n');
    writeFileSync(join(out, `${c.id}.mesh.json`), JSON.stringify(json, null, 1) + '\n');
    writeFileSync(join(out, `${c.id}.mesh.bin`), bin);
    if (args.glb) writeFileSync(join(out, `${c.id}.glb`), await exportGLB(root));
    index.push({
      id: c.id,
      kind: c.kind,
      picks: d.picks,
      meshes: json.meshes.map((m: any) => m.name),
      quantizedSha256: json.quantizedSha256,
    });
  }
  writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 1) + '\n');
  writeFileSync(join(out, 'catalogue.json'), JSON.stringify(cat, null, 1) + '\n');
  console.log(`monument corpus: ${rows.length} pick rows, ${cases.length} mesh cases -> ${out}`);
}

main().catch((err) => {
  console.error(`monument-corpus: ${err?.stack ?? err}`);
  process.exit(1);
});
