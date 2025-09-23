import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildBladeGeometry } from '../bladeGeometry';
import { defaultSwordParams } from '../../SwordGenerator';

const isFiniteNumber = (v: number) => Number.isFinite(v) && !Number.isNaN(v);

describe('buildBladeGeometry tangents', () => {
  it('adds a normalized tangent attribute orthogonal to normals', () => {
    const params = defaultSwordParams().blade;
    const geo = buildBladeGeometry(params);
    const tangents = geo.getAttribute('tangent') as THREE.BufferAttribute | undefined;
    const normals = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
    expect(tangents).toBeTruthy();
    expect(tangents!.itemSize).toBe(4);
    expect(normals).toBeTruthy();
    const count = Math.min(50, tangents!.count);
    for (let i = 0; i < count; i++) {
      const tx = tangents!.getX(i);
      const ty = tangents!.getY(i);
      const tz = tangents!.getZ(i);
      const nx = normals!.getX(i);
      const ny = normals!.getY(i);
      const nz = normals!.getZ(i);
      expect(isFiniteNumber(tx) && isFiniteNumber(ty) && isFiniteNumber(tz)).toBe(true);
      const len = Math.hypot(tx, ty, tz);
      expect(len).toBeGreaterThan(0.99);
      expect(len).toBeLessThan(1.01);
      const dot = tx * nx + ty * ny + tz * nz;
      expect(Math.abs(dot)).toBeLessThan(1e-3);
    }
  });
});
