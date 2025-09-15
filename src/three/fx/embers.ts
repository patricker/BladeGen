import * as THREE from 'three'

/** Create simple embers particle system near a source mesh. */
export function createEmbers(source: THREE.Mesh, { count=120, size=3, color=0xffaa55 } = {}) {
  const geom = new THREE.BufferGeometry()
  const pos = new Float32Array(count * 3)
  const life = new Float32Array(count)
  const vel = new Float32Array(count * 3)
  const bb = new THREE.Box3().setFromObject(source)
  for (let i=0;i<count;i++){
    const x = THREE.MathUtils.lerp(bb.min.x, bb.max.x, Math.random()*0.2 + 0.4)
    const y = THREE.MathUtils.lerp(bb.min.y, bb.max.y, Math.random()*0.2 + 0.1)
    const z = THREE.MathUtils.lerp(bb.min.z, bb.max.z, Math.random()*0.2 + 0.4)
    pos[i*3+0]=x; pos[i*3+1]=y; pos[i*3+2]=z; life[i]=Math.random()
    vel[i*3+0]=(Math.random()-0.5)*0.4; vel[i*3+1]=Math.random()*0.8+0.4; vel[i*3+2]=(Math.random()-0.5)*0.4
  }
  geom.setAttribute('position', new THREE.BufferAttribute(pos,3))
  geom.setAttribute('aLife', new THREE.BufferAttribute(life,1))
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uSize: { value: size } },
    vertexShader: `
      uniform float uSize; attribute float aLife; varying float vLife; void main(){ vLife=aLife; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * (300.0 / max(1.0, -mv.z)); }
    `,
    fragmentShader: `
      uniform vec3 uColor; varying float vLife; void main(){ vec2 d = gl_PointCoord-vec2(0.5); float r=length(d); float soft=exp(-6.0*r*r); float a = soft * (1.0 - smoothstep(0.7,1.0,vLife)); gl_FragColor = vec4(uColor, a); }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  })
  const pts = new THREE.Points(geom, mat)
  return { points: pts, geom, arrays: { pos, vel, life } }
}

