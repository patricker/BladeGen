import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { defaultSwordParams, SwordGenerator } from '../SwordGenerator';
import { buildPrintableGroup } from '../export/printable';
import { countBoundaryEdges } from '../../core/mesh/repair';

describe('printable export group', () => {
  it('caps handle and yields meshes without boundary edges', async () => {
    const sword = new SwordGenerator(defaultSwordParams());
    const group = buildPrintableGroup(sword);
    // Traverse meshes and verify each is closed (no boundary edges)
    const meshes: THREE.Mesh[] = [];
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((m as any).isMesh) meshes.push(m);
    });
    expect(meshes.length).toBeGreaterThan(0);
    for (const m of meshes) {
      const g = (m.geometry as THREE.BufferGeometry).clone();
      // Apply the world matrix to test actual printed orientation (not strictly needed for topology)
      g.applyMatrix4(m.matrixWorld);
      const boundaryEdges = countBoundaryEdges(g);
      console.log('mesh', (g as any).type, 'boundaryEdges=', boundaryEdges);
      expect(boundaryEdges).toBe(0);
    }
  });
});
