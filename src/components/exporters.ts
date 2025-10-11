import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import type { SwordGenerator, SwordParams } from '../three/SwordGenerator';
import { buildBladeOutlinePoints, bladeOutlineToSVG } from '../three/SwordGenerator';
import { createMaterial } from '../three/sword/materials';
import { TextureCache } from '../three/sword/textures';
import { PARTS, type Part, type MaterialVariant, type MatExt } from './types';

type VariantExportConfig = {
  name: string;
  description?: string;
  mappings: Array<{ mesh: THREE.Mesh; material: THREE.Material }>;
};

class KHRMaterialsVariantsExporter {
  private readonly writer: any;
  private readonly name = 'KHR_materials_variants';
  private readonly meshMappings = new Map<
    THREE.Object3D,
    Array<{ variant: number; material: THREE.Material }>
  >();
  private readonly configs: VariantExportConfig[];
  private readonly ownedMaterials: THREE.Material[];

  constructor(writer: any, configs: VariantExportConfig[], ownedMaterials: THREE.Material[]) {
    this.writer = writer;
    this.configs = configs;
    this.ownedMaterials = ownedMaterials;
    configs.forEach((cfg, variantIndex) => {
      for (const mapping of cfg.mappings) {
        const list = this.meshMappings.get(mapping.mesh) ?? [];
        list.push({ variant: variantIndex, material: mapping.material });
        this.meshMappings.set(mapping.mesh, list);
      }
    });
  }

  beforeParse() {
    if (!this.configs.length) return;
    const json = this.writer.json;
    const extensionsUsed = this.writer.extensionsUsed;
    json.extensions = json.extensions || {};
    json.extensions[this.name] = {
      variants: this.configs.map((cfg: any) => {
        const def: any = { name: cfg.name };
        if (cfg.description) def.extras = { description: cfg.description };
        return def;
      }),
    };
    extensionsUsed[this.name] = true;
  }

  async writeMesh(mesh: THREE.Object3D, meshDef: any) {
    const entries = this.meshMappings.get(mesh);
    if (!entries || entries.length === 0) return;
    const mappings: Array<{ material: number; variants: number[] }> = [];
    for (const entry of entries) {
      const materialIndex = await this.writer.processMaterialAsync(entry.material);
      if (materialIndex === null || materialIndex === undefined) continue;
      let mapping = mappings.find((m) => m.material === materialIndex);
      if (!mapping) {
        mapping = { material: materialIndex, variants: [entry.variant] };
        mappings.push(mapping);
      } else if (!mapping.variants.includes(entry.variant)) {
        mapping.variants.push(entry.variant);
      }
    }
    if (!mappings.length) return;
    meshDef.extensions = meshDef.extensions || {};
    meshDef.extensions[this.name] = { mappings };
  }

  afterParse() {
    for (const mat of this.ownedMaterials) mat.dispose?.();
    this.ownedMaterials.length = 0;
  }
}

// Bake engravings into the blade mesh using BVH-accelerated CSG.
// This mutates sword.bladeMesh.geometry for the duration of the export and restores it afterwards.
async function maybeBakeEngravings(sword: SwordGenerator) {
  const blade = sword.bladeMesh as THREE.Mesh | null;
  if (!blade) return;
  // Find engraving fill meshes (the actual cavity volumes)
  let fillGroup: THREE.Object3D | null = null;
  (sword.group as THREE.Object3D).traverse((o) => {
    if (o.name === 'engravingFill') fillGroup = o;
  });
  const solids: THREE.Mesh[] = [];
  if (fillGroup) {
    fillGroup.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((m as any).isMesh) solids.push(m);
    });
  }
  if (!solids.length) return;
  // Dynamic import to avoid bundling cost if baking is never used
  const mod = await import('three-bvh-csg');
  const { Brush, Evaluator, SUBTRACTION } = mod as any;
  const toBrush = (mesh: THREE.Mesh) => {
    const b = new Brush(mesh.geometry.clone());
    b.matrix.copy(mesh.matrixWorld);
    // three-bvh-csg expects updated world matrix
    b.matrix.decompose(b.position, b.quaternion, b.scale);
    b.updateMatrixWorld(true);
    return b;
  };
  const base = toBrush(blade);
  const evaluator = new Evaluator();
  let carved = base as any;
  for (const s of solids) {
    const sub = toBrush(s);
    carved = evaluator.evaluate(carved, sub, SUBTRACTION);
  }
  // Swap geometry on the live blade for export
  const original = blade.geometry;
  blade.geometry = carved.geometry;
  // Ensure geometry carries normals/uvs reasonably
  blade.geometry.computeVertexNormals();
  // After a tick, restore to avoid affecting the interactive scene
  queueMicrotask(() => {
    try {
      blade.geometry.dispose?.();
    } catch {}
    blade.geometry = original;
  });
}

