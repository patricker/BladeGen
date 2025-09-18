import type * as THREE from 'three';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';

export interface RenderPipeline {
  render: () => void;
  setPostFXEnabled: (enabled: boolean) => void;
  isPostFXEnabled: () => boolean;
}

export interface RenderPipelineOptions {
  composer: EffectComposer;
  preFX?: () => void;
  beforeRender?: () => void;
}

export function createRenderPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: RenderPipelineOptions
): RenderPipeline {
  let usePostFX = true;

  const render = () => {
    try {
      options.beforeRender?.();
    } catch (err) {
      console.warn('beforeRender pipeline step failed', err);
    }
    if (usePostFX) {
      try {
        options.preFX?.();
      } catch (err) {
        console.warn('preFX pipeline step failed', err);
      }
      options.composer.render();
    } else {
      renderer.render(scene, camera);
    }
  };

  const setPostFXEnabled = (enabled: boolean) => {
    usePostFX = !!enabled;
  };

  const isPostFXEnabled = () => usePostFX;

  return { render, setPostFXEnabled, isPostFXEnabled };
}
