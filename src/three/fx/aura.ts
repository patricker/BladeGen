import * as THREE from 'three';
import { FlameAuraShader } from './shaders';

export type FlameAuraOptions = {
  scale?: number;
  color1?: number;
  color2?: number;
  noiseScale?: number;
  speed?: number;
  intensity?: number;
  /** Direction of flame flow along Y: 'up' or 'down'. Defaults to 'up'. */
  direction?: 'up' | 'down';
  /** Blending mode: 'add' (brighten), 'normal' (allows darkening e.g. black flames), or 'multiply'. Default 'add'. */
  blend?: 'add' | 'normal' | 'multiply';
};

/** Build a flame aura mesh cloned from the blade geometry with shader material. */
export function buildFlameAura(bladeMesh: THREE.Mesh, opts: FlameAuraOptions = {}) {
  const {
    scale = 1.05,
    color1 = 0xff5a00,
    color2 = 0xffe87a,
    noiseScale = 2.2,
    speed = 1.5,
    intensity = 1.0,
    direction = 'up',
    blend = 'add',
  } = opts;
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone((FlameAuraShader as any).uniforms),
    vertexShader: (FlameAuraShader as any).vertexShader,
    fragmentShader: (FlameAuraShader as any).fragmentShader,
    blending:
      blend === 'normal'
        ? THREE.NormalBlending
        : blend === 'multiply'
          ? THREE.MultiplyBlending
          : THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  (mat.uniforms as any).color1.value = new THREE.Color(color1);
  (mat.uniforms as any).color2.value = new THREE.Color(color2);
  (mat.uniforms as any).noiseScale.value = noiseScale;
  // Positive speed should correspond to visually rising flames ('up')
  // If direction is 'down', invert to flow downward
  const dirSign = direction === 'down' ? 1.0 : -1.0;
  (mat.uniforms as any).speed.value = Math.abs(speed) * dirSign;
  (mat.uniforms as any).intensity.value = intensity;
  const geom = (bladeMesh.geometry as THREE.BufferGeometry).clone();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.copy(bladeMesh.scale).multiplyScalar(scale);
  return { mesh, material: mat };
}
