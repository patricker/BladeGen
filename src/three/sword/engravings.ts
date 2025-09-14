import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js'
import type { BladeParams } from './types'

/**
 * Build a group of engravings/decals for the blade faces.
 * - Accepts the current `BladeParams` and the synthesized `bladeMesh` for projection.
 * - Uses a provided `fontCache` map to avoid reloading fonts between calls.
 * - Returns { group, fontCache } or null if nothing to render.
 */
export function buildEngravingsGroup(
  b: BladeParams,
  bladeMesh: THREE.Mesh,
  fontCache?: Map<string, any>
): { group: THREE.Group; fontCache: Map<string, any> } | null {
  const engr = (b as any).engravings as any[] | undefined
  if (!engr || !engr.length) return null
  const bb = new THREE.Box3().setFromObject(bladeMesh)
  const yMin = bb.min.y
  const halfTL = Math.max(0.001, (b.thicknessLeft ?? b.thickness ?? 0.08) * 0.5)
  const halfTR = Math.max(0.001, (b.thicknessRight ?? b.thickness ?? 0.08) * 0.5)
  const eps = 0.0006
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.6, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const cache = fontCache || new Map<string, any>()
  const loader = new FontLoader()

  engr.forEach((e) => {
    const width = Math.max(0.005, e.width || 0.1)
    const height = Math.max(0.005, e.height || 0.02)
    const depth = Math.max(0.0005, e.depth || 0.002)
    const yPos = yMin + Math.max(0, Math.min((b.length || 0), e.offsetY || 0))
    const xPos = e.offsetX || 0
    const rotY = e.rotation || 0
    const sides: ('left'|'right')[] = e.side === 'both' ? ['left','right'] : [e.side || 'right']
    const align: 'left'|'center'|'right' = e.align || 'center'

    if (e.type === 'text' && e.content && e.fontUrl) {
      const url: string = e.fontUrl
      const buildText = (font: any) => {
        const letterGap = Math.max(0, e.letterSpacing ?? 0)
        if (letterGap <= 1e-6) {
          const tg = new TextGeometry(e.content, { font, size: height, height: depth * 0.8, curveSegments: 6 } as any)
          tg.computeBoundingBox(); const bbx = tg.boundingBox!; const textW = bbx.max.x - bbx.min.x
          const sx = textW > 1e-6 ? Math.min(10, width / textW) : 1
          sides.forEach((side) => {
            const z = (side === 'right' ? (halfTR - eps) : -(halfTL - eps))
            const mesh = new THREE.Mesh(tg.clone(), mat)
            mesh.scale.set(sx, 1, 1)
            let dx = 0; if (align === 'center') dx = -(textW * sx) / 2; else if (align === 'right') dx = -(textW * sx)
            mesh.position.set(xPos + dx, yPos, z)
            mesh.rotation.y = rotY
            group.add(mesh)
          })
        } else {
          const g = new THREE.Group(); let cx = 0; const depthVal = depth * 0.8
          for (const ch of e.content) {
            const shapes = font.generateShapes(ch, height) as any[]
            let geo: THREE.ExtrudeGeometry | null = null
            if (shapes && shapes.length) { geo = new THREE.ExtrudeGeometry(shapes, { depth: depthVal, bevelEnabled: false, steps: 1, curveSegments: 6 } as any) }
            let charW = 0; let mesh: THREE.Mesh | null = null
            if (geo) { geo.computeBoundingBox(); const bbx = geo.boundingBox!; charW = Math.max(0, (bbx.max.x - bbx.min.x)); mesh = new THREE.Mesh(geo, mat); mesh.position.x = cx - (bbx.min.x || 0) }
            else { charW = height * 0.5 }
            if (mesh) g.add(mesh)
            cx += (charW + letterGap * height)
          }
          const totalW = Math.max(1e-6, cx - letterGap * height)
          const sx = Math.min(10, width / totalW)
          sides.forEach((side) => {
            const z = (side === 'right' ? (halfTR - eps) : -(halfTL - eps))
            const g2 = g.clone(true)
            g2.traverse((o)=>{ const m=o as THREE.Mesh; if (m.isMesh) m.material = (mat as any) })
            g2.scale.set(sx, 1, 1)
            let dx = 0; const wScaled = totalW * sx; if (align === 'center') dx = -wScaled / 2; else if (align === 'right') dx = -wScaled
            g2.position.set(xPos + dx, yPos, z)
            g2.rotation.y = rotY
            group.add(g2)
          })
        }
      }
      const cached = cache.get(url)
      if (cached) buildText(cached)
      else loader.load(url, (font: any) => { cache.set(url, font); buildText(font) })
    } else if (e.type === 'shape') {
      const kind = String(e.content || 'rect').toLowerCase()
      sides.forEach((side) => {
        const z = (side === 'right' ? (halfTR - eps) : -(halfTL - eps))
        let mesh: THREE.Mesh
        if (kind === 'circle') {
          const r = Math.max(0.001, Math.min(width, height))/2
          const cyl = new THREE.CylinderGeometry(r, r, depth, 24)
          mesh = new THREE.Mesh(cyl, mat); mesh.rotation.x = Math.PI/2
        } else {
          const geo = new THREE.BoxGeometry(width, height, depth)
          mesh = new THREE.Mesh(geo, mat)
        }
        mesh.position.set(xPos, yPos, z)
        mesh.rotation.y = rotY
        group.add(mesh)
      })
    } else if (e.type === 'decal') {
      sides.forEach((side) => {
        const sign = side === 'right' ? 1 : -1
        const z = sign > 0 ? (halfTR - eps * 4) : -(halfTL - eps * 4)
        const pos = new THREE.Vector3(xPos, yPos, z)
        const rot = new THREE.Euler(0, rotY, 0)
        const size = new THREE.Vector3(width, height, Math.max(0.0005, depth * 0.5))
        const dg = new DecalGeometry(bladeMesh, pos, rot, size)
        const dmat = mat.clone()
        const decal = new THREE.Mesh(dg as any, dmat)
        group.add(decal)
      })
    } else {
      sides.forEach((side) => {
        const z = (side === 'right' ? (halfTR - eps) : -(halfTL - eps))
        const geo = new THREE.BoxGeometry(width, height, depth)
        const m = new THREE.Mesh(geo, mat)
        m.position.set(xPos, yPos, z)
        m.rotation.y = rotY
        group.add(m)
      })
    }
  })

  return { group, fontCache: cache }
}

