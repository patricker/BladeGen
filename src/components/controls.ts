import { SwordGenerator, SwordParams, defaultSwordParams } from '../three/SwordGenerator';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

type Category = 'Blade' | 'Guard' | 'Handle' | 'Pommel' | 'Other';

export function createSidebar(el: HTMLElement, sword: SwordGenerator, params: SwordParams) {
  const state: SwordParams = JSON.parse(JSON.stringify(params));
  const rerender = () => { sword.updateGeometry(state); updateWarnings(); };

  el.innerHTML = '';
  const title = document.createElement('h2');
  title.textContent = 'Controls';
  el.appendChild(title);

  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  el.appendChild(toolbar);

  // Presets dropdown
  const presetSel = document.createElement('select');
  presetSel.innerHTML = `
    <option value="custom">Preset: Custom</option>
    <option value="katana">Katana</option>
    <option value="claymore">Claymore</option>
    <option value="rapier">Rapier</option>
    <option value="demon">Demon Blade</option>
  `;
  toolbar.appendChild(presetSel);

  const btnSave = document.createElement('button');
  btnSave.textContent = 'Save Preset';
  toolbar.appendChild(btnSave);

  const btnRandom = document.createElement('button');
  btnRandom.textContent = 'Randomize (full)';
  toolbar.appendChild(btnRandom);

  const btnRandomSafe = document.createElement('button');
  btnRandomSafe.textContent = 'Randomize (safe)';
  toolbar.appendChild(btnRandomSafe);

  const btnExport = document.createElement('button');
  btnExport.textContent = 'Export GLB';
  toolbar.appendChild(btnExport);

  // Sections
  const sections: Record<Category, HTMLElement> = {
    Blade: addSection(el, 'Blade'),
    Guard: addSection(el, 'Guard'),
    Handle: addSection(el, 'Handle'),
    Pommel: addSection(el, 'Pommel'),
    Other: addSection(el, 'Other')
  };

  const warningsBox = document.createElement('div');
  warningsBox.style.fontSize = '12px';
  warningsBox.style.color = '#eab308';
  warningsBox.style.marginTop = '4px';
  sections.Other.appendChild(warningsBox);

  // Blade controls
  slider(sections.Blade, 'Length', 0.5, 6, 0.01, state.blade.length, (v) => (state.blade.length = v), rerender);
  slider(sections.Blade, 'Base Width', 0.05, 1.0, 0.005, state.blade.baseWidth, (v) => (state.blade.baseWidth = v), rerender);
  slider(sections.Blade, 'Tip Width', 0, 0.5, 0.005, state.blade.tipWidth, (v) => (state.blade.tipWidth = v), rerender);
  slider(sections.Blade, 'Blade Thickness', 0.02, 0.2, 0.001, state.blade.thickness, (v) => (state.blade.thickness = v), rerender);
  slider(sections.Blade, 'Curvature', -1, 1, 0.01, state.blade.curvature, (v) => (state.blade.curvature = v), rerender);
  slider(sections.Blade, 'Fuller Depth', 0, 0.1, 0.001, state.blade.fullerDepth ?? 0, (v) => (state.blade.fullerDepth = v), rerender);
  slider(sections.Blade, 'Fuller Length', 0, 1, 0.01, state.blade.fullerLength ?? 0, (v) => (state.blade.fullerLength = v), rerender);
  slider(sections.Blade, 'Serration Amp', 0, 0.2, 0.001, state.blade.serrationAmplitude ?? 0, (v) => (state.blade.serrationAmplitude = v), rerender);
  slider(sections.Blade, 'Serration Freq', 0, 30, 1, state.blade.serrationFrequency ?? 0, (v) => (state.blade.serrationFrequency = v), rerender);

  // Guard controls
  slider(sections.Guard, 'Width', 0.2, 3.0, 0.01, state.guard.width, (v) => (state.guard.width = v), rerender);
  slider(sections.Guard, 'Guard Thickness', 0.05, 0.6, 0.005, state.guard.thickness, (v) => (state.guard.thickness = v), rerender);
  slider(sections.Guard, 'Curve', -1, 1, 0.01, state.guard.curve, (v) => (state.guard.curve = v), rerender);
  slider(sections.Guard, 'Tilt', -1.57, 1.57, 0.01, state.guard.tilt, (v) => (state.guard.tilt = v), rerender);
  select(sections.Guard, 'Style', ['bar', 'winged', 'claw'], state.guard.style, (v) => (state.guard.style = v as any), rerender);

  // Handle controls
  slider(sections.Handle, 'Length', 0.2, 2.0, 0.01, state.handle.length, (v) => (state.handle.length = v), rerender);
  slider(sections.Handle, 'Radius Top', 0.05, 0.3, 0.001, state.handle.radiusTop, (v) => (state.handle.radiusTop = v), rerender);
  slider(sections.Handle, 'Radius Bottom', 0.05, 0.3, 0.001, state.handle.radiusBottom, (v) => (state.handle.radiusBottom = v), rerender);
  checkbox(sections.Handle, 'Ridges', state.handle.segmentation, (v) => (state.handle.segmentation = v), rerender);

  // Pommel controls
  select(sections.Pommel, 'Style', ['orb', 'disk', 'spike'], state.pommel.style, (v) => (state.pommel.style = v as any), rerender);
  slider(sections.Pommel, 'Size', 0.05, 0.5, 0.001, state.pommel.size, (v) => (state.pommel.size = v), rerender);
  slider(sections.Pommel, 'Elongation', 0.5, 2.0, 0.01, state.pommel.elongation, (v) => (state.pommel.elongation = v), rerender);
  slider(sections.Pommel, 'Morph', 0, 1, 0.01, state.pommel.shapeMorph, (v) => (state.pommel.shapeMorph = v), rerender);

  // Presets handling
  presetSel.addEventListener('change', () => {
    const p = presetSel.value;
    let next: SwordParams | null = null;
    if (p === 'katana') next = presetKatana();
    if (p === 'claymore') next = presetClaymore();
    if (p === 'rapier') next = presetRapier();
    if (p === 'demon') next = presetDemon();
    if (p && next) {
      assignParams(state, next);
      rerender();
      refreshInputs(el, state);
    }
  });
  btnSave.addEventListener('click', () => {
    localStorage.setItem('swordmaker.preset.custom', JSON.stringify(state));
    presetSel.value = 'custom';
  });
  btnRandom.addEventListener('click', () => {
    randomize(state, false);
    rerender();
    refreshInputs(el, state);
  });
  btnRandomSafe.addEventListener('click', () => {
    randomize(state, true);
    rerender();
    refreshInputs(el, state);
  });
  btnExport.addEventListener('click', async () => {
    const exporter = new GLTFExporter();
    exporter.parse(
      sword.group,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sword.glb';
        a.click();
        URL.revokeObjectURL(url);
      },
      (error) => {
        console.error('GLTF export error', error);
      },
      { binary: true }
    );
  });

  const updateWarnings = () => {
    const w: string[] = [];
    const blade = state.blade;
    const guard = state.guard;
    const handle = state.handle;
    if (guard.width > blade.length) w.push('Guard very wide vs. blade length');
    if (handle.length > blade.length * 0.8) w.push('Handle unusually long for blade');
    if (blade.tipWidth > blade.baseWidth * 0.8) w.push('Tip width close to base width');
    if ((blade.serrationAmplitude ?? 0) > blade.baseWidth * 0.2) w.push('Serration amplitude high for base width');
    warningsBox.innerHTML = w.length ? ('Warnings:\n- ' + w.join('\n- ')).replace(/\n/g, '<br/>') : 'No warnings';
  };

  rerender();
}

