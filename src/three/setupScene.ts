import * as THREE from 'three';
/**
 * Scene bootstrapper for the sword demo.
 *
 * Creates a Three.js renderer, scene, camera, post-processing pipeline, lights,
 * a soft ground plane, and instantiates a SwordGenerator with sensible defaults.
 * Also wires a rich set of render hooks for UI control of materials, FX and
 * environment without coupling UI code to internals.
 *
 * This module is intentionally UI-agnostic; callers provide a canvas element.
 */
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SwordGenerator, defaultSwordParams } from './SwordGenerator';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { VignetteShader, MistShader } from './fx/shaders'
import { buildInkOutline as buildInkOutlineImported, buildFresnel as buildFresnelImported, buildBladeGradientOverlay, buildBladeGradientWearOverlay } from './fx/overlays'
import { buildFlameAura } from './fx/aura'
import { createEmbers } from './fx/embers'
import { buildInnerGlow as buildInnerGlowImported } from './fx/innerGlow'
import { makeMistNoiseTexture, updateMistPositions, buildMist } from './fx/mist'
import { setPartBump, setPartClearcoat, setPartClearcoatRoughness, setPartColor, setPartMetalness, setPartRoughness } from './render/materialMutators'
import { FxManager } from './fx/manager'
import { createRenderHooks, RenderHooks } from './render/createRenderHooks'

export type { RenderHooks } from './render/createRenderHooks';

/**
 * Initialize the renderer/scene for a given canvas and return handles to core
 * objects plus helpers: `renderer, scene, camera, controls, composer, dispose,
 * updateFXAA, renderHooks, preFX`.
 */
