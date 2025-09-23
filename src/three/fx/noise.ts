import * as THREE from 'three';

/**
 * Generate a tileable value-noise CanvasTexture for use as bump/roughness/etc.
 * - scale: frequency scaling of noise
 * - seed: integer PRNG seed
 * - size: texture dimension (defaults to 256)
 */
export function makeValueNoiseTexture(scale = 8, seed = 1337, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  let s = seed | 0;
  // simple hash noise function
  const hash = (u: number, v: number) => {
    const n = Math.sin(u * 12.9898 + v * 78.233 + s * 0.001) * 43758.5453;
    return n - Math.floor(n);
  };
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * scale,
        ny = (y / size) * scale;
      let n = 0,
        amp = 1,
        freq = 1;
      for (let o = 0; o < 3; o++) {
        n += hash(Math.floor(nx * freq) + o * 7, Math.floor(ny * freq) + o * 19) * amp;
        amp *= 0.5;
        freq *= 2;
      }
      const v = Math.max(0, Math.min(255, Math.floor(n * 255)));
      const idx = (y * size + x) * 4;
      img.data[idx] = v;
      img.data[idx + 1] = v;
      img.data[idx + 2] = v;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}
