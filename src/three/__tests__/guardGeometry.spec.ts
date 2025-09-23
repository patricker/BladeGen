import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { buildGuard } from '../../three/sword/guardGeometry';

const mm = () => new THREE.MeshStandardMaterial();

describe('guardGeometry', () => {
  it('builds a bar guard mesh at target Y', () => {
    const { guardMesh } = buildGuard(
      { width: 1.0, thickness: 0.2, curve: 0, tilt: 0, style: 'bar' },
      { makeMaterial: () => mm() }
    );
    expect(guardMesh).toBeTruthy();
    expect(guardMesh!.position.y).toBeLessThanOrEqual(0);
  });

  it('builds a disk guard mesh with rotation', () => {
    const { guardMesh } = buildGuard(
      {
        width: 1.0,
        thickness: 0.2,
        curve: 0,
        tilt: 0.2,
        style: 'disk',
        cutoutCount: 3,
        curveSegments: 8,
      },
      { makeMaterial: () => mm() }
    );
    expect(guardMesh).toBeTruthy();
    expect(Math.abs(guardMesh!.rotation.z - 0.2)).toBeLessThan(1e-3);
  });

  it('builds a swept/basket style as group', () => {
    const swept = buildGuard(
      { width: 1.2, thickness: 0.2, curve: 0.2, tilt: 0, style: 'swept' } as any,
      { makeMaterial: () => mm() }
    );
    const basket = buildGuard(
      {
        width: 1.2,
        thickness: 0.2,
        curve: 0.2,
        tilt: 0,
        style: 'basket',
        ornamentation: 0.5,
      } as any,
      { makeMaterial: () => mm() }
    );
    expect(swept.guardGroup || swept.guardMesh).toBeTruthy();
    expect(basket.guardGroup || basket.guardMesh).toBeTruthy();
  });

  it('builds a shell guard with double-sided material', () => {
    const built = buildGuard(
      {
        width: 1.0,
        thickness: 0.18,
        curve: 0,
        tilt: 0,
        style: 'shell',
        shellCoverage: 0.8,
        shellThickness: 1.1,
        shellFlare: 1.2,
      } as any,
      { makeMaterial: () => mm() }
    );
    expect(built.guardMesh).toBeTruthy();
    const mat = built.guardMesh!.material as THREE.MeshStandardMaterial;
    expect(mat.side).toBe(THREE.DoubleSide);
  });

  it('mirrored guard halves overlap across Z (aligned thickness)', () => {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.02), mm());
    blade.position.y = 0.6;
    const params: any = {
      style: 'winged',
      width: 0.6,
      thickness: 0.08,
      curve: 0.2,
      tipSharpness: 0.4,
    };
    const built = buildGuard(params, {
      bladeMesh: blade,
      handleMesh: null as any,
      makeMaterial: () => mm(),
    });
    expect(built.guardGroup).toBeTruthy();
    const group = built.guardGroup!;
    // Expect two child meshes (right + mirrored left)
    const children = group.children.filter((c) => (c as any).isMesh) as THREE.Mesh[];
    expect(children.length).toBeGreaterThanOrEqual(2);
    const a = new THREE.Box3().setFromObject(children[0]);
    const b = new THREE.Box3().setFromObject(children[1]);
    // Midpoints along Z should be nearly identical
    const midA = (a.min.z + a.max.z) * 0.5;
    const midB = (b.min.z + b.max.z) * 0.5;
    expect(Math.abs(midA - midB)).toBeLessThan(1e-6);
  });
});
