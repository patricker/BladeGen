/**
 * Conformance fixtures for ports of bladegen (see docs/conformance.md).
 *
 *   npm run fixtures -- --out <dir> [--count 20] [--start 1] [--height-m 16] [--sink 0.12]
 *
 * For each seed s in [start, start + count) writes, with id = seed-<s, 4 digits>:
 *   <id>.params.json     headless doc: randomizer output (model, materials) + monument
 *   <id>.validated.json  validateSwordParams(model): what the geometry builders consume
 *   <id>.mesh.json/.bin  canonical mesh dump after export preparation
 *   <id>.glb             the monument GLB (metres, tip down, origin at the ground)
 * plus index.json (one summary row per seed) and rng.json (PRNG test vectors).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { randomSword } from '../three/sword/randomize';
import { validateSwordParams } from '../three/sword/validation';
import { createRng, fmix32, hashSeed, q3 } from '../three/sword/rng';
import {
  buildSword,
  dumpMeshes,
  exportGLB,
  monumentTransform,
  prepareExport,
  swordStats,
  type HeadlessDoc,
} from './index';
import { parseArgs } from './gen';

const baseDir = process.env.INIT_CWD || process.cwd();

function rngVectors() {
  const seeds: Array<number | string> = [0, 1, 2, 42, 4294967295, 'acc1:example'];
  return {
    algorithm: 'mulberry32 with fmix32-scrambled seed (src/three/sword/rng.ts)',
    fmix32: [0, 1, 2, 42, 0xdeadbeef].map((h) => ({ in: h, out: fmix32(h) })),
    hashSeed: ['acc1:example', 'b', ''].map((s) => ({ in: s, out: hashSeed(s) })),
    q3: [0.12345, 0.1235, -0.0005, 2.9999, 1 / 3].map((x) => ({ in: x, out: q3(x) })),
    sequences: seeds.map((seed) => {
      const rng = createRng(seed);
      return { seed, next: Array.from({ length: 8 }, () => rng.next()) };
    }),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outArg = typeof args.out === 'string' ? args.out : 'fixtures';
  const out = isAbsolute(outArg) ? outArg : resolve(baseDir, outArg);
  const count = Number(args.count ?? 20);
  const start = Number(args.start ?? 1);
  const heightM = Number(args['height-m'] ?? 16);
  const sink = Number(args.sink ?? 0.12);
  mkdirSync(out, { recursive: true });
  const index: any[] = [];
  for (let s = start; s < start + count; s++) {
    const id = `seed-${String(s).padStart(4, '0')}`;
    const r = randomSword(s);
    const monument = { heightM, sink };
    const doc: HeadlessDoc = {
      version: 5,
      generator: 'bladegen-headless/1',
      seed: r.seed,
      style: `${r.style}/${r.archetype}`,
      model: JSON.parse(JSON.stringify(r.params)),
      materials: r.materials,
      monument,
    };
    writeFileSync(join(out, `${id}.params.json`), JSON.stringify(doc, null, 2) + '\n');
    const validated = validateSwordParams(r.params);
    writeFileSync(join(out, `${id}.validated.json`), JSON.stringify(validated, null, 2) + '\n');
    const t0 = performance.now();
    const sword = buildSword(r.params, r.materials);
    const buildMs = performance.now() - t0;
    const stats = swordStats(sword);
    const root = prepareExport(sword, r.params, { monument });
    const { json, bin } = dumpMeshes(sword);
    writeFileSync(join(out, `${id}.mesh.json`), JSON.stringify(json, null, 1) + '\n');
    writeFileSync(join(out, `${id}.mesh.bin`), bin);
    const glb = await exportGLB(root);
    writeFileSync(join(out, `${id}.glb`), glb);
    const row = {
      id,
      seed: r.seed,
      archetype: r.archetype,
      glow: validated.blade.glow?.color,
      meshes: json.totals.meshes,
      vertices: json.totals.vertices,
      triangles: json.totals.triangles,
      bboxMin: stats.bboxMin,
      bboxMax: stats.bboxMax,
      monument: monumentTransform(r.params, monument),
      quantizedSha256: json.quantizedSha256,
      binSha256: createHash('sha256').update(bin).digest('hex'),
      glbBytes: glb.byteLength,
      buildMs: Math.round(buildMs * 10) / 10,
    };
    index.push(row);
    console.log(
      `${id} ${r.archetype} tris=${row.triangles} glb=${(glb.byteLength / 1024).toFixed(0)}KB`
    );
  }
  writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  writeFileSync(join(out, 'rng.json'), JSON.stringify(rngVectors(), null, 2) + '\n');
  console.log(`wrote ${index.length} fixtures to ${out}`);
}

main().catch((err) => {
  console.error(`fixtures: ${err?.stack ?? err}`);
  process.exit(1);
});
