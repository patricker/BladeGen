import * as THREE from 'three';

export type BladeParams = {
  length: number; // total blade length
  baseWidth: number; // width near guard
  tipWidth: number; // width at tip
  thickness: number; // extrusion depth (z)
  curvature: number; // -1..1, bends along x
  serrationAmplitude?: number; // 0..(baseWidth/4)
  serrationFrequency?: number; // cycles along blade
  serrationAmplitudeLeft?: number; // independent L/R serration
  serrationAmplitudeRight?: number;
  fullerDepth?: number; // visual groove depth hint
  fullerLength?: number; // 0..1 portion of blade length
  fullerEnabled?: boolean; // render fuller overlays
  fullerCount?: number; // 0..3 number of grooves per face
  sweepSegments?: number; // longitudinal detail for blade sweep
  chaos?: number; // 0..1 small edge roughness
  asymmetry?: number; // -1..1 widen right(+) or left(-)
  edgeType?: 'single' | 'double';
  thicknessLeft?: number; // per-edge thickness (z) on left edge
  thicknessRight?: number; // per-edge thickness (z) on right edge
  baseAngle?: number; // radians: initial tangent angle at blade base
  soriProfile?: 'torii' | 'koshi' | 'saki';
  soriBias?: number; // 0.3..3 exponent weight for profile
  kissakiLength?: number; // 0..0.35 fraction of length at tip
  kissakiRoundness?: number; // 0..1 easing of tip taper (0 sharp, 1 round)
  hamonEnabled?: boolean;
  hamonWidth?: number; // band width across X (inside from edge)
  hamonAmplitude?: number; // waviness amplitude across X
  hamonFrequency?: number; // waves along blade
  hamonSide?: 'auto' | 'left' | 'right' | 'both';
  twistAngle?: number; // radians of total twist from base to tip
};

export type GuardStyle = 'bar' | 'winged' | 'claw' | 'disk';
export type GuardParams = {
  width: number;
  thickness: number;
  curve: number; // -1..1 upward/downward curvature for winged/claw
  tilt: number; // radians tilt around Z
  style: GuardStyle;
  curveSegments?: number; // tessellation for 2D shape
  habakiEnabled?: boolean;
  habakiHeight?: number;
  habakiMargin?: number;
  heightOffset?: number; // vertical offset from blade base for guard placement
};

export type HandleParams = {
  length: number;
  radiusTop: number;
  radiusBottom: number;
  segmentation: boolean; // add ridges
  wrapEnabled?: boolean; // helical wrap pattern
  wrapTurns?: number; // number of helical turns along length
  wrapDepth?: number; // radial amplitude of wrap
  phiSegments?: number; // radial tessellation
  wrapTexture?: boolean; // enable procedural wrap texture
  wrapTexScale?: number; // texture repeat scale
  wrapTexAngle?: number; // stripe angle in radians
  ovalRatio?: number; // >1 flattens Z and widens X
  segmentationCount?: number; // number of ridge cycles
  flare?: number; // additional radius near pommel
  curvature?: number; // -1..1 slight bend along x
  tangVisible?: boolean;
  tangWidth?: number;
  tangThickness?: number;
};

