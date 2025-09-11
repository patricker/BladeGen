import * as THREE from 'three';

export type BladeParams = {
  length: number; // total blade length
  baseWidth: number; // width near guard
  tipWidth: number; // width at tip
  thickness: number; // extrusion depth (z)
  curvature: number; // -1..1, bends along x
  serrationAmplitude?: number; // 0..(baseWidth/4)
  serrationFrequency?: number; // cycles along blade
  fullerDepth?: number; // reserved (not yet applied)
  fullerLength?: number; // reserved (not yet applied)
};

export type GuardStyle = 'bar' | 'winged' | 'claw';
export type GuardParams = {
  width: number;
  thickness: number;
  curve: number; // -1..1 upward/downward curvature for winged/claw
  tilt: number; // radians tilt around Z
  style: GuardStyle;
};

export type HandleParams = {
  length: number;
  radiusTop: number;
  radiusBottom: number;
  segmentation: boolean; // add ridges
};

export type PommelStyle = 'orb' | 'disk' | 'spike';
export type PommelParams = {
  size: number;
  elongation: number; // 0.5..2 scale on Y
  style: PommelStyle;
  shapeMorph: number; // 0..1: stylistic morph per style
};

export type SwordParams = {
  blade: BladeParams;
  guard: GuardParams;
  handle: HandleParams;
  pommel: PommelParams;
};

export class SwordGenerator {
  public readonly group = new THREE.Group();
  public bladeMesh: THREE.Mesh | null = null;
  public guardMesh: THREE.Mesh | null = null;
  public handleMesh: THREE.Mesh | null = null;
  public pommelMesh: THREE.Mesh | null = null;
  private guardGroup: THREE.Group | null = null;
  private fullerGroup: THREE.Group | null = null;

  private lastParams?: SwordParams;

  constructor(initial: SwordParams) {
    this.updateGeometry(initial);
  }

  updateGeometry(params: SwordParams) {
    const p = this.validate(params);
    const prev = this.lastParams;
    this.lastParams = p;

    // Simple rebuild/scale heuristic for blade length changes only
    const bladeOnlyLengthChange =
      prev &&
      prev.blade &&
      prev.blade.length !== 0 &&
      prev.blade.baseWidth === p.blade.baseWidth &&
      prev.blade.tipWidth === p.blade.tipWidth &&
      prev.blade.thickness === p.blade.thickness &&
      prev.blade.curvature === p.blade.curvature &&
      (prev.blade.serrationAmplitude || 0) === (p.blade.serrationAmplitude || 0) &&
      (prev.blade.serrationFrequency || 0) === (p.blade.serrationFrequency || 0);

    if (bladeOnlyLengthChange && this.bladeMesh) {
      // Scale Y uniformly to match new length
      const scale = p.blade.length / prev!.blade.length;
      this.bladeMesh.scale.y = scale;
    } else {
      this.rebuildBlade(p.blade);
    }

    this.rebuildGuard(p.guard);
    this.rebuildHandle(p.handle);
    this.rebuildPommel(p.pommel);
  }

