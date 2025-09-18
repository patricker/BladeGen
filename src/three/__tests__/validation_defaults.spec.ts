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

  it('populates menuki preset and sanitizes rayskin/peen fields', () => {
    const base = defaultSwordParams()
    base.handle.menuki = undefined
    ;(base.handle as any).menukiPreset = 'katana'
    ;(base.handle as any).rayskin = { enabled: true, scale: 0.2, intensity: -1 }
    ;(base.pommel as any).peenVisible = true
    ;(base.pommel as any).peenSize = 0.4
    ;(base.pommel as any).peenShape = 'block'
    const v = validateSwordParams(base)
    expect(v.handle.menuki?.length).toBe(2)
    expect(v.handle.menuki?.[0].side).toBeDefined()
    expect(v.handle.rayskin?.scale).toBeLessThanOrEqual(0.05)
    expect(v.pommel.peenVisible).toBe(true)
    expect(v.pommel.peenSize).toBeLessThanOrEqual(0.1)
  })

  it('applies blade family presets for waviness', () => {
    const flamberge = defaultSwordParams()
    flamberge.blade.family = 'flamberge'
    delete (flamberge.blade as any).waviness
    const vf = validateSwordParams(flamberge)
    expect(vf.blade.family).toBe('flamberge')
    expect(vf.blade.waviness).toBeTruthy()
    expect(vf.blade.waviness?.mode).toBe('both')
    expect(vf.blade.waviness?.frequency).toBeGreaterThan(2)

    const kris = defaultSwordParams()
    kris.blade.family = 'kris'
    ;(kris.blade as any).krisWaveCount = 10
    delete (kris.blade as any).waviness
    const vk = validateSwordParams(kris)
    expect(vk.blade.family).toBe('kris')
    expect(vk.blade.krisWaveCount).toBeDefined()
    expect((vk.blade.krisWaveCount ?? 0) % 2).toBe(1)
    expect(vk.blade.waviness?.mode).toBe('centerline')
    expect(vk.blade.waviness?.frequency).toBe(vk.blade.krisWaveCount)
  })

  it('sanitizes per-face fuller configuration', () => {
    const params = defaultSwordParams()
    params.blade.fullerFaces = {
      left: [
        { width: 0.04, offsetFromSpine: -0.03, taper: 0.25 },
        null as any,
        { width: 0.02, offsetFromSpine: -0.05, taper: 0 }
      ],
      right: [
        { width: 0.04, offsetFromSpine: 0.03, taper: 0.1 },
        { width: 0.02, offsetFromSpine: 0.05, taper: 0.5 }
      ]
    }
    const validated = validateSwordParams(params)
    expect(validated.blade.fullerEnabled).toBe(true)
    expect(validated.blade.fullers).toBeTruthy()
    expect(validated.blade.fullers?.length).toBe(4)
    expect(validated.blade.fullers?.every((slot) => slot.side === 'left' || slot.side === 'right')).toBe(true)
    expect(validated.blade.fullerFaces?.left?.length).toBe(2)
    expect(validated.blade.fullerFaces?.right?.length).toBe(2)
  })
})
