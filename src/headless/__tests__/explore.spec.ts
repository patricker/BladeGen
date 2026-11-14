import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import Ajv2020 from 'ajv/dist/2020';
import fs from 'node:fs';
import { buildExplorationGroup, type ExplorationBuffers } from '../explore';

describe('opt-in Rust exploration bridge', () => {
  it('preserves buffers, local transforms, semantic names, metre placement and emission', () => {
    const doc: ExplorationBuffers = {
      format: 'bladegen-explore/1',
      idea: 'test',
      seed: 42,
      bladeLength: 6,
      heightM: 36,
      sink: 0.12,
      anchors: [{ id: 'target' }],
      components: [
        {
          id: 'node/0',
          role: 'node',
          position: [0, 0, 0, 1, 0, 0, 0, 1, 0],
          normal: [0, 0, 1, 0, 0, 1, 0, 0, 1],
          index: [0, 1, 2],
          matrix: new THREE.Matrix4().makeTranslation(0.2, 0.3, 0.4).toArray(),
          color: [0.2, 0.7, 1],
          strength: 7,
        },
      ],
    };
    const root = buildExplorationGroup(doc);
    const mesh = root.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    expect(mesh.name).toBe('node/0');
    expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(doc.components[0].position);
    expect(mesh.matrix.toArray()).toEqual(doc.components[0].matrix);
    expect(mesh.material.emissiveIntensity).toBe(7);
    expect(mesh.material.emissive.r).toBeCloseTo(0.2, 8);
    const p = new THREE.Vector3(0, 0, 0).applyMatrix4(mesh.matrixWorld);
    expect(p.x).toBeCloseTo(-1.2);
    expect(p.y).toBeCloseTo(29.88);
    expect(p.z).toBeCloseTo(2.4);
    expect(root.userData.exploration.anchors).toEqual(doc.anchors);
    expect(() =>
      buildExplorationGroup({ ...doc, components: [{ ...doc.components[0], index: [0, 1, 3] }] })
    ).toThrow();
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it('validates a real Rust manifest and rejects schema drift', () => {
    const ajv = new Ajv2020({ strict: false });
    const schema = JSON.parse(fs.readFileSync('schema/explore.recipe.schema.json', 'utf8'));
    const manifest = JSON.parse(fs.readFileSync('explore/fixtures/recipe.json', 'utf8'));
    const validate = ajv.compile(schema);
    expect(validate(manifest), JSON.stringify(validate.errors)).toBe(true);
    const bad = structuredClone(manifest);
    bad.features.aperture.width = 0.99;
    expect(validate(bad)).toBe(false);
    const unknown = structuredClone(manifest);
    unknown.features.unrecognized = {};
    expect(validate(unknown)).toBe(false);
  });
});
