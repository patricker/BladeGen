import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { buildHandle } from '../../three/sword/handleGeometry';

const mat = () => new THREE.MeshStandardMaterial();

describe('handleGeometry', () => {
  it('builds handle mesh/group with expected placement', () => {
    const h: any = {
      length: 1.0,
      radiusTop: 0.12,
      radiusBottom: 0.1,
      segmentation: true,
      wrapEnabled: false,
      ovalRatio: 1.2,
    };
    const { handleMesh, handleGroup } = buildHandle(h, () => mat());
    expect(handleMesh).toBeTruthy();
    expect(handleGroup.children.length).toBeGreaterThan(0);
    // Positioned with top at y ~ 0
    const box = new THREE.Box3().setFromObject(handleMesh);
    expect(Math.abs(box.max.y)).toBeLessThan(1e-3);
  });

  it('adds wrap style geometry when hineri selected', () => {
    const h: any = { length: 1.0, radiusTop: 0.12, radiusBottom: 0.11, wrapStyle: 'hineri' };
    const { handleGroup } = buildHandle(h, () => mat());
    const tubeCount = handleGroup.children.filter(
      (child) =>
        child instanceof THREE.Mesh &&
        child !== handleGroup.children[0] &&
        (child as THREE.Mesh).geometry instanceof THREE.TubeGeometry
    ).length;
    expect(tubeCount).toBeGreaterThan(0);
  });

  it('adds rayskin overlay when enabled', () => {
    const h: any = {
      length: 1.0,
      radiusTop: 0.12,
      radiusBottom: 0.1,
      rayskin: { enabled: true, scale: 0.01, intensity: 0.6 },
    };
    const { handleGroup } = buildHandle(h, () => mat());
    const latheMeshes = handleGroup.children.filter(
      (child) =>
        child instanceof THREE.Mesh && (child as THREE.Mesh).geometry instanceof THREE.LatheGeometry
    );
    expect(latheMeshes.length).toBeGreaterThan(1); // base lathe + overlay
  });
});
