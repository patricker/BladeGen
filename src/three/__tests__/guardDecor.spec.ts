import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { decorateGuard } from '../../three/sword/guardDecor';

describe('guardDecor', () => {
  it('adds extras and fillet to group', () => {
    const swordGroup = new THREE.Group();
    const params: any = {
      width: 1.0,
      thickness: 0.2,
      curve: 0,
      tilt: 0,
      style: 'bar',
      heightOffset: 0,
      guardBlendFillet: 0.5,
      extras: [{ kind: 'sideRing', radius: 0.1, thickness: 0.02, offsetY: 0 }],
    };
    const _res = decorateGuard(params, {
      swordGroup,
      makeMaterial: () => new THREE.MeshStandardMaterial(),
    });
    // At least one child added (fillet or extra)
    expect(swordGroup.children.length).toBeGreaterThan(0);
  });

  it('adds langets when enabled', () => {
    const swordGroup = new THREE.Group();
    const guardGroup = new THREE.Group();
    const params: any = {
      width: 1.0,
      thickness: 0.2,
      curve: 0,
      tilt: 0,
      style: 'bar',
      langets: { enabled: true, length: 0.14, width: 0.05, thickness: 0.012 },
    };
    decorateGuard(params, {
      swordGroup,
      guardGroup,
      bladeParams: { baseWidth: 0.3, thicknessLeft: 0.08, thicknessRight: 0.08 } as any,
      makeMaterial: () => new THREE.MeshStandardMaterial(),
    });
    const langetMeshes = guardGroup.children.filter(
      (child) =>
        child instanceof THREE.Mesh && (child as THREE.Mesh).geometry instanceof THREE.BoxGeometry
    );
    expect(langetMeshes.length).toBeGreaterThanOrEqual(2);
  });

  it("adds pas d'âne rings based on count", () => {
    const swordGroup = new THREE.Group();
    const guardGroup = new THREE.Group();
    const params: any = {
      width: 1.0,
      thickness: 0.2,
      curve: 0,
      tilt: 0,
      style: 'bar',
      pasDaneCount: 2,
      pasDaneRadius: 0.06,
      pasDaneThickness: 0.01,
      pasDaneOffsetY: -0.01,
    };
    decorateGuard(params, {
      swordGroup,
      guardGroup,
      bladeParams: { baseWidth: 0.25, thicknessLeft: 0.08, thicknessRight: 0.08 } as any,
      makeMaterial: () => new THREE.MeshStandardMaterial(),
    });
    const ringMeshes = guardGroup.children.filter(
      (child) =>
        child instanceof THREE.Mesh && (child as THREE.Mesh).geometry instanceof THREE.TorusGeometry
    );
    expect(ringMeshes.length).toBeGreaterThanOrEqual(2);
  });
});
