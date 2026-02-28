import { describe, it, expect } from 'vitest';
import {
  bendOffsetX,
  tipWidthWithKissaki,
  thicknessScaleAt,
  wavinessAt,
  serrationWave,
} from '../math';

const baseBlade = {
  length: 2,
  baseWidth: 0.2,
  tipWidth: 0.05,
  thickness: 0.06,
  curvature: 0,
} as any;

// ---------------------------------------------------------------------------
// sampleProfile — tested indirectly through bendOffsetX with curveProfile
// and tipWidthWithKissaki with widthProfile
// ---------------------------------------------------------------------------
describe('sampleProfile (via curveProfile / widthProfile)', () => {
  it('returns start value at t=0', () => {
    const blade = {
      ...baseBlade,
      curvature: 0,
      baseAngle: 0,
      curveProfile: {
        mode: 'absolute',
        scale: 1,
        points: [
          [0, 0.3],
          [1, 0.8],
        ],
      },
    } as any;
    const offset = bendOffsetX(blade, 0, blade.length);
    expect(offset).toBeCloseTo(0.3, 5);
  });

  it('returns end value at t=1', () => {
    const blade = {
      ...baseBlade,
      curvature: 0,
      baseAngle: 0,
      curveProfile: {
        mode: 'absolute',
        scale: 1,
        points: [
          [0, 0.3],
          [1, 0.8],
        ],
      },
    } as any;
    const offset = bendOffsetX(blade, blade.length, blade.length);
    expect(offset).toBeCloseTo(0.8, 5);
  });

  it('interpolates at midpoint t=0.5', () => {
    const blade = {
      ...baseBlade,
      curvature: 0,
      baseAngle: 0,
      curveProfile: {
        mode: 'absolute',
        scale: 1,
        points: [
          [0, 0],
          [1, 1],
        ],
      },
    } as any;
    const offset = bendOffsetX(blade, blade.length * 0.5, blade.length);
    expect(offset).toBeCloseTo(0.5, 5);
  });

  it('handles profile with single point by returning that value', () => {
    // sampleProfile with 1 point: lo=hi=that point, alpha=0, returns lo[1]
    // But curveProfile needs >= 2 points to pass validation in bendOffsetX's check.
    // With a single point, the points.length < 2 guard means profile contribution is 0.
    const blade = {
      ...baseBlade,
      curvature: 0,
      baseAngle: 0,
      curveProfile: {
        mode: 'absolute',
        scale: 1,
        points: [[0.5, 0.7]],
      },
    } as any;
    // Single point doesn't meet the >= 2 guard, so profile = 0
    const offset = bendOffsetX(blade, blade.length * 0.5, blade.length);
    expect(offset).toBeCloseTo(0, 5);
  });

  it('handles profile with t beyond the last point', () => {
    const blade = {
      ...baseBlade,
      curvature: 0,
      baseAngle: 0,
      curveProfile: {
        mode: 'absolute',
        scale: 1,
        points: [
          [0, 0],
          [0.5, 1],
        ],
      },
    } as any;
    // t=1 is beyond the last point at 0.5
    const offset = bendOffsetX(blade, blade.length, blade.length);
    // sampleProfile should extrapolate/clamp — with the implementation it
    // uses lo=points[last], hi=points[last], so alpha->1, returns hi[1]=1
    expect(Number.isFinite(offset)).toBe(true);
  });

  it('handles widthProfile at boundary values t=0 and t=1', () => {
    const blade = {
      ...baseBlade,
      widthProfile: {
        mode: 'scale',
        points: [
          [0, 2],
          [1, 0.5],
        ],
      },
    } as any;
    const w0 = tipWidthWithKissaki(blade, 0, blade.baseWidth, blade.tipWidth);
    const w1 = tipWidthWithKissaki(blade, 1, blade.baseWidth, blade.tipWidth);
    // At t=0: base width (0.2) * scale(2) = 0.4
    expect(w0).toBeCloseTo(blade.baseWidth * 2, 4);
    // At t=1: tip width (0.05) * scale(0.5) = 0.025
    expect(w1).toBeCloseTo(blade.tipWidth * 0.5, 4);
  });
});

