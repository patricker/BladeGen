import { describe, it, expect, vi, beforeEach } from 'vitest';

const { Vector2Stub, WebGLRenderTargetStub, WebGLMultisampleRenderTargetStub, ColorProxy } =
  vi.hoisted(() => {
    class Vector2StubInner {
      constructor(
        public width = 0,
        public height = 0
      ) {}
      set(x: number, y: number) {
        this.width = x;
        this.height = y;
        return this;
      }
    }

    class WebGLRenderTargetStubInner {
      texture: { name?: string };
      samples = 0;
      constructor(
        public width = 1,
        public height = 1,
        opts: any = {}
      ) {
        this.texture = { name: opts?.name ?? '' };
      }
      setSize(width: number, height: number) {
        this.width = width;
        this.height = height;
      }
      clone() {
        const clone = new WebGLRenderTargetStubInner(this.width, this.height);
        clone.samples = this.samples;
        clone.texture = { ...this.texture };
        return clone;
      }
    }

    class WebGLMultisampleRenderTargetStubInner extends WebGLRenderTargetStubInner {}

    class ColorProxyInner {
      value: string | number = '#000000';
      set(v: string | number) {
        this.value = v;
        return this;
      }
      setHex(v: number) {
        this.value = v;
        return this;
      }
    }

    return {
      Vector2Stub: Vector2StubInner,
      WebGLRenderTargetStub: WebGLRenderTargetStubInner,
      WebGLMultisampleRenderTargetStub: WebGLMultisampleRenderTargetStubInner,
      ColorProxy: ColorProxyInner,
    };
  });

vi.mock('three', () => ({
  Vector2: Vector2Stub,
  WebGLRenderTarget: WebGLRenderTargetStub,
  WebGLMultisampleRenderTarget: WebGLMultisampleRenderTargetStub,
  HalfFloatType: 'HalfFloatType',
  MeshStandardMaterial: class {},
  Color: ColorProxy,
}));

class _BasePass {
  enabled = false;
  uniforms: Record<string, { value: unknown }> = {};
  constructor() {
    this.uniforms = {};
  }
}

vi.mock('three/examples/jsm/postprocessing/EffectComposer.js', () => ({
  EffectComposer: class {
    passes: any[] = [];
    renderTarget1: WebGLRenderTargetStub;
    renderTarget2: WebGLRenderTargetStub;
    constructor(_renderer: any, renderTarget?: WebGLRenderTargetStub) {
      this.renderTarget1 = renderTarget ?? new WebGLRenderTargetStub();
      this.renderTarget2 = this.renderTarget1.clone();
    }
    addPass(pass: any) {
      this.passes.push(pass);
    }
    setSize(width: number, height: number) {
      this.renderTarget1.setSize(width, height);
      this.renderTarget2.setSize(width, height);
    }
  },
}));

vi.mock('three/examples/jsm/postprocessing/RenderPass.js', () => ({
  RenderPass: class {
    enabled = true;
    uniforms: Record<string, { value: unknown }> = {};
  },
}));
vi.mock('three/examples/jsm/postprocessing/ShaderPass.js', () => ({
  ShaderPass: class {
    enabled = false;
    uniforms: Record<string, { value: unknown }> = {};
    constructor(public shader?: any) {}
  },
}));
vi.mock('three/examples/jsm/shaders/FXAAShader.js', () => ({ FXAAShader: {} }));
vi.mock('three/examples/jsm/postprocessing/SMAAPass.js', () => ({
  SMAAPass: class {
    enabled = false;
    constructor(_w?: number, _h?: number) {}
    setSize() {}
  },
}));
vi.mock('three/examples/jsm/postprocessing/UnrealBloomPass.js', () => ({
  UnrealBloomPass: class {
    enabled = false;
    strength = 0;
    threshold = 0;
    radius = 0;
    constructor() {}
  },
}));
vi.mock('three/examples/jsm/postprocessing/OutlinePass.js', () => ({
  OutlinePass: class {
    enabled = false;
    edgeStrength = 0;
    edgeThickness = 0;
    visibleEdgeColor = new ColorProxy();
    hiddenEdgeColor = new ColorProxy();
    selectedObjects: any[] = [];
  },
}));
vi.mock('../../fx/shaders', () => ({ VignetteShader: {} }));

import { createPostProcessing } from '../post';

const makeRenderer = (isWebGL2: boolean, maxSamples: number) => {
  return {
    capabilities: { isWebGL2, maxSamples },
    getSize: (vec: any) => vec.set(800, 600),
    getPixelRatio: () => 1,
  };
};

describe('createPostProcessing', () => {
  let scene: Record<string, unknown>;
  let camera: Record<string, unknown>;

  beforeEach(() => {
    scene = {};
    camera = {};
  });

  it('currently reports MSAA unsupported so UI can fall back to FXAA/SMAA', () => {
    const renderer = makeRenderer(true, 4);
    const ctx = createPostProcessing(scene as any, camera as any, renderer as any);
    expect(ctx.supportsMsaa).toBe(false);
    ctx.setMsaaSamples(8);
    expect(ctx.getMsaaSamples()).toBe(0);
  });
});
