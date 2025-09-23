import { getDoc, listDocs, type HelpDoc } from './HelpRegistry';

type Highlighter = (parts: string[] | null) => void;

let panelEl: HTMLElement | null = null;
let overlayEl: HTMLElement | null = null;
let contentEl: HTMLElement | null = null;
let searchEl: HTMLElement | null = null;
let searchInput: HTMLInputElement | null = null;
let highlighter: Highlighter | null = null;
let stylesInjected = false;
let lastSearchQuery = '';
const SYNONYMS: Record<string, string[]> = {
  fuller: ['rib', 'blood groove', 'groove'],
  bloom: ['glow', 'glare'],
  outline: ['edge lines', 'ink', 'contour'],
  ink: ['outline', 'contour'],
  vignette: ['darken corners', 'corner fade'],
  curvature: ['sori', 'curve'],
  sori: ['curvature', 'curve'],
  anisotropy: ['brushed', 'polish', 'directional polish'],
  quillon: ['guard', 'quillons'],
  quillons: ['quillon', 'guard'],
  tip: ['point', 'blade tip'],
  fillet: ['blend', 'guard'],
};

function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = document.createElement('style');
  css.textContent = `
  .smk-help-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.25); z-index:10002; opacity:0; pointer-events:none; transition:opacity .2s ease }
  .smk-help-overlay.open{ opacity:1; pointer-events:auto }
  .smk-help-panel{ position:fixed; top:0; right:-420px; width:420px; height:100vh; background:#0b0f16; color:#e5e7eb; border-left:1px solid #283141; box-shadow:-10px 0 40px rgba(0,0,0,.45); z-index:10003; transition:right .2s ease; display:flex; flex-direction:column }
  .smk-help-panel.open{ right:0 }
  .smk-help-header{ display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid #223041 }
  .smk-help-header h3{ margin:0; font-size:14px; font-weight:600; color:#f3f4f6 }
  .smk-help-close{ background:transparent; color:#9ca3af; border:0; font-size:18px; cursor:pointer }
  .smk-help-body{ padding:12px; overflow:auto; font-size:13px; line-height:1.5 }
  .smk-help-body ul{ margin:8px 0 0 18px; padding:0 }
  .smk-help-body li{ margin:0 0 6px 0; color:#c7d2fe }
  .smk-chips{ margin-top:8px; display:flex; gap:6px; flex-wrap:wrap }
  .smk-chip{ font-size:11px; background:#111827; border:1px solid #283141; color:#e5e7eb; padding:2px 6px; border-radius:999px; cursor:pointer }
  .smk-chip:hover{ background:#172133 }
  .smk-meta{ margin-top:8px; color:#9ca3af; font-size:11px }
  .smk-help-header button{ margin-left:6px }
  .smk-search{ position:fixed; inset:0; display:none; align-items:flex-start; justify-content:center; background:rgba(0,0,0,.35); z-index:10005 }
  .smk-search.open{ display:flex }
  .smk-search-box{ margin-top:10vh; width:640px; background:#0b0f16; border:1px solid #283141; border-radius:10px; overflow:hidden; box-shadow:0 30px 60px rgba(0,0,0,.5) }
  .smk-search-input{ width:100%; box-sizing:border-box; padding:12px 14px; border:0; outline:none; background:#0f1622; color:#e5e7eb; font-size:14px }
  .smk-search-results{ max-height:50vh; overflow:auto }
  .smk-result{ padding:10px 12px; border-top:1px solid #1b2636; cursor:pointer }
  .smk-result:hover, .smk-result.active{ background:#101a2b }
  .smk-hit{ background:rgba(96,165,250,.2); border-bottom:1px solid rgba(96,165,250,.6) }
  `;
  document.head.appendChild(css);
}

function wrapHits(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(esc, 'ig'), (m) => `<span class="smk-hit">${m}</span>`);
}

