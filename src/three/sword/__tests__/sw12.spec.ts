import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { callCore } from '../core/wasm';
import { buildBladeGeometry } from '../bladeGeometry';
import { buildBladeGlowGeometry } from '../glow';
import { buildShearGuardGeometry, SW12_DEFAULTS } from '../shear';
import { validateSwordParams } from '../validation';
import { SwordGenerator } from '../../SwordGenerator';
import {
  giantPresets,
  presetMonument,
  presetMonumentFaultbound,
  presetMonumentShear,
  presetMonumentWindow,
} from '../../../components/presets';

/**
 * SW12: window-keel (blade.aperture), faultbound (blade.fracture) and shear-gate (guard style 'shear') in the web app.
 * The geometry is bladegen-core's; these check that the committed wasm module builds the same bytes as the native
 * crate (crates/bladegen-core/tests/goldens/sw12.json, recorded by the Rust tests on x86_64), and the TypeScript
 * wiring: validation, schema, presets, the shear-gate's throat in the scene.
 */
const goldens = JSON.parse(
  readFileSync(
    new URL('../../../../crates/bladegen-core/tests/goldens/sw12.json', import.meta.url),
    'utf8'
  )
);
const schema = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../../../schema/sword.schema.json'), 'utf-8')
);
const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
ajv.addSchema(schema);
const validateParamsSchema = ajv.getSchema(`${schema.$id}#/$defs/SwordParams`)!;

describe('SW12 (wasm)', () => {
  it('builds the 24 pinned SW12 swords bit for bit as the native crate', () => {
    const bad: string[] = [];
    for (const c of goldens.cases) {
      const got = callCore('digests', { sword: c.params }).value;
      if (JSON.stringify(got) !== JSON.stringify(c.meshes)) bad.push(c.id);
    }
    expect(goldens.cases.length).toBe(24);
    expect(bad).toEqual([]);
  });

  it('the window-keel and faultbound blades and their glow come from buildBladeGeometry/buildBladeGlowGeometry', () => {
    for (const build of [presetMonumentWindow, presetMonumentFaultbound]) {
      const p = validateSwordParams(build());
      const g = buildBladeGeometry(p.blade);
      expect(Object.keys(g.attributes)).toEqual(['position', 'normal', 'tangent', 'uv', 'color']);
      const n = g.getAttribute('position').count;
      expect(g.getAttribute('uv').count).toBe(n);
      const plain = buildBladeGeometry(validateSwordParams(presetMonument()).blade);
      expect(n).not.toBe(plain.getAttribute('position').count);
      const glow = buildBladeGlowGeometry(p.blade, g);
      expect(glow).toBeTruthy();
      expect(glow!.getAttribute('position').count).toBeGreaterThan(0);
    }
  });

  it('the shear-gate builds a metal mesh and a glowing throat, sized from the blade', () => {
    const p = validateSwordParams(presetMonumentShear());
    const { geometry, throat, halfHeight } = buildShearGuardGeometry(p.guard, p.blade);
    expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect(throat).toBeTruthy();
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.x).toBeCloseTo(p.guard.width / 2, 6);
    const sh = p.guard.shear!;
    expect(halfHeight).toBeCloseTo(
      0.5 * sh.height! * p.blade.baseWidth +
        0.5 * sh.stagger! * p.blade.baseWidth +
        0.08 * p.blade.baseWidth,
      12
    );
    const none = buildShearGuardGeometry({ ...p.guard, shear: { ...sh, throat: 0 } }, p.blade);
    expect(none.throat).toBeNull();
  });
});

describe('SW12 (params)', () => {
  it('validation writes the blocks back in full from the core defaults and clamps them', () => {
    const p = presetMonument();
    (p.blade as any).aperture = { width: 9 };
    (p.blade as any).fracture = { segments: 3.4, gap: -1 };
    p.guard.style = 'shear';
    (p.guard as any).shear = { throat: 2 };
    const v = validateSwordParams(p);
    expect(v.blade.aperture).toEqual({ ...SW12_DEFAULTS.aperture, width: 0.65 });
    expect(v.blade.fracture).toEqual({ ...SW12_DEFAULTS.fracture, segments: 3, gap: 0.08 });
    expect(v.guard.shear).toEqual({ ...SW12_DEFAULTS.shear, throat: 0.9 });
    expect(v.guard.forged).toBeUndefined();
    // the core's defaults are the documented ones
    expect(SW12_DEFAULTS.aperture.width).toBe(0.42);
    expect(SW12_DEFAULTS.fracture.segments).toBe(4);
    expect(SW12_DEFAULTS.shear.height).toBe(0.46);
    // another style drops the block; a blade without the blocks stays without them
    const w = validateSwordParams({ ...v, guard: { ...v.guard, style: 'halo' } });
    expect(w.guard.shear).toBeUndefined();
    const plain = validateSwordParams(presetMonument());
    expect(plain.blade.aperture).toBeUndefined();
    expect(plain.blade.fracture).toBeUndefined();
    expect(plain.guard.shear).toBeUndefined();
  });

  it('the SW12 presets match the schema and survive validation unchanged', () => {
    for (const id of ['monument-window', 'monument-faultbound', 'monument-shear']) {
      const entry = giantPresets.find((e) => e.id === id)!;
      const raw = entry.build();
      expect(validateParamsSchema(raw), JSON.stringify(validateParamsSchema.errors)).toBe(true);
      const v = validateSwordParams(raw);
      expect(validateParamsSchema(v), JSON.stringify(validateParamsSchema.errors)).toBe(true);
      if (raw.blade.aperture) expect(v.blade.aperture).toEqual(raw.blade.aperture);
      if (raw.blade.fracture) expect(v.blade.fracture).toEqual(raw.blade.fracture);
      if (raw.guard.shear) expect(v.guard.shear).toEqual(raw.guard.shear);
    }
  });

  it('in the scene the throat keeps its glow material when the guard material is reapplied', () => {
    const gen = new SwordGenerator(presetMonumentShear());
    const guard = gen.guardMesh!;
    expect(guard).toBeTruthy();
    const throat = guard.children.find((c) => c.name === 'guard.throat') as THREE.Mesh;
    expect(throat).toBeTruthy();
    expect((throat.material as THREE.Material).name).toBe('glow');
    (gen as any).reapplyMaterials();
    expect(((guard.children[0] as THREE.Mesh).material as THREE.Material).name).toBe('glow');
    expect((guard.material as THREE.Material).name).not.toBe('glow');
  });
});
