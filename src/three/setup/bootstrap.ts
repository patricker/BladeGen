import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface BackgroundState {
  base: THREE.Color;
  target: THREE.Color;
  getBrightness: () => number;
  setBrightness: (v: number) => void;
  apply: () => void;
  groundMaterial: THREE.MeshStandardMaterial;
}

export interface BootstrapContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  pmrem: THREE.PMREMGenerator;
  envTexture: THREE.Texture;
  background: BackgroundState;
  ground: THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial>;
  groundClearance: { value: number };
}

export function createBootstrap(canvas: HTMLCanvasElement): BootstrapContext {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  const bgBase = new THREE.Color(0x0f1115);
  const bgTarget = new THREE.Color(0x3a3f4a);
  let bgBrightness = 0.0;

  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1d24, metalness: 0.0, roughness: 1.0 });
  const applyBackground = () => {
    const c = bgBase.clone();
    c.lerp(bgTarget, THREE.MathUtils.clamp(bgBrightness, 0, 1));
    renderer.setClearColor(c);
    const floor = c.clone();
    floor.lerp(new THREE.Color(0x000000), 0.4);
    groundMaterial.color.copy(floor);
    groundMaterial.needsUpdate = true;
  };

  applyBackground();

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new RoomEnvironment();
  const envTexture = pmrem.fromScene(env, 0.04).texture;
  scene.environment = envTexture;

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(3, 2, 5);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.target.set(0, 1, 0);

  const groundGeometry = new THREE.CircleGeometry(20, 64);
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  const groundClearance = { value: 0.08 };
  ground.position.y = -groundClearance.value;
  ground.receiveShadow = true;
  scene.add(ground);

  const background: BackgroundState = {
    base: bgBase,
    target: bgTarget,
    getBrightness: () => bgBrightness,
    setBrightness: (v: number) => { bgBrightness = v; },
    apply: applyBackground,
    groundMaterial
  };

  // Ensure tint sync on boot
  background.apply();

  return {
    renderer,
    scene,
    camera,
    controls,
    pmrem,
    envTexture,
    background,
    ground,
    groundClearance
  };
}
