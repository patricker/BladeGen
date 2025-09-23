import { describe, it, expect } from 'vitest';
import { buildGuardHalfShape } from '../../three/sword/guardShapes';

describe('guardShapes', () => {
  it('builds a winged half shape', () => {
    const s = buildGuardHalfShape({
      width: 1.2,
      thickness: 0.2,
      curve: 0.3,
      tilt: 0,
      style: 'winged',
    });
    // Rough sanity: shape has curves/points
    // Three.Shape stores curves in .getPoints; ensure something comes back
    const pts = s.getPoints(5);
    expect(pts.length).toBeGreaterThan(0);
  });
});
