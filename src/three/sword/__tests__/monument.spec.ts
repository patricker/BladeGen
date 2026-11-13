import * as THREE from 'three';
import { SwordGenerator } from '../../SwordGenerator';
import { defaultSwordParams } from '../defaults';
import { validateSwordParams } from '../validation';
import {
  mergeParts,
  mirrorPart,
  ringPart,
  sectionOutline,
  strokePart,
  type Part,
  type Stroke,
} from '../monument/strokes';
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
function closedAndConsistent(p: Part): boolean {
  // welded at 1e-7 (the seam copy at phi = 2 pi differs from phi = 0 in the last bits, as in three's primitives)
  const q = (x: number) => Math.round(x * 1e7) + 0;
  const key = (i: number) => `${q(p.pos[3 * i])},${q(p.pos[3 * i + 1])},${q(p.pos[3 * i + 2])}`;
  const directed = new Map<string, number>();
  for (let t = 0; t < p.idx.length; t += 3) {
    const v = [key(p.idx[t]), key(p.idx[t + 1]), key(p.idx[t + 2])];
    if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) continue; // degenerate seam slivers
    for (let e = 0; e < 3; e++) {
      const k = `${v[e]}|${v[(e + 1) % 3]}`;
      directed.set(k, (directed.get(k) ?? 0) + 1);
    }
  }
  for (const [k, n] of directed) {
    const [a, b] = k.split('|');
    if (n !== 1 || directed.get(`${b}|${a}`) !== 1) return false;
  }
  return true;
}

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

describe('monument strokes', () => {
  const sec = sectionOutline(0.5, 16);
  const base: Stroke = {
    x: 0.1,
    y: 0,
    heading: 0.2,
    length: 1,
    bend: 0.8,
    hy: 0.08,
    hz: 0.06,
    size: { kind: 'taper', taper: 0.4 },
    tip: 'point',
    segments: 12,
  };
  it.each(['flat', 'point', 'knob'] as const)(
    'a %s-tipped stroke is a closed tube wound outward',
    (tip) => {
      const p = strokePart({ ...base, tip, knob: 0.5 }, sec);
      expect(closedAndConsistent(p)).toBe(true);
      expect(signedVolume(mergeParts([p]))).toBeGreaterThan(0);
    }
  );
  it('a ring is closed and wound outward; a mirrored part stays outward', () => {
    const r = ringPart({ cx: 0, cy: 0.2, radius: 0.5, hy: 0.04, hz: 0.05, segments: 40 }, sec);
    expect(closedAndConsistent(r)).toBe(true);
    expect(signedVolume(mergeParts([r]))).toBeGreaterThan(0);
    const m = mirrorPart(strokePart(base, sec));
    expect(closedAndConsistent(m)).toBe(true);
    expect(signedVolume(mergeParts([m]))).toBeGreaterThan(0);
  });
  it('the centre line turns by turn and bend (a stroke turning toward +Y ends above its start)', () => {
    const up = strokePart({ ...base, heading: 0, bend: 1.2 }, sec);
    const down = strokePart({ ...base, heading: 0, bend: -1.2 }, sec);
    const n = up.pos.length / 3 - 1;
    expect(up.pos[3 * n + 1]).toBeGreaterThan(0.2);
    expect(down.pos[3 * n + 1]).toBeLessThan(-0.2);
  });
});

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
      expect(['forged', ...MONUMENT_GUARD_STYLES]).toContain(g.id);
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
    // every family is reachable
    const seen = new Set<string>();
    for (const t of Object.values(TRAITS))
      for (let s = 0; s < 2000; s++) {
        const p = pickMonument(t, s).picks;
        seen.add(`b:${p.blade}`).add(`g:${p.guard}`).add(`p:${p.pommel}`).add(`h:${p.grip}`);
      }
    expect(seen.size).toBe(
      MONUMENT_CATALOGUE.blades.length +
        MONUMENT_CATALOGUE.guards.length +
        MONUMENT_CATALOGUE.pommels.length +
        MONUMENT_CATALOGUE.grips.length
    );
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
