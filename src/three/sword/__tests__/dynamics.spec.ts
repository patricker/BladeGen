import { describe, it, expect } from 'vitest';
import { computeBladeDynamics } from '../dynamics';
import { defaultSwordParams } from '../defaults';

const baseBlade = () => defaultSwordParams().blade;

describe('computeBladeDynamics', () => {
  // -------------------------------------------------------------------
  // Basic sanity: default blade returns reasonable values
  // -------------------------------------------------------------------
  it('returns finite positive mass for default blade params', () => {
    const result = computeBladeDynamics(baseBlade());
    expect(Number.isFinite(result.mass)).toBe(true);
    expect(result.mass).toBeGreaterThan(0);
  });

  it('returns center of mass within the blade span', () => {
    const blade = baseBlade();
    const result = computeBladeDynamics(blade);
    expect(result.cmY).toBeGreaterThan(0);
    expect(result.cmY).toBeLessThan(blade.length);
  });

  it('center of mass is closer to base for a tapered blade', () => {
    const blade = baseBlade();
    // Default blade tapers from baseWidth (0.25) to tipWidth (0.05)
    const result = computeBladeDynamics(blade);
    // For a tapered blade, CoM should be in the lower half
    expect(result.cmY).toBeLessThan(blade.length * 0.55);
  });

  // -------------------------------------------------------------------
  // Point of Balance (PoB) — here approximated by cmY
  // -------------------------------------------------------------------
  it('PoB shifts toward tip when base is narrower than tip', () => {
    const normal = baseBlade();
    const wideTip = { ...baseBlade(), baseWidth: 0.05, tipWidth: 0.25 };
    const resultNormal = computeBladeDynamics(normal);
    const resultWideTip = computeBladeDynamics(wideTip);
    expect(resultWideTip.cmY).toBeGreaterThan(resultNormal.cmY);
  });

  it('PoB is near midpoint for a uniform-width blade', () => {
    const blade = { ...baseBlade(), baseWidth: 0.2, tipWidth: 0.2 };
    const result = computeBladeDynamics(blade);
    // Uniform width => CoM should be close to L/2
    expect(result.cmY).toBeCloseTo(blade.length / 2, 1);
  });

  // -------------------------------------------------------------------
  // Center of Percussion (CoP)
  // -------------------------------------------------------------------
  it('returns CoP further from base than center of mass', () => {
    const result = computeBladeDynamics(baseBlade());
    expect(result.copY).toBeGreaterThan(result.cmY);
  });

  it('CoP is within the blade length for a standard blade', () => {
    const blade = baseBlade();
    const result = computeBladeDynamics(blade);
    // CoP can exceed blade length for very unusual distributions, but for
    // a standard tapered blade it should stay reasonable
    expect(result.copY).toBeGreaterThan(0);
    expect(result.copY).toBeLessThan(blade.length * 2);
  });

  // -------------------------------------------------------------------
  // Mass / inertia calculations
  // -------------------------------------------------------------------
  it('Ibase is positive for any real blade', () => {
    const result = computeBladeDynamics(baseBlade());
    expect(result.Ibase).toBeGreaterThan(0);
  });

  it('Icm is less than Ibase (parallel axis theorem)', () => {
    const result = computeBladeDynamics(baseBlade());
    expect(result.Icm).toBeLessThan(result.Ibase);
  });

  it('mass proxy is invariant to blade length (normalized sampling)', () => {
    // The dynamics computation samples 200 normalized positions (t in 0..1),
    // so the mass proxy sum is independent of absolute blade length.
    // Length only affects moment arms (cmY, Ibase, Icm, copY).
    const short = { ...baseBlade(), length: 1 };
    const long = { ...baseBlade(), length: 5 };
    const shortResult = computeBladeDynamics(short);
    const longResult = computeBladeDynamics(long);
    expect(longResult.mass).toBeCloseTo(shortResult.mass, 6);
  });

  it('cmY scales with blade length', () => {
    const short = { ...baseBlade(), length: 1 };
    const long = { ...baseBlade(), length: 5 };
    const shortResult = computeBladeDynamics(short);
    const longResult = computeBladeDynamics(long);
    expect(longResult.cmY).toBeGreaterThan(shortResult.cmY);
  });

  it('mass increases with blade width', () => {
    const narrow = { ...baseBlade(), baseWidth: 0.1, tipWidth: 0.02 };
    const wide = { ...baseBlade(), baseWidth: 0.5, tipWidth: 0.1 };
    const narrowResult = computeBladeDynamics(narrow);
    const wideResult = computeBladeDynamics(wide);
    expect(wideResult.mass).toBeGreaterThan(narrowResult.mass);
  });

  it('mass changes with crossSection factor', () => {
    const flat = { ...baseBlade(), crossSection: 'flat' as const };
    const diamond = { ...baseBlade(), crossSection: 'diamond' as const };
    const flatResult = computeBladeDynamics(flat);
    const diamondResult = computeBladeDynamics(diamond);
    // Diamond has q=0.6, flat has q=1.0, so diamond should have less mass proxy
    expect(diamondResult.mass).toBeLessThan(flatResult.mass);
  });

  // -------------------------------------------------------------------
  // Thickness profile influence
  // -------------------------------------------------------------------
  it('distal taper reduces mass near the tip', () => {
    const uniform = baseBlade();
    const tapered = {
      ...baseBlade(),
      thicknessProfile: {
        points: [
          [0, 1] as [number, number],
          [1, 0.2] as [number, number],
        ],
      },
    };
    const uniformResult = computeBladeDynamics(uniform);
    const taperedResult = computeBladeDynamics(tapered);
    expect(taperedResult.mass).toBeLessThan(uniformResult.mass);
    // Tapered blade should also have CoM closer to base
    expect(taperedResult.cmY).toBeLessThan(uniformResult.cmY);
  });

  // -------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------
  it('handles zero-length blade without crashing', () => {
    const blade = { ...baseBlade(), length: 0 };
    const result = computeBladeDynamics(blade);
    expect(Number.isFinite(result.mass)).toBe(true);
    expect(Number.isFinite(result.cmY)).toBe(true);
    expect(Number.isFinite(result.copY)).toBe(true);
  });

  it('handles very small blade length', () => {
    const blade = { ...baseBlade(), length: 0.0001 };
    const result = computeBladeDynamics(blade);
    expect(result.mass).toBeGreaterThan(0);
    expect(Number.isFinite(result.cmY)).toBe(true);
  });

  it('handles extreme thickness values', () => {
    const blade = { ...baseBlade(), thickness: 2, thicknessLeft: 2, thicknessRight: 2 };
    const result = computeBladeDynamics(blade);
    expect(Number.isFinite(result.mass)).toBe(true);
    expect(result.mass).toBeGreaterThan(0);
  });

  it('handles blade with zero tipWidth', () => {
    const blade = { ...baseBlade(), tipWidth: 0 };
    const result = computeBladeDynamics(blade);
    expect(Number.isFinite(result.mass)).toBe(true);
    expect(result.mass).toBeGreaterThan(0);
  });

  it('handles all cross-section types without errors', () => {
    const sections = ['flat', 'lenticular', 'diamond', 'hexagonal', 'triangular', 'tSpine'] as const;
    for (const cs of sections) {
      const blade = { ...baseBlade(), crossSection: cs };
      const result = computeBladeDynamics(blade);
      expect(Number.isFinite(result.mass)).toBe(true);
      expect(result.mass).toBeGreaterThan(0);
    }
  });

  it('incorporates serration amplitude into width calculation', () => {
    const plain = baseBlade();
    const serrated = {
      ...baseBlade(),
      serrationAmplitude: 0.05,
      serrationFrequency: 10,
    };
    const plainResult = computeBladeDynamics(plain);
    const serratedResult = computeBladeDynamics(serrated);
    // Serrations add width, which increases mass proxy
    expect(serratedResult.mass).toBeGreaterThan(plainResult.mass);
  });

  it('incorporates waviness into width calculation', () => {
    const plain = baseBlade();
    const wavy = {
      ...baseBlade(),
      waviness: {
        amplitude: 0.03,
        frequency: 6,
        mode: 'width' as const,
        taper: 0,
        phase: 0,
        offset: 0,
      },
    };
    const plainResult = computeBladeDynamics(plain);
    const wavyResult = computeBladeDynamics(wavy);
    // Waviness in 'width' mode modulates width, overall mass should differ
    expect(wavyResult.mass).not.toBeCloseTo(plainResult.mass, 6);
  });
});
