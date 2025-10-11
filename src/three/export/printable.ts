import * as THREE from 'three';
import type { SwordGenerator } from '../SwordGenerator';
import { capEndsByY } from '../../core/mesh/repair';

/**
 * Build a print-safe group from the live sword scene graph.
 * - Excludes non-solid overlays (fullers/hamon, outlines, engraving mask/fill).
 * - Caps handle lathe ends for a watertight core.
 * - Keeps only core solids: blade, guard mesh/group (minus tubes/ropes), handle core, pommel.
 */
export function buildPrintableGroup(sword: SwordGenerator): THREE.Group {
  const root = new THREE.Group();
  const addMeshClone = (mesh: THREE.Mesh) => {
    if (!mesh.geometry) return;
    const g = (mesh.geometry as THREE.BufferGeometry).clone();
    // Cap ends for lathe-like handle core
    if ((g as any).type === 'LatheGeometry' || /lathe/i.test((g as any).type || '')) {
      const capped = capEndsByY(g);
      const clone = new THREE.Mesh(capped);
      clone.matrix.copy(mesh.matrix);
      clone.matrixWorld.copy(mesh.matrixWorld);
      clone.matrixAutoUpdate = false;
      root.add(clone);
      return;
    }
    // Skip thin tubes and torus rings (wraps, knucklebows) by geometry type
    const type = (g as any).type || '';
    if (/TubeGeometry|TorusGeometry/i.test(type)) return;
    const clone = new THREE.Mesh(g);
    clone.matrix.copy(mesh.matrix);
    clone.matrixWorld.copy(mesh.matrixWorld);
    clone.matrixAutoUpdate = false;
    root.add(clone);
  };

  // Blade (after engraving bake it’s already carved)
  if (sword.bladeMesh) addMeshClone(sword.bladeMesh);

  // Guard: include guardMesh if present; otherwise traverse guardGroup minus tubes
  const guardObj: THREE.Object3D | null = (sword as any).guardMesh ?? (sword as any).guardGroup ?? null;
  if (guardObj) {
    guardObj.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((m as any).isMesh) addMeshClone(m);
    });
  }

  // Handle core only; exclude decorative children by only cloning handleMesh
  if (sword.handleMesh) addMeshClone(sword.handleMesh);

  // Pommel
  if (sword.pommelMesh) addMeshClone(sword.pommelMesh);

  // Skip scabbard and tassel by default for STL

  return root;
}

