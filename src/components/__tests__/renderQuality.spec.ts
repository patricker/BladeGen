import { describe, it, expect } from 'vitest';
import { createApplyQualityPreset } from '../renderQuality';

describe('createApplyQualityPreset', () => {
  it('applies Medium preset with FX toggles and registry updates', () => {
    const calls: any[] = [];
    const render = {
      setAAMode: (m: any) => calls.push(['aa', m]),
      setShadowMapSize: (s: any) => calls.push(['shadow', s]),
      setBloom: (e: any, a: any, b: any, c: any) => calls.push(['bloom', e, a, b, c]),
      setOutline: (e: any, s: any, t: any, c: any) => calls.push(['outline', e, s, t, c]),
      setDPRCap: (d: any) => calls.push(['dpr', d]),
      setShadowBias: (b: any) => calls.push(['bias', b]),
    } as any;
    const rstate: any = {
      aaMode: 'fxaa',
      shadowMapSize: 2048,
      qualityPreset: 'Medium',
      bloomEnabled: false,
      bloomStrength: 0.6,
      bloomThreshold: 0.85,
      bloomRadius: 0.2,
    };
    const post: any = {
      outlineEnabled: false,
      outlineStrength: 2.5,
      outlineThickness: 1.0,
      outlineColor: '#ffffff',
    };
    const registry = { setValue: (...args: any[]) => calls.push(['reg', ...args]) };
    const refresh = () => calls.push(['refresh']);
    const apply = createApplyQualityPreset(render, rstate, post, registry as any, refresh, [
      'none',
      'fxaa',
    ]);
    apply('Medium', true);
    // AA and DPR are applied
    expect(calls.find((c) => c[0] === 'aa')).toBeTruthy();
    expect(calls.find((c) => c[0] === 'dpr')).toBeTruthy();
    // Outline and Bloom synced
    expect(calls.filter((c) => c[0] === 'outline').length).toBe(1);
    expect(calls.filter((c) => c[0] === 'bloom').length).toBe(1);
    // Registry updates emitted
    expect(calls.filter((c) => c[0] === 'reg').length).toBeGreaterThan(0);
    // State updated
    expect(rstate.qualityPreset).toBe('Medium');
  });
});
