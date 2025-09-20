/*
  Minimal, framework-free help system for contextual micro-tooltips and popovers.
  Phase 1 goals:
  - Attach a short summary tooltip to control labels (hover/focus)
  - Open a richer popover on '?' icon click using docs looked up by helpId (row.dataset.field)
  - Call an optional highlighter callback with parts while popover is open
*/

export type HelpDoc = {
  id: string;
  label: string;
  summary: string;
  details?: string[];
  parts?: string[]; // e.g., ['blade']
  dependsOn?: string[];
  affects?: string[];
  related?: string[];
  warnings?: string[];
  tryThis?: Array<{ label: string }>;
};

type Highlighter = (parts: string[] | null) => void;

const docs = new Map<string, HelpDoc>();
let highlighter: Highlighter | null = null;
let stylesInjected = false;
function track(event: string, data?: any) {
  try {
    const w = window as any;
    w.__smkHelpEvents = w.__smkHelpEvents || [];
    w.__smkHelpEvents.push({ t: Date.now(), event, data });
  } catch {}
}

export function initHelp(opts?: { highlighter?: Highlighter; seedDocs?: HelpDoc[] }) {
  if (opts?.highlighter) highlighter = opts.highlighter;
  if (opts?.seedDocs?.length) addDocs(opts.seedDocs);
  ensureStyles();
}

export function setHighlighter(cb: Highlighter | null) { highlighter = cb; }
export function addDoc(doc: HelpDoc) { docs.set(doc.id, doc); }
export function addDocs(list: HelpDoc[]) { for (const d of list) docs.set(d.id, d); }
function synthesizeDoc(id: string): HelpDoc | undefined {
  // Per-side fuller slots
  let m = id.match(/^blade\.(left|right)-f([1-3])-(width|offset|taper)$/);
  if (m) {
    const side = m[1]; const idx = m[2]; const kind = m[3];
    if (kind === 'width') {
      return { id, label: `${side} F${idx} Width`, summary: 'Groove width on this face (scene units).', details: ['Wider grooves lighten the blade visually.', 'Keep within the face boundary.'], parts: ['blade'] };
    } else if (kind === 'offset') {
      return { id, label: `${side} F${idx} Offset`, summary: 'Lateral offset from spine (− left, + right).', details: ['Use modest offsets to avoid clipping.', 'Negative toward left (−X), positive toward right (+X).'], parts: ['blade'] };
    } else if (kind === 'taper') {
      return { id, label: `${side} F${idx} Taper`, summary: 'Taper the groove width toward the tip.', details: ['0 flat; 1 narrows along length.'], parts: ['blade'] };
    }
  }
  // Guard extras: side rings and loops
  if (id === 'guard.side-rings') return { id, label: 'Side Rings', summary: 'Enable circular side rings on the guard.', details: ['Adds rings to both sides of the guard arms.'], parts: ['guard'] };
  if (id === 'guard.ring-radius') return { id, label: 'Ring Radius', summary: 'Radius of the side ring.', details: ['Controls ring size relative to guard.'], parts: ['guard'] };
  if (id === 'guard.ring-thick') return { id, label: 'Ring Thick', summary: 'Tube thickness of the side ring.', details: ['Higher values look heavier/robust.'], parts: ['guard'] };
  if (id === 'guard.ring-offsety') return { id, label: 'Ring OffsetY', summary: 'Vertical offset along the blade.', details: ['Moves rings up/down along the blade axis.'], parts: ['guard'] };
  if (id === 'guard.loops') return { id, label: 'Loops', summary: 'Enable wire loops on the guard.', details: ['Loops sit nearer the blade than side rings.'], parts: ['guard'] };
  if (id === 'guard.loop-radius') return { id, label: 'Loop Radius', summary: 'Radius of the loop.', details: ['Controls loop size relative to guard.'], parts: ['guard'] };
  if (id === 'guard.loop-thick') return { id, label: 'Loop Thick', summary: 'Tube thickness of the loop.', details: ['Higher values look heavier/robust.'], parts: ['guard'] };
  if (id === 'guard.loop-offsety') return { id, label: 'Loop OffsetY', summary: 'Vertical offset along the blade.', details: ['Moves loops up/down along the blade axis.'], parts: ['guard'] };
  return undefined;
}

export function getDoc(id: string): HelpDoc | undefined { return docs.get(id) || synthesizeDoc(id); }
export function listDocs(): HelpDoc[] { return Array.from(docs.values()); }

// Simple one-at-a-time tooltip and popover instances
let activeTooltip: HTMLElement | null = null;
let activePopover: HTMLElement | null = null;
let activePopoverAnchor: HTMLElement | null = null;
let lastFocusEl: HTMLElement | null = null;

