import type * as THREE from 'three';
import type { SwordGenerator } from '../three/SwordGenerator';

/** Part label for each top-level child of the sword group (null = skip). */
function partOf(sword: SwordGenerator, obj: THREE.Object3D): string | null {
  const s = sword as any;
  if (obj === sword.bladeMesh) return 'blade';
  if (obj === s.fullerGroup) return 'blade.fuller';
  if (obj === s.hamonGroup) return 'blade.hamon';
  if (obj === s.engravingGroup) return 'blade.engraving';
  if (obj === sword.glowMesh) return 'glow';
  if (obj === sword.guardMesh || obj === s.guardGroup) return 'guard';
  if (obj === s.handleGroup || obj === sword.handleMesh) return 'handle';
  if (obj === sword.pommelMesh) return 'pommel';
  if (obj === sword.scabbardGroup) return 'scabbard';
  if (obj === sword.tasselGroup) return 'tassel';
  if (obj.name.startsWith('anchor.')) return null;
  return (obj as any).isMesh || obj.children.length ? 'guard.extra' : null;
}

export type MeshEntry = { mesh: THREE.Mesh; part: string; name: string };

/**
 * Meshes in canonical order: depth-first over the sword group's children in
 * insertion order (Object3D.traverse order), skipping helper anchors. Names are
 * `<part>#<k>` with k counting meshes within that part.
 */
export function listMeshes(sword: SwordGenerator): MeshEntry[] {
  const out: MeshEntry[] = [];
  const counts = new Map<string, number>();
  for (const child of sword.group.children) {
    const part = partOf(sword, child);
    if (!part) continue;
    child.traverse((o: THREE.Object3D) => {
      if (!(o as any).isMesh) return;
      const k = counts.get(part) ?? 0;
      counts.set(part, k + 1);
      out.push({ mesh: o as THREE.Mesh, part, name: `${part}#${k}` });
    });
  }
  return out;
}
