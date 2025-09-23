import { describe, it, expect } from 'vitest';
import {
  FresnelShader,
  FlameAuraShader,
  MistShader,
  BloomCompositeShader,
  HeatHazeShader,
  VignetteShader,
} from '../../../three/fx/shaders';

describe('fx/shaders', () => {
  it('exports shader objects with uniforms and shaders', () => {
    for (const s of [
      FresnelShader,
      FlameAuraShader,
      MistShader,
      BloomCompositeShader,
      HeatHazeShader,
      VignetteShader,
    ]) {
      expect(s).toBeTruthy();
      expect(typeof (s as any).vertexShader).toBe('string');
      expect(typeof (s as any).fragmentShader).toBe('string');
      expect(typeof (s as any).uniforms).toBe('object');
    }
  });
});
