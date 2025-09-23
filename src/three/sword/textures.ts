import * as THREE from 'three';

/**
 * Lightweight texture cache/loader for materials.
 * - Returns a placeholder Texture immediately to let materials bind.
 * - On load, caches the real texture and marks it for update.
 */
export class TextureCache {
  private loader?: THREE.TextureLoader;
  private cache = new Map<string, THREE.Texture>();

  get(url?: string, opts?: { sRGB?: boolean }): THREE.Texture | undefined {
    if (!url) return undefined;
    this.loader = this.loader || new THREE.TextureLoader();
    const cached = this.cache.get(url);
    if (cached) return cached;
    // Neutral 1x1 placeholder to avoid black flashes and respect color space
    const placeholder = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
    if (opts?.sRGB) (placeholder as any).colorSpace = THREE.SRGBColorSpace;
    placeholder.needsUpdate = true;
    this.loader.load(url, (tex) => {
      if (opts?.sRGB) (tex as any).colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      this.cache.set(url, tex);
    });
    return placeholder;
  }
}