function renderDoc(doc: HelpDoc) {
  if (!contentEl) return;
  contentEl.innerHTML = '';
  const title = document.createElement('h3');
  title.textContent = doc.label || doc.id;
  const header = document.createElement('div');
  header.className = 'smk-help-header';
  header.appendChild(title);
  const close = document.createElement('button');
  close.className = 'smk-help-close';
  close.setAttribute('aria-label', 'Close help panel');
  close.textContent = '×';
  close.addEventListener('click', closePanel);
  header.appendChild(close);
  if (doc.id !== 'help.index') {
    const copy = document.createElement('button');
    copy.className = 'smk-help-close';
    copy.setAttribute('aria-label', 'Copy deep link');
    copy.textContent = '🔗';
    copy.style.marginRight = '8px';
    copy.addEventListener('click', async () => {
      const hash = `help=${encodeURIComponent(doc.id)}`;
      try {
        location.hash = hash;
      } catch {}
      try {
        await navigator.clipboard?.writeText(`#${hash}`);
      } catch {}
    });
    header.insertBefore(copy, close);
  }

  const body = document.createElement('div');
  body.className = 'smk-help-body';
  if (doc.id === 'help.index') {
    // Add quick actions on index
    const actions = document.createElement('div');
    actions.className = 'smk-chips';
    const btnIntro = document.createElement('button');
    btnIntro.className = 'smk-chip';
    btnIntro.textContent = 'Start Intro Tour';
    btnIntro.addEventListener('click', async () => {
      try {
        const mod = await import('./HelpTourDriver');
        (mod as any).startIntroTourDriver?.();
        return;
      } catch {}
      try {
        const mod = await import('./HelpTour');
        (mod as any).startIntroTour?.();
      } catch {}
    });
    actions.appendChild(btnIntro);
    const btnTask = document.createElement('button');
    btnTask.className = 'smk-chip';
    btnTask.textContent = 'Guide: Add a Fuller';
    btnTask.addEventListener('click', async () => {
      try {
        const mod = await import('./HelpTourDriver');
        (mod as any).startAddFullerTourDriver?.();
        return;
      } catch {}
      try {
        const mod = await import('./HelpTour');
        (mod as any).startIntroTour?.();
      } catch {}
    });
    actions.appendChild(btnTask);
    const btnLeaf = document.createElement('button');
    btnLeaf.className = 'smk-chip';
    btnLeaf.textContent = 'Guide: Make a Leaf Blade';
    btnLeaf.addEventListener('click', async () => {
      try {
        const mod = await import('./HelpTourDriver');
        (mod as any).startLeafBladeTourDriver?.();
        return;
      } catch {}
    });
    actions.appendChild(btnLeaf);
    const btnStl = document.createElement('button');
    btnStl.className = 'smk-chip';
    btnStl.textContent = 'Guide: Export to STL';
    btnStl.addEventListener('click', async () => {
      try {
        const mod = await import('./HelpTourDriver');
        (mod as any).startExportStlTourDriver?.();
        return;
      } catch {}
    });
    actions.appendChild(btnStl);
    body.appendChild(actions);
    renderIndex(body);
    const container = document.createElement('div');
    container.appendChild(header);
    container.appendChild(body);
    contentEl.appendChild(container);
    return;
  }
  if (doc.summary) {
    const p = document.createElement('div');
    p.innerHTML = wrapHits(doc.summary, lastSearchQuery);
    body.appendChild(p);
  }
  if (doc.details?.length) {
    const ul = document.createElement('ul');
    for (const d of doc.details.slice(0, 8)) {
      const li = document.createElement('li');
      li.innerHTML = wrapHits(d, lastSearchQuery);
      ul.appendChild(li);
    }
    body.appendChild(ul);
  }
  if (doc.parts?.length) {
    const chips = document.createElement('div');
    chips.className = 'smk-chips';
    for (const p of doc.parts) {
      const chip = document.createElement('button');
      chip.className = 'smk-chip';
      chip.textContent = p;
      chip.addEventListener('mouseenter', () => highlighter?.([p]));
      chip.addEventListener('mouseleave', () => highlighter?.(null));
      chips.appendChild(chip);
    }
    body.appendChild(chips);
  }
  if (doc.related?.length) {
    const relLabel = document.createElement('div');
    relLabel.className = 'smk-meta';
    relLabel.textContent = 'Related:';
    const chips = document.createElement('div');
    chips.className = 'smk-chips';
    for (const id of doc.related) {
      const chip = document.createElement('button');
      chip.className = 'smk-chip';
      chip.textContent = id.split('.').slice(-1)[0];
      chip.addEventListener('click', () => openById(id));
      chips.appendChild(chip);
    }
    body.appendChild(relLabel);
    body.appendChild(chips);
  }
  const metaParts: string[] = [];
  if (doc.dependsOn?.length) metaParts.push(`Depends: ${doc.dependsOn.join(', ')}`);
  if (doc.affects?.length) metaParts.push(`Affects: ${doc.affects.join(', ')}`);
  if (metaParts.length) {
    const meta = document.createElement('div');
    meta.className = 'smk-meta';
    meta.textContent = metaParts.join(' • ');
    body.appendChild(meta);
  }

  const container = document.createElement('div');
  container.appendChild(header);
  container.appendChild(body);
  contentEl.appendChild(container);
}

