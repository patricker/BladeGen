import * as THREE from 'three'
import { SwordGenerator, defaultSwordParams, type SwordParams } from '../../SwordGenerator'

export type PartName = 'blade' | 'guard' | 'handle' | 'pommel' | 'scabbard' | 'tassel'

export type Bounds = { min: THREE.Vector3; max: THREE.Vector3; size: THREE.Vector3 }

export function makeSword(overrides?: Partial<SwordParams>): SwordGenerator {
  const base = defaultSwordParams()
  const params: SwordParams = JSON.parse(JSON.stringify({ ...base, ...overrides }))
  return new SwordGenerator(params)
}

export function boundsOf(obj: THREE.Object3D | null | undefined): Bounds | null {
  if (!obj) return null
  const box = new THREE.Box3().setFromObject(obj)
  const size = new THREE.Vector3()
  box.getSize(size)
  return { min: box.min.clone(), max: box.max.clone(), size }
}

export function partBounds(s: SwordGenerator, part: PartName): Bounds | null {
  const map: Record<PartName, THREE.Object3D | null> = {
    blade: s.bladeMesh,
    guard: (s as any).guardMesh ?? (s as any).guardGroup ?? null,
    handle: s.handleMesh ?? (s as any).handleGroup ?? null,
    pommel: s.pommelMesh,
    scabbard: s.scabbardGroup,
    tassel: s.tasselGroup,
  }
  return boundsOf(map[part])
}

export function vertexCount(mesh: THREE.Mesh | null | undefined): number {
  if (!mesh) return 0
  const geom = mesh.geometry as THREE.BufferGeometry
  const pos = geom.getAttribute('position') as THREE.BufferAttribute | undefined
  return pos?.count ?? 0
}

export function groupDescendantsCount(obj: THREE.Object3D | null | undefined): number {
  if (!obj) return 0
  let n = 0
  obj.traverse((o) => { if (o !== obj) n++ })
  return n
}

export function approx(a: number, b: number, eps = 1e-4) {
  return Math.abs(a - b) <= eps
}

export function greater(a: number, b: number, eps = 1e-5) {
  return a > b + eps
}

export function less(a: number, b: number, eps = 1e-5) {
  return a < b - eps
}

// Slice helpers at a normalized Y to measure local width/thickness
function sampleSlice(mesh: THREE.Mesh, t: number, tolFactor = 0.01): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  const geom = mesh.geometry as THREE.BufferGeometry
  const pos = geom.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!pos) return null
  const arr = pos.array as unknown as number[]
  const box = new THREE.Box3().setFromObject(mesh)
  const yMin = box.min.y, yMax = box.max.y
  const ySpan = Math.max(1e-6, yMax - yMin)
  const yTarget = yMin + THREE.MathUtils.clamp(t, 0, 1) * ySpan
  const tol = ySpan * tolFactor
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  let hit = false
  for (let i = 0; i < pos.count; i++) {
    const ix = i * 3
    const x = arr[ix + 0]
    const y = arr[ix + 1]
    const z = arr[ix + 2]
    if (Math.abs(y - yTarget) <= tol) {
      hit = true
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    }
  }
  if (!hit && tolFactor < 0.05) {
    return sampleSlice(mesh, t, tolFactor * 2)
  }
  if (!hit) return null
  return { minX, maxX, minZ, maxZ }
}

export function bladeWidthAt(s: SwordGenerator, t: number): number | null {
  if (!s.bladeMesh) return null
  const slice = sampleSlice(s.bladeMesh, t)
  if (!slice) return null
  return slice.maxX - slice.minX
}

export function bladeCenterlineXAt(s: SwordGenerator, t: number): number | null {
  if (!s.bladeMesh) return null
  const slice = sampleSlice(s.bladeMesh, t)
  if (!slice) return null
  return 0.5 * (slice.minX + slice.maxX)
}

export function bladeThicknessAt(s: SwordGenerator, t: number): number | null {
  if (!s.bladeMesh) return null
  const slice = sampleSlice(s.bladeMesh, t)
  if (!slice) return null
  return slice.maxZ - slice.minZ
}

export function bladeHalfWidthsAt(s: SwordGenerator, t: number): { left: number; right: number } | null {
  if (!s.bladeMesh) return null
  const slice = sampleSlice(s.bladeMesh, t)
  if (!slice) return null
  const cx = 0.5 * (slice.minX + slice.maxX)
  return { left: cx - slice.minX, right: slice.maxX - cx }
}

export function widthsStdDev(s: SwordGenerator, samples: number[] = [0.1, 0.2, 0.3, 0.4, 0.5]): number | null {
  const vals: number[] = []
  for (const t of samples) {
    const w = bladeWidthAt(s, t)
    if (w == null) return null
    vals.push(w)
  }
  const mean = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length)
  const variance = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / Math.max(1, vals.length)
  return Math.sqrt(variance)
}

export function bladeThicknessAtXBand(
  s: SwordGenerator,
  t: number,
  xCenter: number,
  band: number
): number | null {
  if (!s.bladeMesh) return null
  const geom = s.bladeMesh.geometry as THREE.BufferGeometry
  const pos = geom.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!pos) return null
  const arr = pos.array as unknown as number[]
  const box = new THREE.Box3().setFromObject(s.bladeMesh)
  const yMin = box.min.y, yMax = box.max.y
  const ySpan = Math.max(1e-6, yMax - yMin)
  const yTarget = yMin + THREE.MathUtils.clamp(t, 0, 1) * ySpan
  const tolY = ySpan * 0.01
  let minZ = Infinity, maxZ = -Infinity
  let hit = false
  for (let i = 0; i < pos.count; i++) {
    const ix = i * 3
    const x = arr[ix + 0]
    const y = arr[ix + 1]
    const z = arr[ix + 2]
    if (Math.abs(y - yTarget) <= tolY && Math.abs(x - xCenter) <= band) {
      hit = true
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    }
  }
  if (!hit) return null
  return maxZ - minZ
}

export function totalVertices(obj: THREE.Object3D | null | undefined): number {
  if (!obj) return 0
  let total = 0
  obj.traverse((o) => {
    const m = o as any
    if (m.isMesh && m.geometry) {
      const pos = (m.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute | undefined
      if (pos) total += pos.count
    }
  })
  return total
}

export function findChildByName(obj: THREE.Object3D | null | undefined, name: string): THREE.Object3D | null {
  if (!obj) return null
  let found: THREE.Object3D | null = null
  obj.traverse((o) => { if (!found && o.name === name) found = o })
  return found
}
