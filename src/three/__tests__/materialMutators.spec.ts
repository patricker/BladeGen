import * as THREE from 'three';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defaultSwordParams, SwordGenerator } from '../SwordGenerator';
import {
  setPartBump,
  setPartClearcoat,
  setPartClearcoatRoughness,
  setPartColor,
  setPartMetalness,
  setPartRoughness,
  visitPartMaterials,
} from '../render/materialMutators';

let sword: SwordGenerator;

beforeEach(() => {
  const params = defaultSwordParams();
  params.accessories!.scabbard!.enabled = true;
  params.accessories!.tassel!.enabled = true;
  sword = new SwordGenerator(params);
});

describe('material mutators', () => {
  it('updates color for all materials on a part', () => {
    const target = 0xff3366;
    setPartColor(sword, 'guard', target);

    visitPartMaterials(sword, 'guard', (material) => {
      if ('color' in material && material.color) {
        expect(material.color.getHex()).toBe(target);
      }
    });
  });

  it('sets scalar properties like metalness and roughness', () => {
    setPartMetalness(sword, 'blade', 0.12);
    setPartRoughness(sword, 'scabbard', 0.45);
    setPartClearcoat(sword, 'pommel', 0.3);
    setPartClearcoatRoughness(sword, 'handle', 0.4);

    visitPartMaterials(sword, 'blade', (material) => {
      if ('metalness' in material) expect(material.metalness).toBeCloseTo(0.12);
    });
    visitPartMaterials(sword, 'scabbard', (material) => {
      if ('roughness' in material) expect(material.roughness).toBeCloseTo(0.45);
    });
    visitPartMaterials(sword, 'pommel', (material) => {
      if ('clearcoat' in material) expect(material.clearcoat).toBeCloseTo(0.3);
    });
    visitPartMaterials(sword, 'handle', (material) => {
      if ('clearcoatRoughness' in material) expect(material.clearcoatRoughness).toBeCloseTo(0.4);
    });
  });

  it('applies and clears bump noise textures per part', () => {
    const noiseTexture = new THREE.DataTexture(
      new Uint8Array([255, 255, 255, 255]),
      1,
      1,
      THREE.RGBAFormat
    );
    noiseTexture.needsUpdate = true;
    const noiseFactory = vi.fn((scale: number, seed: number) => {
      expect(scale).toBe(6);
      expect(seed).toBe(99);
      return noiseTexture;
    });

    setPartBump(sword, 'blade', true, { bumpScale: 0.05, noiseScale: 6, seed: 99 }, noiseFactory);

    visitPartMaterials(sword, 'blade', (material) => {
      if ('bumpMap' in material) {
        expect(material.bumpMap).toBe(noiseTexture);
        expect(material.bumpScale).toBeCloseTo(0.05);
      }
    });

    expect(noiseFactory).toHaveBeenCalled();

    setPartBump(sword, 'blade', false, {}, noiseFactory);

    visitPartMaterials(sword, 'blade', (material) => {
      if ('bumpMap' in material) {
        expect(material.bumpMap).toBeNull();
        expect(material.bumpScale).toBe(0);
      }
    });
  });
});
