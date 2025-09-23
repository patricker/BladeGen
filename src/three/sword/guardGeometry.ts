import * as THREE from 'three';
import type { GuardParams } from './types';
import { buildGuardHalfShape } from './guardShapes';

/**
 * Build guard geometry based on style. Returns either a single mesh (guardMesh)
 * or an aggregate group (guardGroup) for multi-part designs.
 *
 * Positions/rotations are set relative to the computed target top Y (aligned
 * to the blade base). The caller is responsible for adding the result to a
 * parent group.
 */
export function buildGuard(
  g: GuardParams,
  ctx: {
    bladeMesh?: THREE.Mesh | null;
    handleMesh?: THREE.Mesh | null;
    makeMaterial: (part: 'guard') => THREE.Material;
  }
): { guardMesh?: THREE.Mesh; guardGroup?: THREE.Group } {
  // Compute guard placement: align its top to the blade base
  const GUARD_HEIGHT = 0.08;
  let bladeBaseY: number | undefined;
  if (ctx.bladeMesh) {
    const bb = new THREE.Box3().setFromObject(ctx.bladeMesh);
    if (isFinite(bb.min.y)) bladeBaseY = bb.min.y;
  }
  const targetTopY = (bladeBaseY ?? 0.0) + (g.heightOffset ?? 0);

  if (g.style === 'bar') {
    const geo = new THREE.BoxGeometry(g.width, GUARD_HEIGHT, g.thickness);
    const gmat = ctx.makeMaterial('guard');
    const guardMesh = new THREE.Mesh(geo, gmat);
    guardMesh.castShadow = true;
    guardMesh.position.set(0, targetTopY - GUARD_HEIGHT * 0.5, 0);
    return { guardMesh };
  } else if (g.style === 'disk') {
    const radius = Math.max(0.05, g.width * 0.5);
    const heightY = Math.max(0.04, Math.min(0.2, g.thickness));
    const shape = new THREE.Shape();
    shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
    const holes = Math.max(0, Math.min(24, Math.round(g.cutoutCount ?? 0)));
    const rHole = radius * Math.max(0.1, Math.min(0.8, g.cutoutRadius ?? 0.5));
    for (let i = 0; i < holes; i++) {
      const a = (i / holes) * Math.PI * 2;
      const cx = Math.cos(a) * (radius * 0.55);
      const cy = Math.sin(a) * (radius * 0.55);
      const path = new THREE.Path();
      path.absarc(cx, cy, rHole * 0.2, 0, Math.PI * 2, false);
      shape.holes.push(path);
    }
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: heightY,
      bevelEnabled: false,
      steps: 1,
      curveSegments: Math.max(12, Math.round(g.curveSegments ?? 24)),
    });
    geo.center();
    const gmat2 = ctx.makeMaterial('guard') as any;
    gmat2.side = THREE.DoubleSide;
    const guardMesh = new THREE.Mesh(geo, gmat2);
    guardMesh.castShadow = true;
    guardMesh.position.set(0, targetTopY, 0);
    guardMesh.rotation.x = Math.PI / 2;
    guardMesh.rotation.z = g.tilt;
    return { guardMesh };
  } else if (g.style === 'knucklebow') {
    const group = new THREE.Group();
    const yTop = targetTopY;
    let yArc = yTop - 0.15;
    if (ctx.handleMesh) {
      const hb = new THREE.Box3().setFromObject(ctx.handleMesh);
      if (isFinite(hb.min.y) && isFinite(hb.max.y)) {
        const H = Math.max(0.05, hb.max.y - hb.min.y);
        yArc = yTop - Math.max(0.08, Math.min(0.22, H * 0.35));
      }
    }
    const xHalf = Math.max(0.2, g.width * 0.5);
    const p0 = new THREE.Vector3(+xHalf, yTop, 0);
    const p3 = new THREE.Vector3(-xHalf, yTop, 0);
    const p1 = new THREE.Vector3(+xHalf * 0.9, yArc, 0);
    const p2 = new THREE.Vector3(-xHalf * 0.9, yArc, 0);
    const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
    const tubular = Math.max(24, Math.round(48 + ((g as any).ornamentation ?? 0) * 24));
    const radius = Math.max(0.01, Math.min(0.06, g.thickness * 0.25));
    const tube = new THREE.TubeGeometry(curve, tubular, radius, 12, false);
    const gmat = ctx.makeMaterial('guard');
    const bow = new THREE.Mesh(tube, gmat);
    bow.castShadow = true;
    group.add(bow);
    group.rotation.z = g.tilt;
    return { guardGroup: group };
  } else if (g.style === 'shell') {
    const baseMat = ctx.makeMaterial('guard') as THREE.MeshStandardMaterial;
    const groupMat = baseMat.clone() as THREE.MeshStandardMaterial;
    groupMat.side = THREE.DoubleSide;
    const radius = Math.max(0.12, g.width * 0.45);
    const coverage = THREE.MathUtils.clamp((g as any).shellCoverage ?? 0.75, 0.3, 1);
    const height = Math.max(
      0.05,
      g.thickness * THREE.MathUtils.clamp((g as any).shellThickness ?? 1, 0.2, 1.5)
    );
    const flare = THREE.MathUtils.clamp((g as any).shellFlare ?? 1, 0.5, 2);
    const profileSegments = Math.max(12, Math.round((g.curveSegments ?? 12) * 2));
    const profile: THREE.Vector2[] = [];
    const angleMax = coverage * Math.PI * 0.5;
    for (let i = 0; i <= profileSegments; i++) {
      const t = i / profileSegments;
      const angle = t * angleMax;
      const x = Math.sin(angle) * radius;
      const y = -Math.cos(angle) * height;
      profile.push(new THREE.Vector2(x, y));
    }
    const latheSegments = Math.max(24, Math.round((g.curveSegments ?? 12) * 2));
    const geo = new THREE.LatheGeometry(profile, latheSegments);
    const shell = new THREE.Mesh(geo, groupMat);
    shell.castShadow = true;
    shell.scale.z *= flare;
    shell.rotation.x = Math.PI;
    const bb = new THREE.Box3().setFromObject(shell);
    const offsetY = targetTopY - bb.max.y;
    shell.position.set(0, offsetY, 0);
    shell.rotation.z = g.tilt;
    return { guardMesh: shell };
  } else if ((g as any).style === 'swept') {
    const group = new THREE.Group();
    const xHalf = Math.max(0.2, g.width * 0.5);
    const yTop = targetTopY;
    let yEnd = yTop - 0.28;
    if (ctx.handleMesh) {
      const hb = new THREE.Box3().setFromObject(ctx.handleMesh);
      if (isFinite(hb.min.y) && isFinite(hb.max.y)) {
        const H = hb.max.y - hb.min.y;
        yEnd = yTop - Math.max(0.18, Math.min(0.35, H * 0.5));
      }
    }
    const gmat = ctx.makeMaterial('guard');
    const count = Math.max(2, Math.round(3 + (g.ornamentation ?? 0) * 4));
    const radius = Math.max(0.006, Math.min(0.04, g.thickness * 0.2));
    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 0 : i / (count - 1);
      const side = i % 2 === 0 ? 1 : -1;
      const spread = THREE.MathUtils.lerp(0.2, 0.8, t);
      const zOff = THREE.MathUtils.lerp(0.06, 0.14, t) * side;
      const p0 = new THREE.Vector3(xHalf * spread * side, yTop, 0);
      const p3 = new THREE.Vector3(xHalf * (spread * 0.4) * side, yEnd, zOff);
      const p1 = new THREE.Vector3(xHalf * spread * side, (yTop + yEnd) * 0.6, zOff * 0.3);
      const p2 = new THREE.Vector3(xHalf * (spread * 0.6) * side, (yTop + yEnd) * 0.4, zOff * 0.8);
      const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
      const tube = new THREE.TubeGeometry(curve, 48, radius, 12, false);
      const bar = new THREE.Mesh(tube, gmat);
      bar.castShadow = true;
      group.add(bar);
    }
    group.rotation.z = g.tilt;
    return { guardGroup: group };
  } else if ((g as any).style === 'basket') {
    const group = new THREE.Group();
    const yTop = targetTopY;
    let yBottom = yTop - 0.25;
    if (ctx.handleMesh) {
      const hb = new THREE.Box3().setFromObject(ctx.handleMesh);
      if (isFinite(hb.min.y) && isFinite(hb.max.y)) {
        const H = hb.max.y - hb.min.y;
        yBottom = yTop - Math.max(0.18, Math.min(0.35, H * 0.45));
      }
    }
    const hParams: any = {}; // details are cosmetic; ring radius derived below
    const rTopBase = hParams.radiusTop ?? 0.12;
    const oval = hParams.ovalRatio ?? 1.0;
    const avgR = 0.5 * (rTopBase * oval + rTopBase / Math.max(1e-6, oval));
    const margin = 0.05 + (g.ornamentation ?? 0) * 0.02;
    const ringR = avgR + margin;
    const gmat = ctx.makeMaterial('guard');
    const count = Math.max(
      4,
      Math.round((g as any).basketRodCount ?? 6 + (g.ornamentation ?? 0) * 6)
    );
    const rodR = Math.max(0.004, Math.min(0.08, (g as any).basketRodRadius ?? g.thickness * 0.18));
    for (let i = 0; i < count; i++) {
      const phi = (i / count) * Math.PI * 2;
      const xTop = Math.cos(phi) * ringR;
      const zTop = Math.sin(phi) * ringR;
      const xBot = Math.cos(phi) * (ringR * 0.7);
      const zBot = Math.sin(phi) * (ringR * 0.7);
      const p0 = new THREE.Vector3(xTop, yTop, zTop);
      const p3 = new THREE.Vector3(xBot, yBottom, zBot);
      const p1 = new THREE.Vector3(xTop * 0.95, (yTop + yBottom) * 0.7, zTop * 0.7);
      const p2 = new THREE.Vector3(xTop * 0.85, (yTop + yBottom) * 0.45, zTop * 0.4);
      const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
      const tube = new THREE.TubeGeometry(curve, 64, rodR, 12, false);
      const rod = new THREE.Mesh(tube, gmat);
      rod.castShadow = true;
      group.add(rod);
    }
    const ringCount = Math.max(0, Math.min(2, Math.round((g as any).basketRingCount ?? 1)));
    const ringAdd = Math.max(0, (g as any).basketRingRadiusAdd ?? 0);
    const ringMinor = Math.max(
      0.002,
      Math.min(0.06, (g as any).basketRingThickness ?? Math.max(0.5 * rodR, 0.008))
    );
    const buildRing = (y: number) => {
      const tor = new THREE.TorusGeometry(ringR + ringAdd, ringMinor, 10, 48);
      const ring = new THREE.Mesh(tor, gmat);
      ring.position.set(0, y, 0);
      ring.rotation.x = Math.PI / 2;
      ring.castShadow = true;
      group.add(ring);
    };
    if (ringCount >= 1) buildRing(yTop - 0.02);
    if (ringCount >= 2) buildRing(yBottom + 0.02);
    group.rotation.z = g.tilt;
    return { guardGroup: group };
  } else {
    const gmat3 = ctx.makeMaterial('guard') as any;
    gmat3.side = THREE.DoubleSide;
    const half = buildGuardHalfShape(g);
    const depth = g.thickness;
    const geoR = new THREE.ExtrudeGeometry(half, {
      depth,
      bevelEnabled: false,
      steps: 1,
      curveSegments: Math.max(3, Math.min(64, Math.round(g.curveSegments ?? 12))),
    });
    const meshR = new THREE.Mesh(geoR, gmat3);
    // Center both halves across Z so they overlap into a single thickness
    meshR.position.set(0, 0, -depth / 2);
    const meshL = meshR.clone();
    meshL.scale.x = -1;
    // Keep the same Z centering for the mirrored half
    meshL.position.set(0, 0, -depth / 2);
    const group = new THREE.Group();
    group.add(meshR, meshL);
    const hb = new THREE.Box3().setFromObject(group);
    if (isFinite(hb.min.y) && isFinite(hb.max.y)) {
      const H = hb.max.y - hb.min.y;
      const desiredTopY = targetTopY;
      const baseY = hb.max.y;
      const dy = desiredTopY - baseY;
      group.position.y = dy;
    }
    group.rotation.z = g.tilt;
    return { guardGroup: group };
  }
}
