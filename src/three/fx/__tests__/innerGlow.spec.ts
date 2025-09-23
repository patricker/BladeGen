import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { buildInnerGlow } from '../../../three/fx/innerGlow';

describe('fx/innerGlow', () => {
  it('builds an inner glow group and material', () => {
    const src = new THREE.Group();
    src.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    const { group, material } = buildInnerGlow(src, 0x88ccff, 0.2, 0.9, 1.5);
    expect(group.children.length).toBeGreaterThan(0);
    expect((material as any).isShaderMaterial).toBeTruthy();
  });
});