export async function exportGLB(sword: SwordGenerator, variants: MaterialVariant[]): Promise<void> {
  const exporter = new GLTFExporter();
  await maybeBakeEngravings(sword); // default: bake engravings into blade for export
  if (variants && variants.length) {
    const texCache = new TextureCache();
    const configs: VariantExportConfig[] = [];
    const ownedMaterials: THREE.Material[] = [];
    const partRoots: Record<Part, THREE.Object3D | null> = {
      blade: sword.bladeMesh,
      guard: sword.guardMesh ?? (sword as any).guardGroup ?? null,
      handle: sword.handleMesh ?? (sword as any).handleGroup ?? null,
      pommel: sword.pommelMesh,
      scabbard: (sword as any).scabbardGroup ?? null,
      tassel: (sword as any).tasselGroup ?? null,
    };
    const gatherMeshes = (root: THREE.Object3D | null | undefined): THREE.Mesh[] => {
      if (!root) return [];
      const meshes: THREE.Mesh[] = [];
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if ((mesh as any).isMesh) meshes.push(mesh);
      });
      return meshes;
    };
    for (const variant of variants) {
      const mappings: Array<{ mesh: THREE.Mesh; material: THREE.Material }> = [];
      for (const part of PARTS) {
        const state = (variant.parts as any)[part] as Partial<MatExt> | undefined;
        if (!state) continue;
        const meshes = gatherMeshes(partRoots[part]);
        if (!meshes.length) continue;
        const material = createMaterial(part, state as any, texCache);
        material.name = `${variant.name} / ${part}`;
        ownedMaterials.push(material);
        for (const mesh of meshes) mappings.push({ mesh, material });
      }
      if (mappings.length)
        configs.push({ name: variant.name, description: variant.description, mappings });
    }
    if (configs.length)
      exporter.register(
        (writer) => new KHRMaterialsVariantsExporter(writer, configs, ownedMaterials)
      );
  }
  return new Promise<void>((resolve) => {
    exporter.parse(
      sword.group,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sword.glb';
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      },
      () => resolve(),
      { binary: true }
    );
  });
}

export async function exportOBJ(sword: SwordGenerator) {
  const exporter = new OBJExporter();
  await maybeBakeEngravings(sword);
  const result = exporter.parse(sword.group);
  const blob = new Blob([result], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sword.obj';
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportSTL(sword: SwordGenerator) {
  const exporter = new STLExporter();
  await maybeBakeEngravings(sword);
  // Build a print-safe, watertight subset: core solids only
  const { buildPrintableGroup } = await import('../three/export/printable');
  const printable = buildPrintableGroup(sword);
  const result = exporter.parse(printable, { binary: true } as any);
  const blob = new Blob([result as ArrayBuffer], { type: 'model/stl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sword.stl';
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSVG(state: SwordParams) {
  const pts = buildBladeOutlinePoints(state.blade);
  const svg = bladeOutlineToSVG(pts);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'blade_outline.svg';
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJSON(
  state: SwordParams,
  renderState: Record<string, any>,
  materials: Record<Part, MatExt>,
  variants: MaterialVariant[],
  activeVariantId: string | null
) {
  const materialsOut: Record<string, any> = {};
  for (const part of PARTS) materialsOut[part] = JSON.parse(JSON.stringify(materials[part]));
  if (variants && variants.length) {
    materialsOut.variants = variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      description: variant.description,
      parts: PARTS.reduce(
        (acc, part) => {
          const p = (variant.parts as any)[part];
          if (p) acc[part] = JSON.parse(JSON.stringify(p));
          return acc;
        },
        {} as Partial<Record<Part, MatExt>>
      ),
    }));
  }
  if (activeVariantId) materialsOut.activeVariant = activeVariantId;
  const payload = {
    $schema: 'schema/sword.schema.json',
    version: 4,
    model: state,
    render: { ...renderState },
    materials: materialsOut,
  } as const;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bladegen.json';
  a.click();
  URL.revokeObjectURL(url);
}
