// Task-guided tours that walk users through multi-step operations.
// Unlike the intro tour (read-only), these tours can apply parameter changes.

type TaskStep = {
  selector?: string;
  title: string;
  body?: string;
  /** If provided, apply these state changes when the step is reached. */
  apply?: (ctx: TaskTourContext) => void;
};

type TaskTourContext = {
  state: any; // SwordParams
  rerender: () => void;
  syncUi: () => void;
};

let overlay: HTMLElement | null = null;
let highlight: HTMLElement | null = null;
let tooltip: HTMLElement | null = null;
let onKey: ((e: KeyboardEvent) => void) | null = null;
let steps: TaskStep[] = [];
let stepIndex = 0;
let ctx: TaskTourContext | null = null;

function ensureStyles() {
  if (document.getElementById('smk-task-tour-css')) return;
  const css = document.createElement('style');
  css.id = 'smk-task-tour-css';
  css.textContent = `
  .smk-task-tour{ position:fixed; inset:0; z-index:10006; pointer-events:none }
  .smk-task-tour-box{ position:absolute; border:2px solid #34d399; border-radius:8px; box-shadow:0 0 0 3px rgba(52,211,153,.3) inset; pointer-events:none }
  .smk-task-tour-tip{ position:absolute; max-width:340px; background:#0b0f16; color:#e5e7eb; border:1px solid #1e3a2f; border-radius:8px; padding:10px 12px; font:13px/1.4 system-ui,-apple-system,Segoe UI,Roboto; pointer-events:auto; box-shadow: 0 4px 12px rgba(0,0,0,.4) }
  .smk-task-tour-tip h4{ margin:0 0 6px 0; font-size:14px; color:#34d399 }
  .smk-task-tour-tip .step-counter{ font-size:11px; color:#64748b; margin-bottom:4px }
  .smk-task-tour-actions{ display:flex; gap:6px; margin-top:10px }
  .smk-task-tour-actions button{ background:#111827; color:#e5e7eb; border:1px solid #283141; border-radius:6px; padding:5px 10px; cursor:pointer; font-size:12px }
  .smk-task-tour-actions button:hover{ background:#152238 }
  .smk-task-tour-actions button.primary{ background:#065f46; border-color:#34d399 }
  .smk-task-tour-actions button.primary:hover{ background:#047857 }
  `;
  document.head.appendChild(css);
}

function endTour() {
  if (overlay) overlay.remove();
  overlay = null;
  highlight = null;
  tooltip = null;
  ctx = null;
  if (onKey) window.removeEventListener('keydown', onKey, true);
  onKey = null;
}

function placeFor(el: HTMLElement | null) {
  if (!overlay || !highlight || !tooltip) return;
  const r = el?.getBoundingClientRect?.() || {
    left: window.innerWidth * 0.5 - 140,
    top: window.innerHeight * 0.5 - 50,
    width: 280,
    height: 100,
  };
  highlight.style.left = `${Math.round(r.left - 4)}px`;
  highlight.style.top = `${Math.round(r.top - 4)}px`;
  highlight.style.width = `${Math.round(r.width + 8)}px`;
  highlight.style.height = `${Math.round(r.height + 8)}px`;
  const tipW = 320;
  tooltip.style.width = `${tipW}px`;
  let tx = r.left;
  let ty = r.bottom + 10;
  if (ty + 160 > window.innerHeight) ty = r.top - 10 - 160;
  if (ty < 8) ty = 8;
  if (tx + tipW > window.innerWidth - 8) tx = window.innerWidth - 8 - tipW;
  if (tx < 8) tx = 8;
  tooltip.style.left = `${Math.round(tx)}px`;
  tooltip.style.top = `${Math.round(ty)}px`;
}

function renderStep() {
  const step = steps[stepIndex];
  if (!step || !tooltip) return;
  const el = step.selector
    ? (document.querySelector(step.selector) as HTMLElement | null)
    : null;
  // Scroll the target into view if in sidebar
  if (el) {
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {}
  }
  const counter = tooltip.querySelector('.step-counter') as HTMLElement;
  const title = tooltip.querySelector('.smk-task-tour-title') as HTMLElement;
  const body = tooltip.querySelector('.smk-task-tour-body') as HTMLElement;
  const nextBtn = tooltip.querySelector('.btn-next') as HTMLButtonElement;
  counter.textContent = `Step ${stepIndex + 1} of ${steps.length}`;
  title.textContent = step.title;
  body.textContent = step.body || '';
  nextBtn.textContent = stepIndex < steps.length - 1 ? 'Next' : 'Done';
  // Apply parameter changes if this step has them
  if (step.apply && ctx) {
    step.apply(ctx);
    ctx.rerender();
    requestAnimationFrame(() => {
      ctx?.syncUi();
      // Re-place after DOM may have shifted
      setTimeout(() => placeFor(el), 100);
    });
  } else {
    placeFor(el);
  }
}

