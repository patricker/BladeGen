import * as THREE from 'three'
import type { SwordGenerator } from '../SwordGenerator'

export type SwordPart = 'blade' | 'guard' | 'handle' | 'pommel' | 'scabbard' | 'tassel'

type AnyMaterial = THREE.Material & Record<string, any>

type MaterialVisitor = (material: AnyMaterial, mesh: THREE.Mesh) => void

function getPartRoots(sword: SwordGenerator, part: SwordPart): Array<THREE.Object3D | null | undefined> {
  const swordAny = sword as any
  switch (part) {
    case 'blade':
      return [sword.bladeMesh]
    case 'guard':
      return [sword.guardMesh, swordAny.guardGroup]
    case 'handle':
      return [sword.handleMesh, swordAny.handleGroup]
    case 'pommel':
      return [sword.pommelMesh]
    case 'scabbard':
      return [sword.scabbardGroup]
    case 'tassel':
      return [sword.tasselGroup]
    default:
      return []
  }
}

function visitObjectMaterials(obj: THREE.Object3D | null | undefined, visitor: MaterialVisitor) {
  if (!obj) return
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const material = mesh.material as AnyMaterial | AnyMaterial[] | undefined
    if (!material) return
    if (Array.isArray(material)) {
      for (const mat of material) visitor(mat, mesh)
    } else {
      visitor(material, mesh)
    }
  })
}

export function visitPartMaterials(sword: SwordGenerator, part: SwordPart, visitor: MaterialVisitor) {
  const roots = getPartRoots(sword, part)
  for (const root of roots) {
    visitObjectMaterials(root, visitor)
  }
}

export function setPartColor(sword: SwordGenerator, part: SwordPart, hex: number) {
  visitPartMaterials(sword, part, (material) => {
    if ('color' in material && material.color && typeof material.color.setHex === 'function') {
      material.color.setHex(hex)
    }
  })
}

function setScalarProperty(
  sword: SwordGenerator,
  part: SwordPart,
  property: 'metalness' | 'roughness' | 'clearcoat' | 'clearcoatRoughness',
  value: number
) {
  visitPartMaterials(sword, part, (material) => {
    if (property in material) {
      material[property] = value
      if ('needsUpdate' in material) material.needsUpdate = true
    }
  })
}

export function setPartMetalness(sword: SwordGenerator, part: SwordPart, value: number) {
  setScalarProperty(sword, part, 'metalness', value)
}

export function setPartRoughness(sword: SwordGenerator, part: SwordPart, value: number) {
  setScalarProperty(sword, part, 'roughness', value)
}

export function setPartClearcoat(sword: SwordGenerator, part: SwordPart, value: number) {
  setScalarProperty(sword, part, 'clearcoat', value)
}

export function setPartClearcoatRoughness(sword: SwordGenerator, part: SwordPart, value: number) {
  setScalarProperty(sword, part, 'clearcoatRoughness', value)
}

type NoiseFactory = (scale: number, seed: number) => THREE.Texture

export function setPartBump(
  sword: SwordGenerator,
  part: SwordPart,
  enabled: boolean,
  options: { bumpScale?: number; noiseScale?: number; seed?: number } = {},
  makeNoiseTexture: NoiseFactory
) {
  visitPartMaterials(sword, part, (material) => {
    if (!('bumpScale' in material)) return
    if (enabled) {
      const scale = options.noiseScale ?? 8
      const seed = options.seed ?? 1337
      material.bumpMap = makeNoiseTexture(scale, seed)
      material.bumpScale = options.bumpScale ?? material.bumpScale ?? 0.02
    } else {
      material.bumpMap = null
      material.bumpScale = 0
    }
    material.needsUpdate = true
  })
}

const HIGHLIGHT_COLOR = 0x333333
const HIGHLIGHT_INTENSITY = 0.6
const BASE_EMISSIVE_KEY = '__baseEmissiveColor'
const BASE_INTENSITY_KEY = '__baseEmissiveIntensity'

function storeBaseEmissive(mat: AnyMaterial) {
  if (!('emissive' in mat)) return
  if (mat[BASE_EMISSIVE_KEY] === undefined && mat.emissive) {
    mat[BASE_EMISSIVE_KEY] = mat.emissive.getHex()
  }
  if (mat[BASE_INTENSITY_KEY] === undefined) {
    mat[BASE_INTENSITY_KEY] = typeof mat.emissiveIntensity === 'number' ? mat.emissiveIntensity : 1
  }
}

function applyHighlightState(mat: AnyMaterial, enabled: boolean, color = HIGHLIGHT_COLOR, intensity = HIGHLIGHT_INTENSITY) {
  if (!('emissive' in mat) || !mat.emissive) return
  storeBaseEmissive(mat)
  if (enabled) {
    mat.emissive.setHex(color)
    if ('emissiveIntensity' in mat) mat.emissiveIntensity = intensity
  } else {
    if (mat[BASE_EMISSIVE_KEY] !== undefined) mat.emissive.setHex(mat[BASE_EMISSIVE_KEY])
    if ('emissiveIntensity' in mat && mat[BASE_INTENSITY_KEY] !== undefined) {
      mat.emissiveIntensity = mat[BASE_INTENSITY_KEY]
    }
  }
  mat.needsUpdate = true
}

export function clearHighlight(sword: SwordGenerator) {
  const parts: SwordPart[] = ['blade', 'guard', 'handle', 'pommel', 'scabbard', 'tassel']
  for (const part of parts) {
    visitPartMaterials(sword, part, (material) => applyHighlightState(material, false))
  }
}

export function setHighlight(sword: SwordGenerator, part: SwordPart, options?: { color?: number; intensity?: number }) {
  const color = options?.color ?? HIGHLIGHT_COLOR
  const intensity = options?.intensity ?? HIGHLIGHT_INTENSITY
  visitPartMaterials(sword, part, (material) => applyHighlightState(material, true, color, intensity))
}
