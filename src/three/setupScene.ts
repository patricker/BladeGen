import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';

import { SwordGenerator, defaultSwordParams } from './SwordGenerator';
import {
  buildInkOutline as buildInkOutlineMesh,
  buildFresnel as buildFresnelMesh,
  buildBladeGradientOverlay,
} from './fx/overlays';
import { buildFlameAura } from './fx/aura';
import { createEmbers } from './fx/embers';
import { buildInnerGlow as buildInnerGlowMesh } from './fx/innerGlow';
import { updateMistPositions, buildMist } from './fx/mist';
import { createBootstrap } from './setup/bootstrap';
import { createLighting } from './setup/lighting';
import { createPostProcessing } from './setup/post';
import { createFxContext } from './setup/fx';
import { createRenderHooks, RenderHooks } from './render/createRenderHooks';
import { createRenderPipeline, RenderPipeline } from './render/renderPipeline';

export type { RenderHooks } from './render/createRenderHooks';

export interface SceneSetupResult {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  composer: EffectComposer;
  renderHooks: RenderHooks;
  pipeline: RenderPipeline;
  updateFXAA: () => void;
  dispose: () => void;
  sword: SwordGenerator;
}

export function setupScene(canvas: HTMLCanvasElement): SceneSetupResult {
  const bootstrap = createBootstrap(canvas);
  const {
    renderer,
    scene,
    camera,
    controls,
    pmrem,
    envTexture,
    background,
    ground,
    groundClearance,
  } = bootstrap;

  const autoSpinStorageKeyNew = 'bladegen.autoSpinEnabled';
  const readAutoSpinPreference = () => {
    if (typeof window === 'undefined') return true;
    try {
      // Migrate old key to new prefix if present
      const ls = window.localStorage;
      const value = ls?.getItem(autoSpinStorageKeyNew);
      if (value === 'false') return false;
      if (value === 'true') return true;
    } catch {
      // ignore storage access errors
    }
    return true;
  };
  const persistAutoSpinPreference = (enabled: boolean) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(autoSpinStorageKeyNew, enabled ? 'true' : 'false');
    } catch {
      // ignore storage access errors
    }
  };

  let autoSpinEnabled = readAutoSpinPreference();
  // Control auto-rotation pause handling
  let isDragging = false;
  let spinResumeAt = autoSpinEnabled ? 0 : Number.POSITIVE_INFINITY;
  const resumeDelayMs = 1500;
  const nowMillis = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const bumpResume = () => {
    if (!autoSpinEnabled) {
      spinResumeAt = Number.POSITIVE_INFINITY;
      return;
    }
    spinResumeAt = nowMillis() + resumeDelayMs;
  };
  const setAutoSpinEnabled = (enabled: boolean) => {
    autoSpinEnabled = !!enabled;
    persistAutoSpinPreference(autoSpinEnabled);
    if (autoSpinEnabled) {
      spinResumeAt = nowMillis() + resumeDelayMs;
    } else {
      spinResumeAt = Number.POSITIVE_INFINITY;
    }
  };
  const getAutoSpinEnabled = () => autoSpinEnabled;
  controls.addEventListener('start', () => {
    isDragging = true;
  });
  controls.addEventListener('change', () => {
    bumpResume();
  });
  controls.addEventListener('end', () => {
    isDragging = false;
    bumpResume();
  });
  canvas.addEventListener(
    'wheel',
    () => {
      bumpResume();
    },
    { passive: true }
  );

  const lighting = createLighting(scene);
  const ambientLight = lighting.ambient;
  const keyLight = lighting.key;
  const rimLight = lighting.rim;

  const materials: Record<string, any> = { blade: {}, guard: {}, handle: {}, pommel: {} };
  const sword = new SwordGenerator(defaultSwordParams(), materials);
  sword.group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
    }
  });
  scene.add(sword.group);
  (scene as any).__swordInstance = sword;
  (scene as any).__materials = materials;

  const post = createPostProcessing(scene, camera, renderer);
  const fxContext = createFxContext(renderer, scene, camera, post.composer);
  const fxFlags = fxContext.flags;
  const BLOOM_LAYER = fxContext.layers.bloom;
  const HEAT_LAYER = fxContext.layers.heat;

  const clock = new THREE.Clock();
  const bbox = new THREE.Box3();
  // Explain Mode overlay (labels anchored to parts)
  let explainEnabled = false;
  let explainOverlay: HTMLElement | null = null;
  const explainLabels: Record<string, { el: HTMLElement; id: string }> = {};
  let explainClickHandler: ((id: string) => void) | null = null;
  let explainHoverHandler: ((parts: string[] | null) => void) | null = null;
  function ensureExplainStyles() {
    if (document.getElementById('smk-explain-styles')) return;
    const css = document.createElement('style');
    css.id = 'smk-explain-styles';
    css.textContent = `
      .smk-explain{ position:fixed; inset:0; pointer-events:none; z-index:10001; }
      .smk-explain-label{ position:absolute; pointer-events:auto; background:#0b0f16cc; color:#e5e7eb; border:1px solid #283141; border-radius:999px; padding:3px 8px; font:12px/1.2 system-ui, -apple-system, Segoe UI, Roboto; cursor:pointer; user-select:none }
      .smk-explain-label:hover{ background:#101a2bcc }
    `;
    document.head.appendChild(css);
  }
  function ensureExplainOverlay() {
    if (explainOverlay) return;
    ensureExplainStyles();
    explainOverlay = document.createElement('div');
    explainOverlay.className = 'smk-explain';
    document.body.appendChild(explainOverlay);
  }
  function makeLabel(id: string, text: string): HTMLElement {
    ensureExplainOverlay();
    const el = document.createElement('div');
    el.className = 'smk-explain-label';
    el.textContent = text;
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `Explain: ${text}`);
    el.addEventListener('click', () => {
      try {
        explainClickHandler?.(id);
      } catch {}
    });
    el.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter' || ke.key === ' ') {
        ke.preventDefault();
        try {
          explainClickHandler?.(id);
        } catch {}
      }
    });
    el.addEventListener('mouseenter', () => {
      try {
        explainHoverHandler?.([id.split('.')[0]]);
      } catch {}
    });
    el.addEventListener('mouseleave', () => {
      try {
        explainHoverHandler?.(null);
      } catch {}
    });
    explainOverlay!.appendChild(el);
    explainLabels[id] = { el, id };
    return el;
  }
  function setExplainEnabled(v: boolean) {
    explainEnabled = !!v;
    ensureExplainOverlay();
    if (!explainOverlay) return;
    if (!explainEnabled) {
      // Detach overlay and clear labels to free DOM/memory
      try {
        explainOverlay.remove();
      } catch {}
      explainOverlay = null;
      for (const k of Object.keys(explainLabels)) {
        delete (explainLabels as any)[k];
      }
      return;
    }
    explainOverlay.style.display = 'block';
    if (explainEnabled) {
      // Create basic labels on first enable
      if (!explainLabels['blade']) makeLabel('blade', 'Blade');
      if (!explainLabels['guard']) makeLabel('guard', 'Guard');
      if (!explainLabels['handle']) makeLabel('handle', 'Handle');
      if (!explainLabels['pommel']) makeLabel('pommel', 'Pommel');
      if (!explainLabels['blade.fuller']) makeLabel('blade.fuller', 'Fuller');
      if (!explainLabels['blade.edge']) makeLabel('blade.edge', 'Edge');
      if (!explainLabels['blade.edge-left']) makeLabel('blade.edge-left', 'Edge L');
      if (!explainLabels['blade.edge-right']) makeLabel('blade.edge-right', 'Edge R');
      if (!explainLabels['blade.tip']) makeLabel('blade.tip', 'Tip');
      if (!explainLabels['guard.fillet']) makeLabel('guard.fillet', 'Fillet');
    }
  }
  const getExplainEnabled = () => explainEnabled;
  function setExplainHandlers(
    onClick?: (id: string) => void,
    onHover?: (parts: string[] | null) => void
  ) {
    explainClickHandler = onClick || null;
    explainHoverHandler = onHover || null;
  }
  function worldToScreen(pos: THREE.Vector3, out: THREE.Vector2) {
    const v = pos.clone().project(camera);
    const widthHalf = 0.5 * renderer.domElement.clientWidth;
    const heightHalf = 0.5 * renderer.domElement.clientHeight;
    out.set(v.x * widthHalf + widthHalf, -v.y * heightHalf + heightHalf);
    return out;
  }
  const tmpV = new THREE.Vector3();
  const tmp2 = new THREE.Vector2();
  function updateExplainOverlay() {
    if (!explainEnabled || !explainOverlay) return;
    const canvasRect = renderer.domElement.getBoundingClientRect();
    const place = (id: string, obj: THREE.Object3D | null, yBias = 0) => {
      const rec = explainLabels[id];
      if (!rec || !obj) {
        if (rec) rec.el.style.display = 'none';
        return;
      }
      const box = new THREE.Box3().setFromObject(obj);
      if (!isFinite(box.min.x)) {
        rec.el.style.display = 'none';
        return;
      }
      tmpV.set(
        (box.min.x + box.max.x) * 0.5,
        (box.min.y + box.max.y) * 0.5 + yBias,
        (box.min.z + box.max.z) * 0.5
      );
      worldToScreen(tmpV, tmp2);
      rec.el.style.display = 'block';
      rec.el.style.left = `${Math.round(canvasRect.left + tmp2.x)}px`;
      rec.el.style.top = `${Math.round(canvasRect.top + tmp2.y)}px`;
    };
    const sg: any = sword as any;
    place('blade', sword.bladeMesh, 0.0);
    place('guard', sword.guardMesh ?? sg['guardGroup'] ?? null, 0.0);
    place('handle', sword.handleMesh ?? sg['handleGroup'] ?? null, 0.0);
    place('pommel', sword.pommelMesh, 0.0);
    place('blade.fuller', sg['fullerGroup'] ?? null, 0.0);
    // Use anchors for sub-parts if available
    place('blade.edge', sg['anchorBladeEdge'] ?? null, 0.0);
    place('blade.edge-left', sg['anchorBladeEdgeL'] ?? null, 0.0);
    place('blade.edge-right', sg['anchorBladeEdgeR'] ?? null, 0.0);
    place('blade.tip', sg['anchorBladeTip'] ?? null, -8);
    place('guard.quillon', sg['anchorQuillonR'] ?? sg['anchorQuillonL'] ?? null, 0.0);
    // Guard fillet fallback: place label near top-center of guard
    const guardObj = sword.guardMesh ?? sg['guardGroup'] ?? null;
    const filletRec = explainLabels['guard.fillet'];
    if (filletRec) {
      if (guardObj) {
        const bb = new THREE.Box3().setFromObject(guardObj);
        tmpV.set((bb.min.x + bb.max.x) * 0.5, bb.max.y, (bb.min.z + bb.max.z) * 0.5);
        worldToScreen(tmpV, tmp2);
        filletRec.el.style.display = 'block';
        filletRec.el.style.left = `${Math.round(canvasRect.left + tmp2.x)}px`;
        filletRec.el.style.top = `${Math.round(canvasRect.top + tmp2.y)}px`;
      } else {
        filletRec.el.style.display = 'none';
      }
    }
  }

  const flameMesh = { current: null as THREE.Mesh | null };
  const flameState = {
    enabled: false,
    opts: {
      scale: 1.05,
      color1: 0xff5a00,
      color2: 0xfff18a,
      noiseScale: 2.2,
      speed: 1.6,
      intensity: 1.0,
      direction: 'up' as 'up' | 'down',
      blend: 'add' as 'add' | 'normal' | 'multiply',
    },
  };
  const setFlameAura = (enabled: boolean, opts: typeof flameState.opts = flameState.opts) => {
    flameState.enabled = enabled;
    flameState.opts = { ...flameState.opts, ...opts };
    if (flameMesh.current) {
      (flameMesh.current.parent as any)?.remove(flameMesh.current);
      (flameMesh.current.material as any)?.dispose?.();
      (flameMesh.current.geometry as any)?.dispose?.();
      flameMesh.current = null;
    }
    if (!enabled || !sword.bladeMesh) return;
    const built = buildFlameAura(sword.bladeMesh, flameState.opts);
    sword.bladeMesh.add(built.mesh);
    flameMesh.current = built.mesh;
    if (fxFlags.selectiveBloom) flameMesh.current.layers.enable(BLOOM_LAYER);
    if (fxFlags.heatHaze) flameMesh.current.layers.enable(HEAT_LAYER);
  };

  let sparks: THREE.Points | null = null;
  let sparksGeom: THREE.BufferGeometry | null = null;
  let sparksPos: Float32Array | null = null;
  let sparksVel: Float32Array | null = null;
  let sparksLife: Float32Array | null = null;
  const setEmbers = (
    enabled: boolean,
    opts: { count?: number; size?: number; color?: number } = {}
  ) => {
    if (sparks) {
      (sparks.parent as any)?.remove(sparks);
      sparksGeom?.dispose();
      (sparks.material as any)?.dispose?.();
      sparks = null;
      sparksGeom = null;
      sparksPos = null;
      sparksVel = null;
      sparksLife = null;
    }
    if (!enabled || !sword.bladeMesh) return;
    const created = createEmbers(sword.bladeMesh, opts);
    sword.group.add(created.points);
    sparks = created.points;
    sparksGeom = created.geom;
    sparksPos = created.arrays.pos;
    sparksVel = created.arrays.vel;
    sparksLife = created.arrays.life;
  };

  const inkOutlineGroup = { current: null as THREE.Group | null };
  const fresnelGroup = { current: null as THREE.Group | null };
  const innerGlowGroup = { current: null as THREE.Group | null };
  const innerGlowMaterial = { current: null as THREE.ShaderMaterial | null };
  const innerGlowState = {
    enabled: false,
    time: 0.0,
    speed: 1.5,
    color: 0x88ccff,
    iMin: 0.2,
    iMax: 0.9,
  };
  const buildInnerGlow = (colorHex: number, iMin: number, iMax: number, speed: number) => {
    const built = buildInnerGlowMesh(sword.group, colorHex, iMin, iMax, speed);
    innerGlowMaterial.current = built.material;
    return built.group;
  };

  let mistPoints: THREE.Points | null = null;
  let mistGeom: THREE.BufferGeometry | null = null;
  let mistMat: THREE.ShaderMaterial | null = null;
  let mistLife: Float32Array | null = null;
  let mistVel: Float32Array | null = null;
  let mistTime = 0.0;
  const mistState = {
    enabled: false,
    color: 0x88aadd,
    density: 0.4,
    speed: 0.6,
    spread: 0.08,
    size: 6.0,
    sizeMinRatio: 0.5,
    lifeRate: 0.25,
    noiseAmp: 0.08,
    noiseFreqX: 0.7,
    noiseFreqZ: 0.5,
    alphaScale: 0.35,
    windX: 0.0,
    windZ: 0.0,
    emission: 'base' as 'base' | 'edge' | 'tip' | 'full',
    occlude: false,
  } as any;
  const mistSpawn = { xMin: 0, xMax: 0, yMin: 0, yMax: 0, baseTop: 0, tipBottom: 0, halfT: 0 };
  const rebuildMist = (count: number) => {
    if (mistPoints) {
      (mistPoints.parent as any)?.remove(mistPoints);
      mistGeom?.dispose();
      mistPoints = null;
      mistGeom = null;
    }
    if (!sword.bladeMesh) return;
    const built = buildMist(sword.bladeMesh, count, mistState);
    mistLife = built.arrays.life;
    mistVel = built.arrays.vel;
    mistGeom = built.geom;
    mistMat = built.material;
    sword.group.add(built.points);
    mistPoints = built.points;
    Object.assign(mistSpawn, built.spawn);
  };

  const setKeyLightAngles = (azimuthDeg: number, elevationDeg: number) => {
    const az = THREE.MathUtils.degToRad(azimuthDeg);
    const el = THREE.MathUtils.degToRad(elevationDeg);
    const r = 12;
    keyLight.position.set(
      Math.cos(az) * Math.cos(el) * r,
      Math.sin(el) * r,
      Math.sin(az) * Math.cos(el) * r
    );
  };

  const setRimLightAngles = (azimuthDeg: number, elevationDeg: number) => {
    const az = THREE.MathUtils.degToRad(azimuthDeg);
    const el = THREE.MathUtils.degToRad(elevationDeg);
    const r = 12;
    rimLight.position.set(
      Math.cos(az) * Math.cos(el) * r,
      Math.sin(el) * r,
      Math.sin(az) * Math.cos(el) * r
    );
  };

  const buildInkOutline = (scale: number, colorHex: number) =>
    buildInkOutlineMesh(sword.group, scale, colorHex);
  const buildFresnel = (colorHex: number, intensity: number, power: number) =>
    buildFresnelMesh(sword.group, colorHex, intensity, power);
  const buildBladeGradient = (
    baseHex: number,
    edgeHex: number,
    edgeFade: number,
    wearAmt: number
  ) =>
    sword.bladeMesh
      ? buildBladeGradientOverlay(sword.bladeMesh, baseHex, edgeHex, edgeFade, wearAmt)
      : null;

  const bladeVisibility = { visible: true, occlude: false } as {
    visible: boolean;
    occlude: boolean;
  };
  const applyBladeVisibility = (visible: boolean, occlude: boolean) => {
    const bm = sword.bladeMesh as THREE.Mesh | null;
    if (!bm) return;
    const material = (bm as any).material;
    const apply = (mat: any) => {
      if (!visible) {
        mat.transparent = true;
        mat.opacity = 0.0;
        mat.colorWrite = false;
        mat.depthWrite = !!occlude;
      } else {
        mat.transparent = true;
        mat.opacity = 1.0;
        mat.colorWrite = true;
        mat.depthWrite = true;
      }
      mat.needsUpdate = true;
    };
    if (Array.isArray(material)) material.forEach(apply);
    else if (material) apply(material);
  };

  const currentEnvTex = { current: null as THREE.Texture | null };
  const aaSize = new THREE.Vector2();
  const updateFXAA = () => {
    renderer.getSize(aaSize);
    const pixelRatio = renderer.getPixelRatio();
    post.updateAaPass(aaSize.x, aaSize.y, pixelRatio);
    fxContext.updateSize(aaSize.x, aaSize.y);
  };
  updateFXAA();

  let renderHooks: RenderHooks;

  const beforeRender = () => {
    const dt = clock.getDelta();
    const allowSpin = autoSpinEnabled && !isDragging && nowMillis() >= spinResumeAt;
    if (allowSpin) sword.group.rotation.y += dt * 0.25;
    sword.group.position.y = 0.0;

    if (innerGlowMaterial.current && innerGlowState.enabled) {
      innerGlowState.time += dt;
      (innerGlowMaterial.current.uniforms as any).time.value = innerGlowState.time;
    }

    // Update Explain overlay positions last
    updateExplainOverlay();

    if (mistState.enabled) {
      mistTime += dt;
    }

    const elapsed = clock.getElapsedTime();
    if (flameMesh.current) {
      const material = flameMesh.current.material as THREE.ShaderMaterial;
      (material.uniforms as any).time.value = elapsed;
    }
    if (fxFlags.heatHaze) {
      fxContext.fx.setHeatTime(elapsed);
    }

    if (mistPoints && mistGeom && mistLife && mistVel && mistState.enabled) {
      updateMistPositions(
        mistGeom,
        { life: mistLife, vel: mistVel },
        mistState,
        dt,
        elapsed,
        mistSpawn as any
      );
      if (mistMat) {
        (mistMat.uniforms as any).uColor.value.setHex(mistState.color);
        (mistMat.uniforms as any).uSizeMax.value = mistState.size;
        (mistMat.uniforms as any).uSizeMin.value = Math.max(
          0.0,
          mistState.size * mistState.sizeMinRatio
        );
        (mistMat.uniforms as any).uAlphaScale.value = mistState.alphaScale;
      }
    }

    if (sparks && sparksGeom && sparksPos && sparksVel && sparksLife) {
      const n = sparksPos.length / 3;
      const bladeBox = new THREE.Box3().setFromObject(sword.bladeMesh!);
      for (let i = 0; i < n; i++) {
        const idx = i * 3;
        const vx = sparksVel[idx + 0];
        const vy = sparksVel[idx + 1];
        const vz = sparksVel[idx + 2];
        let x = sparksPos[idx + 0] + vx * dt;
        let y = sparksPos[idx + 1] + vy * dt;
        let z = sparksPos[idx + 2] + vz * dt;
        let life = sparksLife[i] + dt * 0.25;
        if (life >= 1.0 || y > bladeBox.max.y + 0.5) {
          x = THREE.MathUtils.lerp(bladeBox.min.x, bladeBox.max.x, Math.random() * 0.3 + 0.35);
          y = THREE.MathUtils.lerp(bladeBox.min.y, bladeBox.max.y, Math.random() * 0.4 + 0.3);
          z = THREE.MathUtils.lerp(bladeBox.min.z, bladeBox.max.z, Math.random() * 0.3 + 0.35);
          sparksVel[idx + 0] = (Math.random() - 0.5) * 0.4;
          sparksVel[idx + 1] = Math.random() * 0.8 + 0.4;
          sparksVel[idx + 2] = (Math.random() - 0.5) * 0.4;
          life = 0.0;
        }
        sparksPos[idx + 0] = x;
        sparksPos[idx + 1] = y;
        sparksPos[idx + 2] = z;
        sparksLife[i] = life;
      }
      (sparksGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (sparksGeom.getAttribute('aLife') as THREE.BufferAttribute).needsUpdate = true;
    }

    if (sword.bladeMesh) {
      const bladeMesh = sword.bladeMesh as THREE.Mesh;
      const geomId = (bladeMesh.geometry as any)?.id ?? -1;
      (beforeRender as any)._lastBladeUUID = (beforeRender as any)._lastBladeUUID ?? null;
      (beforeRender as any)._lastGeomId = (beforeRender as any)._lastGeomId ?? null;
      const changed =
        bladeMesh.uuid !== (beforeRender as any)._lastBladeUUID ||
        geomId !== (beforeRender as any)._lastGeomId;
      if (changed) {
        (beforeRender as any)._lastBladeUUID = bladeMesh.uuid;
        (beforeRender as any)._lastGeomId = geomId;
        const resynced: string[] = [];
        if (mistState.enabled) {
          const count = Math.max(10, Math.floor(400 * mistState.density));
          rebuildMist(count);
          resynced.push('mist');
        }
        if (flameState.enabled) {
          setFlameAura(true, flameState.opts);
          resynced.push('aura');
        }
        if (innerGlowState.enabled) {
          renderHooks?.setInnerGlow(
            true,
            innerGlowState.color,
            innerGlowState.iMin,
            innerGlowState.iMax,
            innerGlowState.speed
          );
          resynced.push('innerGlow');
        }
        const fres = (renderHooks as any)?._fresnelState;
        if (fres?.enabled) {
          renderHooks?.setFresnel(true, fres.color, fres.intensity, fres.power);
          resynced.push('fresnel');
        }
        if (fxFlags.selectiveBloom) bladeMesh.layers.enable(BLOOM_LAYER);
        if (fxFlags.heatHaze) bladeMesh.layers.enable(HEAT_LAYER);
        if (!bladeVisibility.visible) applyBladeVisibility(false, bladeVisibility.occlude);
        try {
          (scene as any).__rebuildBladeGradient?.();
        } catch {}
        try {
          window.dispatchEvent(
            new CustomEvent('bladegen:fx-synced', { detail: { parts: resynced } } as any)
          );
        } catch {}
      }
    }

    bbox.setFromObject(sword.group);
    if (isFinite(bbox.min.y)) {
      ground.position.y = bbox.min.y - groundClearance.value;
    }
  };

  const pipeline = createRenderPipeline(renderer, scene, camera, {
    composer: post.composer,
    preFX: fxContext.preFX,
    beforeRender,
  });

  renderHooks = createRenderHooks({
    renderer,
    scene,
    sword,
    materials,
    composer: post.composer,
    bloom: post.bloom,
    outline: post.outline,
    vignette: post.vignette,
    ambientLight,
    keyLight,
    rimLight,
    fx: fxContext.fx,
    fxLayers: { bloom: BLOOM_LAYER, heat: HEAT_LAYER },
    flags: fxFlags,
    flameMesh,
    setFlameAura,
    setEmbers,
    mistState,
    rebuildMist,
    background,
    aaPasses: post.aaPasses,
    updateFXAA,
    msaa: {
      supported: post.supportsMsaa,
      maxSamples: post.maxMsaaSamples,
      setSamples: post.setMsaaSamples,
      getSamples: post.getMsaaSamples,
    },
    envTex: envTexture,
    currentEnvTex,
    buildInkOutline,
    inkOutlineGroup,
    buildFresnel,
    fresnelGroup,
    innerGlowState,
    buildInnerGlow,
    innerGlowGroup,
    innerGlowMaterial,
    buildBladeGradient,
    bladeVisibility,
    applyBladeVisibility,
    setKeyLightAngles,
    setRimLightAngles,
    setPostFXEnabled: pipeline.setPostFXEnabled,
    autoSpin: {
      setEnabled: setAutoSpinEnabled,
      getEnabled: getAutoSpinEnabled,
    },
  });
  // Augment render hooks with Explain Mode controls (optional for UI)
  (renderHooks as any).setExplainEnabled = setExplainEnabled;
  (renderHooks as any).getExplainEnabled = getExplainEnabled;
  (renderHooks as any).setExplainHandlers = setExplainHandlers;
  (scene as any).__renderHooks = renderHooks;

  if (typeof window !== 'undefined') {
    const dbg = (window as unknown as Record<string, any>).__swordDebug ?? {};
    dbg.renderHooks = renderHooks;
    dbg.renderer = renderer;
    dbg.scene = scene;
    dbg.sword = sword;
    dbg.composer = post.composer;
    dbg.setAutoSpinEnabled = setAutoSpinEnabled;
    dbg.getAutoSpinEnabled = getAutoSpinEnabled;
    (window as unknown as Record<string, any>).__swordDebug = dbg;
  }

  const dispose = () => {
    currentEnvTex.current?.dispose?.();
    pmrem.dispose();
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
    if (mistPoints) {
      (mistPoints.parent as any)?.remove(mistPoints);
      mistGeom?.dispose();
      mistMat?.dispose();
    }
    if (sparks) {
      (sparks.parent as any)?.remove(sparks);
      sparksGeom?.dispose();
      (sparks.material as any)?.dispose?.();
    }
    sword.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose?.();
        const mat = mesh.material as any;
        if (Array.isArray(mat)) mat.forEach((m: any) => m?.dispose?.());
        else mat?.dispose?.();
      }
    });
  };

  return {
    renderer,
    scene,
    camera,
    controls,
    composer: post.composer,
    renderHooks,
    pipeline,
    updateFXAA,
    dispose,
    sword,
  };
}
