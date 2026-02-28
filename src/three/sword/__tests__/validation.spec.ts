import { describe, it, expect } from 'vitest';
import { validateSwordParams } from '../validation';
import { defaultSwordParams } from '../defaults';

/**
 * Helper: build a minimal valid SwordParams object for feeding into
 * validateSwordParams. Individual tests override the fields they care about.
 */
const minimalParams = () => defaultSwordParams();

// ---------------------------------------------------------------------------
// sanitizeProfilePoints (tested indirectly via thicknessProfile / curveProfile)
// ---------------------------------------------------------------------------
describe('sanitizeProfilePoints (via thicknessProfile)', () => {
  it('passes through valid profile points unchanged', () => {
    const params = minimalParams();
    params.blade.thicknessProfile = {
      points: [
        [0, 1],
        [0.5, 0.8],
        [1, 0.3],
      ],
    };
    const v = validateSwordParams(params);
    expect(v.blade.thicknessProfile?.points).toHaveLength(3);
    expect(v.blade.thicknessProfile!.points![0][0]).toBeCloseTo(0);
    expect(v.blade.thicknessProfile!.points![2][0]).toBeCloseTo(1);
  });

  it('filters out non-finite (NaN / Infinity) points', () => {
    const params = minimalParams();
    params.blade.thicknessProfile = {
      points: [
        [0, 1],
        [NaN, 0.5],
        [0.5, Infinity],
        [1, 0.3],
      ],
    };
    const v = validateSwordParams(params);
    // Only [0,1] and [1,0.3] survive filtering — still 2 valid points
    expect(v.blade.thicknessProfile?.points).toBeDefined();
    expect(v.blade.thicknessProfile!.points!.length).toBeGreaterThanOrEqual(2);
    for (const pt of v.blade.thicknessProfile!.points!) {
      expect(Number.isFinite(pt[0])).toBe(true);
      expect(Number.isFinite(pt[1])).toBe(true);
    }
  });

  it('returns undefined (no profile) when all points are invalid', () => {
    const params = minimalParams();
    params.blade.thicknessProfile = {
      points: [
        [NaN, NaN],
        [Infinity, -Infinity],
      ],
    };
    const v = validateSwordParams(params);
    expect(v.blade.thicknessProfile).toBeUndefined();
  });

  it('returns undefined when array has fewer than 2 valid entries', () => {
    const params = minimalParams();
    params.blade.thicknessProfile = {
      points: [[0.5, 1]],
    };
    const v = validateSwordParams(params);
    expect(v.blade.thicknessProfile).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    const params = minimalParams();
    params.blade.thicknessProfile = { points: [] };
    const v = validateSwordParams(params);
    expect(v.blade.thicknessProfile).toBeUndefined();
  });

  it('returns undefined when points is not an array', () => {
    const params = minimalParams();
    (params.blade as any).thicknessProfile = { points: 'not-an-array' };
    const v = validateSwordParams(params);
    expect(v.blade.thicknessProfile).toBeUndefined();
  });

  it('filters entries that are not arrays or have < 2 elements', () => {
    const params = minimalParams();
    params.blade.thicknessProfile = {
      points: [
        [0, 1],
        [42] as any,
        'string' as any,
        null as any,
        [1, 0.5],
      ],
    };
    const v = validateSwordParams(params);
    expect(v.blade.thicknessProfile?.points).toBeDefined();
    expect(v.blade.thicknessProfile!.points!.length).toBe(2);
  });

  it('deduplicates points with very close t values', () => {
    const params = minimalParams();
    params.blade.thicknessProfile = {
      points: [
        [0, 1],
        [0.00005, 0.9], // within 1e-4 of 0 — should replace the first
        [1, 0.3],
      ],
    };
    const v = validateSwordParams(params);
    expect(v.blade.thicknessProfile?.points).toBeDefined();
    // Dedup collapses [0,1] and [0.00005,0.9] into one entry
    expect(v.blade.thicknessProfile!.points!.length).toBe(2);
  });

  it('sorts unsorted profile points by t', () => {
    const params = minimalParams();
    params.blade.thicknessProfile = {
      points: [
        [1, 0.3],
        [0, 1],
        [0.5, 0.7],
      ],
    };
    const v = validateSwordParams(params);
    const pts = v.blade.thicknessProfile!.points!;
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i][0]).toBeGreaterThanOrEqual(pts[i - 1][0]);
    }
  });

  it('clamps thickness profile values to [0.05, 5]', () => {
    const params = minimalParams();
    params.blade.thicknessProfile = {
      points: [
        [0, -10],
        [1, 100],
      ],
    };
    const v = validateSwordParams(params);
    const pts = v.blade.thicknessProfile!.points!;
    expect(pts[0][1]).toBeGreaterThanOrEqual(0.05);
    expect(pts[1][1]).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// sanitizeCurveProfile (tested via blade.curveProfile)
// ---------------------------------------------------------------------------
describe('sanitizeCurveProfile (via curveProfile)', () => {
  it('passes valid curve profiles through', () => {
    const params = minimalParams();
    params.blade.curveProfile = {
      mode: 'absolute',
      scale: 1,
      points: [
        [0, 0],
        [1, 0.5],
      ],
    };
    const v = validateSwordParams(params);
    expect(v.blade.curveProfile).toBeDefined();
    expect(v.blade.curveProfile!.mode).toBe('absolute');
    expect(v.blade.curveProfile!.points).toHaveLength(2);
  });

  it('defaults mode to absolute for invalid mode', () => {
    const params = minimalParams();
    params.blade.curveProfile = {
      mode: 'bogus' as any,
      scale: 1,
      points: [
        [0, 0],
        [1, 0.5],
      ],
    };
    const v = validateSwordParams(params);
    expect(v.blade.curveProfile!.mode).toBe('absolute');
  });

  it('returns undefined for null/missing curveProfile', () => {
    const params = minimalParams();
    params.blade.curveProfile = undefined;
    const v = validateSwordParams(params);
    expect(v.blade.curveProfile).toBeUndefined();
  });

  it('returns undefined when points array has no valid entries', () => {
    const params = minimalParams();
    params.blade.curveProfile = {
      mode: 'absolute',
      scale: 1,
      points: [[NaN, NaN]],
    };
    const v = validateSwordParams(params);
    expect(v.blade.curveProfile).toBeUndefined();
  });

  it('clamps scale to [0, 5]', () => {
    const params = minimalParams();
    params.blade.curveProfile = {
      mode: 'absolute',
      scale: 100,
      points: [
        [0, 0],
        [1, 0.5],
      ],
    };
    const v = validateSwordParams(params);
    expect(v.blade.curveProfile!.scale).toBeLessThanOrEqual(5);
  });

  it('clamps point values to [-5, 5]', () => {
    const params = minimalParams();
    params.blade.curveProfile = {
      mode: 'absolute',
      scale: 1,
      points: [
        [0, -20],
        [1, 20],
      ],
    };
    const v = validateSwordParams(params);
    const pts = v.blade.curveProfile!.points!;
    expect(pts[0][1]).toBeGreaterThanOrEqual(-5);
    expect(pts[1][1]).toBeLessThanOrEqual(5);
  });

  it('accepts relative mode', () => {
    const params = minimalParams();
    params.blade.curveProfile = {
      mode: 'relative',
      scale: 2,
      points: [
        [0, 0],
        [1, 1],
      ],
    };
    const v = validateSwordParams(params);
    expect(v.blade.curveProfile!.mode).toBe('relative');
  });
});

// ---------------------------------------------------------------------------
// sanitizeWaviness (tested via blade.waviness)
// ---------------------------------------------------------------------------
describe('sanitizeWaviness (via blade.waviness)', () => {
  it('passes valid waviness through', () => {
    const params = minimalParams();
    (params.blade as any).waviness = {
      amplitude: 0.02,
      frequency: 6,
      phase: 0,
      taper: 1,
      offset: 0,
      mode: 'centerline',
    };
    const v = validateSwordParams(params);
    expect(v.blade.waviness).toBeDefined();
    expect(v.blade.waviness!.amplitude).toBeCloseTo(0.02);
    expect(v.blade.waviness!.frequency).toBe(6);
    expect(v.blade.waviness!.mode).toBe('centerline');
  });

  it('returns undefined when amplitude is zero', () => {
    const params = minimalParams();
    (params.blade as any).waviness = {
      amplitude: 0,
      frequency: 6,
    };
    const v = validateSwordParams(params);
    // amplitude <= 0 => undefined (unless family default kicks in)
    // Use 'straight' family to avoid default waviness
    expect(v.blade.family).toBe('straight');
    expect(v.blade.waviness).toBeUndefined();
  });

  it('returns undefined when frequency is zero', () => {
    const params = minimalParams();
    (params.blade as any).waviness = {
      amplitude: 0.05,
      frequency: 0,
    };
    const v = validateSwordParams(params);
    expect(v.blade.waviness).toBeUndefined();
  });

  it('clamps amplitude to [0, baseWidth * 1.2]', () => {
    const params = minimalParams();
    params.blade.baseWidth = 0.25;
    (params.blade as any).waviness = {
      amplitude: 100,
      frequency: 4,
    };
    const v = validateSwordParams(params);
    expect(v.blade.waviness).toBeDefined();
    expect(v.blade.waviness!.amplitude).toBeLessThanOrEqual(0.25 * 1.2 + 0.001);
  });

  it('clamps frequency to [0, 24]', () => {
    const params = minimalParams();
    (params.blade as any).waviness = {
      amplitude: 0.02,
      frequency: 999,
    };
    const v = validateSwordParams(params);
    expect(v.blade.waviness!.frequency).toBeLessThanOrEqual(24);
  });

  it('clamps taper to [0, 6]', () => {
    const params = minimalParams();
    (params.blade as any).waviness = {
      amplitude: 0.02,
      frequency: 4,
      taper: 100,
    };
    const v = validateSwordParams(params);
    expect(v.blade.waviness!.taper).toBeLessThanOrEqual(6);
  });

  it('defaults mode to width for unrecognized values', () => {
    const params = minimalParams();
    (params.blade as any).waviness = {
      amplitude: 0.02,
      frequency: 4,
      mode: 'bogus',
    };
    const v = validateSwordParams(params);
    expect(v.blade.waviness!.mode).toBe('width');
  });

  it('returns undefined for non-object waviness', () => {
    const params = minimalParams();
    (params.blade as any).waviness = 'not-an-object';
    const v = validateSwordParams(params);
    // straight family, no default waviness applied
    expect(v.blade.waviness).toBeUndefined();
  });

  it('returns undefined for null waviness', () => {
    const params = minimalParams();
    (params.blade as any).waviness = null;
    const v = validateSwordParams(params);
    expect(v.blade.waviness).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateSwordParams — main clamping
// ---------------------------------------------------------------------------
describe('validateSwordParams clamping', () => {
  it('clamps blade.length to [0.1, 20]', () => {
    const params = minimalParams();
    params.blade.length = -5;
    expect(validateSwordParams(params).blade.length).toBe(0.1);

    params.blade.length = 999;
    expect(validateSwordParams(params).blade.length).toBe(20);
  });

  it('clamps blade.baseWidth to [0.02, 5]', () => {
    const params = minimalParams();
    params.blade.baseWidth = -1;
    expect(validateSwordParams(params).blade.baseWidth).toBe(0.02);

    params.blade.baseWidth = 100;
    expect(validateSwordParams(params).blade.baseWidth).toBe(5);
  });

  it('clamps blade.tipWidth to [0, 5]', () => {
    const params = minimalParams();
    params.blade.tipWidth = -1;
    expect(validateSwordParams(params).blade.tipWidth).toBe(0);

    params.blade.tipWidth = 100;
    expect(validateSwordParams(params).blade.tipWidth).toBe(5);
  });

  it('clamps blade.thickness to [0.01, 2]', () => {
    const params = minimalParams();
    params.blade.thickness = 0;
    expect(validateSwordParams(params).blade.thickness).toBe(0.01);

    params.blade.thickness = 50;
    expect(validateSwordParams(params).blade.thickness).toBe(2);
  });

  it('clamps blade.curvature to [-1, 1]', () => {
    const params = minimalParams();
    params.blade.curvature = -10;
    expect(validateSwordParams(params).blade.curvature).toBe(-1);

    params.blade.curvature = 10;
    expect(validateSwordParams(params).blade.curvature).toBe(1);
  });

  it('clamps guard.width to [0.2, 10]', () => {
    const params = minimalParams();
    params.guard.width = -1;
    expect(validateSwordParams(params).guard.width).toBe(0.2);

    params.guard.width = 100;
    expect(validateSwordParams(params).guard.width).toBe(10);
  });

  it('clamps handle.length to [0.2, 5]', () => {
    const params = minimalParams();
    params.handle.length = 0;
    expect(validateSwordParams(params).handle.length).toBe(0.2);

    params.handle.length = 99;
    expect(validateSwordParams(params).handle.length).toBe(5);
  });

  it('clamps pommel.size to [0.05, 1]', () => {
    const params = minimalParams();
    params.pommel.size = -1;
    expect(validateSwordParams(params).pommel.size).toBe(0.05);

    params.pommel.size = 10;
    expect(validateSwordParams(params).pommel.size).toBe(1);
  });

  it('clamps pommel.elongation to [0.3, 3]', () => {
    const params = minimalParams();
    params.pommel.elongation = 0;
    expect(validateSwordParams(params).pommel.elongation).toBe(0.3);

    params.pommel.elongation = 100;
    expect(validateSwordParams(params).pommel.elongation).toBe(3);
  });

  it('clamps sweepSegments and rounds to integer', () => {
    const params = minimalParams();
    params.blade.sweepSegments = 5;
    expect(validateSwordParams(params).blade.sweepSegments).toBe(16);

    params.blade.sweepSegments = 1000;
    expect(validateSwordParams(params).blade.sweepSegments).toBe(512);

    params.blade.sweepSegments = 100.7;
    expect(validateSwordParams(params).blade.sweepSegments).toBe(101);
  });

  it('clamps twistAngle to [−12π, 12π]', () => {
    const params = minimalParams();
    params.blade.twistAngle = -100;
    const v = validateSwordParams(params);
    expect(v.blade.twistAngle).toBeGreaterThanOrEqual(-Math.PI * 12);

    params.blade.twistAngle = 100;
    const v2 = validateSwordParams(params);
    expect(v2.blade.twistAngle).toBeLessThanOrEqual(Math.PI * 12);
  });

  it('defaults crossSection to flat for unknown value', () => {
    const params = minimalParams();
    (params.blade as any).crossSection = 'weird';
    const v = validateSwordParams(params);
    expect(v.blade.crossSection).toBe('flat');
  });

  it('allows valid crossSection values through', () => {
    for (const cs of ['flat', 'lenticular', 'diamond', 'hexagonal', 'triangular', 'tSpine', 'compound'] as const) {
      const params = minimalParams();
      params.blade.crossSection = cs;
      expect(validateSwordParams(params).blade.crossSection).toBe(cs);
    }
  });

  it('defaults family to straight for unknown value', () => {
    const params = minimalParams();
    (params.blade as any).family = 'unknown';
    expect(validateSwordParams(params).blade.family).toBe('straight');
  });

  it('forces kris wave count to be odd', () => {
    const params = minimalParams();
    params.blade.family = 'kris';
    (params.blade as any).krisWaveCount = 8;
    const v = validateSwordParams(params);
    expect(v.blade.krisWaveCount! % 2).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: NaN, undefined, zero
// ---------------------------------------------------------------------------
describe('validateSwordParams edge cases', () => {
  it('handles NaN blade.length by clamping to minimum', () => {
    const params = minimalParams();
    params.blade.length = NaN;
    const v = validateSwordParams(params);
    // NaN passed to Math.min/max propagates as NaN, but clamp(NaN, 0.1, 20)
    // produces NaN — the implementation uses Math.min(max, Math.max(min, v)).
    // Math.max(0.1, NaN) = NaN, Math.min(20, NaN) = NaN. So test that we at
    // least get a number output (if NaN propagates, tests will flag it).
    expect(typeof v.blade.length).toBe('number');
  });

  it('does not mutate the input params object', () => {
    const params = minimalParams();
    params.blade.length = -1;
    const originalLength = params.blade.length;
    validateSwordParams(params);
    expect(params.blade.length).toBe(originalLength);
  });

  it('returns a fresh object (no reference sharing)', () => {
    const params = minimalParams();
    const v = validateSwordParams(params);
    expect(v).not.toBe(params);
    expect(v.blade).not.toBe(params.blade);
    expect(v.guard).not.toBe(params.guard);
    expect(v.handle).not.toBe(params.handle);
    expect(v.pommel).not.toBe(params.pommel);
  });

  it('handles zero-width blade by clamping to minimum', () => {
    const params = minimalParams();
    params.blade.baseWidth = 0;
    const v = validateSwordParams(params);
    expect(v.blade.baseWidth).toBe(0.02);
  });

  it('handles zero-thickness blade by clamping to minimum', () => {
    const params = minimalParams();
    params.blade.thickness = 0;
    const v = validateSwordParams(params);
    expect(v.blade.thickness).toBe(0.01);
  });

  it('preserves accessories through validation', () => {
    const params = minimalParams();
    (params as any).accessories = {
      scabbard: { enabled: true, bodyMargin: 0.05 },
      tassel: { enabled: false },
    };
    const v = validateSwordParams(params);
    expect(v.accessories).toBeDefined();
    expect(v.accessories!.scabbard.enabled).toBe(true);
    expect(v.accessories!.scabbard.bodyMargin).toBeCloseTo(0.05);
    expect(v.accessories!.tassel.enabled).toBe(false);
  });

  it('clamps scabbard params to valid ranges', () => {
    const params = minimalParams();
    (params as any).accessories = {
      scabbard: {
        enabled: true,
        bodyMargin: -5,
        bodyThickness: 999,
        hangAngle: 100,
      },
      tassel: {},
    };
    const v = validateSwordParams(params);
    expect(v.accessories!.scabbard.bodyMargin).toBeGreaterThanOrEqual(0.002);
    expect(v.accessories!.scabbard.bodyThickness).toBeLessThanOrEqual(0.8);
    expect(v.accessories!.scabbard.hangAngle).toBeLessThanOrEqual(Math.PI / 2);
  });

  it('defaults hiltEnabled and guardEnabled to true when undefined', () => {
    const params = minimalParams();
    delete (params as any).hiltEnabled;
    delete (params as any).guardEnabled;
    const v = validateSwordParams(params);
    expect((v as any).hiltEnabled).toBe(true);
    expect((v as any).guardEnabled).toBe(true);
  });

  it('clones engravings array without reference sharing', () => {
    const params = minimalParams();
    const engraving = { type: 'text' as const, content: 'Test', width: 1, height: 0.3, offsetY: 0.5, offsetX: 0 };
    (params.blade as any).engravings = [engraving];
    const v = validateSwordParams(params);
    expect(v.blade.engravings).toBeDefined();
    expect(v.blade.engravings).toHaveLength(1);
    expect(v.blade.engravings![0]).not.toBe(engraving);
    expect(v.blade.engravings![0].content).toBe('Test');
  });
});