  private rebuildBlade(b: BladeParams) {
    if (this.bladeMesh) {
      this.group.remove(this.bladeMesh);
      this.disposeMesh(this.bladeMesh);
      this.bladeMesh = null;
    }

    const shape = buildBladeShape(b);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: b.thickness,
      bevelEnabled: false,
      steps: 1
    });
    geo.center();
    // Reposition so base (guard) sits near y=0 and blade extends +y
    geo.rotateX(Math.PI); // flip so positive y up
    const box = new THREE.Box3().setFromBufferAttribute(geo.getAttribute('position'));
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const offset = new THREE.Vector3(-center.x, -box.min.y, -center.z);
    geo.translate(offset.x, offset.y, offset.z);

    // Curvature: bend along x based on y position
    if (Math.abs(b.curvature) > 1e-6) {
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as unknown as number[];
      const yMin = 0;
      const yMax = size.y;
      for (let i = 0; i < pos.count; i++) {
        const ix = i * 3;
        const x = arr[ix + 0];
        const y = arr[ix + 1];
        const z = arr[ix + 2];
        const t = (y - yMin) / Math.max(1e-6, yMax - yMin);
        // Quadratic bend profile
        const bend = b.curvature * (t * t - t) * size.y; // symmetric curve
        arr[ix + 0] = x + bend;
        arr[ix + 2] = z;
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }

    const mat = new THREE.MeshStandardMaterial({ color: 0xb9c6ff, metalness: 0.7, roughness: 0.3 });
    this.bladeMesh = new THREE.Mesh(geo, mat);
    this.bladeMesh.position.y = 0.1; // slight offset above ground
    this.group.add(this.bladeMesh);

    // Fuller grooves (visual overlay): two thin insets on both faces
    if (this.fullerGroup) {
      this.group.remove(this.fullerGroup);
      this.disposeGroup(this.fullerGroup);
      this.fullerGroup = null;
    }
    if ((b.fullerDepth ?? 0) > 0 && (b.fullerLength ?? 0) > 0) {
      this.fullerGroup = buildFullerOverlays(b);
      this.fullerGroup.position.copy(this.bladeMesh.position);
      this.group.add(this.fullerGroup);
    }
  }

  private rebuildGuard(g: GuardParams) {
    // Clear existing
    if (this.guardMesh) {
      this.group.remove(this.guardMesh);
      this.disposeMesh(this.guardMesh);
      this.guardMesh = null;
    }
    if (this.guardGroup) {
      this.group.remove(this.guardGroup);
      this.disposeGroup(this.guardGroup);
      this.guardGroup = null;
    }

    const color = 0x8892b0;
    if (g.style === 'bar') {
      const geo = new THREE.BoxGeometry(g.width, 0.08, g.thickness);
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.5 });
      this.guardMesh = new THREE.Mesh(geo, mat);
      this.guardMesh.position.set(0, 0.08, 0);
      this.group.add(this.guardMesh);
    } else {
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.45 });
      const half = buildGuardHalfShape(g);
      const depth = g.thickness;
      const geoR = new THREE.ExtrudeGeometry(half, { depth, bevelEnabled: false, steps: 1 });
      geoR.center();
      const meshR = new THREE.Mesh(geoR, mat);
      meshR.rotation.y = Math.PI / 2; // orient thickness along Z
      meshR.position.set(g.width / 2 - 0.1, 0.1, 0);

      const meshL = meshR.clone();
      meshL.scale.x = -1; // mirror across X

      const group = new THREE.Group();
      group.add(meshR, meshL);
      group.rotation.z = g.tilt;
      this.guardGroup = group;
      this.group.add(group);
    }
  }

  private rebuildHandle(h: HandleParams) {
    if (this.handleMesh) {
      this.group.remove(this.handleMesh);
      this.disposeMesh(this.handleMesh);
      this.handleMesh = null;
    }
    const profile: THREE.Vector2[] = [];
    const ridges = h.segmentation ? 8 : 0;
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = -h.length / 2 + t * h.length;
      const baseR = h.radiusBottom + (h.radiusTop - h.radiusBottom) * t;
      const bump = ridges > 0 ? (Math.sin(t * Math.PI * ridges) * 0.03) : 0;
      const r = Math.max(0.02, baseR + bump);
      profile.push(new THREE.Vector2(r, y));
    }
    const geo = new THREE.LatheGeometry(profile, 48);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a6b78, metalness: 0.2, roughness: 0.8 });
    this.handleMesh = new THREE.Mesh(geo, mat);
    this.handleMesh.position.y = -h.length * 0.5;
    this.group.add(this.handleMesh);
  }

  private rebuildPommel(p: PommelParams) {
    if (this.pommelMesh) {
      this.group.remove(this.pommelMesh);
      this.disposeMesh(this.pommelMesh);
      this.pommelMesh = null;
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.6, roughness: 0.4 });
    let mesh: THREE.Mesh;
    if (p.style === 'disk') {
      const geo = new THREE.CylinderGeometry(p.size * (1.0 + p.shapeMorph), p.size * (1.0 + p.shapeMorph), p.size * 0.5, 32);
      mesh = new THREE.Mesh(geo, mat);
    } else if (p.style === 'spike') {
      const geo = new THREE.ConeGeometry(p.size * (0.8 + 0.4 * p.shapeMorph), p.size * (1.2 + p.shapeMorph), 32);
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.z = Math.PI; // point down
    } else {
      const geo = new THREE.SphereGeometry(p.size, 24, 16);
      mesh = new THREE.Mesh(geo, mat);
      // morph: squash/stretch horizontally
      const s = 1.0 + (p.shapeMorph - 0.5) * 0.6;
      mesh.scale.set(1.0 * s, 1.0, 1.0 * s);
    }
    mesh.scale.y *= THREE.MathUtils.clamp(p.elongation, 0.5, 2);
    this.pommelMesh = mesh;
    // Place pommel just below handle bottom if handle exists
    let y = -1.0;
    if (this.handleMesh) {
      this.handleMesh.updateMatrixWorld();
      const box = new THREE.Box3().setFromObject(this.handleMesh);
      if (isFinite(box.min.y)) y = box.min.y;
    }
    this.pommelMesh.position.y = y - p.size * 0.3 * p.elongation;
    this.group.add(this.pommelMesh);
  }

  private validate(params: SwordParams): SwordParams {
    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
    const b = params.blade;
    const blade: BladeParams = {
      length: clamp(b.length, 0.1, 20),
      baseWidth: clamp(b.baseWidth, 0.02, 5),
      tipWidth: clamp(b.tipWidth, 0, b.baseWidth),
      thickness: clamp(b.thickness, 0.01, 2),
      curvature: clamp(b.curvature, -1, 1),
      serrationAmplitude: clamp(b.serrationAmplitude ?? 0, 0, (b.baseWidth || 0.2) / 3),
      serrationFrequency: clamp(b.serrationFrequency ?? 0, 0, 40),
      fullerDepth: clamp(b.fullerDepth ?? 0, 0, 0.2),
      fullerLength: clamp(b.fullerLength ?? 0, 0, 1)
    };

    const g = params.guard;
    const guard: GuardParams = {
      width: clamp(g.width, 0.2, 10),
      thickness: clamp(g.thickness, 0.05, 2),
      curve: clamp(g.curve, -1, 1),
      tilt: clamp(g.tilt, -Math.PI / 2, Math.PI / 2),
      style: (g.style ?? 'bar') as GuardStyle
    };

    const h = params.handle;
    const handle: HandleParams = {
      length: clamp(h.length, 0.2, 5),
      radiusTop: clamp(h.radiusTop, 0.05, 1),
      radiusBottom: clamp(h.radiusBottom, 0.05, 1),
      segmentation: !!h.segmentation
    };

    const pm = params.pommel;
    const pommel: PommelParams = {
      size: clamp(pm.size, 0.05, 1),
      elongation: clamp(pm.elongation, 0.5, 2),
      style: (pm.style ?? 'orb') as PommelStyle,
      shapeMorph: clamp(pm.shapeMorph, 0, 1)
    };

    return { blade, guard, handle, pommel };
  }

  private disposeMesh(mesh: THREE.Mesh) {
    (mesh.geometry as any)?.dispose?.();
    const mat = mesh.material as THREE.Material | THREE.Material[];
    if (Array.isArray(mat)) mat.forEach((m) => (m as any)?.dispose?.());
    else (mat as any)?.dispose?.();
  }

  private disposeGroup(group: THREE.Group) {
    group.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        (m.geometry as any)?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => (x as any)?.dispose?.());
        else (mat as any)?.dispose?.();
      }
    });
  }
}

