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
  let flameMesh: THREE.Mesh | null = null;
  const flameState = { enabled: false, opts: { scale: 1.05, color1: 0xff5a00, color2: 0xfff18a, noiseScale: 2.2, speed: 1.6, intensity: 1.0 } };
  function setFlameAura(enabled: boolean, { scale=1.05, color1=0xff5a00, color2=0xfff18a, noiseScale=2.2, speed=1.6, intensity=1.0 }={}){
    flameState.enabled = enabled; flameState.opts = { scale, color1, color2, noiseScale, speed, intensity };
    if (flameMesh) { (flameMesh.parent as any)?.remove(flameMesh); (flameMesh.material as any).dispose?.(); (flameMesh.geometry as any).dispose?.(); flameMesh = null; }
    if (!enabled || !sword.bladeMesh) return;
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone((FlameAuraShader as any).uniforms),
      vertexShader: (FlameAuraShader as any).vertexShader,
      fragmentShader: (FlameAuraShader as any).fragmentShader,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    (mat.uniforms as any).color1.value = new THREE.Color(color1);
    (mat.uniforms as any).color2.value = new THREE.Color(color2);
    (mat.uniforms as any).noiseScale.value = noiseScale;
    (mat.uniforms as any).speed.value = speed;
    (mat.uniforms as any).intensity.value = intensity;
    const geom = (sword.bladeMesh.geometry as THREE.BufferGeometry).clone();
    const mesh = new THREE.Mesh(geom, mat);
    // Parent to blade mesh so it tracks geometry transforms precisely
    mesh.position.set(0,0,0);
    mesh.quaternion.identity();
    mesh.scale.setScalar(scale);
    sword.bladeMesh.add(mesh);
    flameMesh = mesh;
    // Align layers for bloom/heat to the aura, not the blade, if effects are enabled
    if (selectiveBloomEnabled) flameMesh.layers.enable(BLOOM_LAYER);
    if (heatHazeEnabled) flameMesh.layers.enable(HEAT_LAYER);
  }
  let sparks: THREE.Points | null = null, sparksPos: Float32Array | null = null, sparksVel: Float32Array | null = null, sparksLife: Float32Array | null = null, sparksGeom: THREE.BufferGeometry | null = null;
  function setEmbers(enabled: boolean, {count=120, size=3, color=0xffaa55}={}){
    if (sparks) { (sparks.parent as any)?.remove(sparks); sparksGeom?.dispose(); (sparks.material as any)?.dispose?.(); sparks = null; sparksGeom=null; sparksPos=null; sparksVel=null; sparksLife=null; }
    if (!enabled || !sword.bladeMesh) return;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count*3); const life = new Float32Array(count); const vel = new Float32Array(count*3);
    const bb = new THREE.Box3().setFromObject(sword.bladeMesh);
    for (let i=0;i<count;i++){
      const x = THREE.MathUtils.lerp(bb.min.x, bb.max.x, Math.random()*0.2 + 0.4);
      const y = THREE.MathUtils.lerp(bb.min.y, bb.max.y, Math.random()*0.2 + 0.1);
      const z = THREE.MathUtils.lerp(bb.min.z, bb.max.z, Math.random()*0.2 + 0.4);
      pos[i*3+0]=x; pos[i*3+1]=y; pos[i*3+2]=z; life[i]=Math.random();
      vel[i*3+0]=(Math.random()-0.5)*0.4; vel[i*3+1]=Math.random()*0.8+0.4; vel[i*3+2]=(Math.random()-0.5)*0.4;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos,3));
    geom.setAttribute('aLife', new THREE.BufferAttribute(life,1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uSize: { value: size } },
      vertexShader: `
        uniform float uSize; attribute float aLife; varying float vLife; void main(){ vLife=aLife; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * (300.0 / max(1.0, -mv.z)); }
      `,
      fragmentShader: `
        uniform vec3 uColor; varying float vLife; void main(){ vec2 d = gl_PointCoord-vec2(0.5); float r=length(d); float soft=exp(-6.0*r*r); float a = soft * (1.0 - smoothstep(0.7,1.0,vLife)); gl_FragColor = vec4(uColor, a); }
      `,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });
    const pts = new THREE.Points(geom, mat); sword.group.add(pts);
    sparks = pts; sparksGeom = geom; sparksPos = pos; sparksVel = vel; sparksLife = life;
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
    if (flameMesh) { const m = flameMesh.material as THREE.ShaderMaterial; (m.uniforms as any).time.value = elapsed; }
    if (heatHazePass.enabled) { (heatHazePass.uniforms as any).time.value = elapsed; }
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
      for (let i=0;i<n;i++) {
        const ix = i*3, iv = i*2;
        let x = pos.array[ix+0] as number; let y = pos.array[ix+1] as number; let z = pos.array[ix+2] as number;
        const baseVx = mistVel[iv+0] * mistState.spread; const baseVz = mistVel[iv+1] * mistState.spread;
        // Add gentle wavy drift + optional curl turbulence
        const waveX = Math.sin(mistTime * mistState.noiseFreqX + i * 0.19) * mistState.noiseAmp;
        const waveZ = Math.cos(mistTime * mistState.noiseFreqZ + i * 0.31) * mistState.noiseAmp;
        const curl = curlNoise(new THREE.Vector3(x*0.75, (y+elapsed)*0.5, z*0.75));
        x += (baseVx + waveX + mistState.windX + curl.x * 0.35) * dt; 
        z += (baseVz + waveZ + mistState.windZ + curl.z * 0.35) * dt; 
        y += mistState.speed * dt + curl.y * 0.35 * dt;
        let life = mistLife[i] + dt * mistState.lifeRate; if (y > yMax || life >= 1.0) {
          // respawn according to emission mode
          const edgeJitter = (mistSpawn.xMax - mistSpawn.xMin) * 0.02;
          if (mistState.emission === 'edge') {
            const side = Math.random() < 0.5 ? -1 : 1;
            const xEdge = side < 0 ? (mistSpawn.xMin * 0.98) : (mistSpawn.xMax * 0.98);
            x = xEdge + (Math.random()-0.5) * edgeJitter;
            y = THREE.MathUtils.lerp(mistSpawn.yMin, mistSpawn.baseTop, Math.random());
            z = side * (mistSpawn.halfT + 0.02);
          } else if (mistState.emission === 'tip') {
            x = THREE.MathUtils.lerp(mistSpawn.xMin*0.5, mistSpawn.xMax*0.5, Math.random());
            y = THREE.MathUtils.lerp(mistSpawn.tipBottom, mistSpawn.yMax, Math.random());
            const side = Math.random() < 0.5 ? -1 : 1;
            z = side * (mistSpawn.halfT + 0.02);
          } else if (mistState.emission === 'full') {
            x = THREE.MathUtils.lerp(mistSpawn.xMin*0.5, mistSpawn.xMax*0.5, Math.random());
            y = THREE.MathUtils.lerp(mistSpawn.yMin, mistSpawn.yMax, Math.random());
            const side = Math.random() < 0.5 ? -1 : 1;
            z = side * (mistSpawn.halfT + 0.02);
          } else { // base
            x = THREE.MathUtils.lerp(mistSpawn.xMin*0.5, mistSpawn.xMax*0.5, Math.random());
            y = THREE.MathUtils.lerp(mistSpawn.yMin, mistSpawn.baseTop, Math.random());
            const side = Math.random() < 0.5 ? -1 : 1;
            z = side * (mistSpawn.halfT + 0.02);
          }
          mistVel[iv+0] = (Math.random()-0.5) * 0.2; mistVel[iv+1] = (Math.random()-0.5) * 0.2;
          life = 0.0; // start at 0 and fade in
        }
        (pos.array as any)[ix+0]=x; (pos.array as any)[ix+1]=y; (pos.array as any)[ix+2]=z; mistLife[i]=life;
      }
      pos.needsUpdate = true;
      const aLifeAttr = mistGeom.getAttribute('aLife') as THREE.BufferAttribute; aLifeAttr.needsUpdate = true;
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
        if (selectiveBloomEnabled) bm.layers.enable(BLOOM_LAYER);
        if (heatHazeEnabled) bm.layers.enable(HEAT_LAYER);
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
  renderer.setAnimationLoop(tick);

  // Post-processing composer
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const fxaa = new ShaderPass(FXAAShader);
  const smaa = new SMAAPass(1, 1);
  const size = new THREE.Vector2();
  const updateFXAA = () => {
    renderer.getSize(size);
    (fxaa.uniforms as any).resolution.value.set(1 / (size.x * renderer.getPixelRatio()), 1 / (size.y * renderer.getPixelRatio()));
    smaa.setSize(size.x, size.y);
    // sync additional buffers
    try { bloomComposer.setSize(size.x, size.y); } catch {}
    try { heatMaskRT.setSize(size.x, size.y); } catch {}
  };
  updateFXAA();
  composer.addPass(fxaa);
  composer.addPass(smaa);
  smaa.enabled = false;

  // === FX Layers and Selective Bloom ===
  const BLOOM_LAYER = 1; const HEAT_LAYER = 2; const bloomLayers = new THREE.Layers(); bloomLayers.set(BLOOM_LAYER);
  const nonBloomMats = new Map<THREE.Mesh, THREE.Material|THREE.Material[]>();
  const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  function darkenNonBloom(o: THREE.Object3D){ const m = o as THREE.Mesh; if (m.isMesh && bloomLayers.test(m.layers) === false) { nonBloomMats.set(m, m.material); m.material = blackMat; } }
  function restoreNonBloom(o: THREE.Object3D){ const m = o as THREE.Mesh; if (nonBloomMats.has(m)) { m.material = nonBloomMats.get(m)!; nonBloomMats.delete(m); } }
  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.addPass(new RenderPass(scene, camera));
  const selBloomPass = new UnrealBloomPass(new THREE.Vector2(1,1), 1.1, 0.35, 0.8);
  bloomComposer.addPass(selBloomPass);
  const BloomCompositeShader = {
    uniforms: { tDiffuse: { value: null }, tBloom: { value: bloomComposer.renderTarget2.texture }, intensity: { value: 1.0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse, tBloom; uniform float intensity; varying vec2 vUv; void main(){ vec4 base = texture2D(tDiffuse, vUv); vec4 bloom = texture2D(tBloom, vUv) * intensity; gl_FragColor = base + bloom; }`
  } as const;
  const bloomCompositePass = new ShaderPass(BloomCompositeShader as any);
  composer.addPass(bloomCompositePass);
  let selectiveBloomEnabled = false;
  function preRenderBloom(){ if (!selectiveBloomEnabled) return; scene.traverse(darkenNonBloom); bloomComposer.render(); scene.traverse(restoreNonBloom); (bloomCompositePass.uniforms as any).tBloom.value = bloomComposer.renderTarget2.texture; }

  // === Heat Haze (mask-based) ===
  const heatMaskRT = new THREE.WebGLRenderTarget(1,1, { depthBuffer: false, stencilBuffer: false });
  const heatMaskMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const HeatHazeShader = {
    uniforms: { tDiffuse: { value: null }, tMask: { value: heatMaskRT.texture }, time: { value: 0.0 }, distortion: { value: 0.004 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `#ifdef GL_OES_standard_derivatives\n#extension GL_OES_standard_derivatives : enable\n#endif\nuniform sampler2D tDiffuse, tMask; uniform float distortion, time; varying vec2 vUv; void main(){ float m = texture2D(tMask, vUv).r; vec2 g = vec2(dFdx(m), dFdy(m)); vec2 dir = normalize(vec2(g.y, -g.x) + 1e-6); float wobble = sin((vUv.y + time*0.6)*60.0) * 0.5 + 0.5; vec2 uv2 = vUv + dir * (distortion * m * (0.6 + 0.4*wobble)); gl_FragColor = texture2D(tDiffuse, uv2); }`
  } as const;
  const heatHazePass = new ShaderPass(HeatHazeShader as any);
  (heatHazePass.material as any).extensions = { derivatives: true };
  heatHazePass.enabled = false; composer.addPass(heatHazePass);
  let heatHazeEnabled = false;
  function renderHeatMask(){ if (!heatHazeEnabled) return; const prevMask = camera.layers.mask; const prevMat = scene.overrideMaterial; const prevTarget = renderer.getRenderTarget(); camera.layers.set(HEAT_LAYER); scene.overrideMaterial = heatMaskMat; renderer.setRenderTarget(heatMaskRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(prevTarget); camera.layers.mask = prevMask; scene.overrideMaterial = prevMat; }

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
  const VignetteShader = {
    uniforms: {
      tDiffuse: { value: null },
      strength: { value: 0.25 },
      softness: { value: 0.5 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float strength;
      uniform float softness;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        float d = distance(vUv, vec2(0.5));
        float outer = 0.5;
        float inner = max(0.0, outer - softness);
        float v = smoothstep(inner, outer, d);
        c.rgb *= mix(1.0, 1.0 - strength, v);
        gl_FragColor = c;
      }
    `
  };
  const vignette = new ShaderPass(VignetteShader as any);
  vignette.enabled = false;
  composer.addPass(vignette);

  // Back-face "ink" outline (mesh-based)
  let inkOutlineGroup: THREE.Group | null = null;
  const buildInkOutline = (scale: number, colorHex: number) => {
    const group = new THREE.Group();
    const outlineMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.BackSide });
    sword.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) {
        const om = new THREE.Mesh(m.geometry, outlineMat);
        om.position.copy(m.position);
        om.quaternion.copy(m.quaternion);
        om.scale.copy(m.scale).multiplyScalar(1 + scale);
        group.add(om);
      }
    });
    return group;
  };

  // Fresnel/specular edge accent overlay (mesh-based ShaderMaterial)
  let fresnelGroup: THREE.Group | null = null;
  const FresnelShader = {
    uniforms: { color: { value: new THREE.Color(0xffffff) }, intensity: { value: 0.6 }, power: { value: 2.0 } },
    vertexShader: `
      varying vec3 vNormal; varying vec3 vWorldPos;
      void main(){ vNormal = normalize(normalMatrix * normal); vec4 wp = modelMatrix * vec4(position,1.0); vWorldPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
    `,
    fragmentShader: `
      uniform vec3 color; uniform float intensity; uniform float power; varying vec3 vNormal; varying vec3 vWorldPos;
      void main(){ vec3 V = normalize(cameraPosition - vWorldPos); float f = pow(1.0 - max(0.0, dot(normalize(vNormal), V)), power) * intensity; gl_FragColor = vec4(color * f, f); }
    `
  } as const;
  const buildFresnel = (col: number, intensity: number, power: number) => {
    const group = new THREE.Group();
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone((FresnelShader as any).uniforms),
      vertexShader: (FresnelShader as any).vertexShader,
      fragmentShader: (FresnelShader as any).fragmentShader,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide
    });
    (mat.uniforms as any).color.value = new THREE.Color(col);
    (mat.uniforms as any).intensity.value = intensity;
    (mat.uniforms as any).power.value = power;
    sword.group.traverse((o)=>{
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) {
        const mesh = new THREE.Mesh(m.geometry, mat);
        mesh.position.copy(m.position);
        mesh.quaternion.copy(m.quaternion);
        mesh.scale.copy(m.scale);
        group.add(mesh);
      }
    });
    return group;
  };

  // Flame aura shader (world-space FBM based, UV-less)
  const FlameAuraShader = {
    uniforms: {
      time: { value: 0 },
      color1: { value: new THREE.Color(0xff5a00) },
      color2: { value: new THREE.Color(0xffe87a) },
      noiseScale: { value: 2.2 },
      speed: { value: 1.5 },
      intensity: { value: 1.0 }
    },
    vertexShader: `
      varying vec3 vWPos; varying vec3 vN;
      void main(){
        vec4 wp = modelMatrix * vec4(position,1.0);
        vWPos = wp.xyz; vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float time, noiseScale, speed, intensity; uniform vec3 color1, color2; varying vec3 vWPos; varying vec3 vN;
      float hash(vec3 p){ p = fract(p*0.3183099 + vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); float n000=hash(i); float n100=hash(i+vec3(1,0,0)); float n010=hash(i+vec3(0,1,0)); float n110=hash(i+vec3(1,1,0)); float n001=hash(i+vec3(0,0,1)); float n101=hash(i+vec3(1,0,1)); float n011=hash(i+vec3(0,1,1)); float n111=hash(i+vec3(1,1,1)); float nx00=mix(n000,n100,f.x); float nx10=mix(n010,n110,f.x); float nx01=mix(n001,n101,f.x); float nx11=mix(n011,n111,f.x); float nxy0=mix(nx00,nx10,f.y); float nxy1=mix(nx01,nx11,f.y); return mix(nxy0,nxy1,f.z); }
      float fbm(vec3 p){ float a=0.0,w=0.5; for(int i=0;i<4;i++){ a+=w*noise(p); p*=2.0; w*=0.5; } return a; }
      void main(){ float f = fbm(vWPos*noiseScale + vec3(0.0, time*speed, 0.0)); float viewEdge = pow(1.0 - max(0.0, dot(normalize(vN), normalize(cameraPosition - vWPos))), 2.0); float glow = smoothstep(0.35, 0.75, f) * (0.6 + 0.4*viewEdge) * intensity; vec3 col = mix(color1, color2, clamp((f-0.35)/0.4, 0.0, 1.0)); gl_FragColor = vec4(col * glow, glow); }
    `
  } as const;

  // Inner Glow (pulsing fresnel-like overlay)
  let innerGlowGroup: THREE.Group | null = null;
  let innerGlowMat: THREE.ShaderMaterial | null = null;
  const innerGlowState = { enabled: false, time: 0.0, speed: 1.5, color: 0x88ccff, iMin: 0.2, iMax: 0.9 };
  const InnerGlowShader = {
    uniforms: { color: { value: new THREE.Color(0x88ccff) }, iMin: { value: 0.2 }, iMax: { value: 0.9 }, time: { value: 0.0 }, speed: { value: 1.5 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vWPos;
      void main(){ vN = normalize(normalMatrix * normal); vec4 wp = modelMatrix * vec4(position,1.0); vWPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
    `,
    fragmentShader: `
      uniform vec3 color; uniform float iMin; uniform float iMax; uniform float time; uniform float speed;
      varying vec3 vN; varying vec3 vWPos;
      void main(){ vec3 V = normalize(cameraPosition - vWPos); float f = pow(1.0 - max(0.0, dot(normalize(vN), V)), 2.0);
        float pulse = 0.5 + 0.5 * sin(time * speed);
        float intens = mix(iMin, iMax, pulse) * f; gl_FragColor = vec4(color * intens, intens);
      }
    `
  } as const;
  const buildInnerGlow = (colorHex: number, iMin: number, iMax: number, speed: number) => {
    const group = new THREE.Group();
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone((InnerGlowShader as any).uniforms),
      vertexShader: (InnerGlowShader as any).vertexShader,
      fragmentShader: (InnerGlowShader as any).fragmentShader,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide
    });
    (mat.uniforms as any).color.value = new THREE.Color(colorHex);
    (mat.uniforms as any).iMin.value = iMin;
    (mat.uniforms as any).iMax.value = iMax;
    (mat.uniforms as any).speed.value = speed;
    innerGlowMat = mat;
    sword.group.traverse((o)=>{ const m = o as THREE.Mesh; if (m.isMesh && m.geometry) {
      const mesh = new THREE.Mesh(m.geometry, mat); mesh.position.copy(m.position); mesh.quaternion.copy(m.quaternion); mesh.scale.copy(m.scale); group.add(mesh);
    }});
    return group;
  };

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
    occlude: true,
  };
  const mistSpawn = { xMin: 0, xMax: 0, yMin: 0, yMax: 0, baseTop: 0, tipBottom: 0, halfT: 0 };
  // Small tileable noise texture for mist alpha breakup
  function makeNoiseTexture(size = 128, seed = 1337) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    let s = seed|0;
    for (let y=0;y<size;y++){
      for (let x=0;x<size;x++){
        let n=0, amp=0.5, f=1;
        for (let o=0;o<3;o++){
          const u = Math.floor((x/size)*16*f), v = Math.floor((y/size)*16*f);
          const h = Math.sin((u*127.1+v*311.7+o*19.19)) * 43758.5453;
          n += (h - Math.floor(h)) * amp; amp *= 0.5; f *= 2.0;
        }
        const val = Math.max(0, Math.min(255, Math.floor(n*255)));
        const i = (y*size + x)*4; img.data[i]=val; img.data[i+1]=val; img.data[i+2]=val; img.data[i+3]=255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinear;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }
  // Lightweight CPU curl noise for mist drift
  function hash3(x:number,y:number,z:number){
    const s = Math.sin(x*12.9898 + y*78.233 + z*37.719)*43758.5453;
    return s - Math.floor(s);
  }
  function noise3(x:number,y:number,z:number){
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf), w = zf*zf*(3-2*zf);
    const n000 = hash3(xi,yi,zi), n100 = hash3(xi+1,yi,zi);
    const n010 = hash3(xi,yi+1,zi), n110 = hash3(xi+1,yi+1,zi);
    const n001 = hash3(xi,yi,zi+1), n101 = hash3(xi+1,yi,zi+1);
    const n011 = hash3(xi,yi+1,zi+1), n111 = hash3(xi+1,yi+1,zi+1);
    const nx00 = n000 + u*(n100 - n000);
    const nx10 = n010 + u*(n110 - n010);
    const nx01 = n001 + u*(n101 - n001);
    const nx11 = n011 + u*(n111 - n011);
    const nxy0 = nx00 + v*(nx10 - nx00);
    const nxy1 = nx01 + v*(nx11 - nx01);
    return nxy0 + w*(nxy1 - nxy0);
  }
  function curlNoise(p: THREE.Vector3){
    const e = 0.1;
    const dx = noise3(p.x+e,p.y,p.z) - noise3(p.x-e,p.y,p.z);
    const dy = noise3(p.x,p.y+e,p.z) - noise3(p.x,p.y-e,p.z);
    const dz = noise3(p.x,p.y,p.z+e) - noise3(p.x,p.y,p.z-e);
    const v = new THREE.Vector3(dy - dz, dz - dx, dx - dy);
    const len = v.length() || 1.0;
    return v.multiplyScalar(1/len);
  }
  const MistShader = {
    uniforms: { uColor: { value: new THREE.Color(0x88aadd) }, uSizeMin: { value: 3.0 }, uSizeMax: { value: 6.0 }, uNoiseTex: { value: null }, uAlphaScale: { value: 0.35 } },
    vertexShader: `
      uniform float uSizeMin; uniform float uSizeMax;
      attribute float aLife; varying float vLife;
      void main(){
        vLife = aLife;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        float bell = clamp(vLife * (1.0 - vLife) * 4.0, 0.0, 1.0);
        float pSize = mix(uSizeMin, uSizeMax, bell);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = pSize * (300.0 / max(1.0, -mv.z));
      }
    `,
    fragmentShader: `
      uniform vec3 uColor; uniform sampler2D uNoiseTex; uniform float uAlphaScale; varying float vLife; 
      void main(){
        vec2 uv = gl_PointCoord; vec2 c = uv - vec2(0.5);
        float r = length(c);
        float soft = smoothstep(0.5, 0.0, r);
        float n = texture2D(uNoiseTex, uv * 2.5).r;
        float fadeIn = smoothstep(0.0, 0.25, vLife);
        float fadeOut = smoothstep(1.0, 0.75, vLife);
        float lifeFade = fadeIn * (1.0 - fadeOut);
        float a = soft * n * lifeFade * uAlphaScale;
        gl_FragColor = vec4(uColor, a);
      }
    `
  } as const;
  const rebuildMist = (count: number) => {
    if (mistPoints) { (mistPoints.parent as any)?.remove(mistPoints); mistGeom?.dispose(); mistPoints = null; mistGeom = null; }
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const aLife = new Float32Array(count);
    const vel = new Float32Array(count * 2);
    // Use blade geometry's local-space bounds for stable spawning
    const bladeGeo = sword.bladeMesh!.geometry as THREE.BufferGeometry;
    bladeGeo.computeBoundingBox();
    const bb = bladeGeo.boundingBox!;
    const yMin = bb.min.y, yMax = bb.max.y; const xMin = bb.min.x, xMax = bb.max.x; const zMin = bb.min.z, zMax = bb.max.z;
    const halfT = Math.max(1e-4, (zMax - zMin) * 0.5);
    // Cache spawn bands/extents
    mistSpawn.xMin = xMin; mistSpawn.xMax = xMax; mistSpawn.yMin = yMin; mistSpawn.yMax = yMax; mistSpawn.halfT = halfT;
    mistSpawn.baseTop = yMin + (yMax - yMin) * 0.2;
    mistSpawn.tipBottom = yMax - (yMax - yMin) * 0.1;
    for (let i=0;i<count;i++) {
      // Default spawn: base region, within inner 50% width
      const xi = THREE.MathUtils.lerp(xMin*0.5, xMax*0.5, Math.random());
      const yi = THREE.MathUtils.lerp(yMin, mistSpawn.baseTop, Math.random());
      const side = Math.random() < 0.5 ? -1 : 1;
      const zi = side * (halfT + 0.02);
      pos[i*3+0]=xi; pos[i*3+1]=yi; pos[i*3+2]=zi; aLife[i] = Math.random();
      vel[i*2+0] = (Math.random()-0.5) * 0.2; vel[i*2+1] = (Math.random()-0.5) * 0.2;
    }
    mistLife = aLife; mistVel = vel; mistGeom = geom;
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('aLife', new THREE.BufferAttribute(aLife, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone((MistShader as any).uniforms),
      vertexShader: (MistShader as any).vertexShader,
      fragmentShader: (MistShader as any).fragmentShader,
      // Use normal blending to avoid bright additive glow at high density
      blending: THREE.NormalBlending,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      premultipliedAlpha: true
    });
    (mat.uniforms as any).uColor.value = new THREE.Color(mistState.color);
    (mat.uniforms as any).uSizeMax.value = mistState.size;
    (mat.uniforms as any).uSizeMin.value = Math.max(0.0, mistState.size * mistState.sizeMinRatio);
    (mat.uniforms as any).uAlphaScale.value = mistState.alphaScale;
    (mat.uniforms as any).uNoiseTex.value = makeNoiseTexture(128);
    mistMat = mat;
    const pts = new THREE.Points(geom, mat);
    sword.bladeMesh!.add(pts);
    mistPoints = pts;
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
  let bladeGradGroup: THREE.Group | null = null;
  const buildBladeGradient = (baseHex: number, edgeHex: number, edgeFade: number, wearAmt: number) => {
    if (!sword.bladeMesh) return null;
    const group = new THREE.Group();
    const g = (sword.bladeMesh.geometry as THREE.BufferGeometry).clone();
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const halfW = Math.max(1e-4, (bb.max.x - bb.min.x) * 0.5);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        baseCol: { value: new THREE.Color(baseHex) },
        edgeCol: { value: new THREE.Color(edgeHex) },
        halfW: { value: halfW },
        edgeFade: { value: Math.max(0.0, Math.min(1.0, edgeFade)) },
        wear: { value: Math.max(0.0, Math.min(1.0, wearAmt)) }
      },
      vertexShader: `
        varying vec3 vPos;
        void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform vec3 baseCol; uniform vec3 edgeCol; uniform float halfW; uniform float edgeFade; uniform float wear;
        varying vec3 vPos;
        // simple hash noise
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        void main(){
          float ax = abs(vPos.x);
          float t = 0.0;
          if (edgeFade <= 0.0001) {
            t = step(halfW*0.98, ax);
          } else {
            float s0 = max(0.0, 1.0 - edgeFade);
            float x = clamp(ax/halfW, 0.0, 1.0);
            t = smoothstep(s0, 1.0, x);
          }
          vec3 tint = mix(baseCol, edgeCol, t);
          // subtle wear: signed noise in [-1,1]
          float n = hash(vPos.xy*7.31) * 2.0 - 1.0;
          float w = wear * n * 0.35;
          vec3 col = tint * (0.35 + w);
          gl_FragColor = vec4(col, 0.9);
        }
      `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      side: THREE.FrontSide
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.copy(sword.bladeMesh.position);
    mesh.quaternion.copy(sword.bladeMesh.quaternion);
    mesh.scale.copy(sword.bladeMesh.scale);
    group.add(mesh);
    return group;
  };

  let currentEnvTex: THREE.Texture | null = null;

  const renderHooks = {
    // Materials
    setPartMaterial: (part: 'blade'|'guard'|'handle'|'pommel', patch: any) => {
      (materials as any)[part] = { ...(materials as any)[part], ...(patch||{}) };
      (scene as any).__materials = materials;
      sword.setMaterials(materials);
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
      if (strength !== undefined) selBloomPass.strength = strength;
      if (threshold !== undefined) selBloomPass.threshold = threshold as any;
      if (radius !== undefined) selBloomPass.radius = radius;
      if (intensity !== undefined) (bloomCompositePass.uniforms as any).intensity.value = intensity;
      // Mark aura for bloom if present, otherwise mark blade
      const target = flameMesh ?? sword.bladeMesh;
      if (target) {
        if (enabled) target.layers.enable(BLOOM_LAYER);
        else target.layers.disable(BLOOM_LAYER);
      }
    },
    markForBloom: (obj: THREE.Object3D, enable = true) => {
      obj.traverse(o => enable ? o.layers.enable(BLOOM_LAYER) : o.layers.disable(BLOOM_LAYER));
    },
    setHeatHaze: (enabled: boolean, distortion?: number) => {
      heatHazeEnabled = enabled; heatHazePass.enabled = enabled;
      if (distortion !== undefined) (heatHazePass.uniforms as any).distortion.value = distortion;
      const target = flameMesh ?? sword.bladeMesh;
      if (target) {
        if (enabled) target.layers.enable(HEAT_LAYER); else target.layers.disable(HEAT_LAYER);
      }
    },
    markForHeat: (obj: THREE.Object3D, enable = true) => {
      obj.traverse(o => enable ? o.layers.enable(HEAT_LAYER) : o.layers.disable(HEAT_LAYER));
    },
    setFlameAura: (enabled: boolean, opts?: { scale?: number; color1?: number; color2?: number; noiseScale?: number; speed?: number; intensity?: number }) => {
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
      fxaa.enabled = (mode === 'fxaa');
      smaa.enabled = (mode === 'smaa');
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
      if (innerGlowGroup) { scene.remove(innerGlowGroup); innerGlowGroup = null; innerGlowMat = null; }
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
    setPartBump: (part: 'blade'|'guard'|'handle'|'pommel', enabled: boolean, bumpScale?: number, noiseScale?: number, seed?: number) => {
      const makeNoiseTexture = (scale = 8, seedVal = 1337) => {
        const size = 256;
        const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        // seeded PRNG
        let s = seedVal | 0; const rnd = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return ((s>>>0) % 1000000) / 1000000; };
        const img = ctx.createImageData(size, size);
        for (let y=0; y<size; y++) {
          for (let x=0; x<size; x++) {
            const nx = (x/size) * scale, ny = (y/size) * scale;
            // simple value noise: 3 octave hash-based noise
            const h = (u:number,v:number) => { const n = Math.sin(u*12.9898+v*78.233)*43758.5453; return n - Math.floor(n); };
            let n = 0, amp = 1, freq = 1;
            for (let o=0;o<3;o++){ n += h(Math.floor(nx*freq)+o*7, Math.floor(ny*freq)+o*19) * amp; amp *= 0.5; freq *= 2; }
            const v = Math.max(0, Math.min(255, Math.floor(n * 255)));
            const idx = (y*size + x)*4; img.data[idx]=v; img.data[idx+1]=v; img.data[idx+2]=v; img.data[idx+3]=255;
          }
        }
        ctx.putImageData(img, 0, 0);
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.needsUpdate = true;
        return tex;
      };
      const apply = (obj?: THREE.Object3D|null) => {
        if (!obj) return; obj.traverse((o)=>{
          const mat = (o as any).material as any; if (!mat) return;
          if (enabled) {
            mat.bumpMap = makeNoiseTexture(noiseScale ?? 8, seed ?? 1337);
            mat.bumpScale = (bumpScale ?? 0.02);
          } else {
            mat.bumpMap = null; mat.bumpScale = 0;
          }
          mat.needsUpdate = true;
        });
      };
      if (part === 'blade') apply(sword.bladeMesh);
      if (part === 'guard') { apply(sword.guardMesh); apply((sword as any)['guardGroup']); }
      if (part === 'handle') apply(sword.handleMesh);
      if (part === 'pommel') apply(sword.pommelMesh);
    },
    // Blade gradient/wear overlay (visible, no z-fight)
    setBladeGradientWear: (() => {
      let gwGroup: THREE.Group | null = null;
      let gwLast: { enabled: boolean; base: number; edge: number; edgeFade: number; wear: number } | null = null;
      const build = (base: number, edge: number, edgeFade: number, wear: number) => {
        if (!sword.bladeMesh) return null;
        const geomSrc = sword.bladeMesh.geometry as THREE.BufferGeometry;
        const geom = geomSrc.clone();
        geom.computeBoundingBox();
        const bb = geom.boundingBox!;
        const yMin = bb.min.y, yMax = bb.max.y;
        const totalHalfW = Math.max(1e-6, (bb.max.x - bb.min.x) * 0.5);
        // Per-row centerline and half-width for mathematically stable edge fade
        const pos = geom.getAttribute('position') as THREE.BufferAttribute;
        const N = pos.count; const arr = pos.array as unknown as number[];
        const buckets = new Map<number, { minX: number; maxX: number }>();
        const q = 10000; // quantize Y to 1e-4
        for (let i = 0; i < N; i++) {
          const x = arr[i*3+0], y = arr[i*3+1];
          const key = Math.round(y * q);
          let b = buckets.get(key);
          if (!b) { b = { minX: Infinity, maxX: -Infinity }; buckets.set(key, b); }
          if (x < b.minX) b.minX = x; if (x > b.maxX) b.maxX = x;
        }
        const aCenter = new Float32Array(N);
        const aHalfW = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          const x = arr[i*3+0], y = arr[i*3+1];
          const key = Math.round(y * q);
          const b = buckets.get(key)!;
          const c = (b.minX + b.maxX) * 0.5;
          const h = Math.max(1e-6, (b.maxX - b.minX) * 0.5);
          aCenter[i] = c; aHalfW[i] = h;
        }
        geom.setAttribute('aCenter', new THREE.BufferAttribute(aCenter, 1));
        geom.setAttribute('aHalfW', new THREE.BufferAttribute(aHalfW, 1));
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uBase: { value: new THREE.Color(base) },
            uEdge: { value: new THREE.Color(edge) },
            uYMin: { value: yMin },
            uYMax: { value: yMax },
            uHalfWGlobal: { value: totalHalfW },
            uEdgeFade: { value: edgeFade },
            uWear: { value: wear }
          },
          vertexShader: `
            attribute float aCenter; attribute float aHalfW;
            varying vec3 vPos; varying float vCenter; varying float vHalfW;
            void main(){ vPos = position; vCenter = aCenter; vHalfW = aHalfW; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
          `,
          fragmentShader: `
            uniform vec3 uBase; uniform vec3 uEdge; uniform float uYMin; uniform float uYMax; uniform float uHalfWGlobal; uniform float uEdgeFade; uniform float uWear;
            varying vec3 vPos; varying float vCenter; varying float vHalfW;
            float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
            void main(){
              // Length gradient along local Y
              float tLen = clamp((vPos.y - uYMin) / max(1e-6, (uYMax - uYMin)), 0.0, 1.0);
              vec3 col = mix(uBase, uEdge, tLen);
              // Edge fade across local X
              float halfW = max(1e-6, vHalfW);
              float xN = clamp(abs(vPos.x - vCenter) / halfW, 0.0, 1.0);
              float fade = (uEdgeFade <= 0.0001) ? step(0.98, xN) : smoothstep(1.0 - uEdgeFade, 1.0, xN);
              // Wear noise in object space
              float n = hash(vPos.xz*4.0);
              col *= mix(1.0, 0.7 + 0.3*n, uWear * fade);
              gl_FragColor = vec4(col, 0.45);
            }
          `,
          transparent: true,
          depthWrite: false,
          depthTest: true,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide
        });
        const copy = new THREE.Mesh(geom, mat);
        // Parent to blade mesh so transform stays locked
        copy.position.set(0,0,0);
        copy.quaternion.identity();
        copy.scale.set(1,1,1);
        const g = new THREE.Group(); g.add(copy);
        sword.bladeMesh.add(g);
        return g;
      };
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
      // Traverse materials and set envMapIntensity where supported
      sword.group.traverse((o) => {
        const m = (o as any).material as THREE.Material | THREE.Material[] | undefined;
        const apply = (mat: any) => { if (mat && 'envMapIntensity' in mat) mat.envMapIntensity = v; };
        if (Array.isArray(m)) m.forEach(apply); else apply(m);
      });
    },
    // Material base controls per part
    setPartColor: (part: 'blade'|'guard'|'handle'|'pommel', hex: number) => {
      const apply = (mesh?: THREE.Object3D | null) => {
        if (!mesh) return;
        mesh.traverse((o) => {
          const m = (o as any).material as any;
          if (m && m.color) m.color.setHex(hex);
        });
      };
      if (part === 'blade') apply(sword.bladeMesh);
      if (part === 'guard') { apply(sword.guardMesh); apply((sword as any).guardGroup); }
      if (part === 'handle') apply(sword.handleMesh);
      if (part === 'pommel') apply(sword.pommelMesh);
    },
    setPartMetalness: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => {
      const apply = (mesh?: THREE.Object3D | null) => {
        if (!mesh) return; mesh.traverse((o)=>{ const m = (o as any).material as any; if (m && 'metalness' in m) m.metalness = v; });
      };
      if (part === 'blade') apply(sword.bladeMesh);
      if (part === 'guard') { apply(sword.guardMesh); apply((sword as any).guardGroup); }
      if (part === 'handle') apply(sword.handleMesh);
      if (part === 'pommel') apply(sword.pommelMesh);
    },
    setPartRoughness: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => {
      const apply = (mesh?: THREE.Object3D | null) => {
        if (!mesh) return; mesh.traverse((o)=>{ const m = (o as any).material as any; if (m && 'roughness' in m) m.roughness = v; });
      };
      if (part === 'blade') apply(sword.bladeMesh);
      if (part === 'guard') { apply(sword.guardMesh); apply((sword as any).guardGroup); }
      if (part === 'handle') apply(sword.handleMesh);
      if (part === 'pommel') apply(sword.pommelMesh);
    },
    setPartClearcoat: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => {
      const apply = (mesh?: THREE.Object3D | null) => {
        if (!mesh) return; mesh.traverse((o)=>{ const m = (o as any).material as any; if (m && 'clearcoat' in m) m.clearcoat = v; });
      };
      if (part === 'blade') apply(sword.bladeMesh);
      if (part === 'guard') { apply(sword.guardMesh); apply((sword as any).guardGroup); }
      if (part === 'handle') apply(sword.handleMesh);
      if (part === 'pommel') apply(sword.pommelMesh);
    },
    setPartClearcoatRoughness: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => {
      const apply = (mesh?: THREE.Object3D | null) => {
        if (!mesh) return; mesh.traverse((o)=>{ const m = (o as any).material as any; if (m && 'clearcoatRoughness' in m) m.clearcoatRoughness = v; });
      };
      if (part === 'blade') apply(sword.bladeMesh);
      if (part === 'guard') { apply(sword.guardMesh); apply((sword as any).guardGroup); }
      if (part === 'handle') apply(sword.handleMesh);
      if (part === 'pommel') apply(sword.pommelMesh);
    },
    setDPRCap: (cap: number) => {
      (renderer as any)._dprCap = cap;
      // Trigger an immediate resize update via window event would happen in main.
      // We also ensure passes get updated.
      updateFXAA();
    }
  };
  (scene as any).__renderHooks = renderHooks;

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

  const preFX = () => { preRenderBloom(); renderHeatMask(); };
  return { renderer, scene, camera, controls, composer, dispose, updateFXAA, renderHooks, preFX } as any;
}

// placeholder builder removed (replaced by SwordGenerator)
