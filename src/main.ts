import { setupScene } from './three/setupScene';
import { createSidebar } from './components/controls';
import { presetShowcaseArming, swordPresets } from './components/presets';
import { shouldShowGallery, createGallery } from './components/gallery';
import { shouldUseLowQuality } from './components/mobileDetect';
import { readShareFromUrl } from './components/shareUrl';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas element #scene not found');
}

const {
  renderer,
  camera,
  controls,
  scene: _scene,
  composer,
  dispose,
  updateFXAA,
  renderHooks,
  pipeline,
  sword,
} = setupScene(canvas);

// Simple FPS overlay
const fpsEl = document.getElementById('fps');
const themeSel = document.getElementById('theme') as HTMLSelectElement | null;
let _fpsFrames = 0;
let _fpsLast = performance.now();

let disposed = false;
function onResize() {
  if (disposed) return;
  const cap = (renderHooks as any).getDPRCap?.() ?? 2;
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
  const _dt = (t - last) / 1000;
  last = t;
  controls.update();
  pipeline.render();
  // FPS update every ~500ms
  _fpsFrames++;
  const now = performance.now();
  const elapsed = now - _fpsLast;
  if (elapsed >= 500) {
    const fps = Math.round((_fpsFrames * 1000) / elapsed);
    if (fpsEl) fpsEl.textContent = `FPS: ${fps}`;
    _fpsFrames = 0;
    _fpsLast = now;
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// Build UI controls
const sidebar = document.getElementById('sidebar');

// Mobile drawer infrastructure
const header = document.querySelector('header');
const hamburger = document.createElement('button');
hamburger.className = 'hamburger';
hamburger.setAttribute('aria-label', 'Toggle sidebar');
hamburger.textContent = '\u2630';

const overlay = document.createElement('div');
overlay.className = 'sidebar-overlay';
document.getElementById('app')!.appendChild(overlay);

if (header) {
  header.querySelector('.brand')!.prepend(hamburger);
}

const toggleSidebar = (open?: boolean) => {
  if (!sidebar) return;
  const isOpen = open ?? !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', isOpen);
  overlay.classList.toggle('visible', isOpen);
};

hamburger.addEventListener('click', () => toggleSidebar());
overlay.addEventListener('click', () => toggleSidebar(false));

function startEditor(presetId?: string, sharedParams?: import('./three/SwordGenerator').SwordParams) {
  if (!sidebar || !sword) return;
  const id = presetId || 'showcase-arming';
  const entry = swordPresets.find(p => p.id === id);
  const params = sharedParams ?? (entry ? entry.build() : presetShowcaseArming());
  createSidebar(sidebar, sword, params, renderHooks, {
    initialPresetId: sharedParams ? undefined : id,
    initialQualityPreset: shouldUseLowQuality() ? 'Low' : undefined,
  });
}

// Check for shared URL first — skip gallery if a share link is present
const sharedState = readShareFromUrl();
if (sharedState) {
  startEditor(undefined, sharedState);
} else if (shouldShowGallery()) {
  if (sidebar) sidebar.style.display = 'none';
  const app = document.getElementById('app');
  if (app) {
    const galleryEl = createGallery(app, {
      onSelectPreset: (presetId) => {
        galleryEl.remove();
        if (sidebar) sidebar.style.display = '';
        startEditor(presetId);
      },
      onDismiss: () => {
        galleryEl.remove();
        if (sidebar) sidebar.style.display = '';
        startEditor();
      },
    });
  }
} else {
  startEditor();
}

// Listen for "Browse All" from toolbar
window.addEventListener('bladegen:open-gallery', () => {
  if (!sidebar) return;
  sidebar.style.display = 'none';
  const app = document.getElementById('app');
  if (app) {
    const galleryEl = createGallery(app, {
      onSelectPreset: (presetId) => {
        galleryEl.remove();
        sidebar.style.display = '';
        const presetSel = document.getElementById('preset-selector') as HTMLSelectElement;
        if (presetSel) {
          presetSel.value = presetId;
          presetSel.dispatchEvent(new Event('change'));
        }
      },
      onDismiss: () => {
        galleryEl.remove();
        sidebar.style.display = '';
      },
    });
  }
});

// Header Help button (opens Help Panel)
try {
  const headerHelp = document.getElementById('btnHeaderHelp') as HTMLButtonElement | null;
  if (headerHelp) {
    headerHelp.addEventListener('click', async () => {
      try {
        const mod = await import('./components/help/HelpPanel');
        mod.initHelpPanel({
          highlighter: (parts?: string[] | null) => {
            const part = (parts && (parts[0] as any)) as any;
            try {
              sword.setHighlight(part ?? null);
            } catch {}
          },
        });
        mod.openHelpPanel();
      } catch {}
    });
  }
} catch {}

// Hot module cleanup
if (import.meta && (import.meta as any).hot) {
  (import.meta as any).hot.dispose(() => {
    disposed = true;
    window.removeEventListener('resize', onResize);
    dispose();
  });
}

// Theme presets (UI-only; not exported in JSON)
type Theme = { base: number; target: number; brightness: number };
const themes: Record<string, Theme> = {
  midnight: { base: 0x0f1115, target: 0x3a3f4a, brightness: 0.0 },
  slate: { base: 0x12151b, target: 0x3a3f4a, brightness: 0.45 },
  steel: { base: 0x111214, target: 0x8b949e, brightness: 0.35 },
  warm: { base: 0x1b1210, target: 0x7a3f2c, brightness: 0.45 },
  ocean: { base: 0x0a0f1a, target: 0x254566, brightness: 0.55 },
  forest: { base: 0x0d120e, target: 0x355a3a, brightness: 0.5 },
  sepia: { base: 0x14110d, target: 0x6b5438, brightness: 0.5 },
  graphite: { base: 0x0f0f11, target: 0x2e2f36, brightness: 0.3 },
};

function applyTheme(key: string) {
  const t = themes[key] || themes.midnight;
  renderHooks.setBackgroundColor(t.base);
  (renderHooks as any).setBackgroundTargetColor?.(t.target);
  renderHooks.setBackgroundBrightness(t.brightness);
}

if (themeSel) {
  themeSel.addEventListener('change', () => applyTheme(themeSel.value));
  applyTheme(themeSel.value || 'midnight');
}
