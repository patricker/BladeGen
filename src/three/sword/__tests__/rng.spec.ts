import { describe, it, expect } from 'vitest';
import { createRng, fmix32, hashSeed, normalizeSeed, q3 } from '../rng';

describe('seeded rng', () => {
  it('matches recorded mulberry32 + fmix32 vectors (port contract)', () => {
    // fmix32(1) is the MurmurHash3 finalizer reference value 0x514E28B7.
    expect(fmix32(1)).toBe(0x514e28b7);
    expect(fmix32(0)).toBe(0);
    expect(hashSeed('acc1:example')).toBe(3501241669);
    const r = createRng(1);
    expect([r.next(), r.next(), r.next()]).toEqual([
      0.2860478847287595, 0.24245584453456104, 0.5236019375734031,
    ]);
  });

  it('is deterministic and stays in range', () => {
    const a = createRng(123);
    const b = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const x = a.next();
      expect(x).toBe(b.next());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    const c = createRng(7);
    for (let i = 0; i < 500; i++) {
      const n = c.int(2, 5);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('normalizes numeric strings and hashes other strings', () => {
    expect(normalizeSeed('42')).toBe(42);
    expect(normalizeSeed(42)).toBe(42);
    expect(normalizeSeed('acc1:example')).toBe(hashSeed('acc1:example'));
    expect(normalizeSeed(-3.7)).toBe(3);
  });

  it('q3 rounds half up to 3 decimals', () => {
    expect(q3(0.1235)).toBe(0.124);
    expect(q3(-0.0005)).toBe(0);
    expect(q3(2.9999)).toBe(3);
  });

  it('weighted picks respect zero-probability gaps', () => {
    const r = createRng(9);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++)
      seen.add(
        r.weighted([
          ['a', 1],
          ['b', 3],
        ] as const)
      );
    expect([...seen].sort()).toEqual(['a', 'b']);
  });
});
