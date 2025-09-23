import * as THREE from 'three';
import { MistShader } from './shaders';

/** Tileable noise texture for mist alpha breakup. */
export function makeMistNoiseTexture(size = 128, seed = 1337) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let n = 0,
        amp = 0.5,
        f = 1;
      for (let o = 0; o < 3; o++) {
        const u = Math.floor((x / size) * 16 * f),
          v = Math.floor((y / size) * 16 * f);
        const h = Math.sin(u * 127.1 + v * 311.7 + o * 19.19) * 43758.5453;
        n += (h - Math.floor(h)) * amp;
        amp *= 0.5;
        f *= 2.0;
      }
      const val = Math.max(0, Math.min(255, Math.floor(n * 255)));
      const i = (y * size + x) * 4;
      img.data[i] = val;
      img.data[i + 1] = val;
      img.data[i + 2] = val;
      img.data[i + 3] = 255;
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

export type MistState = {
  color: number;
  speed: number;
  spread: number;
  size: number;
  sizeMinRatio: number;
  lifeRate: number;
  noiseAmp: number;
  noiseFreqX: number;
  noiseFreqZ: number;
  alphaScale: number;
  windX: number;
  windZ: number;
  emission: 'base' | 'edge' | 'tip' | 'full';
};

export type MistSpawn = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  baseTop: number;
  tipBottom: number;
  halfT: number;
};

// Lightweight CPU curl noise for mist drift
function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}
function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const xf = x - xi,
    yf = y - yi,
    zf = z - zi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf),
    w = zf * zf * (3 - 2 * zf);
  const n000 = hash3(xi, yi, zi),
    n100 = hash3(xi + 1, yi, zi);
  const n010 = hash3(xi, yi + 1, zi),
    n110 = hash3(xi + 1, yi + 1, zi);
  const n001 = hash3(xi, yi, zi + 1),
    n101 = hash3(xi + 1, yi, zi + 1);
  const n011 = hash3(xi, yi + 1, zi + 1),
    n111 = hash3(xi + 1, yi + 1, zi + 1);
  const nx00 = n000 + u * (n100 - n000);
  const nx10 = n010 + u * (n110 - n010);
  const nx01 = n001 + u * (n101 - n001);
  const nx11 = n011 + u * (n111 - n011);
  const nxy0 = nx00 + v * (nx10 - nx00);
  const nxy1 = nx01 + v * (nx11 - nx01);
  return nxy0 + w * (nxy1 - nxy0);
}
export function curlNoise(p: THREE.Vector3) {
  const e = 0.1;
  const dx = noise3(p.x + e, p.y, p.z) - noise3(p.x - e, p.y, p.z);
  const dy = noise3(p.x, p.y + e, p.z) - noise3(p.x, p.y - e, p.z);
  const dz = noise3(p.x, p.y, p.z + e) - noise3(p.x, p.y, p.z - e);
  const v = new THREE.Vector3(dy - dz, dz - dx, dx - dy);
  const len = v.length() || 1.0;
  return v.multiplyScalar(1 / len);
}

