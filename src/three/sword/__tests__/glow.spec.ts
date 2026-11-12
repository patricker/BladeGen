import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildBladeGeometry, fixBladeWinding } from '../bladeGeometry';
import {
  BLADE_GRID_COLS,
  bladeGridSegments,
  bladeGridUVs,
  buildBladeGlowGeometry,
  glowMaskAt,
  runeGlyph,
} from '../glow';
import { createRng } from '../rng';
import { validateSwordParams } from '../validation';
import { SwordGenerator, defaultSwordParams } from '../../SwordGenerator';
import { presetMonument } from '../../../components/presets';

const glowParams = () => {
  const p = defaultSwordParams();
  p.blade.glow = { enabled: true, color: '#55ccff', runeCount: 5, runeSeed: 3, edgeWidth: 0.06 };
  return p;
};

function signedVolume(geo: THREE.BufferGeometry) {
  const p = geo.getAttribute('position').array as ArrayLike<number>;
  const ix = geo.index!.array as ArrayLike<number>;
  let v = 0;
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix[i] * 3,
      b = ix[i + 1] * 3,
      c = ix[i + 2] * 3;
    v +=
      p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
      p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
      p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return v / 6;
}

describe('blade glow channel', () => {
  it('leaves blades without glow untouched (no uv/color, no glow mesh)', () => {
    const sword = new SwordGenerator(defaultSwordParams());
    const geo = sword.bladeMesh!.geometry;
    expect(geo.getAttribute('uv')).toBeUndefined();
    expect(geo.getAttribute('color')).toBeUndefined();
    expect(sword.glowMesh).toBeNull();
    const off = defaultSwordParams();
    off.blade.glow = { enabled: false, runeCount: 4 };
    expect(validateSwordParams(off).blade.glow).toBeUndefined();
    expect(new SwordGenerator(off).glowMesh).toBeNull();
  });

  it('adds grid UVs and an RGB=1 alpha mask to the blade', () => {
    const b = validateSwordParams(glowParams()).blade;
    const geo = buildBladeGeometry(b);
    const segs = bladeGridSegments(b);
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    const col = geo.getAttribute('color') as THREE.BufferAttribute;
    expect(uv.count).toBe(geo.getAttribute('position').count);
    expect(col.itemSize).toBe(4);
    expect(Array.from(uv.array as Float32Array)).toEqual(Array.from(bladeGridUVs(segs)));
    const stride = (BLADE_GRID_COLS + 1) * 2;
    // Edge vertex (j = 0) is fully lit; a mid-face column is dimmer than the core.
    expect(col.getW(0)).toBe(1);
    expect(col.getX(0)).toBe(1);
    const mid = 3 * 2;
    const core = (BLADE_GRID_COLS / 2) * 2;
    expect(col.getW(stride * 10 + mid)).toBeLessThan(col.getW(stride * 10 + core));
    expect(glowMaskAt(b.glow!, 0.5)).toBeCloseTo(b.glow!.coreMask!, 6);
  });

  it('builds an outward-facing glow mesh just off the blade surface', () => {
    const p = validateSwordParams(glowParams());
    const bladeGeo = buildBladeGeometry(p.blade);
    const glow = buildBladeGlowGeometry(p.blade, bladeGeo)!;
    expect(glow).toBeTruthy();
    const pos = glow.getAttribute('position');
    const nrm = glow.getAttribute('normal');
    const ix = glow.index!.array;
    const A = new THREE.Vector3(),
      B = new THREE.Vector3(),
      C = new THREE.Vector3(),
      N = new THREE.Vector3();
    let facing = 0;
    for (let i = 0; i < ix.length; i += 3) {
      A.fromBufferAttribute(pos as any, ix[i]);
      B.fromBufferAttribute(pos as any, ix[i + 1]);
      C.fromBufferAttribute(pos as any, ix[i + 2]);
      N.fromBufferAttribute(nrm as any, ix[i]);
      const g = B.clone().sub(A).cross(C.clone().sub(A));
      if (g.lengthSq() < 1e-16) continue;
      expect(g.dot(N)).toBeGreaterThan(0);
      facing++;
    }
    expect(facing).toBeGreaterThan(100);
    // Glow sits outside the blade's thickness envelope (|z| beyond the surface).
    let outside = 0;
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getZ(i)) > 0.003) outside++;
    expect(outside / pos.count).toBeGreaterThan(0.95);
  });

  it('rune glyphs are deterministic grid strokes', () => {
    const a = runeGlyph(createRng(11));
    expect(runeGlyph(createRng(11))).toEqual(a);
    for (const [x0, y0, x1, y1] of a) {
      for (const g of [x0, x1]) expect([0, 1, 2]).toContain(g);
      for (const g of [y0, y1]) expect([0, 1, 2, 3]).toContain(g);
    }
    expect(a.length).toBeGreaterThanOrEqual(2);
  });

  it('SwordGenerator adds a named glow mesh with an emissive material', () => {
    const sword = new SwordGenerator(presetMonument());
    expect(sword.glowMesh?.name).toBe('glow');
    const mat = sword.glowMesh!.material as THREE.MeshStandardMaterial;
    expect(mat.emissiveIntensity).toBeCloseTo(4.5);
    expect(mat.emissive.getHex()).toBe(new THREE.Color('#7fd8ff').getHex());
  });

  it('fixBladeWinding makes the closed blade outward-facing', () => {
    for (const p of [defaultSwordParams(), presetMonument()]) {
      const b = validateSwordParams(p).blade;
      const geo = buildBladeGeometry(b);
      const before = signedVolume(geo);
      fixBladeWinding(geo, bladeGridSegments(b));
      const after = signedVolume(geo);
      expect(after).toBeGreaterThan(0);
      expect(after).toBeGreaterThan(Math.abs(before));
      expect(geo.getAttribute('tangent')).toBeTruthy();
    }
  });
});
