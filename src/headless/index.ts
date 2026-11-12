/**
 * Headless (Node, no DOM required) entry point for bladegen.
 *
 * - `buildSword(params, materials)` builds the Three.js group via SwordGenerator.
 * - `prepareExport(sword, params, opts)` names meshes by part, hides helper
 *   anchors, adds blade grid UVs, makes the blade winding outward-consistent and
 *   optionally wraps the sword in a "monument" root node (tip down, metres,
 *   origin where the blade meets the ground).
 * - `exportGLB(root)` returns GLB bytes (installs a FileReader shim under Node).
 * - `dumpMeshes(sword)` returns the canonical conformance dump (see docs/conformance.md).
 *
 * Nothing here is imported by the website bundle.
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { SwordGenerator } from '../three/SwordGenerator';
import type { SwordParams } from '../three/sword/types';
import { validateSwordParams } from '../three/sword/validation';
import { bendOffsetX, wavinessAt } from '../three/sword/math';
import { fixBladeWinding } from '../three/sword/bladeGeometry';
import { BLADE_GRID_COLS, bladeGridSegments, bladeGridUVs } from '../three/sword/glow';
import { listMeshes } from './parts';

export { listMeshes, type MeshEntry } from './parts';

export type MaterialMap = Partial<
  Record<'blade' | 'guard' | 'handle' | 'pommel' | 'scabbard' | 'tassel', Record<string, any>>
>;

/** Options for the giant "monument" placement transform. */
export type MonumentOptions = {
  /** Blade length (guard line to tip) in metres. */
  heightM: number;
  /** Fraction of the blade length buried below the ground (0..0.6). */
  sink: number;
};

export type ExportOptions = {
  /** Add grid UVs to the blade when it has none (default true). */
  uvs?: boolean;
  /** Make the blade's winding and normals outward-consistent (default true). */
  fixWinding?: boolean;
  /** Wrap the sword in a monument root node (tip down, metres). */
  monument?: MonumentOptions;
};

/** A bladegen document as read/written by the CLI (subset of the site's JSON). */
export type HeadlessDoc = {
  version: 5;
  generator?: string;
  seed?: number;
  style?: string;
  model: SwordParams;
  materials?: MaterialMap;
  monument?: MonumentOptions;
};

/**
 * Accept the shapes people actually pass around and return {model, materials}:
 * a site export ({version, model, materials, render}), a headless doc, bare
 * SwordParams ({blade, guard, handle, pommel}) or a planet `sword.json` whose
 * `blade.bladegen` holds one of those.
 */
export function readDoc(json: any): HeadlessDoc {
  if (!json || typeof json !== 'object') throw new Error('params JSON must be an object');
  if (json.blade && json.blade.bladegen) return readDoc(json.blade.bladegen);
  if (json.model && json.model.blade) {
    return {
      version: 5,
      model: json.model,
      materials: stripMaterialUiKeys(json.materials),
      monument: json.monument,
      seed: json.seed,
      style: json.style,
    };
  }
  if (json.blade && json.guard && json.handle && json.pommel) {
    return { version: 5, model: json as SwordParams };
  }
  throw new Error('unrecognised params JSON (expected a bladegen document or SwordParams)');
}

function stripMaterialUiKeys(m: any): MaterialMap | undefined {
  if (!m || typeof m !== 'object') return undefined;
  const out: MaterialMap = {};
  for (const part of ['blade', 'guard', 'handle', 'pommel', 'scabbard', 'tassel'] as const) {
    if (m[part] && typeof m[part] === 'object') out[part] = { ...m[part] };
  }
  return out;
}

/** Build a sword. Disables the DOM-only handle wrap texture when there is no DOM. */
export function buildSword(params: SwordParams, materials?: MaterialMap): SwordGenerator {
  return new SwordGenerator(params, materials as any);
}

/**
 * Monument transform: rotate pi about +Z (tip down), scale so the blade is
 * `heightM` metres long, and translate so the blade centre line at
 * y = L * (1 - sink) (L = validated blade length) lands on the origin.
 * Returned as glTF-style TRS (quaternion x, y, z, w).
 */
export function monumentTransform(params: SwordParams, opts: MonumentOptions) {
  const b = validateSwordParams(params).blade;
  const L = Math.max(0.01, b.length);
  const sink = Math.min(0.6, Math.max(0, opts.sink));
  const scale = Math.max(1e-6, opts.heightM) / L;
  const yGround = L * (1 - sink);
  const tGround = yGround / L;
  const xGround = bendOffsetX(b, yGround, L) + wavinessAt(b, tGround).center;
  // R(pi about Z) maps (x, y, z) -> (-x, -y, z); translate the ground point to 0.
  const translation: [number, number, number] = [xGround * scale, yGround * scale, 0];
  const rotation: [number, number, number, number] = [0, 0, 1, 0];
  return { translation, rotation, scale: [scale, scale, scale] as [number, number, number], sink };
}

