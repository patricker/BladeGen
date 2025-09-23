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
export type {
  AccessoriesParams,
  BladeParams,
  GuardStyle,
  GuardParams,
  HandleParams,
  PommelStyle,
  PommelParams,
  ScabbardParams,
  SwordParams,
  TasselParams,
} from './sword/types';
// Geometry helpers now live in focused modules
import {
  buildBladeGeometry,
  buildFullerOverlays,
  buildHamonOverlays,
  buildBladeOutlinePoints,
  bladeOutlineToSVG,
} from './sword/bladeGeometry';
import { buildGuard } from './sword/guardGeometry';
import { decorateGuard } from './sword/guardDecor';
import { buildHandle } from './sword/handleGeometry';
import { buildPommel } from './sword/pommelGeometry';
import { buildEngravingsGroup } from './sword/engravings';
import { validateSwordParams } from './sword/validation';
import { TextureCache } from './sword/textures';
import { createMaterial } from './sword/materials';
import { disposeObject3D, deepEqual } from './sword/utils';
import {
  clearHighlight as clearMaterialHighlight,
  setHighlight as applyMaterialHighlight,
} from './render/materialMutators';
import { buildScabbard, buildTassel, type ScabbardBuildResult } from './sword/accessories';
// Re-export selected helpers for existing consumers
export { buildBladeOutlinePoints, bladeOutlineToSVG } from './sword/bladeGeometry';

// Types moved to './sword/types'

type MaterialPart = 'blade' | 'guard' | 'handle' | 'pommel' | 'scabbard' | 'tassel';
type MaterialMap = Partial<Record<MaterialPart, any>>;

export class SwordGenerator {
  public readonly group = new THREE.Group();
  public bladeMesh: THREE.Mesh | null = null;
  public guardMesh: THREE.Mesh | null = null;
  public handleMesh: THREE.Mesh | null = null;
  public pommelMesh: THREE.Mesh | null = null;
  public scabbardGroup: THREE.Group | null = null;
  public tasselGroup: THREE.Group | null = null;
  // Sub-part anchors (Explain Mode labels)
  public anchorBladeEdge: THREE.Object3D | null = null;
  public anchorBladeEdgeL: THREE.Object3D | null = null;
  public anchorBladeEdgeR: THREE.Object3D | null = null;
  public anchorBladeTip: THREE.Object3D | null = null;
  public anchorQuillonL: THREE.Object3D | null = null;
  public anchorQuillonR: THREE.Object3D | null = null;
  private guardGroup: THREE.Group | null = null;
  private handleGroup: THREE.Group | null = null;
  private fullerGroup: THREE.Group | null = null;
  private hamonGroup: THREE.Group | null = null;
  private engravingGroup: THREE.Group | null = null;
  private _fontCache?: Map<string, any>;
  private highlighted: MaterialPart | null = null;
  private scabbardBuild?: ScabbardBuildResult;

  private lastParams?: SwordParams;
  private derived?: { mass: number; cmY: number; Ibase: number; Icm: number; copY: number };
  private mats?: MaterialMap;
  private _texCache = new TextureCache();