export function setupScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  const bgBase = new THREE.Color(0x0f1115);
  let bgTarget = new THREE.Color(0x3a3f4a);
  let bgBrightness = 0.0; // 0 extra -> dark; increase to lighten
  let groundMat: THREE.MeshStandardMaterial | null = null;
  let groundClearance = 0.08; // distance between sword's lowest point and ground
  const applyBackground = () => {
    const c = bgBase.clone();
    // lighten toward target by bgBrightness
    const target = bgTarget;
    c.lerp(target, THREE.MathUtils.clamp(bgBrightness, 0, 1));
    renderer.setClearColor(c);
    if (groundMat) {
      const floor = c.clone();
      floor.lerp(new THREE.Color(0x000000), 0.4);
      groundMat.color.copy(floor);
      groundMat.needsUpdate = true;
    }
  };
  applyBackground();
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // Image-based lighting
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new RoomEnvironment();
  const envTex = pmrem.fromScene(env, 0.04).texture;
  scene.environment = envTex;

  // Camera
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(3, 2, 5);

  // Controls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.target.set(0, 1, 0);
  // Auto-rotation pause handling
  let isDragging = false;
  let spinResumeAt = 0; // ms timestamp when spin may resume
  const resumeDelayMs = 1500; // wait after last interaction before resuming
  const nownow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const bumpResume = () => { spinResumeAt = nownow() + resumeDelayMs; };
  controls.addEventListener('start', () => { isDragging = true; });
  controls.addEventListener('change', () => { bumpResume(); });
  controls.addEventListener('end', () => { isDragging = false; bumpResume(); });
  canvas.addEventListener('wheel', () => { bumpResume(); }, { passive: true });

  // Lights
  const amb = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
  scene.add(amb);
  const dir1 = new THREE.DirectionalLight(0xffffff, 2.0);
  dir1.position.set(6, 10, 8);
  dir1.castShadow = true;
  dir1.shadow.mapSize.set(2048, 2048);
  dir1.shadow.camera.near = 0.5;
  dir1.shadow.camera.far = 40;
  dir1.shadow.camera.left = -10;
  dir1.shadow.camera.right = 10;
  dir1.shadow.camera.top = 10;
  dir1.shadow.camera.bottom = -10;
  dir1.shadow.bias = -0.0005;
  dir1.shadow.normalBias = 0.03;
  scene.add(dir1);
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.5);
  dir2.position.set(-8, 4, -8);
  scene.add(dir2);

  // Ground plane (soft)
  const groundGeo = new THREE.CircleGeometry(20, 64);
  groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, metalness: 0.0, roughness: 1.0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -groundClearance;
  ground.receiveShadow = true;
  scene.add(ground);
  // Sync ground tint to current background
  applyBackground();

  // Sword generator demo
  const materials: any = { blade: {}, guard: {}, handle: {}, pommel: {} };
  const sword = new SwordGenerator(defaultSwordParams(), materials);
  // Enable shadows on sword parts
  sword.group.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      // overlays may be thin; keep receiveShadow off by default
    }
  });
  scene.add(sword.group);
  // expose sword instance for UI wiring
  (scene as any).__swordInstance = sword;

  // Simple rotation to show life
  const clock = new THREE.Clock();
  const bbox = new THREE.Box3();
  // Flame aura & embers state
  const flameMeshRef = { current: null as THREE.Mesh | null };
  const flameState = { enabled: false, opts: { scale: 1.05, color1: 0xff5a00, color2: 0xfff18a, noiseScale: 2.2, speed: 1.6, intensity: 1.0, direction: 'up' as 'up'|'down', blend: 'add' as 'add'|'normal'|'multiply' } };
  function setFlameAura(enabled: boolean, { scale=1.05, color1=0xff5a00, color2=0xfff18a, noiseScale=2.2, speed=1.6, intensity=1.0, direction='up' as 'up'|'down', blend='add' as 'add'|'normal'|'multiply' }={}){
    flameState.enabled = enabled; flameState.opts = { scale, color1, color2, noiseScale, speed, intensity, direction, blend };
    if (flameMeshRef.current) { (flameMeshRef.current.parent as any)?.remove(flameMeshRef.current); (flameMeshRef.current.material as any).dispose?.(); (flameMeshRef.current.geometry as any).dispose?.(); flameMeshRef.current = null; }
    if (!enabled || !sword.bladeMesh) return;
    const built = buildFlameAura(sword.bladeMesh, { scale, color1, color2, noiseScale, speed, intensity, direction, blend })
    sword.bladeMesh.add(built.mesh);
    flameMeshRef.current = built.mesh;
    if (fxFlags.selectiveBloom) flameMeshRef.current.layers.enable(BLOOM_LAYER);
    if (fxFlags.heatHaze) flameMeshRef.current.layers.enable(HEAT_LAYER);
  }
  let sparks: THREE.Points | null = null, sparksPos: Float32Array | null = null, sparksVel: Float32Array | null = null, sparksLife: Float32Array | null = null, sparksGeom: THREE.BufferGeometry | null = null;
  function setEmbers(enabled: boolean, {count=120, size=3, color=0xffaa55}={}){
    if (sparks) { (sparks.parent as any)?.remove(sparks); sparksGeom?.dispose(); (sparks.material as any)?.dispose?.(); sparks = null; sparksGeom=null; sparksPos=null; sparksVel=null; sparksLife=null; }
    if (!enabled || !sword.bladeMesh) return;
    const created = createEmbers(sword.bladeMesh, { count, size, color })
    sword.group.add(created.points)
    sparks = created.points; sparksGeom = created.geom; sparksPos = created.arrays.pos; sparksVel = created.arrays.vel; sparksLife = created.arrays.life
  }

  const tick = () => {
    const dt = clock.getDelta();
    const allowSpin = !isDragging && nownow() >= spinResumeAt;
    if (allowSpin) sword.group.rotation.y += dt * 0.25;
    sword.group.position.y = 0.0;
    // Animate inner glow
    if (innerGlowMat && innerGlowState.enabled) {
      innerGlowState.time += dt;
      (innerGlowMat.uniforms as any).time.value = innerGlowState.time;
    }
    // Advance mist time for wavy drift
    if (mistState.enabled) { mistTime += dt; }
    // Flame aura/heat haze time
    const elapsed = clock.getElapsedTime();
    if (flameMeshRef.current) { const m = flameMeshRef.current.material as THREE.ShaderMaterial; (m.uniforms as any).time.value = elapsed; }
    if (heatHazeEnabled) { fx.setHeatTime(elapsed); }
    // Update mist
    if (mistPoints && mistGeom && mistLife && mistVel && mistState.enabled) {
      const pos = mistGeom.getAttribute('position') as THREE.BufferAttribute;
      const n = pos.count;
      // Use local geometry bounds for consistent respawn independent of world transforms
      const bladeGeo = sword.bladeMesh!.geometry as THREE.BufferGeometry;
      bladeGeo.computeBoundingBox();
      const bb = bladeGeo.boundingBox!;
      const yMin = bb.min.y, yMax = bb.max.y;
      const zMin = bb.min.z, zMax = bb.max.z;
      const halfT = Math.max(1e-4, (zMax - zMin) * 0.5);
    updateMistPositions(mistGeom, { life: mistLife, vel: mistVel }, mistState as any, dt, elapsed, mistSpawn as any)
      if (mistMat) (mistMat.uniforms as any).uColor.value.setHex(mistState.color);
      if (mistMat) { (mistMat.uniforms as any).uSizeMax.value = mistState.size; (mistMat.uniforms as any).uSizeMin.value = Math.max(0.0, mistState.size * mistState.sizeMinRatio); }
      if (mistMat) (mistMat.uniforms as any).uAlphaScale.value = mistState.alphaScale;
    }
    // Update embers
    if (sparks && sparksGeom && sparksPos && sparksVel && sparksLife) {
      const n = sparksPos.length / 3; const bb = new THREE.Box3().setFromObject(sword.bladeMesh!);
      for (let i=0;i<n;i++){
        const ix = i*3; const vx = sparksVel[ix+0], vy = sparksVel[ix+1], vz = sparksVel[ix+2];
        let x = sparksPos[ix+0] + vx * dt, y = sparksPos[ix+1] + vy * dt, z = sparksPos[ix+2] + vz * dt;
        let l = sparksLife[i] + dt * 0.25;
        if (l >= 1.0 || y > bb.max.y + 0.5) {
          // respawn near upper-mid blade region
          x = THREE.MathUtils.lerp(bb.min.x, bb.max.x, Math.random()*0.3 + 0.35);
          y = THREE.MathUtils.lerp(bb.min.y, bb.max.y, Math.random()*0.4 + 0.3);
          z = THREE.MathUtils.lerp(bb.min.z, bb.max.z, Math.random()*0.3 + 0.35);
          sparksVel[ix+0]=(Math.random()-0.5)*0.4; sparksVel[ix+1]=Math.random()*0.8+0.4; sparksVel[ix+2]=(Math.random()-0.5)*0.4;
          l = 0.0;
        }
        sparksPos[ix+0]=x; sparksPos[ix+1]=y; sparksPos[ix+2]=z; sparksLife[i]=l;
      }
      (sparksGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (sparksGeom.getAttribute('aLife') as THREE.BufferAttribute).needsUpdate = true;
    }
    // Blade-mesh watcher: if geometry instance changed, rebind effects/layers
    {
      const bm = sword.bladeMesh as THREE.Mesh | null;
      const geomId = (bm?.geometry as any)?.id ?? -1;
      (tick as any)._lastBladeUUID = (tick as any)._lastBladeUUID ?? null;
      (tick as any)._lastGeomId = (tick as any)._lastGeomId ?? null;
      const changed = (!bm) ? false : ((bm.uuid !== (tick as any)._lastBladeUUID) || (geomId !== (tick as any)._lastGeomId));
      if (changed && bm) {
        (tick as any)._lastBladeUUID = bm.uuid; (tick as any)._lastGeomId = geomId;
        const resynced: string[] = [];
        // Rebuild mist if enabled
        if (mistState.enabled) {
          const count = Math.max(10, Math.floor(400 * mistState.density));
          rebuildMist(count);
          resynced.push('mist');
        }
        // Rebuild flame aura if enabled
        if (flameState.enabled) { setFlameAura(true, flameState.opts); resynced.push('aura'); }
        // Rebuild inner glow/fresnel if enabled
        if (innerGlowState.enabled) { renderHooks.setInnerGlow(true, innerGlowState.color, innerGlowState.iMin, innerGlowState.iMax, innerGlowState.speed); resynced.push('innerGlow'); }
        const fres: any = (renderHooks as any)._fresnelState;
        if (fres?.enabled) { renderHooks.setFresnel(true, fres.color, fres.intensity, fres.power); resynced.push('fresnel'); }
        // Ensure layers for bloom/heat on the new blade
        if (fxFlags.selectiveBloom) bm.layers.enable(BLOOM_LAYER);
        if (fxFlags.heatHaze) bm.layers.enable(HEAT_LAYER);
        // Re-apply blade visibility mode if currently hidden
        try { if (!bladeVisibility.visible) applyBladeVisibility(false, bladeVisibility.occlude); } catch {}
        // Rebuild blade gradient overlay if active
        try { (scene as any).__rebuildBladeGradient?.(); } catch {}
        // Broadcast sync event for UI indicator
        try { window.dispatchEvent(new CustomEvent('swordmaker:fx-synced', { detail: { parts: resynced } } as any)); } catch {}
      }
    }

    // Keep ground slightly below sword's lowest point to avoid occlusion
    bbox.setFromObject(sword.group);
    if (isFinite(bbox.min.y)) {
      ground.position.y = bbox.min.y - groundClearance;
    }
  };

  // Post-processing composer
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const aaPasses = { fxaa: null as ShaderPass | null, smaa: null as SMAAPass | null };
  const fx = new FxManager(renderer, scene, camera);
  fx.attachToComposer(composer);
  const size = new THREE.Vector2();
  const updateFXAA = () => {
    renderer.getSize(size);
    if (aaPasses.fxaa) (aaPasses.fxaa.uniforms as any).resolution.value.set(1 / (size.x * renderer.getPixelRatio()), 1 / (size.y * renderer.getPixelRatio()));
    if (aaPasses.smaa) aaPasses.smaa.setSize(size.x, size.y);
    // sync FX-managed buffers
    fx.updateSize(size.x, size.y);
  };
  updateFXAA();
  // AA passes are added lazily via setAAMode

  // === FX Layers and Selective Bloom / Heat Haze via manager ===
  const BLOOM_LAYER = fx.BLOOM_LAYER; const HEAT_LAYER = fx.HEAT_LAYER;
  const fxFlags = { selectiveBloom: false, heatHaze: false };

  // Bloom (disabled by default)
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.2, 0.85);
  bloom.enabled = false;
  composer.addPass(bloom);

  // Outline pass (disabled by default). By default, outline the sword group.
  const outline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
  outline.enabled = false;
  outline.edgeStrength = 2.5;
  outline.edgeThickness = 1.0;
  outline.visibleEdgeColor.set('#ffffff');
  outline.hiddenEdgeColor.set('#000000');
  composer.addPass(outline);

  // Vignette pass (custom shader)
  const vignette = new ShaderPass(VignetteShader as any);
  vignette.enabled = false;
  composer.addPass(vignette);

  // Back-face "ink" outline (mesh-based)
  const inkOutlineGroup = { current: null as THREE.Group | null };
  const buildInkOutline = (scale: number, colorHex: number) => buildInkOutlineImported(sword.group, scale, colorHex);

  // Fresnel/specular edge accent overlay (mesh-based ShaderMaterial)
  const fresnelGroup = { current: null as THREE.Group | null };
  const buildFresnel = (col: number, intensity: number, power: number) => buildFresnelImported(sword.group, col, intensity, power);

  // Flame aura shader moved to ./fx/shaders and builder in ./fx/aura

  // Inner Glow (pulsing fresnel-like overlay)
  const innerGlowGroup = { current: null as THREE.Group | null };
  const innerGlowMat = { current: null as THREE.ShaderMaterial | null };
  const innerGlowState = { enabled: false, time: 0.0, speed: 1.5, color: 0x88ccff, iMin: 0.2, iMax: 0.9 };
  const buildInnerGlow = (colorHex: number, iMin: number, iMax: number, speed: number) => {
    const built = buildInnerGlowImported(sword.group, colorHex, iMin, iMax, speed)
    innerGlowMat.current = built.material
    return built.group
  }

  // Blade Mist particles
  let mistPoints: THREE.Points | null = null;
  let mistGeom: THREE.BufferGeometry | null = null;
  let mistMat: THREE.ShaderMaterial | null = null;
  let mistLife: Float32Array | null = null; // age 0..1
  let mistVel: Float32Array | null = null; // vx, vz per particle
  let mistTime = 0.0; // for wavy drift
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
    emission: 'base' as 'base'|'edge'|'tip'|'full',
    occlude: false,
  };
  const mistSpawn = { xMin: 0, xMax: 0, yMin: 0, yMax: 0, baseTop: 0, tipBottom: 0, halfT: 0 };
  const rebuildMist = (count: number) => {
    if (mistPoints) { (mistPoints.parent as any)?.remove(mistPoints); mistGeom?.dispose(); mistPoints = null; mistGeom = null; }
    const built = buildMist(sword.bladeMesh!, count, mistState as any)
    mistLife = built.arrays.life; mistVel = built.arrays.vel; mistGeom = built.geom; mistMat = built.material
    // Attach mist to the sword root group so it isn't affected by blade material hacks
    sword.group.add(built.points)
    mistPoints = built.points
    // Cache spawn bands/extents
    Object.assign(mistSpawn, built.spawn)
  };

  const setKeyLightAngles = (azimuthDeg: number, elevationDeg: number) => {
    const az = THREE.MathUtils.degToRad(azimuthDeg);
    const el = THREE.MathUtils.degToRad(elevationDeg);
    const r = 12;
    dir1.position.set(Math.cos(az) * Math.cos(el) * r, Math.sin(el) * r, Math.sin(az) * Math.cos(el) * r);
  };

  const setRimLightAngles = (azimuthDeg: number, elevationDeg: number) => {
    const az = THREE.MathUtils.degToRad(azimuthDeg);
    const el = THREE.MathUtils.degToRad(elevationDeg);
    const r = 12;
    dir2.position.set(Math.cos(az) * Math.cos(el) * r, Math.sin(el) * r, Math.sin(az) * Math.cos(el) * r);
  };

  // Blade gradient/wear overlay (mesh-based ShaderMaterial)
  const buildBladeGradient = (baseHex: number, edgeHex: number, edgeFade: number, wearAmt: number) => sword.bladeMesh ? buildBladeGradientOverlay(sword.bladeMesh, baseHex, edgeHex, edgeFade, wearAmt) : null;

  // Blade visibility state and applicator: hide blade surface without hiding child FX
  const bladeVisibility = { visible: true, occlude: false } as { visible: boolean; occlude: boolean };
  const applyBladeVisibility = (visible: boolean, occlude: boolean) => {
    const bm = sword.bladeMesh as THREE.Mesh | null;
    if (!bm) return;
    const m: any = (bm as any).material;
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
    if (Array.isArray(m)) m.forEach(apply); else if (m) apply(m);
  };

  let currentEnvTex: THREE.Texture | null = null;

  const renderHooks: RenderHooks = {
    // Materials
    setPartMaterial: (part: 'blade'|'guard'|'handle'|'pommel', patch: any) => {
      (materials as any)[part] = { ...(materials as any)[part], ...(patch||{}) };
      (scene as any).__materials = materials;
      sword.setMaterials(materials);
      // Preserve blade invisibility if materials were refreshed
      if (part === 'blade' && !bladeVisibility.visible) {
        applyBladeVisibility(false, bladeVisibility.occlude);
      }
    },
    // Blade visibility without hiding child FX (aura, mist, overlays)
    setBladeVisible: (visible: boolean, occlude?: boolean) => {
      bladeVisibility.visible = !!visible;
      bladeVisibility.occlude = !!occlude;
      applyBladeVisibility(!!visible, !!occlude);
    },
    setExposure: (v: number) => { renderer.toneMappingExposure = v; },
    setToneMapping: (mode: 'None'|'Linear'|'Reinhard'|'Cineon'|'ACES') => {
      const map: Record<string, any> = {
        None: THREE.NoToneMapping,
        Linear: THREE.LinearToneMapping,
        Reinhard: THREE.ReinhardToneMapping,
        Cineon: THREE.CineonToneMapping,
        ACES: THREE.ACESFilmicToneMapping
      };
      renderer.toneMapping = map[mode] ?? THREE.ACESFilmicToneMapping;
    },
    setAmbient: (v: number) => { amb.intensity = v; },
    setKeyIntensity: (v: number) => { dir1.intensity = v; },
    setKeyAngles: (az: number, el: number) => setKeyLightAngles(az, el),
    setRimIntensity: (v: number) => { dir2.intensity = v; },
    setRimColor: (hex: number) => { dir2.color.setHex(hex); },
    setRimAngles: (az: number, el: number) => setRimLightAngles(az, el),
    setBloom: (enabled: boolean, strength?: number, threshold?: number, radius?: number) => {
      bloom.enabled = enabled;
      if (strength !== undefined) bloom.strength = strength;
      if (threshold !== undefined) bloom.threshold = threshold;
      if (radius !== undefined) bloom.radius = radius;
    },
    setVignette: (enabled: boolean, strength?: number, softness?: number) => {
      vignette.enabled = enabled;
      if (strength !== undefined) (vignette.uniforms as any).strength.value = strength;
      if (softness !== undefined) (vignette.uniforms as any).softness.value = softness;
    },
    // Advanced FX controls
    setSelectiveBloom: (enabled: boolean, strength?: number, threshold?: number, radius?: number, intensity?: number) => {
      selectiveBloomEnabled = enabled;
      fx.setSelectiveBloom(enabled, { strength, threshold, radius, intensity });
      // Mark aura for bloom if present, otherwise mark blade
        const target = flameMeshRef.current ?? sword.bladeMesh;
      if (target) {
        if (enabled) target.layers.enable(BLOOM_LAYER);
        else target.layers.disable(BLOOM_LAYER);
      }
    },
    markForBloom: (obj: THREE.Object3D, enable = true) => { fx.markForBloom(obj, enable); },
    setHeatHaze: (enabled: boolean, distortion?: number) => {
      heatHazeEnabled = enabled; fx.setHeatHaze(enabled, distortion);
      const target = flameMeshRef.current ?? sword.bladeMesh;
      if (target) {
        if (enabled) target.layers.enable(HEAT_LAYER); else target.layers.disable(HEAT_LAYER);
      }
    },
    markForHeat: (obj: THREE.Object3D, enable = true) => { fx.markForHeat(obj, enable); },
    setFlameAura: (enabled: boolean, opts?: { scale?: number; color1?: number; color2?: number; noiseScale?: number; speed?: number; intensity?: number; direction?: 'up'|'down'; blend?: 'add'|'normal'|'multiply' }) => {
      setFlameAura(enabled, opts || {});
    },
    setEmbers: (enabled: boolean, opts?: { count?: number; size?: number; color?: number }) => {
      setEmbers(enabled, opts || {});
    },
    setMistTurbulence: (v: number) => { (mistState as any).turbulence = Math.max(0, v); },
    setBackgroundColor: (hex: number) => { bgBase.setHex(hex); applyBackground(); },
    setBackgroundBrightness: (v: number) => { bgBrightness = v; applyBackground(); },
    setBackgroundTargetColor: (hex: number) => { bgTarget.setHex(hex); applyBackground(); },
    setBaseColor: (hex: number) => { groundMat.color.setHex(hex); groundMat.needsUpdate = true; },
    setAAMode: (mode: 'none'|'fxaa'|'smaa') => {
      if (mode === 'fxaa') {
        if (!fxaa) { fxaa = new ShaderPass(FXAAShader); composer.addPass(fxaa); updateFXAA(); }
        fxaa.enabled = true;
        if (smaa) smaa.enabled = false;
      } else if (mode === 'smaa') {
        if (!smaa) { smaa = new SMAAPass(1, 1); composer.addPass(smaa); updateFXAA(); }
        smaa.enabled = true;
        if (fxaa) fxaa.enabled = false;
      } else {
        if (fxaa) fxaa.enabled = false;
        if (smaa) smaa.enabled = false;
      }
    },
    setShadowBias: (bias: number, normalBias?: number) => {
      dir1.shadow.bias = bias;
      if (normalBias !== undefined) dir1.shadow.normalBias = normalBias;
    },
    setShadowMapSize: (size: 512|1024|2048|4096) => {
      dir1.shadow.mapSize.set(size, size);
      dir1.shadow.dispose?.();
    },
    setEnvMap: async (url?: string, asBackground?: boolean) => {
      try {
        if (!url) {
          scene.environment = envTex;
          if (asBackground) scene.background = null;
          currentEnvTex?.dispose?.(); currentEnvTex = null as any;
          return;
        }
        const isHDR = url.toLowerCase().endsWith('.hdr');
        const done = (tex: THREE.Texture) => {
          const pm = new THREE.PMREMGenerator(renderer);
          const rt = pm.fromEquirectangular(tex);
          const pmtex = rt.texture;
          scene.environment = pmtex;
          scene.background = asBackground ? pmtex : null;
          currentEnvTex = pmtex;
          tex.dispose(); pm.dispose();
        };
        if (isHDR) {
          const hdr = new RGBELoader();
          hdr.load(url, (hdrTex: any) => { hdrTex.mapping = THREE.EquirectangularReflectionMapping; done(hdrTex as any); });
        } else {
          const loader = new THREE.TextureLoader();
          loader.load(url, (tex) => { tex.mapping = THREE.EquirectangularReflectionMapping; done(tex); });
        }
      } catch (e) { console.warn('EnvMap load failed', e); }
    },
    setFog: (colorHex?: number, density?: number) => {
      if (!density || density <= 0) { scene.fog = null as any; return; }
      scene.fog = new THREE.FogExp2(new THREE.Color(colorHex ?? 0xffffff), density);
    },
    setInnerGlow: (enabled: boolean, colorHex?: number, iMin?: number, iMax?: number, speed?: number) => {
      if (innerGlowGroup) { (innerGlowGroup.parent as any)?.remove(innerGlowGroup); innerGlowGroup = null; innerGlowMat = null; }
      innerGlowState.enabled = enabled; innerGlowState.time = 0; innerGlowState.speed = speed ?? innerGlowState.speed;
      if (colorHex !== undefined) innerGlowState.color = colorHex;
      if (iMin !== undefined) innerGlowState.iMin = iMin;
      if (iMax !== undefined) innerGlowState.iMax = iMax;
      if (enabled) {
        innerGlowGroup = buildInnerGlow(innerGlowState.color, innerGlowState.iMin, innerGlowState.iMax, innerGlowState.speed);
        if (innerGlowGroup) sword.group.add(innerGlowGroup);
      }
    },
    setBladeMist: (enabled: boolean, colorHex?: number, density?: number, speed?: number, spread?: number, size?: number) => {
      if (mistPoints) { (mistPoints.parent as any)?.remove(mistPoints); mistGeom?.dispose(); mistPoints = null; mistGeom = null; }
      mistState.enabled = enabled;
      if (colorHex !== undefined) mistState.color = colorHex;
      if (density !== undefined) mistState.density = Math.max(0, Math.min(1, density));
      if (speed !== undefined) mistState.speed = Math.max(0, speed);
      if (spread !== undefined) mistState.spread = Math.max(0, spread);
      if (size !== undefined) mistState.size = size;
      // Adapt alpha to density to curb overbright accumulation
      const d = Math.max(0.0001, mistState.density);
      mistState.alphaScale = 0.35 / Math.sqrt(d * 1.25);
      if (enabled) {
        const count = Math.max(10, Math.floor(400 * mistState.density));
        rebuildMist(count);
      }
    },
    setBladeMistAdvanced: (cfg: { occlude?: boolean; lifeRate?: number; noiseAmp?: number; noiseFreqX?: number; noiseFreqZ?: number; windX?: number; windZ?: number; emission?: 'base'|'edge'|'tip'|'full'; sizeMinRatio?: number }) => {
      if (cfg.occlude !== undefined) mistState.occlude = !!cfg.occlude;
      if (cfg.lifeRate !== undefined) mistState.lifeRate = Math.max(0.01, cfg.lifeRate);
      if (cfg.noiseAmp !== undefined) mistState.noiseAmp = Math.max(0, cfg.noiseAmp);
      if (cfg.noiseFreqX !== undefined) mistState.noiseFreqX = Math.max(0, cfg.noiseFreqX);
      if (cfg.noiseFreqZ !== undefined) mistState.noiseFreqZ = Math.max(0, cfg.noiseFreqZ);
      if (cfg.windX !== undefined) mistState.windX = cfg.windX;
      if (cfg.windZ !== undefined) mistState.windZ = cfg.windZ;
      if (cfg.emission !== undefined) mistState.emission = cfg.emission;
      if (cfg.sizeMinRatio !== undefined) mistState.sizeMinRatio = Math.max(0, Math.min(1, cfg.sizeMinRatio));
      if (mistMat) {
        (mistMat.uniforms as any).uSizeMax.value = mistState.size;
        (mistMat.uniforms as any).uSizeMin.value = Math.max(0.0, mistState.size * mistState.sizeMinRatio);
        (mistMat.uniforms as any).uAlphaScale.value = mistState.alphaScale;
        mistMat.depthTest = mistState.occlude;
        mistMat.needsUpdate = true;
      }
    },
    // setBladeGradientWear is defined below with an internal builder
    // Procedural bump/noise on selected part
    setPartBump: (part: 'blade'|'guard'|'handle'|'pommel'|'scabbard'|'tassel', enabled: boolean, bumpScale?: number, noiseScale?: number, seed?: number) => {
      setPartBump(sword, part, enabled, { bumpScale, noiseScale, seed }, makeValueNoiseTexture)
    },
    // Blade gradient/wear overlay (visible, no z-fight)
    setBladeGradientWear: (() => {
      let gwGroup: THREE.Group | null = null;
      let gwLast: { enabled: boolean; base: number; edge: number; edgeFade: number; wear: number } | null = null;
      const build = (base: number, edge: number, edgeFade: number, wear: number) => sword.bladeMesh ? buildBladeGradientWearOverlay(sword.bladeMesh, base, edge, edgeFade, wear) : null;
      const apply = (enabled: boolean, base?: number, edge?: number, edgeFade?: number, wear?: number) => {
        if (gwGroup) { (gwGroup.parent as any)?.remove(gwGroup); gwGroup = null; }
        if (enabled) {
          const b = base ?? 0xb9c6ff, e = edge ?? 0xffffff, ef = edgeFade ?? 0.2, w = wear ?? 0.2;
          gwLast = { enabled: true, base: b, edge: e, edgeFade: ef, wear: w };
          gwGroup = build(b, e, ef, w);
        } else {
          gwLast = { enabled: false, base: 0, edge: 0, edgeFade: 0, wear: 0 } as any;
        }
      };
      // Expose a rebuild hook for when blade geometry changes
      (scene as any).__rebuildBladeGradient = () => { if (gwLast?.enabled) apply(true, gwLast.base, gwLast.edge, gwLast.edgeFade, gwLast.wear); };
      return apply;
    })(),
    setFresnel: (enabled: boolean, colorHex?: number, intensity?: number, power?: number) => {
      if (fresnelGroup) { (fresnelGroup.parent as any)?.remove(fresnelGroup); fresnelGroup = null; }
      (renderHooks as any)._fresnelState = { enabled, color: colorHex ?? 0xffffff, intensity: intensity ?? 0.6, power: power ?? 2.0 };
      if (enabled) {
        fresnelGroup = buildFresnel(colorHex ?? 0xffffff, intensity ?? 0.6, power ?? 2.0);
        if (fresnelGroup) sword.group.add(fresnelGroup);
      }
    },
    setOutline: (enabled: boolean, strength?: number, thickness?: number, colorHex?: number) => {
      outline.enabled = enabled;
      if (strength !== undefined) outline.edgeStrength = strength;
      if (thickness !== undefined) outline.edgeThickness = thickness;
      if (colorHex !== undefined) outline.visibleEdgeColor.setHex(colorHex);
      outline.selectedObjects = []; // default to sword group if empty
      if (sword?.group) outline.selectedObjects.push(sword.group);
    },
    setInkOutline: (enabled: boolean, thickness?: number, colorHex?: number) => {
      if (inkOutlineGroup) {
        (inkOutlineGroup.parent as any)?.remove(inkOutlineGroup);
        inkOutlineGroup.traverse((o)=>{
          const m = o as THREE.Mesh; if (m.isMesh) { (m.geometry as any) = null; }
        });
        inkOutlineGroup = null;
      }
      if (enabled) {
        const s = Math.max(0.0, Math.min(0.2, (thickness ?? 0.02)));
        const color = colorHex ?? 0x000000;
        inkOutlineGroup = buildInkOutline(s, color);
        if (inkOutlineGroup) sword.group.add(inkOutlineGroup);
      }
    },
    setEnvIntensity: (v: number) => {
      sword.group.traverse((o) => {
        const material = (o as any).material as THREE.Material | THREE.Material[] | undefined;
        const apply = (mat: any) => {
          if (!mat || !('envMapIntensity' in mat)) return;
          const storeKey = '__baseEnvMapIntensity';
          if (mat[storeKey] === undefined) {
            const current = typeof mat.envMapIntensity === 'number' ? mat.envMapIntensity : 1;
            mat[storeKey] = current;
          }
          mat.envMapIntensity = mat[storeKey] * v;
          mat.needsUpdate = true;
        };
        if (Array.isArray(material)) material.forEach(apply); else apply(material);
      });
    },
    // Material base controls per part
    setPartColor: (part: 'blade'|'guard'|'handle'|'pommel'|'scabbard'|'tassel', hex: number) => {
      setPartColor(sword, part, hex)
    },
    setPartMetalness: (part: 'blade'|'guard'|'handle'|'pommel'|'scabbard'|'tassel', v: number) => {
      setPartMetalness(sword, part, v)
    },
    setPartRoughness: (part: 'blade'|'guard'|'handle'|'pommel'|'scabbard'|'tassel', v: number) => {
      setPartRoughness(sword, part, v)
    },
    setPartClearcoat: (part: 'blade'|'guard'|'handle'|'pommel'|'scabbard'|'tassel', v: number) => {
      setPartClearcoat(sword, part, v)
    },
    setPartClearcoatRoughness: (part: 'blade'|'guard'|'handle'|'pommel'|'scabbard'|'tassel', v: number) => {
      setPartClearcoatRoughness(sword, part, v)
    },
    setDPRCap: (cap: number) => {
      (renderer as any)._dprCap = cap;
      // Trigger an immediate resize update via window event would happen in main.
      // We also ensure passes get updated.
      updateFXAA();
    }
  };
  (scene as any).__renderHooks = renderHooks;
  if (typeof window !== 'undefined') {
    const debug = ((window as unknown) as Record<string, any>)['__swordDebug'] ?? {};
    debug.renderHooks = renderHooks;
    debug.renderer = renderer;
    debug.scene = scene;
    debug.sword = sword;
    debug.composer = composer;
    ((window as unknown) as Record<string, any>)['__swordDebug'] = debug;
  }
  // Default to SMAA to avoid FXAA driver warnings on some systems
  try { renderHooks.setAAMode('smaa'); } catch {}

  const dispose = () => {
    renderer.setAnimationLoop(null);
    groundGeo.dispose();
    groundMat.dispose();
    pmrem.dispose();
    sword.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose?.();
        if ((mesh.material as any)?.dispose) (mesh.material as any).dispose();
      }
    });
  };

  const preFX = () => { fx.preFX(); };
  // Start the animation loop after all state and passes are initialized
  renderer.setAnimationLoop(tick);
  return { renderer, scene, camera, controls, composer, dispose, updateFXAA, renderHooks, preFX } as { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; composer: EffectComposer; dispose: () => void; updateFXAA: () => void; renderHooks: RenderHooks; preFX: () => void };
}

// placeholder builder removed (replaced by SwordGenerator)