function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = document.createElement('style');
  css.textContent = `
  .smk-tooltip{position:fixed;z-index:10000;max-width:280px;background:#111827;color:#e5e7eb;border:1px solid #374151;border-radius:6px;padding:6px 8px;font:12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji'; box-shadow:0 6px 28px rgba(0,0,0,.35)}
  .smk-popover{position:fixed;z-index:10001;max-width:360px;background:#0b0f16;color:#e5e7eb;border:1px solid #283141;border-radius:8px;padding:8px 10px;box-shadow:0 10px 40px rgba(0,0,0,.45)}
  .smk-popover h4{margin:0 24px 6px 0;font-size:13px;color:#f3f4f6}
  .smk-popover .smk-close{position:absolute;right:6px;top:4px;background:transparent;border:0;color:#9ca3af;cursor:pointer;font-size:16px}
  .smk-popover ul{margin:6px 0 0 16px;padding:0}
  .smk-popover li{margin:0 0 4px 0;font-size:12px;color:#c7d2fe}
  .smk-popover .smk-meta{margin-top:6px;font-size:11px;color:#9ca3af}
  @keyframes smk-focus-flash { 0% { box-shadow:0 0 0 0 rgba(96,165,250,.85) } 60% { box-shadow:0 0 0 6px rgba(96,165,250,.25) } 100% { box-shadow:0 0 0 0 rgba(96,165,250,0) } }
  .smk-focus-flash{ outline:2px solid #60a5fa; border-radius:8px; animation: smk-focus-flash 900ms ease-out 1 }
  `;
  document.head.appendChild(css);
}

function destroyTooltip() {
  activeTooltip?.remove();
  activeTooltip = null;
}

function positionNear(anchor: HTMLElement, el: HTMLElement, prefer: 'below' | 'above' = 'below') {
  const rect = anchor.getBoundingClientRect();
  const pad = 6;
  const top = prefer === 'below' ? rect.bottom + pad : Math.max(8, rect.top - el.offsetHeight - pad);
  const left = Math.min(window.innerWidth - el.offsetWidth - 8, Math.max(8, rect.left));
  el.style.top = `${Math.round(top)}px`;
  el.style.left = `${Math.round(left)}px`;
}

function showTooltip(anchor: HTMLElement, text: string) {
  destroyTooltip();
  if (!text) return;
  const tip = document.createElement('div');
  tip.className = 'smk-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.textContent = text;
  document.body.appendChild(tip);
  positionNear(anchor, tip, 'above');
  activeTooltip = tip;
}

function destroyPopover() {
  if (activePopover && activePopover.contains(document.activeElement)) {
    // restore focus back to trigger
    activePopoverAnchor?.focus?.();
  }
  try { (activePopover as any)?.hidePopover?.() } catch {}
  activePopover?.remove();
  activePopover = null;
  activePopoverAnchor = null;
  if (highlighter) highlighter(null);
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('mousedown', onOutsideClick, true);
}

function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') destroyPopover(); }
function onOutsideClick(e: MouseEvent) {
  const t = e.target as Node | null;
  if (t && activePopover && !activePopover.contains(t) && t !== activePopoverAnchor) destroyPopover();
}

function findRow(el: HTMLElement | null): HTMLElement | null {
  let cur: HTMLElement | null = el;
  while (cur) { if (cur.classList?.contains('row')) return cur; cur = cur.parentElement; }
  return null;
}

