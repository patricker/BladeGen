import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import { SwordGenerator, defaultSwordParams, type SwordParams } from '../three/SwordGenerator'

function make(patch?: (p: SwordParams) => void) {
  const p = defaultSwordParams()
  patch?.(p)
  const sword = new SwordGenerator(p)
  return sword
}

function bboxOf(obj: THREE.Object3D | null | undefined) {
  const b = new THREE.Box3()
  if (!obj) return b.makeEmpty()
  return b.setFromObject(obj)
}

function span(b: THREE.Box3, axis: 'x'|'y'|'z') {
  if (axis === 'x') return (b.max.x - b.min.x)
  if (axis === 'y') return (b.max.y - b.min.y)
  return (b.max.z - b.min.z)
}

function approx(a: number, b: number, eps = 1e-3) {
  return Math.abs(a - b) <= eps
}

describe('Blade geometry knobs', () => {
  it('blade length sets Y span', () => {
    const L = 4.2
    const s = make(p => { p.blade.length = L })
    const bb = bboxOf(s.bladeMesh)
    expect(approx(span(bb,'y'), L, 1e-2)).toBe(true)
  })

  it('baseWidth increases base cross-section width', () => {
    const s0 = make(p => { p.blade.baseWidth = 0.20; p.blade.tipWidth = 0.05 })
    const s1 = make(p => { p.blade.baseWidth = 0.40; p.blade.tipWidth = 0.05 })
    // measure width near base by sampling vertices within 2% of minY
    const widthNearBase = (s: SwordGenerator) => {
      const g = s.bladeMesh!.geometry as THREE.BufferGeometry
      const pos = g.getAttribute('position') as THREE.BufferAttribute
      const arr = pos.array as unknown as number[]
      let minY = Infinity; for (let i=1;i<arr.length;i+=3) minY = Math.min(minY, arr[i])
      const tol = Math.max(1e-4, (s.lastParams?.blade.length ?? 1) * 0.02)
      let minX = Infinity, maxX = -Infinity
      for (let i=0;i<arr.length;i+=3) {
        const y = arr[i+1]
        if (y <= minY + tol) {
          const x = arr[i]
          if (x < minX) minX = x
          if (x > maxX) maxX = x
        }
      }
      return maxX - minX
    }
    const w0 = widthNearBase(s0)
    const w1 = widthNearBase(s1)
    expect(w1).toBeGreaterThan(w0)
  })

  it('tipWidth increases overall X span when larger than base', () => {
    const s0 = make(p => { p.blade.baseWidth = 0.25; p.blade.tipWidth = 0.02 })
    const s1 = make(p => { p.blade.baseWidth = 0.25; p.blade.tipWidth = 0.25 })
    const b0 = bboxOf(s0.bladeMesh)
    const b1 = bboxOf(s1.bladeMesh)
    expect(span(b1,'x')).toBeGreaterThanOrEqual(span(b0,'x'))
  })

  it('thicknessLeft/Right increase Z thickness', () => {
    const s0 = make(p => { p.blade.thicknessLeft = 0.04; p.blade.thicknessRight = 0.04 })
    const s1 = make(p => { p.blade.thicknessLeft = 0.20; p.blade.thicknessRight = 0.20 })
    const z0 = span(bboxOf(s0.bladeMesh), 'z')
    const z1 = span(bboxOf(s1.bladeMesh), 'z')
    expect(z1).toBeGreaterThan(z0)
  })

  it('sweepSegments increases vertex/face counts', () => {
    const s0 = make(p => { p.blade.sweepSegments = 32 })
    const s1 = make(p => { p.blade.sweepSegments = 256 })
    const g0 = s0.bladeMesh!.geometry as THREE.BufferGeometry
    const g1 = s1.bladeMesh!.geometry as THREE.BufferGeometry
    expect((g1.getAttribute('position') as THREE.BufferAttribute).count)
      .toBeGreaterThan((g0.getAttribute('position') as THREE.BufferAttribute).count)
    expect((g1.getIndex()!.count)).toBeGreaterThan((g0.getIndex()!.count))
  })

  it('twistAngle increases Z span', () => {
    const s0 = make(p => { p.blade.twistAngle = 0 })
    const s1 = make(p => { p.blade.twistAngle = Math.PI / 2 })
    const z0 = span(bboxOf(s0.bladeMesh), 'z')
    const z1 = span(bboxOf(s1.bladeMesh), 'z')
    expect(z1).toBeGreaterThan(z0)
  })

  it('leaf tip with bulge is wider at mid', () => {
    const base = (p: SwordParams) => { p.blade.length = 3; p.blade.baseWidth = 0.2; p.blade.tipWidth = 0.1 }
    const sPoint = make(p => { base(p); p.blade.tipShape = 'pointed'; p.blade.tipBulge = 0.0 })
    const sLeaf = make(p => { base(p); p.blade.tipShape = 'leaf'; p.blade.tipBulge = 0.6 })
    const midWidth = (s: SwordGenerator) => {
      const g = s.bladeMesh!.geometry as THREE.BufferGeometry
      const pos = g.getAttribute('position') as THREE.BufferAttribute
      const arr = pos.array as unknown as number[]
      // sample around mid Y
      let minY = Infinity, maxY = -Infinity
      for (let i=1;i<arr.length;i+=3) { const y=arr[i]; if (y<minY) minY=y; if (y>maxY) maxY=y }
      const midY = (minY + maxY) / 2
      const tol = (maxY - minY) * 0.02
      let minX = Infinity, maxX = -Infinity
      for (let i=0;i<arr.length;i+=3) {
        const y = arr[i+1]
        if (Math.abs(y - midY) <= tol) {
          const x = arr[i]
          if (x < minX) minX = x
          if (x > maxX) maxX = x
        }
      }
      return maxX - minX
    }
    expect(midWidth(sLeaf)).toBeGreaterThan(midWidth(sPoint))
  })

  it('curvature and baseAngle bend X at mid', () => {
    const sCurved = make(p => { p.blade.curvature = 0.3; p.blade.baseAngle = 0 })
    const sAngled = make(p => { p.blade.curvature = 0; p.blade.baseAngle = 0.1 })
    const meanX = (s: SwordGenerator) => {
      const g = s.bladeMesh!.geometry as THREE.BufferGeometry
      const pos = g.getAttribute('position') as THREE.BufferAttribute
      const arr = pos.array as unknown as number[]
      let minY = Infinity, maxY = -Infinity
      for (let i=1;i<arr.length;i+=3) { const y=arr[i]; if (y<minY) minY=y; if (y>maxY) maxY=y }
      const midY = (minY + maxY) * 0.5
      const tol = (maxY - minY) * 0.02
      let sum = 0, cnt = 0
      for (let i=0;i<arr.length;i+=3) {
        const y = arr[i+1]
        if (Math.abs(y - midY) <= tol) { sum += arr[i]; cnt++ }
      }
      return cnt ? sum / cnt : 0
    }
    expect(meanX(sCurved)).toBeLessThan(0) // positive curvature bends negative X by implementation
    expect(meanX(sAngled)).toBeGreaterThan(0)
  })

  it('crossSection + bevel increase thickness mid-width (lenticular > diamond > hex)', () => {
    const base = (p: SwordParams) => { p.blade.length = 3; p.blade.baseWidth = 0.24; p.blade.tipWidth = 0.12; p.blade.thicknessLeft = 0.08; p.blade.thicknessRight = 0.08; (p.blade as any).bevel = 1.0; p.blade.curvature = 0 }
    const mk = (cs: 'diamond'|'lenticular'|'hexagonal') => make(p => { base(p); (p.blade as any).crossSection = cs })
    const thicknessAtHalfWidth = (s: SwordGenerator) => {
      const g = s.bladeMesh!.geometry as THREE.BufferGeometry
      const pos = g.getAttribute('position') as THREE.BufferAttribute
      const arr = pos.array as unknown as number[]
      // mid Y
      let minY = Infinity, maxY = -Infinity
      for (let i=1;i<arr.length;i+=3) { const y=arr[i]; if (y<minY) minY=y; if (y>maxY) maxY=y }
      const midY = (minY+maxY)/2, tolY = (maxY-minY)*0.02
      // mean X and half width at midY
      let minX=Infinity, maxX=-Infinity, sumX=0, cnt=0
      for (let i=0;i<arr.length;i+=3) { const y=arr[i+1]; if (Math.abs(y-midY)<=tolY) { const x=arr[i]; sumX+=x; cnt++; if (x<minX) minX=x; if (x>maxX) maxX=x } }
      const meanX = cnt? sumX/cnt : 0
      const halfW = Math.max(Math.abs(maxX-meanX), Math.abs(meanX-minX))
      const target = halfW * 0.5
      const tolX = halfW * 0.2
      let minZ=Infinity, maxZ=-Infinity
      for (let i=0;i<arr.length;i+=3) {
        const y = arr[i+1], x = arr[i]
        if (Math.abs(y-midY)<=tolY && Math.abs(Math.abs(x-meanX) - target) <= tolX) {
          const z = arr[i+2]
          if (z<minZ) minZ=z; if (z>maxZ) maxZ=z
        }
      }
      return maxZ - minZ
    }
    const d = mk('diamond'), l = mk('lenticular'), h = mk('hexagonal')
    const zD = thicknessAtHalfWidth(d), zL = thicknessAtHalfWidth(l), zH = thicknessAtHalfWidth(h)
    expect(zL).toBeGreaterThan(zD)
    expect(zD).toBeGreaterThan(zH)
  })

  it('soriProfile + soriBias shift bend along length (koshi vs saki)', () => {
    const curvature = 0.6
    const base = (p: SwordParams) => { p.blade.length=3; p.blade.curvature=curvature; (p.blade as any).soriBias = 0.8; (p.blade as any).baseAngle = 0 }
    const koshi = make(p => { base(p); (p.blade as any).soriProfile='koshi' })
    const saki  = make(p => { base(p); (p.blade as any).soriProfile='saki' })
    const bendAt = (s: SwordGenerator, frac: number) => {
      const g = s.bladeMesh!.geometry as THREE.BufferGeometry
      const pos = g.getAttribute('position') as THREE.BufferAttribute
      const arr = pos.array as unknown as number[]
      let minY=Infinity, maxY=-Infinity
      for (let i=1;i<arr.length;i+=3) { const y=arr[i]; if (y<minY) minY=y; if (y>maxY) maxY=y }
      const yT = minY + (maxY-minY)*frac
      const tol = (maxY-minY)*0.01
      let sum=0, cnt=0
      for (let i=0;i<arr.length;i+=3) {
        const y = arr[i+1]
        if (Math.abs(y-yT) <= tol) { sum += arr[i]; cnt++ }
      }
      return Math.abs(cnt? sum/cnt : 0)
    }
    // near base (25%): koshi > saki
    expect(bendAt(koshi, 0.25)).toBeGreaterThan(bendAt(saki, 0.25))
    // near tip (75%): saki > koshi
    expect(bendAt(saki, 0.75)).toBeGreaterThan(bendAt(koshi, 0.75))
  })
})

