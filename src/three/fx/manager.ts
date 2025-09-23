import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BloomCompositeShader, HeatHazeShader } from './shaders';

export class FxManager {
  readonly BLOOM_LAYER = 1;
  readonly HEAT_LAYER = 2;
  private main: EffectComposer | null = null;
  private bloomComposer: EffectComposer | null = null;
  private selBloomPass: UnrealBloomPass | null = null;
  private bloomCompositePass: ShaderPass | null = null;
  private heatHazePass: ShaderPass | null = null;
  private heatMaskRT: THREE.WebGLRenderTarget | null = null;
  private selectiveBloomEnabled = false;
  private heatHazeEnabled = false;
  private nonBloomMats = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.Camera
  ) {}

  attachToComposer(main: EffectComposer) {
    this.main = main;
  }

  private ensureBloom() {
    if (this.bloomComposer && this.bloomCompositePass) return;
    this.bloomComposer = new EffectComposer(this.renderer);
    this.bloomComposer.addPass(new RenderPass(this.scene, this.camera));
    this.selBloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.1, 0.35, 0.8);
    this.bloomComposer.addPass(this.selBloomPass);
    this.bloomCompositePass = new ShaderPass(BloomCompositeShader as any);
    (this.bloomCompositePass.uniforms as any).tBloom.value =
      this.bloomComposer.renderTarget2.texture;
    this.main?.addPass(this.bloomCompositePass);
  }

  private ensureHeat() {
    if (this.heatHazePass && this.heatMaskRT) return;
    this.heatMaskRT = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.heatHazePass = new ShaderPass(HeatHazeShader as any);
    (this.heatHazePass.uniforms as any).tMask.value = this.heatMaskRT.texture;
    (this.heatHazePass.material as any).extensions = { derivatives: true };
    this.heatHazePass.enabled = false;
    this.main?.addPass(this.heatHazePass);
  }

  updateSize(width: number, height: number) {
    try {
      this.bloomComposer?.setSize(width, height);
    } catch {}
    try {
      this.heatMaskRT?.setSize(width, height);
    } catch {}
  }

  private darkenNonBloom = (o: THREE.Object3D) => {
    const m = o as THREE.Mesh;
    if ((m as any).isMesh && (this.camera.layers.test(m.layers) || true)) {
      // keep only meshes not in bloom layer
      if (this.BLOOM_LAYER !== undefined) {
        const bloomLayers = new THREE.Layers();
        bloomLayers.set(this.BLOOM_LAYER);
        if (bloomLayers.test(m.layers) === false) {
          this.nonBloomMats.set(m, m.material as any);
          m.material = this.blackMat;
        }
      }
    }
  };
  private restoreNonBloom = (o: THREE.Object3D) => {
    const m = o as THREE.Mesh;
    if (this.nonBloomMats.has(m)) {
      m.material = this.nonBloomMats.get(m)!;
      this.nonBloomMats.delete(m);
    }
  };

  preFX() {
    // Selective bloom
    if (this.selectiveBloomEnabled && this.bloomComposer && this.bloomCompositePass) {
      this.scene.traverse(this.darkenNonBloom);
      this.bloomComposer.render();
      this.scene.traverse(this.restoreNonBloom);
      (this.bloomCompositePass.uniforms as any).tBloom.value =
        this.bloomComposer.renderTarget2.texture;
    }
    // Heat mask render
    if (this.heatHazeEnabled && this.heatHazePass && this.heatMaskRT) {
      const prevMask = (this.camera as any).layers.mask;
      const prevMat = this.scene.overrideMaterial;
      const prevTarget = this.renderer.getRenderTarget();
      const prevClear = new THREE.Color();
      this.renderer.getClearColor(prevClear as any);
      const prevClearAlpha = (this.renderer as any).getClearAlpha
        ? (this.renderer as any).getClearAlpha()
        : 1;
      this.camera.layers.set(this.HEAT_LAYER);
      this.scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      this.renderer.setRenderTarget(this.heatMaskRT);
      this.renderer.setClearColor(0x000000 as any, 0 as any);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera as any);
      this.renderer.setRenderTarget(prevTarget);
      (this.camera as any).layers.mask = prevMask;
      this.scene.overrideMaterial = prevMat;
      // Restore previous clear color/alpha so main render background is unchanged
      this.renderer.setClearColor(prevClear as any, prevClearAlpha as any);
    }
  }

  setHeatTime(t: number) {
    if (this.heatHazePass) (this.heatHazePass.uniforms as any).time.value = t;
  }

  setSelectiveBloom(
    enabled: boolean,
    opts?: { strength?: number; threshold?: number; radius?: number; intensity?: number }
  ) {
    this.selectiveBloomEnabled = enabled;
    if (enabled) this.ensureBloom();
    if (this.selBloomPass) {
      if (opts?.strength !== undefined) this.selBloomPass.strength = opts.strength;
      if (opts?.threshold !== undefined) this.selBloomPass.threshold = opts.threshold as any;
      if (opts?.radius !== undefined) this.selBloomPass.radius = opts.radius;
    }
    if (this.bloomCompositePass && opts?.intensity !== undefined)
      (this.bloomCompositePass.uniforms as any).intensity.value = opts.intensity;
  }
  markForBloom(obj: THREE.Object3D, enable = true) {
    obj.traverse((o) =>
      enable ? o.layers.enable(this.BLOOM_LAYER) : o.layers.disable(this.BLOOM_LAYER)
    );
  }

  setHeatHaze(enabled: boolean, distortion?: number) {
    this.heatHazeEnabled = enabled;
    if (enabled) this.ensureHeat();
    if (this.heatHazePass) this.heatHazePass.enabled = enabled;
    if (distortion !== undefined && this.heatHazePass)
      (this.heatHazePass.uniforms as any).distortion.value = distortion;
  }
  markForHeat(obj: THREE.Object3D, enable = true) {
    obj.traverse((o) =>
      enable ? o.layers.enable(this.HEAT_LAYER) : o.layers.disable(this.HEAT_LAYER)
    );
  }
}
