import * as THREE from 'three'

export const InnerGlowShader = {
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
} as const

/** Build inner glow group and return the material for time animation. */
export function buildInnerGlow(source: THREE.Object3D, colorHex: number, iMin: number, iMax: number, speed: number) {
  const group = new THREE.Group()
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone((InnerGlowShader as any).uniforms),
    vertexShader: (InnerGlowShader as any).vertexShader,
    fragmentShader: (InnerGlowShader as any).fragmentShader,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide
  })
  ;(mat.uniforms as any).color.value = new THREE.Color(colorHex)
  ;(mat.uniforms as any).iMin.value = iMin
  ;(mat.uniforms as any).iMax.value = iMax
  ;(mat.uniforms as any).speed.value = speed
  source.traverse((o)=>{ const m = o as THREE.Mesh; if ((m as any).isMesh && m.geometry) {
    const mesh = new THREE.Mesh((m.geometry as any), mat); mesh.position.copy(m.position); mesh.quaternion.copy(m.quaternion); mesh.scale.copy(m.scale); group.add(mesh)
  }})
  return { group, material: mat }
}