export type PommelStyle = 'orb' | 'disk' | 'spike';
export type PommelParams = {
  size: number;
  elongation: number; // 0.5..2 scale on Y
  style: PommelStyle;
  shapeMorph: number; // 0..1: stylistic morph per style
  offsetX?: number;
  offsetY?: number;
  facetCount?: number;
  spikeLength?: number;
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
  private hamonGroup: THREE.Group | null = null;
  private highlighted: 'blade' | 'guard' | 'handle' | 'pommel' | null = null;

  private lastParams?: SwordParams;

  constructor(initial: SwordParams) {
    this.updateGeometry(initial);
  }

  updateGeometry(params: SwordParams) {
    const p = this.validate(params);
    const prev = this.lastParams;
    this.lastParams = p;

    // Rebuild blade on any blade param change to avoid scaling artifacts
    this.rebuildBlade(p.blade);

    this.rebuildGuard(p.guard);
    this.rebuildHandle(p.handle);
    this.rebuildPommel(p.pommel);
  }

  public setHighlight(part: 'blade' | 'guard' | 'handle' | 'pommel' | null) {
    // Reset previous
    const setEmissive = (obj: THREE.Object3D | null, on: boolean) => {
      if (!obj) return;
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (!mat || !(mat as any).emissive) return;
        (mat as any).emissive?.setHex(on ? 0x333333 : 0x000000);
        (mat as any).emissiveIntensity = on ? 0.6 : 1.0;
      });
    };
    setEmissive(this.bladeMesh, false);
    setEmissive(this.guardMesh, false);
    setEmissive(this.guardGroup, false);
    setEmissive(this.handleMesh, false);
    setEmissive(this.pommelMesh, false);

    this.highlighted = part;
    if (part === 'blade') setEmissive(this.bladeMesh, true);
    if (part === 'guard') {
      setEmissive(this.guardMesh, true);
      setEmissive(this.guardGroup, true);
    }
    if (part === 'handle') setEmissive(this.handleMesh, true);
    if (part === 'pommel') setEmissive(this.pommelMesh, true);
  }

  private rebuildBlade(b: BladeParams) {
    if (this.bladeMesh) {
      this.group.remove(this.bladeMesh);
      this.disposeMesh(this.bladeMesh);
      this.bladeMesh = null;
    }

    const geo = buildBladeGeometry(b);

    const mat = new THREE.MeshStandardMaterial({ color: 0xb9c6ff, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide });
    this.bladeMesh = new THREE.Mesh(geo, mat);
    // Align blade base exactly at y=0 (no extra offset)
    this.bladeMesh.position.y = 0.0;
    this.group.add(this.bladeMesh);

    // Fuller grooves (visual overlay): two thin insets on both faces
    if (this.fullerGroup) {
      this.group.remove(this.fullerGroup);
      this.disposeGroup(this.fullerGroup);
      this.fullerGroup = null;
    }
    if (b.fullerEnabled && (b.fullerDepth ?? 0) > 0 && (b.fullerLength ?? 0) > 0) {
      this.fullerGroup = buildFullerOverlays(b);
      this.fullerGroup.position.copy(this.bladeMesh.position);
      this.group.add(this.fullerGroup);
    }

    // Hamon visual overlay along edge
    if (this.hamonGroup) {
      this.group.remove(this.hamonGroup);
      this.disposeGroup(this.hamonGroup);
      this.hamonGroup = null;
    }
    if (b.hamonEnabled && (b.hamonWidth ?? 0) > 0) {
      this.hamonGroup = buildHamonOverlays(b);
      this.hamonGroup.position.copy(this.bladeMesh.position);
      this.group.add(this.hamonGroup);
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

    // Compute guard placement: align its top to the blade base
    const GUARD_HEIGHT = 0.08;
    let bladeBaseY: number | undefined;
    if (this.bladeMesh) {
      const bb = new THREE.Box3().setFromObject(this.bladeMesh);
      if (isFinite(bb.min.y)) bladeBaseY = bb.min.y;
    }
    const targetTopY = (bladeBaseY ?? 0.0) + (g.heightOffset ?? 0);

    const color = 0x8892b0;
    if (g.style === 'bar') {
      const geo = new THREE.BoxGeometry(g.width, GUARD_HEIGHT, g.thickness);
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.5 });
      this.guardMesh = new THREE.Mesh(geo, mat);
      // Center so that top of the bar meets blade base
      this.guardMesh.position.set(0, targetTopY - GUARD_HEIGHT * 0.5, 0);
      this.group.add(this.guardMesh);
    } else if (g.style === 'disk') {
      const radius = Math.max(0.05, g.width * 0.5);
      const heightY = Math.max(0.04, Math.min(0.2, g.thickness));
      const geo = new THREE.CylinderGeometry(radius, radius, heightY, 48);
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.45 });
      this.guardMesh = new THREE.Mesh(geo, mat);
      this.guardMesh.position.set(0, targetTopY, 0);
      this.group.add(this.guardMesh);
    } else {
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.45, side: THREE.DoubleSide });
      const half = buildGuardHalfShape(g);
      const depth = g.thickness;
      const geoR = new THREE.ExtrudeGeometry(half, { depth, bevelEnabled: false, steps: 1, curveSegments: Math.max(3, Math.min(64, Math.round(g.curveSegments ?? 12))) });
      // Do not center: keep inner edge at x=0 for correct alignment
      const meshR = new THREE.Mesh(geoR, mat);
      // Right half attached at inner edge x=0
      meshR.position.set(0, 0, -depth / 2);

      // Left half mirrored across X at inner edge
      const meshL = meshR.clone();
      meshL.scale.x = -1;

      const group = new THREE.Group();
      group.add(meshR, meshL);
      // Align inner edge (y=0 at x=0) to the blade base
      group.position.y = targetTopY;
      group.rotation.z = g.tilt;
      this.guardGroup = group;
      this.group.add(group);
    }

    // Habaki (blade collar) above guard
    const useHabaki = !!g.habakiEnabled;
    if (useHabaki) {
      const hbHeight = Math.max(0.02, g.habakiHeight ?? 0.06);
      const margin = Math.max(0.005, g.habakiMargin ?? 0.01);
      const bladeW = this.lastParams?.blade.baseWidth ?? 0.25;
      const bladeT = Math.max(this.lastParams?.blade.thicknessLeft ?? 0.08, this.lastParams?.blade.thicknessRight ?? 0.08);
      const geo = new THREE.BoxGeometry(bladeW + 2 * margin, hbHeight, bladeT + 2 * margin);
      const mat = new THREE.MeshStandardMaterial({ color: 0xb1976b, metalness: 0.6, roughness: 0.4 });
      const habaki = new THREE.Mesh(geo, mat);
      habaki.position.set(0, (bladeBaseY ?? 0) + hbHeight * 0.5, 0);
      this.group.add(habaki);
    }
  }

  private rebuildHandle(h: HandleParams) {
    if (this.handleMesh) {
      this.group.remove(this.handleMesh);
      this.disposeMesh(this.handleMesh);
      this.handleMesh = null;
    }
    const profile: THREE.Vector2[] = [];
    const ridges = h.segmentation ? (h.segmentationCount ?? 8) : 0;
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = -h.length / 2 + t * h.length;
      const baseR = h.radiusBottom + (h.radiusTop - h.radiusBottom) * t;
      const bump = ridges > 0 ? (Math.sin(t * Math.PI * ridges) * 0.03) : 0;
      const flare = Math.max(0, h.flare ?? 0);
      const flareTerm = flare * Math.pow(1 - t, 2);
      const r = Math.max(0.02, baseR + bump + flareTerm);
      profile.push(new THREE.Vector2(r, y));
    }
    const phiSegments = Math.max(8, Math.min(128, Math.round(h.phiSegments ?? 64)));
    const geo = new THREE.LatheGeometry(profile, phiSegments);
    // Optional helical wrap deformation
    if (h.wrapEnabled && (h.wrapDepth ?? 0) > 0 && (h.wrapTurns ?? 0) > 0) {
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as unknown as number[];
      // Normalize y to 0..1 along handle
      let yMin = +Infinity, yMax = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        const iy = i * 3 + 1;
        const y = arr[iy];
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
      const turns = Math.max(0, h.wrapTurns || 0);
      const amp = Math.min(0.1, Math.max(0, h.wrapDepth || 0));
      for (let i = 0; i < pos.count; i++) {
        const ix = i * 3;
        const iy = ix + 1;
        const iz = ix + 2;
        const x = arr[ix];
        const y = arr[iy];
        const z = arr[iz];
        const t = (y - yMin) / Math.max(1e-6, yMax - yMin);
        const baseR = Math.max(0.01, Math.hypot(x, z));
        const phi = Math.atan2(z, x) + 2 * Math.PI * turns * t;
        const offset = amp * Math.sin(phi);
        const scale = (baseR + offset) / baseR;
        arr[ix] = x * scale;
        arr[iz] = z * scale;
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a6b78, metalness: 0.2, roughness: 0.8 });
    if (h.wrapTexture) {
      const tex = makeWrapTexture(h.wrapTexScale ?? 10, h.wrapTexAngle ?? (Math.PI / 4));
      mat.map = tex;
      mat.needsUpdate = true;
    }
    this.handleMesh = new THREE.Mesh(geo, mat);
    // Slight curvature bend along x
    if (Math.abs(h.curvature ?? 0) > 1e-4) {
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as unknown as number[];
      // find y min/max
      let yMin = Infinity, yMax = -Infinity;
      for (let i = 0; i < pos.count; i++) { const y = arr[i*3+1]; if (y<yMin) yMin=y; if (y>yMax) yMax=y; }
      const H = Math.max(1e-6, yMax - yMin);
      for (let i = 0; i < pos.count; i++) {
        const ix = i*3, iy=ix+1;
        const x = arr[ix]; const y = arr[iy]; const z = arr[ix+2];
        const t = (y - yMin) / H;
        const bend = (h.curvature ?? 0) * (t*t - t) * (yMax - yMin);
        arr[ix] = x + bend; arr[ix+2] = z;
      }
      pos.needsUpdate = true; geo.computeVertexNormals();
    }
    // Apply oval cross-section scaling
    const oval = Math.max(1, h.ovalRatio ?? 1);
    if (oval !== 1) {
      this.handleMesh.scale.x *= oval;
      this.handleMesh.scale.z /= oval;
    }
    this.handleMesh.position.y = -h.length * 0.5;
    this.group.add(this.handleMesh);

    // Optional visible tang (inside/through handle)
    if (h.tangVisible) {
      const tw = Math.max(0.01, h.tangWidth ?? 0.05);
      const tt = Math.max(0.005, h.tangThickness ?? 0.02);
      const ty = h.length * 0.9;
      const geoTang = new THREE.BoxGeometry(tw, ty, tt);
      const matTang = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.7, roughness: 0.4 });
      const tang = new THREE.Mesh(geoTang, matTang);
      tang.position.y = -h.length * 0.5 + ty * 0.5;
      this.group.add(tang);
    }
  }

  private rebuildPommel(p: PommelParams) {
    if (this.pommelMesh) {
      this.group.remove(this.pommelMesh);
      this.disposeMesh(this.pommelMesh);
      this.pommelMesh = null;
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.6, roughness: 0.4 });
    let mesh: THREE.Mesh;
    const facets = Math.max(6, Math.round(p.facetCount ?? 32));
    if (p.style === 'disk') {
      const geo = new THREE.CylinderGeometry(p.size * (1.0 + p.shapeMorph), p.size * (1.0 + p.shapeMorph), p.size * 0.5, facets);
      mesh = new THREE.Mesh(geo, mat);
    } else if (p.style === 'spike') {
      const height = p.size * (1.2 + p.shapeMorph) * (p.spikeLength ?? 1);
      const geo = new THREE.ConeGeometry(p.size * (0.8 + 0.4 * p.shapeMorph), height, facets);
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.z = Math.PI; // point down
    } else {
      const geo = new THREE.SphereGeometry(p.size, facets, Math.max(8, Math.round(facets/2)));
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
    this.pommelMesh.position.y = y - p.size * 0.3 * p.elongation + (p.offsetY ?? 0);
    this.pommelMesh.position.x = (p.offsetX ?? 0);
    this.group.add(this.pommelMesh);
  }

  private validate(params: SwordParams): SwordParams {
    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
    const b = params.blade;
    const blade: BladeParams = {
      length: clamp(b.length, 0.1, 20),
      baseWidth: clamp(b.baseWidth, 0.02, 5),
      // Allow unusual shapes: tip wider than base
      tipWidth: clamp(b.tipWidth, 0, 5),
      thickness: clamp(b.thickness, 0.01, 2),
      curvature: clamp(b.curvature, -1, 1),
      serrationAmplitude: clamp(b.serrationAmplitude ?? 0, 0, (b.baseWidth || 0.2) / 3),
      serrationAmplitudeLeft: clamp((b.serrationAmplitudeLeft ?? b.serrationAmplitude ?? 0), 0, (b.baseWidth || 0.2) / 3),
      serrationAmplitudeRight: clamp((b.serrationAmplitudeRight ?? b.serrationAmplitude ?? 0), 0, (b.baseWidth || 0.2) / 3),
      serrationFrequency: clamp(b.serrationFrequency ?? 0, 0, 40),
      fullerDepth: clamp(b.fullerDepth ?? 0, 0, 0.2),
      fullerLength: clamp(b.fullerLength ?? 0, 0, 1),
      fullerEnabled: !!b.fullerEnabled,
      fullerCount: Math.round(clamp(b.fullerCount ?? 1, 0, 3)),
      sweepSegments: Math.round(clamp(b.sweepSegments ?? 128, 16, 512)),
      chaos: clamp(b.chaos ?? 0, 0, 1),
      asymmetry: clamp(b.asymmetry ?? 0, -1, 1),
      edgeType: (b.edgeType ?? 'double') as any,
      thicknessLeft: clamp(b.thicknessLeft ?? b.thickness ?? 0.08, 0.003, 2),
      thicknessRight: clamp(b.thicknessRight ?? b.thickness ?? 0.08, 0.003, 2),
      baseAngle: clamp(b.baseAngle ?? 0, -0.35, 0.35),
      soriProfile: (b.soriProfile ?? 'torii') as any,
      soriBias: clamp(b.soriBias ?? 0.8, 0.3, 3),
      kissakiLength: clamp(b.kissakiLength ?? 0, 0, 0.35),
      kissakiRoundness: clamp(b.kissakiRoundness ?? 0.5, 0, 1),
      hamonEnabled: !!b.hamonEnabled,
      hamonWidth: clamp(b.hamonWidth ?? 0, 0, Math.max(0.02, (b.baseWidth || 0.25) * 0.5)),
      hamonAmplitude: clamp(b.hamonAmplitude ?? 0, 0, Math.max(0.005, (b.baseWidth || 0.25) * 0.2)),
      hamonFrequency: clamp(b.hamonFrequency ?? 0, 0, 30),
      hamonSide: (b.hamonSide ?? 'auto') as any,
      twistAngle: clamp(b.twistAngle ?? 0, -Math.PI * 2, Math.PI * 2)
    };

    const g = params.guard;
    const guard: GuardParams = {
      width: clamp(g.width, 0.2, 10),
      thickness: clamp(g.thickness, 0.05, 2),
      curve: clamp(g.curve, -1, 1),
      tilt: clamp(g.tilt, -Math.PI / 2, Math.PI / 2),
      style: (g.style ?? 'bar') as GuardStyle,
      curveSegments: Math.round(clamp(g.curveSegments ?? 12, 3, 64)),
      habakiEnabled: !!g.habakiEnabled,
      habakiHeight: clamp(g.habakiHeight ?? 0.06, 0.02, 0.2),
      habakiMargin: clamp(g.habakiMargin ?? 0.01, 0.002, 0.08)
    };

    const h = params.handle;
    const handle: HandleParams = {
      length: clamp(h.length, 0.2, 5),
      radiusTop: clamp(h.radiusTop, 0.05, 1),
      radiusBottom: clamp(h.radiusBottom, 0.05, 1),
      segmentation: !!h.segmentation,
      wrapEnabled: !!h.wrapEnabled,
      wrapTurns: clamp(h.wrapTurns ?? 6, 0, 40),
      wrapDepth: clamp(h.wrapDepth ?? 0.015, 0, 0.08),
      phiSegments: Math.round(clamp(h.phiSegments ?? 64, 8, 128)),
      wrapTexture: !!h.wrapTexture,
      wrapTexScale: clamp(h.wrapTexScale ?? 10, 1, 64),
      wrapTexAngle: clamp(h.wrapTexAngle ?? (Math.PI / 4), -Math.PI, Math.PI),
      ovalRatio: clamp(h.ovalRatio ?? 1, 1, 1.8),
      segmentationCount: Math.round(clamp(h.segmentationCount ?? 8, 0, 64)),
      flare: clamp(h.flare ?? 0, 0, 0.2),
      curvature: clamp(h.curvature ?? 0, -0.2, 0.2),
      tangVisible: !!h.tangVisible,
      tangWidth: clamp(h.tangWidth ?? 0.05, 0.005, 0.2),
      tangThickness: clamp(h.tangThickness ?? 0.02, 0.003, 0.1)
    };

    const pm = params.pommel;
    const pommel: PommelParams = {
      size: clamp(pm.size, 0.05, 1),
      elongation: clamp(pm.elongation, 0.5, 2),
      style: (pm.style ?? 'orb') as PommelStyle,
      shapeMorph: clamp(pm.shapeMorph, 0, 1)
    };

    // Stylization: exaggerate proportions globally
    const style = clamp((params as any).styleFactor ?? 0, 0, 1);
    if (style > 0) {
      blade.curvature *= (1 + 0.8 * style);
      guard.width *= (1 + 1.0 * style);
      guard.curve *= (1 + 0.8 * style);
      pommel.size *= (1 + 0.5 * style);
    }

    return { blade, guard, handle, pommel } as any as SwordParams;
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
  const tipW = Math.max(0, b.tipWidth);

  // Build an outline from base (y=0) to tip (y=length), symmetric around x=0
  const pointsRight: THREE.Vector2[] = [];
  const pointsLeft: THREE.Vector2[] = [];
  const steps = 100;
  const serrAmp = b.serrationAmplitude ?? 0;
  const serrAmpL = b.serrationAmplitudeLeft ?? serrAmp;
  const serrAmpR = b.serrationAmplitudeRight ?? serrAmp;
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

export function buildBladeOutlinePoints(b: BladeParams): THREE.Vector2[] {
  const length = Math.max(0.01, b.length);
  const baseW = Math.max(0.002, b.baseWidth);
  const tipW = Math.max(0, b.tipWidth);
  const steps = 200;
  const serrAmp = b.serrationAmplitude ?? 0;
  const serrAmpL = b.serrationAmplitudeLeft ?? serrAmp;
  const serrAmpR = b.serrationAmplitudeRight ?? serrAmp;
  const serrFreq = b.serrationFrequency ?? 0;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * length;
    const w = tipWidthWithKissaki(b, t, baseW, tipW);
    const serrR = serrAmpR > 0 && serrFreq > 0 ? Math.sin(t * Math.PI * serrFreq) * serrAmpR * (1 - t) : 0;
    const half = Math.max(0.001, w * 0.5);
    const asym = (b.asymmetry ?? 0);
    const rightHalf = Math.max(0.0005, (half + serrR) * (1 + 0.5 * asym));
    const bend = bendOffsetX(b, y, length);
    pts.push(new THREE.Vector2(+rightHalf + bend, y));
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const y = t * length;
    const w = tipWidthWithKissaki(b, t, baseW, tipW);
    const serrL = serrAmpL > 0 && serrFreq > 0 ? Math.sin(t * Math.PI * serrFreq) * serrAmpL * (1 - t) : 0;
    const half = Math.max(0.001, w * 0.5);
    const asym = (b.asymmetry ?? 0);
    const leftHalf = Math.max(0.0005, (half + serrL) * (1 - 0.5 * asym));
    const bend = bendOffsetX(b, y, length);
    pts.push(new THREE.Vector2(-leftHalf + bend, y));
  }
  return pts;
}

