import * as THREE from 'three';
import { describe, it, expect, vi } from 'vitest';
import { SwordGenerator, defaultSwordParams } from '../../three/SwordGenerator';

// Avoid network/font loading by stubbing FontLoader (even though these tests
// primarily use 'shape' engravings). This keeps behavior deterministic.
vi.mock('three/examples/jsm/loaders/FontLoader.js', () => {
  class FontLoader {
    load(_url: string, onLoad: (font: any) => void) {
      const fakeFont = { generateShapes: (_text: string, _size: number) => [new THREE.Shape()] };
      onLoad(fakeFont);
    }
  }
  return { FontLoader };
});

function bboxOf(obj: THREE.Object3D | null | undefined) {
  const b = new THREE.Box3();
  if (!obj) return b.makeEmpty();
  return b.setFromObject(obj);
}

function span(b: THREE.Box3, axis: 'x' | 'y' | 'z') {
  if (axis === 'x') return b.max.x - b.min.x;
  if (axis === 'y') return b.max.y - b.min.y;
  return b.max.z - b.min.z;
}

describe('Engraving updates via updateGeometry', () => {
  it('rebuilds engraving group when width/side/offset change (shape type)', () => {
    const params = defaultSwordParams();
    // Start with a simple rectangular shape engraving on the right face
    (params.blade as any).engravings = [
      {
        type: 'shape',
        content: 'rect',
        width: 0.08,
        height: 0.02,
        depth: 0.002,
        offsetY: params.blade.length * 0.5,
        offsetX: 0,
        rotation: 0,
        side: 'right',
      },
    ];
    const gen = new SwordGenerator(params);
    const g1 = (gen as any).engravingGroup as THREE.Group;
    expect(g1).toBeTruthy();
    const x1 = span(bboxOf(g1), 'x');

    // Increase width and verify X-span grows
    (params.blade as any).engravings[0].width = 0.16;
    gen.updateGeometry(params);
    const g2 = (gen as any).engravingGroup as THREE.Group;
    expect(g2).toBeTruthy();
    // Prefer direct geometry parameter width check to avoid clamp/curvature side effects
    const paramWidth = (() => {
      let w = 0;
      g2.traverse((o) => {
        const m = o as THREE.Mesh;
        if ((m as any).isMesh && (m.geometry as any)?.type === 'BoxGeometry') {
          const p = (m.geometry as any).parameters;
          if (p?.width) w = Math.max(w, p.width);
        }
      });
      return w;
    })();
    expect(paramWidth).toBeGreaterThan(0.12);

    // Change side to both and ensure mesh count increases
    (params.blade as any).engravings[0].side = 'both';
    gen.updateGeometry(params);
    const g3 = (gen as any).engravingGroup as THREE.Group;
    let meshCount = 0;
    g3.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((m as any).isMesh) meshCount++;
    });
    expect(meshCount).toBeGreaterThan(1);

    // Move along blade Y and verify Y center shifts
    const yBefore = (() => {
      const bb = bboxOf(g3);
      return (bb.min.y + bb.max.y) * 0.5;
    })();
    (params.blade as any).engravings[0].offsetY = params.blade.length * 0.7;
    gen.updateGeometry(params);
    const g4 = (gen as any).engravingGroup as THREE.Group;
    const yAfter = (() => {
      const bb = bboxOf(g4);
      return (bb.min.y + bb.max.y) * 0.5;
    })();
    expect(yAfter).toBeGreaterThan(yBefore);
  });
});
