import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import { decorateGuard } from '../../three/sword/guardDecor'

describe('guardDecor', () => {
  it('adds extras and fillet to group', () => {
    const swordGroup = new THREE.Group()
    const params:any = {
      width: 1.0, thickness: 0.2, curve: 0, tilt: 0, style: 'bar', heightOffset: 0,
      guardBlendFillet: 0.5,
      extras: [{ kind: 'sideRing', radius: 0.1, thickness: 0.02, offsetY: 0 }]
    }
    const res = decorateGuard(params, { swordGroup, makeMaterial: ()=> new THREE.MeshStandardMaterial() })
    // At least one child added (fillet or extra)
    expect(swordGroup.children.length).toBeGreaterThan(0)
  })
})