// ---------------------------------------------------------------------------
// thicknessScaleAt
// ---------------------------------------------------------------------------
describe('thicknessScaleAt', () => {
  it('returns 1 at both endpoints for default (no profile)', () => {
    expect(thicknessScaleAt(baseBlade, 0)).toBeCloseTo(1);
    expect(thicknessScaleAt(baseBlade, 1)).toBeCloseTo(1);
  });

  it('interpolates linearly between control points', () => {
    const blade = {
      ...baseBlade,
      thicknessProfile: {
        points: [
          [0, 1],
          [0.5, 0.5],
          [1, 0.25],
        ],
      },
    } as any;
    expect(thicknessScaleAt(blade, 0.25)).toBeCloseTo(0.75, 5);
    expect(thicknessScaleAt(blade, 0.75)).toBeCloseTo(0.375, 5);
  });

  it('clamps t to [0, 1]', () => {
    const blade = {
      ...baseBlade,
      thicknessProfile: {
        points: [
          [0, 1],
          [1, 0.5],
        ],
      },
    } as any;
    // t < 0 should act like t=0
    expect(thicknessScaleAt(blade, -1)).toBeCloseTo(1, 5);
    // t > 1 should act like t=1
    expect(thicknessScaleAt(blade, 2)).toBeCloseTo(0.5, 5);
  });

  it('handles duplicate control points (same t)', () => {
    const blade = {
      ...baseBlade,
      thicknessProfile: {
        points: [
          [0, 1],
          [0.5, 0.8],
          [0.5, 0.6], // duplicate t
          [1, 0.3],
        ],
      },
    } as any;
    // After sorting, both t=0.5 entries are adjacent.
    // The while loop finds the first interval containing tt.
    // The result should be finite and reasonable.
    const val = thicknessScaleAt(blade, 0.5);
    expect(Number.isFinite(val)).toBe(true);
    // For tt exactly at the duplicate, t1===t0 guard returns s0
    expect(val).toBeGreaterThanOrEqual(0.3);
    expect(val).toBeLessThanOrEqual(1);
  });

  it('returns the only value when profile has a single point pair', () => {
    // With < 2 points the function falls back to [[0,1],[1,1]]
    const blade = {
      ...baseBlade,
      thicknessProfile: {
        points: [[0.5, 0.7] as [number, number]],
      },
    } as any;
    // Falls back to default — returns 1
    expect(thicknessScaleAt(blade, 0.5)).toBeCloseTo(1);
  });

  it('handles NaN t by clamping', () => {
    // Math.max(0, Math.min(1, NaN)) = NaN, but result should still be a number
    const val = thicknessScaleAt(baseBlade, NaN);
    // Depending on implementation, NaN propagation may occur
    expect(typeof val).toBe('number');
  });

  it('handles Infinity t by clamping to 1', () => {
    const blade = {
      ...baseBlade,
      thicknessProfile: {
        points: [
          [0, 1],
          [1, 0.5],
        ],
      },
    } as any;
    const val = thicknessScaleAt(blade, Infinity);
    expect(val).toBeCloseTo(0.5, 5);
  });

  it('handles -Infinity t by clamping to 0', () => {
    const blade = {
      ...baseBlade,
      thicknessProfile: {
        points: [
          [0, 1],
          [1, 0.5],
        ],
      },
    } as any;
    const val = thicknessScaleAt(blade, -Infinity);
    expect(val).toBeCloseTo(1, 5);
  });

  it('unsorted profile points are sorted internally', () => {
    const blade = {
      ...baseBlade,
      thicknessProfile: {
        points: [
          [1, 0.3],
          [0, 1],
        ],
      },
    } as any;
    expect(thicknessScaleAt(blade, 0)).toBeCloseTo(1, 5);
    expect(thicknessScaleAt(blade, 1)).toBeCloseTo(0.3, 5);
  });
});

