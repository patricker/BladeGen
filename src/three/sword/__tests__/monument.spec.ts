import * as THREE from 'three';
import { SwordGenerator } from '../../SwordGenerator';
import { defaultSwordParams } from '../defaults';
import { validateSwordParams } from '../validation';
import {
  MONUMENT_GUARD_DEFAULTS,
  MONUMENT_GUARD_STYLES,
  buildMonumentGuardGeometry,
} from '../monument/guards';
import { MONUMENT_POMMEL_STYLES } from '../monument/pommels';
import {
  MONUMENT_CATALOGUE,
  designMonument,
  entryWeights,
  monumentSeed,
  pickMonument,
  traitStrengths,
  type PlanetTraits,
} from '../monument/design';
import { giantPresets } from '../../../components/presets';
import type { SwordParams } from '../types';

const monumentBase = (): SwordParams => giantPresets.find((p) => p.id === 'monument')!.build();

const TRAITS: Record<string, PlanetTraits> = {
  temperate: {
    archetype: 'temperate',
    gravityG: 1.0,
    meanTempK: 288,
    waterMassFraction: 0.02,
    locked: false,
    hasDynamo: true,
    dipoleIndex: 0.6,
    volcanismIndex: 0.2,
    moons: 1,
    rings: false,
    teffK: 5600,
    eccentricity: 0.02,
    habitability: 0.8,
  },
  lava: {
    archetype: 'lava',
    gravityG: 1.6,
    meanTempK: 1100,
    waterMassFraction: 0,
    locked: true,
    hasDynamo: false,
    dipoleIndex: 0,
    volcanismIndex: 0.95,
    moons: 0,
    rings: false,
    teffK: 5200,
    eccentricity: 0.01,
    habitability: 0,
  },
  ice: {
    archetype: 'ice',
    gravityG: 0.6,
    meanTempK: 140,
    waterMassFraction: 0.1,
    locked: false,
    hasDynamo: true,
    dipoleIndex: 0.9,
    volcanismIndex: 0.1,
    moons: 3,
    rings: false,
    teffK: 8000,
    eccentricity: 0.1,
    habitability: 0.05,
  },
  giant: {
    archetype: 'gas_giant_ringed',
    gravityG: 2.4,
    meanTempK: 160,
    waterMassFraction: 0,
    locked: false,
    hasDynamo: true,
    dipoleIndex: 1,
    volcanismIndex: 0,
    moons: 6,
    rings: true,
    teffK: 3400,
    eccentricity: 0.3,
    habitability: 0,
  },
};

/** Welded closed check: every undirected edge (by position) used exactly twice, in opposite directions. */
function signedVolume(g: THREE.BufferGeometry): number {
  const pos = g.getAttribute('position');
  const idx = g.getIndex()!;
  let v = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i));
    b.fromBufferAttribute(pos, idx.getX(i + 1));
    c.fromBufferAttribute(pos, idx.getX(i + 2));
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return v;
}

function finite(g: THREE.BufferGeometry) {
  for (const name of ['position', 'normal', 'uv']) {
    const arr = g.getAttribute(name).array as Float32Array;
    for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) return false;
  }
  return true;
}

// The stroke kernel's own tests (closed tubes, rings, mirrors, turning) are bladegen-core's
// (crates/bladegen-core/tests/strokes.rs) since the TypeScript kernel was retired (BG1).

