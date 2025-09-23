// Lightweight, dependency-free guided tour overlay
// Highlights elements by selector and shows a small tooltip with controls.

type Step = { selector?: string; title: string; body?: string };

let overlay: HTMLElement | null = null;
let highlight: HTMLElement | null = null;
let tooltip: HTMLElement | null = null;
let onKey: ((e: KeyboardEvent) => void) | null = null;
let steps: Step[] = [];
let i = 0;

function ensureStyles() {
  if (document.getElementById('smk-tour-css')) return;
  const css = document.createElement('style');
  css.id = 'smk-tour-css';
  css.textContent = `
  .smk-tour{ position:fixed; inset:0; z-index:10006; background:rgba(0,0,0,.45) }
  .smk-tour-box{ position:absolute; border:2px solid #60a5fa; border-radius:8px; box-shadow:0 0 0 3px rgba(96,165,250,.35) inset }
  .smk-tour-tip{ position:absolute; max-width:320px; background:#0b0f16; color:#e5e7eb; border:1px solid #283141; border-radius:8px; padding:8px 10px; font:13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Helvetica,Arial }
  .smk-tour-tip h4{ margin:0 0 6px 0; font-size:14px }
  .smk-tour-actions{ display:flex; gap:6px; margin-top:8px }
  .smk-tour-actions button{ background:#111827; color:#e5e7eb; border:1px solid #283141; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:12px }
  .smk-tour-actions button:hover{ background:#152238 }
  `;
  document.head.appendChild(css);
}

function endTour(completed = false) {
  try {
    (window as any).__smkHelpEvents = (window as any).__smkHelpEvents || [];
    (window as any).__smkHelpEvents.push({
      t: Date.now(),
      event: completed ? 'help.tour_completed' : 'help.tour_canceled',
    });
  } catch {}
  if (overlay) overlay.remove();
  overlay = null;
  highlight = null;
  tooltip = null;
  if (onKey) window.removeEventListener('keydown', onKey, true);
  onKey = null;
}

function placeFor(el: HTMLElement | null) {
  if (!overlay || !highlight || !tooltip) return;
  const r = el?.getBoundingClientRect?.() || {
    left: window.innerWidth * 0.5 - 120,
    top: window.innerHeight * 0.5 - 40,
    width: 240,
    height: 80,
  };
  highlight.style.left = `${Math.round(r.left - 4)}px`;
  highlight.style.top = `${Math.round(r.top - 4)}px`;
  highlight.style.width = `${Math.round(r.width + 8)}px`;
  highlight.style.height = `${Math.round(r.height + 8)}px`;
  // Tooltip default below box
  const tipW = Math.min(320, Math.max(200, Math.round(r.width)));
  tooltip.style.width = `${tipW}px`;
  let tx = r.left;
  let ty = r.bottom + 8;
  if (ty + 140 > window.innerHeight) ty = r.top - 8 - 140;
  if (ty < 8) ty = 8;
  if (tx + tipW > window.innerWidth - 8) tx = window.innerWidth - 8 - tipW;
  if (tx < 8) tx = 8;
  tooltip.style.left = `${Math.round(tx)}px`;
  tooltip.style.top = `${Math.round(ty)}px`;
}

function renderStep() {
  const step = steps[i];
  const el = step.selector ? (document.querySelector(step.selector) as HTMLElement | null) : null;
  const title = tooltip!.querySelector('.smk-tour-title') as HTMLElement;
  const body = tooltip!.querySelector('.smk-tour-body') as HTMLElement;
  title.textContent = step.title;
  body.textContent = step.body || '';
  placeFor(el);
}

function startTour(def: Step[]) {
  ensureStyles();
  steps = def;
  i = 0;
  overlay = document.createElement('div');
  overlay.className = 'smk-tour';
  const box = document.createElement('div');
  box.className = 'smk-tour-box';
  const tip = document.createElement('div');
  tip.className = 'smk-tour-tip';
  tip.innerHTML = `<h4 class="smk-tour-title"></h4><div class="smk-tour-body"></div>`;
  const actions = document.createElement('div');
  actions.className = 'smk-tour-actions';
  const prev = document.createElement('button');
  prev.textContent = 'Back';
  prev.addEventListener('click', () => {
    i = Math.max(0, i - 1);
    renderStep();
  });
  const next = document.createElement('button');
  next.textContent = 'Next';
  next.addEventListener('click', () => {
    if (i < steps.length - 1) {
      i++;
      renderStep();
    } else {
      endTour(true);
    }
  });
  const skip = document.createElement('button');
  skip.textContent = 'Skip';
  skip.addEventListener('click', () => endTour(false));
  actions.appendChild(prev);
  actions.appendChild(next);
  actions.appendChild(skip);
  tip.appendChild(actions);
  overlay.appendChild(box);
  overlay.appendChild(tip);
  document.body.appendChild(overlay);
  highlight = box;
  tooltip = tip;
  try {
    (window as any).__smkHelpEvents = (window as any).__smkHelpEvents || [];
    (window as any).__smkHelpEvents.push({ t: Date.now(), event: 'help.tour_started' });
  } catch {}
  onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      endTour(false);
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'n' || e.key === 'Enter') {
      e.preventDefault();
      if (i < steps.length - 1) {
        i++;
        renderStep();
      } else {
        endTour(true);
      }
    }
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'b') {
      e.preventDefault();
      i = Math.max(0, i - 1);
      renderStep();
    }
  };
  window.addEventListener('keydown', onKey!, true);
  renderStep();
}

export function startIntroTour() {
  // Build a minimal intro tour
  const def: Step[] = [
    {
      selector: '#scene',
      title: 'Viewport',
      body: 'Drag to orbit. Mouse wheel to zoom. Use Auto Spin for turntable.',
    },
    { selector: '.tabs', title: 'Tabs', body: 'Switch between Model and Render controls.' },
    {
      selector: '#sidebar .row',
      title: 'Controls',
      body: 'Most controls have a ? icon. Hover labels for micro-tooltips; click ? for details.',
    },
    {
      selector: '.toolbar .dropdown',
      title: 'Export',
      body: 'Export GLB/OBJ/STL, plus SVG blueprint.',
    },
    {
      selector: '.toolbar button:nth-of-type(1)',
      title: 'Help',
      body: 'Open Help (Cmd/Ctrl+/). Search with Cmd/Ctrl+K.',
    },
    {
      selector: '.toolbar button:nth-of-type(2)',
      title: 'Explain Mode',
      body: 'Toggle labels in the viewport; click a label to open Help.',
    },
  ];
  startTour(def);
}