function addSection(root: HTMLElement, title: string) {
  const wrap = document.createElement('div');
  wrap.className = 'section';
  const h = document.createElement('h2');
  h.textContent = title;
  wrap.appendChild(h);
  root.appendChild(wrap);
  return wrap;
}

function slider(parent: HTMLElement, label: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void, rerender: () => void) {
  const row = document.createElement('div');
  row.className = 'row';
  const lab = document.createElement('label');
  lab.textContent = label;
  const range = document.createElement('input');
  range.type = 'range';
  range.min = String(min);
  range.max = String(max);
  range.step = String(step);
  range.value = String(value);
  const num = document.createElement('input');
  num.type = 'number';
  num.min = String(min);
  num.max = String(max);
  num.step = String(step);
  num.value = String(value);
  range.addEventListener('input', () => {
    num.value = range.value;
    onChange(parseFloat(range.value));
    rerender();
  });
  num.addEventListener('input', () => {
    range.value = num.value;
    onChange(parseFloat(num.value));
    rerender();
  });
  row.appendChild(lab);
  row.appendChild(range);
  row.appendChild(num);
  parent.appendChild(row);
}

function select(parent: HTMLElement, label: string, options: string[], value: string, onChange: (v: string) => void, rerender: () => void) {
  const row = document.createElement('div');
  row.className = 'row';
  const lab = document.createElement('label');
  lab.textContent = label;
  const sel = document.createElement('select');
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    if (opt === value) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => {
    onChange(sel.value);
    rerender();
  });
  row.appendChild(lab);
  row.appendChild(sel);
  parent.appendChild(row);
}

