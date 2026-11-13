import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { callCore } from '../core/wasm';
import { buildBladeGeometry } from '../bladeGeometry';
import { buildForgedGuardGeometry } from '../guardForged';
import { validateSwordParams } from '../validation';
import { presetMonument } from '../../../components/presets';

/**
 * The committed wasm module (src/three/sword/core/bladegen_core.wasm) is bladegen-core: it reproduces the goldens the
 * Rust tests check (crates/bladegen-core/tests/goldens/corpora.json, the SW1/SW2/SW7/SW10 corpora's meshes) bit for
 * bit. A failure here after a Rust change means the module was not rebuilt (scripts/build-wasm.sh).
 */
const goldens = JSON.parse(
  readFileSync(new URL('../../../../crates/bladegen-core/tests/goldens/corpora.json', import.meta.url), 'utf8')
);

describe('bladegen-core (wasm)', () => {
  it('reproduces the recorded corpora', () => {
    let meshes = 0;
    const bad: string[] = [];
    for (const c of goldens.cases) {
      const got = callCore('digests', { sword: goldens.params[c.params] }).value;
      meshes += c.meshes.length;
      if (JSON.stringify(got) !== JSON.stringify(c.meshes)) bad.push(`${c.corpus} ${c.id}`);
    }
    expect(bad).toEqual([]);
    expect(goldens.cases.length).toBeGreaterThanOrEqual(240);
    expect(meshes).toBeGreaterThanOrEqual(1200);
  });

  it('reports errors instead of trapping', () => {
    expect(() => callCore('blade', { length: 'long' })).toThrow(/bladegen-core blade/);
    expect(() => callCore('no-such-op', {})).toThrow(/unknown op/);
  });

  it('a geometry is a plain three BufferGeometry with the builders\' layout', () => {
    const p = validateSwordParams(presetMonument());
    const blade = buildBladeGeometry(p.blade);
    expect(Object.keys(blade.attributes)).toEqual(['position', 'normal', 'tangent', 'uv', 'color']);
    expect(blade.boundingBox).toBeTruthy();
    const { geometry, halfHeight } = buildForgedGuardGeometry(p.guard, p.blade);
    expect(Object.keys(geometry.attributes)).toEqual(['position', 'uv', 'normal']);
    expect(halfHeight).toBeCloseTo(0.5 * (p.guard.forged?.height ?? 0) * p.blade.baseWidth, 12);
  });
});
