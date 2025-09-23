import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import {
  SwordGenerator,
  defaultSwordParams,
  buildBladeOutlinePoints,
  bladeOutlineToSVG,
} from '../SwordGenerator';

function makeSword(): SwordGenerator {
  const params = defaultSwordParams();
  // Keep defaults deterministic
  return new SwordGenerator(params);
}

describe('Export tools', () => {
  // Polyfill minimal FileReader for GLTFExporter in Node env
  beforeAll(() => {
    if (typeof (globalThis as any).FileReader === 'undefined') {
      class FR {
        onload: ((ev: any) => void) | null = null;
        readAsArrayBuffer(_blob: any) {
          this.onload && this.onload({ target: { result: new ArrayBuffer(0) } });
        }
        readAsDataURL(_blob: any) {
          this.onload && this.onload({ target: { result: 'data:' } });
        }
      }
      (globalThis as any).FileReader = FR as any;
    }
  });
  const canGLTF =
    typeof (globalThis as any).document !== 'undefined' &&
    typeof (globalThis as any).Blob !== 'undefined';
  (canGLTF ? it : it.skip)('exports GLB (binary) ArrayBuffer (smoke test)', async () => {
    const sword = makeSword();
    const exporter = new GLTFExporter();
    const buffer: ArrayBuffer = await new Promise<any>((resolve, reject) => {
      exporter.parse(
        sword.group,
        (res) => resolve(res as any),
        (err) => reject(err),
        { binary: true }
      );
    });
    expect(buffer).toBeInstanceOf(ArrayBuffer);
  });

  it('exports OBJ text with vertices and faces', () => {
    const sword = makeSword();
    const exporter = new OBJExporter();
    const text = exporter.parse(sword.group);
    expect(typeof text).toBe('string');
    expect(text.includes('\nv ')).toBe(true); // has vertices
    expect(text.includes('\nf ')).toBe(true); // has faces
  });

  it('exports STL (binary) as DataView/ArrayBuffer with valid header length', () => {
    const sword = makeSword();
    const exporter = new STLExporter();
    const out: any = exporter.parse(sword.group, { binary: true } as any);
    const buf: ArrayBuffer = out instanceof ArrayBuffer ? out : out && out.buffer;
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBeGreaterThan(84);
  });

  it('exports SVG blueprint with xml/svg root and path content', () => {
    const params = defaultSwordParams();
    const pts = buildBladeOutlinePoints(params.blade);
    const svg = bladeOutlineToSVG(pts);
    expect(svg.startsWith('<?xml') || svg.startsWith('<svg')).toBe(true);
    expect(svg.includes('<path')).toBe(true);
  });
});
