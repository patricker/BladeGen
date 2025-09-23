import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Simple pixelation + optional posterize pass.
// - pixelSize: size of one pixel block in screen pixels (>=1)
// - posterizeLevels: per-channel levels; <=1 disables posterization
const PixelateShader = {
  uniforms: {
    tDiffuse: { value: null as unknown },
    resolution: { value: new THREE.Vector2(1, 1) },
    pixelSize: { value: 4.0 },
    posterizeLevels: { value: 0.0 },
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
    uniform vec2 resolution;
    uniform float pixelSize; // in screen pixels
    uniform float posterizeLevels; // <=1: off; else per-channel levels
    varying vec2 vUv;

    vec3 posterize(vec3 color, float levels) {
      if (levels <= 1.0) return color;
      vec3 c = clamp(color, 0.0, 1.0);
      vec3 q = floor(c * levels + 0.0001) / levels;
      return q;
    }

    void main() {
      float px = max(1.0, pixelSize);
      // Convert pixelSize to UV units using render target resolution
      vec2 stepUV = vec2(px / max(1.0, resolution.x), px / max(1.0, resolution.y));
      // Snap vUv to the center of the pixel block (avoid bias)
      vec2 uv = (floor(vUv / stepUV) + 0.5) * stepUV;
      vec4 col = texture2D(tDiffuse, uv);
      col.rgb = posterize(col.rgb, posterizeLevels);
      gl_FragColor = col;
    }
  `,
} as const;

export function buildPixelatePass(pixelSize = 4, posterizeLevels = 0) {
  const pass = new ShaderPass(PixelateShader as any);
  (pass.uniforms as any).pixelSize.value = Math.max(1, pixelSize);
  (pass.uniforms as any).posterizeLevels.value = Math.max(0, posterizeLevels);
  // Ensure resolution uniform stays in sync with composer size
  const originalSetSize = (pass as any).setSize?.bind(pass);
  (pass as any).setSize = (width: number, height: number) => {
    if (originalSetSize) originalSetSize(width, height);
    (pass.uniforms as any).resolution.value.set(width, height);
  };
  return pass;
}
