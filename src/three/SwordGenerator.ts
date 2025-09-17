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
import { TextureCache } from './sword/textures';
import { createMaterial } from './sword/materials';
import { disposeObject3D } from './sword/utils';
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
  private mats?: Record<'blade'|'guard'|'handle'|'pommel', any>;
  private _texCache = new TextureCache();

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
   * Create a MeshPhysicalMaterial for a given part using shared material factory.
   */
  private makeMaterial(part: 'blade'|'guard'|'handle'|'pommel'): THREE.MeshPhysicalMaterial {
    return createMaterial(part, this.mats?.[part] ?? null, this._texCache);
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

  // Texture loading delegated to TextureCache via createMaterial

  /** Validate, normalize and rebuild all parts for a new parameter set. */
  updateGeometry(params: SwordParams) {
    const p = validateSwordParams(this.resolveDerivedParams(params));
    const prev = this.lastParams;
    this.lastParams = p;

    // Rebuild blade on any blade param change to avoid scaling artifacts
    this.rebuildBlade(p.blade);
    // Optionally build or remove hilt (guard, handle, pommel)
    if (p.hiltEnabled === false) {
      // Remove guard
      if (this.guardMesh) { this.group.remove(this.guardMesh); disposeObject3D(this.guardMesh); this.guardMesh = null }
      if (this.guardGroup) { this.group.remove(this.guardGroup); disposeObject3D(this.guardGroup); this.guardGroup = null }
      // Remove handle
      if (this.handleMesh) { this.group.remove(this.handleMesh); disposeObject3D(this.handleMesh); this.handleMesh = null }
      if (this.handleGroup) { this.group.remove(this.handleGroup); disposeObject3D(this.handleGroup); this.handleGroup = null }
      // Remove pommel
      if (this.pommelMesh) { this.group.remove(this.pommelMesh); disposeObject3D(this.pommelMesh); this.pommelMesh = null }
    } else {
      // Guard: optional independent toggle
      if (p.guardEnabled === false) {
        if (this.guardMesh) { this.group.remove(this.guardMesh); disposeObject3D(this.guardMesh); this.guardMesh = null }
        if (this.guardGroup) { this.group.remove(this.guardGroup); disposeObject3D(this.guardGroup); this.guardGroup = null }
      } else {
        this.rebuildGuard(p.guard);
      }
      // Ensure order: handle before pommel for placement dependence
      this.rebuildHandle(p.handle);
      this.rebuildPommel(p.pommel);
    }
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
      disposeObject3D(this.bladeMesh);
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
      disposeObject3D(this.fullerGroup);
      this.fullerGroup = null;
    }
    const maybeFullers = buildFullerOverlays(b);
    if (maybeFullers.children.length > 0) {
      this.fullerGroup = maybeFullers;
      this.fullerGroup.position.copy(this.bladeMesh.position);
      this.group.add(this.fullerGroup);
    } else {
      disposeObject3D(maybeFullers);
    }

    // Engravings / inlays
    if (this.engravingGroup) { this.group.remove(this.engravingGroup); disposeObject3D(this.engravingGroup); this.engravingGroup = null }
    if ((b as any).engravings && (b as any).engravings.length && this.bladeMesh) {
      const built = buildEngravingsGroup(b, this.bladeMesh, this._fontCache)
      if (built) { this._fontCache = built.fontCache; this.engravingGroup = built.group; this.group.add(this.engravingGroup) }
    }

    // Hamon visual overlay along edge
    if (this.hamonGroup) {
      this.group.remove(this.hamonGroup);
      disposeObject3D(this.hamonGroup);
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
      disposeObject3D(this.guardMesh);
      this.guardMesh = null;
    }
    if (this.guardGroup) {
      this.group.remove(this.guardGroup);
      disposeObject3D(this.guardGroup);
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
    if (this.handleMesh) { this.group.remove(this.handleMesh); disposeObject3D(this.handleMesh); this.handleMesh = null }
    if (this.handleGroup) { this.group.remove(this.handleGroup); disposeObject3D(this.handleGroup); this.handleGroup = null }
    const built = buildHandle(h, (p)=> this.makeMaterial(p))
    this.handleMesh = built.handleMesh
    this.handleGroup = built.handleGroup
    this.group.add(this.handleGroup)
  }

  /** Dispose and rebuild the pommel, placing it below the handle. */
  private rebuildPommel(p: PommelParams) {
    if (this.pommelMesh) { this.group.remove(this.pommelMesh); disposeObject3D(this.pommelMesh); this.pommelMesh = null }
    this.pommelMesh = buildPommel(p, { handleMesh: this.handleMesh, blade: this.lastParams?.blade ?? null }, (part)=> this.makeMaterial(part))
    this.group.add(this.pommelMesh)
  }

  // Validation moved to ./sword/validation

  // Disposal helpers moved to ./sword/utils
}

// outline helpers moved to ./sword/bladeGeometry

// outline helpers moved to ./sword/bladeGeometry (re-exported)

// bladeOutlineToSVG moved to ./sword/bladeGeometry (re-exported)

// handle wrap texture moved to ./sword/handleTextures

// defaultSwordParams moved to ./sword/defaults

// moved: buildHamonOverlays in ./sword/bladeGeometry

// moved: buildGuardHalfShape in ./sword/guardShapes

// computeBladeDynamics moved to ./sword/dynamics
