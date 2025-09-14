import { describe, it, expect } from 'vitest'
import { defaultSwordParams } from '../../three/sword/defaults'
import { validateSwordParams } from '../../three/sword/validation'

describe('defaults + validation', () => {
  it('produces sane default params', () => {
    const p = defaultSwordParams()
    expect(p.blade.length).toBeGreaterThan(0)
    expect(p.guard.width).toBeGreaterThan(0)
    expect(p.handle.length).toBeGreaterThan(0)
    expect(p.pommel.size).toBeGreaterThan(0)
  })

  it('clamps and normalizes inputs', () => {
    const bad = {
      blade: { length: -1, baseWidth: -2, tipWidth: -5, thickness: 0, curvature: 10 },
      guard: { width: -1, thickness: -2, curve: 10, tilt: 10, style: 'bar' },
      handle: { length: -2, radiusTop: -1, radiusBottom: -1, segmentation: false },
      pommel: { size: -1, elongation: -3, style: 'orb', shapeMorph: 3, offsetX: 10, offsetY: -10 }
    } as any
    const v = validateSwordParams(bad)
    expect(v.blade.length).toBeGreaterThan(0)
    expect(v.blade.baseWidth).toBeGreaterThan(0)
    expect(v.blade.tipWidth).toBeGreaterThanOrEqual(0)
    expect(v.guard.width).toBeGreaterThan(0)
    expect(v.handle.length).toBeGreaterThan(0)
    expect(v.pommel.size).toBeGreaterThan(0)
  })
})

