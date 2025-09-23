import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { defaultSwordParams, SwordGenerator } from '../SwordGenerator';
import {
  partBounds,
  greater,
  groupDescendantsCount,
  findChildByName,
  boundsOf,
} from './helpers/metrics';

function makeSword(mutator: (p: ReturnType<typeof defaultSwordParams>) => void): SwordGenerator {
  const p = defaultSwordParams();
  mutator(p);
  return new SwordGenerator(p);
}

describe('Accessories settings affect geometry as expected', () => {
  describe('Scabbard', () => {
    it('bodyMargin increases mid-span widthAt', () => {
      const s1 = makeSword((p) => {
        p.accessories!.scabbard.enabled = true;
        p.accessories!.scabbard.bodyMargin = 0.02;
      });
      const s2 = makeSword((p) => {
        p.accessories!.scabbard.enabled = true;
        p.accessories!.scabbard.bodyMargin = 0.06;
      });
      const b1 = (s1 as any).scabbardBuild;
      const b2 = (s2 as any).scabbardBuild;
      expect(b1 && b2).toBeTruthy();
      const u = 0.5;
      expect(greater(b2.widthAt(u), b1.widthAt(u))).toBe(true);
    });

    it('bodyThickness increases scabbard body cross-section thickness (ring distance)', () => {
      const s1 = makeSword((p) => {
        p.accessories!.scabbard.enabled = true;
        p.accessories!.scabbard.bodyThickness = 0.06;
        p.accessories!.scabbard.hangAngle = 0;
      });
      const s2 = makeSword((p) => {
        p.accessories!.scabbard.enabled = true;
        p.accessories!.scabbard.bodyThickness = 0.16;
        p.accessories!.scabbard.hangAngle = 0;
      });
      const m1 = findChildByName(s1.scabbardGroup, 'ScabbardBody') as THREE.Mesh;
      const m2 = findChildByName(s2.scabbardGroup, 'ScabbardBody') as THREE.Mesh;
      const g1 = m1.geometry as THREE.BufferGeometry;
      const g2 = m2.geometry as THREE.BufferGeometry;
      const pos1 = g1.getAttribute('position') as THREE.BufferAttribute;
      const pos2 = g2.getAttribute('position') as THREE.BufferAttribute;
      const radialSegments = 30;
      const ringStride = radialSegments + 1;
      const segCount1 = Math.round(pos1.count / ringStride) - 1;
      const segCount2 = Math.round(pos2.count / ringStride) - 1;
      const i1 = Math.floor(segCount1 * 0.5);
      const i2 = Math.floor(segCount2 * 0.5);
      const jA = 8; // ~quarter around
      const jB = jA + radialSegments / 2;
      const idx1A = (i1 * ringStride + jA) * 3;
      const idx1B = (i1 * ringStride + jB) * 3;
      const idx2A = (i2 * ringStride + jA) * 3;
      const idx2B = (i2 * ringStride + jB) * 3;
      const v1A = new THREE.Vector3(
        pos1.array[idx1A],
        pos1.array[idx1A + 1],
        pos1.array[idx1A + 2]
      );
      const v1B = new THREE.Vector3(
        pos1.array[idx1B],
        pos1.array[idx1B + 1],
        pos1.array[idx1B + 2]
      );
      const v2A = new THREE.Vector3(
        pos2.array[idx2A],
        pos2.array[idx2A + 1],
        pos2.array[idx2A + 2]
      );
      const v2B = new THREE.Vector3(
        pos2.array[idx2B],
        pos2.array[idx2B + 1],
        pos2.array[idx2B + 2]
      );
      const d1 = v1A.distanceTo(v1B);
      const d2 = v2A.distanceTo(v2B);
      expect(greater(d2, d1)).toBe(true);
    });

    it('throatScale enlarges width near mouth', () => {
      const s1 = makeSword((p) => {
        const sc = p.accessories!.scabbard;
        sc.enabled = true;
        sc.throatLength = 0.2;
        sc.throatScale = 1.0;
      });
      const s2 = makeSword((p) => {
        const sc = p.accessories!.scabbard;
        sc.enabled = true;
        sc.throatLength = 0.2;
        sc.throatScale = 1.3;
      });
      const b1 = (s1 as any).scabbardBuild;
      const b2 = (s2 as any).scabbardBuild;
      const u = 0.05;
      expect(greater(b2.widthAt(u), b1.widthAt(u))).toBe(true);
    });

    it('locketScale enlarges width in locket region', () => {
      const s1 = makeSword((p) => {
        const sc = p.accessories!.scabbard;
        sc.enabled = true;
        sc.locketOffset = 0.3;
        sc.locketLength = 0.1;
        sc.locketScale = 1.0;
      });
      const s2 = makeSword((p) => {
        const sc = p.accessories!.scabbard;
        sc.enabled = true;
        sc.locketOffset = 0.3;
        sc.locketLength = 0.1;
        sc.locketScale = 1.25;
      });
      const b1 = (s1 as any).scabbardBuild;
      const b2 = (s2 as any).scabbardBuild;
      const u = 0.35;
      expect(greater(b2.widthAt(u), b1.widthAt(u))).toBe(true);
    });

    it('chapeScale reduces width near tip', () => {
      const s1 = makeSword((p) => {
        const sc = p.accessories!.scabbard;
        sc.enabled = true;
        sc.chapeScale = 1.0;
        sc.chapeLength = 0.25;
      });
      const s2 = makeSword((p) => {
        const sc = p.accessories!.scabbard;
        sc.enabled = true;
        sc.chapeScale = 0.5;
        sc.chapeLength = 0.25;
      });
      const b1 = (s1 as any).scabbardBuild;
      const b2 = (s2 as any).scabbardBuild;
      const u = 0.95;
      expect(greater(b1.widthAt(u), b2.widthAt(u))).toBe(true);
    });

    it('hangAngle rotates around the mouth (pivot constant)', () => {
      const s0 = makeSword((p) => {
        const sc = p.accessories!.scabbard;
        sc.enabled = true;
        sc.hangAngle = 0;
      });
      const sA = makeSword((p) => {
        const sc = p.accessories!.scabbard;
        sc.enabled = true;
        sc.hangAngle = -0.4;
      });
      const g0 = s0.scabbardGroup!;
      const gA = sA.scabbardGroup!;
      // Group position is the mouth base point; should be the same
      expect(g0.position.distanceTo(gA.position)).toBeLessThan(1e-6);
      // Bottom world point should differ due to rotation
      const build0 = (s0 as any).scabbardBuild;
      const buildA = (sA as any).scabbardBuild;
      const localTip0 = build0.samplePoint(1);
      const localTipA = buildA.samplePoint(1);
      const tipWorld0 = localTip0.clone();
      g0.localToWorld(tipWorld0);
      const tipWorldA = localTipA.clone();
      gA.localToWorld(tipWorldA);
      expect(tipWorld0.distanceTo(tipWorldA)).toBeGreaterThan(0.001);
    });

    it('offsetX translates scabbard mouth X position', () => {
      const s1 = makeSword((p) => {
        const sc = p.accessories!.scabbard;
        sc.enabled = true;
        sc.offsetX = 0.0;
      });
      const s2 = makeSword((p) => {
        const sc = p.accessories!.scabbard;
        sc.enabled = true;
        sc.offsetX = 0.2;
      });
      const x1 = s1.scabbardGroup!.position.x;
      const x2 = s2.scabbardGroup!.position.x;
      expect(greater(x2, x1)).toBe(true);
    });
  });

  describe('Tassel', () => {
    it('strands increase fringe children', () => {
      const s1 = makeSword((p) => {
        p.accessories!.tassel.enabled = true;
        p.accessories!.tassel.strands = 4;
      });
      const s2 = makeSword((p) => {
        p.accessories!.tassel.enabled = true;
        p.accessories!.tassel.strands = 12;
      });
      const c1 = groupDescendantsCount(s1.tasselGroup);
      const c2 = groupDescendantsCount(s2.tasselGroup);
      expect(c2).toBeGreaterThan(c1);
    });

    it('thickness increases tassel rope boundingSphere radius', () => {
      const s1 = makeSword((p) => {
        p.accessories!.tassel.enabled = true;
        p.accessories!.tassel.thickness = 0.01;
      });
      const s2 = makeSword((p) => {
        p.accessories!.tassel.enabled = true;
        p.accessories!.tassel.thickness = 0.04;
      });
      const rope1 = findChildByName(s1.tasselGroup, 'TasselRope') as THREE.Mesh;
      const rope2 = findChildByName(s2.tasselGroup, 'TasselRope') as THREE.Mesh;
      const geo1 = rope1.geometry as THREE.BufferGeometry;
      geo1.computeBoundingSphere();
      const geo2 = rope2.geometry as THREE.BufferGeometry;
      geo2.computeBoundingSphere();
      const r1 = geo1.boundingSphere!.radius;
      const r2 = geo2.boundingSphere!.radius;
      expect(greater(r2, r1)).toBe(true);
    });

    it('length increases tassel group Y extent', () => {
      const s1 = makeSword((p) => {
        p.accessories!.tassel.enabled = true;
        p.accessories!.tassel.length = 0.3;
        p.accessories!.tassel.attachTo = 'guard';
      });
      const s2 = makeSword((p) => {
        p.accessories!.tassel.enabled = true;
        p.accessories!.tassel.length = 0.8;
        p.accessories!.tassel.attachTo = 'guard';
      });
      const b1 = partBounds(s1, 'tassel')!;
      const b2 = partBounds(s2, 'tassel')!;
      expect(greater(b2.size.y, b1.size.y)).toBe(true);
    });
  });
});
