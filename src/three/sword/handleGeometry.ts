import * as THREE from 'three'
import type { HandleParams } from './types'
import { makeWrapTexture } from './handleTextures'

/**
 * Build the handle core mesh and an optional group with wraps, rings, inlays,
 * menuki, and rivets. Returns { handleMesh, handleGroup }.
 */
export function buildHandle(
  h: HandleParams,
  makeMaterial: (part: 'handle') => THREE.Material
): { handleMesh: THREE.Mesh; handleGroup: THREE.Group } {
  const mat = makeMaterial('handle')
  // Build lathe profile along Y
  const profile: THREE.Vector2[] = []
  const ridges = h.segmentation ? ((h as any).segmentationCount ?? 8) : 0
  const segments = 32
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const y = -h.length / 2 + t * h.length
    const baseR = h.radiusBottom + (h.radiusTop - h.radiusBottom) * t
    const bump = ridges > 0 ? (Math.sin(t * Math.PI * ridges) * 0.03) : 0
    const flare = Math.max(0, (h as any).flare ?? 0)
    const r = Math.max(0.02, baseR + bump + flare * Math.pow(1 - t, 2))
    profile.push(new THREE.Vector2(r, y))
  }
  const phiSegments = Math.max(8, Math.min(128, Math.round((h as any).phiSegments ?? 64)))
  const lathe = new THREE.LatheGeometry(profile, phiSegments)
  const handleMesh = new THREE.Mesh(lathe, mat)
  handleMesh.castShadow = true

  // Optional wrap texture
  if (h.wrapEnabled && (h.wrapTexture ?? false)) {
    const scale = Math.max(1, (h.wrapTexScale ?? 10))
    const ang = (h.wrapTexAngle ?? (Math.PI/4))
    const tex = makeWrapTexture(scale, ang)
    ;(handleMesh.material as any).map = tex
  }

  // Optional helical wrap deformation to raise/sink the surface
  if (h.wrapEnabled && (h.wrapDepth ?? 0) > 0 && (h.wrapTurns ?? 0) > 0) {
    const geo = handleMesh.geometry as THREE.BufferGeometry
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const arr = pos.array as unknown as number[]
    let yMin = +Infinity, yMax = -Infinity
    for (let i = 1; i < arr.length; i += 3) { const y = arr[i]; if (y < yMin) yMin = y; if (y > yMax) yMax = y }
    const turns = Math.max(0, h.wrapTurns || 0)
    const amp = Math.min(0.1, Math.max(0, h.wrapDepth || 0))
    for (let i = 0; i < pos.count; i++) {
      const ix = i * 3, iy = ix + 1, iz = ix + 2
      const x = arr[ix], y = arr[iy], z = arr[iz]
      const t = (y - yMin) / Math.max(1e-6, yMax - yMin)
      const baseR = Math.max(0.01, Math.hypot(x, z))
      const phi = Math.atan2(z, x) + 2 * Math.PI * turns * t
      const offset = amp * Math.sin(phi)
      const scale = (baseR + offset) / baseR
      arr[ix] = x * scale
      arr[iz] = z * scale
    }
    pos.needsUpdate = true; geo.computeVertexNormals()
  }

  // Bend the grip slightly along X around mid
  if ((h as any).curvature) {
    const geo = handleMesh.geometry as THREE.BufferGeometry
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const arr = pos.array as unknown as number[]
    let minY = Infinity, maxY = -Infinity
    for (let i=1;i<arr.length;i+=3) { const y=arr[i]; if (y<minY) minY=y; if (y>maxY) maxY=y }
    for (let i=0;i<arr.length;i+=3) {
      const y = arr[i+1]
      const t = (y - minY) / Math.max(1e-6, (maxY - minY))
      const bend = (h as any).curvature * (t*t - t) * (maxY - minY)
      arr[i] = arr[i] + bend
    }
    pos.needsUpdate = true; geo.computeVertexNormals()
  }

  // Oval cross-section scaling
  const oval = Math.max(1, h.ovalRatio ?? 1)
  if (oval !== 1) { handleMesh.scale.x *= oval; handleMesh.scale.z /= oval }
  handleMesh.position.y = -h.length * 0.5
  const handleGroup = new THREE.Group()
  handleGroup.add(handleMesh)

  const bounds = new THREE.Box3().setFromObject(handleMesh)
  const yMin = bounds.min.y
  const yMax = bounds.max.y
  const spanY = Math.max(1e-6, yMax - yMin)
  const flare = Math.max(0, (h as any).flare ?? 0)
  const baseRadiusAt = (t: number) => {
    const clamped = THREE.MathUtils.clamp(t, 0, 1)
    const baseR = h.radiusBottom + (h.radiusTop - h.radiusBottom) * clamped
    const flareTerm = flare * Math.pow(1 - clamped, 2)
    return Math.max(0.02, baseR + flareTerm)
  }
  const radiusAtY = (y: number) => baseRadiusAt((y - yMin) / spanY)

  class HelixCurve extends (THREE as any).Curve {
    constructor(public y0: number, public y1: number, public turns: number, public rFunc: (t: number) => number, public phase = 0) {
      super()
    }
    getPoint(u: number) {
      const y = this.y0 + (this.y1 - this.y0) * u
      const t = (y - yMin) / spanY
      const r = this.rFunc(t)
      const phi = this.phase + 2 * Math.PI * this.turns * u
      return new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r)
    }
  }

  const applyWrapStyle = () => {
    const style = (h as any).wrapStyle ?? 'none'
    if (style === 'none') return
    const wrapMat = makeMaterial('handle')
    const addHelix = (startFrac: number, endFrac: number, turns: number, phase: number, radiusOffset: number, tubeRadius: number) => {
      const s = THREE.MathUtils.clamp(startFrac, 0, 1)
      const e = THREE.MathUtils.clamp(endFrac, 0, 1)
      if (e <= s) return
      const y0 = yMin + s * spanY
      const y1 = yMin + e * spanY
      const rFunc = (t: number) => baseRadiusAt(t) + radiusOffset
      const curve = new HelixCurve(y0, y1, turns, rFunc, phase)
      const tube = new THREE.TubeGeometry(curve, 160, tubeRadius, 12, false)
      const mesh = new THREE.Mesh(tube, wrapMat)
      mesh.castShadow = true
      handleGroup.add(mesh)
    }

    if (style === 'crisscross') {
      const turns = Math.max(3, Math.round((h.wrapTurns ?? 6)))
      const offset = Math.max(0.004, Math.min(0.02, (h.wrapDepth ?? 0.012)))
      const tubeR = Math.max(0.002, offset * 0.25)
      addHelix(0, 1, turns, 0, offset, tubeR)
      addHelix(0, 1, -turns, 0, offset, tubeR)
    } else if (style === 'hineri') {
      addHelix(0, 1, 5, 0, 0.012, 0.004)
      addHelix(0, 1, -5, Math.PI * 0.5, 0.01, 0.004)
    } else if (style === 'katate') {
      addHelix(0, 0.45, 4, 0, 0.012, 0.004)
      addHelix(0.55, 1, -4, Math.PI, 0.012, 0.004)
    } else if (style === 'wire') {
      const rings = 10
      for (let i = 0; i < rings; i++) {
        const t = (i + 0.5) / rings
        const y = yMin + t * spanY
        const radius = radiusAtY(y) + 0.004
        const torus = new THREE.TorusGeometry(radius, 0.0035, 10, 48)
        const ring = new THREE.Mesh(torus, wrapMat)
        ring.position.y = y
        ring.rotation.x = Math.PI / 2
        handleGroup.add(ring)
      }
    }
  }
  applyWrapStyle()

  if (h.rayskin?.enabled) {
    const scaleOffset = 1 + THREE.MathUtils.clamp(h.rayskin.scale ?? 0.01, 0.001, 0.05)
    const rayskinGeo = new THREE.LatheGeometry(profile, Math.max(phiSegments, 72))
    const baseMat = makeMaterial('handle') as THREE.MeshStandardMaterial
    const rayskinMat = baseMat.clone()
    const highlight = new THREE.Color(0xf4f1ea)
    const intensity = THREE.MathUtils.clamp(h.rayskin.intensity ?? 0.6, 0, 1)
    rayskinMat.color.copy(baseMat.color.clone().lerp(highlight, intensity))
    rayskinMat.roughness = Math.min(1, (rayskinMat.roughness ?? 0.5) + 0.25)
    rayskinMat.metalness = Math.max(0, (rayskinMat.metalness ?? 0.1) - 0.1)
    rayskinMat.side = THREE.DoubleSide
    const rayskinMesh = new THREE.Mesh(rayskinGeo, rayskinMat)
    rayskinMesh.position.copy(handleMesh.position)
    rayskinMesh.scale.set(scaleOffset, 1, scaleOffset)
    rayskinMesh.castShadow = false
    rayskinMesh.receiveShadow = false
    handleGroup.add(rayskinMesh)
  }

  // Visible tang
  if ((h as any).tangVisible) {
    const tw = Math.max(0.01, (h as any).tangWidth ?? 0.05)
    const tt = Math.max(0.005, (h as any).tangThickness ?? 0.02)
    const ty = h.length * 0.9
    const geoTang = new THREE.BoxGeometry(tw, ty, tt)
    const matTang = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.7, roughness: 0.4 })
    const tang = new THREE.Mesh(geoTang, matTang)
    tang.position.y = -h.length * 0.5 + ty * 0.5
    handleGroup.add(tang)
  }

  // Layers & extras
  const layers = (h as any).handleLayers as any[] | undefined
  if (layers && layers.length) {
    const gmat = makeMaterial('handle')
    layers.forEach((L) => {
      if (L.kind === 'wrap' && (L.wrapPattern === 'crisscross')) {
        const start = THREE.MathUtils.clamp(L.y0Frac ?? 0, 0, 1)
        const end = THREE.MathUtils.clamp(start + (L.lengthFrac ?? 1), 0, 1)
        const y0 = yMin + start * spanY
        const y1 = yMin + end * spanY
        const turns = Math.max(1, L.turns ?? 6)
        const depth = Math.max(0.001, Math.min(0.05, L.depth ?? 0.012))
        const rFunc = (t:number)=> baseRadiusAt(t) + depth
        const c1:any = new HelixCurve(y0, y1, +turns, rFunc, 0)
        const c2:any = new HelixCurve(y0, y1, -turns, rFunc, 0)
        const tubeR = Math.max(0.002, depth * 0.3)
        const tube1 = new THREE.TubeGeometry(c1, 200, tubeR, 8, false)
        const tube2 = new THREE.TubeGeometry(c2, 200, tubeR, 8, false)
        handleGroup.add(new THREE.Mesh(tube1, gmat), new THREE.Mesh(tube2, gmat))
      }
      if (L.kind === 'ring') {
        const y = yMin + (L.y0Frac ?? 0.5) * spanY
        const r = baseRadiusAt((y - yMin) / spanY) + (L.radiusAdd ?? 0)
        const tor = new THREE.TorusGeometry(r, Math.max(0.002, 0.01), 8, 32)
        const ring = new THREE.Mesh(tor, gmat)
        ring.position.y = y
        ring.rotation.x = Math.PI/2
        handleGroup.add(ring)
      }
      if (L.kind === 'inlay') {
        const y = yMin + (L.y0Frac ?? 0.5) * spanY
        const box = new THREE.BoxGeometry(0.03, 0.01, 0.005)
        const m = new THREE.Mesh(box, gmat)
        m.position.set(0, y, baseRadiusAt((y - yMin) / spanY) - 0.003)
        handleGroup.add(m)
      }
    })
  }

  // Menuki
  const menuki = (h as any).menuki as any[] | undefined
  if (menuki && menuki.length) {
    const matM = makeMaterial('handle')
    menuki.forEach((m) => {
      const t = THREE.MathUtils.clamp(m.positionFrac ?? 0.5, 0, 1)
      const y = yMin + t * spanY
      const r = baseRadiusAt(t)
      const x = (m.side === 'left' ? -r : +r)
      const sph = new THREE.SphereGeometry(Math.max(0.005, m.size ?? 0.02), 12, 8)
      const mesh = new THREE.Mesh(sph, matM)
      mesh.position.set(x, y, 0)
      handleGroup.add(mesh)
    })
  }

  // Rivets
  const rivets = (h as any).rivets as any[] | undefined
  if (rivets && rivets.length) {
    const matR = makeMaterial('handle')
    rivets.forEach((rv) => {
      const n = Math.max(1, Math.round(rv.count ?? 1))
      const t = THREE.MathUtils.clamp(rv.ringFrac ?? 0.5, 0, 1)
      const y = yMin + t * spanY
      const baseR = baseRadiusAt(t)
      const rr = Math.max(0.002, rv.radius ?? 0.01)
      const geo = new THREE.SphereGeometry(rr, 10, 8)
      for (let i=0;i<n;i++) {
        const phi = (i / n) * Math.PI * 2
        const x = Math.cos(phi) * baseR
        const z = Math.sin(phi) * baseR
        const m = new THREE.Mesh(geo, matR)
        m.position.set(x, y, z)
        handleGroup.add(m)
      }
    })
  }

  return { handleMesh, handleGroup }
}
