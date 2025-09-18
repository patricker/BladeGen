import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { VignetteShader } from '../fx/shaders';

export interface AAPasses {
  fxaa: ShaderPass | null;
  smaa: SMAAPass | null;
}

export interface PostProcessingContext {
  composer: EffectComposer;
  renderPass: RenderPass;
  aaPasses: AAPasses;
  bloom: UnrealBloomPass;
  outline: OutlinePass;
  vignette: ShaderPass;
  updateAaPass: (width: number, height: number, pixelRatio: number) => void;
}

export function createPostProcessing(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): PostProcessingContext {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const aaPasses: AAPasses = { fxaa: null, smaa: null };
  const updateAaPass = (width: number, height: number, pixelRatio: number) => {
    if (aaPasses.fxaa) {
      (aaPasses.fxaa.uniforms as any).resolution.value.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
    }
    if (aaPasses.smaa) {
      aaPasses.smaa.setSize(width, height);
    }
  };

  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.2, 0.85);
  bloom.enabled = false;
  composer.addPass(bloom);

  const outline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
  outline.enabled = false;
  outline.edgeStrength = 2.5;
  outline.edgeThickness = 1.0;
  outline.visibleEdgeColor.set('#ffffff');
  outline.hiddenEdgeColor.set('#000000');
  composer.addPass(outline);

  const vignette = new ShaderPass(VignetteShader as any);
  vignette.enabled = false;
  composer.addPass(vignette);

  return { composer, renderPass, aaPasses, bloom, outline, vignette, updateAaPass };
}
