import * as THREE from 'three';

export interface LightingContext {
  ambient: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
}

export function createLighting(scene: THREE.Scene): LightingContext {
  const ambient = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(6, 10, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.03;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(-8, 4, -8);
  scene.add(rim);

  return { ambient, key, rim };
}