function buildBladeShape(b: BladeParams): THREE.Shape {
  const length = b.length;
  const baseW = b.baseWidth;
  const tipW = Math.max(0, Math.min(b.tipWidth, baseW));

  // Build an outline from base (y=0) to tip (y=length), symmetric around x=0
  const pointsRight: THREE.Vector2[] = [];
  const pointsLeft: THREE.Vector2[] = [];
  const steps = 100;
  const serrAmp = b.serrationAmplitude ?? 0;
  const serrFreq = b.serrationFrequency ?? 0;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * length;
    const w = baseW + (tipW - baseW) * t; // linear taper
    const serr = serrAmp > 0 && serrFreq > 0 ? Math.sin(t * Math.PI * serrFreq) * serrAmp * (1 - t) : 0;
    const half = Math.max(0.001, w * 0.5 + serr);
    pointsRight.push(new THREE.Vector2(+half, y));
    pointsLeft.push(new THREE.Vector2(-half, y));
  }

  const shape = new THREE.Shape();
  // Start at base right, go to tip, then back along left
  shape.moveTo(pointsRight[0].x, pointsRight[0].y);
  for (let i = 1; i < pointsRight.length; i++) shape.lineTo(pointsRight[i].x, pointsRight[i].y);
  for (let i = pointsLeft.length - 1; i >= 0; i--) shape.lineTo(pointsLeft[i].x, pointsLeft[i].y);
  shape.closePath();
  return shape;
}

