import * as THREE from 'three';
import type { PommelParams, BladeParams } from './types';

/**
 * Build the pommel mesh given params and an optional handle mesh for placement.
 * Placement: just below the handle bottom; caller adds to the parent group.
 */
export function buildPommel(
  p: PommelParams,
  ctx: { handleMesh?: THREE.Mesh | null; blade?: BladeParams | null },
  makeMaterial: (part: 'pommel') => THREE.Material
): THREE.Mesh {
  const mat = makeMaterial('pommel');
  let mesh: THREE.Mesh;
  const facets = Math.max(6, Math.round(p.facetCount ?? 32));

  // Auto-balance size from blade mass proxy if desired
  const bal = THREE.MathUtils.clamp(p.balance ?? 0, 0, 1);
  const b = ctx.blade;
  const mass = b
    ? b.length *
      ((b.baseWidth + b.tipWidth) * 0.5) *
      (((b.thicknessLeft ?? b.thickness ?? 0.08) + (b.thicknessRight ?? b.thickness ?? 0.08)) * 0.5)
    : 1.0;
  const sizeAuto = Math.cbrt(Math.max(1e-6, mass)) * 0.35;
  const sizeEff = THREE.MathUtils.clamp(THREE.MathUtils.lerp(p.size, sizeAuto, bal), 0.05, 1.0);

  if (p.style === 'disk') {
    const heightY = Math.max(0.02, sizeEff * 0.15);
    const geo = new THREE.CylinderGeometry(
      sizeEff * (1.0 + p.shapeMorph),
      sizeEff * (1.0 + p.shapeMorph),
      heightY,
      facets
    );
    mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(0, 0, 0);
  } else if (p.style === 'spike') {
    const height = sizeEff * (1.2 + p.shapeMorph) * (p.spikeLength ?? 1);
    const geo = new THREE.ConeGeometry(sizeEff * (0.8 + 0.4 * p.shapeMorph), height, facets);
    mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.z = Math.PI;
  } else if (p.style === 'wheel') {
    const height = Math.max(0.02, sizeEff * 0.18);
    const radius = sizeEff * (1.0 + 0.2 * (p.shapeMorph ?? 0));
    const geo = new THREE.CylinderGeometry(radius, radius, height, facets);
    mesh = new THREE.Mesh(geo, mat);
  } else if (p.style === 'scentStopper') {
    const geo = new THREE.OctahedronGeometry(
      sizeEff * (0.9 + 0.2 * (p.shapeMorph ?? 0)),
      Math.max(0, Math.round((p.shapeMorph ?? 0) * 2))
    );
    mesh = new THREE.Mesh(geo, mat);
    mesh.scale.y *= THREE.MathUtils.clamp(p.elongation, 0.5, 2);
  } else if (p.style === 'ring') {
    const inner = Math.max(0.01, p.ringInnerRadius ?? sizeEff * 0.4);
    const tube = Math.max(0.004, sizeEff * 0.12);
    const geo = new THREE.TorusGeometry(inner + tube, tube, 12, Math.max(12, Math.round(facets)));
    mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
  } else if (p.style === 'crown') {
    const spikes = Math.max(5, Math.round(p.crownSpikes ?? 8));
    const sharp = THREE.MathUtils.clamp(p.crownSharpness ?? 0.6, 0, 1);
    const height = sizeEff * (0.18 + 0.3 * sharp);
    const geo = new THREE.ConeGeometry(
      sizeEff * (0.9 + 0.2 * (p.shapeMorph ?? 0)),
      height,
      spikes,
      1,
      false
    );
    mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.z = Math.PI;
  } else if (p.style === 'fishtail') {
    const width = sizeEff * (1.6 + 0.4 * (p.shapeMorph ?? 0));
    const height = sizeEff * 0.25;
    const depth = sizeEff * (0.5 + 0.3 * (p.shapeMorph ?? 0));
    const geo = new THREE.BoxGeometry(
      width,
      height,
      depth,
      Math.max(2, Math.round(facets / 2)),
      Math.max(1, Math.round(facets / 4)),
      Math.max(2, Math.round(facets / 2))
    );
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as unknown as number[];
    for (let i = 0; i < pos.count; i++) {
      const idx = i * 3;
      const x = arr[idx];
      const y = arr[idx + 1];
      const z = arr[idx + 2];
      const yNorm = THREE.MathUtils.clamp(y / (height * 0.5), -1, 1);
      const flare = Math.pow(Math.abs(yNorm), 1.3);
      const xScale = 1 + flare * (yNorm >= 0 ? 1.1 : 0.6);
      const zScale = 1 - 0.5 * flare;
      arr[idx] = x * xScale;
      arr[idx + 2] = z * zScale;
      arr[idx + 1] = y * (1 + 0.15 * yNorm);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    mesh = new THREE.Mesh(geo, mat);
  } else {
    const geo = new THREE.SphereGeometry(sizeEff, facets, Math.max(8, Math.round(facets / 2)));
    mesh = new THREE.Mesh(geo, mat);
    const s = 1.0 + (p.shapeMorph - 0.5) * 0.6;
    mesh.scale.set(1.0 * s, 1.0, 1.0 * s);
  }
  if (
    p.style !== 'disk' &&
    p.style !== 'wheel' &&
    p.style !== 'ring' &&
    p.style !== 'crown' &&
    p.style !== 'scentStopper'
  ) {
    mesh.scale.y *= THREE.MathUtils.clamp(p.elongation, 0.5, 2);
  }
  mesh.geometry.computeBoundingBox();
  const geoTop = mesh.geometry.boundingBox?.max.y ?? sizeEff;
  // Place just below handle bottom
  let y = -1.0;
  if (ctx.handleMesh) {
    ctx.handleMesh.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(ctx.handleMesh);
    if (isFinite(box.min.y)) y = box.min.y;
  }
  mesh.position.y = y - sizeEff * 0.3 * p.elongation + (p.offsetY ?? 0);
  mesh.position.x = p.offsetX ?? 0;
  mesh.castShadow = true;

  if ((p as any).peenVisible && p.style !== 'ring') {
    const peenSize = THREE.MathUtils.clamp((p as any).peenSize ?? 0.02, 0.005, 0.1);
    const shape = ((p as any).peenShape ?? 'dome') as 'dome' | 'block';
    const peenGeo =
      shape === 'block'
        ? new THREE.BoxGeometry(peenSize, peenSize * 0.4, peenSize)
        : new THREE.SphereGeometry(peenSize * 0.5, 12, 8);
    const baseMat = mesh.material as THREE.MeshStandardMaterial;
    const peenMat = baseMat.clone();
    if (peenMat.color) peenMat.color = baseMat.color.clone().offsetHSL(0, -0.05, 0.1);
    const peen = new THREE.Mesh(peenGeo, peenMat);
    const topOffset = geoTop * mesh.scale.y + peenSize * 0.4;
    peen.position.set(p.offsetX ?? 0, topOffset, 0);
    mesh.add(peen);
  }

  return mesh;
}