function checkbox(parent: HTMLElement, label: string, value: boolean, onChange: (v: boolean) => void, rerender: () => void) {
  const row = document.createElement('div');
  row.className = 'row';
  const lab = document.createElement('label');
  lab.textContent = label;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = value;
  input.addEventListener('change', () => {
    onChange(input.checked);
    rerender();
  });
  row.appendChild(lab);
  // span to align
  const span = document.createElement('span');
  span.appendChild(input);
  row.appendChild(span);
  parent.appendChild(row);
}

function refreshInputs(root: HTMLElement, params: SwordParams) {
  // Sync number/range/select values to current state
  const map: Record<string, number | string | boolean> = {
    'Length': params.blade.length,
    'Base Width': params.blade.baseWidth,
    'Tip Width': params.blade.tipWidth,
    'Blade Thickness': params.blade.thickness,
    'Curvature': params.blade.curvature,
    'Fuller Depth': params.blade.fullerDepth ?? 0,
    'Fuller Length': params.blade.fullerLength ?? 0,
    'Serration Amp': params.blade.serrationAmplitude ?? 0,
    'Serration Freq': params.blade.serrationFrequency ?? 0,
    'Width': params.guard.width,
    'Guard Thickness': params.guard.thickness,
    'Curve': params.guard.curve,
    'Tilt': params.guard.tilt,
    'Style_g': params.guard.style,
    'Length_h': params.handle.length,
    'Radius Top': params.handle.radiusTop,
    'Radius Bottom': params.handle.radiusBottom,
    'Ridges': params.handle.segmentation,
    'Style_p': params.pommel.style,
    'Size': params.pommel.size,
    'Elongation': params.pommel.elongation,
    'Morph': params.pommel.shapeMorph
  } as any;
  // This is a simple best-effort refresher; in a larger app we’d bind per-field ids.
  const inputs = root.querySelectorAll('input, select');
  inputs.forEach((inp) => {
    const label = inp.closest('.row')?.querySelector('label')?.textContent || '';
    let key = label;
    if (label === 'Thickness') key = 'Thickness';
    if (label === 'Style') key = 'Style_g';
    if (label === 'Length') key = 'Length';
    const v = (map as any)[key];
    if (v === undefined) return;
    if (inp instanceof HTMLInputElement && inp.type === 'checkbox') {
      inp.checked = !!v;
    } else if (inp instanceof HTMLInputElement || inp instanceof HTMLSelectElement) {
      (inp as any).value = String(v);
    }
  });
}

