import * as THREE from 'three'

/**
 * Lightweight texture cache/loader for materials.
 * - Returns a placeholder Texture immediately to let materials bind.
 * - On load, caches the real texture and marks it for update.
 */
export class TextureCache {
  private loader?: THREE.TextureLoader
  private cache = new Map<string, THREE.Texture>()

  get(url?: string, opts?: { sRGB?: boolean }): THREE.Texture | undefined {
    if (!url) return undefined
    this.loader = this.loader || new THREE.TextureLoader()
    const cached = this.cache.get(url)
    if (cached) return cached
    const placeholder = new THREE.Texture()
    this.loader.load(url, (tex) => {
      if (opts?.sRGB) (tex as any).colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      this.cache.set(url, tex)
    })
    return placeholder
  }
}

