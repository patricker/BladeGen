import { setupScene } from './three/setupScene';
import { createSidebar } from './components/controls';
import { defaultSwordParams, SwordGenerator } from './three/SwordGenerator';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas element #scene not found');
}

const { renderer, camera, controls, scene, composer, dispose, updateFXAA, renderHooks } = setupScene(canvas) as any;

let disposed = false;
function onResize() {
  if (disposed) return;
  const cap = (renderer as any)._dprCap ?? 2;
  const dpr = Math.min(window.devicePixelRatio || 1, cap);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  if (composer) composer.setSize(width, height);
  if (updateFXAA) updateFXAA();
}

window.addEventListener('resize', onResize);
onResize();

let last = 0;
function animate(t: number) {
  if (disposed) return;
  const dt = (t - last) / 1000;
  last = t;
  controls.update();
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// Build UI controls
let sword: SwordGenerator | undefined = undefined;
// The setupScene creates and adds a SwordGenerator; expose it by tag
// Fallback: create a fresh one if not found
try {
  // @ts-ignore
  sword = (scene as any).__swordInstance as SwordGenerator;
} catch {}
if (!sword) {
  sword = new SwordGenerator(defaultSwordParams());
  scene.add(sword.group);
}

const sidebar = document.getElementById('sidebar');
if (sidebar && sword) {
  // @ts-ignore
  const hooks = (scene as any).__renderHooks || renderHooks;
  createSidebar(sidebar, sword, defaultSwordParams(), hooks);
}

// Hot module cleanup
if (import.meta && (import.meta as any).hot) {
  (import.meta as any).hot.dispose(() => {
    disposed = true;
    window.removeEventListener('resize', onResize);
    dispose();
  });
}