function assignParams(dst: SwordParams, src: SwordParams) {
  dst.blade = { ...dst.blade, ...src.blade };
  dst.guard = { ...dst.guard, ...src.guard } as any;
  dst.handle = { ...dst.handle, ...src.handle } as any;
  dst.pommel = { ...dst.pommel, ...src.pommel } as any;
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

function randomize(p: SwordParams, safe: boolean) {
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  p.blade.length = safe ? r(0.8, 3.5) : r(0.3, 5.5);
  p.blade.baseWidth = safe ? r(0.15, 0.35) : r(0.05, 0.8);
  p.blade.tipWidth = clamp(r(0, p.blade.baseWidth * (safe ? 0.6 : 1)), 0, 1);
  p.blade.thickness = safe ? r(0.05, 0.12) : r(0.02, 0.18);
  p.blade.curvature = safe ? r(-0.2, 0.4) : r(-0.8, 0.8);
  p.blade.serrationAmplitude = safe ? 0 : r(0, 0.15);
  p.blade.serrationFrequency = p.blade.serrationAmplitude! > 0 ? Math.floor(r(2, safe ? 8 : 20)) : 0;
  p.blade.fullerDepth = safe ? r(0.01, 0.04) : r(0, 0.08);
  p.blade.fullerLength = safe ? r(0.4, 0.8) : r(0, 1);

  p.guard.width = safe ? r(0.8, 1.6) : r(0.4, 2.5);
  p.guard.thickness = safe ? r(0.1, 0.25) : r(0.08, 0.5);
  p.guard.curve = safe ? r(-0.3, 0.6) : r(-1, 1);
  p.guard.tilt = safe ? r(-0.2, 0.2) : r(-0.6, 0.6);
  p.guard.style = (['bar', 'winged', 'claw'] as const)[Math.floor(r(0, 3))];

  p.handle.length = safe ? r(0.7, 1.2) : r(0.4, 1.6);
  p.handle.radiusTop = safe ? r(0.1, 0.18) : r(0.08, 0.25);
  p.handle.radiusBottom = safe ? r(0.1, 0.18) : r(0.08, 0.25);
  p.handle.segmentation = Math.random() > 0.5;

  p.pommel.style = (['orb', 'disk', 'spike'] as const)[Math.floor(r(0, 3))];
  p.pommel.size = safe ? r(0.12, 0.22) : r(0.08, 0.3);
  p.pommel.elongation = safe ? r(0.8, 1.3) : r(0.5, 1.6);
  p.pommel.shapeMorph = safe ? r(0.1, 0.6) : r(0, 1);
}

function presetKatana(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 3.4; p.blade.baseWidth = 0.22; p.blade.tipWidth = 0.06; p.blade.curvature = 0.25; p.blade.thickness = 0.08; p.blade.fullerDepth = 0.015; p.blade.fullerLength = 0.7;
  p.guard.style = 'bar'; p.guard.width = 0.9; p.guard.thickness = 0.18; p.guard.curve = 0;
  p.handle.length = 1.1; p.handle.radiusTop = 0.12; p.handle.radiusBottom = 0.12; p.handle.segmentation = true;
  p.pommel.style = 'disk'; p.pommel.size = 0.15; p.pommel.elongation = 1.0; p.pommel.shapeMorph = 0.2;
  return p;
}

function presetClaymore(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 2.8; p.blade.baseWidth = 0.32; p.blade.tipWidth = 0.08; p.blade.curvature = 0.0; p.blade.fullerDepth = 0.03; p.blade.fullerLength = 0.6;
  p.guard.style = 'winged'; p.guard.width = 1.6; p.guard.thickness = 0.24; p.guard.curve = 0.15;
  p.handle.length = 0.9; p.handle.radiusTop = 0.13; p.handle.radiusBottom = 0.13; p.handle.segmentation = false;
  p.pommel.style = 'orb'; p.pommel.size = 0.18; p.pommel.elongation = 1.0; p.pommel.shapeMorph = 0.1;
  return p;
}

function presetRapier(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 3.2; p.blade.baseWidth = 0.18; p.blade.tipWidth = 0.05; p.blade.curvature = 0.0; p.blade.fullerDepth = 0.0; p.blade.fullerLength = 0.0;
  p.guard.style = 'claw'; p.guard.width = 1.2; p.guard.thickness = 0.18; p.guard.curve = 0.3; p.guard.tilt = 0.1;
  p.handle.length = 1.0; p.handle.radiusTop = 0.11; p.handle.radiusBottom = 0.11; p.handle.segmentation = false;
  p.pommel.style = 'disk'; p.pommel.size = 0.16; p.pommel.elongation = 1.0; p.pommel.shapeMorph = 0.3;
  return p;
}

function presetDemon(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 3.6; p.blade.baseWidth = 0.28; p.blade.tipWidth = 0.02; p.blade.curvature = -0.2; p.blade.serrationAmplitude = 0.08; p.blade.serrationFrequency = 10; p.blade.fullerDepth = 0.02; p.blade.fullerLength = 0.4;
  p.guard.style = 'claw'; p.guard.width = 1.8; p.guard.thickness = 0.28; p.guard.curve = -0.5; p.guard.tilt = -0.2;
  p.handle.length = 0.9; p.handle.radiusTop = 0.13; p.handle.radiusBottom = 0.12; p.handle.segmentation = true;
  p.pommel.style = 'spike'; p.pommel.size = 0.18; p.pommel.elongation = 1.2; p.pommel.shapeMorph = 0.7;
  return p;
}
