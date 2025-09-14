import * as THREE from 'three';
/**
 * SwordGenerator orchestrates building a sword from param objects into a grouped
 * Three.js scene graph. It delegates actual geometry work to focused modules
 * under `./sword` and keeps responsibilities limited to:
 * - Wiring part builders (blade, guard, handle, pommel) and extras (fullers, hamon, engravings)
 * - Managing materials and highlights
 * - Disposing previous meshes/groups on rebuild
 * - Producing basic dynamic properties of the blade for UI (via dynamics.ts)
 *
 * Coordinate system:
 * - The blade runs along +Y with base at y=0. Guard and handle extend toward -Y.
 * - X is left/right width; Z is thickness.
 *
 * Notes:
 * - This class aims to remain UI-free and side-effect light beyond Three.js usage.
 * - Geometry/math helpers are pure and maintained in `./sword` for reuse and testing.
 */
// Re-export default parameter factory from a dedicated module
export { defaultSwordParams } from './sword/defaults';
import { computeBladeDynamics } from './sword/dynamics';
// Types are centralized under ./sword/types for reuse
export type { BladeParams, GuardStyle, GuardParams, HandleParams, PommelStyle, PommelParams, SwordParams } from './sword/types';
// Geometry helpers now live in focused modules
import { buildBladeGeometry, buildFullerOverlays, buildHamonOverlays, buildBladeOutlinePoints, bladeOutlineToSVG } from './sword/bladeGeometry';
import { buildGuard } from './sword/guardGeometry';
import { decorateGuard } from './sword/guardDecor';
import { buildGuardHalfShape } from './sword/guardShapes';
import { buildHandle } from './sword/handleGeometry';
import { buildPommel } from './sword/pommelGeometry';
import { buildEngravingsGroup } from './sword/engravings';
import { validateSwordParams } from './sword/validation';
// Re-export selected helpers for existing consumers
export { buildBladeOutlinePoints, bladeOutlineToSVG } from './sword/bladeGeometry';