function renderIndex(body: HTMLElement) {
  const docs = listDocs()
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  // Group by top-level prefix
  const groups = new Map<string, HelpDoc[]>();
  for (const d of docs) {
    const key = (d.id.split('.')[0] || 'other').toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }
  const intro = document.createElement('div');
  intro.textContent = 'Browse topics or press Cmd/Ctrl+K to search.';
  body.appendChild(intro);
  for (const [group, list] of Array.from(groups.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const h = document.createElement('div');
    h.className = 'smk-meta';
    h.textContent = group.toUpperCase();
    body.appendChild(h);
    const chips = document.createElement('div');
    chips.className = 'smk-chips';
    for (const d of list) {
      const chip = document.createElement('button');
      chip.className = 'smk-chip';
      chip.textContent = d.label || d.id;
      chip.addEventListener('click', () => openById(d.id));
      chips.appendChild(chip);
    }
    body.appendChild(chips);
  }
  // Analytics summary (dev): most opened topics and no-result queries
  try {
    const w = window as any;
    const ev: Array<{ event: string; data?: any }> = w.__smkHelpEvents || [];
    const byTopic = new Map<string, number>();
    const noResult = new Map<string, number>();
    for (const e of ev) {
      if (
        e.event === 'help.popover_opened' ||
        e.event === 'help.panel_opened' ||
        e.event === 'help.search_result_opened'
      ) {
        const id = e.data?.id;
        if (id) byTopic.set(id, (byTopic.get(id) || 0) + 1);
      }
      if (e.event === 'help.search_no_result') {
        const q = (e.data?.q || '').trim().toLowerCase();
        if (q) noResult.set(q, (noResult.get(q) || 0) + 1);
      }
    }
    const topTopics = Array.from(byTopic.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topNoRes = Array.from(noResult.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if ((import.meta as any)?.env?.DEV && (topTopics.length || topNoRes.length)) {
      const sep = document.createElement('div');
      sep.className = 'smk-meta';
      sep.textContent = 'Insights (dev)';
      body.appendChild(sep);
      const tools = document.createElement('div');
      tools.className = 'smk-chips';
      const reset = document.createElement('button');
      reset.className = 'smk-chip';
      reset.textContent = 'Reset stats';
      reset.addEventListener('click', () => {
        try {
          (window as any).__smkHelpEvents = [];
        } catch {}
        openById('help.index');
      });
      tools.appendChild(reset);
      body.appendChild(tools);
      if (topTopics.length) {
        const chips = document.createElement('div');
        chips.className = 'smk-chips';
        topTopics.forEach(([id, n]) => {
          const c = document.createElement('button');
          c.className = 'smk-chip';
          c.textContent = `${id} (${n})`;
          c.addEventListener('click', () => openById(id));
          chips.appendChild(c);
        });
        body.appendChild(chips);
      }
      if (topNoRes.length) {
        const label = document.createElement('div');
        label.className = 'smk-meta';
        label.textContent = 'No‑result queries';
        body.appendChild(label);
        const chips = document.createElement('div');
        chips.className = 'smk-chips';
        topNoRes.forEach(([q, n]) => {
          const c = document.createElement('span');
          c.className = 'smk-chip';
          c.textContent = `${q} (${n})`;
          chips.appendChild(c);
        });
        body.appendChild(chips);
      }
    }
  } catch {}
  // Dev coverage: list missing help ids discovered at runtime
  try {
    const w = window as any;
    const all: Set<string> | undefined = w.__smkAllFields;
    if (all && (import.meta as any)?.env?.DEV) {
      const have = new Set<string>(docs.map((d) => d.id));
      const missing = Array.from(all)
        .filter((id) => !have.has(id))
        .sort();
      if (missing.length) {
        const sep = document.createElement('div');
        sep.className = 'smk-meta';
        sep.textContent = `Missing topics (dev): ${missing.length}`;
        body.appendChild(sep);
        const tools = document.createElement('div');
        tools.className = 'smk-chips';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'smk-chip';
        copyBtn.textContent = 'Copy list';
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard?.writeText(missing.join('\n'));
          } catch {}
        });
        tools.appendChild(copyBtn);
        body.appendChild(tools);
        const chips = document.createElement('div');
        chips.className = 'smk-chips';
        for (const id of missing) {
          const chip = document.createElement('button');
          chip.className = 'smk-chip';
          chip.textContent = id;
          chip.addEventListener('click', () => openById(id));
          chips.appendChild(chip);
        }
        body.appendChild(chips);
      }
    }
  } catch {}
}

