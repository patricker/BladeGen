import * as THREE from 'three';
import type { BladeParams, ScabbardParams, TasselParams } from './types';
import { bendOffsetX, tipWidthWithKissaki, thicknessScaleAt, wavinessAt } from './math';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export type ScabbardBuildResult = {
  group: THREE.Group;
  path: THREE.CatmullRomCurve3;
  samplePoint: (u: number) => THREE.Vector3;
  sampleTangent: (u: number) => THREE.Vector3;
  length: number;
  widthAt: (u: number) => number;
};

const superellipse = (cos: number, sin: number, expX: number, expZ: number) => {
  const x = Math.sign(cos) * Math.pow(Math.abs(cos), expX);
  const z = Math.sign(sin) * Math.pow(Math.abs(sin), expZ);
  return { x, z };
};

export function buildScabbard(
  blade: BladeParams,
  scabbard: ScabbardParams
): ScabbardBuildResult | null {
  if (!scabbard?.enabled) return null;

  const bladeLength = Math.max(0.1, blade.length);
  const baseWidth = Math.max(0.02, blade.baseWidth);
  const tipWidth = Math.max(0, blade.tipWidth);
  const baseThicknessLeft = Math.max(0.01, blade.thicknessLeft ?? blade.thickness ?? 0.08);
  const baseThicknessRight = Math.max(0.01, blade.thicknessRight ?? blade.thickness ?? 0.08);
  const baseThickness = Math.max(baseThicknessLeft, baseThicknessRight);
  const tipExtensionAbs = Math.max(0, scabbard.tipExtension) * bladeLength;
  const totalLength = bladeLength + tipExtensionAbs;
  const segmentCount = Math.max(32, Math.round(totalLength * 48));

  const pathPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= segmentCount; i++) {
    const s = i / segmentCount;
    const yAbs = s * totalLength;
    const clampY = Math.min(yAbs, bladeLength);
    const tBlade = bladeLength > 1e-6 ? clampY / bladeLength : 0;
    const wav = wavinessAt(blade, tBlade);
    const cx =
      scabbard.offsetX +
      bendOffsetX(blade, clampY, bladeLength) +
      (wav.width !== 0 ? wav.center : 0);
    pathPoints.push(new THREE.Vector3(cx, yAbs, scabbard.offsetZ));
  }

  const path = new THREE.CatmullRomCurve3(pathPoints);
  path.curveType = 'centripetal';
  path.tension = 0.5;
  const frames = path.computeFrenetFrames(segmentCount, false);
  // Use the mouth/top of scabbard as a pivot/origin for local space
  const basePoint = pathPoints[0].clone();

  const throatEnd = Math.min(
    1,
    (scabbard.throatLength * bladeLength) / Math.max(1e-6, totalLength)
  );
  const locketStart = Math.min(
    1,
    (scabbard.locketOffset * bladeLength) / Math.max(1e-6, totalLength)
  );
  const locketEnd = Math.min(
    1,
    ((scabbard.locketOffset + scabbard.locketLength) * bladeLength) / Math.max(1e-6, totalLength)
  );
  const chapeStart = Math.max(
    0,
    1 - (scabbard.chapeLength * bladeLength) / Math.max(1e-6, totalLength)
  );
  const expX = THREE.MathUtils.lerp(8, 1.6, THREE.MathUtils.clamp(scabbard.bodyRoundness, 0, 1));
  const expZ = THREE.MathUtils.lerp(5, 1.3, THREE.MathUtils.clamp(scabbard.bodyRoundness, 0, 1));

  const widthCache = new Array<number>(segmentCount + 1);
  const thicknessCache = new Array<number>(segmentCount + 1);

  const computeDimensions = (s: number, index: number) => {
    const yAbs = s * totalLength;
    const clampY = Math.min(yAbs, bladeLength);
    const tBlade = bladeLength > 1e-6 ? clampY / bladeLength : 0;
    const wav = wavinessAt(blade, tBlade);
    let width = tipWidthWithKissaki(blade, tBlade, baseWidth, tipWidth);
    width = Math.max(0.01, width + Math.abs(wav.width) * 2 + scabbard.bodyMargin * 2);
    let thickness = baseThickness * thicknessScaleAt(blade, tBlade) + scabbard.bodyThickness;

    if (throatEnd > 1e-6 && s <= throatEnd) {
      const u = throatEnd > 1e-6 ? s / throatEnd : 0;
      const ease = Math.pow(THREE.MathUtils.clamp(u, 0, 1), 0.65);
      const scale = THREE.MathUtils.lerp(scabbard.throatScale, 1, ease);
      width *= scale;
      thickness *= THREE.MathUtils.lerp(scabbard.throatScale, 1, ease * 0.8);
    }

    if (locketEnd > locketStart && s >= locketStart && s <= locketEnd) {
      const span = Math.max(1e-6, locketEnd - locketStart);
      const mid = (s - locketStart) / span;
      const swell = Math.max(0, 1 - Math.pow(Math.abs(mid - 0.5) * 2, 1.6));
      width *= THREE.MathUtils.lerp(1, scabbard.locketScale, swell);
      thickness *= THREE.MathUtils.lerp(1, scabbard.locketScale, swell * 0.6);
    }

    if (s >= chapeStart) {
      const u = (s - chapeStart) / Math.max(1e-6, 1 - chapeStart);
      const scale = THREE.MathUtils.lerp(1, scabbard.chapeScale, THREE.MathUtils.clamp(u, 0, 1));
      width *= scale;
      thickness *= THREE.MathUtils.lerp(
        1,
        Math.max(scabbard.chapeScale, 0.35),
        THREE.MathUtils.clamp(u, 0, 1)
      );
    }

    widthCache[index] = width;
    thicknessCache[index] = Math.max(0.01, thickness);
  };

  for (let i = 0; i <= segmentCount; i++) {
    computeDimensions(i / segmentCount, i);
  }

  const radialSegments = 30;
  const ringStride = radialSegments + 1;
  const vertCount = (segmentCount + 1) * ringStride;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices: number[] = [];

  const offset = new THREE.Vector3();
  const tmpNormal = new THREE.Vector3();
  const tmpBinormal = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const normalVec = new THREE.Vector3();

  for (let i = 0; i <= segmentCount; i++) {
    const center = pathPoints[i];
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];
    const width = widthCache[i];
    const thickness = thicknessCache[i];
    const s = i / segmentCount;
    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2;
      const { x: ex, z: ez } = superellipse(Math.cos(theta), Math.sin(theta), expX, expZ);
      offset.copy(normal).multiplyScalar(ex * width * 0.5);
      tmpBinormal.copy(binormal).multiplyScalar(ez * thickness * 0.5);
      offset.add(tmpBinormal);
      vertex.copy(center).sub(basePoint).add(offset);
      const idx = i * ringStride + j;
      const posIdx = idx * 3;
      positions[posIdx + 0] = vertex.x;
      positions[posIdx + 1] = vertex.y;
      positions[posIdx + 2] = vertex.z;
      normalVec.copy(offset).normalize();
      normals[posIdx + 0] = normalVec.x;
      normals[posIdx + 1] = normalVec.y;
      normals[posIdx + 2] = normalVec.z;
      const uvIdx = idx * 2;
      uvs[uvIdx + 0] = j / radialSegments;
      uvs[uvIdx + 1] = s;
    }
  }

  for (let i = 0; i < segmentCount; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + j + 1;
      const d = i * ringStride + j + 1;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  bodyGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  bodyGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  bodyGeo.setIndex(indices);
  bodyGeo.computeBoundingBox();
  bodyGeo.computeBoundingSphere();

  const bodyMesh = new THREE.Mesh(bodyGeo);
  bodyMesh.name = 'ScabbardBody';

  const group = new THREE.Group();
  group.name = 'Scabbard';
  group.add(bodyMesh);

  const tipPoint = pathPoints[pathPoints.length - 1].clone();
  const tipTangent = frames.tangents[frames.tangents.length - 1].clone().normalize();
  const tipWidthLocal = widthCache[widthCache.length - 1];
  const chapeHeight = Math.max(0.03, tipWidthLocal * 0.7);
  const chapeRadius = Math.max(0.01, tipWidthLocal * 0.5);
  const chapeGeo = new THREE.ConeGeometry(chapeRadius, chapeHeight, 20, 1, true);
  const chapeMesh = new THREE.Mesh(chapeGeo);
  chapeMesh.name = 'ScabbardChape';
  const tipDir = tipTangent.lengthSq() > 1e-6 ? tipTangent : new THREE.Vector3(0, 1, 0);
  chapeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDir);
  chapeMesh.position
    .copy(tipPoint)
    .sub(basePoint)
    .add(tipDir.clone().multiplyScalar(chapeHeight * 0.4));
  group.add(chapeMesh);

  // Position the entire scabbard group at the mouth position so rotations (hang) pivot correctly
  group.position.copy(basePoint);

  if (Math.abs(scabbard.hangAngle) > 1e-6) {
    group.rotation.z = scabbard.hangAngle;
  }

  // Return local-space values for sampling; callers can transform via group
  const samplePoint = (u: number) => path.getPointAt(clamp01(u)).clone().sub(basePoint);
  const sampleTangent = (u: number) => path.getTangentAt(clamp01(u)).clone().normalize();
  const widthAt = (u: number) => {
    const clamped = clamp01(u) * segmentCount;
    const lo = Math.floor(clamped);
    const hi = Math.min(segmentCount, lo + 1);
    const alpha = clamped - lo;
    return THREE.MathUtils.lerp(widthCache[lo], widthCache[hi], alpha);
  };

  return { group, path, samplePoint, sampleTangent, length: totalLength, widthAt };
}