// Types moved to './sword/types'

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
    private derived?: { mass: number; cmY: number; Ibase: number; Icm: number; copY: number };

  /**
   * Create a generator and immediately build geometry for the provided params.
   * Optionally pass material overrides per part.
   */
  constructor(initial: SwordParams, materials?: Record<'blade'|'guard'|'handle'|'pommel', any>) {
    this.mats = materials;
    this.updateGeometry(initial);
  }
  /**
   * Resolve any ratio-based derived params without mutating the input. The returned
   * object is safe to validate and pass to builders.
   */
  private resolveDerivedParams(params: SwordParams): SwordParams {
    const copy: SwordParams = JSON.parse(JSON.stringify(params));
    if ((params as any).useRatios) {
      const r = (params as any).ratios || {};
      const L = params.blade?.length ?? 3.0;
      if (typeof r.guardWidthToBlade === 'number') copy.guard.width = Math.max(0.2, r.guardWidthToBlade * L);
      if (typeof r.handleLengthToBlade === 'number') copy.handle.length = Math.max(0.2, r.handleLengthToBlade * L);
      if (typeof r.pommelSizeToBlade === 'number') copy.pommel.size = Math.max(0.05, r.pommelSizeToBlade * L);
    }
    return copy;
  }
  /** Apply new material presets and rebind to existing meshes/groups. */
  public setMaterials(mats: Record<'blade'|'guard'|'handle'|'pommel', any>) {
    this.mats = mats; this.reapplyMaterials();
  }
  /**
   * Create a MeshPhysicalMaterial for a given part, honoring optional maps and
   * extended PBR properties when provided in the presets.
   */
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
  /** Traverse current parts and set freshly created materials. */
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

  /** Return last computed dynamics (mass proxy, CM, inertias, CoP). */
  public getDerived() { return this.derived; }

  private _texLoader?: THREE.TextureLoader;
  private _texCache?: Map<string, THREE.Texture>;
  /**
   * Lazy texture loader with a tiny cache. Returns a placeholder texture
   * immediately while the real asset loads; caller can re-render when it resolves.
   */
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

  /** Validate, normalize and rebuild all parts for a new parameter set. */
  updateGeometry(params: SwordParams) {
    const p = validateSwordParams(this.resolveDerivedParams(params));
    const prev = this.lastParams;
    this.lastParams = p;

    // Rebuild blade on any blade param change to avoid scaling artifacts
    this.rebuildBlade(p.blade);

    this.rebuildGuard(p.guard);
    this.rebuildHandle(p.handle);
    this.rebuildPommel(p.pommel);
    this.derived = computeBladeDynamics(p.blade);
  }

  /** Enable emissive highlighting for a single named part. */
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

  /** Dispose and rebuild blade and its visual overlays (fullers, hamon, engravings). */
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

    // Engravings / inlays
    if (this.engravingGroup) { this.group.remove(this.engravingGroup); this.disposeGroup(this.engravingGroup); this.engravingGroup = null }
    if ((b as any).engravings && (b as any).engravings.length && this.bladeMesh) {
      const built = buildEngravingsGroup(b, this.bladeMesh, this._fontCache)
      if (built) { this._fontCache = built.fontCache; this.engravingGroup = built.group; this.group.add(this.engravingGroup) }
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

  /** Dispose and rebuild guard (core and decorations). */
  private rebuildGuard(g: GuardParams) {
    // Prefer modular guard builder + decorator
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

    // Build guard core and decorate
    const built = buildGuard(g, { bladeMesh: this.bladeMesh, handleMesh: this.handleMesh, makeMaterial: (p)=> this.makeMaterial(p) })
    if (built.guardMesh) { this.guardMesh = built.guardMesh; this.group.add(this.guardMesh) }
    if (built.guardGroup) { this.guardGroup = built.guardGroup; this.group.add(this.guardGroup) }
    const deco = decorateGuard(g, { swordGroup: this.group, guardGroup: this.guardGroup, bladeMesh: this.bladeMesh, handleMesh: this.handleMesh, bladeParams: this.lastParams?.blade ?? null, makeMaterial: (p)=> this.makeMaterial(p) })
    if (!this.guardGroup && deco.guardGroup) { this.guardGroup = deco.guardGroup }
  }

  /** Dispose and rebuild handle and its attached group/layers. */
  private rebuildHandle(h: HandleParams) {
    if (this.handleMesh) { this.group.remove(this.handleMesh); this.disposeMesh(this.handleMesh); this.handleMesh = null }
    if (this.handleGroup) { this.group.remove(this.handleGroup); this.disposeGroup(this.handleGroup); this.handleGroup = null }
    const built = buildHandle(h, (p)=> this.makeMaterial(p))
    this.handleMesh = built.handleMesh
    this.handleGroup = built.handleGroup
    this.group.add(this.handleGroup)
  }

  /** Dispose and rebuild the pommel, placing it below the handle. */
  private rebuildPommel(p: PommelParams) {
    if (this.pommelMesh) { this.group.remove(this.pommelMesh); this.disposeMesh(this.pommelMesh); this.pommelMesh = null }
    this.pommelMesh = buildPommel(p, { handleMesh: this.handleMesh, blade: this.lastParams?.blade ?? null }, (part)=> this.makeMaterial(part))
    this.group.add(this.pommelMesh)
  }

  // Validation moved to ./sword/validation

  /** Dispose geometry and materials for a single mesh. */
  private disposeMesh(mesh: THREE.Mesh) {
    (mesh.geometry as any)?.dispose?.();
    const mat = mesh.material as THREE.Material | THREE.Material[];
    if (Array.isArray(mat)) mat.forEach((m) => (m as any)?.dispose?.());
    else (mat as any)?.dispose?.();
  }

  /** Dispose geometries/materials for all meshes in a group. */
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

// outline helpers moved to ./sword/bladeGeometry

// outline helpers moved to ./sword/bladeGeometry (re-exported)

// bladeOutlineToSVG moved to ./sword/bladeGeometry (re-exported)

// handle wrap texture moved to ./sword/handleTextures

// defaultSwordParams moved to ./sword/defaults

// moved: buildHamonOverlays in ./sword/bladeGeometry

// moved: buildGuardHalfShape in ./sword/guardShapes

// computeBladeDynamics moved to ./sword/dynamics