  /**
   * Create a generator and immediately build geometry for the provided params.
   * Optionally pass material overrides per part.
   */
  constructor(initial: SwordParams, materials?: MaterialMap) {
    this.mats = materials;
    // create anchors early
    this.anchorBladeEdge = new THREE.Object3D();
    this.anchorBladeEdge.name = 'anchor.blade.edge';
    this.group.add(this.anchorBladeEdge);
    this.anchorBladeEdgeL = new THREE.Object3D();
    this.anchorBladeEdgeL.name = 'anchor.blade.edgeL';
    this.group.add(this.anchorBladeEdgeL);
    this.anchorBladeEdgeR = new THREE.Object3D();
    this.anchorBladeEdgeR.name = 'anchor.blade.edgeR';
    this.group.add(this.anchorBladeEdgeR);
    this.anchorBladeTip = new THREE.Object3D();
    this.anchorBladeTip.name = 'anchor.blade.tip';
    this.group.add(this.anchorBladeTip);
    this.anchorQuillonL = new THREE.Object3D();
    this.anchorQuillonL.name = 'anchor.guard.quillonL';
    this.group.add(this.anchorQuillonL);
    this.anchorQuillonR = new THREE.Object3D();
    this.anchorQuillonR.name = 'anchor.guard.quillonR';
    this.group.add(this.anchorQuillonR);
    this.updateGeometry(initial);
  }
  /**
   * Resolve any ratio-based derived params without mutating the input. The returned
   * object is safe to validate and pass to builders.
   */
  private resolveDerivedParams(params: SwordParams): SwordParams {
    const copy: SwordParams = {
      ...params,
      blade: params.blade ? { ...params.blade } : params.blade,
      guard: params.guard ? { ...params.guard } : params.guard,
      handle: params.handle ? { ...params.handle } : params.handle,
      pommel: params.pommel ? { ...params.pommel } : params.pommel,
      accessories: params.accessories
        ? {
            ...params.accessories,
            scabbard: params.accessories.scabbard ? { ...params.accessories.scabbard } : undefined,
            tassel: params.accessories.tassel ? { ...params.accessories.tassel } : undefined,
          }
        : undefined,
    };

    if ((params as any).useRatios && copy.guard && copy.handle && copy.pommel) {
      const ratios = (params as any).ratios || {};
      const bladeLength = params.blade?.length ?? 3.0;
      if (typeof ratios.guardWidthToBlade === 'number') {
        copy.guard.width = Math.max(0.2, ratios.guardWidthToBlade * bladeLength);
      }
      if (typeof ratios.handleLengthToBlade === 'number') {
        copy.handle.length = Math.max(0.2, ratios.handleLengthToBlade * bladeLength);
      }
      if (typeof ratios.pommelSizeToBlade === 'number') {
        copy.pommel.size = Math.max(0.05, ratios.pommelSizeToBlade * bladeLength);
      }
    }

    return copy;
  }
  /** Apply new material presets and rebind to existing meshes/groups. */
  public setMaterials(mats: MaterialMap) {
    this.mats = mats;
    this.reapplyMaterials();
    if (this.highlighted) {
      clearMaterialHighlight(this);
      applyMaterialHighlight(this, this.highlighted);
    }
  }
  /**
   * Create a MeshPhysicalMaterial for a given part using shared material factory.
   */
  private makeMaterial(part: MaterialPart): THREE.MeshPhysicalMaterial {
    return createMaterial(part, this.mats?.[part] ?? null, this._texCache);
  }
  /** Apply a material to all meshes under the provided object. */
  private applyMaterialPart(obj: THREE.Object3D | null | undefined, part: MaterialPart) {
    if (!obj) return;
    const mat = this.makeMaterial(part);
    if (part === 'blade') {
      (mat as any).side = THREE.DoubleSide as any;
    }
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if ((mesh as any).isMesh) mesh.material = mat;
    });
  }

  /** Traverse current parts and set freshly created materials. */
  private reapplyMaterials() {
    this.applyMaterialPart(this.bladeMesh, 'blade');
    this.applyMaterialPart(this.guardMesh ?? this.guardGroup, 'guard');
    this.applyMaterialPart(this.handleMesh, 'handle');
    this.applyMaterialPart(this.pommelMesh, 'pommel');
    this.applyMaterialPart(this.scabbardGroup, 'scabbard');
    this.applyMaterialPart(this.tasselGroup, 'tassel');
  }

  /** Return last computed dynamics (mass proxy, CM, inertias, CoP). */
  public getDerived() {
    return this.derived;
  }

  // Texture loading delegated to TextureCache via createMaterial

  /** Validate, normalize and rebuild all parts for a new parameter set. */
  updateGeometry(params: SwordParams) {
    const p = validateSwordParams(this.resolveDerivedParams(params));
    const prev = this.lastParams;
    this.lastParams = p;

    const bladeChanged = !prev || !deepEqual(prev.blade, p.blade);
    if (bladeChanged) {
      this.rebuildBlade(p.blade);
    }

    const hiltPreviouslyDisabled = prev?.hiltEnabled === false;
    let handleChanged = false;
    let guardChanged = false;

    if (p.hiltEnabled === false) {
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
      if (this.handleMesh) {
        this.group.remove(this.handleMesh);
        disposeObject3D(this.handleMesh);
        this.handleMesh = null;
      }
      if (this.handleGroup) {
        this.group.remove(this.handleGroup);
        disposeObject3D(this.handleGroup);
        this.handleGroup = null;
      }
      if (this.pommelMesh) {
        this.group.remove(this.pommelMesh);
        disposeObject3D(this.pommelMesh);
        this.pommelMesh = null;
      }
      handleChanged = prev?.hiltEnabled !== false;
      guardChanged = prev?.guardEnabled !== false && prev?.hiltEnabled !== false;
    } else {
      handleChanged = hiltPreviouslyDisabled || !prev || !deepEqual(prev.handle, p.handle);
      if (handleChanged) {
        this.rebuildHandle(p.handle);
      }

      const guardShouldExist = p.guardEnabled !== false;
      const guardWasEnabled = !prev || (prev.hiltEnabled !== false && prev.guardEnabled !== false);
      guardChanged =
        bladeChanged ||
        handleChanged ||
        hiltPreviouslyDisabled ||
        !prev ||
        prev.guardEnabled !== p.guardEnabled ||
        !deepEqual(prev.guard, p.guard);
      if (!guardShouldExist) {
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
      } else if (!guardWasEnabled || guardChanged) {
        this.rebuildGuard(p.guard);
      }

      const pommelChanged =
        handleChanged || hiltPreviouslyDisabled || !prev || !deepEqual(prev.pommel, p.pommel);
      if (pommelChanged) {
        this.rebuildPommel(p.pommel);
      }
    }

    const accessoriesChanged =
      bladeChanged ||
      handleChanged ||
      guardChanged ||
      !prev ||
      !deepEqual(prev.accessories, p.accessories);
    if (accessoriesChanged) {
      this.rebuildAccessories(p.accessories, p.blade);
    }

    if (bladeChanged || !this.derived) {
      this.derived = computeBladeDynamics(p.blade);
    }
    // Update anchors after rebuilds
    this.updateAnchors();
  }

  /** Enable emissive highlighting for a single named part. */
  public setHighlight(part: MaterialPart | null) {
    clearMaterialHighlight(this);
    this.highlighted = part;
    if (part) {
      applyMaterialHighlight(this, part);
    }
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
    if (this.engravingGroup) {
      this.group.remove(this.engravingGroup);
      disposeObject3D(this.engravingGroup);
      this.engravingGroup = null;
    }
    if ((b as any).engravings && (b as any).engravings.length && this.bladeMesh) {
      const built = buildEngravingsGroup(b, this.bladeMesh, this._fontCache);
      if (built) {
        this._fontCache = built.fontCache;
        this.engravingGroup = built.group;
        this.group.add(this.engravingGroup);
      }
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
    this.updateAnchors();
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

    // Build guard core and decorate
    const built = buildGuard(g, {
      bladeMesh: this.bladeMesh,
      handleMesh: this.handleMesh,
      makeMaterial: (p) => this.makeMaterial(p),
    });
    if (built.guardMesh) {
      this.guardMesh = built.guardMesh;
      this.group.add(this.guardMesh);
    }
    if (built.guardGroup) {
      this.guardGroup = built.guardGroup;
      this.group.add(this.guardGroup);
    }
    const deco = decorateGuard(g, {
      swordGroup: this.group,
      guardGroup: this.guardGroup,
      bladeMesh: this.bladeMesh,
      handleMesh: this.handleMesh,
      bladeParams: this.lastParams?.blade ?? null,
      makeMaterial: (p) => this.makeMaterial(p),
    });
    if (!this.guardGroup && deco.guardGroup) {
      this.guardGroup = deco.guardGroup;
    }
    this.updateAnchors();
  }

  /** Dispose and rebuild handle and its attached group/layers. */
  private rebuildHandle(h: HandleParams) {
    if (this.handleMesh) {
      this.group.remove(this.handleMesh);
      disposeObject3D(this.handleMesh);
      this.handleMesh = null;
    }
    if (this.handleGroup) {
      this.group.remove(this.handleGroup);
      disposeObject3D(this.handleGroup);
      this.handleGroup = null;
    }
    const built = buildHandle(h, (p) => this.makeMaterial(p));
    this.handleMesh = built.handleMesh;
    this.handleGroup = built.handleGroup;
    this.group.add(this.handleGroup);
    this.updateAnchors();
  }

  /** Dispose and rebuild the pommel, placing it below the handle. */
  private rebuildPommel(p: PommelParams) {
    if (this.pommelMesh) {
      this.group.remove(this.pommelMesh);
      disposeObject3D(this.pommelMesh);
      this.pommelMesh = null;
    }
    this.pommelMesh = buildPommel(
      p,
      { handleMesh: this.handleMesh, blade: this.lastParams?.blade ?? null },
      (part) => this.makeMaterial(part)
    );
    this.group.add(this.pommelMesh);
    this.updateAnchors();
  }

  private rebuildAccessories(accessories: SwordParams['accessories'], blade: BladeParams) {
    if (this.scabbardGroup) {
      this.group.remove(this.scabbardGroup);
      disposeObject3D(this.scabbardGroup);
      this.scabbardGroup = null;
    }
    if (this.tasselGroup) {
      this.group.remove(this.tasselGroup);
      disposeObject3D(this.tasselGroup);
      this.tasselGroup = null;
    }
    this.scabbardBuild = undefined;

    if (!accessories) return;

    const scabbard = accessories.scabbard;
    if (scabbard?.enabled) {
      const built = buildScabbard(blade, scabbard);
      if (built) {
        this.scabbardBuild = built;
        this.scabbardGroup = built.group;
        this.group.add(this.scabbardGroup);
        this.applyMaterialPart(this.scabbardGroup, 'scabbard');
      }
    }

    const tassel = accessories.tassel;
    if (tassel?.enabled) {
      const anchor = this.resolveTasselAnchor(tassel, blade);
      if (anchor) {
        const tasselGroup = buildTassel(blade, tassel, anchor);
        if (tasselGroup) {
          this.tasselGroup = tasselGroup;
          this.group.add(this.tasselGroup);
          this.applyMaterialPart(this.tasselGroup, 'tassel');
        }
      }
    }
    this.updateAnchors();
  }

  /** Compute/update anchor positions for Explain Mode labels. */
  private updateAnchors() {
    // Blade edge anchors: use bounds at mid height for left/right and center Z
    if (this.anchorBladeEdge) {
      if (this.bladeMesh) {
        const bb = new THREE.Box3().setFromObject(this.bladeMesh);
        const y = (bb.min.y + bb.max.y) * 0.5;
        const z = (bb.min.z + bb.max.z) * 0.5;
        this.anchorBladeEdge.position.set((bb.min.x + bb.max.x) * 0.5, y, z);
        this.anchorBladeEdge.visible = Number.isFinite(y + z);
        if (this.anchorBladeEdgeL) {
          this.anchorBladeEdgeL.position.set(bb.min.x, y, z);
          this.anchorBladeEdgeL.visible = Number.isFinite(y + z);
        }
        if (this.anchorBladeEdgeR) {
          this.anchorBladeEdgeR.position.set(bb.max.x, y, z);
          this.anchorBladeEdgeR.visible = Number.isFinite(y + z);
        }
      } else {
        this.anchorBladeEdge.visible = false;
        if (this.anchorBladeEdgeL) this.anchorBladeEdgeL.visible = false;
        if (this.anchorBladeEdgeR) this.anchorBladeEdgeR.visible = false;
      }
    }
    // Blade tip anchor: highest Y of blade bounds
    if (this.anchorBladeTip) {
      if (this.bladeMesh) {
        const bb = new THREE.Box3().setFromObject(this.bladeMesh);
        const x = (bb.min.x + bb.max.x) * 0.5;
        const y = bb.max.y;
        const z = (bb.min.z + bb.max.z) * 0.5;
        this.anchorBladeTip.position.set(x, y, z);
        this.anchorBladeTip.visible = Number.isFinite(x + y + z);
      } else {
        this.anchorBladeTip.visible = false;
      }
    }
    // Guard quillons: approximate with guard bounds extremes on X
    const guardObj = this.guardMesh ?? this.guardGroup;
    if (this.anchorQuillonL && this.anchorQuillonR) {
      if (guardObj) {
        const bb = new THREE.Box3().setFromObject(guardObj);
        const y = (bb.min.y + bb.max.y) * 0.5;
        const z = (bb.min.z + bb.max.z) * 0.5;
        this.anchorQuillonL.position.set(bb.min.x, y, z);
        this.anchorQuillonR.position.set(bb.max.x, y, z);
        const ok = (v: number) => Number.isFinite(v);
        this.anchorQuillonL.visible = ok(this.anchorQuillonL.position.x + y + z);
        this.anchorQuillonR.visible = ok(this.anchorQuillonR.position.x + y + z);
      } else {
        this.anchorQuillonL.visible = false;
        this.anchorQuillonR.visible = false;
      }
    }
    // Expose a simple lookup map on the group for consumers (Explain/Help)
    const map: Record<string, THREE.Object3D | null> = {
      blade: this.bladeMesh,
      guard: this.guardMesh ?? this.guardGroup,
      handle: this.handleMesh ?? this.handleGroup,
      pommel: this.pommelMesh,
      'blade.fuller': this.fullerGroup,
      'blade.edge': this.anchorBladeEdge,
      'blade.edge-left': this.anchorBladeEdgeL,
      'blade.edge-right': this.anchorBladeEdgeR,
      'blade.tip': this.anchorBladeTip,
      'guard.quillon': this.anchorQuillonR ?? this.anchorQuillonL,
    };
    (this.group as any).__subparts = map;
  }

  private resolveTasselAnchor(
    tassel: NonNullable<SwordParams['accessories']>['tassel'],
    blade: BladeParams
  ): { anchor: THREE.Vector3; tangent?: THREE.Vector3 } | null {
    if (tassel.attachTo === 'scabbard' && this.scabbardGroup && this.scabbardBuild) {
      this.scabbardGroup.updateMatrixWorld(true);
      const u = THREE.MathUtils.clamp(tassel.anchorOffset ?? 0.5, 0, 1);
      const localPoint = this.scabbardBuild.samplePoint(u);
      const localTangent = this.scabbardBuild.sampleTangent(u);
      const worldPoint = localPoint.clone();
      this.scabbardGroup.localToWorld(worldPoint);
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(this.scabbardGroup.matrixWorld);
      const worldTangent = localTangent.applyMatrix3(normalMatrix).normalize();
      return { anchor: worldPoint, tangent: worldTangent };
    }

    const sideSign = tassel.sway >= 0 ? 1 : -1;
    const fallback = new THREE.Vector3();
    const guardObj = this.guardMesh ?? this.guardGroup;
    const offset = Math.max(0.02, (this.lastParams?.blade.baseWidth ?? 0.2) * 0.05);
    if (guardObj) {
      const bbox = new THREE.Box3().setFromObject(guardObj);
      const x = sideSign >= 0 ? bbox.max.x : bbox.min.x;
      const y = bbox.max.y - offset;
      const z = (bbox.min.z + bbox.max.z) * 0.5;
      fallback.set(x + sideSign * offset, y, z);
    } else if (this.handleMesh) {
      const bbox = new THREE.Box3().setFromObject(this.handleMesh);
      const x = sideSign >= 0 ? bbox.max.x : bbox.min.x;
      const y = bbox.max.y - offset;
      const z = (bbox.min.z + bbox.max.z) * 0.5;
      fallback.set(x + sideSign * offset, y, z);
    } else {
      fallback.set(
        sideSign * (this.lastParams?.blade.baseWidth ?? 0.2) * 0.4,
        Math.max(0.05, blade.baseWidth * 0.1),
        0
      );
    }
    return { anchor: fallback, tangent: new THREE.Vector3(0, -1, 0) };
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
