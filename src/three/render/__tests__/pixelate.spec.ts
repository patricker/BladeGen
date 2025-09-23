import { describe, it, expect } from 'vitest';
import { buildPixelatePass } from '../passes/pixelate';

describe('PixelatePass', () => {
  it('sets initial uniforms from args and clamps values', () => {
    const pass = buildPixelatePass(7, 5);
    // @ts-expect-error runtime uniform access
    expect(pass.uniforms.pixelSize.value).toBe(7);
    // @ts-expect-error runtime uniform access
    expect(pass.uniforms.posterizeLevels.value).toBe(5);

    const pass2 = buildPixelatePass(0, -3);
    // @ts-expect-error runtime uniform access
    expect(pass2.uniforms.pixelSize.value).toBe(1);
    // @ts-expect-error runtime uniform access
    expect(pass2.uniforms.posterizeLevels.value).toBe(0);
  });

  it('updates resolution uniform on setSize', () => {
    const pass = buildPixelatePass(4, 0);
    // @ts-expect-error runtime uniform access
    const res = pass.uniforms.resolution.value;
    expect(res.x).toBe(1);
    expect(res.y).toBe(1);
    // exercise the overridden setSize
    // @ts-expect-error ShaderPass type
    pass.setSize(800, 600);
    expect(res.x).toBe(800);
    expect(res.y).toBe(600);
  });
});