/**
 * Prepare a built sword for export. Mutates the sword (names meshes, hides
 * anchors, adds blade UVs) and returns the object to export.
 */
export function prepareExport(
  sword: SwordGenerator,
  params: SwordParams,
  opts: ExportOptions = {}
): THREE.Object3D {
  sword.group.name = 'bladegen';
  for (const child of sword.group.children) {
    if (child.name.startsWith('anchor.')) child.visible = false;
  }
  for (const { mesh, name } of listMeshes(sword)) mesh.name = name;
  if (sword.bladeMesh) {
    const geo = sword.bladeMesh.geometry as THREE.BufferGeometry;
    const segs = bladeGridSegments(validateSwordParams(params).blade);
    // Only the swept grid blade has this layout (engraving bakes replace it).
    const isGrid = geo.getAttribute('position').count === (segs + 1) * (BLADE_GRID_COLS + 1) * 2;
    if (isGrid && opts.uvs !== false && !geo.getAttribute('uv')) {
      geo.setAttribute('uv', new THREE.BufferAttribute(bladeGridUVs(segs), 2));
    }
    if (isGrid && opts.fixWinding !== false && !geo.userData.windingFixed) {
      fixBladeWinding(geo, segs);
      geo.userData.windingFixed = true;
    }
  }
  if (!opts.monument) return sword.group;
  const m = monumentTransform(params, opts.monument);
  const root = new THREE.Group();
  root.name = 'sword';
  root.position.fromArray(m.translation);
  root.quaternion.fromArray(m.rotation);
  root.scale.fromArray(m.scale);
  root.userData = {
    bladegen: {
      units: 'metres',
      origin: 'blade centre line at ground level',
      up: '+Y',
      heightM: opts.monument.heightM,
      sink: m.sink,
      glowMask: 'COLOR_0.a on blade and glow meshes',
    },
  };
  root.add(sword.group);
  return root;
}

/** Install a minimal FileReader (GLTFExporter's binary path needs one under Node). */
export function ensureFileReader(): void {
  const g = globalThis as any;
  if (typeof g.FileReader !== 'undefined') return;
  class NodeFileReader {
    result: any = null;
    onload: ((ev: any) => void) | null = null;
    onloadend: ((ev: any) => void) | null = null;
    readAsArrayBuffer(blob: Blob) {
      blob.arrayBuffer().then((ab) => {
        this.result = ab;
        this.onload?.({ target: this });
        this.onloadend?.({ target: this });
      });
    }
    readAsDataURL(blob: Blob) {
      blob.arrayBuffer().then((ab) => {
        let bin = '';
        const bytes = new Uint8Array(ab);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
        this.onload?.({ target: this });
        this.onloadend?.({ target: this });
      });
    }
  }
  g.FileReader = NodeFileReader;
}

/** Export an object to GLB bytes. */
export async function exportGLB(root: THREE.Object3D): Promise<Uint8Array> {
  ensureFileReader();
  root.updateMatrixWorld(true);
  const exporter = new GLTFExporter();
  const result = await new Promise<ArrayBuffer>((resolve, reject) =>
    exporter.parse(root, (r: unknown) => resolve(r as ArrayBuffer), reject, {
      binary: true,
      trs: true,
    })
  );
  return new Uint8Array(result);
}

/** Summary numbers for a built sword (sword-local units, no monument transform). */
export function swordStats(sword: SwordGenerator) {
  sword.group.updateMatrixWorld(true);
  let triangles = 0;
  let vertices = 0;
  const box = new THREE.Box3();
  for (const { mesh } of listMeshes(sword)) {
    const g = mesh.geometry as THREE.BufferGeometry;
    const pos = g.getAttribute('position');
    vertices += pos.count;
    triangles += (g.index ? g.index.count : pos.count) / 3;
    box.expandByObject(mesh);
  }
  const r = (v: number) => Math.round(v * 1e4) / 1e4;
  return {
    meshes: listMeshes(sword).length,
    triangles,
    vertices,
    bboxMin: [r(box.min.x), r(box.min.y), r(box.min.z)],
    bboxMax: [r(box.max.x), r(box.max.y), r(box.max.z)],
  };
}

export { dumpMeshes, type MeshDump } from './meshDump';
