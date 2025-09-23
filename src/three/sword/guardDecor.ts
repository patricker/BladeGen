import * as THREE from 'three';
import type { GuardParams, BladeParams } from './types';

/**
 * Adds quillons, extras (side rings/loops/finger guard), optional fillet, and optional
 * habaki to the sword group based on guard parameters.
 */
export function decorateGuard(
  g: GuardParams,
  ctx: {
    swordGroup: THREE.Group;
    guardGroup?: THREE.Group | null;
    bladeMesh?: THREE.Mesh | null;
    handleMesh?: THREE.Mesh | null;
    bladeParams?: BladeParams | null;
    makeMaterial: (part: 'guard') => THREE.Material;
  }
): { guardGroup?: THREE.Group } {
  // Placement targets
  let bladeBaseY: number | undefined;
  if (ctx.bladeMesh) {
    const bb = new THREE.Box3().setFromObject(ctx.bladeMesh);
    if (isFinite(bb.min.y)) bladeBaseY = bb.min.y;
  }
  const targetTopY = (bladeBaseY ?? 0.0) + (g.heightOffset ?? 0);

  // Guard extras container (attach to sword group)
  const extras = (g as any).extras as GuardParams['extras'] | undefined;
  let createdGroup: THREE.Group | undefined;
  let container = ctx.guardGroup ?? null;
  const ensureContainer = () => {
    if (container) return container;
    const fresh = ctx.guardGroup ?? new THREE.Group();
    if (!ctx.guardGroup) {
      ctx.swordGroup.add(fresh);
      createdGroup = fresh;
    }
    container = fresh;
    return fresh;
  };
  const gmatX = ctx.makeMaterial('guard');

  if (extras && extras.length) {
    const cont = ensureContainer();
    extras.forEach((ex) => {
      if (ex.kind === 'sideRing') {
        const R = Math.max(0.01, ex.radius);
        const r = Math.max(0.004, (ex.thickness ?? 0.03) * 0.5);
        const tor = new THREE.TorusGeometry(R, r, 10, 28);
        const ringL = new THREE.Mesh(tor, gmatX);
        ringL.position.set(
          -Math.max(0.2, g.width * 0.5) - R * 0.2,
          targetTopY + (ex.offsetY || 0),
          0
        );
        ringL.rotation.y = Math.PI / 2;
        cont.add(ringL);
        const ringR = ringL.clone();
        ringR.position.x *= -1;
        cont.add(ringR);
      } else if (ex.kind === 'loop') {
        const R = Math.max(0.01, ex.radius);
        const r = Math.max(0.004, (ex.thickness ?? 0.02) * 0.5);
        const tor = new THREE.TorusGeometry(R, r, 10, 28);
        const xHalf = Math.max(0.2, g.width * 0.5);
        const loopL = new THREE.Mesh(tor, gmatX);
        loopL.position.set(-xHalf, targetTopY + (ex.offsetY || 0), 0);
        loopL.rotation.x = Math.PI / 2;
        if (ex.tilt) loopL.rotation.z = ex.tilt;
        cont.add(loopL);
        const loopR = loopL.clone();
        loopR.position.x = +xHalf;
        cont.add(loopR);
      } else if (ex.kind === 'fingerGuard') {
        const xHalf = Math.max(0.2, g.width * 0.5);
        const yTop = targetTopY;
        const yArc = yTop - Math.max(0.06, Math.min(0.14, ex.radius || 0.12));
        const p0 = new THREE.Vector3(+xHalf * 0.6, yTop, 0);
        const p3 = new THREE.Vector3(-xHalf * 0.6, yTop, 0);
        const p1 = new THREE.Vector3(+xHalf * 0.5, yArc, 0);
        const p2 = new THREE.Vector3(-xHalf * 0.5, yArc, 0);
        const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
        const tube = new THREE.TubeGeometry(
          curve,
          36,
          Math.max(0.005, (ex.thickness ?? 0.03) * 0.5),
          10,
          false
        );
        const fg = new THREE.Mesh(tube, gmatX);
        cont.add(fg);
      }
    });
    // container already attached if newly created
  }

  // Langets hugging blade flats
  const langets = g.langets;
  if (langets && langets.enabled) {
    const cont = ensureContainer();
    const length = Math.max(0.02, langets.length ?? 0.12);
    const width = Math.max(0.005, langets.width ?? 0.04);
    const thickness = Math.max(0.002, langets.thickness ?? 0.01);
    const bladeW = ctx.bladeParams?.baseWidth ?? 0.25;
    const bladeT = Math.max(
      ctx.bladeParams?.thicknessLeft ?? 0.08,
      ctx.bladeParams?.thicknessRight ?? 0.08
    );
    const offsetX = Math.max(0, bladeW * 0.5 - width * 0.5);
    const posY = targetTopY - length * 0.5;
    const buildLanget = (sign: number) => {
      const geo = new THREE.BoxGeometry(width, length, thickness);
      const mesh = new THREE.Mesh(geo, gmatX);
      mesh.position.set(offsetX * sign, posY, 0);
      cont.add(mesh);
    };
    buildLanget(+1);
    buildLanget(-1);
  }

  // Pas d'âne (finger rings)
  const pasCount = Math.max(0, Math.min(2, g.pasDaneCount ?? 0));
  if (pasCount > 0) {
    const cont = ensureContainer();
    const radius = Math.max(0.01, g.pasDaneRadius ?? 0.05);
    const thickness = Math.max(0.002, g.pasDaneThickness ?? 0.01);
    const offsetY = g.pasDaneOffsetY ?? 0;
    const bladeT = Math.max(
      ctx.bladeParams?.thicknessLeft ?? 0.08,
      ctx.bladeParams?.thicknessRight ?? 0.08
    );
    const spacingZ = bladeT * 0.5 + radius * 0.7;
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 12, 32), gmatX);
    baseRing.rotation.y = Math.PI / 2;
    baseRing.position.set(0, targetTopY + offsetY, spacingZ);
    cont.add(baseRing);
    const rearRing = baseRing.clone();
    rearRing.position.z = -spacingZ;
    cont.add(rearRing);
    if (pasCount > 1) {
      const spacingX = (ctx.bladeParams?.baseWidth ?? 0.25) * 0.5 + radius * 0.5;
      const sideRing = baseRing.clone();
      sideRing.rotation.y = 0;
      sideRing.rotation.x = Math.PI / 2;
      sideRing.position.set(spacingX, targetTopY + offsetY, 0);
      cont.add(sideRing);
      const sideRingR = sideRing.clone();
      sideRingR.position.x = -spacingX;
      cont.add(sideRingR);
    }
  }

  // Guard-blade blend fillet
  const fillet = Math.max(0, Math.min(1, (g as any).guardBlendFillet ?? 0));
  if (fillet > 0) {
    const bladeW = ctx.bladeParams?.baseWidth ?? 0.25;
    const bladeT = Math.max(
      ctx.bladeParams?.thicknessLeft ?? 0.08,
      ctx.bladeParams?.thicknessRight ?? 0.08
    );
    const w = bladeW * (1.02 + fillet * 0.06);
    const h = 0.01 + fillet * 0.02;
    const d = bladeT * (0.9 + fillet * 0.2);
    const matF = ctx.makeMaterial('guard');
    const style = ((g as any).guardBlendFilletStyle ?? 'box') as 'box' | 'smooth';
    let fil: THREE.Mesh;
    if (style === 'smooth') {
      const cyl = new THREE.CylinderGeometry(0.5, 0.5, h, 32);
      fil = new THREE.Mesh(cyl, matF);
      fil.scale.set(w, 1, d);
      fil.position.set(0, targetTopY + h * 0.5, 0);
    } else {
      const box = new THREE.BoxGeometry(w, h, d);
      fil = new THREE.Mesh(box, matF);
      fil.position.set(0, targetTopY + h * 0.5, 0);
    }
    ctx.swordGroup.add(fil);
  }

  // Habaki (blade collar)
  if (!!g.habakiEnabled) {
    const hbHeight = Math.max(0.02, g.habakiHeight ?? 0.06);
    const margin = Math.max(0.005, g.habakiMargin ?? 0.01);
    const bladeW = ctx.bladeParams?.baseWidth ?? 0.25;
    const bladeT = Math.max(
      ctx.bladeParams?.thicknessLeft ?? 0.08,
      ctx.bladeParams?.thicknessRight ?? 0.08
    );
    const geo = new THREE.BoxGeometry(bladeW + 2 * margin, hbHeight, bladeT + 2 * margin);
    const mat = new THREE.MeshStandardMaterial({ color: 0xb1976b, metalness: 0.6, roughness: 0.4 });
    const habaki = new THREE.Mesh(geo, mat);
    habaki.position.set(0, (bladeBaseY ?? 0) + hbHeight * 0.5, 0);
    ctx.swordGroup.add(habaki);
  }

  // Quillons
  const qc = Math.max(0, Math.min(4, Math.round(g.quillonCount ?? 0)));
  if (qc > 0) {
    const cont = ensureContainer();
    const qLen = Math.max(0.05, g.quillonLength ?? 0.25);
    const qRad = Math.max(0.01, 0.025 + (g.ornamentation ?? 0) * 0.02);
    const qMat = ctx.makeMaterial('guard');
    const cyl = new THREE.CylinderGeometry(
      qRad,
      qRad,
      qLen,
      Math.max(8, Math.round(12 + (g.ornamentation ?? 0) * 12))
    );
    const tipSharp = Math.max(0, Math.min(1, g.tipSharpness ?? 0.5));
    const cone = new THREE.ConeGeometry(qRad * (0.8 + 0.4 * tipSharp), qLen * 0.25 * tipSharp, 12);
    const addQuillon = (xSign: number, yOffset: number) => {
      const q = new THREE.Mesh(cyl, qMat);
      q.rotation.z = Math.PI / 2;
      q.position.set((g.width * 0.5 + qLen * 0.5) * xSign, targetTopY + yOffset, 0);
      // Tag for potential future cleanups and ensure quillons are owned by guard group
      q.userData.guardDecor = true;
      cont.add(q);
      const t = new THREE.Mesh(cone, qMat);
      t.rotation.z = Math.PI / 2;
      t.position.set((g.width * 0.5 + qLen) * xSign, targetTopY + yOffset, 0);
      t.userData.guardDecor = true;
      cont.add(t);
    };
    addQuillon(+1, 0);
    addQuillon(-1, 0);
    if (qc >= 4) {
      addQuillon(+1, 0.08);
      addQuillon(-1, -0.08);
    }
  }
  return { guardGroup: createdGroup };
}
