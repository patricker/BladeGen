import { describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { createRenderPipeline } from '../renderPipeline';

describe('render pipeline', () => {
  const makeStubs = () => {
    const renderer = { render: vi.fn() } as unknown as THREE.WebGLRenderer;
    const scene = {} as unknown as THREE.Scene;
    const camera = {} as unknown as THREE.Camera;
    const composer = { render: vi.fn() } as unknown as EffectComposer;
    const preFX = vi.fn();
    const beforeRender = vi.fn();
    return { renderer, scene, camera, composer, preFX, beforeRender };
  };

  it('uses composer when post FX enabled', () => {
    const { renderer, scene, camera, composer, preFX, beforeRender } = makeStubs();
    const pipeline = createRenderPipeline(renderer, scene, camera, {
      composer,
      preFX,
      beforeRender,
    });
    pipeline.render();
    expect(beforeRender).toHaveBeenCalledTimes(1);
    expect(preFX).toHaveBeenCalledTimes(1);
    expect((composer.render as any).mock.calls.length).toBe(1);
    expect((renderer.render as any).mock.calls.length).toBe(0);
  });

  it('falls back to direct renderer when post FX disabled', () => {
    const { renderer, scene, camera, composer, preFX, beforeRender } = makeStubs();
    const pipeline = createRenderPipeline(renderer, scene, camera, {
      composer,
      preFX,
      beforeRender,
    });
    pipeline.setPostFXEnabled(false);
    pipeline.render();
    expect(beforeRender).toHaveBeenCalledTimes(1);
    expect(preFX).not.toHaveBeenCalled();
    expect((composer.render as any).mock.calls.length).toBe(0);
    expect((renderer.render as any).mock.calls.length).toBe(1);
  });
});