function openPanelWithDoc(doc: HelpDoc) {
  try {
    (window as any).__smkHelpEvents = (window as any).__smkHelpEvents || [];
    (window as any).__smkHelpEvents.push({
      t: Date.now(),
      event: 'help.panel_opened',
      data: { id: doc.id },
    });
  } catch {}
  ensureStyles();
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.className = 'smk-help-overlay';
    overlayEl.addEventListener('click', closePanel);
    document.body.appendChild(overlayEl);
  }
  if (!panelEl) {
    panelEl = document.createElement('div');
    panelEl.className = 'smk-help-panel';
    contentEl = document.createElement('div');
    panelEl.appendChild(contentEl);
    document.body.appendChild(panelEl);
  }
  overlayEl.classList.add('open');
  panelEl.classList.add('open');
  renderDoc(doc);
}

function closePanel() {
  panelEl?.classList.remove('open');
  overlayEl?.classList.remove('open');
  highlighter?.(null);
}

function flashControlRow(id: string) {
  const row = document.querySelector(`[data-field="${CSS.escape(id)}"]`) as HTMLElement | null;
  if (!row) return;
  try {
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {}
  row.classList.add('smk-focus-flash');
  setTimeout(() => row.classList.remove('smk-focus-flash'), 1000);
}

function openById(id: string) {
  let doc = getDoc(id);
  if (!doc) {
    doc = { id, label: id, summary: 'No documentation yet for this control.' } as HelpDoc;
  }
  openPanelWithDoc(doc);
  flashControlRow(id);
}

function listAllDocs(): HelpDoc[] {
  const base = listDocs();
  // Lightweight synonym augmentation: append known alias tokens to summaries so baseline search can match them
  return base.map((d) => {
    const out: HelpDoc = { ...d };
    const id = d.id.toLowerCase();
    if (id.includes('fuller')) {
      out.summary = (out.summary || '') + ' rib blood groove';
    }
    return out;
  });
}

function openSearch() {
  ensureStyles();
  try {
    (window as any).__smkHelpEvents = (window as any).__smkHelpEvents || [];
    (window as any).__smkHelpEvents.push({ t: Date.now(), event: 'help.search_opened' });
  } catch {}
  if (!searchEl) {
    searchEl = document.createElement('div');
    searchEl.className = 'smk-search';
    const box = document.createElement('div');
    box.className = 'smk-search-box';
    searchInput = document.createElement('input');
    searchInput.className = 'smk-search-input';
    searchInput.type = 'text';
    searchInput.placeholder = 'Search help (type to filter)…';
    const results = document.createElement('div');
    results.className = 'smk-search-results';
    box.appendChild(searchInput);
    box.appendChild(results);
    searchEl.appendChild(box);
    document.body.appendChild(searchEl);

    let items: HelpDoc[] = [];
    let activeIndex = 0;
    // Enhanced search renderer using optional build-time index
    async function renderResults2(q: string) {
      results.innerHTML = '';
      const query = (q || '').trim().toLowerCase();
      let buildIndex: Record<string, string[]> | null = null;
      try {
        const res = await fetch('help-index.json', { cache: 'no-store' });
        if (res.ok) {
          const payload = await res.json();
          if (payload && payload.index) buildIndex = payload.index;
        }
      } catch {}
      const terms = new Set<string>([query]);
      Object.entries(SYNONYMS).forEach(([canon, list]) => {
        if (query && (query === canon || list.includes(query))) {
          terms.add(canon);
          list.forEach((t) => terms.add(t));
        }
      });
      const scored = items
        .map((d) => {
          const text = (
            d.label +
            ' ' +
            (d.summary || '') +
            ' ' +
            (d.details || []).join(' ')
          ).toLowerCase();
          let best = 0;
          terms.forEach((t) => {
            if (!t) return;
            let s = 0;
            if (buildIndex && buildIndex[t] && buildIndex[t].includes(d.id)) {
              s = 2;
            } else {
              const idx = text.indexOf(t);
              s = idx >= 0 ? 1 / (1 + idx) + Math.min(1, t.length / Math.max(1, text.length)) : 0;
            }
            if (s > best) best = s;
          });
          return { d, score: best };
        })
        .filter((x) => (query ? x.score > 0 : true));
      scored.sort((a, b) => b.score - a.score);
      const list = (query ? scored.map((x) => x.d) : items).slice(0, 50);
      if (query && list.length === 0) {
        try {
          (window as any).__smkHelpEvents?.push({
            t: Date.now(),
            event: 'help.search_no_result',
            data: { q: query },
          });
        } catch {}
      }
      list.forEach((d, i) => {
        const row = document.createElement('div');
        row.className = 'smk-result' + (i === activeIndex ? ' active' : '');
        const label = d.label || d.id;
        let text = label + (d.summary ? ' — ' + d.summary : '');
        if (query) {
          text = wrapHits(text, query);
        }
        row.innerHTML = text;
        row.addEventListener('mouseenter', () => {
          activeIndex = i;
          updateActive();
        });
        row.addEventListener('click', () => {
          lastSearchQuery = query;
          openById(d.id);
          closeSearch();
        });
        results.appendChild(row);
      });
    }
    const renderResults = (q: string) => {
      results.innerHTML = '';
      const query = q.trim().toLowerCase();
      const scored = items
        .map((d) => {
          const text = (
            d.label +
            ' ' +
            (d.summary || '') +
            ' ' +
            (d.details || []).join(' ')
          ).toLowerCase();
          const idx = text.indexOf(query);
          const score = query
            ? idx >= 0
              ? 1 / (1 + idx) + Math.min(1, query.length / Math.max(1, text.length))
              : 0
            : 0;
          return { d, score };
        })
        .filter((x) => (query ? x.score > 0 : true));
      scored.sort((a, b) => b.score - a.score);
      const list = (query ? scored.map((x) => x.d) : items).slice(0, 50);
      list.forEach((d, i) => {
        const row = document.createElement('div');
        row.className = 'smk-result' + (i === activeIndex ? ' active' : '');
        const label = d.label || d.id;
        let text = label + (d.summary ? ' — ' + d.summary : '');
        if (query) {
          const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
          text = text.replace(re, (m) => `<span class="smk-hit">${m}</span>`); // simple highlight
        }
        row.innerHTML = text;
        row.addEventListener('mouseenter', () => {
          activeIndex = i;
          updateActive();
        });
        row.addEventListener('click', () => {
          openById(d.id);
          closeSearch();
        });
        results.appendChild(row);
      });
    };
    const updateActive = () => {
      const rows = results.querySelectorAll('.smk-result');
      rows.forEach((r, i) => {
        if (i === activeIndex) r.classList.add('active');
        else r.classList.remove('active');
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
        return;
      }
      const rows = results.querySelectorAll('.smk-result');
      if (e.key === 'ArrowDown') {
        activeIndex = Math.min(rows.length - 1, activeIndex + 1);
        updateActive();
        e.preventDefault();
      }
      if (e.key === 'ArrowUp') {
        activeIndex = Math.max(0, activeIndex - 1);
        updateActive();
        e.preventDefault();
      }
      if (e.key === 'Enter') {
        const row = rows[activeIndex] as HTMLElement | undefined;
        const id = items[activeIndex]?.id;
        if (row && id) {
          lastSearchQuery = (searchInput!.value || '').trim().toLowerCase();
          try {
            (window as any).__smkHelpEvents?.push({
              t: Date.now(),
              event: 'help.search_result_opened',
              data: { id, q: lastSearchQuery },
            });
          } catch {}
          openById(id);
          closeSearch();
        }
      }
    };
    const onInput = () => {
      const q = (searchInput!.value || '').trim().toLowerCase();
      try {
        (window as any).__smkHelpEvents?.push({
          t: Date.now(),
          event: 'help.search_query',
          data: { q },
        });
      } catch {}
      renderResults2(q);
    };
    searchInput.addEventListener('keydown', onKey);
    searchInput.addEventListener('input', onInput);

    const refresh = () => {
      items = listAllDocs();
      activeIndex = 0;
      renderResults2(searchInput!.value || '');
    };
    (searchEl as any)._refresh = refresh;
  }
  (searchEl as any)._refresh?.();
  searchEl.classList.add('open');
  searchInput!.value = '';
  searchInput!.focus();
}

function closeSearch() {
  if (searchInput) lastSearchQuery = (searchInput.value || '').trim().toLowerCase();
  searchEl?.classList.remove('open');
}

function setupShortcuts() {
  window.addEventListener('keydown', (e) => {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && (e.key === '/' || e.code === 'Slash')) {
      e.preventDefault();
      if (panelEl?.classList.contains('open')) closePanel();
      else
        openPanelWithDoc({
          id: 'help.index',
          label: 'Help',
          summary: 'Search or click a control’s ? icon to see details.',
        } as HelpDoc);
    }
    if (meta && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearch();
    }
  });
}

export function initHelpPanel(opts?: { highlighter?: Highlighter }) {
  ensureStyles();
  if (opts?.highlighter) highlighter = opts.highlighter;
  setupShortcuts();
}

export function openHelpPanel(id?: string) {
  if (id) openById(id);
  else
    openPanelWithDoc({
      id: 'help.index',
      label: 'Help',
      summary: 'Search with Cmd/Ctrl+K or click a control’s ? icon.',
    } as HelpDoc);
}
export function closeHelpPanel() {
  closePanel();
}
export function openHelpSearch() {
  openSearch();
}

// Allow callers to open the panel with a provided doc (used when a help id lacks a registry entry)
export function openHelpPanelWithDoc(doc: HelpDoc) {
  openPanelWithDoc(doc);
}

export function handleHelpHash() {
  const hash = (location.hash || '').slice(1);
  const m = hash.match(/(?:^|&)help=([^&]+)/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    setTimeout(() => openHelpPanel(id), 0);
  }
}
