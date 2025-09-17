import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import { buildPommel } from '../../three/sword/pommelGeometry'

const mat = () => new THREE.MeshStandardMaterial()

describe('pommelGeometry', () => {
  it('builds orb and spike variants with placement below handle', () => {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,1,8), mat())
    handle.position.y = -0.5
    const orb = buildPommel({ size: 0.2, elongation: 1, style: 'orb', shapeMorph: 0.2, offsetX: 0, offsetY: 0 }, { handleMesh: handle, blade: null }, ()=>mat())
    const spike = buildPommel({ size: 0.2, elongation: 1, style: 'spike', shapeMorph: 0.2, spikeLength: 1, offsetX: 0, offsetY: 0 }, { handleMesh: handle, blade: null }, ()=>mat())
    expect(orb.position.y).toBeLessThan(handle.position.y)
    expect(spike.position.y).toBeLessThan(handle.position.y)
  })

  it('creates fishtail pommel with pronounced lateral flare', () => {
    const pommel = buildPommel({ size: 0.2, elongation: 1, style: 'fishtail', shapeMorph: 0.4, offsetX: 0, offsetY: 0 }, { handleMesh: undefined, blade: null }, ()=>mat())
    const box = new THREE.Box3().setFromObject(pommel)
    const spanX = box.max.x - box.min.x
    const spanZ = box.max.z - box.min.z
    expect(spanX).toBeGreaterThan(spanZ)
  })

  it('adds peen decoration when enabled', () => {
    const pommel = buildPommel({ size: 0.2, elongation: 1, style: 'disk', shapeMorph: 0.2, offsetX: 0, offsetY: 0, peenVisible: true, peenSize: 0.02, peenShape: 'block' } as any, { handleMesh: undefined, blade: null }, ()=>mat())
    expect(pommel.children.length).toBeGreaterThan(0)
  })
})
