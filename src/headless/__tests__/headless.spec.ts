import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import {
  buildSword,
  dumpMeshes,
  exportGLB,
  listMeshes,
  monumentTransform,
  prepareExport,
  readDoc,
} from '../index';
import { parseArgs } from '../gen';
import { randomSword } from '../../three/sword/randomize';
import { defaultSwordParams } from '../../three/SwordGenerator';
import { presetMonument } from '../../components/presets';

function glbJson(glb: Uint8Array): any {
  const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  expect(dv.getUint32(0, true)).toBe(0x46546c67); // 'glTF'
  const len = dv.getUint32(12, true);
  expect(dv.getUint32(16, true)).toBe(0x4e4f534a); // 'JSON'
  return JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + len)));
}

describe('headless export', () => {
  it('exports a monument GLB with glow channel, UVs and a metres root node', async () => {
    const params = presetMonument();
    const sword = buildSword(params);
    const root = prepareExport(sword, params, { monument: { heightM: 16, sink: 0.12 } });
    const json = glbJson(await exportGLB(root));
    const rootNode = json.nodes[json.scenes[0].nodes[0]];
    expect(rootNode.name).toBe('sword');
    expect(rootNode.rotation).toEqual([0, 0, 1, 0]);
    expect(rootNode.scale[0]).toBeCloseTo(16 / 3.6, 6);
    expect(json.extensionsUsed).toContain('KHR_materials_emissive_strength');
    const named = (n: string) => json.nodes.find((x: any) => x.name === n);
    const blade = json.meshes[named('blade#0').mesh].primitives[0];
    expect(blade.attributes.TEXCOORD_0).toBeDefined();
    expect(blade.attributes.COLOR_0).toBeDefined();
    const glow = json.meshes[named('glow#0').mesh].primitives[0];
    expect(json.materials[glow.material].name).toBe('glow');
    // Helper anchors are not exported.
    expect(json.nodes.some((n: any) => String(n.name).startsWith('anchor.'))).toBe(false);
  });

  it('places the ground point at the origin with the tip buried', () => {
    const params = presetMonument();
    const sword = buildSword(params);
    const root = prepareExport(sword, params, { monument: { heightM: 16, sink: 0.12 } });
    root.updateMatrixWorld(true);
    const tip = sword.anchorBladeTip!.getWorldPosition(new THREE.Vector3());
    expect(tip.y).toBeCloseTo(-16 * 0.12, 1);
    const guardTop = new THREE.Vector3(0, 0, 0).applyMatrix4(sword.group.matrixWorld);
    expect(guardTop.y).toBeCloseTo(16 * 0.88, 3);
    const m = monumentTransform(params, { heightM: 16, sink: 0.12 });
    expect(m.translation[1]).toBeCloseTo(16 * 0.88, 6);
  });

  it('works for a plain (non-monument) export of the default sword', async () => {
    const params = defaultSwordParams();
    const sword = buildSword(params);
    const json = glbJson(await exportGLB(prepareExport(sword, params)));
    expect(json.nodes.find((n: any) => n.name === 'bladegen')).toBeTruthy();
    const blade = json.meshes[json.nodes.find((n: any) => n.name === 'blade#0').mesh];
    expect(blade.primitives[0].attributes.TEXCOORD_0).toBeDefined();
    expect(blade.primitives[0].attributes.COLOR_0).toBeUndefined();
  });

  it('mesh dump is self-consistent and deterministic', () => {
    const run = () => {
      const { params } = randomSword(3);
      const sword = buildSword(params);
      prepareExport(sword, params, { monument: { heightM: 14, sink: 0.1 } });
      return dumpMeshes(sword);
    };
    const a = run();
    const b = run();
    expect(a.json.quantizedSha256).toBe(b.json.quantizedSha256);
    expect(Buffer.from(a.bin).equals(Buffer.from(b.bin))).toBe(true);
    let end = 0;
    for (const m of a.json.meshes) {
      for (const ref of [...Object.values(m.attributes), ...(m.index ? [m.index] : [])]) {
        expect(ref.byteOffset).toBe(end);
        end += ref.byteLength;
        const slice = a.bin.subarray(ref.byteOffset, ref.byteOffset + ref.byteLength);
        expect(createHash('sha256').update(slice).digest('hex')).toBe(ref.sha256);
      }
      // Matrices are relative to the sword group, not the monument root.
      expect(m.matrix.length).toBe(16);
    }
    expect(end).toBe(a.bin.byteLength);
    expect(a.json.meshes[0].part).toBe('blade');
    expect(a.json.meshes.some((m) => m.part === 'glow')).toBe(true);
  });

  it('lists meshes by part in traversal order', () => {
    const sword = buildSword(defaultSwordParams());
    const names = listMeshes(sword).map((m) => m.name);
    expect(names[0]).toBe('blade#0');
    expect(names).toContain('guard#0');
    expect(names).toContain('handle#0');
    expect(names).toContain('pommel#0');
  });

  it('reads site exports, headless docs, bare params and sword.json', () => {
    const model = defaultSwordParams();
    expect(readDoc({ version: 5, model, materials: {}, render: {} }).model).toBe(model);
    expect(readDoc(model).model).toBe(model);
    expect(readDoc({ blade: { bladegen: { version: 5, model } } }).model).toBe(model);
    expect(() => readDoc({ nope: 1 })).toThrow();
  });

  it('parses CLI flags', () => {
    const a = parseArgs(['gen', '--seed', '7', '--monument', '--no-uvs', '--out', 'x.glb']);
    expect(a._).toEqual(['gen']);
    expect(a.seed).toBe('7');
    expect(a.monument).toBe(true);
    expect(a.uvs).toBe(false);
    expect(a.out).toBe('x.glb');
  });
});