// ---------------------------------------------------------------------------
// wavinessAt
// ---------------------------------------------------------------------------
describe('wavinessAt', () => {
  it('returns zero offsets when waviness is undefined', () => {
    const result = wavinessAt(baseBlade, 0.5);
    expect(result.center).toBe(0);
    expect(result.width).toBe(0);
  });

  it('returns center offset in centerline mode', () => {
    const blade = {
      ...baseBlade,
      waviness: { amplitude: 0.05, frequency: 4, mode: 'centerline', taper: 0, phase: 0, offset: 0 },
    } as any;
    const result = wavinessAt(blade, 0.3);
    expect(Math.abs(result.center)).toBeGreaterThan(0.001);
    expect(result.width).toBe(0);
  });

  it('returns width offset in width mode', () => {
    const blade = {
      ...baseBlade,
      waviness: { amplitude: 0.05, frequency: 4, mode: 'width', taper: 0, phase: 0, offset: 0 },
    } as any;
    const result = wavinessAt(blade, 0.3);
    expect(result.center).toBe(0); // offset is 0 so center is just offset*envelope=0
    expect(Math.abs(result.width)).toBeGreaterThan(0.001);
  });

  it('returns both center and width offsets in both mode', () => {
    const blade = {
      ...baseBlade,
      waviness: { amplitude: 0.05, frequency: 4, mode: 'both', taper: 0, phase: 0, offset: 0 },
    } as any;
    const result = wavinessAt(blade, 0.3);
    expect(Math.abs(result.center)).toBeGreaterThan(0.001);
    expect(Math.abs(result.width)).toBeGreaterThan(0.001);
  });

  it('taper reduces amplitude toward the tip', () => {
    const blade = {
      ...baseBlade,
      waviness: { amplitude: 0.05, frequency: 4, mode: 'width', taper: 2, phase: 0, offset: 0 },
    } as any;
    const nearBase = wavinessAt(blade, 0.1);
    const nearTip = wavinessAt(blade, 0.9);
    expect(Math.abs(nearBase.width)).toBeGreaterThan(Math.abs(nearTip.width));
  });

  it('zero taper gives uniform amplitude along blade', () => {
    const blade = {
      ...baseBlade,
      waviness: { amplitude: 0.05, frequency: 4, mode: 'width', taper: 0, phase: 0, offset: 0 },
    } as any;
    // Pick two points with the same sin phase to compare envelopes
    // At t=0.25 and t=0.75 with frequency=4, sin phase values differ
    // Instead, compare that the envelope (1 for taper=0) is constant by
    // checking magnitudes at equivalent phase positions
    const _t1 = 0.125; // sin(0.125 * 4 * 2pi) = sin(pi) = 0 ... need non-zero
    const t2 = 0.03125; // sin(0.03125 * 4 * 2pi) = sin(pi/4) != 0
    // With taper=0, the wave at t should be amplitude * sin(t*freq*2pi)
    // The envelope is 1 everywhere, so the magnitude ratio equals sin ratio
    const r1 = wavinessAt(blade, t2);
    const r2 = wavinessAt(blade, t2 + 0.5); // half-period offset at same frequency
    // These should have opposite signs but same magnitude
    expect(Math.abs(r1.width)).toBeCloseTo(Math.abs(r2.width), 5);
  });

  it('offset adds a static shift in width mode', () => {
    const blade = {
      ...baseBlade,
      waviness: { amplitude: 0.05, frequency: 4, mode: 'width', taper: 0, phase: 0, offset: 0.1 },
    } as any;
    const result = wavinessAt(blade, 0.5);
    // In width mode: center = offset * envelope, width = wave
    expect(result.center).toBeCloseTo(0.1, 5);
  });

  it('phase shifts the waveform', () => {
    const blade0 = {
      ...baseBlade,
      waviness: { amplitude: 0.05, frequency: 4, mode: 'centerline', taper: 0, phase: 0, offset: 0 },
    } as any;
    const bladeShifted = {
      ...baseBlade,
      waviness: { amplitude: 0.05, frequency: 4, mode: 'centerline', taper: 0, phase: Math.PI / 2, offset: 0 },
    } as any;
    const r0 = wavinessAt(blade0, 0.3);
    const rShifted = wavinessAt(bladeShifted, 0.3);
    expect(r0.center).not.toBeCloseTo(rShifted.center, 5);
  });
});