export function defaultSwordParams(): SwordParams {
  return {
    blade: {
      length: 3.0,
      baseWidth: 0.25,
      tipWidth: 0.05,
      thickness: 0.08,
      curvature: 0.0,
      serrationAmplitude: 0.0,
      serrationFrequency: 0,
      fullerDepth: 0.02,
      fullerLength: 0.6
    },
    guard: {
      width: 1.2,
      thickness: 0.2,
      curve: 0.3,
      tilt: 0.0,
      style: 'winged'
    },
    handle: {
      length: 0.9,
      radiusTop: 0.12,
      radiusBottom: 0.12,
      segmentation: true
    },
    pommel: {
      size: 0.16,
      elongation: 1.0,
      style: 'orb',
      shapeMorph: 0.2
    }
  };
}

function buildFullerOverlays(b: BladeParams): THREE.Group {
  const group = new THREE.Group();
  const color = 0x475569; // darker groove
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.7 });
  const length = b.length * THREE.MathUtils.clamp(b.fullerLength ?? 0, 0, 1);
  const width = Math.max(0.01, (b.baseWidth * 0.4));
  const depth = Math.min(b.thickness * 0.6, Math.max(0.005, b.fullerDepth ?? 0.01));
  const offsetY = length * 0.5; // center along blade upper half

  // Two grooves on both sides (z near 0 and z near thickness)
  const buildStrip = (z: number) => {
    const geo = new THREE.BoxGeometry(width, length, depth);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, offsetY + 0.1, z);
    return mesh;
  };
  group.add(buildStrip(depth * 0.25), buildStrip(b.thickness - depth * 0.25));
  return group;
}

function buildGuardHalfShape(g: GuardParams): THREE.Shape {
  const w = Math.max(0.2, g.width * 0.5);
  const h = 0.15 + Math.abs(g.curve) * 0.3;
  const shape = new THREE.Shape();
  if (g.style === 'winged') {
    // Curved, broad wing
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(w * 0.45, g.curve * h, w, 0.02);
    shape.lineTo(w * 0.85, -0.06);
    shape.lineTo(0, -0.02);
    shape.closePath();
  } else if (g.style === 'claw') {
    // Narrower, pointy prong
    const tipY = 0.06 + g.curve * h;
    shape.moveTo(0, 0);
    shape.lineTo(w * 0.8, tipY);
    shape.lineTo(w * 0.7, -0.07);
    shape.lineTo(0, -0.02);
    shape.closePath();
  } else {
    // fallback small bar half
    shape.moveTo(0, 0);
    shape.lineTo(w, 0);
    shape.lineTo(w, -0.05);
    shape.lineTo(0, -0.05);
    shape.closePath();
  }
  return shape;
}