/** Update mist positions and life, respawning particles according to spawn settings. */
export function updateMistPositions(
  geom: THREE.BufferGeometry,
  arrays: { life: Float32Array; vel: Float32Array },
  state: MistState,
  dt: number,
  elapsed: number,
  spawn: MistSpawn
) {
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const n = pos.count;
  const yMax = spawn.yMax;
  for (let i = 0; i < n; i++) {
    const ix = i * 3,
      iv = i * 2;
    let x = (pos.array as any)[ix + 0] as number;
    let y = (pos.array as any)[ix + 1] as number;
    let z = (pos.array as any)[ix + 2] as number;
    const baseVx = arrays.vel[iv + 0] * state.spread;
    const baseVz = arrays.vel[iv + 1] * state.spread;
    const waveX = Math.sin(elapsed * state.noiseFreqX + i * 0.19) * state.noiseAmp;
    const waveZ = Math.cos(elapsed * state.noiseFreqZ + i * 0.31) * state.noiseAmp;
    const curl = curlNoise(new THREE.Vector3(x * 0.75, (y + elapsed) * 0.5, z * 0.75));
    x += (baseVx + waveX + state.windX + curl.x * 0.35) * dt;
    z += (baseVz + waveZ + state.windZ + curl.z * 0.35) * dt;
    y += state.speed * dt + curl.y * 0.35 * dt;
    let life = arrays.life[i] + dt * state.lifeRate;
    if (y > yMax || life >= 1.0) {
      const edgeJitter = (spawn.xMax - spawn.xMin) * 0.02;
      if (state.emission === 'edge') {
        const side = Math.random() < 0.5 ? -1 : 1;
        const xEdge = side < 0 ? spawn.xMin * 0.98 : spawn.xMax * 0.98;
        x = xEdge + (Math.random() - 0.5) * edgeJitter;
        y = THREE.MathUtils.lerp(spawn.yMin, spawn.baseTop, Math.random());
        z = side * (spawn.halfT + 0.02);
      } else if (state.emission === 'tip') {
        x = THREE.MathUtils.lerp(spawn.xMin * 0.5, spawn.xMax * 0.5, Math.random());
        y = THREE.MathUtils.lerp(spawn.tipBottom, spawn.yMax, Math.random());
        const side = Math.random() < 0.5 ? -1 : 1;
        z = side * (spawn.halfT + 0.02);
      } else if (state.emission === 'full') {
        x = THREE.MathUtils.lerp(spawn.xMin * 0.5, spawn.xMax * 0.5, Math.random());
        y = THREE.MathUtils.lerp(spawn.yMin, spawn.yMax, Math.random());
        const side = Math.random() < 0.5 ? -1 : 1;
        z = side * (spawn.halfT + 0.02);
      } else {
        // base
        x = THREE.MathUtils.lerp(spawn.xMin * 0.5, spawn.xMax * 0.5, Math.random());
        y = THREE.MathUtils.lerp(spawn.yMin, spawn.baseTop, Math.random());
        const side = Math.random() < 0.5 ? -1 : 1;
        z = side * (spawn.halfT + 0.02);
      }
      arrays.vel[iv + 0] = (Math.random() - 0.5) * 0.2;
      arrays.vel[iv + 1] = (Math.random() - 0.5) * 0.2;
      life = 0.0;
    }
    (pos.array as any)[ix + 0] = x;
    (pos.array as any)[ix + 1] = y;
    (pos.array as any)[ix + 2] = z;
    arrays.life[i] = life;
  }
  pos.needsUpdate = true;
  const aLifeAttr = geom.getAttribute('aLife') as THREE.BufferAttribute;
  aLifeAttr.needsUpdate = true;
}

/** Build mist points over a blade mesh with initial spawn and configured state. */
export function buildMist(bladeMesh: THREE.Mesh, count: number, state: MistState) {
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const life = new Float32Array(count);
  const vel = new Float32Array(count * 2);
  const bladeGeo = bladeMesh.geometry as THREE.BufferGeometry;
  bladeGeo.computeBoundingBox();
  const bb = bladeGeo.boundingBox!;
  const yMin = bb.min.y,
    yMax = bb.max.y;
  const xMin = bb.min.x,
    xMax = bb.max.x;
  const zMin = bb.min.z,
    zMax = bb.max.z;
  const halfT = Math.max(1e-4, (zMax - zMin) * 0.5);
  const spawn: MistSpawn = {
    xMin,
    xMax,
    yMin,
    yMax,
    halfT,
    baseTop: yMin + (yMax - yMin) * 0.2,
    tipBottom: yMax - (yMax - yMin) * 0.1,
  };
  for (let i = 0; i < count; i++) {
    const xi = THREE.MathUtils.lerp(xMin * 0.5, xMax * 0.5, Math.random());
    const yi = THREE.MathUtils.lerp(yMin, spawn.baseTop, Math.random());
    const side = Math.random() < 0.5 ? -1 : 1;
    const zi = side * (halfT + 0.02);
    pos[i * 3 + 0] = xi;
    pos[i * 3 + 1] = yi;
    pos[i * 3 + 2] = zi;
    life[i] = Math.random();
    vel[i * 2 + 0] = (Math.random() - 0.5) * 0.2;
    vel[i * 2 + 1] = (Math.random() - 0.5) * 0.2;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone((MistShader as any).uniforms),
    vertexShader: (MistShader as any).vertexShader,
    fragmentShader: (MistShader as any).fragmentShader,
    blending: THREE.NormalBlending,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    premultipliedAlpha: false,
  });
  (mat as any).depthTest = (state as any).occlude !== undefined ? !!(state as any).occlude : true;
  (mat.uniforms as any).uColor.value = new THREE.Color(state.color);
  (mat.uniforms as any).uSizeMax.value = state.size;
  (mat.uniforms as any).uSizeMin.value = Math.max(0.0, state.size * state.sizeMinRatio);
  (mat.uniforms as any).uAlphaScale.value = state.alphaScale;
  (mat.uniforms as any).uNoiseTex.value = makeMistNoiseTexture(128);
  const points = new THREE.Points(geom, mat);
  // Avoid any chance of frustum culling hiding the mist when bounding info is stale
  try {
    geom.computeBoundingSphere();
  } catch {}
  (points as any).frustumCulled = false;
  return { points, geom, material: mat, arrays: { life, vel }, spawn };
}
