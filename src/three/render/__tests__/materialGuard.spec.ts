import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createRenderHooks, type RenderHookContext } from '../createRenderHooks';

function makeStubContext(geom: THREE.BufferGeometry) {
  const materials: Record<string, any> = { blade: {}, guard: {}, handle: {}, pommel: {} };
  const sword = {
    bladeMesh: new THREE.Mesh(geom, new THREE.MeshStandardMaterial()),
    setMaterials: (next: Record<string, any>) => {
      Object.assign(materials, next);
    },
    group: new THREE.Group(),
  } as any;
  const scene = new THREE.Scene() as any;
  // Minimal stub; no DOM/WebGL context needed for this test path
  const renderer = {} as any;
  const noop = () => {};
  const ctx: RenderHookContext = {
    renderer: renderer as any,
    scene: scene as any,
    sword,
    materials,
    composer: { addPass: noop } as any,
    bloom: { enabled: false } as any,
    outline: {
      enabled: false,
      selectedObjects: [],
      visibleEdgeColor: new THREE.Color(),
      hiddenEdgeColor: new THREE.Color(),
    } as any,
    vignette: { enabled: false, uniforms: {} } as any,
    ambientLight: new THREE.HemisphereLight(),
    keyLight: new THREE.DirectionalLight(),
    rimLight: new THREE.DirectionalLight(),
    fx: {
      setSelectiveBloom: noop,
      setHeatHaze: noop,
      markForBloom: noop,
      markForHeat: noop,
    } as any,
    fxLayers: { bloom: 1, heat: 2 },
    flags: { selectiveBloom: false, heatHaze: false },
    flameMesh: { current: null },
    setFlameAura: noop,
    setEmbers: noop,
    mistState: {} as any,
    rebuildMist: noop,
    background: {
      base: new THREE.Color(),
      target: new THREE.Color(),
      getBrightness: () => 0,
      setBrightness: noop,
      apply: noop,
      groundMaterial: new THREE.MeshStandardMaterial(),
    },
    aaPasses: { fxaa: null, smaa: null },
    updateFXAA: noop,
    msaa: { supported: false, maxSamples: 0, setSamples: noop as any, getSamples: () => 0 },
    envTex: new THREE.Texture(),
    currentEnvTex: { current: null },
    buildInkOutline: () => null,
    inkOutlineGroup: { current: null },
    buildFresnel: () => null,
    fresnelGroup: { current: null },
    innerGlowState: { enabled: false, time: 0, speed: 1.0, color: 0xffffff, iMin: 0.2, iMax: 0.9 },
    buildInnerGlow: () => null,
    innerGlowGroup: { current: null },
    innerGlowMaterial: { current: null },
    buildBladeGradient: () => null,
    bladeVisibility: { visible: true, occlude: false },
    applyBladeVisibility: noop,
    setKeyLightAngles: noop,
    setRimLightAngles: noop,
    setPostFXEnabled: noop,
    autoSpin: { setEnabled: noop, getEnabled: () => true },
  };
  return { ctx, materials, sword };
}

describe('setPartMaterial anisotropy guard', () => {
  it('drops anisotropy when blade geometry lacks tangents', () => {
    const geom = new THREE.PlaneGeometry(1, 1);
    // Ensure there is no tangent attribute
    geom.deleteAttribute('tangent');
    const { ctx, materials } = makeStubContext(geom);
    const hooks = createRenderHooks(ctx);
    hooks.setPartMaterial('blade', { anisotropy: 0.4, anisotropyRotation: 0.2, color: 0xffffff });
    // anisotropy keys should be stripped
    expect((materials as any).blade.anisotropy).toBeUndefined();
    expect((materials as any).blade.anisotropyRotation).toBeUndefined();
    expect((materials as any).blade.color).toBeDefined();
  });

  it('preserves anisotropy when blade geometry has tangents', () => {
    const geom = new THREE.PlaneGeometry(1, 1);
    // Synthesize a minimal tangent attribute; guard only checks presence
    const tangents = new Float32Array(geom.getAttribute('position').count * 4);
    geom.setAttribute('tangent', new THREE.BufferAttribute(tangents, 4));
    const { ctx, materials } = makeStubContext(geom);
    const hooks = createRenderHooks(ctx);
    hooks.setPartMaterial('blade', { anisotropy: 0.25, anisotropyRotation: -0.1 });
    expect((materials as any).blade.anisotropy).toBeCloseTo(0.25, 6);
    expect((materials as any).blade.anisotropyRotation).toBeCloseTo(-0.1, 6);
  });
});
