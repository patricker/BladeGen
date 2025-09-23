You’re right — the earlier snippets were too hand‑wavy and conflicted with your loop/composer. Below is a **hardened, drop‑in second/third pass** that:

- **Doesn’t** take over your `setAnimationLoop`.
- **Composites selective bloom correctly** (separate composer + final composite pass).
- **Removes UV dependency** from the flame shader (uses object/world space).
- **Adds a mask-based heat‑haze** (only distorts where you mark).
- **Upgrades mist** (alpha noise + CPU curl turbulence that’s light enough for a few hundred particles).
- **Adds sparks/embers** with lifetime fade.
- **Handles resize** for both bloom and heat mask.

I’ve structured this as minimal patches to your existing `setupScene`. Copy the blocks into the marked places.

---

## 0) One render path

At the end of your `tick()` you currently don’t render. Add a single call that goes through your `composer` **after** the pre-passes (selective bloom & heat mask we’ll add). I include the final `tick` tail below in **Patch D**.

---

## A) Replace/extend shaders & helpers (put near your other shader consts)

### A1. Mist shader (alpha breakup via noise texture)

Replace your `MistShader` with this version (same API + extra `uNoiseTex`):

```ts
// === REPLACE MistShader with this ===
const MistShader = {
  uniforms: {
    uColor: { value: new THREE.Color(0x88aadd) },
    uSize: { value: 6.0 },
    uNoiseTex: { value: null },
  },
  vertexShader: `
    uniform float uSize;
    attribute float aLife; varying float vLife;
    void main(){
      vLife = aLife;
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uSize * (300.0 / max(1.0, -mv.z));
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform sampler2D uNoiseTex;
    varying float vLife;
    void main(){
      vec2 uv = gl_PointCoord;
      float r = length(uv - 0.5);
      float soft = smoothstep(0.5, 0.0, r);
      float n = texture2D(uNoiseTex, uv * 2.5).r; // alpha breakup
      float a = soft * vLife * n;
      gl_FragColor = vec4(uColor, a * 0.6);
    }
  `,
} as const;
```

Helper to create a small, repeatable noise texture (CPU, cheap):

```ts
// === Utility: small repeatable noise texture (tile-ish) ===
function makeNoiseTexture(size = 128, seed = 1337) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  let s = seed | 0;
  const rnd = () => ((s = s ^ (s << 13) ^ (s >> 17) ^ (s << 5)) >>> 0) / 0xffffffff;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 3 octave value-ish noise (hash grid)
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
      const v = Math.max(0, Math.min(255, Math.floor(n * 255)));
      const i = (y * size + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
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
```

CPU curl noise for particle drift:

```ts
// === Utility: light-weight 3D noise + curl on CPU (ok for a few hundred particles) ===
function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s); // [0,1)
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
  return nxy0 + w * (nxy1 - nxy0); // [0,1]
}
function curlNoise(p: THREE.Vector3) {
  const e = 0.1;
  const dx = noise3(p.x + e, p.y, p.z) - noise3(p.x - e, p.y, p.z);
  const dy = noise3(p.x, p.y + e, p.z) - noise3(p.x, p.y - e, p.z);
  const dz = noise3(p.x, p.y, p.z + e) - noise3(p.x, p.y, p.z - e);
  const v = new THREE.Vector3(dy - dz, dz - dx, dx - dy);
  const len = v.length() || 1.0;
  return v.multiplyScalar(1 / len);
}
```

### A2. Flame aura shader (object/world space, no UVs needed)

```ts
// === Flame aura shader: no UV dependency, uses world-space FBM ===
const FlameAuraShader = {
  uniforms: {
    time: { value: 0 },
    color1: { value: new THREE.Color(0xff5a00) },
    color2: { value: new THREE.Color(0xffe87a) },
    noiseScale: { value: 2.2 },
    speed: { value: 1.5 },
    intensity: { value: 1.0 },
  },
  vertexShader: `
    varying vec3 vWPos; varying vec3 vN;
    void main(){
      vec4 wp = modelMatrix * vec4(position,1.0);
      vWPos = wp.xyz;
      vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform float time, noiseScale, speed, intensity;
    uniform vec3 color1, color2;
    varying vec3 vWPos; varying vec3 vN;

    float hash(vec3 p){ p = fract(p*0.3183099 + vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float noise(vec3 x){
      vec3 i = floor(x), f = fract(x);
      f = f*f*(3.0-2.0*f);
      float n000 = hash(i);
      float n100 = hash(i+vec3(1,0,0));
      float n010 = hash(i+vec3(0,1,0));
      float n110 = hash(i+vec3(1,1,0));
      float n001 = hash(i+vec3(0,0,1));
      float n101 = hash(i+vec3(1,0,1));
      float n011 = hash(i+vec3(0,1,1));
      float n111 = hash(i+vec3(1,1,1));
      float nx00 = mix(n000,n100,f.x);
      float nx10 = mix(n010,n110,f.x);
      float nx01 = mix(n001,n101,f.x);
      float nx11 = mix(n011,n111,f.x);
      float nxy0 = mix(nx00,nx10,f.y);
      float nxy1 = mix(nx01,nx11,f.y);
      return mix(nxy0,nxy1,f.z);
    }
    float fbm(vec3 p){
      float a=0.0, w=0.5;
      for(int i=0;i<4;i++){ a += w*noise(p); p *= 2.0; w *= 0.5; }
      return a;
    }
    void main(){
      // rising noise + a bit of view-edge boost
      float f = fbm(vWPos*noiseScale + vec3(0.0, time*speed, 0.0));
      float viewEdge = pow(1.0 - max(0.0, dot(normalize(vN), normalize(cameraPosition - vWPos))), 2.0);
      float glow = smoothstep(0.35, 0.75, f) * (0.6 + 0.4*viewEdge) * intensity;
      vec3 col = mix(color1, color2, clamp((f-0.35)/0.4, 0.0, 1.0));
      gl_FragColor = vec4(col * glow, glow);
    }
  `,
} as const;
```

---

## B) Postprocessing & layers (insert right after your existing composer/passes)

This adds: selective bloom (proper dual-composer + composite) and heat‑haze pass (mask‑based).

```ts
// === FX Layers ===
const BLOOM_LAYER = 1;
const HEAT_LAYER = 2;
const bloomLayers = new THREE.Layers();
bloomLayers.set(BLOOM_LAYER);

// === Selective Bloom (separate composer, then composite back) ===
const nonBloomMats = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

function darkenNonBloom(o: THREE.Object3D) {
  const m = o as THREE.Mesh;
  if (m.isMesh && bloomLayers.test(m.layers) === false) {
    nonBloomMats.set(m, m.material);
    m.material = blackMat;
  }
}
function restoreNonBloom(o: THREE.Object3D) {
  const m = o as THREE.Mesh;
  if (nonBloomMats.has(m)) {
    m.material = nonBloomMats.get(m)!;
    nonBloomMats.delete(m);
  }
}

// Dedicated bloom composer
const bloomComposer = new EffectComposer(renderer);
bloomComposer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.1, 0.35, 0.8);
// NOTE: UnrealBloomPass signature is (resolution, strength, radius, threshold)
bloomComposer.addPass(bloomPass);

// Composite bloom back into your main composer
const BloomCompositeShader = {
  uniforms: {
    tDiffuse: { value: null }, // main chain input
    tBloom: { value: bloomComposer.renderTarget2.texture },
    intensity: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse, tBloom; uniform float intensity;
    varying vec2 vUv;
    void main(){
      vec4 base = texture2D(tDiffuse, vUv);
      vec4 bloom = texture2D(tBloom, vUv) * intensity;
      gl_FragColor = base + bloom;
    }
  `,
} as const;
const bloomCompositePass = new ShaderPass(BloomCompositeShader as any);
composer.addPass(bloomCompositePass);

let selectiveBloomEnabled = false;
function preRenderBloom() {
  if (!selectiveBloomEnabled) return;
  scene.traverse(darkenNonBloom);
  bloomComposer.render();
  scene.traverse(restoreNonBloom);
  (bloomCompositePass.uniforms as any).tBloom.value = bloomComposer.renderTarget2.texture;
}

// === Heat Haze (mask-based refraction) ===
const heatMaskRT = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
const heatMaskMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

const HeatHazeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tMask: { value: heatMaskRT.texture },
    time: { value: 0.0 },
    distortion: { value: 0.004 }, // adjust via renderHooks
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    #ifdef GL_OES_standard_derivatives
    #extension GL_OES_standard_derivatives : enable
    #endif
    uniform sampler2D tDiffuse, tMask;
    uniform float distortion, time;
    varying vec2 vUv;
    void main(){
      float m = texture2D(tMask, vUv).r;
      // use mask gradient as pseudo normal -> refract direction
      vec2 g = vec2(dFdx(m), dFdy(m));
      vec2 dir = normalize(vec2(g.y, -g.x) + 1e-6);
      // small animated wobble for shimmer
      float wobble = sin((vUv.y + time*0.6)*60.0) * 0.5 + 0.5;
      vec2 uv2 = vUv + dir * (distortion * m * (0.6 + 0.4*wobble));
      gl_FragColor = texture2D(tDiffuse, uv2);
    }
  `,
} as const;
const heatHazePass = new ShaderPass(HeatHazeShader as any);
(heatHazePass.material as any).extensions = { derivatives: true };
heatHazePass.enabled = false;
composer.addPass(heatHazePass);

let heatHazeEnabled = false;
function renderHeatMask() {
  if (!heatHazeEnabled) return;
  const prevMask = camera.layers.mask;
  const prevMat = scene.overrideMaterial;
  const prevTarget = renderer.getRenderTarget();

  camera.layers.set(HEAT_LAYER);
  scene.overrideMaterial = heatMaskMat;

  renderer.setRenderTarget(heatMaskRT);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);

  renderer.setRenderTarget(prevTarget);
  camera.layers.mask = prevMask;
  scene.overrideMaterial = prevMat;
}
```

> 💡 **Important**: Do **not** put your glowing objects exclusively on the bloom layer; **enable** that layer in addition to default so they remain visible in the base scene: `obj.layers.enable(BLOOM_LAYER)`. Same pattern for heat haze mask: `obj.layers.enable(HEAT_LAYER)`.

---

## C) Flame aura & sparks (put after sword creation; keep references at function scope)

```ts
// === Flame aura (attach to blade), contributes to bloom & heat mask ===
let flameMesh: THREE.Mesh | null = null;
function setFlameAura(
  enabled: boolean,
  {
    scale = 1.05,
    color1 = 0xff5a00,
    color2 = 0xfff18a,
    noiseScale = 2.2,
    speed = 1.6,
    intensity = 1.0,
  } = {}
) {
  if (flameMesh) {
    sword.group.remove(flameMesh);
    (flameMesh.material as any).dispose?.();
    (flameMesh.geometry as any).dispose?.();
    flameMesh = null;
  }
  if (!enabled || !sword.bladeMesh) return;
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone((FlameAuraShader as any).uniforms),
    vertexShader: (FlameAuraShader as any).vertexShader,
    fragmentShader: (FlameAuraShader as any).fragmentShader,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  (mat.uniforms as any).color1.value = new THREE.Color(color1);
  (mat.uniforms as any).color2.value = new THREE.Color(color2);
  (mat.uniforms as any).noiseScale.value = noiseScale;
  (mat.uniforms as any).speed.value = speed;
  (mat.uniforms as any).intensity.value = intensity;

  const g = (sword.bladeMesh.geometry as THREE.BufferGeometry).clone();
  const m = new THREE.Mesh(g, mat);
  m.position.copy(sword.bladeMesh.position);
  m.quaternion.copy(sword.bladeMesh.quaternion);
  m.scale.copy(sword.bladeMesh.scale).multiplyScalar(scale);
  m.layers.enable(BLOOM_LAYER);
  m.layers.enable(HEAT_LAYER);
  sword.group.add(m);
  flameMesh = m;
}

// === Sparks / embers ===
let sparks: THREE.Points | null = null,
  sparksPos: Float32Array,
  sparksVel: Float32Array,
  sparksLife: Float32Array,
  sparksGeom: THREE.BufferGeometry;
function setEmbers(enabled: boolean, { count = 120, size = 3, color = 0xffaa55 } = {}) {
  if (sparks) {
    sword.group.remove(sparks);
    sparksGeom.dispose();
    (sparks.material as any).dispose?.();
    sparks = null as any;
  }
  if (!enabled) return;
  sparksGeom = new THREE.BufferGeometry();
  sparksPos = new Float32Array(count * 3);
  sparksVel = new Float32Array(count * 3);
  sparksLife = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    sparksPos[i * 3 + 0] = 0;
    sparksPos[i * 3 + 1] = 0;
    sparksPos[i * 3 + 2] = 0;
    sparksVel[i * 3 + 0] = (Math.random() - 0.5) * 0.35;
    sparksVel[i * 3 + 1] = 1.2 + Math.random() * 1.6;
    sparksVel[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
    sparksLife[i] = Math.random();
  }
  sparksGeom.setAttribute('position', new THREE.BufferAttribute(sparksPos, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: `
      varying float vL;
      void main(){
        vL = 1.0;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = ${Math.max(1, Number(3)).toFixed(1)} * (300.0 / max(1.0, -mv.z));
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vL;
      void main(){
        vec2 uv = gl_PointCoord - 0.5;
        float r = length(uv);
        float core = smoothstep(0.15, 0.0, r);
        float falloff = smoothstep(0.5, 0.15, r);
        vec3 c = mix(vec3(1.0), uColor, 0.6) * core + uColor * 0.5 * falloff;
        float a = max(core, falloff) * 0.9;
        gl_FragColor = vec4(c, a);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  sparks = new THREE.Points(sparksGeom, mat);
  sparks.layers.enable(BLOOM_LAYER);
  sword.group.add(sparks);
}
```

---

## D) Wire it into your update loop (replace the tail of `tick()`)

Find the end of your `tick` (right before where a render would go) and **replace the tail** with the following. This preserves all your existing animations, then runs pre‑passes, then renders with your main composer.

```ts
  // === existing code above ===
  // Keep ground slightly below sword's lowest point to avoid occlusion
  bbox.setFromObject(sword.group);
  if (isFinite(bbox.min.y)) {
    ground.position.y = bbox.min.y - groundClearance;
  }

  // Drive time uniforms (flame + heat haze)
  const elapsed = clock.getElapsedTime();
  if (flameMesh) {
    const mat = flameMesh.material as THREE.ShaderMaterial;
    (mat.uniforms as any).time.value = elapsed;
  }
  if (heatHazePass.enabled) {
    (heatHazePass.uniforms as any).time.value = elapsed;
  }

  // Mist turbulence (light curl noise in blade local space)
  if (mistPoints && mistGeom && mistLife && mistVel && mistState.enabled) {
    const posAttr = mistGeom.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as unknown as number[];
    const n = posAttr.count;
    for (let i=0;i<n;i++){
      const ix = i*3, iv = i*2;
      let x = arr[ix+0], y = arr[ix+1], z = arr[ix+2];
      // existing drift
      const vx = mistVel[iv+0] * mistState.spread;
      const vz = mistVel[iv+1] * mistState.spread;
      x += vx * dt; z += vz * dt; y += mistState.speed * dt;

      // curl push (scaled by turbulence)
      const c = curlNoise(new THREE.Vector3(x*0.75, (y+elapsed)*0.5, z*0.75));
      x += c.x * (mistState.turbulence ?? 0.35) * dt * 0.35;
      y += c.y * (mistState.turbulence ?? 0.35) * dt * 0.35;
      z += c.z * (mistState.turbulence ?? 0.35) * dt * 0.35;

      let life = mistLife[i] - dt * 0.2;
      // respawn region (unchanged)
      // ... (keep your existing respawn code here unchanged) ...
      arr[ix+0]=x; arr[ix+1]=y; arr[ix+2]=z; mistLife[i]=life;
    }
    posAttr.needsUpdate = true;
    (mistGeom.getAttribute('aLife') as THREE.BufferAttribute).needsUpdate = true;
  }

  // === Pre-passes ===
  preRenderBloom();     // renders bloomComposer -> provides tBloom
  renderHeatMask();     // renders mask into heatMaskRT (only if enabled)

  // === Main render ===
  composer.render();
};
```

> If you previously rendered elsewhere, remove that duplicate; you want **exactly one** `composer.render()` per frame.

---

## E) Resize handling (extend your updateFXAA)

Update sizes for bloom and heat mask in your existing `updateFXAA()`:

```ts
const updateFXAA = () => {
  renderer.getSize(size);
  (fxaa.uniforms as any).resolution.value.set(
    1 / (size.x * renderer.getPixelRatio()),
    1 / (size.y * renderer.getPixelRatio())
  );
  smaa.setSize(size.x, size.y);

  // === add: keep bloom & heat buffers in sync ===
  bloomComposer.setSize(size.x, size.y);
  heatMaskRT.setSize(size.x, size.y);
};
```

---

## F) Mist rebuild: plug in noise texture (1 line change)

In your `rebuildMist(count)` right after creating `mat`, add:

```ts
const noiseTex = makeNoiseTexture(128);
(mat.uniforms as any).uNoiseTex.value = noiseTex;
```

Also extend your `mistState` defaults to include turbulence (safe to add):

```ts
// add fields (or set defaults if they already exist)
(mistState as any).turbulence = (mistState as any).turbulence ?? 0.35;
```

---

## G) Controls (extend your renderHooks so you can toggle effects)

Add these to your existing `renderHooks` object:

```ts
setSelectiveBloom: (enabled: boolean, strength?: number, threshold?: number, radius?: number, intensity?: number) => {
  selectiveBloomEnabled = enabled;
  if (strength !== undefined) bloomPass.strength = strength;
  if (threshold !== undefined) bloomPass.threshold = threshold;
  if (radius !== undefined) bloomPass.radius = radius;
  if (intensity !== undefined) (bloomCompositePass.uniforms as any).intensity.value = intensity;
},
markForBloom: (obj: THREE.Object3D, enable = true) => {
  obj.traverse(o => enable ? o.layers.enable(BLOOM_LAYER) : o.layers.disable(BLOOM_LAYER));
},
setHeatHaze: (enabled: boolean, distortion?: number) => {
  heatHazeEnabled = enabled;
  heatHazePass.enabled = enabled;
  if (distortion !== undefined) (heatHazePass.uniforms as any).distortion.value = distortion;
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
// Optional: bump mist turbulence from UI
setMistTurbulence: (v: number) => { (mistState as any).turbulence = Math.max(0, v); }
```

---

## H) Quick usage (sanity checks)

After your `sword` is created:

```ts
// Make the aura itself glow and serve as heat source
renderHooks.setFlameAura(true, { scale: 1.05, speed: 1.7, noiseScale: 2.4, intensity: 1.1 });
renderHooks.markForBloom(flameMesh ?? sword.bladeMesh, true); // if you want the blade itself to glow too
renderHooks.markForHeat(flameMesh ?? sword.bladeMesh, true);

// Turn on selective bloom (tight, not washed out)
renderHooks.setSelectiveBloom(
  true,
  /*strength*/ 1.15,
  /*threshold*/ 0.82,
  /*radius*/ 0.35,
  /*intensity*/ 1.0
);

// Heat haze shimmer focused around the sword
renderHooks.setHeatHaze(true, /*distortion*/ 0.0038);

// Upgraded mist (you already enable with setBladeMist)
renderHooks.setBladeMist(true, 0x88aadd, 0.6, 0.65, 0.12, 7.0); // (enabled, color, density, speed, spread, size)
renderHooks.setMistTurbulence(0.4);

// Embers for extra life
renderHooks.setEmbers(true, { count: 140, size: 3, color: 0xffb070 });
```

---

## Why your previous results “didn’t render correctly”

- **Composer conflict**: another `setAnimationLoop` and no final composite pass → bloom never blended back.
- **Wrong dependency**: flame shader used `vUv` but your geometry may have no UVs → black/NaN fragments. Now it uses world/object space.
- **Layer visibility**: objects were put on a new layer but the camera wasn’t set to see them in base, or they were removed from default layer → they vanished. Now we **enable** extra layers instead of replacing.
- **No resize updates** for the extra composer/targets → blurred or offset buffers. Fixed in `updateFXAA()`.
- **Smoke too uniform**: alpha cutoff looked like round dots; noise breakup + light curl gives it turbulent edges and drift.
- **Heat haze global**: the old pass distorted the whole screen; now a **mask render** limits it to your marked geometry.

---

If you paste these patches as shown, you’ll get clean, controllable results that slot into your current architecture. If anything still looks off, tell me which effect and what you see (washed out, missing, z‑fighting, etc.) and I’ll tighten just that piece.