function startTaskTour(def: TaskStep[], context: TaskTourContext) {
  ensureStyles();
  steps = def;
  stepIndex = 0;
  ctx = context;
  overlay = document.createElement('div');
  overlay.className = 'smk-task-tour';
  const box = document.createElement('div');
  box.className = 'smk-task-tour-box';
  const tip = document.createElement('div');
  tip.className = 'smk-task-tour-tip';
  tip.innerHTML = `
    <div class="step-counter"></div>
    <h4 class="smk-task-tour-title"></h4>
    <div class="smk-task-tour-body"></div>
  `;
  const actions = document.createElement('div');
  actions.className = 'smk-task-tour-actions';
  const prev = document.createElement('button');
  prev.textContent = 'Back';
  prev.addEventListener('click', () => {
    stepIndex = Math.max(0, stepIndex - 1);
    renderStep();
  });
  const next = document.createElement('button');
  next.className = 'btn-next primary';
  next.addEventListener('click', () => {
    if (stepIndex < steps.length - 1) {
      stepIndex++;
      renderStep();
    } else {
      endTour();
    }
  });
  const skip = document.createElement('button');
  skip.textContent = 'Skip';
  skip.addEventListener('click', () => endTour());
  actions.appendChild(prev);
  actions.appendChild(next);
  actions.appendChild(skip);
  tip.appendChild(actions);
  overlay.appendChild(box);
  overlay.appendChild(tip);
  document.body.appendChild(overlay);
  highlight = box;
  tooltip = tip;
  onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { endTour(); e.preventDefault(); return; }
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      if (stepIndex < steps.length - 1) { stepIndex++; renderStep(); }
      else endTour();
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stepIndex = Math.max(0, stepIndex - 1);
      renderStep();
    }
  };
  window.addEventListener('keydown', onKey!, true);
  renderStep();
}

// ---- Tour Definitions ----

export function startLeafBladeTour(context: TaskTourContext) {
  const tour: TaskStep[] = [
    {
      selector: '[data-field-namespace="blade"] h2',
      title: 'Make a Leaf Blade',
      body: 'This guide will walk you through creating a leaf-shaped blade by adjusting a few key parameters.',
    },
    {
      selector: '[data-field="blade-tip-shape"]',
      title: 'Set Tip Shape to "Leaf"',
      body: 'The leaf tip shape widens the blade mid-length before tapering to a point, like a willow leaf.',
      apply: ({ state }) => {
        state.blade.tipShape = 'leaf';
      },
    },
    {
      selector: '[data-field="blade-tip-bulge"]',
      title: 'Increase Tip Bulge',
      body: 'Tip Bulge controls how much the leaf widens. Higher values create a more pronounced leaf shape.',
      apply: ({ state }) => {
        state.blade.tipBulge = 0.55;
      },
    },
    {
      selector: '[data-field="blade-base-width"]',
      title: 'Narrow the Base',
      body: 'A narrower base emphasizes the leaf silhouette. The blade will taper in from the guard then bulge out.',
      apply: ({ state }) => {
        state.blade.baseWidth = 0.18;
      },
    },
    {
      selector: '[data-field="blade-blade-length"]',
      title: 'Adjust Length',
      body: 'Leaf blades work well at moderate lengths. Try 2.2–2.8 for a classic gladius-style proportions.',
      apply: ({ state }) => {
        state.blade.length = 2.4;
      },
    },
    {
      selector: '[data-field="blade-tip-width"]',
      title: 'Fine-tune Tip Width',
      body: 'Set the tip width to a fine point. This, combined with the leaf bulge, gives the characteristic taper.',
      apply: ({ state }) => {
        state.blade.tipWidth = 0.03;
      },
    },
    {
      selector: '#scene',
      title: 'Your Leaf Blade',
      body: 'Your leaf blade is ready! Try adjusting Curvature for a curved leaf, or enable Fullers for a more refined look. You can always undo changes with a preset.',
    },
  ];
  startTaskTour(tour, context);
}

export function startExportSTLTour(context: TaskTourContext) {
  const tour: TaskStep[] = [
    {
      selector: '#scene',
      title: 'Export to STL for 3D Printing',
      body: 'This guide walks you through exporting your sword as a watertight STL file suitable for 3D printing.',
    },
    {
      selector: '.toolbar .dropdown',
      title: 'Find the Export Menu',
      body: 'Click the "Export" dropdown in the toolbar. You\'ll see options for GLB, OBJ, STL, SVG, and JSON.',
    },
    {
      selector: '.toolbar .dropdown',
      title: 'Choose STL',
      body: 'Click "STL" to export. The STL exporter automatically builds a print-safe, watertight mesh from the solid parts (blade, guard, handle, pommel).',
    },
    {
      selector: '#scene',
      title: 'Print Tips',
      body: 'For best results: (1) Print vertically with the tip up. (2) Use supports for the guard. (3) Scale in your slicer — 1 unit ≈ 10cm works well for display pieces.',
    },
  ];
  startTaskTour(tour, context);
}

/** All available task tours. */
export const taskTours = [
  { id: 'leaf-blade', label: 'Make a Leaf Blade', start: startLeafBladeTour },
  { id: 'export-stl', label: 'Export to STL', start: startExportSTLTour },
] as const;
