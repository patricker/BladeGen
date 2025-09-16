import * as THREE from 'three'

export const FresnelShader = {
  uniforms: { color: { value: new THREE.Color(0xffffff) }, intensity: { value: 0.6 }, power: { value: 2.0 } },
  vertexShader: `
    varying vec3 vNormal; varying vec3 vWorldPos;
    void main(){ vNormal = normalize(normalMatrix * normal); vec4 wp = modelMatrix * vec4(position,1.0); vWorldPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
  `,
  fragmentShader: `
    uniform vec3 color; uniform float intensity; uniform float power; varying vec3 vNormal; varying vec3 vWorldPos;
    void main(){ vec3 V = normalize(cameraPosition - vWorldPos); float f = pow(1.0 - max(0.0, dot(normalize(vNormal), V)), power) * intensity; gl_FragColor = vec4(color * f, f); }
  `
} as const

export const FlameAuraShader = {
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
} as const

export const MistShader = {
  uniforms: {
    uColor: { value: new THREE.Color(0xffffff) },
    uSizeMax: { value: 6.0 },
    uSizeMin: { value: 1.5 },
    uAlphaScale: { value: 0.45 },
    uNoiseTex: { value: null }
  },
  vertexShader: `
    uniform float uSizeMin; uniform float uSizeMax; attribute float aLife; varying float vLife; void main(){ vLife = aLife; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; float att = clamp(12.0 / max(1.0, -mv.z), 0.0, 1.0); gl_PointSize = mix(uSizeMin, uSizeMax, att); }
  `,
  fragmentShader: `
    uniform vec3 uColor; uniform float uAlphaScale; uniform sampler2D uNoiseTex; varying float vLife; void main(){ vec2 uv = gl_PointCoord - vec2(0.5); float r = length(uv); float soft = exp(-6.0 * r * r); vec2 v2 = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y); float noise = texture2D(uNoiseTex, v2 * 0.5).r * 0.6 + 0.4; float a = soft * (1.0 - smoothstep(0.7, 1.0, vLife)) * uAlphaScale * noise; gl_FragColor = vec4(uColor, a); }
  `
} as const

export const BloomCompositeShader = {
  uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, intensity: { value: 1.0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse, tBloom; uniform float intensity; varying vec2 vUv; void main(){ vec4 base = texture2D(tDiffuse, vUv); vec4 bloom = texture2D(tBloom, vUv) * intensity; gl_FragColor = base + bloom; }`
} as const

export const HeatHazeShader = {
  uniforms: { tDiffuse: { value: null }, tMask: { value: null }, time: { value: 0.0 }, distortion: { value: 0.004 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `#ifdef GL_OES_standard_derivatives\n#extension GL_OES_standard_derivatives : enable\n#endif\nuniform sampler2D tDiffuse, tMask; uniform float distortion, time; varying vec2 vUv; void main(){ float m = texture2D(tMask, vUv).r; vec2 g = vec2(dFdx(m), dFdy(m)); vec2 dir = normalize(vec2(g.y, -g.x) + 1e-6); float wobble = sin((vUv.y + time*0.6)*60.0) * 0.5 + 0.5; vec2 uv2 = vUv + dir * (distortion * m * (0.6 + 0.4*wobble)); gl_FragColor = texture2D(tDiffuse, uv2); }`
} as const

export const VignetteShader = {
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
} as const