function focusFirstControl(row: HTMLElement | null) {
  if (row) {
    try { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
    row.classList.add('smk-focus-flash');
    setTimeout(() => row.classList.remove('smk-focus-flash'), 1000);
  }
  const el = row?.querySelector('input, select, textarea, button') as HTMLElement | null;
  (el || row || activePopoverAnchor || document.body).focus?.();
}

function simpleTryThis(row: HTMLElement | null) {
  if (!row) return;
  const range = row.querySelector('input[type="range"]') as HTMLInputElement | null;
  const number = row.querySelector('input[type="number"]') as HTMLInputElement | null;
  const select = row.querySelector('select') as HTMLSelectElement | null;
  const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
  // Range/number pair: animate min → max → original
  if (range) {
    const orig = range.value;
    const min = range.min || '0';
    const max = range.max || '1';
    const stepSet = (v: string) => { range.value = v; range.dispatchEvent(new Event('input', { bubbles: true })); number && (number.value = v); };
    stepSet(min);
    setTimeout(() => stepSet(max), 450);
    setTimeout(() => stepSet(orig), 900);
    setTimeout(() => range.dispatchEvent(new Event('change', { bubbles: true })), 950);
    return;
  }
  if (select) {
    const orig = select.selectedIndex;
    const next = (orig + 1) % Math.max(1, select.options.length);
    select.selectedIndex = next; select.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(() => { select.selectedIndex = orig; select.dispatchEvent(new Event('change', { bubbles: true })); }, 800);
    return;
  }
  if (checkbox) {
    const orig = checkbox.checked;
    checkbox.checked = !orig; checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(() => { checkbox.checked = orig; checkbox.dispatchEvent(new Event('change', { bubbles: true })); }, 700);
  }
}

function openPopover(anchor: HTMLElement, doc: HelpDoc, labelText?: string) {
  destroyPopover();
  const pop = document.createElement('div');
  pop.className = 'smk-popover';
  pop.setAttribute('role', 'dialog');
  const title = document.createElement('h4');
  title.id = 'smk-popover-title';
  title.textContent = doc.label || labelText || doc.id;
  pop.appendChild(title);
  if (doc.details && doc.details.length) {
    const ul = document.createElement('ul');
    for (const d of doc.details.slice(0, 6)) { const li = document.createElement('li'); li.textContent = d; ul.appendChild(li); }
    pop.appendChild(ul);
  } else if (doc.summary) {
    const p = document.createElement('div'); p.textContent = doc.summary; p.style.fontSize = '12px'; p.style.color = '#c7d2fe'; pop.appendChild(p);
  }
  if (doc.dependsOn?.length || doc.affects?.length) {
    const meta = document.createElement('div'); meta.className = 'smk-meta';
    const parts: string[] = [];
    if (doc.dependsOn?.length) parts.push(`Depends: ${doc.dependsOn.join(', ')}`);
    if (doc.affects?.length) parts.push(`Affects: ${doc.affects.join(', ')}`);
    meta.textContent = parts.join(' • ');
    pop.appendChild(meta);
  }
  // Actions: focus + open in panel + try this + related
  const row = findRow(anchor);
  const actions = document.createElement('div');
  actions.style.marginTop = '8px';
  const focusBtn = document.createElement('button');
  focusBtn.textContent = 'Focus Control';
  focusBtn.type = 'button';
  focusBtn.addEventListener('click', () => focusFirstControl(row));
  actions.appendChild(focusBtn);
  const panelBtn = document.createElement('button');
  panelBtn.textContent = 'Open in Panel';
  panelBtn.type = 'button';
  panelBtn.style.marginLeft = '6px';
  panelBtn.addEventListener('click', async () => {
    try {
      const mod = await import('./HelpPanel');
      // Prefer opening with provided doc when registry lacks an entry
      if (!getDoc(doc.id)) {
        (mod as any).openHelpPanelWithDoc?.(doc);
      } else {
        (mod as any).openHelpPanel?.(doc.id);
      }
      destroyPopover();
    } catch {
      // Fallback: use hash deep link
      try { location.hash = `help=${encodeURIComponent(doc.id)}`; } catch {}
    }
  });
  actions.appendChild(panelBtn);
  if (doc.tryThis?.length) {
    const tryBtn = document.createElement('button');
    tryBtn.textContent = doc.tryThis[0].label || 'Try this';
    tryBtn.type = 'button';
    tryBtn.style.marginLeft = '6px';
    tryBtn.addEventListener('click', () => simpleTryThis(row));
    actions.appendChild(tryBtn);
  }
  if (doc.related?.length) {
    const rel = document.createElement('div');
    rel.className = 'smk-meta';
    rel.style.marginTop = '6px';
    rel.textContent = 'Related: ';
    for (const id of doc.related) {
      const chip = document.createElement('button');
      chip.type = 'button'; chip.textContent = id.split('.').slice(-1)[0];
      chip.style.marginRight = '4px'; chip.style.fontSize = '11px';
      chip.addEventListener('click', () => {
        const r = document.querySelector(`[data-field="${CSS.escape(id)}"]`) as HTMLElement | null;
        r?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const icon = r?.querySelector('.help-icon') as HTMLElement | null;
        if (icon) icon.click(); else focusFirstControl(r || null);
      });
      actions.appendChild(chip);
    }
  }
  pop.appendChild(actions);
  const btn = document.createElement('button');
  btn.className = 'smk-close'; btn.type = 'button'; btn.setAttribute('aria-label','Close help'); btn.textContent = '×';
  btn.addEventListener('click', () => destroyPopover());
  pop.appendChild(btn);
  document.body.appendChild(pop);
  try { (pop as any).setAttribute?.('popover','manual'); (pop as any).showPopover?.() } catch {}
  // Focus management & optional focus trap when interactive
  const focusableSel = 'a[href],button:not([disabled]),textarea,select,input:not([disabled]),[tabindex]:not([tabindex="-1"])'
  const focusables = Array.from(pop.querySelectorAll<HTMLElement>(focusableSel))
  if (focusables.length > 0) {
    pop.setAttribute('aria-modal', 'true')
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    // Move focus inside the popover
    setTimeout(() => { (first || pop).focus?.() }, 0)
    const onTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const active = document.activeElement as HTMLElement | null
      if (!active) return
      if (e.shiftKey) {
        if (active === first || !pop.contains(active)) { e.preventDefault(); (last || pop).focus?.() }
      } else {
        if (active === last || !pop.contains(active)) { e.preventDefault(); (first || pop).focus?.() }
      }
    }
    window.addEventListener('keydown', onTrap, true)
    // Clean up trap with destroy
    const prevDestroy = destroyPopover
    ;(destroyPopover as any) = function patchedDestroy() {
      window.removeEventListener('keydown', onTrap, true)
      ;(destroyPopover as any) = prevDestroy
      prevDestroy()
    }
  } else {
    // Non-interactive: allow plain reading and keep focus on trigger
    pop.setAttribute('aria-modal', 'false')
  }
  positionNear(anchor, pop, 'below');
  activePopover = pop;
  activePopoverAnchor = anchor;
  lastFocusEl = anchor;
  // highlight relevant parts while open
  if (highlighter && doc.parts?.length) highlighter(doc.parts);
  // global listeners
  setTimeout(() => {
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('mousedown', onOutsideClick, true);
  }, 0);
}