describe('Guard knobs', () => {
  it('bar width maps to X span', () => {
    const s = make(p => { p.guard.style = 'bar'; p.guard.width = 1.5; p.guard.thickness = 0.2 })
    const bb = bboxOf(s.guardMesh)
    expect(approx(span(bb,'x'), 1.5, 1e-3)).toBe(true)
  })

  it('disk tilt sets guardMesh rotation.z', () => {
    const tilt = 0.3
    const s = make(p => { p.guard.style = 'disk'; p.guard.tilt = tilt; p.guard.width = 0.4; p.guard.thickness = 0.1 })
    expect(approx(s.guardMesh!.rotation.z, tilt, 1e-6)).toBe(true)
  })

  it('winged/claw tilt sets group rotation.z', () => {
    const tilt = -0.25
    const s = make(p => { p.guard.style = 'winged'; p.guard.tilt = tilt })
    const group = (s as any).guardGroup as THREE.Group
    expect(group).toBeTruthy()
    expect(approx(group.rotation.z, tilt, 1e-6)).toBe(true)
  })

  it('disk thickness affects Y span (clamped)', () => {
    const sThin = make(p => { p.guard.style = 'disk'; p.guard.thickness = 0.01; p.guard.width = 0.4 })
    const sThick = make(p => { p.guard.style = 'disk'; p.guard.thickness = 0.5; p.guard.width = 0.4 })
    const yThin = span(bboxOf(sThin.guardMesh), 'y')
    const yThick = span(bboxOf(sThick.guardMesh), 'y')
    // clamp range is [0.04, 0.2]
    expect(yThin).toBeLessThanOrEqual(0.2)
    expect(yThick).toBeGreaterThan(yThin)
  })

  it('winged curveSegments increases polygon count', () => {
    const s0 = make(p => { p.guard.style = 'winged'; (p.guard as any).curveSegments = 6 })
    const s1 = make(p => { p.guard.style = 'winged'; (p.guard as any).curveSegments = 32 })
    const g0Group = (s0 as any).guardGroup as THREE.Group
    const g1Group = (s1 as any).guardGroup as THREE.Group
    // sum index counts across children
    const sumIndex = (grp: THREE.Group) => {
      let total = 0
      grp.traverse(o => {
        const m = o as THREE.Mesh
        if (m.isMesh) {
          const idx = m.geometry.getIndex()?.count
          const pos = (m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined)?.count
          // for non-indexed geometry, triangle count ~ position.count/3
          const tri = idx ?? (pos ? Math.floor(pos / 3) : 0)
          total += tri
        }
      })
      return total
    }
    expect(sumIndex(g1Group)).toBeGreaterThan(sumIndex(g0Group))
  })

  it('disk cutouts increase triangle count', () => {
    const mk = (n:number) => make(p => { p.guard.style='disk'; p.guard.width=0.5; p.guard.thickness=0.1; (p.guard as any).cutoutCount = n; (p.guard as any).cutoutRadius=0.5 })
    const s0 = mk(0), s6 = mk(6)
    const mesh0 = s0.guardMesh!, mesh6 = s6.guardMesh!
    const tri = (m: THREE.Mesh) => (m.geometry.getIndex()?.count ?? ((m.geometry.getAttribute('position') as THREE.BufferAttribute).count))
    expect(tri(mesh6)).toBeGreaterThan(tri(mesh0))
  })

  it('asymmetricArms scales halves differently', () => {
    const s = make(p => { p.guard.style = 'winged'; (p.guard as any).asymmetricArms = true; (p.guard as any).asymmetry = 0.8 })
    const group = (s as any).guardGroup as THREE.Group
    expect(group).toBeTruthy()
    const scales = group.children
      .filter((c: any) => (c as any).isMesh)
      .map((m: any) => m.scale.x)
    expect(scales.length).toBe(2)
    expect(Math.max(scales[0], scales[1])).toBeGreaterThan(Math.min(scales[0], scales[1]))
  })

  it('quillonCount and quillonLength/tipSharpness map to geometry', () => {
    const mk = (qc: number, ql: number, ts: number) => make(p => { p.guard.style='winged'; (p.guard as any).quillonCount = qc; (p.guard as any).quillonLength = ql; (p.guard as any).tipSharpness = ts; p.pommel.style='orb' })
    const s0 = mk(0, 0.25, 0.5)
    const s2 = mk(2, 0.5, 1.0)
    // count cone cylinders for quillons
    const countType = (s: SwordGenerator, type: string) => {
      let n = 0
      s.group.traverse(o => {
        const m = o as THREE.Mesh
        if (m.isMesh && (m.geometry as any).type === type) n++
      })
      return n
    }
    expect(countType(s2,'ConeGeometry')).toBeGreaterThan(countType(s0,'ConeGeometry'))
    expect(countType(s2,'CylinderGeometry')).toBeGreaterThan(countType(s0,'CylinderGeometry'))
    // Check lengths encoded in geometry parameters
    let cylHeight = 0, coneHeight = 0
    s2.group.traverse(o => {
      const m = o as any
      if (m.isMesh && (m.geometry as any).type === 'CylinderGeometry') cylHeight = Math.max(cylHeight, (m.geometry as any).parameters?.height ?? 0)
      if (m.isMesh && (m.geometry as any).type === 'ConeGeometry') coneHeight = Math.max(coneHeight, (m.geometry as any).parameters?.height ?? 0)
    })
    expect(cylHeight).toBeGreaterThanOrEqual(0.5)
    // tipSharpness=1 => cone height = qLen*0.25*1.0 = 0.125
    expect(coneHeight).toBeGreaterThan(0.1)
  })

  it('swept style creates multiple guard bars', () => {
    const s = make(p => { (p.guard as any).style = 'swept'; p.guard.width = 1.2; p.guard.thickness = 0.2; (p.guard as any).ornamentation = 0.8; });    const grp = (s as any).guardGroup as THREE.Group;
    expect(grp).toBeTruthy();    // should have several children (bars)
    expect(grp.children.length).toBeGreaterThan(2);  })

  it('basket style creates a radial cage', () => {
    const s = make(p => { (p.guard as any).style = 'basket'; p.guard.width = 1.2; p.guard.thickness = 0.2; (p.guard as any).ornamentation = 0.5; });    const grp = (s as any).guardGroup as THREE.Group;
    expect(grp).toBeTruthy();    expect(grp.children.length).toBeGreaterThan(4);  })

  it('guard extras: loops add torus meshes', () => {
    const s = make(p => { (p.guard as any).extras = [{ kind:'loop', radius:0.1, thickness:0.02, offsetY:0 }]; });    const grp = (s as any).guardGroup as THREE.Group;
    expect(grp).toBeTruthy();    let torusCount = 0;
    grp.traverse(o => { const m = o as any; if (m.isMesh && (m.geometry as any)?.type === 'TorusGeometry') torusCount++; });    expect(torusCount).toBeGreaterThanOrEqual(2);  })
})

