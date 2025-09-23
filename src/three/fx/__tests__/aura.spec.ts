import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { buildFlameAura } from '../../../three/fx/aura';

describe('fx/aura', () => {
  it('builds a flame aura mesh from blade geometry', () => {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 0.06));
    const { mesh, material } = buildFlameAura(blade, { scale: 1.05, intensity: 1.0 });
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect((material as any).isShaderMaterial).toBeTruthy();
    expect(mesh.material).toBe(material);
  });
});
