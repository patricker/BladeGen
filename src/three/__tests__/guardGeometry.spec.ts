import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import { buildGuard } from '../../three/sword/guardGeometry'

const mm = () => new THREE.MeshStandardMaterial()

describe('guardGeometry', () => {
  it('builds a bar guard mesh at target Y', () => {
    const { guardMesh } = buildGuard({ width: 1.0, thickness: 0.2, curve: 0, tilt: 0, style: 'bar' }, { makeMaterial: ()=>mm() })
    expect(guardMesh).toBeTruthy()
    expect(guardMesh!.position.y).toBeLessThanOrEqual(0)
  })

  it('builds a disk guard mesh with rotation', () => {
    const { guardMesh } = buildGuard({ width: 1.0, thickness: 0.2, curve: 0, tilt: 0.2, style: 'disk', cutoutCount: 3, curveSegments: 8 }, { makeMaterial: ()=>mm() })
    expect(guardMesh).toBeTruthy()
    expect(Math.abs(guardMesh!.rotation.z - 0.2)).toBeLessThan(1e-3)
  })

  it('builds a swept/basket style as group', () => {
    const swept = buildGuard({ width: 1.2, thickness: 0.2, curve: 0.2, tilt: 0, style: 'swept' } as any, { makeMaterial: ()=>mm() })
    const basket = buildGuard({ width: 1.2, thickness: 0.2, curve: 0.2, tilt: 0, style: 'basket', ornamentation: 0.5 } as any, { makeMaterial: ()=>mm() })
    expect(swept.guardGroup || swept.guardMesh).toBeTruthy()
    expect(basket.guardGroup || basket.guardMesh).toBeTruthy()
  })
})

