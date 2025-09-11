import { setupScene } from './three/setupScene';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas element #scene not found');
}

const { renderer, camera, controls, scene, dispose } = setupScene(canvas);

let disposed = false;
function onResize() {
  if (disposed) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
}

window.addEventListener('resize', onResize);
onResize();

let last = 0;
function animate(t: number) {
  if (disposed) return;
  const dt = (t - last) / 1000;
  last = t;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// Hot module cleanup
if (import.meta && (import.meta as any).hot) {
  (import.meta as any).hot.dispose(() => {
    disposed = true;
    window.removeEventListener('resize', onResize);
    dispose();
  });
}

