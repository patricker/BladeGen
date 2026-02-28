import * as THREE from 'three';
import { FresnelShader } from './shaders';

/** Build a back-face ink outline clone group of the given source object. */
export function buildInkOutline(source: THREE.Object3D, scale: number, colorHex: number) {
  const group = new THREE.Group();
  const outlineMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.BackSide });
  source.traverse((o) => {
    const m = o as THREE.Mesh;
    if ((m as any).isMesh && m.geometry) {
      const om = new THREE.Mesh(m.geometry.clone() as any, outlineMat);
      om.position.copy(m.position);
      om.quaternion.copy(m.quaternion);
      om.scale.copy(m.scale).multiplyScalar(1 + scale);
      group.add(om);
    }
  });
  return group;
}

/** Build a fresnel additive overlay clone group of the source object. */
export function buildFresnel(
  source: THREE.Object3D,
  col: number,
  intensity: number,
  power: number
) {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone((FresnelShader as any).uniforms),
    vertexShader: (FresnelShader as any).vertexShader,
    fragmentShader: (FresnelShader as any).fragmentShader,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  (mat.uniforms as any).color.value = new THREE.Color(col);
  (mat.uniforms as any).intensity.value = intensity;
  (mat.uniforms as any).power.value = power;
  source.traverse((o) => {
    const m = o as THREE.Mesh;
    if ((m as any).isMesh && m.geometry) {
      const mesh = new THREE.Mesh(m.geometry.clone() as any, mat);
      mesh.position.copy(m.position);
      mesh.quaternion.copy(m.quaternion);
      mesh.scale.copy(m.scale);
      group.add(mesh);
    }
  });
  return group;
}

/** Build a blade gradient/wear overlay based on a source geometry’s width. */
export function buildBladeGradientOverlay(
  source: THREE.Mesh,
  baseHex: number,
  edgeHex: number,
  edgeFade: number,
  wearAmt: number
) {
  const g = (source.geometry as THREE.BufferGeometry).clone();
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const halfW = Math.max(1e-4, (bb.max.x - bb.min.x) * 0.5);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      baseCol: { value: new THREE.Color(baseHex) },
      edgeCol: { value: new THREE.Color(edgeHex) },
      halfW: { value: halfW },
      edgeFade: { value: Math.max(0.0, Math.min(1.0, edgeFade)) },
      wear: { value: Math.max(0.0, Math.min(1.0, wearAmt)) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      uniform vec3 baseCol; uniform vec3 edgeCol; uniform float halfW; uniform float edgeFade; uniform float wear;
      varying vec3 vPos;
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
        float n = hash(vPos.xy*7.31) * 2.0 - 1.0;
        float w = wear * n * 0.35;
        vec3 col = tint * (0.35 + w);
        gl_FragColor = vec4(col, 0.9);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.copy(source.position);
  mesh.quaternion.copy(source.quaternion);
  mesh.scale.copy(source.scale);
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

/**
 * Build a blade gradient/wear overlay that uses per-row centerline and half-width
 * attributes to compute edge fades more robustly across variable widths.
 */
export function buildBladeGradientWearOverlay(
  source: THREE.Mesh,
  baseHex: number,
  edgeHex: number,
  edgeFade: number,
  wear: number
) {
  const geomSrc = source.geometry as THREE.BufferGeometry;
  const geom = geomSrc.clone();
  geom.computeBoundingBox();
  const bb = geom.boundingBox!;
  const yMin = bb.min.y,
    yMax = bb.max.y;
  const totalHalfW = Math.max(1e-6, (bb.max.x - bb.min.x) * 0.5);
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const N = pos.count;
  const arr = pos.array as unknown as number[];
  const buckets = new Map<number, { minX: number; maxX: number }>();
  const q = 10000;
  for (let i = 0; i < N; i++) {
    const x = arr[i * 3 + 0],
      y = arr[i * 3 + 1];
    const key = Math.round(y * q);
    let b = buckets.get(key);
    if (!b) {
      b = { minX: Infinity, maxX: -Infinity };
      buckets.set(key, b);
    }
    if (x < b.minX) b.minX = x;
    if (x > b.maxX) b.maxX = x;
  }
  const aCenter = new Float32Array(N);
  const aHalfW = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const y = arr[i * 3 + 1];
    const key = Math.round(y * q);
    const b = buckets.get(key)!;
    const c = (b.minX + b.maxX) * 0.5;
    const h = Math.max(1e-6, (b.maxX - b.minX) * 0.5);
    aCenter[i] = c;
    aHalfW[i] = h;
  }
  geom.setAttribute('aCenter', new THREE.BufferAttribute(aCenter, 1));
  geom.setAttribute('aHalfW', new THREE.BufferAttribute(aHalfW, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color(baseHex) },
      uEdge: { value: new THREE.Color(edgeHex) },
      uYMin: { value: yMin },
      uYMax: { value: yMax },
      uHalfWGlobal: { value: totalHalfW },
      uEdgeFade: { value: edgeFade },
      uWear: { value: wear },
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
        float tLen = clamp((vPos.y - uYMin) / max(1e-6, (uYMax - uYMin)), 0.0, 1.0);
        vec3 col = mix(uBase, uEdge, tLen);
        float halfW = max(1e-6, vHalfW);
        float xN = clamp(abs(vPos.x - vCenter) / halfW, 0.0, 1.0);
        float fade = (uEdgeFade <= 0.0001) ? step(0.98, xN) : smoothstep(1.0 - uEdgeFade, 1.0, xN);
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
    side: THREE.DoubleSide,
  });
  const copy = new THREE.Mesh(geom, mat);
  copy.position.set(0, 0, 0);
  copy.quaternion.identity();
  copy.scale.set(1, 1, 1);
  const group = new THREE.Group();
  group.add(copy);
  source.add(group);
  return group;
}