export function bladeOutlineToSVG(points: THREE.Vector2[], stroke = '#e2e8f0'): string {
  if (!points.length) return '';
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const pad = 10; // px padding
  const width = maxX - minX;
  const height = maxY - minY;
  const sx = pad - minX;
  const sy = pad - minY;
  let d = '';
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    d += (i === 0 ? 'M' : 'L') + (p.x + sx).toFixed(3) + ' ' + (height + pad * 2 - (p.y + sy)).toFixed(3) + ' ';
  }
  d += 'Z';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${(width + pad * 2).toFixed(2)}" height="${(height + pad * 2).toFixed(2)}" viewBox="0 0 ${(width + pad * 2).toFixed(2)} ${(height + pad * 2).toFixed(2)}">\n  <path d="${d}" fill="none" stroke="${stroke}" stroke-width="1"/>\n</svg>`;
  return svg;
}

function makeWrapTexture(scale: number, angleRad: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  // Background
  ctx.fillStyle = '#2a313a';
  ctx.fillRect(0, 0, size, size);
  // Draw diagonal stripes
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(angleRad);
  ctx.translate(-size / 2, -size / 2);
  const stripe = Math.max(2, Math.floor(size / scale));
  const gap = Math.max(2, Math.floor(stripe * 0.6));
  ctx.fillStyle = '#3d4754';
  for (let x = -size; x < size * 2; x += stripe + gap) {
    ctx.fillRect(x, -size, stripe, size * 3);
  }
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 6);
  tex.colorSpace = THREE.SRGBColorSpace as any;
  tex.needsUpdate = true;
  return tex;
}

