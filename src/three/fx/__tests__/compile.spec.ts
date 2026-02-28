import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  VignetteShader,
  HeatHazeShader,
  BloomCompositeShader,
} from '../../fx/shaders';
import {
  buildFresnel,
  buildBladeGradientOverlay,
  buildBladeGradientWearOverlay,
} from '../../fx/overlays';
import { buildFlameAura } from '../../fx/aura';
import { buildMist } from '../../fx/mist';
import { buildInnerGlow } from '../../fx/innerGlow';

async function makeRenderer() {
  let headlessGL: any;
  try {
    // dynamic import so the test suite still runs without the dependency installed
    const mod: any = await import('gl');
    headlessGL = mod.default || mod;
  } catch {
    return null;
  }
  try {
    const gl = headlessGL(32, 32, {
      preserveDrawingBuffer: false,
      stencil: false,
      antialias: false,
    });
    const renderer = new (THREE as any).WebGLRenderer({
      context: gl,
      antialias: false,
    }) as THREE.WebGLRenderer;
    renderer.setSize(32, 32, false);
    renderer.debug.checkShaderErrors = true;
    return renderer;
  } catch {
    return null;
  }
}

function captureErrors() {
  const errs: string[] = [];
  const orig = console.error;
  (console as any).error = (...args: any[]) => {
    try {
      errs.push(args.join(' '));
    } catch {}
    orig.apply(console, args as any);
  };
  return () => {
    (console as any).error = orig;
    return errs;
  };
}

describe('shader compile smoke (headless-gl)', () => {
  it('compiles all custom shaders without errors', async () => {
    const renderer = await makeRenderer();
    if (!renderer) {
      // headless-gl not available in this environment, skip without failing the suite
      expect(true).toBe(true);
      return;
    }
    const restore = captureErrors();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
    camera.position.z = 2;

    // Base mesh for mesh-based overlays
    const sourceMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1.0, 0.06),
      new THREE.MeshBasicMaterial()
    );
    scene.add(sourceMesh);

    // Fresnel (overlay)
    {
      const g = buildFresnel(sourceMesh, 0xffffff, 0.6, 2.0);
      scene.add(g);
    }
    // Inner Glow
    {
      const built = buildInnerGlow(sourceMesh, 0x88ccff, 0.2, 0.9, 1.5);
      scene.add(built.group);
    }
    // Flame Aura
    {
      const { mesh } = buildFlameAura(sourceMesh, { scale: 1.05, intensity: 1.0 });
      scene.add(mesh);
    }
    // Mist (points)
    {
      const built = buildMist(sourceMesh, 64, {
        color: 0xffffff,
        speed: 0.6,
        spread: 0.08,
        size: 6.0,
        sizeMinRatio: 0.5,
        lifeRate: 0.25,
        noiseAmp: 0.08,
        noiseFreqX: 0.7,
        noiseFreqZ: 0.5,
        alphaScale: 0.35,
        windX: 0,
        windZ: 0,
        emission: 'base',
      } as any);
      scene.add(built.points);
    }
    // Blade gradient overlays (two variants)
    {
      const grad = buildBladeGradientOverlay(sourceMesh, 0xb9c6ff, 0xffffff, 0.2, 0.2);
      const wear = buildBladeGradientWearOverlay(sourceMesh, 0xb9c6ff, 0xffffff, 0.2, 0.2);
      if (grad) scene.add(grad);
      if (wear) scene.add(wear);
    }
    // Screen-space shader planes for vignette, heat haze, bloom composite
    const quadGeo = new THREE.PlaneGeometry(1, 1);
    const mkTex = () => {
      const t = new THREE.DataTexture(new Uint8Array(4 * 4 * 4).fill(255), 4, 4);
      t.needsUpdate = true;
      return t;
    };
    {
      const mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone((VignetteShader as any).uniforms),
        vertexShader: (VignetteShader as any).vertexShader,
        fragmentShader: (VignetteShader as any).fragmentShader,
      });
      scene.add(new THREE.Mesh(quadGeo, mat));
    }
    {
      const mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone((HeatHazeShader as any).uniforms),
        vertexShader: (HeatHazeShader as any).vertexShader,
        fragmentShader: (HeatHazeShader as any).fragmentShader,
      });
      (mat.uniforms as any).tDiffuse.value = mkTex();
      (mat.uniforms as any).tMask.value = mkTex();
      (mat as any).extensions = { derivatives: true };
      scene.add(new THREE.Mesh(quadGeo, mat));
    }
    {
      const mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone((BloomCompositeShader as any).uniforms),
        vertexShader: (BloomCompositeShader as any).vertexShader,
        fragmentShader: (BloomCompositeShader as any).fragmentShader,
      });
      (mat.uniforms as any).tDiffuse.value = mkTex();
      (mat.uniforms as any).tBloom.value = mkTex();
      scene.add(new THREE.Mesh(quadGeo, mat));
    }

    // Compile once; if any program fails, three logs an error which we capture
    renderer.compile(scene, camera);
    const errs = restore();
    // Fail if any shader compile/link errors occurred
    const hasError = errs.some((e) => /Shader Error|VALIDATE_STATUS|compile|link/i.test(e));
    expect(hasError).toBe(false);
  });
});