export function buildTassel(
  blade: BladeParams,
  tassel: TasselParams,
  opts: { anchor: THREE.Vector3; tangent?: THREE.Vector3 }
): THREE.Group | null {
  if (!tassel?.enabled) return null;

  const anchor = opts.anchor.clone();
  const tangent = opts.tangent?.clone().normalize() ?? new THREE.Vector3(0, -1, 0);
  if (tangent.lengthSq() < 1e-6) tangent.set(0, -1, 0);

  const bladeLength = Math.max(0.1, blade.length);
  const ropeLength = Math.max(0.05, tassel.length * bladeLength);
  const droop = THREE.MathUtils.clamp(tassel.droop, 0, 1);
  const sway = THREE.MathUtils.clamp(tassel.sway, -1, 1);
  const ropeRadius = Math.max(0.002, tassel.thickness * 0.5);

  const down = new THREE.Vector3(0, -1, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(tangent, up);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize().multiplyScalar(ropeLength * sway * 0.5);
  const forward = tangent.clone().normalize();
  const sag = down.clone().multiplyScalar(ropeLength * (0.25 + 0.55 * droop));

  const p0 = anchor.clone();
  const p1 = anchor
    .clone()
    .add(forward.clone().multiplyScalar(ropeLength * 0.2))
    .add(side.clone().multiplyScalar(0.4));
  const p2 = anchor.clone().add(side).add(sag);
  const p3 = anchor
    .clone()
    .add(side.clone().multiplyScalar(0.7))
    .add(down.clone().multiplyScalar(ropeLength));

  const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
  curve.curveType = 'centripetal';
  curve.tension = 0.45;

  const tubeSegments = Math.max(16, Math.round(ropeLength * 40));
  const tubeGeo = new THREE.TubeGeometry(curve, tubeSegments, ropeRadius, 12, false);
  const ropeMesh = new THREE.Mesh(tubeGeo);
  ropeMesh.name = 'TasselRope';

  const group = new THREE.Group();
  group.name = 'Tassel';
  group.add(ropeMesh);

  const knotGeo = new THREE.SphereGeometry(ropeRadius * 1.8, 12, 12);
  const knotMesh = new THREE.Mesh(knotGeo);
  knotMesh.name = 'TasselKnot';
  knotMesh.position.copy(curve.getPoint(0.08));
  group.add(knotMesh);

  const tip = curve.getPoint(1);
  const tipDirRaw = curve.getTangent(1);
  const tipDir = tipDirRaw.lengthSq() > 1e-6 ? tipDirRaw.clone().normalize() : down.clone();
  const tuftGroup = new THREE.Group();
  tuftGroup.name = 'TasselFringe';
  const strandCount = Math.max(1, tassel.strands | 0);
  const tuftRadius = Math.max(0.002, tassel.tuftSize);
  const tuftLength = Math.max(0.01, tassel.tuftLength);
  const strandGeom = new THREE.ConeGeometry(tuftRadius, tuftLength, 8, 1, true);
  strandGeom.translate(0, -tuftLength * 0.5, 0);
  for (let i = 0; i < strandCount; i++) {
    const strand = new THREE.Mesh(strandGeom);
    strand.rotation.x = Math.PI;
    if (strandCount > 1) strand.rotation.y = (i / strandCount) * Math.PI * 2;
    tuftGroup.add(strand);
  }
  const tuftTarget = tipDir.clone().negate();
  if (tuftTarget.lengthSq() < 1e-6) tuftTarget.set(0, -1, 0);
  const tuftQuat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    tuftTarget.normalize()
  );
  tuftGroup.quaternion.copy(tuftQuat);
  tuftGroup.position.copy(tip);
  group.add(tuftGroup);

  const clampGeo = new THREE.TorusGeometry(ropeRadius * 1.4, ropeRadius * 0.35, 8, 18);
  const clampMesh = new THREE.Mesh(clampGeo);
  clampMesh.name = 'TasselClamp';
  const clampPos = curve.getPoint(0.02);
  clampMesh.position.copy(clampPos);
  clampMesh.rotation.x = Math.PI / 2;
  group.add(clampMesh);

  return group;
}