describe('Handle knobs', () => {
  it('handle length sets Y span', () => {
    const L = 1.3
    const s = make(p => { p.handle.length = L })
    const bb = bboxOf(s.handleMesh)
    expect(approx(span(bb,'y'), L, 1e-2)).toBe(true)
  })

  it('oval ratio stretches X and squashes Z', () => {
    const s1 = make(p => { p.handle.ovalRatio = 1.0 })
    const s2 = make(p => { p.handle.ovalRatio = 1.6 })
    const b1 = bboxOf(s1.handleMesh)
    const b2 = bboxOf(s2.handleMesh)
    expect(span(b2,'x')).toBeGreaterThan(span(b1,'x'))
    expect(span(b2,'z')).toBeLessThan(span(b1,'z'))
  })

  it('wrap depth increases X span', () => {
    const s0 = make(p => { p.handle.wrapEnabled = false; p.handle.wrapDepth = 0 })
    const s1 = make(p => { p.handle.wrapEnabled = true; p.handle.wrapDepth = 0.03; p.handle.wrapTurns = 8 })
    const x0 = span(bboxOf(s0.handleMesh), 'x')
    const x1 = span(bboxOf(s1.handleMesh), 'x')
    expect(x1).toBeGreaterThan(x0)
  })

  it('phiSegments increases vertex count', () => {
    const s0 = make(p => { (p.handle as any).phiSegments = 12 })
    const s1 = make(p => { (p.handle as any).phiSegments = 96 })
    const v0 = ((s0.handleMesh!.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute).count
    const v1 = ((s1.handleMesh!.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute).count
    expect(v1).toBeGreaterThan(v0)
  })

  it('curvature bends X around mid section', () => {
    const s0 = make(p => { p.handle.curvature = 0 })
    const s1 = make(p => { p.handle.curvature = 0.15 })
    const meanXMid = (s: SwordGenerator) => {
      const g = s.handleMesh!.geometry as THREE.BufferGeometry
      const pos = g.getAttribute('position') as THREE.BufferAttribute
      const arr = pos.array as unknown as number[]
      let minY=Infinity, maxY=-Infinity
      for (let i=1;i<arr.length;i+=3) { const y=arr[i]; if (y<minY) minY=y; if (y>maxY) maxY=y }
      const midY=(minY+maxY)/2, tol=(maxY-minY)*0.02
      let sum=0,cnt=0
      for (let i=0;i<arr.length;i+=3) { const y=arr[i+1]; if (Math.abs(y-midY)<=tol) { sum+=arr[i]; cnt++ } }
      return cnt? sum/cnt : 0
    }
    expect(meanXMid(s1)).toBeLessThan(meanXMid(s0))
  })

  it('wrapTexture assigns a texture map on material', () => {
    const prevDoc: any = (globalThis as any).document
    // Minimal canvas and 2D context stub
    const ctx = {
      fillRect() {}, save() {}, restore() {}, translate() {}, rotate() {},
      fillStyle: '#000', createImageData: (w:number,h:number)=>({ data: new Uint8ClampedArray(w*h*4) }),
      putImageData() {}
    }
    const fakeCanvas = { width: 0, height: 0, getContext: () => ctx }
    ;(globalThis as any).document = { createElement: () => fakeCanvas }
    try {
      const s = make(p => { p.handle.wrapEnabled = true; p.handle.wrapTexture = true; p.handle.wrapDepth = 0.02; p.handle.wrapTurns = 6 })
      const mat = (s.handleMesh!.material as any)
      expect(!!mat.map).toBe(true)
    } finally {
      (globalThis as any).document = prevDoc
    }
  })

  it('crisscross wrap adds layer meshes', () => {
    const s = make(p => {
      (p.handle as any).handleLayers = [{ kind:'wrap', wrapPattern:'crisscross', y0Frac:0, lengthFrac:1, turns:5, depth:0.01 }];
    });    const grp = (s as any).handleGroup as THREE.Group;
    expect(grp).toBeTruthy();    // extra meshes added besides base handle
    expect(grp.children.length).toBeGreaterThan(1);  })

  it('ring layer adds a torus', () => {
    const s = make(p => {
      (p.handle as any).handleLayers = [{ kind:'ring', y0Frac:0.5, radiusAdd:0.02 }];
    });    const grp = (s as any).handleGroup as THREE.Group;
    expect(grp).toBeTruthy();    expect(grp.children.length).toBeGreaterThan(1);  })

  it('rivets ring adds multiple meshes', () => {
    const s = make(p => {
      (p.handle as any).rivets = [{ count: 10, ringFrac: 0.3, radius: 0.01 }];
    });    const grp = (s as any).handleGroup as THREE.Group;
    expect(grp).toBeTruthy();    expect(grp.children.length).toBeGreaterThan(1);  })
})

describe('Engravings', () => {
  it('box fallback engraving appears without font', () => {
    const s = make(p => {
      (p.blade as any).engravings = [{ type:'text', content:'TEST', width:0.2, height:0.03, depth:0.002, offsetY: p.blade.length*0.4, offsetX:0, rotation:0, side:'both' }];
    });    const g = (s as any).engravingGroup as THREE.Group;
    expect(g).toBeTruthy();    // both sides should create at least two meshes
    expect(g.children.length).toBeGreaterThanOrEqual(2);  })

  it('decal engraving adds projected mesh', () => {
    const s = make(p => {
      (p.blade as any).engravings = [{ type:'decal', width:0.15, height:0.03, depth:0.002, offsetY: p.blade.length*0.5, offsetX:0, rotation:0, side:'right' }];
    });    const g = (s as any).engravingGroup as THREE.Group;
    expect(g).toBeTruthy();    expect(g.children.length).toBeGreaterThanOrEqual(1);  })
})

describe('Pommel variants', () => {
  it('wheel uses CylinderGeometry', () => {
    const s = make(p => { p.pommel.style = 'wheel'; p.pommel.size = 0.18; });    expect(((s.pommelMesh as any).geometry as any).type).toBe('CylinderGeometry');  })
  it('ring uses TorusGeometry', () => {
    const s = make(p => { (p.pommel as any).style = 'ring'; (p.pommel as any).ringInnerRadius = 0.08; });    expect(((s.pommelMesh as any).geometry as any).type).toBe('TorusGeometry');  })
  it('scentStopper uses OctahedronGeometry', () => {
    const s = make(p => { (p.pommel as any).style = 'scentStopper'; });    expect(((s.pommelMesh as any).geometry as any).type).toBe('OctahedronGeometry');  })
  it('crown uses ConeGeometry', () => {
    const s = make(p => { (p.pommel as any).style = 'crown'; (p.pommel as any).crownSpikes = 9; (p.pommel as any).crownSharpness = 0.8; });    expect(((s.pommelMesh as any).geometry as any).type).toBe('ConeGeometry');  })
})

describe('Proportional ratios', () => {
  it('useRatios sets guard width/handle length/pommel size from blade length', () => {
    const L = 3.0;
    const ratios = { guardWidthToBlade: 0.4, handleLengthToBlade: 0.3, pommelSizeToBlade: 0.06 };
    const s = make(p => {
      p.blade.length = L;
      (p as any).useRatios = true;
      (p as any).ratios = ratios;
      p.guard.style = 'bar';
    });    const gbb = bboxOf(s.guardMesh);    expect(approx(span(gbb,'x'), L * ratios.guardWidthToBlade, 1e-2)).toBe(true);    const hbb = bboxOf(s.handleMesh);    expect(approx(span(hbb,'y'), L * ratios.handleLengthToBlade, 1e-2)).toBe(true);    const pbb = bboxOf(s.pommelMesh);    expect(span(pbb,'x')).toBeGreaterThan(0);  })
})

describe('Pommel knobs', () => {
  it('disk is flat along Y regardless of elongation', () => {
    const s1 = make(p => { p.pommel.style = 'disk'; p.pommel.size = 0.18; p.pommel.elongation = 0.5 })
    const s2 = make(p => { p.pommel.style = 'disk'; p.pommel.size = 0.18; p.pommel.elongation = 2.0 })
    const y1 = span(bboxOf(s1.pommelMesh), 'y')
    const y2 = span(bboxOf(s2.pommelMesh), 'y')
    expect(approx(y1, y2, 1e-3)).toBe(true)
    // also should be flatter in Y than X
    const x1 = span(bboxOf(s1.pommelMesh), 'x')
    expect(y1).toBeLessThan(x1)
  })

  it('orb elongation scales Y', () => {
    const s1 = make(p => { p.pommel.style = 'orb'; p.pommel.size = 0.16; p.pommel.elongation = 0.8 })
    const s2 = make(p => { p.pommel.style = 'orb'; p.pommel.size = 0.16; p.pommel.elongation = 1.6 })
    const y1 = span(bboxOf(s1.pommelMesh), 'y')
    const y2 = span(bboxOf(s2.pommelMesh), 'y')
    expect(y2).toBeGreaterThan(y1)
  })

  it('facetCount increases vertex count', () => {
    const s0 = make(p => { p.pommel.style='orb'; p.pommel.facetCount = 8 })
    const s1 = make(p => { p.pommel.style='orb'; p.pommel.facetCount = 64 })
    const v0 = ((s0.pommelMesh!.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute).count
    const v1 = ((s1.pommelMesh!.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute).count
    expect(v1).toBeGreaterThan(v0)
  })

  it('balance scales size with blade mass', () => {
    // With full balance, larger blade mass yields larger pommel
    const sLight = make(p => { p.pommel.balance = 1.0; p.blade.length = 2.0; p.blade.baseWidth = 0.15; p.blade.tipWidth = 0.05 })
    const sHeavy = make(p => { p.pommel.balance = 1.0; p.blade.length = 5.0; p.blade.baseWidth = 0.4; p.blade.tipWidth = 0.2 })
    const yL = span(bboxOf(sLight.pommelMesh), 'y')
    const yH = span(bboxOf(sHeavy.pommelMesh), 'y')
    expect(yH).toBeGreaterThan(yL)
  })
})

describe('Dependent knobs', () => {
  it('hamon side selection respects side knobs', () => {
    // left only
    const sLeft = make(p => { p.blade.hamonEnabled = true; p.blade.hamonWidth = 0.02; p.blade.hamonAmplitude = 0.006; (p.blade as any).hamonSide = 'left' })
    const gLeft = (sLeft as any).hamonGroup as THREE.Group
    expect(gLeft).toBeTruthy(); expect(gLeft.children.length).toBe(2)
    // both
    const sBoth = make(p => { p.blade.hamonEnabled = true; p.blade.hamonWidth = 0.02; p.blade.hamonAmplitude = 0.006; (p.blade as any).hamonSide = 'both' })
    const gBoth = (sBoth as any).hamonGroup as THREE.Group
    expect(gBoth.children.length).toBe(4)
    // auto + single edge selects thinner side
    const sAuto = make(p => { p.blade.hamonEnabled = true; p.blade.edgeType = 'single'; p.blade.hamonWidth = 0.02; p.blade.hamonAmplitude = 0.006; p.blade.thicknessLeft = 0.10; p.blade.thicknessRight = 0.02; (p.blade as any).hamonSide = 'auto' })
    const gAuto = (sAuto as any).hamonGroup as THREE.Group
    // only right side (2 ribbons)
    expect(gAuto.children.length).toBe(2)
  })

  it('leaf bulge has no effect when tipShape != leaf', () => {
    const base = (p: SwordParams) => { p.blade.length = 3; p.blade.baseWidth = 0.22; p.blade.tipWidth = 0.12; p.blade.curvature = 0; (p.blade as any).chaos = 0 }
    const sA = make(p => { base(p); p.blade.tipShape = 'pointed'; p.blade.tipBulge = 0.0 })
    const sB = make(p => { base(p); p.blade.tipShape = 'pointed'; p.blade.tipBulge = 1.0 })
    const w = (s: SwordGenerator) => span(bboxOf(s.bladeMesh), 'x')
    expect(approx(w(sA), w(sB), 1e-3)).toBe(true)
  })

  it('sori profile/bias have no visible effect when curvature = 0', () => {
    const sTorii = make(p => { p.blade.curvature = 0; (p.blade as any).soriProfile = 'torii'; (p.blade as any).soriBias = 0.8; (p.blade as any).chaos = 0 })
    const sSaki = make(p => { p.blade.curvature = 0; (p.blade as any).soriProfile = 'saki'; (p.blade as any).soriBias = 2.0; (p.blade as any).chaos = 0 })
    const b0 = bboxOf(sTorii.bladeMesh)
    const b1 = bboxOf(sSaki.bladeMesh)
    expect(approx(span(b0,'x'), span(b1,'x'), 1e-3)).toBe(true)
  })

  it('false edge depth does nothing when length is 0', () => {
    const s0 = make(p => { (p.blade as any).falseEdgeLength = 0; (p.blade as any).falseEdgeDepth = 0.05 })
    const s1 = make(p => { (p.blade as any).falseEdgeLength = 0; (p.blade as any).falseEdgeDepth = 0.00 })
    // identical Z thickness
    const z0 = span(bboxOf(s0.bladeMesh), 'z')
    const z1 = span(bboxOf(s1.bladeMesh), 'z')
    expect(approx(z0, z1, 1e-3)).toBe(true)
  })

  it('fuller overlay requires an active slot with depth', () => {
    const sNo = make(p => { delete (p.blade as any).fullers; p.blade.fullerEnabled = false; })
    const sYes = make(p => {
      (p.blade as any).fullers = [{ side: 'both', offsetFromSpine: 0, width: 0.05, depth: 0.012, inset: 0.006, start: 0.1, end: 0.7, profile: 'u', mode: 'overlay', taper: 0 }]
      p.blade.fullerEnabled = true
    })
    const hasOverlay = (s: SwordGenerator) => !!(s as any).fullerGroup
    expect(hasOverlay(sNo)).toBe(false)
    expect(hasOverlay(sYes)).toBe(true)
  })

  it('fuller carve reduces Z thickness near mid-face when inset > 0', () => {
    const sFlat = make(p => { p.blade.fullerEnabled = true; p.blade.fullerLength = 0.6; (p.blade as any).fullerInset = 0.0; (p.blade as any).fullerMode = 'carve' })
    const sCarved = make(p => { p.blade.fullerEnabled = true; p.blade.fullerLength = 0.6; (p.blade as any).fullerInset = 0.04; (p.blade as any).fullerMode = 'carve' })
    const thicknessNearCenter = (s: SwordGenerator) => {
      const g = s.bladeMesh!.geometry as THREE.BufferGeometry
      const pos = g.getAttribute('position') as THREE.BufferAttribute
      const arr = pos.array as unknown as number[]
      // find mid Y
      let minY = Infinity, maxY = -Infinity
      for (let i=1;i<arr.length;i+=3) { const y=arr[i]; if (y<minY) minY=y; if (y>maxY) maxY=y }
      const midY = (minY + maxY) / 2
      const tolY = (maxY - minY) * 0.02
      // select vertices near mid Y
      const pts: Array<{x:number,y:number,z:number}> = []
      for (let i=0;i<arr.length;i+=3) {
        const x = arr[i], y = arr[i+1], z = arr[i+2]
        if (Math.abs(y - midY) <= tolY) pts.push({x,y,z})
      }
      // determine width window around center (exclude edges)
      let minX = Infinity, maxX = -Infinity
      for (const p of pts) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x }
      const w = maxX - minX
      const sel = pts.filter(p => Math.abs(p.x) <= w * 0.15) // central 30% of width
      let minZ = Infinity, maxZ = -Infinity
      for (const p of sel) { if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z }
      return maxZ - minZ
    }
    expect(thicknessNearCenter(sCarved)).toBeLessThan(thicknessNearCenter(sFlat))
  })
})



describe('Dynamics', () => {
  it('exposes derived metrics in reasonable ranges', () => {
    const s = make(p => {
      p.blade.length = 3;
      (p.blade as any).thicknessProfile = { points: [[0,1],[1,1]] } as any;
    });
    const d: any = (s as any).getDerived?.();
    expect(!!d).toBe(true);
    expect(d.cmY).toBeGreaterThan(0);
    expect(d.cmY).toBeLessThanOrEqual(3);
    expect(d.copY).toBeGreaterThan(d.cmY);
  });
});