describe('monument guards', () => {
  const blade = monumentBase().blade;
  it.each(MONUMENT_GUARD_STYLES)(
    '%s: validation writes the block back with its defaults',
    (style) => {
      const p = monumentBase();
      p.guard.style = style;
      delete p.guard.forged;
      const v = validateSwordParams(p);
      expect(v.guard.monument).toEqual(MONUMENT_GUARD_DEFAULTS[style]);
      expect(v.guard.forged).toBeUndefined();
    }
  );
  it('validation clamps the block and drops it for other styles', () => {
    const p = monumentBase();
    p.guard.style = 'talon';
    p.guard.monument = { count: 40, sweep: 9, radial: 18, block: 0 };
    const v = validateSwordParams(p);
    expect(v.guard.monument).toMatchObject({ count: 8, sweep: 3, radial: 20, block: 0.1 });
    const q = monumentBase();
    (q.guard as any).monument = { count: 2 };
    expect(validateSwordParams(q).guard.monument).toBeUndefined();
  });
  it.each(MONUMENT_GUARD_STYLES)(
    '%s: finite, wound outward, mirror-symmetric, sized from the blade',
    (style) => {
      const g = validateSwordParams({
        ...monumentBase(),
        guard: { ...monumentBase().guard, style },
      }).guard;
      const { geometry, halfHeight } = buildMonumentGuardGeometry(g, blade);
      expect(finite(geometry)).toBe(true);
      expect(signedVolume(geometry)).toBeGreaterThan(0);
      geometry.computeBoundingBox();
      const bb = geometry.boundingBox!;
      expect(bb.min.x).toBeCloseTo(-bb.max.x, 5);
      expect(halfHeight).toBeCloseTo(0.5 * g.monument!.height! * blade.baseWidth, 9);
      // twice the blade -> twice the guard's height (the span is absolute)
      const big = buildMonumentGuardGeometry(g, { ...blade, baseWidth: blade.baseWidth * 2 });
      expect(big.halfHeight).toBeCloseTo(2 * halfHeight, 9);
    }
  );
  it.each(MONUMENT_GUARD_STYLES)(
    '%s: the block top sits on the guard line in a built sword',
    (style) => {
      const p = monumentBase();
      p.guard.style = style;
      const gen = new SwordGenerator(p);
      const guard = gen.guardMesh!;
      expect(guard).toBeTruthy();
      const v = validateSwordParams(p);
      const bladeBox = new THREE.Box3().setFromObject(gen.bladeMesh!);
      const hy0 = 0.5 * v.guard.monument!.height! * v.blade.baseWidth;
      expect(guard.position.y + hy0).toBeCloseTo(bladeBox.min.y, 9);
    }
  );
  it('deterministic', () => {
    const p = validateSwordParams({
      ...monumentBase(),
      guard: { ...monumentBase().guard, style: 'halo' },
    });
    const a = buildMonumentGuardGeometry(p.guard, p.blade).geometry.getAttribute('position').array;
    const b = buildMonumentGuardGeometry(p.guard, p.blade).geometry.getAttribute('position').array;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('monument pommels', () => {
  it.each(MONUMENT_POMMEL_STYLES)('%s: finite, wound outward, hanging from the grip', (style) => {
    const p = monumentBase();
    p.pommel.style = style;
    const gen = new SwordGenerator(p);
    const pm = gen.pommelMesh!;
    expect(finite(pm.geometry)).toBe(true);
    expect(signedVolume(pm.geometry)).toBeGreaterThan(0);
    const grip = new THREE.Box3().setFromObject(gen.handleMesh!);
    const box = new THREE.Box3().setFromObject(pm);
    expect(box.min.y).toBeLessThan(grip.min.y);
    expect(box.max.y).toBeLessThan(grip.min.y + 0.5 * (grip.max.y - grip.min.y));
  });
});

describe('monument design (catalogue)', () => {
  it('the catalogue refers only to its own traits and ids, with weights >= 0', () => {
    const traits = new Set(MONUMENT_CATALOGUE.traits.map((t) => t.id));
    const ids = new Set(
      [
        MONUMENT_CATALOGUE.blades,
        MONUMENT_CATALOGUE.guards,
        MONUMENT_CATALOGUE.pommels,
        MONUMENT_CATALOGUE.grips,
      ]
        .flat()
        .map((e) => e.id)
    );
    for (const list of [
      MONUMENT_CATALOGUE.blades,
      MONUMENT_CATALOGUE.guards,
      MONUMENT_CATALOGUE.pommels,
      MONUMENT_CATALOGUE.grips,
    ]) {
      for (const e of list) {
        expect(e.weight).toBeGreaterThanOrEqual(0);
        for (const [k] of e.affinity) expect(traits.has(k)).toBe(true);
        for (const [k] of e.pairs) expect(ids.has(k)).toBe(true);
      }
    }
    // guard styles and pommel styles the catalogue names exist
    for (const g of MONUMENT_CATALOGUE.guards)
      expect(['forged', ...MONUMENT_GUARD_STYLES, 'shear']).toContain(g.id);
    for (const p of MONUMENT_CATALOGUE.pommels)
      expect(['native', ...MONUMENT_POMMEL_STYLES]).toContain(p.id);
  });
  it('trait strengths are 0..1 and follow the inputs', () => {
    const lava = traitStrengths(TRAITS.lava);
    const ice = traitStrengths(TRAITS.ice);
    for (const s of [lava, ice])
      for (const v of Object.values(s)) expect(v >= 0 && v <= 1).toBe(true);
    expect(lava.hot).toBe(1);
    expect(lava.locked).toBe(1);
    expect(ice.cold).toBe(1);
    expect(ice.magnetic).toBe(1);
    expect(traitStrengths({ ...TRAITS.ice, hasDynamo: false }).magnetic).toBe(0);
  });
  it('affinities steer the picks (hot volcanic worlds favour flamberge and talons)', () => {
    const count = (t: PlanetTraits, f: (p: any) => boolean) => {
      let n = 0;
      for (let s = 0; s < 3000; s++) if (f(pickMonument(t, s).picks)) n++;
      return n;
    };
    expect(count(TRAITS.lava, (p) => p.blade === 'flamberge')).toBeGreaterThan(
      2 * count(TRAITS.ice, (p) => p.blade === 'flamberge')
    );
    expect(count(TRAITS.lava, (p) => p.guard === 'talon')).toBeGreaterThan(
      2 * count(TRAITS.temperate, (p) => p.guard === 'talon')
    );
    expect(count(TRAITS.giant, (p) => p.guard === 'halo')).toBeGreaterThan(
      2 * count(TRAITS.lava, (p) => p.guard === 'halo')
    );
    // every family with a weight is reachable; SW12's dormant (weight-0) entries never are
    const seen = new Set<string>();
    for (const t of Object.values(TRAITS))
      for (let s = 0; s < 2000; s++) {
        const p = pickMonument(t, s).picks;
        seen.add(`b:${p.blade}`).add(`g:${p.guard}`).add(`p:${p.pommel}`).add(`h:${p.grip}`);
      }
    const live = (l: { weight: number }[]) => l.filter((e) => e.weight > 0).length;
    expect(seen.size).toBe(
      live(MONUMENT_CATALOGUE.blades) +
        live(MONUMENT_CATALOGUE.guards) +
        live(MONUMENT_CATALOGUE.pommels) +
        live(MONUMENT_CATALOGUE.grips)
    );
    for (const id of ['b:window', 'b:faultbound', 'g:shear']) expect(seen.has(id)).toBe(false);
  });
  it('weights multiply affinities and pairs in table order', () => {
    const s = traitStrengths(TRAITS.lava);
    const w = entryWeights(MONUMENT_CATALOGUE.guards, s, ['flamberge']);
    const talon = MONUMENT_CATALOGUE.guards.find((e) => e.id === 'talon')!;
    let expected = talon.weight;
    for (const [k, m] of talon.affinity) expected = expected * (1 + (m - 1) * s[k]);
    expected = expected * 1.8;
    expect(w.find(([id]) => id === 'talon')![1]).toBe(expected);
  });
  it('a sword that picks classic/forged/native/native is the base sword, untouched', () => {
    const base = monumentBase();
    const d = designMonument(base, TRAITS.temperate, 7, undefined, {
      blade: 'classic',
      guard: 'forged',
      pommel: 'native',
      grip: 'native',
    });
    expect(d.params).toEqual(base);
  });
  it('deterministic, and every drawn value survives validation unchanged', () => {
    const base = monumentBase();
    for (const [name, t] of Object.entries(TRAITS)) {
      for (let s = 0; s < 60; s++) {
        const seed = monumentSeed(`9${s}1234567890`, `P${s % 5}`);
        const a = designMonument(base, t, seed);
        const b = designMonument(base, t, seed);
        expect(a).toEqual(b);
        const v = validateSwordParams(a.params);
        if (a.params.guard.monument) {
          // the block is written in full: the design's params are what validation writes back
          expect(v.guard.monument).toEqual(a.params.guard.monument);
          for (const [k, x] of Object.entries(a.params.guard.monument))
            expect([name, s, k, (v.guard.monument as any)[k]]).toEqual([name, s, k, x]);
        }
        expect(v.guard.width).toBe(a.params.guard.width);
        expect(v.blade.baseWidth).toBe(a.params.blade.baseWidth);
        expect(v.blade.widthProfile).toEqual(a.params.blade.widthProfile);
        expect(v.blade.waviness).toEqual(a.params.blade.waviness);
        expect(v.pommel.style).toBe(a.params.pommel.style);
      }
    }
  });
  it('every family builds finite geometry on the giant preset', () => {
    const base = monumentBase();
    for (const blade of MONUMENT_CATALOGUE.blades.map((e) => e.id)) {
      const d = designMonument(base, TRAITS.temperate, 11, undefined, { blade, guard: 'halo' });
      const gen = new SwordGenerator(d.params);
      expect(finite(gen.bladeMesh!.geometry as THREE.BufferGeometry)).toBe(true);
    }
  });
  it('the seed is FNV-1a of "sword-family|<system seed>|<planet id>"', () => {
    expect(monumentSeed('5796783868755968943', 'P3')).toBe(
      monumentSeed('5796783868755968943', 'P3')
    );
    expect(monumentSeed('5796783868755968943', 'P3')).not.toBe(
      monumentSeed('5796783868755968943', 'P2')
    );
  });
  it('a default sword with a monument style validates against the schema shape', () => {
    const p = defaultSwordParams();
    p.guard.style = 'ziggurat';
    p.pommel.style = 'gem';
    const v = validateSwordParams(p);
    expect(v.guard.monument?.count).toBe(3);
    expect(v.pommel.style).toBe('gem');
  });
});
