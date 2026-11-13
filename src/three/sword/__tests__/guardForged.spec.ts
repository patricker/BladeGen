import * as THREE from 'three';
import { SwordGenerator } from '../../SwordGenerator';
import { defaultSwordParams } from '../defaults';
import { validateSwordParams } from '../validation';
import { buildForgedGuardGeometry, FORGED_CAP_RINGS, FORGED_DEFAULTS } from '../guardForged';
import { presetMonument } from '../../../components/presets';
import type { SwordParams } from '../types';

function forgedParams(over: Record<string, number> = {}): SwordParams {
  const p = defaultSwordParams();
  p.blade.baseWidth = 0.5;
  p.blade.thickness = 0.12;
  p.blade.thicknessLeft = 0.12;
  p.blade.thicknessRight = 0.12;
  p.guard.style = 'forged';
  p.guard.width = 2;
  p.guard.quillonCount = 0;
  p.guard.forged = { ...over };
  return p;
}

function signedVolume(geo: THREE.BufferGeometry): number {
  const pos = geo.getAttribute('position');
  const idx = geo.getIndex()!;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let v = 0;
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i));
    b.fromBufferAttribute(pos, idx.getX(i + 1));
    c.fromBufferAttribute(pos, idx.getX(i + 2));
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return v;
}

function ringCentre(geo: THREE.BufferGeometry, ring: number, radial: number): THREE.Vector3 {
  const pos = geo.getAttribute('position');
  const out = new THREE.Vector3();
  for (let k = 0; k < radial; k++)
    out.add(new THREE.Vector3().fromBufferAttribute(pos, ring * (radial + 1) + k));
  return out.multiplyScalar(1 / radial);
}

describe('forged cross guard', () => {
  it('validation writes the forged block back in full, only for that style', () => {
    const v = validateSwordParams(forgedParams({ curl: 9, radial: 18 }));
    expect(v.guard.forged).toEqual({
      ...FORGED_DEFAULTS,
      curl: 2.5,
      radial: 20,
    });
    const bar = defaultSwordParams();
    bar.guard.style = 'bar';
    (bar.guard as any).forged = { height: 1 };
    expect(validateSwordParams(bar).guard.forged).toBeUndefined();
  });

  it('is one closed tube, wound outward, mirror-symmetric, finite', () => {
    const p = validateSwordParams(forgedParams());
    const { geometry } = buildForgedGuardGeometry(p.guard, p.blade);
    const f = p.guard.forged!;
    const rings = 2 * (f.segments! + FORGED_CAP_RINGS) + 1;
    const pos = geometry.getAttribute('position');
    expect(pos.count).toBe(rings * (f.radial! + 1));
    expect(geometry.getIndex()!.count).toBe((rings - 1) * f.radial! * 6);
    for (const v of pos.array as Float32Array) expect(Number.isFinite(v)).toBe(true);
    expect(signedVolume(geometry)).toBeGreaterThan(0);
    // ring r mirrors ring (rings - 1 - r) across x = 0
    for (let r = 0; r < rings; r++) {
      const a = ringCentre(geometry, r, f.radial!);
      const b = ringCentre(geometry, rings - 1 - r, f.radial!);
      expect(a.x).toBeCloseTo(-b.x, 6);
      expect(a.y).toBeCloseTo(b.y, 6);
    }
    const n = geometry.getAttribute('normal');
    expect(n.count).toBe(pos.count);
  });

  it('is sized from the blade: block height x base width, depth x thickness', () => {
    const p = validateSwordParams(forgedParams({ height: 0.4, depth: 2, swell: 1 }));
    const geo = buildForgedGuardGeometry(p.guard, p.blade).geometry;
    const f = p.guard.forged!;
    const centre = f.segments! + FORGED_CAP_RINGS;
    const pos = geo.getAttribute('position');
    let ylo = Infinity;
    let yhi = -Infinity;
    let zlo = Infinity;
    let zhi = -Infinity;
    for (let k = 0; k <= f.radial!; k++) {
      const i = centre * (f.radial! + 1) + k;
      ylo = Math.min(ylo, pos.getY(i));
      yhi = Math.max(yhi, pos.getY(i));
      zlo = Math.min(zlo, pos.getZ(i));
      zhi = Math.max(zhi, pos.getZ(i));
    }
    expect(yhi - ylo).toBeCloseTo(0.4 * 0.5, 5);
    expect(zhi - zlo).toBeCloseTo(2 * 0.12, 5);
    // twice the blade, twice the block
    const big = validateSwordParams(forgedParams({ height: 0.4, depth: 2, swell: 1 }));
    big.blade.baseWidth = 1;
    const g2 = buildForgedGuardGeometry(big.guard, big.blade);
    expect(g2.halfHeight).toBeCloseTo(0.2, 9);
  });

  it('turns its tips toward the blade for a positive curl, toward the grip for a negative one', () => {
    for (const curl of [0.8, -0.8]) {
      const p = validateSwordParams(forgedParams({ curl, finial: 0 }));
      const geo = buildForgedGuardGeometry(p.guard, p.blade).geometry;
      const f = p.guard.forged!;
      const rings = 2 * (f.segments! + FORGED_CAP_RINGS) + 1;
      const tip = ringCentre(geo, rings - 2, f.radial!);
      expect(Math.sign(tip.y)).toBe(Math.sign(curl));
      expect(Math.abs(tip.y)).toBeGreaterThan(0.1);
    }
  });

  it('tapers: the arm section near the tip is smaller than at the root', () => {
    const p = validateSwordParams(forgedParams({ taper: 0.4, finial: 0 }));
    const geo = buildForgedGuardGeometry(p.guard, p.blade).geometry;
    const f = p.guard.forged!;
    const pos = geo.getAttribute('position');
    const n = f.segments! + FORGED_CAP_RINGS;
    const span = (ring: number) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = 0; k <= f.radial!; k++) {
        const z = pos.getZ(ring * (f.radial! + 1) + k);
        lo = Math.min(lo, z);
        hi = Math.max(hi, z);
      }
      return hi - lo;
    };
    const rootRing = n + Math.round(f.segments! * 0.45);
    const tipRing = n + f.segments!;
    expect(span(tipRing)).toBeLessThan(span(rootRing) * 0.7);
  });

  it('sits with its block top on the guard line and adds one guard mesh', () => {
    const sword = new SwordGenerator(forgedParams());
    const blade = new THREE.Box3().setFromObject(sword.bladeMesh!);
    expect(sword.guardMesh).toBeTruthy();
    const geo = sword.guardMesh!.geometry as THREE.BufferGeometry;
    const p = validateSwordParams(forgedParams());
    const centre = p.guard.forged!.segments! + FORGED_CAP_RINGS;
    sword.guardMesh!.updateMatrixWorld(true);
    let top = -Infinity;
    const v = new THREE.Vector3();
    for (let k = 0; k <= p.guard.forged!.radial!; k++) {
      v.fromBufferAttribute(geo.getAttribute('position') as THREE.BufferAttribute, centre * 17 + k);
      v.applyMatrix4(sword.guardMesh!.matrixWorld);
      top = Math.max(top, v.y);
    }
    expect(top).toBeCloseTo(blade.min.y, 5);
    expect((sword as any).guardGroup).toBeNull();
  });

  it('is what the monument preset uses, and is deterministic', () => {
    const m = presetMonument();
    expect(m.guard.style).toBe('forged');
    const a = new SwordGenerator(m).guardMesh!.geometry.getAttribute('position').array;
    const b = new SwordGenerator(presetMonument()).guardMesh!.geometry.getAttribute(
      'position'
    ).array;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
