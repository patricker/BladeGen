import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SwordGenerator, defaultSwordParams } from './SwordGenerator';

export function setupScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(0x0f1115);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  // Camera
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(3, 2, 5);

  // Controls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.target.set(0, 1, 0);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const dir1 = new THREE.DirectionalLight(0xffffff, 1.0);
  dir1.position.set(5, 10, 7);
  scene.add(dir1);
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.4);
  dir2.position.set(-6, 3, -4);
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
  scene.add(sword.group);

  // Simple rotation to show life
  const clock = new THREE.Clock();
  const bbox = new THREE.Box3();
  const tick = () => {
    const t = clock.getElapsedTime();
    sword.group.rotation.y = t * 0.25;
    sword.group.position.y = 0.0;
    // Keep ground slightly below sword's lowest point to avoid occlusion
    bbox.setFromObject(sword.group);
    if (isFinite(bbox.min.y)) {
      ground.position.y = bbox.min.y - 0.02;
    }
  };
  renderer.setAnimationLoop(tick);

  const dispose = () => {
    renderer.setAnimationLoop(null);
    groundGeo.dispose();
    groundMat.dispose();
    sword.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose?.();
        if ((mesh.material as any)?.dispose) (mesh.material as any).dispose();
      }
    });
  };

  return { renderer, scene, camera, controls, dispose };
}

// placeholder builder removed (replaced by SwordGenerator)
