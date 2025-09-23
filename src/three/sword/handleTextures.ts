import * as THREE from 'three';

/**
 * Procedural handle wrap texture generator.
 *
 * Produces a small CanvasTexture with diagonal stripes intended to simulate
 * cord/leather wrapping. The texture is set to sRGB color space and repeats.
 */
export function makeWrapTexture(scale: number, angleRad: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  // Background
  ctx.fillStyle = '#2a313a';
  ctx.fillRect(0, 0, size, size);
  // Draw diagonal stripes
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(angleRad);
  ctx.translate(-size / 2, -size / 2);
  const stripe = Math.max(2, Math.floor(size / Math.max(1e-3, scale)));
  const gap = Math.max(2, Math.floor(stripe * 0.6));
  ctx.fillStyle = '#3d4754';
  for (let x = -size; x < size * 2; x += stripe + gap) {
    ctx.fillRect(x, -size, stripe, size * 3);
  }
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 6);
  (tex as any).colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
