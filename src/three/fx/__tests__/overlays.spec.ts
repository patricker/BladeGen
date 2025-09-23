import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import {
  buildInkOutline,
  buildFresnel,
  buildBladeGradientOverlay,
  buildBladeGradientWearOverlay,
} from '../../../three/fx/overlays';

describe('fx/overlays', () => {
  it('builds ink outline group from source object', () => {
    const src = new THREE.Group();
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    src.add(cube);
    const g = buildInkOutline(src, 0.02, 0x000000);
    expect(g.children.length).toBeGreaterThan(0);
  });

  it('builds fresnel overlay group from source object', () => {
    const src = new THREE.Group();
    src.add(new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), new THREE.MeshBasicMaterial()));
    const g = buildFresnel(src, 0xffffff, 0.5, 2.0);
    expect(g.children.length).toBeGreaterThan(0);
  });

  it('builds blade gradient overlay for a mesh', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.1), new THREE.MeshBasicMaterial());
    const g = buildBladeGradientOverlay(mesh, 0x222222, 0xffffff, 0.5, 0.3);
    expect(g.children.length).toBe(1);
  });

  it('builds blade gradient wear overlay (per-row widths)', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.1), new THREE.MeshBasicMaterial());
    const g = buildBladeGradientWearOverlay(mesh, 0x222222, 0xffffff, 0.4, 0.2);
    expect(g.children.length).toBe(1);
  });
});
