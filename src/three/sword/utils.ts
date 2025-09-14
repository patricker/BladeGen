import * as THREE from 'three'

/** Dispose geometries and materials for all meshes in a subtree. */
export function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    const m = obj as THREE.Mesh
    if ((m as any).isMesh) {
      ;(m.geometry as any)?.dispose?.()
      const mat = m.material as THREE.Material | THREE.Material[]
      if (Array.isArray(mat)) mat.forEach((x) => (x as any)?.dispose?.())
      else (mat as any)?.dispose?.()
    }
  })
}

