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
      return [sword.handleMesh]
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
