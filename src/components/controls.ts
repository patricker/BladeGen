import { SwordGenerator, SwordParams, defaultSwordParams, buildBladeOutlinePoints, bladeOutlineToSVG } from '../three/SwordGenerator';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

type Category = 'Blade' | 'Guard' | 'Handle' | 'Pommel' | 'Other';

export function createSidebar(el: HTMLElement, sword: SwordGenerator, params: SwordParams) {
  const state: SwordParams = JSON.parse(JSON.stringify(params));
  let raf = 0; let needs = false;
  const flush = () => { raf = 0; if (!needs) return; needs = false; sword.updateGeometry(state); updateWarnings(); };
  const rerender = () => { needs = true; if (!raf) raf = requestAnimationFrame(flush); };

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

  const btnExportOBJ = document.createElement('button');
  btnExportOBJ.textContent = 'Export OBJ';
  toolbar.appendChild(btnExportOBJ);

  const btnExportSTL = document.createElement('button');
  btnExportSTL.textContent = 'Export STL';
  toolbar.appendChild(btnExportSTL);

  const btnExportSVG = document.createElement('button');
  btnExportSVG.textContent = 'Export SVG';
  toolbar.appendChild(btnExportSVG);

  // Sections
  const sections: Record<Category, HTMLElement> = {
    Blade: addSection(el, 'Blade'),
    Guard: addSection(el, 'Guard'),
    Handle: addSection(el, 'Handle'),
    Pommel: addSection(el, 'Pommel'),
    Other: addSection(el, 'Other')
  };

  // Per-section shuffle buttons
  addShuffleButton(sections.Blade, () => { randomizeBlade(state, true); rerender(); refreshInputs(el, state); });
  addShuffleButton(sections.Guard, () => { randomizeGuard(state, true); rerender(); refreshInputs(el, state); });
  addShuffleButton(sections.Handle, () => { randomizeHandle(state, true); rerender(); refreshInputs(el, state); });
  addShuffleButton(sections.Pommel, () => { randomizePommel(state, true); rerender(); refreshInputs(el, state); });

  // Section highlight (mouseenter/leave)
  const highlight = (part: 'blade'|'guard'|'handle'|'pommel'|null) => {
    (sword as any)?.setHighlight?.(part);
  };
  sections.Blade.addEventListener('mouseenter', () => highlight('blade'));
  sections.Blade.addEventListener('mouseleave', () => highlight(null));
  sections.Guard.addEventListener('mouseenter', () => highlight('guard'));
  sections.Guard.addEventListener('mouseleave', () => highlight(null));
  sections.Handle.addEventListener('mouseenter', () => highlight('handle'));
  sections.Handle.addEventListener('mouseleave', () => highlight(null));
  sections.Pommel.addEventListener('mouseenter', () => highlight('pommel'));
  sections.Pommel.addEventListener('mouseleave', () => highlight(null));

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
  slider(sections.Blade, 'Left Thickness', 0.003, 0.2, 0.001, state.blade.thicknessLeft ?? state.blade.thickness, (v) => (state.blade.thicknessLeft = v), rerender, 'Z thickness at left edge (−X).');
  slider(sections.Blade, 'Right Thickness', 0.003, 0.2, 0.001, state.blade.thicknessRight ?? state.blade.thickness, (v) => (state.blade.thicknessRight = v), rerender, 'Z thickness at right edge (+X).');
  slider(sections.Blade, 'Curvature', -1, 1, 0.01, state.blade.curvature, (v) => (state.blade.curvature = v), rerender, 'Bends the blade along its length (negative curves opposite).');
  slider(sections.Blade, 'Base Angle', -10, 10, 0.1, (state.blade.baseAngle ?? 0) * 180/Math.PI, (v) => (state.blade.baseAngle = v * Math.PI/180), rerender, 'Angle (deg) that the blade departs from the handle.');
  slider(sections.Blade, 'Twist Angle', -720, 720, 1, (state.blade.twistAngle ?? 0) * 180/Math.PI, (v) => (state.blade.twistAngle = v * Math.PI/180), rerender, 'Total twist along blade (deg).');
  select(sections.Blade, 'Sori Profile', ['torii', 'koshi', 'saki'], state.blade.soriProfile ?? 'torii', (v) => (state.blade.soriProfile = v as any), rerender, 'Curvature distribution: centered (torii), base (koshi), tip (saki).');
  slider(sections.Blade, 'Sori Bias', 0.3, 3.0, 0.01, state.blade.soriBias ?? 0.8, (v) => (state.blade.soriBias = v), rerender, 'Bias exponent for sori profile.');
  slider(sections.Blade, 'Kissaki Length', 0, 0.35, 0.005, state.blade.kissakiLength ?? 0, (v) => (state.blade.kissakiLength = v), rerender, 'Tip segment fraction (yokote position).');
  slider(sections.Blade, 'Kissaki Round', 0, 1, 0.01, state.blade.kissakiRoundness ?? 0.5, (v) => (state.blade.kissakiRoundness = v), rerender, 'Tip rounding (0 sharp, 1 round).');
  select(sections.Blade, 'Edge Type', ['double', 'single'], (state.blade.edgeType ?? 'double') as string, (v) => (state.blade.edgeType = v as any), rerender, 'Single uses thin cutting edge and thick spine.');
  // Hamon (visual)
  checkbox(sections.Blade, 'Hamon Enabled', state.blade.hamonEnabled ?? false, (v) => (state.blade.hamonEnabled = v), rerender, 'Toggle hamon visual band along the edge.');
  slider(sections.Blade, 'Hamon Width', 0.001, 0.06, 0.001, state.blade.hamonWidth ?? 0.02, (v) => (state.blade.hamonWidth = v), rerender, 'Hamon band width (meters).');
  slider(sections.Blade, 'Hamon Amp', 0, 0.03, 0.001, state.blade.hamonAmplitude ?? 0.008, (v) => (state.blade.hamonAmplitude = v), rerender, 'Hamon waviness amplitude.');
  slider(sections.Blade, 'Hamon Freq', 0, 20, 1, state.blade.hamonFrequency ?? 6, (v) => (state.blade.hamonFrequency = v), rerender, 'Hamon waves along the blade.');
  select(sections.Blade, 'Hamon Side', ['auto', 'left', 'right', 'both'], (state.blade.hamonSide ?? 'auto') as string, (v) => (state.blade.hamonSide = v as any), rerender, 'Auto picks cutting edge for single-edge blades.');
  slider(sections.Blade, 'Asymmetry', -1, 1, 0.01, state.blade.asymmetry ?? 0, (v) => (state.blade.asymmetry = v), rerender, 'Positive widens right edge, negative widens left.');
  slider(sections.Blade, 'Chaos', 0, 1, 0.01, state.blade.chaos ?? 0, (v) => (state.blade.chaos = v), rerender, 'Adds small edge roughness for fantasy blades.');
  checkbox(sections.Blade, 'Enable Fullers', state.blade.fullerEnabled ?? false, (v) => (state.blade.fullerEnabled = v), rerender, 'Toggle decorative grooves along the blade faces.');
  slider(sections.Blade, 'Fuller Count', 0, 3, 1, state.blade.fullerCount ?? 1, (v) => (state.blade.fullerCount = Math.round(v)), rerender, 'Number of grooves (0–3).');
  slider(sections.Blade, 'Fuller Depth', 0, 0.1, 0.001, state.blade.fullerDepth ?? 0, (v) => (state.blade.fullerDepth = v), rerender, 'Visual depth/shading of the groove; not actual subtraction.');
  slider(sections.Blade, 'Fuller Length', 0, 1, 0.01, state.blade.fullerLength ?? 0, (v) => (state.blade.fullerLength = v), rerender, 'Portion of blade occupied by the groove (0..1).');
  slider(sections.Blade, 'Serration Left', 0, 0.2, 0.001, state.blade.serrationAmplitudeLeft ?? (state.blade.serrationAmplitude ?? 0), (v) => (state.blade.serrationAmplitudeLeft = v), rerender, 'Left edge serration amplitude.');
  slider(sections.Blade, 'Serration Right', 0, 0.2, 0.001, state.blade.serrationAmplitudeRight ?? (state.blade.serrationAmplitude ?? 0), (v) => (state.blade.serrationAmplitudeRight = v), rerender, 'Right edge serration amplitude.');
  slider(sections.Blade, 'Serration Freq', 0, 30, 1, state.blade.serrationFrequency ?? 0, (v) => (state.blade.serrationFrequency = v), rerender, 'Number of serration cycles along the blade.');

  // Guard controls
  slider(sections.Guard, 'Width', 0.2, 3.0, 0.01, state.guard.width, (v) => (state.guard.width = v), rerender);
  slider(sections.Guard, 'Guard Thickness', 0.05, 0.6, 0.005, state.guard.thickness, (v) => (state.guard.thickness = v), rerender);
  slider(sections.Guard, 'Curve', -1, 1, 0.01, state.guard.curve, (v) => (state.guard.curve = v), rerender, 'Bends ornate guards upward/downward.');
  slider(sections.Guard, 'Tilt', -1.57, 1.57, 0.01, state.guard.tilt, (v) => (state.guard.tilt = v), rerender, 'Rotates the guard around the blade axis.');
  select(sections.Guard, 'Style', ['bar', 'winged', 'claw', 'disk'], state.guard.style, (v) => (state.guard.style = v as any), rerender);
  slider(sections.Guard, 'Guard Detail', 3, 64, 1, state.guard.curveSegments ?? 12, (v) => (state.guard.curveSegments = Math.round(v)), rerender, 'Detail for guard curves.');
  checkbox(sections.Guard, 'Habaki', state.guard.habakiEnabled ?? false, (v) => (state.guard.habakiEnabled = v), rerender, 'Blade collar above the guard.');
  slider(sections.Guard, 'Habaki Height', 0.02, 0.2, 0.001, state.guard.habakiHeight ?? 0.06, (v) => (state.guard.habakiHeight = v), rerender, 'Height of the habaki collar.');
  slider(sections.Guard, 'Habaki Margin', 0.002, 0.08, 0.001, state.guard.habakiMargin ?? 0.01, (v) => (state.guard.habakiMargin = v), rerender, 'Clearance added to blade width/thickness.');
  slider(sections.Guard, 'Guard Height', -0.15, 0.15, 0.001, state.guard.heightOffset ?? 0, (v) => (state.guard.heightOffset = v), rerender, 'Vertical offset: top of guard vs blade base.');

  // Handle controls
  slider(sections.Handle, 'Length', 0.2, 2.0, 0.01, state.handle.length, (v) => (state.handle.length = v), rerender);
  slider(sections.Handle, 'Radius Top', 0.05, 0.3, 0.001, state.handle.radiusTop, (v) => (state.handle.radiusTop = v), rerender);
  slider(sections.Handle, 'Radius Bottom', 0.05, 0.3, 0.001, state.handle.radiusBottom, (v) => (state.handle.radiusBottom = v), rerender);
  checkbox(sections.Handle, 'Ridges', state.handle.segmentation, (v) => (state.handle.segmentation = v), rerender, 'Adds axial ridges along the grip.');
  checkbox(sections.Handle, 'Wrap Enabled', state.handle.wrapEnabled ?? false, (v) => (state.handle.wrapEnabled = v), rerender, 'Enable helical wrap deformation for the grip.');
  slider(sections.Handle, 'Wrap Turns', 0, 20, 1, state.handle.wrapTurns ?? 6, (v) => (state.handle.wrapTurns = v), rerender, 'Number of helical cycles along the grip.');
  slider(sections.Handle, 'Wrap Depth', 0, 0.05, 0.001, state.handle.wrapDepth ?? 0.015, (v) => (state.handle.wrapDepth = v), rerender, 'Radial amplitude of the wrap pattern.');
  slider(sections.Handle, 'Handle Sides', 8, 128, 1, state.handle.phiSegments ?? 64, (v) => (state.handle.phiSegments = Math.round(v)), rerender, 'Radial tessellation (higher is smoother).');
  checkbox(sections.Handle, 'Wrap Texture', state.handle.wrapTexture ?? false, (v) => (state.handle.wrapTexture = v), rerender, 'Procedural diagonal stripe texture on grip.');
  slider(sections.Handle, 'Wrap Tex Scale', 1, 32, 1, state.handle.wrapTexScale ?? 10, (v) => (state.handle.wrapTexScale = Math.round(v)), rerender, 'Texture repeat scale.');
  slider(sections.Handle, 'Wrap Tex Angle', -90, 90, 1, (state.handle.wrapTexAngle ?? (Math.PI/4)) * 180/Math.PI, (v) => (state.handle.wrapTexAngle = (v*Math.PI/180)), rerender, 'Stripe angle (degrees).');
  slider(sections.Handle, 'Oval Ratio', 1, 1.8, 0.01, state.handle.ovalRatio ?? 1, (v) => (state.handle.ovalRatio = v), rerender, 'Wider X vs Z for an oval tsuka.');

  // Pommel controls
  select(sections.Pommel, 'Style', ['orb', 'disk', 'spike'], state.pommel.style, (v) => (state.pommel.style = v as any), rerender);
  slider(sections.Pommel, 'Size', 0.05, 0.5, 0.001, state.pommel.size, (v) => (state.pommel.size = v), rerender);
  slider(sections.Pommel, 'Elongation', 0.5, 2.0, 0.01, state.pommel.elongation, (v) => (state.pommel.elongation = v), rerender);
  slider(sections.Pommel, 'Morph', 0, 1, 0.01, state.pommel.shapeMorph, (v) => (state.pommel.shapeMorph = v), rerender);

  // Other controls
  // Taper ratio helper: 0 => tip equals base; 1 => tip tapers to 0
  slider(
    sections.Other,
    'Taper Ratio',
    0, 1, 0.01,
    state.blade.baseWidth > 0 ? (1 - (state.blade.tipWidth / state.blade.baseWidth)) : 0,
    (v) => { state.blade.tipWidth = Math.max(0, state.blade.baseWidth * (1 - v)); },
    rerender,
    '0 = no taper, 1 = tip at 0 width'
  );
  slider(sections.Other, 'Stylization', 0, 1, 0.01, (state as any).styleFactor ?? 0, (v) => ((state as any).styleFactor = v), rerender, 'Exaggerates proportions (guard width, curvature, pommel size).');
  slider(sections.Other, 'Blade Detail', 16, 512, 1, state.blade.sweepSegments ?? 128, (v) => (state.blade.sweepSegments = Math.round(v)), rerender, 'Controls blade tessellation along its length.');

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

  btnExportOBJ.addEventListener('click', () => {
    const exporter = new OBJExporter();
    const result = exporter.parse(sword.group);
    const blob = new Blob([result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sword.obj';
    a.click();
    URL.revokeObjectURL(url);
  });

  btnExportSTL.addEventListener('click', () => {
    const exporter = new STLExporter();
    const result = exporter.parse(sword.group, { binary: true } as any);
    const blob = new Blob([result as ArrayBuffer], { type: 'model/stl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sword.stl';
    a.click();
    URL.revokeObjectURL(url);
  });

  btnExportSVG.addEventListener('click', () => {
    const pts = buildBladeOutlinePoints(state.blade);
    const svg = bladeOutlineToSVG(pts);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blade_outline.svg';
    a.click();
    URL.revokeObjectURL(url);
  });

  const updateWarnings = () => {
    const w: string[] = [];
    const blade = state.blade;
    const guard = state.guard;
    const handle = state.handle;
    // Clear existing inline warn styles
    clearWarns(el);
    if (guard.width > blade.length) {
      w.push('Guard very wide vs. blade length');
      setWarn(el, 'Width', true, 'Guard width is large vs. blade length');
    }
    if (handle.length > blade.length * 0.8) {
      w.push('Handle unusually long for blade');
      setWarn(el, 'Length', true, 'Handle length is large relative to blade');
    }
    if (blade.tipWidth > blade.baseWidth * 0.8) {
      w.push('Tip width close to base width');
      setWarn(el, 'Tip Width', true, 'Tip nearly as wide as base');
    }
    const serrL = blade.serrationAmplitudeLeft ?? (blade.serrationAmplitude ?? 0);
    const serrR = blade.serrationAmplitudeRight ?? (blade.serrationAmplitude ?? 0);
    const serrMax = Math.max(serrL, serrR);
    if (serrMax > blade.baseWidth * 0.2) {
      w.push('Serration amplitude high for base width');
      setWarn(el, 'Serration Left', serrL > blade.baseWidth * 0.2, 'Left serration amplitude is high');
      setWarn(el, 'Serration Right', serrR > blade.baseWidth * 0.2, 'Right serration amplitude is high');
    }
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

function clearWarns(root: HTMLElement) {
  const labels = root.querySelectorAll('.row label');
  labels.forEach((lab) => {
    (lab as HTMLElement).style.color = '';
    (lab as HTMLElement).title = (lab as HTMLElement).getAttribute('data-title') || (lab as HTMLElement).title;
  });
  root.querySelectorAll('.row .warn-icon').forEach((el) => el.remove());
}

function setWarn(root: HTMLElement, labelText: string, on: boolean, tooltip?: string) {
  const rows = Array.from(root.querySelectorAll('.row')) as HTMLElement[];
  for (const row of rows) {
    const lab = row.querySelector('label');
    if (!lab) continue;
    if (lab.textContent === labelText) {
      const el = lab as HTMLElement;
      if (!el.getAttribute('data-title')) el.setAttribute('data-title', el.title || '');
      el.style.color = on ? '#eab308' : '';
      if (on && tooltip) el.title = tooltip; else el.title = el.getAttribute('data-title') || '';
      // Add/remove warn icon
      const existing = row.querySelector('.warn-icon');
      if (on) {
        if (!existing) {
          const icon = document.createElement('span');
          icon.className = 'warn-icon';
          icon.textContent = '⚠';
          icon.title = tooltip || 'Extreme value';
          icon.style.marginLeft = '4px';
          icon.style.color = '#eab308';
          icon.style.fontSize = '12px';
          el.insertAdjacentElement('beforeend', icon);
        }
      } else {
        existing?.remove();
      }
      break;
    }
  }
}

function addShuffleButton(section: HTMLElement, onClick: () => void) {
  const header = section.querySelector('h2');
  if (!header) return;
  const btn = document.createElement('button');
  btn.textContent = 'Shuffle';
  btn.style.marginLeft = '8px';
  btn.title = 'Randomize values in this section';
  btn.addEventListener('click', onClick);
  header.appendChild(btn);
}

function slider(parent: HTMLElement, label: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void, rerender: () => void, tooltip?: string) {
  const row = document.createElement('div');
  row.className = 'row';
  const lab = document.createElement('label');
  lab.textContent = label;
  if (tooltip) lab.title = tooltip;
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

function select(parent: HTMLElement, label: string, options: string[], value: string, onChange: (v: string) => void, rerender: () => void, tooltip?: string) {
  const row = document.createElement('div');
  row.className = 'row';
  const lab = document.createElement('label');
  lab.textContent = label;
  if (tooltip) lab.title = tooltip;
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

function checkbox(parent: HTMLElement, label: string, value: boolean, onChange: (v: boolean) => void, rerender: () => void, tooltip?: string) {
  const row = document.createElement('div');
  row.className = 'row';
  const lab = document.createElement('label');
  lab.textContent = label;
  if (tooltip) lab.title = tooltip;
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
    'Left Thickness': params.blade.thicknessLeft ?? params.blade.thickness,
    'Right Thickness': params.blade.thicknessRight ?? params.blade.thickness,
    'Curvature': params.blade.curvature,
    'Base Angle': (params.blade.baseAngle ?? 0) * 180/Math.PI,
    'Sori Profile': params.blade.soriProfile ?? 'torii',
    'Sori Bias': params.blade.soriBias ?? 0.8,
    'Kissaki Length': params.blade.kissakiLength ?? 0,
    'Kissaki Round': params.blade.kissakiRoundness ?? 0.5,
    'Edge Type': params.blade.edgeType ?? 'double',
    'Hamon Enabled': params.blade.hamonEnabled ?? false,
    'Hamon Width': params.blade.hamonWidth ?? 0.02,
    'Hamon Amp': params.blade.hamonAmplitude ?? 0.008,
    'Hamon Freq': params.blade.hamonFrequency ?? 6,
    'Hamon Side': params.blade.hamonSide ?? 'auto',
    'Asymmetry': params.blade.asymmetry ?? 0,
    'Chaos': params.blade.chaos ?? 0,
    'Enable Fullers': params.blade.fullerEnabled ?? false,
    'Fuller Depth': params.blade.fullerDepth ?? 0,
    'Fuller Length': params.blade.fullerLength ?? 0,
    'Fuller Count': params.blade.fullerCount ?? 1,
    'Serration Left': params.blade.serrationAmplitudeLeft ?? (params.blade.serrationAmplitude ?? 0),
    'Serration Right': params.blade.serrationAmplitudeRight ?? (params.blade.serrationAmplitude ?? 0),
    'Serration Freq': params.blade.serrationFrequency ?? 0,
    'Stylization': (params as any).styleFactor ?? 0,
    'Taper Ratio': params.blade.baseWidth > 0 ? (1 - (params.blade.tipWidth / params.blade.baseWidth)) : 0,
    'Blade Detail': params.blade.sweepSegments ?? 128,
    'Width': params.guard.width,
    'Guard Thickness': params.guard.thickness,
    'Curve': params.guard.curve,
    'Tilt': params.guard.tilt,
    'Style_g': params.guard.style,
    'Guard Detail': params.guard.curveSegments ?? 12,
    'Habaki': params.guard.habakiEnabled ?? false,
    'Habaki Height': params.guard.habakiHeight ?? 0.06,
    'Habaki Margin': params.guard.habakiMargin ?? 0.01,
    'Guard Height': params.guard.heightOffset ?? 0,
    'Length_h': params.handle.length,
    'Radius Top': params.handle.radiusTop,
    'Radius Bottom': params.handle.radiusBottom,
    'Ridges': params.handle.segmentation,
    'Wrap Enabled': params.handle.wrapEnabled ?? false,
    'Wrap Turns': params.handle.wrapTurns ?? 6,
    'Wrap Depth': params.handle.wrapDepth ?? 0.015,
    'Handle Sides': params.handle.phiSegments ?? 64,
    'Oval Ratio': params.handle.ovalRatio ?? 1,
    'Wrap Texture': params.handle.wrapTexture ?? false,
    'Wrap Tex Scale': params.handle.wrapTexScale ?? 10,
    'Wrap Tex Angle': ((params.handle.wrapTexAngle ?? (Math.PI/4)) * 180/Math.PI),
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
  randomizeBlade(p, safe);
  randomizeGuard(p, safe);
  randomizeHandle(p, safe);
  randomizePommel(p, safe);
}

function randomizeBlade(p: SwordParams, safe: boolean) {
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  p.blade.length = safe ? r(0.8, 3.5) : r(0.3, 5.5);
  p.blade.baseWidth = safe ? r(0.15, 0.35) : r(0.05, 0.8);
  p.blade.tipWidth = clamp(r(0, p.blade.baseWidth * (safe ? 0.6 : 1)), 0, 1);
  p.blade.thickness = safe ? r(0.05, 0.12) : r(0.02, 0.18);
  if (Math.random() > 0.5) {
    // slight asymmetry in edge thickness
    const baseT = p.blade.thickness;
    p.blade.thicknessLeft = clamp(baseT * r(0.6, 1.4), 0.003, 0.2);
    p.blade.thicknessRight = clamp(baseT * r(0.6, 1.4), 0.003, 0.2);
  } else {
    p.blade.thicknessLeft = p.blade.thickness;
    p.blade.thicknessRight = p.blade.thickness;
  }
  p.blade.curvature = safe ? r(-0.2, 0.4) : r(-0.8, 0.8);
  p.blade.chaos = safe ? r(0, 0.2) : r(0, 0.6);
  const amp = safe ? 0 : r(0, 0.15);
  const sideMode = Math.random();
  if (sideMode < 0.33) {
    p.blade.serrationAmplitudeLeft = amp; p.blade.serrationAmplitudeRight = 0;
  } else if (sideMode < 0.66) {
    p.blade.serrationAmplitudeLeft = 0; p.blade.serrationAmplitudeRight = amp;
  } else {
    p.blade.serrationAmplitudeLeft = amp; p.blade.serrationAmplitudeRight = amp;
  }
  p.blade.serrationFrequency = (p.blade.serrationAmplitudeLeft! > 0 || p.blade.serrationAmplitudeRight! > 0) ? Math.floor(r(2, safe ? 8 : 20)) : 0;
  p.blade.fullerEnabled = Math.random() > 0.6;
  p.blade.fullerDepth = p.blade.fullerEnabled ? (safe ? r(0.01, 0.04) : r(0, 0.08)) : 0;
  p.blade.fullerLength = p.blade.fullerEnabled ? (safe ? r(0.4, 0.8) : r(0, 1)) : 0;
  p.blade.sweepSegments = Math.round(safe ? r(96, 160) : r(64, 192));
}

function randomizeGuard(p: SwordParams, safe: boolean) {
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  p.guard.width = safe ? r(0.8, 1.6) : r(0.4, 2.5);
  p.guard.thickness = safe ? r(0.1, 0.25) : r(0.08, 0.5);
  p.guard.curve = safe ? r(-0.3, 0.6) : r(-1, 1);
  p.guard.tilt = safe ? r(-0.2, 0.2) : r(-0.6, 0.6);
  p.guard.style = (['bar', 'winged', 'claw', 'disk'] as const)[Math.floor(r(0, 4))] as any;
}

function randomizeHandle(p: SwordParams, safe: boolean) {
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  p.handle.length = safe ? r(0.7, 1.2) : r(0.4, 1.6);
  p.handle.radiusTop = safe ? r(0.1, 0.18) : r(0.08, 0.25);
  p.handle.radiusBottom = safe ? r(0.1, 0.18) : r(0.08, 0.25);
  p.handle.segmentation = Math.random() > 0.5;
  p.handle.wrapEnabled = Math.random() > 0.5;
  p.handle.wrapTurns = p.handle.wrapEnabled ? Math.floor(r(4, 12)) : 6;
  p.handle.wrapDepth = p.handle.wrapEnabled ? (safe ? r(0.006, 0.02) : r(0.003, 0.035)) : 0.015;
  p.handle.wrapTexture = Math.random() > 0.5;
  p.handle.wrapTexScale = p.handle.wrapTexture ? Math.floor(r(6, 16)) : 10;
  p.handle.wrapTexAngle = p.handle.wrapTexture ? ((r(-60, 60)) * Math.PI / 180) : (Math.PI/4);
}

function randomizePommel(p: SwordParams, safe: boolean) {
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  p.pommel.style = (['orb', 'disk', 'spike'] as const)[Math.floor(r(0, 3))];
  p.pommel.size = safe ? r(0.12, 0.22) : r(0.08, 0.3);
  p.pommel.elongation = safe ? r(0.8, 1.3) : r(0.5, 1.6);
  p.pommel.shapeMorph = safe ? r(0.1, 0.6) : r(0, 1);
}

function presetKatana(): SwordParams {
  const p = defaultSwordParams();
  // Katana: curved, single-edged look, slender blade, tsuba disk guard, long wrapped handle
  p.blade.length = 3.3; p.blade.baseWidth = 0.22; p.blade.tipWidth = 0.06; p.blade.curvature = 0.25; p.blade.thickness = 0.08;
  p.blade.fullerEnabled = false; p.blade.fullerDepth = 0; p.blade.fullerLength = 0; (p.blade as any).asymmetry = 0.2; p.blade.chaos = 0.05;
  (p.blade as any).edgeType = 'single'; p.blade.thicknessLeft = 0.10; p.blade.thicknessRight = 0.02; (p.blade as any).hamonEnabled = true; (p.blade as any).hamonWidth = 0.018; (p.blade as any).hamonAmplitude = 0.007; (p.blade as any).hamonFrequency = 6; (p.blade as any).hamonSide = 'right';
  p.guard.style = 'disk'; p.guard.width = 0.36; p.guard.thickness = 0.1; p.guard.curve = 0; p.guard.tilt = 0; (p.blade as any).baseAngle = 0.05; (p.blade as any).soriProfile = 'koshi'; (p.blade as any).soriBias = 0.7; (p.blade as any).kissakiLength = 0.12; (p.blade as any).kissakiRoundness = 0.6; (p.guard as any).habakiEnabled = true; (p.guard as any).habakiHeight = 0.06; (p.guard as any).habakiMargin = 0.012;
  p.handle.length = 1.1; p.handle.radiusTop = 0.11; p.handle.radiusBottom = 0.11; p.handle.segmentation = false; p.handle.wrapEnabled = true; (p.handle as any).wrapTexture = true; p.handle.wrapTurns = 10; p.handle.wrapDepth = 0.012; (p.handle as any).ovalRatio = 1.2;
  p.pommel.style = 'disk'; p.pommel.size = 0.12; p.pommel.elongation = 1.0; p.pommel.shapeMorph = 0.1;
  return p;
}

function presetClaymore(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 2.8; p.blade.baseWidth = 0.32; p.blade.tipWidth = 0.08; p.blade.curvature = 0.0; p.blade.fullerEnabled = true; p.blade.fullerDepth = 0.03; p.blade.fullerLength = 0.6;
  p.guard.style = 'winged'; p.guard.width = 1.6; p.guard.thickness = 0.24; p.guard.curve = 0.15;
  p.handle.length = 0.9; p.handle.radiusTop = 0.13; p.handle.radiusBottom = 0.13; p.handle.segmentation = false;
  p.pommel.style = 'orb'; p.pommel.size = 0.18; p.pommel.elongation = 1.0; p.pommel.shapeMorph = 0.1;
  return p;
}

function presetRapier(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 3.2; p.blade.baseWidth = 0.18; p.blade.tipWidth = 0.05; p.blade.curvature = 0.0; p.blade.fullerEnabled = false; p.blade.fullerDepth = 0.0; p.blade.fullerLength = 0.0;
  p.guard.style = 'claw'; p.guard.width = 1.2; p.guard.thickness = 0.18; p.guard.curve = 0.3; p.guard.tilt = 0.1;
  p.handle.length = 1.0; p.handle.radiusTop = 0.11; p.handle.radiusBottom = 0.11; p.handle.segmentation = false;
  p.pommel.style = 'disk'; p.pommel.size = 0.16; p.pommel.elongation = 1.0; p.pommel.shapeMorph = 0.3;
  return p;
}

function presetDemon(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 3.6; p.blade.baseWidth = 0.28; p.blade.tipWidth = 0.02; p.blade.curvature = -0.2; p.blade.serrationAmplitude = 0.08; p.blade.serrationFrequency = 10; p.blade.fullerEnabled = true; p.blade.fullerDepth = 0.02; p.blade.fullerLength = 0.4;
  p.guard.style = 'claw'; p.guard.width = 1.8; p.guard.thickness = 0.28; p.guard.curve = -0.5; p.guard.tilt = -0.2;
  p.handle.length = 0.9; p.handle.radiusTop = 0.13; p.handle.radiusBottom = 0.12; p.handle.segmentation = true;
  p.pommel.style = 'spike'; p.pommel.size = 0.18; p.pommel.elongation = 1.2; p.pommel.shapeMorph = 0.7;
  return p;
}
