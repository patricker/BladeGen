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

/**
 * Generate a Damascus steel / watered steel pattern texture.
 * Produces flowing, layered bands that mimic the folded-steel look.
 *
 * - layers: number of visible fold bands (higher = finer pattern)
 * - distortion: how much turbulence warps the bands (0 = straight lines)
 * - contrast: band sharpness (0 = soft, 1 = hard edges)
 * - seed: PRNG seed for reproducible variation
 * - size: texture dimension in pixels
 *
 * Returns a CanvasTexture suitable for roughnessMap or bumpMap.
 */
export function makeDamascusTexture(
  layers = 12,
  distortion = 0.4,
  contrast = 0.6,
  seed = 42,
  size = 512
) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const s = seed | 0;

  // Deterministic hash for turbulence
  const hash = (u: number, v: number) => {
    const n = Math.sin(u * 12.9898 + v * 78.233 + s * 0.001) * 43758.5453;
    return n - Math.floor(n);
  };

  // Smooth noise with bilinear interpolation
  const smoothNoise = (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    const sx = fx * fx * (3 - 2 * fx); // smoothstep
    const sy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };

  // FBM turbulence
  const turbulence = (x: number, y: number, octaves: number) => {
    let n = 0;
    let amp = 1;
    let freq = 1;
    for (let o = 0; o < octaves; o++) {
      n += smoothNoise(x * freq + o * 7.3, y * freq + o * 13.1) * amp;
      amp *= 0.5;
      freq *= 2;
    }
    return n;
  };

  const img = ctx.createImageData(size, size);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const v = py / size;

      // Turbulence displacement
      const turb = turbulence(u * 6, v * 6, 4) * distortion;

      // Primary watered pattern: sinusoidal bands running along Y-axis
      // with turbulence warping to create the organic flow
      const bandY = (v * layers + turb * layers * 0.5);
      const wave1 = Math.sin(bandY * Math.PI * 2);

      // Secondary cross-pattern for complexity
      const bandX = (u * layers * 0.4 + turb * layers * 0.3);
      const wave2 = Math.sin(bandX * Math.PI * 2) * 0.3;

      // Combine waves
      let pattern = (wave1 + wave2) * 0.5 + 0.5;

      // Apply contrast: push values toward 0 or 1
      if (contrast > 0) {
        pattern = pattern - 0.5;
        pattern = pattern * (1 + contrast * 3);
        pattern = pattern + 0.5;
      }

      // Clamp to [0, 1] and map to grayscale
      pattern = Math.max(0, Math.min(1, pattern));
      // Light bands = polished steel (low roughness), dark = oxidized (higher roughness)
      const val = Math.floor(pattern * 255);
      const idx = (py * size + px) * 4;
      img.data[idx] = val;
      img.data[idx + 1] = val;
      img.data[idx + 2] = val;
      img.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}