function bendOffsetX(b: BladeParams, y: number, L: number): number {
  const t = THREE.MathUtils.clamp(L > 0 ? y / L : 0, 0, 1);
  const prof = b.soriProfile ?? 'torii';
  const bias = b.soriBias ?? 0.8;
  let a = 1, c = 1;
  if (prof === 'koshi') { a = bias; c = 1; }
  else if (prof === 'saki') { a = 1; c = bias; }
  else { a = 1; c = 1; }
  const shape = Math.pow(t, a) * Math.pow(1 - t, c);
  const peak = Math.pow(a / (a + c), a) * Math.pow(c / (a + c), c);
  const norm = peak > 1e-6 ? shape / peak : shape;
  const curved = -(b.curvature || 0) * 0.25 * norm * L;
  const linear = Math.tan(b.baseAngle ?? 0) * y;
  return curved + linear;
}

function tipWidthWithKissaki(b: BladeParams, t: number, baseW: number, tipW: number): number {
  const kf = THREE.MathUtils.clamp(b.kissakiLength ?? 0, 0, 0.35);
  if (kf <= 1e-6) return baseW + (tipW - baseW) * t;
  const split = 1 - kf;
  const midW = baseW + (tipW - baseW) * split;
  if (t <= split) {
    return baseW + (midW - baseW) * (t / Math.max(1e-6, split));
  } else {
    const u = (t - split) / Math.max(1e-6, kf);
    const r = THREE.MathUtils.clamp(b.kissakiRoundness ?? 0.5, 0, 1);
    const expo = THREE.MathUtils.lerp(0.5, 3.0, 1 - r);
    const eased = Math.pow(u, expo);
    return midW + (tipW - midW) * eased;
  }
}

