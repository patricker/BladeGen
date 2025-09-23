import { describe, it, expect } from 'vitest';
import { setupScene } from '../../three/setupScene';

describe('setupScene module', () => {
  it('exports setupScene function', () => {
    expect(typeof setupScene).toBe('function');
  });
});
