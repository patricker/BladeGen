import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SwordGenerator, defaultSwordParams } from './SwordGenerator';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

export function setupScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  const bgBase = new THREE.Color(0x0f1115);
  let bgBrightness = 0.0; // 0 extra -> dark; increase to lighten
  const applyBackground = () => {
    const c = bgBase.clone();
    // lighten toward #3a3f4a by bgBrightness
    const target = new THREE.Color(0x3a3f4a);
    c.lerp(target, THREE.MathUtils.clamp(bgBrightness, 0, 1));
    renderer.setClearColor(c);
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
  let spinEnabled = true;
  controls.addEventListener('start', () => { spinEnabled = false; });
  controls.addEventListener('end', () => { setTimeout(() => { spinEnabled = true; }, 600); });
  canvas.addEventListener('wheel', () => { spinEnabled = false; clearTimeout((canvas as any).__wheelTO); (canvas as any).__wheelTO = setTimeout(()=>{ spinEnabled = true; }, 600); }, { passive: true });

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
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, metalness: 0.0, roughness: 1.0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  // Sword generator demo
  const sword = new SwordGenerator(defaultSwordParams());
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
  const tick = () => {
    const t = clock.getElapsedTime();
    if (spinEnabled) sword.group.rotation.y = t * 0.25;
    sword.group.position.y = 0.0;
    // Keep ground slightly below sword's lowest point to avoid occlusion
    bbox.setFromObject(sword.group);
    if (isFinite(bbox.min.y)) {
      ground.position.y = bbox.min.y - 0.02;
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
  };
  updateFXAA();
  composer.addPass(fxaa);
  composer.addPass(smaa);
  smaa.enabled = false;

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

  const renderHooks = {
    setExposure: (v: number) => { renderer.toneMappingExposure = v; },
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
    setBackgroundColor: (hex: number) => { bgBase.setHex(hex); applyBackground(); },
    setBackgroundBrightness: (v: number) => { bgBrightness = v; applyBackground(); },
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
        scene.remove(inkOutlineGroup);
        inkOutlineGroup.traverse((o)=>{
          const m = o as THREE.Mesh; if (m.isMesh) { (m.geometry as any) = null; }
        });
        inkOutlineGroup = null;
      }
      if (enabled) {
        const s = Math.max(0.0, Math.min(0.2, (thickness ?? 0.02)));
        const color = colorHex ?? 0x000000;
        inkOutlineGroup = buildInkOutline(s, color);
        scene.add(inkOutlineGroup);
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
      if (part === 'guard') { apply(sword.guardMesh); apply(sword as any)['guardGroup']; }
      if (part === 'handle') apply(sword.handleMesh);
      if (part === 'pommel') apply(sword.pommelMesh);
    },
    setPartMetalness: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => {
      const apply = (mesh?: THREE.Object3D | null) => {
        if (!mesh) return; mesh.traverse((o)=>{ const m = (o as any).material as any; if (m && 'metalness' in m) m.metalness = v; });
      };
      if (part === 'blade') apply(sword.bladeMesh);
      if (part === 'guard') { apply(sword.guardMesh); apply(sword as any)['guardGroup']; }
      if (part === 'handle') apply(sword.handleMesh);
      if (part === 'pommel') apply(sword.pommelMesh);
    },
    setPartRoughness: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => {
      const apply = (mesh?: THREE.Object3D | null) => {
        if (!mesh) return; mesh.traverse((o)=>{ const m = (o as any).material as any; if (m && 'roughness' in m) m.roughness = v; });
      };
      if (part === 'blade') apply(sword.bladeMesh);
      if (part === 'guard') { apply(sword.guardMesh); apply(sword as any)['guardGroup']; }
      if (part === 'handle') apply(sword.handleMesh);
      if (part === 'pommel') apply(sword.pommelMesh);
    },
    setPartClearcoat: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => {
      const apply = (mesh?: THREE.Object3D | null) => {
        if (!mesh) return; mesh.traverse((o)=>{ const m = (o as any).material as any; if (m && 'clearcoat' in m) m.clearcoat = v; });
      };
      if (part === 'blade') apply(sword.bladeMesh);
      if (part === 'guard') { apply(sword.guardMesh); apply(sword as any)['guardGroup']; }
      if (part === 'handle') apply(sword.handleMesh);
      if (part === 'pommel') apply(sword.pommelMesh);
    },
    setPartClearcoatRoughness: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => {
      const apply = (mesh?: THREE.Object3D | null) => {
        if (!mesh) return; mesh.traverse((o)=>{ const m = (o as any).material as any; if (m && 'clearcoatRoughness' in m) m.clearcoatRoughness = v; });
      };
      if (part === 'blade') apply(sword.bladeMesh);
      if (part === 'guard') { apply(sword.guardMesh); apply(sword as any)['guardGroup']; }
      if (part === 'handle') apply(sword.handleMesh);
      if (part === 'pommel') apply(sword.pommelMesh);
    },
    setDPRCap: (cap: number) => {
      (renderer.userData as any).dprCap = cap;
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

  return { renderer, scene, camera, controls, composer, dispose, updateFXAA, renderHooks } as any;
}

// placeholder builder removed (replaced by SwordGenerator)
