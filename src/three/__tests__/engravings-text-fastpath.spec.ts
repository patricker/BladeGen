import * as THREE from 'three';
import { describe, it, expect, vi } from 'vitest';
import { buildEngravingsGroup } from '../../three/sword/engravings';

// Mock FontLoader to avoid network and guarantee fast-path (letterSpacing=0)
vi.mock('three/examples/jsm/loaders/FontLoader.js', () => {
  class FontLoader {
    load(_url: string, onLoad: (font: any) => void) {
      const fakeFont = { generateShapes: (_text: string, _size: number) => [new THREE.Shape()] };
      onLoad(fakeFont);
    }
  }
  return { FontLoader };
});

describe('engravings text fast-path', () => {
  it('uses reasonable Z depth when letterSpacing is 0', () => {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 0.06));
    const b: any = {
      length: 2,
      baseWidth: 0.2,
      tipWidth: 0.05,
      thickness: 0.06,
      engravings: [
        {
          type: 'text',
          content: 'A',
          fontUrl: 'stub://font.json',
          width: 0.1,
          height: 0.05,
          depth: 0.003,
          letterSpacing: 0,
          offsetY: 1.0,
          offsetX: 0,
          side: 'right',
        },
      ],
    };
    const built = buildEngravingsGroup(b, blade)!;
    expect(built).toBeTruthy();
    // Z span of engraving group should be small (on the order of depth), not huge
    const bb = new THREE.Box3().setFromObject(built.group);
    const zSpan = bb.max.z - bb.min.z;
    expect(zSpan).toBeLessThan(0.1); // well below any absurd default depths
  });
});