export function attachHelp(row: HTMLElement, labelEl: HTMLElement, helpIconEl?: HTMLElement | null, fallbackSummary?: string) {
  ensureStyles();
  const helpId = row.dataset.field || '';
  const doc = helpId ? getDoc(helpId) : undefined;
  // Dev-time diagnostics for missing docs
  if (!doc && helpId && (import.meta as any)?.env?.DEV) {
    try {
      const w = window as any;
      w.__smkMissingHelp = w.__smkMissingHelp || new Set();
      if (!w.__smkMissingHelp.has(helpId)) {
        w.__smkMissingHelp.add(helpId);
        // eslint-disable-next-line no-console
        console.warn('[help] Missing help doc for id:', helpId);
      }
    } catch {}
  }
  const summary = doc?.summary || fallbackSummary || '';

  // Micro-tooltip on label hover/focus
  let hoverTimer: number | null = null;
  const begin = () => {
    if (!summary) return;
    hoverTimer = window.setTimeout(() => {
      // Track first display per id per session
      try {
        const w = window as any;
        w.__smkTooltipShown = w.__smkTooltipShown || new Set();
        if (!w.__smkTooltipShown.has(helpId)) {
          w.__smkTooltipShown.add(helpId);
          track('help.tooltip_shown', { id: helpId });
        }
      } catch {}
      showTooltip(labelEl, summary)
    }, 180);
  };
  const end = () => { if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; } destroyTooltip(); };
  labelEl.addEventListener('mouseenter', begin);
  labelEl.addEventListener('mouseleave', end);
  labelEl.addEventListener('focus', begin);
  labelEl.addEventListener('blur', end);
  labelEl.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Escape') destroyTooltip(); });
  if (summary) track('help.tooltip_shown', { id: helpId });
  // Also surface tooltip for keyboard users when the control itself receives focus
  const kbdTarget = row.querySelector('input, select, textarea, button') as HTMLElement | null;
  if (kbdTarget) {
    kbdTarget.addEventListener('focus', () => { if (summary) showTooltip(labelEl, summary); });
    kbdTarget.addEventListener('blur', () => { destroyTooltip(); });
  }

  // If no icon supplied but a doc exists, auto-create a help icon
  if (!helpIconEl && (doc || summary)) {
    const icon = document.createElement('span');
    icon.className = 'help-icon';
    icon.textContent = '?';
    labelEl.appendChild(icon);
    helpIconEl = icon;
  }

  // Popover on '?' click
  if (helpIconEl) {
    helpIconEl.addEventListener('click', (e) => {
      e.stopPropagation(); e.preventDefault();
      const d = doc || { id: helpId, label: labelEl.textContent || helpId, summary: summary || '', details: [] } as HelpDoc;
      track('help.popover_opened', { id: d.id });
      openPopover(helpIconEl, d, labelEl.textContent || undefined);
    });
    // allow Enter/Space to open when focused
    helpIconEl.setAttribute('tabindex','0');
    helpIconEl.setAttribute('role','button');
    helpIconEl.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent; if (ke.key === 'Enter' || ke.key === ' ') { ke.preventDefault(); (helpIconEl as HTMLElement).click(); }
    });
  }
}

// Static docs moved to JSON (loaded at module init)
try {
  // Seed built-in docs so tooltips/popovers have content without extra wiring.
  // This JSON is generated/maintained by scripts/build-help-docs.mjs from docs/help/controls/*.md
  // and checked into the repo for now.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  import('./docs.json').then((mod) => {
    const list = (mod?.default || mod) as HelpDoc[] | undefined;
    if (Array.isArray(list) && list.length) addDocs(list);
  }).catch(() => {/* optional */});
} catch {/* ignore dynamic import issues in SSR/tests */}