function buildBladeGeometry(b: BladeParams): THREE.BufferGeometry {
  const L = Math.max(0.01, b.length);
  const TL = Math.max(0.001, b.thicknessLeft ?? b.thickness ?? 0.08);
  const TR = Math.max(0.001, b.thicknessRight ?? b.thickness ?? 0.08);
  const halfTL = TL * 0.5;
  const halfTR = TR * 0.5;
  const baseW = Math.max(0.002, b.baseWidth);
  const tipW = Math.max(0, b.tipWidth);
  const segs = Math.max(16, Math.min(512, Math.round(b.sweepSegments ?? 128))); // longitudinal resolution
  const serrAmp = b.serrationAmplitude ?? 0;
  const serrAmpL = b.serrationAmplitudeLeft ?? serrAmp;
  const serrAmpR = b.serrationAmplitudeRight ?? serrAmp;
  const serrFreq = b.serrationFrequency ?? 0;
  const chaos = b.chaos ?? 0;

  // Positions: per row we store 4 vertices: FL, FR, BL, BR
  const positions = new Float32Array((segs + 1) * 4 * 3);
  const indices: number[] = [];

  const rowIndex = (i: number, j: number) => (i * 4 + j);
  const setV = (i: number, j: number, x: number, y: number, z: number) => {
    const idx = rowIndex(i, j) * 3;
    positions[idx + 0] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
  };

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = t * L;
    const w = tipWidthWithKissaki(b, t, baseW, tipW);
    const serrL = serrAmpL > 0 && serrFreq > 0 ? Math.sin(t * Math.PI * serrFreq) * serrAmpL * (1 - t) : 0;
    const serrR = serrAmpR > 0 && serrFreq > 0 ? Math.sin(t * Math.PI * serrFreq) * serrAmpR * (1 - t) : 0;
    // Chaos profile: bounded, smooth pseudo-noise (two sines)
    const c1 = Math.sin(t * Math.PI * 16.0 + 1.3);
    const c2 = Math.sin(t * Math.PI * 9.7 + 0.6);
    const chaosOffset = (c1 * 0.6 + c2 * 0.4) * chaos * 0.08 * baseW * (1.0 - t * 0.6);
    const baseHalf = Math.max(0.001, w * 0.5 + chaosOffset);
    const asym = (b.asymmetry ?? 0);
    const leftHalf = Math.max(0.0005, (baseHalf + serrL) * (1 - 0.5 * asym));
    const rightHalf = Math.max(0.0005, (baseHalf + serrR) * (1 + 0.5 * asym));
    const bend = bendOffsetX(b, y, L);
    const xl = -leftHalf + bend;
    const xr = +rightHalf + bend;

    // FL/BL use left thickness; FR/BR use right thickness, then twist around Y
    const twist = (b.twistAngle ?? 0) * t;
    const cosT = Math.cos(twist), sinT = Math.sin(twist);
    const rot = (x: number, z: number) => ({ x: x * cosT - z * sinT, z: x * sinT + z * cosT });
    const p0 = rot(xl, -halfTL);
    const p1 = rot(xr, -halfTR);
    const p2 = rot(xl, +halfTL);
    const p3 = rot(xr, +halfTR);
    setV(i, 0, p0.x, y, p0.z);
    setV(i, 1, p1.x, y, p1.z);
    setV(i, 2, p2.x, y, p2.z);
    setV(i, 3, p3.x, y, p3.z);
  }

  // Faces along length for front and back
  for (let i = 0; i < segs; i++) {
    const a = rowIndex(i, 0);
    const bR = rowIndex(i, 1);
    const c = rowIndex(i + 1, 0);
    const dR = rowIndex(i + 1, 1);
    const aB = rowIndex(i, 2);
    const bRB = rowIndex(i, 3);
    const cB = rowIndex(i + 1, 2);
    const dRB = rowIndex(i + 1, 3);

    // Front face (z = -halfT)
    indices.push(a, bR, dR, a, dR, c);
    // Back face (z = +halfT)
    indices.push(aB, dRB, bRB, aB, cB, dRB);

    // Left side (connect FL<->BL)
    indices.push(a, aB, cB, a, cB, c);
    // Right side (connect FR<->BR)
    indices.push(bR, dR, dRB, bR, dRB, bRB);
  }

  // Base cap at y=0
  const fL0 = rowIndex(0, 0), fR0 = rowIndex(0, 1), bL0 = rowIndex(0, 2), bR0 = rowIndex(0, 3);
  indices.push(fL0, fR0, bR0, fL0, bR0, bL0);
  // Tip cap at y=L
  const fLn = rowIndex(segs, 0), fRn = rowIndex(segs, 1), bLn = rowIndex(segs, 2), bRn = rowIndex(segs, 3);
  indices.push(fLn, bRn, fRn, fLn, bLn, bRn);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
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
      // Disable fullers by default to avoid stray rectangles for new users
      fullerDepth: 0.0,
      fullerLength: 0.0,
      fullerEnabled: false,
      sweepSegments: 128,
      chaos: 0.0,
      asymmetry: 0.0,
      edgeType: 'double',
      thicknessLeft: 0.08,
      thicknessRight: 0.08,
      baseAngle: 0.0
    },
    guard: {
      width: 1.2,
      thickness: 0.2,
      curve: 0.3,
      tilt: 0.0,
      style: 'winged',
      habakiEnabled: false,
      habakiHeight: 0.06,
      habakiMargin: 0.01
    },
    handle: {
      length: 0.9,
      radiusTop: 0.12,
      radiusBottom: 0.12,
      segmentation: true,
      wrapEnabled: false,
      wrapTurns: 6,
      wrapDepth: 0.015,
      phiSegments: 64,
      wrapTexture: false,
      wrapTexScale: 10,
      wrapTexAngle: 0.7853981633974483,
      ovalRatio: 1.0
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

  const totalLen = b.length;
  const reqLen = totalLen * THREE.MathUtils.clamp(b.fullerLength ?? 0, 0, 1);
  // Clearance from base and tip
  const baseClear = Math.max(0.05, 0.18 * (b.baseWidth || 0.2));
  const tipClear = Math.max(0.05, 0.12 * (b.baseWidth || 0.2));
  const y0 = baseClear;
  const y1 = Math.max(y0, totalLen - tipClear);
  const usableLen = Math.max(0, Math.min(reqLen, y1 - y0));
  if (usableLen < 0.08) return group; // too short: skip to avoid tiny rectangles

  const segments = 64;
  const margin = Math.max(0.015, 0.12 * (b.baseWidth || 0.2));
  const serrAmp = b.serrationAmplitude ?? 0;
  const serrFreq = b.serrationFrequency ?? 0;

  // Visual depth effect: darker and slightly more inset with depth
  const depthNorm = THREE.MathUtils.clamp((b.fullerDepth ?? 0) / 0.08, 0, 1);
  const baseColor = new THREE.Color(0x475569);
  const shade = baseColor.clone().multiplyScalar(1 - 0.6 * depthNorm);
  const mat = new THREE.MeshStandardMaterial({
    color: shade,
    metalness: 0.3,
    roughness: 0.7,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1 - 2 * depthNorm,
    polygonOffsetUnits: -2 - 2 * depthNorm
  });

  // Build a narrow ribbon centered at cxOffset that follows curvature
  const buildRibbon = (cxOffset: number, z: number) => {
    const positions: number[] = [];
    const index: number[] = [];
    const pushVertex = (x: number, y: number) => {
      positions.push(x, y, z);
    };
    for (let i = 0; i <= segments; i++) {
      const tLocal = i / segments; // 0..1 along ribbon
      const y = y0 + tLocal * usableLen;
      const tBlade = THREE.MathUtils.clamp(y / totalLen, 0, 1);
      const bend = bendOffsetX(b, y, totalLen);
      const cx = bend + cxOffset;
      const half = Math.max(0.003, (b.baseWidth * 0.22) * 0.5);
      const xL = cx - half;
      const xR = cx + half;
      pushVertex(xL, y);
      pushVertex(xR, y);
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const bIdx = a + 1;
      const c = a + 2;
      const d = a + 3;
      // two triangles (a, b, d) and (a, d, c)
      index.push(a, bIdx, d, a, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  };

  const halfT = Math.max((b.thicknessLeft ?? b.thickness ?? 0.08) * 0.5, (b.thicknessRight ?? b.thickness ?? 0.08) * 0.5);
  const eps = 0.0006;
  const inset = depthNorm * (halfT - eps * 8) * 0.8; // deeper depth -> more inset
  const frontZ = halfT - eps - inset;
  const backZ = -frontZ;
  const count = Math.max(0, Math.min(3, Math.round(b.fullerCount ?? 1)));
  if (count === 1) {
    group.add(buildRibbon(0, frontZ), buildRibbon(0, backZ));
  } else if (count === 2) {
    const off = (b.baseWidth || 0.3) * 0.12;
    group.add(buildRibbon(-off, frontZ), buildRibbon(-off, backZ));
    group.add(buildRibbon(+off, frontZ), buildRibbon(+off, backZ));
  } else if (count >= 3) {
    const off = (b.baseWidth || 0.3) * 0.14;
    group.add(buildRibbon(0, frontZ), buildRibbon(0, backZ));
    group.add(buildRibbon(-off, frontZ), buildRibbon(-off, backZ));
    group.add(buildRibbon(+off, frontZ), buildRibbon(+off, backZ));
  }
  return group;
}

function buildHamonOverlays(b: BladeParams): THREE.Group {
  const group = new THREE.Group();
  const totalLen = b.length;
  const segments = 96;
  const width = Math.max(0.002, b.hamonWidth ?? 0.015);
  const amp = Math.max(0, b.hamonAmplitude ?? 0.006);
  const freq = Math.max(0, b.hamonFrequency ?? 6);
  const color = 0xe3e7f3;
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });

  const halfTL = Math.max(0.001, (b.thicknessLeft ?? b.thickness ?? 0.08) * 0.5);
  const halfTR = Math.max(0.001, (b.thicknessRight ?? b.thickness ?? 0.08) * 0.5);
  const eps = 0.0006;
  const zFrontL = halfTL - eps;
  const zFrontR = halfTR - eps;

  const serrAmp = b.serrationAmplitude ?? 0;
  const serrAmpL = b.serrationAmplitudeLeft ?? serrAmp;
  const serrAmpR = b.serrationAmplitudeRight ?? serrAmp;
  const serrFreq = b.serrationFrequency ?? 0;

  const buildEdgeRibbon = (side: 'left' | 'right', z: number) => {
    const positions: number[] = [];
    const index: number[] = [];
    const pushV = (x: number, y: number) => { positions.push(x, y, z); };
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = t * totalLen;
      const w = tipWidthWithKissaki(b, t, b.baseWidth, b.tipWidth);
      const serr = (side === 'right' ? serrAmpR : serrAmpL);
      const serrX = serr > 0 && serrFreq > 0 ? Math.sin(t * Math.PI * serrFreq) * serr * (1 - t) : 0;
      const halfBase = Math.max(0.001, w * 0.5 + serrX);
      const bend = bendOffsetX(b, y, totalLen);
      const edgeX = side === 'right' ? (bend + halfBase) : (bend - halfBase);
      const dir = side === 'right' ? -1 : +1; // toward center from edge
      const wav = amp > 0 && freq > 0 ? Math.sin(t * Math.PI * freq) * amp : 0;
      const outer = edgeX + dir * 0.002;
      const inner = edgeX + dir * (width + wav);
      // Outer then inner so band faces inward
      pushV(outer, y);
      pushV(inner, y);
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const bIdx = a + 1;
      const c = a + 2;
      const d = a + 3;
      index.push(a, bIdx, d, a, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  };

  const sidePref = (b.hamonSide ?? 'auto');
  const single = b.edgeType === 'single';
  const thinnerRight = (b.thicknessRight ?? b.thickness ?? 0.08) < (b.thicknessLeft ?? b.thickness ?? 0.08);
  const autoSide: 'left' | 'right' = thinnerRight ? 'right' : 'left';

  const wantLeft = sidePref === 'left' || sidePref === 'both' || (sidePref === 'auto' && (!single || autoSide === 'left'));
  const wantRight = sidePref === 'right' || sidePref === 'both' || (sidePref === 'auto' && (!single || autoSide === 'right'));

  if (wantLeft) {
    group.add(buildEdgeRibbon('left', zFrontL), buildEdgeRibbon('left', -zFrontL));
  }
  if (wantRight) {
    group.add(buildEdgeRibbon('right', zFrontR), buildEdgeRibbon('right', -zFrontR));
  }
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
