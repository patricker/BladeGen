import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { randomSword, MONUMENT_ARCHETYPES } from '../randomize';
import { validateSwordParams } from '../validation';
import { SwordGenerator } from '../../SwordGenerator';
import { giantPresets } from '../../../components/presets';

const schema = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../../schema/sword.schema.json'), 'utf-8')
);
const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
ajv.addSchema(schema);
const validateParamsSchema = ajv.getSchema(`${schema.$id}#/$defs/SwordParams`)!;

/** Every numeric/string leaf the randomizer sets must survive validation unchanged. */
function expectUnclamped(raw: any, validated: any, where: string) {
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    const out = validated?.[k];
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
      if (out === undefined) continue; // keys validation drops (e.g. legacy fuller knobs)
      expect(out, `${where}.${k}`).toBe(v);
    } else if (v && typeof v === 'object' && !Array.isArray(v) && out) {
      expectUnclamped(v, out, `${where}.${k}`);
    }
  }
}

describe('randomSword (monument)', () => {
  it('is deterministic per seed and varies across seeds', () => {
    expect(randomSword(5)).toEqual(randomSword(5));
    expect(randomSword('5')).toEqual(randomSword(5));
    expect(randomSword(5).params).not.toEqual(randomSword(6).params);
  });

  it('produces schema-valid params that validation does not clamp', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { params } = randomSword(seed);
      const ok = validateParamsSchema(params);
      expect(ok, JSON.stringify(validateParamsSchema.errors)).toBe(true);
      const v = validateSwordParams(params);
      for (const part of ['blade', 'guard', 'handle', 'pommel'] as const)
        expectUnclamped((params as any)[part], (v as any)[part], `seed${seed}.${part}`);
    }
  });

  it('giant presets match the schema too', () => {
    for (const entry of giantPresets) {
      expect(validateParamsSchema(entry.build()), JSON.stringify(validateParamsSchema.errors)).toBe(
        true
      );
    }
  });

  it('covers every archetype and never emits clutter-prone parts', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const r = randomSword(seed);
      seen.add(r.archetype);
      expect(['basket', 'shell', 'knucklebow', 'swept']).not.toContain(r.params.guard.style);
      expect(r.params.accessories?.scabbard.enabled).toBe(false);
      expect(r.params.accessories?.tassel.enabled).toBe(false);
      expect(r.params.handle.wrapTexture).toBe(false);
      expect(r.params.blade.engravings).toBeUndefined();
      expect(r.params.blade.glow?.enabled).toBe(true);
      // Readable at distance: broad blade, cross several blade-widths wide.
      expect(r.params.blade.baseWidth).toBeGreaterThanOrEqual(0.3);
      expect(r.params.guard.width).toBeGreaterThanOrEqual(0.9);
    }
    expect([...seen].sort()).toEqual(MONUMENT_ARCHETYPES.map(([a]) => a).sort());
  });

  it('builds finite geometry for a spread of seeds', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const { params, materials } = randomSword(seed);
      const sword = new SwordGenerator(params, materials);
      expect(sword.glowMesh).toBeTruthy();
      sword.group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(sword.group);
      for (const v of [box.min.x, box.min.y, box.max.x, box.max.y, box.max.z])
        expect(Number.isFinite(v)).toBe(true);
      expect(box.max.y).toBeGreaterThan(2.5);
    }
  });
});
