import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type * as THREE from 'three';
import { FxManager } from '../fx/manager';
import type { RenderHookFlags } from '../render/createRenderHooks';

export interface FxContext {
  fx: FxManager;
  flags: RenderHookFlags;
  layers: { bloom: number; heat: number };
  preFX: () => void;
  updateSize: (width: number, height: number) => void;
}

export function createFxContext(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, composer: EffectComposer): FxContext {
  const fx = new FxManager(renderer, scene, camera);
  fx.attachToComposer(composer);
  const layers = { bloom: fx.BLOOM_LAYER, heat: fx.HEAT_LAYER };
  const flags: RenderHookFlags = { selectiveBloom: false, heatHaze: false };
  const preFX = () => { fx.preFX(); };
  const updateSize = (width: number, height: number) => {
    fx.updateSize(width, height);
  };

  return { fx, flags, layers, preFX, updateSize };
}
