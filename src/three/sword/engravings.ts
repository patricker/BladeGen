import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import type { BladeParams } from './types';
import { tipWidthWithKissaki, bendOffsetX } from './math';

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
  const engr = (b as any).engravings as any[] | undefined;
  if (!engr || !engr.length) return null;
  const bb = new THREE.Box3().setFromObject(bladeMesh);
  const yMin = bb.min.y;
  const halfTL = Math.max(0.001, (b.thicknessLeft ?? b.thickness ?? 0.08) * 0.5);
  const halfTR = Math.max(0.001, (b.thicknessRight ?? b.thickness ?? 0.08) * 0.5);
  const eps = 0.0006;
  const group = new THREE.Group();
  group.name = 'engravingGroup';
  // Two-pass engraving:
  // 1) Mask pass: write stencil=1 (no color), before blade render
  // 2) Fill pass: render cavity geometry with blade material only where stencil=1
  const maskGroup = new THREE.Group();
  maskGroup.name = 'engravingMask';
  maskGroup.renderOrder = 100; // before blade (blade uses 200)
  const fillGroup = new THREE.Group();
  fillGroup.name = 'engravingFill';
  fillGroup.renderOrder = 300; // after blade

  // Mask material: colorless, writes stencil=1
  const maskMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  // Write only to stencil; do not touch depth so blade and fill can render correctly
  (maskMat as any).depthWrite = false;
  (maskMat as any).depthTest = false;
  (maskMat as any).stencilWrite = true;
  (maskMat as any).stencilRef = 1;
  (maskMat as any).stencilFunc = THREE.AlwaysStencilFunc;
  (maskMat as any).stencilZPass = THREE.ReplaceStencilOp;
  (maskMat as any).stencilZFail = THREE.KeepStencilOp;
  (maskMat as any).stencilFail = THREE.KeepStencilOp;

  // Fill material: clone blade material, draw only where stencil==1
  const bladeMat = (bladeMesh.material as any);
  const makeFillMat = () => {
    const m = (bladeMat && bladeMat.clone ? bladeMat.clone() : new THREE.MeshPhysicalMaterial()) as any;
    m.side = THREE.DoubleSide;
    // Slightly darken + roughen cavity for visibility
    try {
      if (m.color && m.color.multiplyScalar) m.color.multiplyScalar(0.85);
    } catch {}
    if (typeof m.roughness === 'number') m.roughness = Math.min(1, (m.roughness ?? 0.5) + 0.15);
    if (typeof m.metalness === 'number') m.metalness = Math.max(0, (m.metalness ?? 0.6) * 0.75);
    // Restrict fill draw to masked region (stencil==1)
    m.stencilWrite = true;
    m.stencilRef = 1;
    m.stencilFunc = THREE.EqualStencilFunc;
    m.stencilZPass = THREE.KeepStencilOp;
    m.stencilZFail = THREE.KeepStencilOp;
    m.stencilFail = THREE.KeepStencilOp;
    // Be forgiving on z to avoid cracks at mask boundary
    m.depthFunc = THREE.LessEqualDepth;
    return m as THREE.Material;
  };
  const cache = fontCache || new Map<string, any>();
  const loader = new FontLoader();

  engr.forEach((e) => {
    const width = Math.max(0.005, e.width || 0.1);
    const height = Math.max(0.005, e.height || 0.02);
    const depth = Math.max(0.0005, e.depth || 0.002);
    const yLocal = Math.max(0, Math.min(b.length || 0, e.offsetY || 0));
    const yPos = yMin + yLocal;
    const xPos = e.offsetX || 0;
    const rotY = e.rotation || 0;
    const sides: ('left' | 'right')[] = e.side === 'both' ? ['left', 'right'] : [e.side || 'right'];
    const align: 'left' | 'center' | 'right' = e.align || 'center';
    // Lateral curvature shift: make engraving follow the blade bend
    const xBend = bendOffsetX(b, yLocal, Math.max(1e-6, b.length || 1));
    // Fit engraving width safely within local blade width at this Y
    const L = Math.max(1e-6, b.length || 1);
    const t = Math.max(0, Math.min(1, (yPos - yMin) / L));
    const baseW = Math.max(0.002, b.baseWidth || 0.2);
    const tipW = Math.max(0, b.tipWidth || 0);
    const bladeW = tipWidthWithKissaki(b, t, baseW, tipW);
    const margin = Math.max(0.002, Math.min(0.02, bladeW * 0.1));
    const maxSafeWidth = Math.max(0.005, bladeW - margin);
    const targetWidth = Math.min(width, maxSafeWidth);

    if (e.type === 'text' && e.content && e.fontUrl) {
      const url: string = e.fontUrl;
      const buildText = (font: any) => {
        const letterGap = Math.max(0, e.letterSpacing ?? 0);
        const baseDepth = Math.max(0.0005, depth * 0.8);
        // Check glyph support; if any characters are unsupported by the font, avoid
        // TextGeometry's implicit '?' substitution by switching to per-char assembly
        // (or falling back to a simple box if nothing is supported).
        let anySupported = false;
        let allSupported = true;
        for (const ch of String(e.content)) {
          if (ch === ' ') continue;
          const sh = (font as any).generateShapes
            ? (font as any).generateShapes(ch, height)
            : [];
          if (sh && (sh as any[]).length > 0) anySupported = true;
          else allSupported = false;
        }
        if (letterGap <= 1e-6 && allSupported) {
          const tg = new TextGeometry(e.content, {
            font,
            size: height,
            height: baseDepth,
            curveSegments: 6,
          } as any);
          tg.computeBoundingBox();
          const bbx = tg.boundingBox!;
          const textW = bbx.max.x - bbx.min.x;
          const sx = textW > 1e-6 ? Math.min(10, targetWidth / textW) : 1;
          sides.forEach((side) => {
            const faceZ = side === 'right' ? halfTR - eps : -(halfTL - eps);
            // Clamp effective depth to not exceed face thickness and position so outer surface is flush
            const maxFaceDepth = (side === 'right' ? halfTR : halfTL) - eps * 2;
            const exDepth = Math.min(baseDepth, Math.max(0.0002, maxFaceDepth));
            const geo = tg.clone();
            const meshMask = new THREE.Mesh(geo, maskMat);
            mesh.scale.set(sx, 1, 1);
            // Shift by minX so left edge starts at 0, then apply alignment
            let dx = -(bbx.min.x || 0) * sx;
            if (align === 'center') dx -= (textW * sx) / 2;
            else if (align === 'right') dx -= textW * sx;
            const zPos = faceZ - (side === 'right' ? exDepth : -exDepth);
            meshMask.position.set(xPos + xBend + dx, yPos, zPos);
            meshMask.rotation.y = rotY;
            const meshFill = meshMask.clone();
            (meshFill as any).material = makeFillMat();
            meshMask.renderOrder = 100;
            meshFill.renderOrder = 300;
            // Recess cavity slightly so the floor is visible
            const dir = side === 'right' ? -1 : 1;
            meshFill.position.z += dir * (0.2 * exDepth);
            maskGroup.add(meshMask);
            fillGroup.add(meshFill);
          });
        } else if (anySupported) {
          const g = new THREE.Group();
          let cx = 0;
          const depthVal = baseDepth;
          for (const ch of e.content) {
            const shapes = font.generateShapes(ch, height) as any[];
            let geo: THREE.ExtrudeGeometry | null = null;
            if (shapes && shapes.length) {
              geo = new THREE.ExtrudeGeometry(shapes, {
                depth: depthVal,
                bevelEnabled: false,
                steps: 1,
                curveSegments: 6,
              } as any);
            }
            let charW = 0;
            let mesh: THREE.Mesh | null = null;
            if (geo) {
              geo.computeBoundingBox();
              const bbx = geo.boundingBox!;
              charW = Math.max(0, bbx.max.x - bbx.min.x);
              mesh = new THREE.Mesh(geo, maskMat);
              mesh.position.x = cx - (bbx.min.x || 0);
            }
            if (mesh) g.add(mesh);
            cx += charW + letterGap * height;
          }
          const totalW = Math.max(1e-6, cx - letterGap * height);
          const sx = Math.min(10, targetWidth / totalW);
          sides.forEach((side) => {
            const faceZ = side === 'right' ? halfTR - eps : -(halfTL - eps);
            const maxFaceDepth = (side === 'right' ? halfTR : halfTL) - eps * 2;
            const exDepth = Math.min(depthVal, Math.max(0.0002, maxFaceDepth));
            const g2 = g.clone(true);
            g2.traverse((o) => {
              const m = o as THREE.Mesh;
              if (m.isMesh) {
                m.material = maskMat as any;
                m.renderOrder = 100;
              }
            });
            g2.scale.set(sx, 1, 1);
            let dx = 0;
            const wScaled = totalW * sx;
            if (align === 'center') dx = -wScaled / 2;
            else if (align === 'right') dx = -wScaled;
            const zPos = faceZ - (side === 'right' ? exDepth : -exDepth);
            g2.position.set(xPos + xBend + dx, yPos, zPos);
            g2.rotation.y = rotY;
            const gFill = g2.clone(true);
            gFill.traverse((o) => {
              const m = o as THREE.Mesh;
              if ((m as any).isMesh) {
                m.material = makeFillMat();
                m.renderOrder = 300;
              }
            });
            // Recess cavity slightly so the floor is visible
            const dir = side === 'right' ? -1 : 1;
            gFill.position.z += dir * (0.2 * exDepth);
            maskGroup.add(g2);
            fillGroup.add(gFill);
          });
        } else {
          // No supported glyphs at all -> fallback to a small box so the toggle
          // still shows something reasonable instead of stray '???'.
          sides.forEach((side) => {
            const faceZ = side === 'right' ? halfTR - eps : -(halfTL - eps);
            const maxFaceDepth = (side === 'right' ? halfTR : halfTL) - eps * 2;
            const exDepth = Math.min(baseDepth, Math.max(0.0002, maxFaceDepth));
            const geo = new THREE.BoxGeometry(targetWidth, height, exDepth);
            const zPos = faceZ - (side === 'right' ? exDepth : -exDepth);
            const mMask = new THREE.Mesh(geo, maskMat);
            mMask.position.set(xPos + xBend, yPos, zPos);
            mMask.rotation.y = rotY;
            const mFill = mMask.clone();
            (mFill as any).material = makeFillMat();
            mMask.renderOrder = 100;
            mFill.renderOrder = 300;
            const dir = side === 'right' ? -1 : 1;
            mFill.position.z += dir * (0.2 * exDepth);
            maskGroup.add(mMask);
            fillGroup.add(mFill);
          });
        }
      };
      const cached = cache.get(url);
      if (cached) buildText(cached);
      else
        loader.load(url, (font: any) => {
          cache.set(url, font);
          buildText(font);
        });
    } else if (e.type === 'shape') {
      const kind = String(e.content || 'rect').toLowerCase();
      sides.forEach((side) => {
        const faceZ = side === 'right' ? halfTR - eps : -(halfTL - eps);
        const maxFaceDepth = (side === 'right' ? halfTR : halfTL) - eps * 2;
        const exDepth = Math.min(depth, Math.max(0.0002, maxFaceDepth));
        let mesh: THREE.Mesh;
        if (kind === 'circle') {
          const r = Math.max(0.001, Math.min(width, height)) / 2;
          const cyl = new THREE.CylinderGeometry(r, r, exDepth, 24);
          mesh = new THREE.Mesh(cyl, maskMat);
          mesh.rotation.x = Math.PI / 2;
        } else {
          const geo = new THREE.BoxGeometry(width, height, exDepth);
          mesh = new THREE.Mesh(geo, maskMat);
        }
        const zPos = faceZ - (side === 'right' ? exDepth : -exDepth);
        mesh.position.set(xPos + xBend, yPos, zPos);
        mesh.rotation.y = rotY;
        const meshFill = mesh.clone();
        (meshFill as any).material = makeFillMat();
        mesh.renderOrder = 100;
        meshFill.renderOrder = 300;
        const dir = side === 'right' ? -1 : 1;
        meshFill.position.z += dir * (0.2 * exDepth);
        maskGroup.add(mesh);
        fillGroup.add(meshFill);
      });
    } else if (e.type === 'decal') {
      sides.forEach((side) => {
        const sign = side === 'right' ? 1 : -1;
        const z = sign > 0 ? halfTR - eps * 4 : -(halfTL - eps * 4);
        const pos = new THREE.Vector3(xPos, yPos, z);
        const rot = new THREE.Euler(0, rotY, 0);
        const size = new THREE.Vector3(width, height, Math.max(0.0005, depth * 0.5));
        const dg = new DecalGeometry(bladeMesh, pos, rot, size);
        const decalMask = new THREE.Mesh(dg as any, maskMat);
        const decalFill = decalMask.clone();
        (decalFill as any).material = makeFillMat();
        decalMask.renderOrder = 100;
        decalFill.renderOrder = 300;
        const dir = sign > 0 ? -1 : 1;
        decalFill.position.z += dir * (0.2 * Math.max(0.0005, depth * 0.5));
        maskGroup.add(decalMask);
        fillGroup.add(decalFill);
      });
    } else {
      sides.forEach((side) => {
        const z = side === 'right' ? halfTR - eps : -(halfTL - eps);
        const geo = new THREE.BoxGeometry(width, height, depth);
        const mMask = new THREE.Mesh(geo, maskMat);
        mMask.position.set(xPos + xBend, yPos, z);
        mMask.rotation.y = rotY;
        const mFill = mMask.clone();
        (mFill as any).material = makeFillMat();
        mMask.renderOrder = 100;
        mFill.renderOrder = 300;
        const dir = side === 'right' ? -1 : 1;
        mFill.position.z += dir * (0.2 * depth);
        maskGroup.add(mMask);
        fillGroup.add(mFill);
      });
    }
  });
  group.add(maskGroup);
  group.add(fillGroup);
  return { group, fontCache: cache };
}
