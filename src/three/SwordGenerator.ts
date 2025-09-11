import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

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
  // New: fuller carve options
  fullerMode?: 'overlay' | 'carve';
  fullerProfile?: 'u' | 'v' | 'flat';
  fullerWidth?: number; // groove width across face (scene units)
  fullerInset?: number; // inset into thickness (fallback to fullerDepth)
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
  // New: serration patterns
  serrationPattern?: 'sine' | 'saw' | 'scallop' | 'random';
  serrationSeed?: number;
  twistAngle?: number; // radians of total twist from base to tip
  crossSection?: 'flat' | 'lenticular' | 'diamond' | 'hexagonal';
  bevel?: number; // 0..1 bevel intensity for profiles
  tipShape?: 'pointed' | 'rounded' | 'leaf';
  tipBulge?: number; // 0..1 extra mid-blade bulge for 'leaf'
  engravings?: Array<{ type:'text'|'shape'|'decal', content?: string, fontUrl?: string, width:number, height:number, depth?: number, offsetY:number, offsetX:number, rotation?: number, side?: 'left'|'right'|'both' }>;
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
  quillonCount?: number; // 0, 2, or 4
  quillonLength?: number; // length along X
  ornamentation?: number; // 0..1
  tipSharpness?: number; // 0..1 continuous tip style
  cutoutCount?: number; // for disk style: number of holes
  cutoutRadius?: number; // 0..0.8 fraction of radius for holes
  asymmetricArms?: boolean; // allow left/right to differ in scale
  asymmetry?: number; // -1..1 scale left smaller, right larger (or vice versa)
  guardBlendFillet?: number; // 0..1 small fillet bridge at blade base
  extras?: Array<{ kind: 'loop'|'sideRing'|'fingerGuard'; radius: number; thickness: number; offsetY: number; offsetX?: number; tilt?: number }>;
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
  handleLayers?: Array<{ kind:'core'|'wrap'|'ring'|'inlay', radiusAdd?: number, lengthFrac?: number, y0Frac?: number, wrapPattern?: 'helical'|'crisscross', turns?: number, depth?: number, spacing?: number }>;
  menuki?: Array<{ positionFrac:number, side:'left'|'right', size:number }>;
  rivets?: Array<{ count:number, ringFrac:number, radius:number }>;
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
  balance?: number; // 0..1 interpolate size toward balance target
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
  private handleGroup: THREE.Group | null = null;
  private fullerGroup: THREE.Group | null = null;
  private hamonGroup: THREE.Group | null = null;
  private engravingGroup: THREE.Group | null = null;
  private _fontCache?: Map<string, any>;
  private highlighted: 'blade' | 'guard' | 'handle' | 'pommel' | null = null;

  private lastParams?: SwordParams;
  private mats?: Record<'blade'|'guard'|'handle'|'pommel', any>;

  constructor(initial: SwordParams, materials?: Record<'blade'|'guard'|'handle'|'pommel', any>) {
    this.mats = materials;
    this.updateGeometry(initial);
  }
  public setMaterials(mats: Record<'blade'|'guard'|'handle'|'pommel', any>) {
    this.mats = mats; this.reapplyMaterials();
  }
  private makeMaterial(part: 'blade'|'guard'|'handle'|'pommel'): THREE.MeshPhysicalMaterial {
    const m = this.mats?.[part] || {};
    const defaults: Record<string, any> = {
      blade: { color: 0xb9c6ff, metalness: 0.8, roughness: 0.25, clearcoat: 0.0, clearcoatRoughness: 0.5 },
      guard: { color: 0x8892b0, metalness: 0.6, roughness: 0.4, clearcoat: 0.0, clearcoatRoughness: 0.5 },
      handle:{ color: 0x5a6b78, metalness: 0.1, roughness: 0.85, clearcoat: 0.0, clearcoatRoughness: 0.6 },
      pommel:{ color: 0x9aa4b2, metalness: 0.75,roughness: 0.35,clearcoat: 0.0, clearcoatRoughness: 0.5 }
    };
    const base = defaults[part];
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(m.color ?? base.color),
      metalness: m.metalness ?? base.metalness,
      roughness: m.roughness ?? base.roughness,
      clearcoat: m.clearcoat ?? base.clearcoat,
      clearcoatRoughness: m.clearcoatRoughness ?? base.clearcoatRoughness
    });
    if (m.emissiveColor) { (mat as any).emissive = new THREE.Color(m.emissiveColor); (mat as any).emissiveIntensity = m.emissiveIntensity ?? 0.5; }
    if (m.transmission) { (mat as any).transmission = m.transmission; (mat as any).ior = m.ior ?? 1.5; (mat as any).thickness = m.thickness ?? 0.2; if (m.attenuationColor) (mat as any).attenuationColor = new THREE.Color(m.attenuationColor); if (m.attenuationDistance!==undefined) (mat as any).attenuationDistance = m.attenuationDistance; }
    if (m.sheen!==undefined) { (mat as any).sheen = m.sheen; if (m.sheenColor) (mat as any).sheenColor = new THREE.Color(m.sheenColor); }
    if (m.iridescence!==undefined) { (mat as any).iridescence = m.iridescence; (mat as any).iridescenceIOR = m.iridescenceIOR ?? 1.3; (mat as any).iridescenceThicknessRange = [m.iridescenceThicknessMin ?? 100, m.iridescenceThicknessMax ?? 400]; }
    // Optional texture maps
    if (m.map) { const t = this.loadTexture(m.map, true); if (t) (mat as any).map = t; }
    if (m.normalMap) { const t = this.loadTexture(m.normalMap, false); if (t) (mat as any).normalMap = t; }
    if (m.roughnessMap) { const t = this.loadTexture(m.roughnessMap, false); if (t) (mat as any).roughnessMap = t; }
    if (m.metalnessMap) { const t = this.loadTexture(m.metalnessMap, false); if (t) (mat as any).metalnessMap = t; }
    if (m.aoMap) { const t = this.loadTexture(m.aoMap, false); if (t) (mat as any).aoMap = t; }
    if (m.bumpMap) { const t = this.loadTexture(m.bumpMap, false); if (t) (mat as any).bumpMap = t; }
    if (m.displacementMap) { const t = this.loadTexture(m.displacementMap, false); if (t) (mat as any).displacementMap = t; }
    if (m.alphaMap) { const t = this.loadTexture(m.alphaMap, false); if (t) (mat as any).alphaMap = t; }
    if (m.clearcoatNormalMap) { const t = this.loadTexture(m.clearcoatNormalMap, false); if (t) (mat as any).clearcoatNormalMap = t; }
    if (m.envMapIntensity !== undefined) (mat as any).envMapIntensity = m.envMapIntensity;
    return mat;
  }
  private reapplyMaterials() {
    const apply = (obj: THREE.Object3D | null | undefined, part: 'blade'|'guard'|'handle'|'pommel') => {
      if (!obj) return; const mat = this.makeMaterial(part);
      obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = mat; });
    };
    apply(this.bladeMesh, 'blade');
    apply(this.guardMesh ?? this.guardGroup, 'guard');
    apply(this.handleMesh, 'handle');
    apply(this.pommelMesh, 'pommel');
  }

  private _texLoader?: THREE.TextureLoader;
  private _texCache?: Map<string, THREE.Texture>;
  private loadTexture(url?: string, sRGB = false): THREE.Texture | undefined {
    if (!url) return undefined;
    this._texLoader = this._texLoader || new THREE.TextureLoader();
    this._texCache = this._texCache || new Map();
    const cached = this._texCache.get(url);
    if (cached) return cached;
    const dummy = new THREE.Texture(); // placeholder until load completes
    this._texLoader.load(url, (tex) => {
      if (sRGB) (tex as any).colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      this._texCache!.set(url, tex);
    });
    return dummy;
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
    setEmissive(this.handleGroup, false);
    setEmissive(this.pommelMesh, false);

    this.highlighted = part;
    if (part === 'blade') setEmissive(this.bladeMesh, true);
    if (part === 'guard') {
      setEmissive(this.guardMesh, true);
      setEmissive(this.guardGroup, true);
    }
    if (part === 'handle') { setEmissive(this.handleMesh, true); setEmissive(this.handleGroup, true); }
    if (part === 'pommel') setEmissive(this.pommelMesh, true);
  }

  private rebuildBlade(b: BladeParams) {
    if (this.bladeMesh) {
      this.group.remove(this.bladeMesh);
      this.disposeMesh(this.bladeMesh);
      this.bladeMesh = null;
    }

    const geo = buildBladeGeometry(b);

    const mat = this.makeMaterial('blade');
    mat.side = THREE.DoubleSide as any;
    this.bladeMesh = new THREE.Mesh(geo, mat);
    // Align blade base exactly at y=0 (no extra offset)
    this.bladeMesh.position.y = 0.0;
    this.bladeMesh.castShadow = true;
    this.group.add(this.bladeMesh);

    // Fuller grooves: overlay ribbons (default) or carved geometry reduction
    if (this.fullerGroup) {
      this.group.remove(this.fullerGroup);
      this.disposeGroup(this.fullerGroup);
      this.fullerGroup = null;
    }
    if (b.fullerEnabled && (b.fullerLength ?? 0) > 0 && (b.fullerMode ?? 'overlay') === 'overlay' && (b.fullerDepth ?? 0) > 0) {
      this.fullerGroup = buildFullerOverlays(b);
      this.fullerGroup.position.copy(this.bladeMesh.position);
      this.group.add(this.fullerGroup);
    }

    // Engravings / inlays (simple box decals)
    if (this.engravingGroup) { this.group.remove(this.engravingGroup); this.disposeGroup(this.engravingGroup); this.engravingGroup = null; }
    const engr = (b as any).engravings as any[] | undefined;
    if (engr && engr.length && this.bladeMesh) {
      const bb = new THREE.Box3().setFromObject(this.bladeMesh);
      const yMin = bb.min.y;
      const halfTL = Math.max(0.001, (b.thicknessLeft ?? b.thickness ?? 0.08) * 0.5);
      const halfTR = Math.max(0.001, (b.thicknessRight ?? b.thickness ?? 0.08) * 0.5);
      const eps = 0.0006;
      const ggrp = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.6, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      this._fontCache = this._fontCache || new Map();
      const loader = new FontLoader();
      engr.forEach((e) => {
        const width = Math.max(0.005, e.width || 0.1);
        const height = Math.max(0.005, e.height || 0.02);
        const depth = Math.max(0.0005, e.depth || 0.002);
        const yPos = yMin + Math.max(0, Math.min((b.length || 0), e.offsetY || 0));
        const xPos = e.offsetX || 0;
        const rotY = e.rotation || 0;
        const sides: ('left'|'right')[] = e.side === 'both' ? ['left','right'] : [e.side || 'right'];
        if (e.type === 'text' && e.content && e.fontUrl) {
          const url: string = e.fontUrl;
          const buildText = (font: any) => {
            const tg = new TextGeometry(e.content, { font, size: height, height: depth * 0.8, curveSegments: 6 } as any);
            tg.computeBoundingBox();
            const bbx = tg.boundingBox!; const textW = bbx.max.x - bbx.min.x;
            const sx = textW > 1e-6 ? Math.min(10, width / textW) : 1;
            sides.forEach((side) => {
              const z = (side === 'right' ? (halfTR - eps) : -(halfTL - eps));
              const mesh = new THREE.Mesh(tg.clone(), mat);
              mesh.scale.set(sx, 1, 1);
              mesh.position.set(xPos - (textW * sx) / 2, yPos, z);
              mesh.rotation.y = rotY;
              ggrp.add(mesh);
            });
          };
          const cached = this._fontCache!.get(url);
          if (cached) buildText(cached);
          else loader.load(url, (font: any) => { this._fontCache!.set(url, font); buildText(font); });
        } else {
          sides.forEach((side) => {
            const z = (side === 'right' ? (halfTR - eps) : -(halfTL - eps));
            const geo = new THREE.BoxGeometry(width, height, depth);
            const m = new THREE.Mesh(geo, mat);
            m.position.set(xPos, yPos, z);
            m.rotation.y = rotY;
            ggrp.add(m);
          });
        }
      });
      this.engravingGroup = ggrp;
      this.group.add(this.engravingGroup);
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
      const gmat = this.makeMaterial('guard');
      this.guardMesh = new THREE.Mesh(geo, gmat);
      this.guardMesh.castShadow = true;
      // Center so that top of the bar meets blade base
      this.guardMesh.position.set(0, targetTopY - GUARD_HEIGHT * 0.5, 0);
      this.group.add(this.guardMesh);
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
      const geo = new THREE.ExtrudeGeometry(shape, { depth: heightY, bevelEnabled: false, steps: 1, curveSegments: Math.max(12, Math.round(g.curveSegments ?? 24)) });
      geo.center();
      const gmat2 = this.makeMaterial('guard'); (gmat2 as any).side = THREE.DoubleSide;
      this.guardMesh = new THREE.Mesh(geo, gmat2);
      this.guardMesh.castShadow = true;
      this.guardMesh.position.set(0, targetTopY, 0);
      this.guardMesh.rotation.z = g.tilt;
      this.group.add(this.guardMesh);
    } else if (g.style === 'knucklebow') {
      const group = new THREE.Group();
      const yTop = targetTopY;
      // Keep the bow close to the guard/top of the grip (under knuckles), not deep into the handle
      let yArc = yTop - 0.15;
      if (this.handleMesh) {
        const hb = new THREE.Box3().setFromObject(this.handleMesh);
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
      const gmat = this.makeMaterial('guard');
      const bow = new THREE.Mesh(tube, gmat);
      bow.castShadow = true;
      group.add(bow);
      group.rotation.z = g.tilt;
      this.guardGroup = group;
      this.group.add(group);
    } else if ((g as any).style === 'swept') {
      // Swept hilt: multiple curved bars (tubes) radiating from the guard
      const group = new THREE.Group();
      const xHalf = Math.max(0.2, g.width * 0.5);
      const yTop = targetTopY;
      let yEnd = yTop - 0.28;
      if (this.handleMesh) {
        const hb = new THREE.Box3().setFromObject(this.handleMesh);
        if (isFinite(hb.min.y) && isFinite(hb.max.y)) {
          const H = hb.max.y - hb.min.y;
          yEnd = yTop - Math.max(0.18, Math.min(0.35, H * 0.5));
        }
      }
      const gmat = this.makeMaterial('guard');
      const count = Math.max(2, Math.round(3 + (g.ornamentation ?? 0) * 4));
      const radius = Math.max(0.006, Math.min(0.04, g.thickness * 0.2));
      for (let i = 0; i < count; i++) {
        const t = count <= 1 ? 0 : (i / (count - 1));
        const side = i % 2 === 0 ? 1 : -1; // alternate left/right
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
      this.guardGroup = group;
      this.group.add(group);
    } else if ((g as any).style === 'basket') {
      // Basket hilt: radial cage of rods around the grip
      const group = new THREE.Group();
      const yTop = targetTopY;
      let yBottom = yTop - 0.25;
      if (this.handleMesh) {
        const hb = new THREE.Box3().setFromObject(this.handleMesh);
        if (isFinite(hb.min.y) && isFinite(hb.max.y)) {
          const H = hb.max.y - hb.min.y;
          yBottom = yTop - Math.max(0.18, Math.min(0.35, H * 0.45));
        }
      }
      const hParams:any = (this.lastParams?.handle || {});
      const rTopBase = hParams.radiusTop ?? 0.12;
      const oval = hParams.ovalRatio ?? 1.0;
      const avgR = 0.5 * (rTopBase * oval + rTopBase / Math.max(1e-6, oval));
      const margin = 0.05 + (g.ornamentation ?? 0) * 0.02;
      const ringR = avgR + margin;
      const gmat = this.makeMaterial('guard');
      const count = Math.max(6, Math.round(6 + (g.ornamentation ?? 0) * 6));
      const rodR = Math.max(0.006, Math.min(0.04, g.thickness * 0.18));
      for (let i=0;i<count;i++) {
        const phi = (i / count) * Math.PI * 2;
        const xTop = Math.cos(phi) * ringR;
        const zTop = Math.sin(phi) * ringR;
        const xBot = Math.cos(phi) * (ringR * 0.7);
        const zBot = Math.sin(phi) * (ringR * 0.7);
        const p0 = new THREE.Vector3(xTop, yTop, zTop);
        const p3 = new THREE.Vector3(xBot, yBottom, zBot);
        const p1 = new THREE.Vector3(xTop*0.95, (yTop + yBottom)*0.7, zTop*0.7);
        const p2 = new THREE.Vector3(xTop*0.85, (yTop + yBottom)*0.45, zTop*0.4);
        const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
        const tube = new THREE.TubeGeometry(curve, 64, rodR, 12, false);
        const rod = new THREE.Mesh(tube, gmat);
        rod.castShadow = true;
        group.add(rod);
      }
      group.rotation.z = g.tilt;
      this.guardGroup = group;
      this.group.add(group);
    } else {
      const gmat3 = this.makeMaterial('guard'); (gmat3 as any).side = THREE.DoubleSide;
      const half = buildGuardHalfShape(g);
      const depth = g.thickness;
      const geoR = new THREE.ExtrudeGeometry(half, { depth, bevelEnabled: false, steps: 1, curveSegments: Math.max(3, Math.min(64, Math.round(g.curveSegments ?? 12))) });
      // Do not center: keep inner edge at x=0 for correct alignment
      const meshR = new THREE.Mesh(geoR, gmat3);
      // Right half attached at inner edge x=0
      meshR.position.set(0, 0, -depth / 2);

      // Left half mirrored across X at inner edge
      const meshL = meshR.clone();
      meshL.scale.x = -1;

      const group = new THREE.Group();
      // Optional asymmetry: scale halves differently along X
      if (g.asymmetricArms) {
        const a = THREE.MathUtils.clamp(g.asymmetry ?? 0, -1, 1);
        const rightScale = 1 + 0.4 * a;
        const leftScale = 1 - 0.4 * a;
        meshR.scale.x *= Math.max(0.4, rightScale);
        meshL.scale.x *= Math.max(0.4, leftScale);
      }
      group.add(meshR, meshL);
      // Align inner edge (y=0 at x=0) to the blade base
      group.position.y = targetTopY;
      group.rotation.z = g.tilt;
      this.guardGroup = group;
      this.guardGroup.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
      this.group.add(group);
    }

    // Guard extras (side rings, finger guard)
    const extras = (g as any).extras as GuardParams['extras'] | undefined;
    if (extras && extras.length) {
      if (!this.guardGroup) {
        this.guardGroup = new THREE.Group();
        this.group.add(this.guardGroup);
      }
      const container = this.guardGroup;
      const gmatX = this.makeMaterial('guard');
      extras.forEach((ex) => {
        if (ex.kind === 'sideRing') {
          const R = Math.max(0.01, ex.radius);
          const r = Math.max(0.004, (ex.thickness ?? 0.03) * 0.5);
          const tor = new THREE.TorusGeometry(R, r, 10, 28);
          const ringL = new THREE.Mesh(tor, gmatX);
          ringL.position.set(-Math.max(0.2, g.width*0.5) - R*0.2, targetTopY + (ex.offsetY||0), 0);
          ringL.rotation.y = Math.PI/2;
          container.add(ringL);
          const ringR = ringL.clone();
          ringR.position.x *= -1;
          container.add(ringR);
        } else if (ex.kind === 'fingerGuard') {
          const xHalf = Math.max(0.2, g.width * 0.5);
          const yTop = targetTopY;
          const yArc = yTop - Math.max(0.06, Math.min(0.14, (ex.radius||0.12)));
          const p0 = new THREE.Vector3(+xHalf*0.6, yTop, 0);
          const p3 = new THREE.Vector3(-xHalf*0.6, yTop, 0);
          const p1 = new THREE.Vector3(+xHalf*0.5, yArc, 0);
          const p2 = new THREE.Vector3(-xHalf*0.5, yArc, 0);
          const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
          const tube = new THREE.TubeGeometry(curve, 36, Math.max(0.005, (ex.thickness??0.03)*0.5), 10, false);
          const fg = new THREE.Mesh(tube, gmatX);
          container.add(fg);
        }
      });
    }

    // Guard-blade blend fillet
    const fillet = Math.max(0, Math.min(1, (g as any).guardBlendFillet ?? 0));
    if (fillet > 0) {
      const bladeW = this.lastParams?.blade.baseWidth ?? 0.25;
      const bladeT = Math.max(this.lastParams?.blade.thicknessLeft ?? 0.08, this.lastParams?.blade.thicknessRight ?? 0.08);
      const w = bladeW * (1.02 + fillet*0.06);
      const h = 0.01 + fillet*0.02;
      const d = bladeT * (0.9 + fillet*0.2);
      const box = new THREE.BoxGeometry(w, h, d);
      const matF = this.makeMaterial('guard');
      const fil = new THREE.Mesh(box, matF);
      fil.position.set(0, targetTopY + h*0.5, 0);
      this.group.add(fil);
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

    // Quillons
    const qc = Math.max(0, Math.min(4, Math.round(g.quillonCount ?? 0)));
    if (qc > 0) {
      const qLen = Math.max(0.05, g.quillonLength ?? 0.25);
      const qRad = Math.max(0.01, 0.025 + (g.ornamentation ?? 0) * 0.02);
      const qMat = this.makeMaterial('guard');
      const cyl = new THREE.CylinderGeometry(qRad, qRad, qLen, Math.max(8, Math.round(12 + (g.ornamentation ?? 0) * 12)));
      const tipSharp = Math.max(0, Math.min(1, g.tipSharpness ?? 0.5));
      const cone = new THREE.ConeGeometry(qRad * (0.8 + 0.4 * tipSharp), qLen * 0.25 * tipSharp, 12);
      const addQuillon = (xSign: number, yOffset: number) => {
        const q = new THREE.Mesh(cyl, qMat);
        q.rotation.z = Math.PI / 2;
        q.position.set((g.width * 0.5 + qLen * 0.5) * xSign, targetTopY + yOffset, 0);
        this.group.add(q);
        const t = new THREE.Mesh(cone, qMat);
        t.rotation.z = Math.PI / 2;
        t.position.set((g.width * 0.5 + qLen) * xSign, targetTopY + yOffset, 0);
        this.group.add(t);
      };
      addQuillon(+1, 0);
      addQuillon(-1, 0);
      if (qc >= 4) {
        addQuillon(+1, 0.08);
        addQuillon(-1, -0.08);
      }
    }
  }

  private rebuildHandle(h: HandleParams) {
    if (this.handleMesh) { this.group.remove(this.handleMesh); this.disposeMesh(this.handleMesh); this.handleMesh = null; }
    if (this.handleGroup) { this.group.remove(this.handleGroup); this.disposeGroup(this.handleGroup); this.handleGroup = null; }
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
    const mat = this.makeMaterial('handle');
    if (h.wrapTexture) {
      const tex = makeWrapTexture(h.wrapTexScale ?? 10, h.wrapTexAngle ?? (Math.PI / 4));
      mat.map = tex;
      mat.needsUpdate = true;
    }
    this.handleMesh = new THREE.Mesh(geo, mat);
    this.handleMesh.castShadow = true;
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
    this.handleGroup = new THREE.Group();
    this.handleGroup.add(this.handleMesh);
    this.group.add(this.handleGroup);

    // Optional visible tang (inside/through handle)
    if (h.tangVisible) {
      const tw = Math.max(0.01, h.tangWidth ?? 0.05);
      const tt = Math.max(0.005, h.tangThickness ?? 0.02);
      const ty = h.length * 0.9;
      const geoTang = new THREE.BoxGeometry(tw, ty, tt);
      const matTang = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.7, roughness: 0.4 });
      const tang = new THREE.Mesh(geoTang, matTang);
      tang.position.y = -h.length * 0.5 + ty * 0.5;
      this.handleGroup.add(tang);
    }
    // Handle layers & extras
    const layers = (h as any).handleLayers as any[] | undefined;
    if (layers && layers.length) {
      const gmat = this.makeMaterial('handle');
      const hb = new THREE.Box3().setFromObject(this.handleMesh);
      const yMin = hb.min.y, yMax = hb.max.y; const H = Math.max(1e-6, yMax - yMin);
      const baseRadiusAt = (t:number) => {
        const baseR = h.radiusBottom + (h.radiusTop - h.radiusBottom) * t;
        const flare = Math.max(0, h.flare ?? 0) * Math.pow(1 - t, 2);
        return Math.max(0.02, baseR + flare);
      };
      class HelixCurve extends (THREE as any).Curve {
        constructor(public y0:number, public y1:number, public turns:number, public rFunc:(t:number)=>number, public phase:number){ super(); }
        getPoint(u:number) {
          const y = this.y0 + (this.y1 - this.y0) * u;
          const t = (y - yMin) / Math.max(1e-6, H);
          const r = this.rFunc(t);
          const phi = this.phase + 2 * Math.PI * this.turns * u;
          return new THREE.Vector3(Math.cos(phi)*r, y, Math.sin(phi)*r);
        }
      }
      layers.forEach((L) => {
        if (L.kind === 'wrap' && (L.wrapPattern === 'crisscross')) {
          const y0 = yMin + (L.y0Frac ?? 0) * H;
          const y1 = y0 + (L.lengthFrac ?? 1) * H;
          const turns = Math.max(1, L.turns ?? 6);
          const depth = Math.max(0.001, Math.min(0.05, L.depth ?? 0.012));
          const rFunc = (t:number)=> baseRadiusAt(t) + depth;
          const c1:any = new HelixCurve(y0, y1, +turns, rFunc, 0);
          const c2:any = new HelixCurve(y0, y1, -turns, rFunc, 0);
          const tubeR = Math.max(0.002, depth * 0.3);
          const tube1 = new THREE.TubeGeometry(c1, 200, tubeR, 8, false);
          const tube2 = new THREE.TubeGeometry(c2, 200, tubeR, 8, false);
          this.handleGroup!.add(new THREE.Mesh(tube1, gmat), new THREE.Mesh(tube2, gmat));
        }
        if (L.kind === 'ring') {
          const y = yMin + (L.y0Frac ?? 0.5) * H;
          const t = (y - yMin) / H; const r = baseRadiusAt(t) + (L.radiusAdd ?? 0.0);
          const tor = new THREE.TorusGeometry(r, Math.max(0.002, 0.01), 8, 32);
          const ring = new THREE.Mesh(tor, gmat);
          ring.position.y = y;
          ring.rotation.x = Math.PI/2;
          this.handleGroup!.add(ring);
        }
        if (L.kind === 'inlay') {
          const y = yMin + (L.y0Frac ?? 0.5) * H;
          const box = new THREE.BoxGeometry(0.03, 0.01, 0.005);
          const m = new THREE.Mesh(box, gmat);
          m.position.set(0, y, baseRadiusAt((y-yMin)/H) - 0.003);
          this.handleGroup!.add(m);
        }
      });
    }
    // Menuki
    const menuki = (h as any).menuki as any[] | undefined;
    if (menuki && menuki.length) {
      const matM = this.makeMaterial('handle');
      const hb2 = new THREE.Box3().setFromObject(this.handleMesh);
      const yMin2 = hb2.min.y, yMax2 = hb2.max.y; const H2 = Math.max(1e-6, yMax2 - yMin2);
      menuki.forEach((m) => {
        const y = yMin2 + (m.positionFrac ?? 0.5) * H2;
        const t = (y - yMin2) / H2;
        const r = Math.max(0.02, h.radiusBottom + (h.radiusTop - h.radiusBottom) * t);
        const x = (m.side === 'left' ? -r : +r);
        const sph = new THREE.SphereGeometry(Math.max(0.005, m.size ?? 0.02), 12, 8);
        const mesh = new THREE.Mesh(sph, matM);
        mesh.position.set(x, y, 0);
        this.handleGroup!.add(mesh);
      });
    }

    // Rivets: place N small spheres around a ring at given fraction
    const rivets = (h as any).rivets as any[] | undefined;
    if (rivets && rivets.length) {
      const matR = this.makeMaterial('handle');
      const hb3 = new THREE.Box3().setFromObject(this.handleMesh);
      const yMin3 = hb3.min.y, yMax3 = hb3.max.y; const H3 = Math.max(1e-6, yMax3 - yMin3);
      rivets.forEach((rv) => {
        const n = Math.max(1, Math.round(rv.count ?? 1));
        const y = yMin3 + Math.max(0, Math.min(1, rv.ringFrac ?? 0.5)) * H3;
        const t = (y - yMin3) / H3;
        const baseR = Math.max(0.02, h.radiusBottom + (h.radiusTop - h.radiusBottom) * t);
        const rr = Math.max(0.002, rv.radius ?? 0.01);
        const geo = new THREE.SphereGeometry(rr, 10, 8);
        for (let i=0;i<n;i++) {
          const phi = (i / n) * Math.PI * 2;
          const x = Math.cos(phi) * baseR;
          const z = Math.sin(phi) * baseR;
          const m = new THREE.Mesh(geo, matR);
          m.position.set(x, y, z);
          this.handleGroup!.add(m);
        }
      });
    }
  }

  private rebuildPommel(p: PommelParams) {
    if (this.pommelMesh) {
      this.group.remove(this.pommelMesh);
      this.disposeMesh(this.pommelMesh);
      this.pommelMesh = null;
    }
    const mat = this.makeMaterial('pommel');
    let mesh: THREE.Mesh;
    const facets = Math.max(6, Math.round(p.facetCount ?? 32));

    // Size auto-balance based on crude blade mass estimate
    const bal = THREE.MathUtils.clamp(p.balance ?? 0, 0, 1);
    const b = this.lastParams?.blade;
    const mass = b ? (b.length * ((b.baseWidth + b.tipWidth) * 0.5) * (((b.thicknessLeft ?? b.thickness ?? 0.08) + (b.thicknessRight ?? b.thickness ?? 0.08)) * 0.5)) : 1.0;
    const sizeAuto = Math.cbrt(Math.max(1e-6, mass)) * 0.35; // calibrated factor
    const sizeEff = THREE.MathUtils.clamp(THREE.MathUtils.lerp(p.size, sizeAuto, bal), 0.05, 1.0);

    if (p.style === 'disk') {
      const heightY = Math.max(0.02, sizeEff * 0.15);
      const geo = new THREE.CylinderGeometry(sizeEff * (1.0 + p.shapeMorph), sizeEff * (1.0 + p.shapeMorph), heightY, facets);
      mesh = new THREE.Mesh(geo, mat);
      // Disk should lie flat with its faces perpendicular to the handle axis (Y).
      // CylinderGeometry is oriented along Y by default — no extra rotation needed.
      mesh.rotation.set(0, 0, 0);
    } else if (p.style === 'spike') {
      const height = sizeEff * (1.2 + p.shapeMorph) * (p.spikeLength ?? 1);
      const geo = new THREE.ConeGeometry(sizeEff * (0.8 + 0.4 * p.shapeMorph), height, facets);
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.z = Math.PI; // point down
    } else {
      const geo = new THREE.SphereGeometry(sizeEff, facets, Math.max(8, Math.round(facets/2)));
      mesh = new THREE.Mesh(geo, mat);
      // morph: squash/stretch horizontally
      const s = 1.0 + (p.shapeMorph - 0.5) * 0.6;
      mesh.scale.set(1.0 * s, 1.0, 1.0 * s);
    }
    if (p.style !== 'disk') {
      mesh.scale.y *= THREE.MathUtils.clamp(p.elongation, 0.5, 2);
    }
    this.pommelMesh = mesh;
    this.pommelMesh.castShadow = true;
    // Place pommel just below handle bottom if handle exists
    let y = -1.0;
    if (this.handleMesh) {
      this.handleMesh.updateMatrixWorld();
      const box = new THREE.Box3().setFromObject(this.handleMesh);
      if (isFinite(box.min.y)) y = box.min.y;
    }
    this.pommelMesh.position.y = y - sizeEff * 0.3 * p.elongation + (p.offsetY ?? 0);
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
      fullerMode: (b.fullerMode ?? 'overlay') as any,
      fullerProfile: (b.fullerProfile ?? 'u') as any,
      fullerWidth: clamp(b.fullerWidth ?? 0, 0, (b.baseWidth || 0.25)),
      fullerInset: clamp(b.fullerInset ?? (b.fullerDepth ?? 0), 0, 0.2),
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
      serrationPattern: (b.serrationPattern ?? 'sine') as any,
      serrationSeed: Math.round(clamp(b.serrationSeed ?? 1337, 0, 999999)),
      twistAngle: clamp(b.twistAngle ?? 0, -Math.PI * 2, Math.PI * 2),
      crossSection: (b.crossSection ?? 'flat') as any,
      bevel: clamp(b.bevel ?? 0.5, 0, 1),
      tipShape: (b.tipShape ?? 'pointed') as any,
      tipBulge: clamp(b.tipBulge ?? 0.2, 0, 1),
      engravings: Array.isArray((b as any).engravings) ? (b as any).engravings : undefined
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
      habakiMargin: clamp(g.habakiMargin ?? 0.01, 0.002, 0.08),
      heightOffset: clamp(g.heightOffset ?? 0, -0.5, 0.5),
      quillonCount: Math.round(clamp(g.quillonCount ?? 0, 0, 4)),
      quillonLength: clamp(g.quillonLength ?? 0.25, 0.05, 1.5),
      ornamentation: clamp(g.ornamentation ?? 0, 0, 1),
      tipSharpness: clamp(g.tipSharpness ?? 0.5, 0, 1),
      cutoutCount: Math.round(clamp(g.cutoutCount ?? 0, 0, 12)),
      cutoutRadius: clamp(g.cutoutRadius ?? 0.5, 0.1, 0.8),
      guardBlendFillet: clamp((g as any).guardBlendFillet ?? 0, 0, 1),
      extras: Array.isArray((g as any).extras) ? (g as any).extras.map((e: any) => ({
        kind: (e.kind ?? 'sideRing') as any,
        radius: clamp(e.radius ?? 0.12, 0.01, 0.6),
        thickness: clamp(e.thickness ?? 0.03, 0.005, 0.2),
        offsetY: clamp(e.offsetY ?? 0, -0.5, 0.5),
        offsetX: clamp(e.offsetX ?? 0, -0.5, 0.5),
        tilt: clamp(e.tilt ?? 0, -Math.PI/2, Math.PI/2)
      })) : undefined
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
      tangThickness: clamp(h.tangThickness ?? 0.02, 0.003, 0.1),
      handleLayers: Array.isArray((h as any).handleLayers) ? (h as any).handleLayers : undefined,
      menuki: Array.isArray((h as any).menuki) ? (h as any).menuki : undefined,
      rivets: Array.isArray((h as any).rivets) ? (h as any).rivets : undefined
    };

    const pm = params.pommel;
    const pommel: PommelParams = {
      size: clamp(pm.size, 0.05, 1),
      elongation: clamp(pm.elongation, 0.5, 2),
      style: (pm.style ?? 'orb') as PommelStyle,
      shapeMorph: clamp(pm.shapeMorph, 0, 1),
      offsetX: clamp(pm.offsetX ?? 0, -0.5, 0.5),
      offsetY: clamp(pm.offsetY ?? 0, -0.5, 0.5),
      facetCount: Math.round(clamp(pm.facetCount ?? 32, 6, 64)),
      spikeLength: clamp(pm.spikeLength ?? 1.0, 0.5, 2.0),
      balance: clamp(pm.balance ?? 0, 0, 1)
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
  const serPat = b.serrationPattern ?? 'sine';
  const serSeed = b.serrationSeed ?? 1337;
  const serr = (t:number, freq:number, amp:number) => {
    if (!amp || !freq) return 0;
    const ph = t * Math.PI * freq;
    switch(serPat){
      case 'saw': { const k = ph/Math.PI; return amp * (2*(k - Math.floor(k+0.5))); }
      case 'scallop': return amp * (1 - Math.abs(Math.sin(ph)));
      case 'random': return amp * (Math.sin(ph*1.7+serSeed*0.1)+Math.sin(ph*2.3+serSeed*0.2))*0.5;
      default: return amp * Math.sin(ph);
    }
  };
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * length;
    const w = tipWidthWithKissaki(b, t, baseW, tipW);
    const serrR = serr(t, serrFreq, serrAmpR) * (1 - t);
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
    const serrL = serr(t, serrFreq, serrAmpL) * (1 - t);
    const half = Math.max(0.001, w * 0.5);
    const asym = (b.asymmetry ?? 0);
    const leftHalf = Math.max(0.0005, (half + serrL) * (1 - 0.5 * asym));
    const bend = bendOffsetX(b, y, length);
    pts.push(new THREE.Vector2(-leftHalf + bend, y));
  }
  return pts;
}

