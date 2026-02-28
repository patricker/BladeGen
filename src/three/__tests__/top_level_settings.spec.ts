import { describe, it, expect } from 'vitest';
import { defaultSwordParams, SwordGenerator } from '../SwordGenerator';
import { partBounds, greater } from './helpers/metrics';

describe('Top-level toggles and ratios', () => {
  it('hiltEnabled=false removes guard, handle, and pommel', () => {
    const p = defaultSwordParams();
    p.hiltEnabled = false;
    const s = new SwordGenerator(p);
    expect(s.guardMesh ?? (s as any).guardGroup).toBeNull();
    expect(s.handleMesh ?? (s as any).handleGroup).toBeNull();
    expect(s.pommelMesh).toBeNull();
  });

  it('guardEnabled=false removes guard only', () => {
    const p = defaultSwordParams();
    p.hiltEnabled = true;
    p.guardEnabled = false;
    const s = new SwordGenerator(p);
    expect(s.guardMesh ?? (s as any).guardGroup).toBeNull();
    expect(s.handleMesh ?? (s as any).handleGroup).not.toBeNull();
    expect(s.pommelMesh).not.toBeNull();
  });

  it('useRatios scales guard width, handle length, and pommel size with blade length', () => {
    const base = defaultSwordParams();
    // Make guard style bar for direct width mapping
    base.guard.style = 'bar';
    base.hiltEnabled = true;
    const s0 = new SwordGenerator(base);
    const b0g = partBounds(s0, 'guard')!;
    const b0h = partBounds(s0, 'handle')!;
    const b0p = partBounds(s0, 'pommel')!;
    const baseGuardW = b0g.size.x;
    const baseHandleL = b0h.size.y;
    const basePomSize = b0p.size.x + b0p.size.y + b0p.size.z;

    const p = defaultSwordParams();
    p.blade.length = 4.0;
    p.guard.style = 'bar';
    p.useRatios = true;
    p.ratios = { guardWidthToBlade: 0.4, handleLengthToBlade: 0.3, pommelSizeToBlade: 0.06 };
    const s1 = new SwordGenerator(p);
    const b1g = partBounds(s1, 'guard')!;
    const b1h = partBounds(s1, 'handle')!;
    const b1p = partBounds(s1, 'pommel')!;
    expect(greater(b1g.size.x, baseGuardW)).toBe(true);
    expect(greater(b1h.size.y, baseHandleL)).toBe(true);
    expect(greater(b1p.size.x + b1p.size.y + b1p.size.z, basePomSize)).toBe(true);
    // Guard width should approximately match ratio * blade length for bar
    expect(Math.abs(b1g.size.x - p.ratios!.guardWidthToBlade! * p.blade.length) < 0.05).toBe(true);
    // Handle length should approximately match ratio * blade length
    expect(Math.abs(b1h.size.y - p.ratios!.handleLengthToBlade! * p.blade.length) < 0.1).toBe(true);
  });
});