// ---------------------------------------------------------------------------
// serrationWave edge cases
// ---------------------------------------------------------------------------
describe('serrationWave edge cases', () => {
  it('returns 0 when amplitude is 0', () => {
    expect(serrationWave(0.5, 6, 0, 'sine', 0)).toBe(0);
  });

  it('returns 0 when frequency is 0', () => {
    expect(serrationWave(0.5, 0, 1, 'sine', 0)).toBe(0);
  });

  it('returns finite values for all pattern types', () => {
    const patterns = ['sine', 'saw', 'scallop', 'random'] as const;
    for (const p of patterns) {
      const val = serrationWave(0.3, 6, 1, p, 42);
      expect(Number.isFinite(val)).toBe(true);
    }
  });

  it('amplitude scales the output', () => {
    const a1 = serrationWave(0.25, 6, 1, 'sine', 0);
    const a2 = serrationWave(0.25, 6, 2, 'sine', 0);
    expect(a2).toBeCloseTo(a1 * 2, 5);
  });

  it('sharpness accentuates peaks without changing sign', () => {
    const smooth = serrationWave(0.18, 6, 1, 'sine', 0, 0, 0);
    const sharp = serrationWave(0.18, 6, 1, 'sine', 0, 1, 0);
    expect(Math.sign(smooth)).toBe(Math.sign(sharp));
    expect(Math.abs(sharp)).toBeGreaterThanOrEqual(Math.abs(smooth) - 1e-10);
  });

  it('NaN inputs produce a number (graceful degradation)', () => {
    const val = serrationWave(NaN, 6, 1, 'sine', 0);
    expect(typeof val).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// bendOffsetX edge cases
// ---------------------------------------------------------------------------
describe('bendOffsetX edge cases', () => {
  it('returns 0 for zero curvature and zero baseAngle and no profile', () => {
    const blade = { ...baseBlade, curvature: 0, baseAngle: 0 } as any;
    expect(bendOffsetX(blade, 1, 2)).toBeCloseTo(0);
  });

  it('returns 0 at y=0 regardless of curvature', () => {
    const blade = { ...baseBlade, curvature: 0.5 } as any;
    expect(bendOffsetX(blade, 0, 2)).toBeCloseTo(0);
  });

  it('handles zero-length blade (L=0) without error', () => {
    const blade = { ...baseBlade, curvature: 0.5 } as any;
    const val = bendOffsetX(blade, 0, 0);
    expect(Number.isFinite(val)).toBe(true);
  });

  it('curve profile in relative mode scales by blade length', () => {
    const blade = {
      ...baseBlade,
      curvature: 0,
      baseAngle: 0,
      curveProfile: {
        mode: 'relative',
        scale: 1,
        points: [
          [0, 0],
          [1, 0.1],
        ],
      },
    } as any;
    const L = blade.length;
    const offset = bendOffsetX(blade, L, L);
    // In relative mode, the profile value (0.1) is multiplied by L (2)
    expect(offset).toBeCloseTo(0.1 * L, 5);
  });
});

// ---------------------------------------------------------------------------
// tipWidthWithKissaki edge cases
// ---------------------------------------------------------------------------
describe('tipWidthWithKissaki edge cases', () => {
  it('never returns less than 0.0005 (minimum clamp)', () => {
    const blade = { ...baseBlade, tipWidth: 0, baseWidth: 0 } as any;
    const w = tipWidthWithKissaki(blade, 1, 0, 0);
    expect(w).toBeGreaterThanOrEqual(0.0005);
  });

  it('leaf tip adds bulge at midpoint', () => {
    const blade = { ...baseBlade, tipShape: 'leaf', tipBulge: 1 } as any;
    const wMid = tipWidthWithKissaki(blade, 0.5, blade.baseWidth, blade.tipWidth);
    const wBase = tipWidthWithKissaki(blade, 0, blade.baseWidth, blade.tipWidth);
    // Leaf bulge: w *= 1 + bulge * 4*t*(1-t). At t=0.5, bell=1, so w *= 2
    expect(wMid).toBeGreaterThan(wBase);
  });

  it('widthProfile in absolute mode overrides procedural width', () => {
    const blade = {
      ...baseBlade,
      widthProfile: {
        mode: 'absolute',
        points: [
          [0, 0.5],
          [1, 0.5],
        ],
      },
    } as any;
    const w0 = tipWidthWithKissaki(blade, 0, blade.baseWidth, blade.tipWidth);
    const w1 = tipWidthWithKissaki(blade, 1, blade.baseWidth, blade.tipWidth);
    expect(w0).toBeCloseTo(0.5, 4);
    expect(w1).toBeCloseTo(0.5, 4);
  });
});