export function bladeOutlineToSVG(points: THREE.Vector2[], stroke = '#111827'): string {
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
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${(width + pad * 2).toFixed(2)}" height="${(height + pad * 2).toFixed(2)}" viewBox="0 0 ${(width + pad * 2).toFixed(2)} ${(height + pad * 2).toFixed(2)}" preserveAspectRatio="xMidYMid meet">\n  <path d="${d}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>\n</svg>`;
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
  let w: number;
  if (kf <= 1e-6) {
    // No explicit kissaki segment — linear taper
    w = baseW + (tipW - baseW) * t;
  } else {
    const split = 1 - kf;
    const midW = baseW + (tipW - baseW) * split;
    if (t <= split) {
      w = baseW + (midW - baseW) * (t / Math.max(1e-6, split));
    } else {
      const u = (t - split) / Math.max(1e-6, kf);
      let r = THREE.MathUtils.clamp(b.kissakiRoundness ?? 0.5, 0, 1);
      if (b.tipShape === 'rounded') r = 1; // force rounder tip falloff
      const expo = THREE.MathUtils.lerp(0.5, 3.0, 1 - r);
      const eased = Math.pow(u, expo);
      w = midW + (tipW - midW) * eased;
    }
  }
  // Optional leaf bulge profile across the blade (symmetric around mid)
  if (b.tipShape === 'leaf') {
    const bulge = THREE.MathUtils.clamp(b.tipBulge ?? 0.2, 0, 1);
    const bell = 4 * t * (1 - t); // 0 at ends, 1 at t=0.5
    w *= 1 + bulge * bell;
  }
  return w;
}

function buildBladeGeometry(b: BladeParams): THREE.BufferGeometry {
  const L = Math.max(0.01, b.length);
  const TL = Math.max(0.001, b.thicknessLeft ?? b.thickness ?? 0.08);
  const TR = Math.max(0.001, b.thicknessRight ?? b.thickness ?? 0.08);
  const baseW = Math.max(0.002, b.baseWidth);
  const tipW = Math.max(0, b.tipWidth);
  const segs = Math.max(16, Math.min(512, Math.round(b.sweepSegments ?? 128))); // longitudinal resolution
  const cols = 12; // cross-section samples across width
  const serrAmp = b.serrationAmplitude ?? 0;
  const serrAmpL = b.serrationAmplitudeLeft ?? serrAmp;
  const serrAmpR = b.serrationAmplitudeRight ?? serrAmp;
  const serrFreq = b.serrationFrequency ?? 0;
  const chaos = b.chaos ?? 0;

  // Positions layout: per row we store (cols+1) cross-samples, each with 2 vertices (front/back)
  const rowStride = (cols + 1) * 2;
  const positions = new Float32Array((segs + 1) * rowStride * 3);
  const indices: number[] = [];

  const vIndex = (i: number, j: number, side: 0 | 1) => (i * rowStride + j * 2 + side);
  const setV = (i: number, j: number, side: 0 | 1, x: number, y: number, z: number) => {
    const idx = vIndex(i, j, side) * 3;
    positions[idx + 0] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
  };

  const halfEdgeL = TL * 0.5;
  const halfEdgeR = TR * 0.5;
  const edgeMidHalf = 0.5 * (halfEdgeL + halfEdgeR);
  const bevel = THREE.MathUtils.clamp(b.bevel ?? 0.5, 0, 1);

  const shapeFactor = (u: number) => {
    // u ∈ [-1, 1], 0 at center
    const cs = b.crossSection ?? 'flat';
    const au = Math.abs(u);
    if (cs === 'diamond') {
      const pow = THREE.MathUtils.lerp(1.0, 2.5, bevel);
      return 1 - Math.pow(au, pow);
    } else if (cs === 'lenticular') {
      const g = THREE.MathUtils.lerp(1.4, 0.8, bevel);
      const base = Math.max(0, 1 - au * au);
      return Math.pow(base, 0.5 * g);
    } else if (cs === 'hexagonal') {
      // flatter top (plateau) toward center when bevel small
      const p = THREE.MathUtils.lerp(0.4, 1.0, bevel);
      return Math.pow(1 - au, Math.max(0.2, p));
    } else {
      return 0; // flat
    }
  };

  // serration helper
  const serr = (t:number, freq:number, amp:number, pattern: BladeParams['serrationPattern'], seed:number) => {
    if (!amp || !freq) return 0;
    const ph = t * Math.PI * freq;
    switch(pattern){
      case 'saw': {
        const k = ph/Math.PI; return amp * (2*(k - Math.floor(k+0.5)));
      }
      case 'scallop': return amp * (1 - Math.abs(Math.sin(ph)));
      case 'random': return amp * (Math.sin(ph*1.7+seed*0.1)+Math.sin(ph*2.3+seed*0.2))*0.5;
      default: return amp * Math.sin(ph);
    }
  };
  const serPat = b.serrationPattern ?? 'sine';
  const serSeed = (b.serrationSeed ?? 1337);

  // fuller carve helpers
  const wantCarve = (b.fullerMode ?? 'overlay') === 'carve' && (b.fullerEnabled ?? false) && (b.fullerLength ?? 0) > 0 && (b.fullerInset ?? b.fullerDepth ?? 0) > 0;
  const carveWidth = (b.fullerWidth && b.fullerWidth > 0) ? b.fullerWidth : (b.baseWidth || 0.25) * 0.3;
  const insetBase = Math.min(Math.max(0, b.fullerInset ?? b.fullerDepth ?? 0), 0.2);
  const prof = b.fullerProfile ?? 'u';

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = t * L;
    const w = tipWidthWithKissaki(b, t, baseW, tipW);
    const serrL = serr(t, serrFreq, serrAmpL, serPat, serSeed) * (1 - t);
    const serrR = serr(t, serrFreq, serrAmpR, serPat, serSeed) * (1 - t);
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

    // Cross-section center target thickness (spine) rises with bevel
    const centerHalf = edgeMidHalf * (1 + 2.0 * bevel);

    const twist = (b.twistAngle ?? 0) * t;
    const cosT = Math.cos(twist), sinT = Math.sin(twist);
    const rot = (x: number, z: number) => ({ x: x * cosT - z * sinT, z: x * sinT + z * cosT });

    for (let j = 0; j <= cols; j++) {
      const s = j / cols; // 0..1 across width
      const u = s * 2 - 1; // -1..1
      const xRaw = THREE.MathUtils.lerp(xl, xr, s);
      const edgeHalf = THREE.MathUtils.lerp(halfEdgeL, halfEdgeR, s);
      const f = shapeFactor(u);
      let zHalf = edgeHalf + (centerHalf - edgeMidHalf) * f;
      // Optional carved fuller reduction across face
      if (wantCarve) {
        const y0 = Math.max(0, (b.fullerLength ?? 0) * 0.0 * L + 0.05 * L);
        const y1 = L - Math.max(0, 0.12 * (b.baseWidth || 0.2));
        if (y >= y0 && y <= y1) {
          const cx = bend; // approximate center line
          const halfW = carveWidth * 0.5;
          const dx = Math.abs(xRaw - cx);
          if (dx <= halfW) {
            const tX = 1 - THREE.MathUtils.clamp(dx / Math.max(1e-6, halfW), 0, 1);
            let profile = tX;
            if (prof === 'u') profile = Math.sqrt(tX);
            else if (prof === 'v') profile = tX;
            const inset = profile * insetBase;
            zHalf = Math.max(0.0006, zHalf - inset);
          }
        }
      }
      const front = rot(xRaw, -zHalf);
      const back = rot(xRaw, +zHalf);
      setV(i, j, 0, front.x, y, front.z);
      setV(i, j, 1, back.x, y, back.z);
    }
  }

  // Faces along length for front and back, and side edges
  for (let i = 0; i < segs; i++) {
    // front/back surfaces across width
    for (let j = 0; j < cols; j++) {
      const f00 = vIndex(i, j, 0), f01 = vIndex(i, j + 1, 0);
      const f10 = vIndex(i + 1, j, 0), f11 = vIndex(i + 1, j + 1, 0);
      const b00 = vIndex(i, j, 1), b01 = vIndex(i, j + 1, 1);
      const b10 = vIndex(i + 1, j, 1), b11 = vIndex(i + 1, j + 1, 1);
      // Front
      indices.push(f00, f01, f11, f00, f11, f10);
      // Back (reverse winding)
      indices.push(b00, b11, b01, b00, b10, b11);
    }
    // Left side (thickness wall at j=0)
    const lf0 = vIndex(i, 0, 0), lb0 = vIndex(i, 0, 1);
    const lf1 = vIndex(i + 1, 0, 0), lb1 = vIndex(i + 1, 0, 1);
    indices.push(lf0, lb0, lb1, lf0, lb1, lf1);
    // Right side (thickness wall at j=cols)
    const rf0 = vIndex(i, cols, 0), rb0 = vIndex(i, cols, 1);
    const rf1 = vIndex(i + 1, cols, 0), rb1 = vIndex(i + 1, cols, 1);
    indices.push(rf0, rb1, rb0, rf0, rf1, rb1);
  }

  // Base cap at y=0 and tip cap at y=L
  for (let j = 0; j < cols; j++) {
    const f0 = vIndex(0, j, 0), b0 = vIndex(0, j, 1);
    const f1 = vIndex(0, j + 1, 0), b1 = vIndex(0, j + 1, 1);
    // Base cap (normal ~ -Y)
    indices.push(f0, b1, b0, f0, f1, b1);
    const fn0 = vIndex(segs, j, 0), bn0 = vIndex(segs, j, 1);
    const fn1 = vIndex(segs, j + 1, 0), bn1 = vIndex(segs, j + 1, 1);
    // Tip cap (normal ~ +Y)
    indices.push(fn0, bn0, bn1, fn0, bn1, fn1);
  }

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
      baseAngle: 0.0,
      tipShape: 'pointed',
      tipBulge: 0.2
    },
    guard: {
      width: 1.2,
      thickness: 0.2,
      curve: 0.3,
      tilt: 0.0,
      style: 'winged',
      habakiEnabled: false,
      habakiHeight: 0.06,
      habakiMargin: 0.01,
      asymmetricArms: false,
      asymmetry: 0
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
      shapeMorph: 0.2,
      offsetX: 0,
      offsetY: 0,
      facetCount: 32,
      spikeLength: 1.0,
      balance: 0
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
  const sharp = Math.max(0, Math.min(1, g.tipSharpness ?? 0.5));
  const h = 0.12 + Math.abs(g.curve) * 0.25 + sharp * 0.15;
  const shape = new THREE.Shape();
  if (g.style === 'winged') {
    // Curved, broad wing
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(w * (0.4 + 0.2 * sharp), g.curve * h, w, 0.02 + 0.02 * sharp);
    shape.lineTo(w * (0.8 + 0.1 * sharp), -0.06 - 0.03 * sharp);
    shape.lineTo(0, -0.02);
    shape.closePath();
  } else if (g.style === 'claw') {
    // Narrower, pointy prong
    const tipY = (0.06 + 0.06 * sharp) + g.curve * h;
    shape.moveTo(0, 0);
    shape.lineTo(w * (0.7 + 0.2 * sharp), tipY);
    shape.lineTo(w * (0.6 + 0.2 * sharp), -0.07 - 0.03 * sharp);
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
