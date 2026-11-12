/**
 * Canonical mesh dump for cross-language conformance (see docs/conformance.md).
 *
 * For every mesh (in `listMeshes` order) the dump records the raw geometry the
 * builders produced, before any export step: each attribute as little-endian
 * f32, the index as little-endian u32 (null for non-indexed geometry), and the
 * mesh's 4x4 matrix relative to the sword group (f64, column-major, the product
 * of local matrices from the mesh up to, not including, the sword group).
 */
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import type { SwordGenerator } from '../three/SwordGenerator';
import { listMeshes } from './parts';

export type BufferRef = {
  itemSize: number;
  count: number;
  byteOffset: number;
  byteLength: number;
  sha256: string;
};

export type MeshDump = {
  format: 'bladegen-mesh-dump';
  formatVersion: 1;
  units: 'bladegen';
  frame: string;
  quantizeStep: number;
  meshes: Array<{
    name: string;
    part: string;
    vertexCount: number;
    triangleCount: number;
    matrix: number[];
    attributes: Record<string, BufferRef>;
    index: BufferRef | null;
    material: { name: string; doubleSided: boolean; vertexColorsInGlb: boolean };
    quantizedSha256: string;
  }>;
  totals: { meshes: number; vertices: number; triangles: number };
  quantizedSha256: string;
};

const QUANT_STEP = 1e-4;

function sha(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex');
}

function matrixToSword(mesh: THREE.Object3D, root: THREE.Object3D): THREE.Matrix4 {
  mesh.updateMatrix();
  const m = mesh.matrix.clone();
  for (let p = mesh.parent; p && p !== root; p = p.parent) {
    p.updateMatrix();
    m.premultiply(p.matrix);
  }
  return m;
}

/** Build the dump JSON plus the binary blob it indexes into. */
export function dumpMeshes(sword: SwordGenerator): { json: MeshDump; bin: Uint8Array } {
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const push = (bytes: Uint8Array, itemSize: number, count: number): BufferRef => {
    const ref = {
      itemSize,
      count,
      byteOffset: offset,
      byteLength: bytes.byteLength,
      sha256: sha(bytes),
    };
    chunks.push(bytes);
    offset += bytes.byteLength;
    return ref;
  };
  const allQuant = createHash('sha256');
  const meshes: MeshDump['meshes'] = [];
  let totalV = 0;
  let totalT = 0;
  for (const { mesh, part, name } of listMeshes(sword)) {
    const geo = mesh.geometry as THREE.BufferGeometry;
    const attributes: Record<string, BufferRef> = {};
    for (const key of Object.keys(geo.attributes).sort()) {
      const attr = geo.getAttribute(key) as THREE.BufferAttribute;
      const f32 = new Float32Array(attr.count * attr.itemSize);
      for (let i = 0; i < attr.count; i++)
        for (let c = 0; c < attr.itemSize; c++)
          f32[i * attr.itemSize + c] = (attr.array as any)[i * attr.itemSize + c];
      attributes[key] = push(new Uint8Array(f32.buffer), attr.itemSize, attr.count);
    }
    let index: BufferRef | null = null;
    const vcount = geo.getAttribute('position').count;
    let tris = vcount / 3;
    if (geo.index) {
      const u32 = Uint32Array.from(geo.index.array as ArrayLike<number>);
      index = push(new Uint8Array(u32.buffer), 1, u32.length);
      tris = u32.length / 3;
    }
    const m = matrixToSword(mesh, sword.group);
    // Quantized world positions: floor(v / step + 0.5) as int32, xyz per vertex.
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const q = new Int32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      q[i * 3] = Math.floor(v.x / QUANT_STEP + 0.5);
      q[i * 3 + 1] = Math.floor(v.y / QUANT_STEP + 0.5);
      q[i * 3 + 2] = Math.floor(v.z / QUANT_STEP + 0.5);
    }
    const qBytes = new Uint8Array(q.buffer);
    allQuant.update(qBytes);
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material;
    meshes.push({
      name,
      part,
      vertexCount: vcount,
      triangleCount: tris,
      matrix: Array.from(m.elements),
      attributes,
      index,
      material: {
        name: mat?.name ?? '',
        doubleSided: mat?.side === THREE.DoubleSide,
        vertexColorsInGlb: !!geo.getAttribute('color'),
      },
      quantizedSha256: sha(qBytes),
    });
    totalV += vcount;
    totalT += tris;
  }
  const bin = new Uint8Array(offset);
  let o = 0;
  for (const c of chunks) {
    bin.set(c, o);
    o += c.byteLength;
  }
  return {
    json: {
      format: 'bladegen-mesh-dump',
      formatVersion: 1,
      units: 'bladegen',
      frame: 'sword group: blade base (guard line) at y=0, tip at +Y, X width, Z thickness',
      quantizeStep: QUANT_STEP,
      meshes,
      totals: { meshes: meshes.length, vertices: totalV, triangles: totalT },
      quantizedSha256: allQuant.digest('hex'),
    },
    bin,
  };
}
