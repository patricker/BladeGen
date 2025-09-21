import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { defaultSwordParams, SwordGenerator } from '../SwordGenerator'
import { partBounds, vertexCount, totalVertices, groupDescendantsCount, greater, less } from './helpers/metrics'

function makeWithPommel(mutator: (p: ReturnType<typeof defaultSwordParams>) => void): SwordGenerator {
  const p = defaultSwordParams()
  // Keep guard neutral
  p.guard.quillonCount = 0
  ;(p.guard as any).extras = []
  mutator(p)
  return new SwordGenerator(p)
}

describe('Pommel settings affect geometry as expected', () => {
  it('Elongation increases vertical span for orb style', () => {
    const s1 = makeWithPommel((p) => { p.pommel.style = 'orb'; p.pommel.size = 0.16; p.pommel.elongation = 1.0 })
    const s2 = makeWithPommel((p) => { p.pommel.style = 'orb'; p.pommel.size = 0.16; p.pommel.elongation = 1.8 })
    const b1 = partBounds(s1, 'pommel')!
    const b2 = partBounds(s2, 'pommel')!
    expect(greater(b2.size.y, b1.size.y)).toBe(true)
  })

  it('Spike style with higher spikeLength increases vertical span', () => {
    const s1 = makeWithPommel((p) => { p.pommel.style = 'spike'; p.pommel.spikeLength = 0.8; p.pommel.size = 0.16 })
    const s2 = makeWithPommel((p) => { p.pommel.style = 'spike'; p.pommel.spikeLength = 1.6; p.pommel.size = 0.16 })
    const b1 = partBounds(s1, 'pommel')!
    const b2 = partBounds(s2, 'pommel')!
    expect(greater(b2.size.y, b1.size.y)).toBe(true)
  })

  it('ShapeMorph increases X span for orb style', () => {
    const sA = makeWithPommel((p) => { p.pommel.style = 'orb'; p.pommel.shapeMorph = 0.1 })
    const sB = makeWithPommel((p) => { p.pommel.style = 'orb'; p.pommel.shapeMorph = 0.9 })
    const bA = partBounds(sA, 'pommel')!
    const bB = partBounds(sB, 'pommel')!
    expect(greater(bB.size.x, bA.size.x)).toBe(true)
  })

  it('Fishtail shapeMorph increases X span', () => {
    const sA = makeWithPommel((p) => { p.pommel.style = 'fishtail'; p.pommel.shapeMorph = 0.1 })
    const sB = makeWithPommel((p) => { p.pommel.style = 'fishtail'; p.pommel.shapeMorph = 0.9 })
    const bA = partBounds(sA, 'pommel')!
    const bB = partBounds(sB, 'pommel')!
    expect(greater(bB.size.x, bA.size.x)).toBe(true)
  })

  it('Offsets move pommel center (X/Y)', () => {
    const base = makeWithPommel((p) => { p.pommel.offsetX = 0; p.pommel.offsetY = 0 })
    const off = makeWithPommel((p) => { p.pommel.offsetX = 0.05; p.pommel.offsetY = 0.07 })
    const b0 = partBounds(base, 'pommel')!
    const b1 = partBounds(off, 'pommel')!
    const c0x = (b0.min.x + b0.max.x) * 0.5
    const c0y = (b0.min.y + b0.max.y) * 0.5
    const c1x = (b1.min.x + b1.max.x) * 0.5
    const c1y = (b1.min.y + b1.max.y) * 0.5
    expect(greater(c1x - c0x, 0.04)).toBe(true)
    expect(greater(c1y - c0y, 0.05)).toBe(true)
  })

  it('facetCount increases vertex count for orb style', () => {
    const sL = makeWithPommel((p) => { p.pommel.style = 'orb'; p.pommel.facetCount = 16 })
    const sH = makeWithPommel((p) => { p.pommel.style = 'orb'; p.pommel.facetCount = 64 })
    const vL = vertexCount(sL.pommelMesh)
    const vH = vertexCount(sH.pommelMesh)
    expect(greater(vH, vL)).toBe(true)
  })

  it('Balance (auto) changes size vs fixed with defaults', () => {
    const fixed = makeWithPommel((p) => { p.pommel.style = 'orb'; p.pommel.size = 0.16; p.pommel.balance = 0 })
    const auto = makeWithPommel((p) => { p.pommel.style = 'orb'; p.pommel.size = 0.16; p.pommel.balance = 1 })
    const b0 = partBounds(fixed, 'pommel')!
    const b1 = partBounds(auto, 'pommel')!
    const sum0 = b0.size.x + b0.size.y + b0.size.z
    const sum1 = b1.size.x + b1.size.y + b1.size.z
    expect(Math.abs(sum1 - sum0)).toBeGreaterThan(1e-6)
  })

  it('Ring inner radius increases X span', () => {
    const s1 = makeWithPommel((p) => { p.pommel.style = 'ring'; (p.pommel as any).ringInnerRadius = 0.05; p.pommel.size = 0.16 })
    const s2 = makeWithPommel((p) => { p.pommel.style = 'ring'; (p.pommel as any).ringInnerRadius = 0.12; p.pommel.size = 0.16 })
    const b1 = partBounds(s1, 'pommel')!
    const b2 = partBounds(s2, 'pommel')!
    expect(greater(b2.size.x, b1.size.x)).toBe(true)
  })

  it('Crown spikes increase vertex count', () => {
    const sL = makeWithPommel((p) => { p.pommel.style = 'crown'; (p.pommel as any).crownSpikes = 6; (p.pommel as any).crownSharpness = 0.4 })
    const sH = makeWithPommel((p) => { p.pommel.style = 'crown'; (p.pommel as any).crownSpikes = 24; (p.pommel as any).crownSharpness = 0.4 })
    const vL = vertexCount(sL.pommelMesh)
    const vH = vertexCount(sH.pommelMesh)
    expect(greater(vH, vL)).toBe(true)
  })

  it('Peen visible adds a child to the pommel (non-ring)', () => {
    const s0 = makeWithPommel((p) => { p.pommel.style = 'disk'; (p.pommel as any).peenVisible = false })
    const s1 = makeWithPommel((p) => { p.pommel.style = 'disk'; (p.pommel as any).peenVisible = true; (p.pommel as any).peenSize = 0.03; (p.pommel as any).peenShape = 'dome' })
    const c0 = groupDescendantsCount(s0.pommelMesh)
    const c1 = groupDescendantsCount(s1.pommelMesh)
    expect(c1).toBeGreaterThan(c0)
  })
})
