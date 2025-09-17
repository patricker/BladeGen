import * as THREE from 'three'
import type { Material } from 'three'
import type { SwordParams } from './types'
import { TextureCache } from './textures'

export type SwordPart = 'blade'|'guard'|'handle'|'pommel'

/**
 * Create a MeshPhysicalMaterial for a sword part from optional presets.
 * Accepts a TextureCache for lazy map loading.
 */
export function createMaterial(
  part: SwordPart,
  presets?: Record<string, any> | null,
  textures?: TextureCache
): THREE.MeshPhysicalMaterial {
  const m = presets || {}
  const defaults: Record<SwordPart, Record<string, any>> = {
    blade:  { color: 0xb9c6ff, metalness: 0.8,  roughness: 0.25, clearcoat: 0.0, clearcoatRoughness: 0.5 },
    guard:  { color: 0x8892b0, metalness: 0.6,  roughness: 0.4,  clearcoat: 0.0, clearcoatRoughness: 0.5 },
    handle: { color: 0x5a6b78, metalness: 0.1,  roughness: 0.85, clearcoat: 0.0, clearcoatRoughness: 0.6 },
    pommel: { color: 0x9aa4b2, metalness: 0.75, roughness: 0.35, clearcoat: 0.0, clearcoatRoughness: 0.5 },
  }
  const base = defaults[part]
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(m.color ?? base.color),
    metalness: m.metalness ?? base.metalness,
    roughness: m.roughness ?? base.roughness,
    clearcoat: m.clearcoat ?? base.clearcoat,
    clearcoatRoughness: m.clearcoatRoughness ?? base.clearcoatRoughness,
  })

  // Optional PBR extensions
  if (m.emissiveColor) { (mat as any).emissive = new THREE.Color(m.emissiveColor); (mat as any).emissiveIntensity = m.emissiveIntensity ?? 0.5 }
  if (m.transmission) { (mat as any).transmission = m.transmission; (mat as any).ior = m.ior ?? 1.5; (mat as any).thickness = m.thickness ?? 0.2; if (m.attenuationColor) (mat as any).attenuationColor = new THREE.Color(m.attenuationColor); if (m.attenuationDistance!==undefined) (mat as any).attenuationDistance = m.attenuationDistance }
  if (m.sheen!==undefined) { (mat as any).sheen = m.sheen; if (m.sheenColor) (mat as any).sheenColor = new THREE.Color(m.sheenColor) }
  if (m.iridescence!==undefined) { (mat as any).iridescence = m.iridescence; (mat as any).iridescenceIOR = m.iridescenceIOR ?? 1.3; (mat as any).iridescenceThicknessRange = [m.iridescenceThicknessMin ?? 100, m.iridescenceThicknessMax ?? 400] }
  if (m.anisotropy !== undefined) { (mat as any).anisotropy = m.anisotropy }
  if (m.anisotropyRotation !== undefined) { (mat as any).anisotropyRotation = m.anisotropyRotation }

  // Optional texture maps
  const maps: Array<[keyof THREE.MeshPhysicalMaterial, string, boolean]> = [
    ['map', 'map', true],
    ['normalMap', 'normalMap', false],
    ['roughnessMap', 'roughnessMap', false],
    ['metalnessMap', 'metalnessMap', false],
    ['aoMap', 'aoMap', false],
    ['bumpMap', 'bumpMap', false],
    ['displacementMap', 'displacementMap', false],
    ['alphaMap', 'alphaMap', false],
    ['clearcoatNormalMap', 'clearcoatNormalMap', false],
  ] as any
  for (const [prop, key, srgb] of maps) {
    const url = (m as any)[key]
    if (url && textures) {
      const tex = textures.get(url, { sRGB: !!srgb })
      if (tex) (mat as any)[prop] = tex
    }
  }
  if (m.envMapIntensity !== undefined) (mat as any).envMapIntensity = m.envMapIntensity
  return mat
}
