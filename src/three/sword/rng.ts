/**
 * Small seeded PRNG used by the seeded randomizer and procedural glow runes.
 *
 * The algorithm is mulberry32 (32-bit state, period 2^32). It is chosen because
 * it is tiny and bit-exact to port: every step is 32-bit integer math, and the
 * float output is an exact division by 2^32. Ports (e.g. Rust) must reproduce:
 *
 *   state0 = fmix32(seed)            // MurmurHash3 finalizer, see below
 *   state = (state + 0x6D2B79F5) mod 2^32
 *   z = state
 *   z = imul(z ^ (z >>> 15), z | 1)
 *   z ^= z + imul(z ^ (z >>> 7), z | 61)
 *   out = ((z ^ (z >>> 14)) >>> 0) / 4294967296      // in [0, 1)
 *
 * fmix32(h): h ^= h >>> 16; h = imul(h, 0x85EBCA6B); h ^= h >>> 13;
 *            h = imul(h, 0xC2B2AE35); h ^= h >>> 16   (decorrelates nearby seeds)
 *
 * where `imul` is a wrapping 32-bit multiply and `+` inside the second line is a
 * wrapping 32-bit add. Derived helpers below only use `next()` plus f64 math that
 * IEEE 754 defines exactly (add, sub, mul, div, floor).
 */

/** Hash a string to a 32-bit seed (FNV-1a over UTF-16 code units). */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Normalize a seed (number or string) to an unsigned 32-bit integer. */
export function normalizeSeed(seed: number | string): number {
  if (typeof seed === 'string') {
    const trimmed = seed.trim();
    if (/^\d+$/.test(trimmed) && Number(trimmed) <= 0xffffffff) return Number(trimmed) >>> 0;
    return hashSeed(seed);
  }
  if (!Number.isFinite(seed)) return 0;
  // Integers in [0, 2^32) pass through; anything else is reduced mod 2^32.
  return Math.floor(Math.abs(seed)) >>> 0;
}

export type Rng = {
  /** Uniform float in [0, 1). */
  next: () => number;
  /** Uniform float in [a, b). */
  range: (a: number, b: number) => number;
  /** Uniform integer in [a, b] (inclusive). */
  int: (a: number, b: number) => number;
  /** True with probability p. */
  chance: (p: number) => boolean;
  /** Uniform pick from a non-empty array. */
  pick: <T>(items: readonly T[]) => T;
  /** Weighted pick from [item, weight] pairs (weights > 0). */
  weighted: <T>(items: ReadonlyArray<readonly [T, number]>) => T;
  /** Derive an independent child generator (for sub-systems such as runes). */
  fork: () => Rng;
};

/** MurmurHash3 32-bit finalizer. */
export function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Create a mulberry32 generator from a seed (scrambled with fmix32). */
export function createRng(seed: number | string): Rng {
  let state = fmix32(normalizeSeed(seed));
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted: (items) => {
      let total = 0;
      for (const [, w] of items) total += w;
      let r = next() * total;
      for (const [item, w] of items) {
        if (r < w) return item;
        r -= w;
      }
      return items[items.length - 1][0];
    },
    fork: () => createRng(Math.floor(next() * 4294967296) >>> 0),
  };
  return rng;
}

/**
 * Quantize to 3 decimals with round-half-up (floor(x*1000+0.5)/1000).
 * Used for randomizer outputs so params are readable and ports can match them
 * exactly (Math.round differs from some languages' round on negative halves).
 */
export function q3(x: number): number {
  return Math.floor(x * 1000 + 0.5) / 1000;
}
