/**
 * Implementation of the headless CLI (`cli.ts`); importable for tests.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { giantPresets, swordPresets } from '../components/presets';
import { buildBladeOutlinePoints, bladeOutlineToSVG } from '../three/SwordGenerator';
import { randomSword } from '../three/sword/randomize';
import { sanitizeGlow, validateSwordParams } from '../three/sword/validation';
import {
  buildSword,
  dumpMeshes,
  exportGLB,
  prepareExport,
  readDoc,
  swordStats,
  type HeadlessDoc,
  type MonumentOptions,
} from './index';

const baseDir = process.env.INIT_CWD || process.cwd();
const abs = (p: string) => (isAbsolute(p) ? p : resolve(baseDir, p));
const write = (p: string, data: string | Uint8Array) => {
  const file = abs(p);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  return file;
};

type Args = { _: string[]; [k: string]: string | boolean | string[] };

export function parseArgs(argv: string[]): Args {
  const out: Args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') continue;
    if (a.startsWith('--no-')) out[a.slice(5)] = false;
    else if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else out[key] = true;
    } else out._.push(a);
  }
  return out;
}

/** Resolve the CLI source flags to a headless doc. */
export function resolveSource(args: Args): HeadlessDoc {
  if (typeof args.params === 'string') {
    return readDoc(JSON.parse(readFileSync(abs(args.params), 'utf-8')));
  }
  if (typeof args.preset === 'string') {
    const entry = [...swordPresets, ...giantPresets].find((p) => p.id === args.preset);
    if (!entry) throw new Error(`unknown preset '${args.preset}' (try: presets)`);
    return { version: 5, model: entry.build(), materials: (entry.materials ?? {}) as any };
  }
  if (args.seed !== undefined && args.seed !== true) {
    const r = randomSword(String(args.seed));
    return {
      version: 5,
      seed: r.seed,
      style: `${r.style}/${r.archetype}`,
      model: r.params,
      materials: r.materials,
    };
  }
  throw new Error('need a source: --params <file>, --preset <id> or --seed <n>');
}

export const USAGE = `bladegen headless CLI.

  npm run bladegen -- gen   [source] [outputs] [options]
  npm run bladegen -- presets

Source (one of):
  --params <file.json>    site export, headless doc, bare SwordParams or sword.json
  --preset <id>           a built-in preset (see \`presets\`)
  --seed <n|text>         seeded randomizer (style: monument)
Outputs:
  --out <file.glb>        GLB
  --params-out <file>     headless doc JSON {version, model, materials, ...}
  --svg <file.svg>        blade outline blueprint
  --dump <prefix>         conformance dump: <prefix>.mesh.json + <prefix>.mesh.bin
  --stats                 print counts and bounds as JSON
Options:
  --monument              tip-down monument root node in metres (see docs/headless.md)
  --height-m <m>          blade length in metres for --monument (default 16)
  --sink <f>              buried fraction of the blade for --monument (default 0.12)
  --glow-color <#rrggbb>  override the blade glow colour (enables glow if absent)
  --no-uvs                do not add blade grid UVs
  --no-fix-winding        keep the blade's original (mixed) triangle winding

Relative paths resolve against the directory npm was started from (INIT_CWD).`;

export async function runGen(args: Args): Promise<Record<string, unknown>> {
  const doc = resolveSource(args);
  const model = doc.model;
  if (typeof args['glow-color'] === 'string') {
    const glow = { ...(model.blade.glow ?? {}), enabled: true, color: args['glow-color'] };
    if (!sanitizeGlow(glow) || sanitizeGlow(glow)!.color !== args['glow-color'])
      throw new Error('--glow-color must be #rrggbb');
    model.blade.glow = glow;
  }
  if (model.handle?.wrapTexture) model.handle.wrapTexture = false; // canvas texture needs a DOM
  let monument: MonumentOptions | undefined = doc.monument;
  if (args.monument) {
    monument = {
      heightM:
        args['height-m'] !== undefined ? Number(args['height-m']) : (monument?.heightM ?? 16),
      sink: args.sink !== undefined ? Number(args.sink) : (monument?.sink ?? 0.12),
    };
    if (!(monument.heightM > 0) || !(monument.sink >= 0)) throw new Error('bad --height-m/--sink');
  } else if (args.monument === false) monument = undefined;

  const outDoc: HeadlessDoc = {
    version: 5,
    generator: 'bladegen-headless/1',
    ...(doc.seed !== undefined ? { seed: doc.seed } : {}),
    ...(doc.style ? { style: doc.style } : {}),
    model: JSON.parse(JSON.stringify(model)),
    materials: doc.materials ?? {},
    ...(monument ? { monument } : {}),
  };

  const sword = buildSword(model, doc.materials);
  const report: Record<string, unknown> = {};
  const stats = swordStats(sword);
  // Export preparation happens before the dump: the dump is what the GLB holds.
  const root = prepareExport(sword, model, {
    uvs: args.uvs !== false,
    fixWinding: args['fix-winding'] !== false,
    monument,
  });
  if (typeof args.dump === 'string') {
    const { json, bin } = dumpMeshes(sword);
    report.dump = write(`${args.dump}.mesh.json`, JSON.stringify(json, null, 1));
    write(`${args.dump}.mesh.bin`, bin);
  }
  if (typeof args['params-out'] === 'string') {
    report.params = write(args['params-out'], JSON.stringify(outDoc, null, 2) + '\n');
  }
  if (typeof args.svg === 'string') {
    report.svg = write(
      args.svg,
      bladeOutlineToSVG(buildBladeOutlinePoints(validateSwordParams(model).blade))
    );
  }
  if (typeof args.out === 'string') {
    const glb = await exportGLB(root);
    report.glb = write(args.out, glb);
    report.glbBytes = glb.byteLength;
  }
  if (args.stats) report.stats = { ...stats, style: outDoc.style, monument };
  return report;
}
