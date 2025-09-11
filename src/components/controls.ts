import { SwordGenerator, SwordParams, defaultSwordParams, buildBladeOutlinePoints, bladeOutlineToSVG } from '../three/SwordGenerator';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

type Category = 'Blade' | 'Guard' | 'Handle' | 'Pommel' | 'Other' | 'Render';

type RenderHooks = {
  setExposure: (v: number) => void;
  setAmbient: (v: number) => void;
  setKeyIntensity: (v: number) => void;
  setKeyAngles: (az: number, el: number) => void;
  setRimIntensity: (v: number) => void;
  setRimColor: (hex: number) => void;
  setRimAngles: (az: number, el: number) => void;
  setBloom: (enabled: boolean, strength?: number, threshold?: number, radius?: number) => void;
  setOutline: (enabled: boolean, strength?: number, thickness?: number, colorHex?: number) => void;
  setEnvIntensity: (v: number) => void;
  setBackgroundColor: (hex: number) => void;
  setBackgroundBrightness: (v: number) => void;
  setVignette: (enabled: boolean, strength?: number, softness?: number) => void;
  setInkOutline: (enabled: boolean, thickness?: number, colorHex?: number) => void;
  setAAMode: (mode: 'none'|'fxaa'|'smaa') => void;
  setShadowBias: (bias: number, normalBias?: number) => void;
  setShadowMapSize: (size: 512|1024|2048|4096) => void;
  setDPRCap: (cap: number) => void;
  setPartBump: (part: 'blade'|'guard'|'handle'|'pommel', enabled: boolean, bumpScale?: number, noiseScale?: number, seed?: number) => void;
  setBladeGradientWear: (enabled: boolean, base?: number, edge?: number, edgeFade?: number, wear?: number) => void;
  setPartColor: (part: 'blade'|'guard'|'handle'|'pommel', hex: number) => void;
  setPartMetalness: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => void;
  setPartRoughness: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => void;
  setPartClearcoat: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => void;
  setPartClearcoatRoughness: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => void;
};

export function createSidebar(el: HTMLElement, sword: SwordGenerator, params: SwordParams, render?: RenderHooks) {
  const state: SwordParams = JSON.parse(JSON.stringify(params));
  const rstate = {
    exposure: 1.0,
    bgColor: '#0f1115',
    bgBrightness: 0.0,
    ambient: 0.4,
    keyIntensity: 2.0,
    keyAz: 40,
    keyEl: 40,
    rimIntensity: 0.5,
    rimAz: -135,
    rimEl: 20,
    rimColor: '#ffffff',
    bloomEnabled: false,
    bloomStrength: 0.6,
    bloomThreshold: 0.85,
    bloomRadius: 0.2,
  };
  type Part = 'blade'|'guard'|'handle'|'pommel';
  type MatExt = {
    color: string; metalness: number; roughness: number; clearcoat: number; clearcoatRoughness: number; preset: string;
    bumpEnabled: boolean; bumpScale: number; bumpNoiseScale: number; bumpSeed: number;
    emissiveColor?: string; emissiveIntensity?: number;
    transmission?: number; ior?: number; thickness?: number; attenuationColor?: string; attenuationDistance?: number;
    sheen?: number; sheenColor?: string; iridescence?: number; iridescenceIOR?: number; iridescenceThicknessMin?: number; iridescenceThicknessMax?: number;
    envMapIntensity?: number; anisotropyFake?: boolean; anisotropyDirection?: number;
    map?: string; normalMap?: string; roughnessMap?: string; metalnessMap?: string; aoMap?: string; bumpMap?: string; displacementMap?: string; alphaMap?: string; clearcoatNormalMap?: string;
  };
  const matState: Record<Part, MatExt>
    = {
      blade: { color: '#b9c6ff', metalness: 0.8, roughness: 0.25, clearcoat: 0.0, clearcoatRoughness: 0.5, preset: 'None', bumpEnabled: false, bumpScale: 0.02, bumpNoiseScale: 8, bumpSeed: 1337 },
      guard: { color: '#8892b0', metalness: 0.6, roughness: 0.45, clearcoat: 0.0, clearcoatRoughness: 0.5, preset: 'None', bumpEnabled: false, bumpScale: 0.02, bumpNoiseScale: 8, bumpSeed: 1337 },
      handle: { color: '#5a6b78', metalness: 0.1, roughness: 0.85, clearcoat: 0.0, clearcoatRoughness: 0.6, preset: 'None', bumpEnabled: false, bumpScale: 0.02, bumpNoiseScale: 8, bumpSeed: 1337 },
      pommel: { color: '#9aa4b2', metalness: 0.75, roughness: 0.35, clearcoat: 0.0, clearcoatRoughness: 0.5, preset: 'None', bumpEnabled: false, bumpScale: 0.02, bumpNoiseScale: 8, bumpSeed: 1337 }
    };
  const matDefaults: Record<Part, MatExt> = JSON.parse(JSON.stringify(matState));
  let raf = 0; let needs = false;
  const flush = () => { raf = 0; if (!needs) return; needs = false; sword.updateGeometry(state); updateWarnings(); };
  const rerender = () => { needs = true; if (!raf) raf = requestAnimationFrame(flush); };

  el.innerHTML = '';
  const title = document.createElement('h2');
  title.textContent = 'Controls';
  el.appendChild(title);

  // Tabs: Model vs Render
  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  const tabModel = document.createElement('button'); tabModel.className = 'tab-btn active'; tabModel.textContent = 'Model';
  const tabRender = document.createElement('button'); tabRender.className = 'tab-btn'; tabRender.textContent = 'Render';
  tabs.appendChild(tabModel); tabs.appendChild(tabRender);
  el.appendChild(tabs);

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
  btnRandom.classList.add('model-only');
  toolbar.appendChild(btnRandom);

  const btnRandomSafe = document.createElement('button');
  btnRandomSafe.textContent = 'Randomize (safe)';
  btnRandomSafe.classList.add('model-only');
  toolbar.appendChild(btnRandomSafe);

  const btnExport = document.createElement('button');
  btnExport.textContent = 'Export GLB';
  btnExport.classList.add('model-only');
  toolbar.appendChild(btnExport);

  const btnExportOBJ = document.createElement('button');
  btnExportOBJ.textContent = 'Export OBJ';
  btnExportOBJ.classList.add('model-only');
  toolbar.appendChild(btnExportOBJ);

  const btnExportSTL = document.createElement('button');
  btnExportSTL.textContent = 'Export STL';
  btnExportSTL.classList.add('model-only');
  toolbar.appendChild(btnExportSTL);

  const btnExportSVG = document.createElement('button');
  btnExportSVG.textContent = 'Export SVG';
  btnExportSVG.classList.add('model-only');
  toolbar.appendChild(btnExportSVG);

  // JSON Export/Import
  const btnExportJSON = document.createElement('button');
  btnExportJSON.textContent = 'Export JSON';
  toolbar.appendChild(btnExportJSON);
  const btnImportJSON = document.createElement('button');
  btnImportJSON.textContent = 'Import JSON';
  toolbar.appendChild(btnImportJSON);
  const fileJSON = document.createElement('input');
  fileJSON.type = 'file'; fileJSON.accept = 'application/json'; fileJSON.style.display = 'none';
  el.appendChild(fileJSON);

  // Sections
  const sections: Record<Category, HTMLElement> = {
    Blade: addSection(el, 'Blade'),
    Guard: addSection(el, 'Guard'),
    Handle: addSection(el, 'Handle'),
    Pommel: addSection(el, 'Pommel'),
    Other: addSection(el, 'Other'),
    Render: addSection(el, 'Render')
  };

  const showTab = (name: 'Model' | 'Render') => {
    const isRender = name === 'Render';
    tabModel.classList.toggle('active', !isRender);
    tabRender.classList.toggle('active', isRender);
    // Toggle section visibility
    sections.Blade.style.display = isRender ? 'none' : '';
    sections.Guard.style.display = isRender ? 'none' : '';
    sections.Handle.style.display = isRender ? 'none' : '';
    sections.Pommel.style.display = isRender ? 'none' : '';
    sections.Other.style.display = isRender ? 'none' : '';
    sections.Render.style.display = isRender ? '' : 'none';
    // Hide model-only toolbar items on Render tab
    const modelOnly = toolbar.querySelectorAll('.model-only');
    modelOnly.forEach((b) => { (b as HTMLElement).style.display = isRender ? 'none' : ''; });
  };
  tabModel.addEventListener('click', () => showTab('Model'));
  tabRender.addEventListener('click', () => showTab('Render'));
  showTab('Model');

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
  sections.Render.addEventListener('mouseenter', () => highlight(null));
  sections.Render.addEventListener('mouseleave', () => {});

  const warningsBox = document.createElement('div');
  warningsBox.style.fontSize = '12px';
  warningsBox.style.color = '#eab308';
  warningsBox.style.marginTop = '4px';
  sections.Other.appendChild(warningsBox);

  // Render controls (if hooks available)
  if (render) {
    // Quality & AA
    select(sections.Render, 'AA Mode', ['none','fxaa','smaa'], 'fxaa', (v) => { render.setAAMode(v as any); }, () => {}, 'Anti-aliasing mode.');
    select(sections.Render, 'Quality', ['Low','Medium','High'], 'Medium', (v) => {
      if (v === 'Low') {
        render.setAAMode('none'); render.setShadowMapSize(1024); render.setBloom(false); render.setOutline(false); render.setDPRCap(1.0);
      } else if (v === 'Medium') {
        render.setAAMode('fxaa'); render.setShadowMapSize(2048); render.setBloom(false); render.setOutline(false); render.setDPRCap(1.5);
      } else {
        render.setAAMode('smaa'); render.setShadowMapSize(2048); render.setBloom(false); render.setOutline(false); render.setDPRCap(2.0);
      }
    }, () => {}, 'Quality preset (affects AA, shadows, DPR).');
    select(sections.Render, 'Shadow Map', ['1024','2048','4096'], '2048', (v) => { render.setShadowMapSize(parseInt(v,10) as any); }, () => {}, 'Shadow map resolution.');
    slider(sections.Render, 'Shadow Bias', -0.01, 0.01, 0.0001, -0.0005, (v) => { render.setShadowBias(v); }, () => {}, 'Shadow acne/peter-panning tweak.');
    select(sections.Render, 'Tone Mapping', ['ACES','Reinhard','Cineon','Linear','None'], 'ACES', (v) => { (render as any).setToneMapping?.(v as any); }, () => {}, 'Renderer tone mapping curve.');
    slider(sections.Render, 'Exposure', 0.5, 2.0, 0.01, rstate.exposure, (v) => { rstate.exposure = v; render.setExposure(v); }, () => {} , 'Tone mapping exposure.');
    slider(sections.Render, 'Env Intensity', 0, 3.0, 0.01, 1.0, (v) => { render.setEnvIntensity(v); }, () => {}, 'Environment map intensity (reflections).');
    colorPicker(sections.Render, 'Background Color', rstate.bgColor, (hex) => { rstate.bgColor = hex; const n = parseInt(hex.replace('#','0x')); render.setBackgroundColor(n); }, () => {}, 'Renderer clear color.');
    slider(sections.Render, 'Background Bright', 0, 1.0, 0.01, rstate.bgBrightness, (v) => { rstate.bgBrightness = v; render.setBackgroundBrightness(v); }, () => {}, 'Lighten/darken the background.');
    slider(sections.Render, 'Ambient Intensity', 0, 2.0, 0.01, rstate.ambient, (v) => { rstate.ambient = v; render.setAmbient(v); }, () => {}, 'Hemisphere ambient light.');
    slider(sections.Render, 'Key Intensity', 0, 4.0, 0.01, rstate.keyIntensity, (v) => { rstate.keyIntensity = v; render.setKeyIntensity(v); }, () => {}, 'Directional key light intensity.');
    slider(sections.Render, 'Key Azimuth', -180, 180, 1, rstate.keyAz, (v) => { rstate.keyAz = v; render.setKeyAngles(rstate.keyAz, rstate.keyEl); }, () => {}, 'Key light horizontal angle (deg).');
    slider(sections.Render, 'Key Elevation', -10, 85, 1, rstate.keyEl, (v) => { rstate.keyEl = v; render.setKeyAngles(rstate.keyAz, rstate.keyEl); }, () => {}, 'Key light elevation (deg).');
    slider(sections.Render, 'Rim Intensity', 0, 3.0, 0.01, rstate.rimIntensity, (v) => { rstate.rimIntensity = v; render.setRimIntensity(v); }, () => {}, 'Back/rim light intensity.');
    slider(sections.Render, 'Rim Azimuth', -180, 180, 1, rstate.rimAz, (v) => { rstate.rimAz = v; render.setRimAngles(rstate.rimAz, rstate.rimEl); }, () => {}, 'Rim light horizontal angle (deg).');
    slider(sections.Render, 'Rim Elevation', -10, 85, 1, rstate.rimEl, (v) => { rstate.rimEl = v; render.setRimAngles(rstate.rimAz, rstate.rimEl); }, () => {}, 'Rim light elevation (deg).');
    colorPicker(sections.Render, 'Rim Color', rstate.rimColor, (hex) => { rstate.rimColor = hex; const n = parseInt(hex.replace('#','0x')); render.setRimColor(n); }, () => {}, 'Rim light color.');
    checkbox(sections.Render, 'Bloom Enabled', rstate.bloomEnabled, (v) => { rstate.bloomEnabled = v; render.setBloom(rstate.bloomEnabled, rstate.bloomStrength, rstate.bloomThreshold, rstate.bloomRadius); }, () => {}, 'Enable bloom post-process.');
    slider(sections.Render, 'Bloom Strength', 0, 3.0, 0.01, rstate.bloomStrength, (v) => { rstate.bloomStrength = v; render.setBloom(rstate.bloomEnabled, rstate.bloomStrength, rstate.bloomThreshold, rstate.bloomRadius); }, () => {}, 'Bloom intensity.');
    slider(sections.Render, 'Bloom Threshold', 0, 1.5, 0.01, rstate.bloomThreshold, (v) => { rstate.bloomThreshold = v; render.setBloom(rstate.bloomEnabled, rstate.bloomStrength, rstate.bloomThreshold, rstate.bloomRadius); }, () => {}, 'Bloom threshold.');
    slider(sections.Render, 'Bloom Radius', 0, 1.0, 0.01, rstate.bloomRadius, (v) => { rstate.bloomRadius = v; render.setBloom(rstate.bloomEnabled, rstate.bloomStrength, rstate.bloomThreshold, rstate.bloomRadius); }, () => {}, 'Bloom radius.');
    // Outline
    checkbox(sections.Render, 'Outline Enabled', false, (v) => { render.setOutline(v); }, () => {}, 'Enable Outline pass.');
    slider(sections.Render, 'Outline Strength', 0.0, 10.0, 0.1, 2.5, (v) => { render.setOutline(true, v); }, () => {}, 'OutlinePass edgeStrength.');
    slider(sections.Render, 'Outline Thickness', 0.0, 4.0, 0.05, 1.0, (v) => { render.setOutline(true, undefined, v); }, () => {}, 'OutlinePass edgeThickness.');
    colorPicker(sections.Render, 'Outline Color', '#ffffff', (hex) => { const n = parseInt(hex.replace('#','0x')); render.setOutline(true, undefined, undefined, n); }, () => {}, 'Outline visible edge color.');
    // Ink outline (mesh based)
    checkbox(sections.Render, 'Ink Outline', false, (v) => { render.setInkOutline(v, 0.02, 0x000000); }, () => {}, 'Back-face mesh outline.');
    slider(sections.Render, 'Ink Thickness', 0, 0.2, 0.005, 0.02, (v) => { render.setInkOutline(true, v, undefined); }, () => {}, 'Scale factor for ink outline.');
    colorPicker(sections.Render, 'Ink Color', '#000000', (hex) => { const n = parseInt(hex.replace('#','0x')); render.setInkOutline(true, undefined, n); }, () => {}, 'Ink outline color.');
    // Vignette
    checkbox(sections.Render, 'Vignette', false, (v) => { render.setVignette(v, 0.25, 0.5); }, () => {}, 'Enable vignette shading.');
    slider(sections.Render, 'Vignette Strength', 0, 1.0, 0.01, 0.25, (v) => { render.setVignette(true, v, undefined); }, () => {}, 'Strength of vignette.');
    slider(sections.Render, 'Vignette Softness', 0, 1.0, 0.01, 0.5, (v) => { render.setVignette(true, undefined, v); }, () => {}, 'Softness of vignette edge.');
    // EnvMap + Fog
    textRow(sections.Render, 'EnvMap URL', '', (v) => { (render as any).setEnvMap?.(v, false); }, 'Equirectangular image URL.');
    select(sections.Render, 'Env Preset', ['None','Room','Royal Esplanade','Venice Sunset'], 'None', (v) => {
      const map: Record<string,string|undefined> = {
        None: undefined,
        Room: undefined,
        'Royal Esplanade': 'https://threejs.org/examples/textures/equirectangular/royal_esplanade_1k.hdr',
        'Venice Sunset': 'https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr'
      };
      const url = map[v];
      (render as any).setEnvMap?.(url, true);
    }, () => {}, 'Quick env presets (loads remote HDR).');
    checkbox(sections.Render, 'Env as Background', false, (v) => { (render as any).setEnvMap?.(undefined, v); }, () => {}, 'Use environment as background. Load URL first, then toggle.');
    colorPicker(sections.Render, 'Fog Color', '#ffffff', (hex) => { const n = parseInt(hex.replace('#','0x')); (render as any).setFog?.(n, 0.03); }, () => {}, 'Fog base color (exp2).');
    slider(sections.Render, 'Fog Density', 0, 0.1, 0.001, 0.03, (v) => { (render as any).setFog?.(undefined, v); }, () => {}, 'FogExp2 density (0 disables).');
    // Fresnel edge accent
    checkbox(sections.Render, 'Fresnel', false, (v) => { (render as any).setFresnel?.(v, 0xffffff, 0.6, 2.0); }, () => {}, 'Additive edge accent based on view angle.');
    slider(sections.Render, 'Fresnel Intensity', 0, 2.0, 0.01, 0.6, (v) => { (render as any).setFresnel?.(true, undefined, v, undefined); }, () => {}, 'Fresnel intensity.');
    slider(sections.Render, 'Fresnel Power', 0.5, 6.0, 0.1, 2.0, (v) => { (render as any).setFresnel?.(true, undefined, undefined, v); }, () => {}, 'Fresnel power exponent.');
    colorPicker(sections.Render, 'Fresnel Color', '#ffffff', (hex) => { const n = parseInt(hex.replace('#','0x')); (render as any).setFresnel?.(true, n, undefined, undefined); }, () => {}, 'Fresnel color.');
  } else {
    sections.Render.style.display = 'none';
  }

  // Helper to sync Render material controls to the selected part's stored values
  function syncMaterialInputs(currentPart?: Part) {
    const partKey: Part = currentPart || 'blade';
    const root = sections.Render;
    const setSlider = (label: string, val: number) => {
      const row = Array.from(root.querySelectorAll('.row')).find((r) => r.querySelector('label')?.textContent === label) as HTMLElement | undefined;
      if (!row) return;
      const range = row.querySelector('input[type=range]') as HTMLInputElement | null;
      const num = row.querySelector('input[type=number]') as HTMLInputElement | null;
      if (range) range.value = String(val);
      if (num) num.value = String(val);
    };
    const setCheckbox = (label: string, checked: boolean) => {
      const row = Array.from(root.querySelectorAll('.row')).find((r) => r.querySelector('label')?.textContent === label) as HTMLElement | undefined;
      if (!row) return;
      const inp = row.querySelector('input[type=checkbox]') as HTMLInputElement | null;
      if (inp) inp.checked = checked;
    };
    const setColor = (label: string, hex: string) => {
      const row = Array.from(root.querySelectorAll('.row')).find((r) => r.querySelector('label')?.textContent === label) as HTMLElement | undefined;
      if (!row) return;
      const inp = row.querySelector('input[type=color]') as HTMLInputElement | null;
      if (inp) inp.value = hex;
    };
    const setSelect = (label: string, value: string) => {
      const row = Array.from(root.querySelectorAll('.row')).find((r) => r.querySelector('label')?.textContent === label) as HTMLElement | undefined;
      if (!row) return;
      const sel = row.querySelector('select') as HTMLSelectElement | null;
      if (sel) sel.value = value;
    };
    const m = matState[partKey];
    setColor('Base Color', m.color);
    setSlider('Metalness', m.metalness);
    setSlider('Roughness', m.roughness);
    setSlider('Clearcoat', m.clearcoat);
    setSlider('Clearcoat Rough', m.clearcoatRoughness);
    setSelect('Mat Preset', m.preset || 'None');
    setCheckbox('Bump Enabled', m.bumpEnabled);
    setSlider('Bump Scale', m.bumpScale);
    setSlider('Noise Scale', m.bumpNoiseScale);
    setSlider('Noise Seed', m.bumpSeed);
  }

  // Material Base (Render tab)
  if (render) {
    const matPartOpts = ['blade','guard','handle','pommel'] as const;
    let matPart: Part = 'blade';
    select(sections.Render, 'Material Part', [...matPartOpts] as unknown as string[], 'blade', (v) => { matPart = v as Part; syncMaterialInputs(matPart); }, () => {});
    colorPicker(sections.Render, 'Base Color', matState[matPart].color, (hex) => { matState[matPart].color = hex; const n = parseInt(hex.replace('#','0x')); render.setPartColor(matPart, n); }, () => {}, 'Albedo color.');
    slider(sections.Render, 'Metalness', 0, 1, 0.01, matState[matPart].metalness, (v) => { matState[matPart].metalness = v; render.setPartMetalness(matPart, v); }, () => {}, 'PBR metalness.');
    slider(sections.Render, 'Roughness', 0, 1, 0.01, matState[matPart].roughness, (v) => { matState[matPart].roughness = v; render.setPartRoughness(matPart, v); }, () => {}, 'PBR roughness.');
    slider(sections.Render, 'Clearcoat', 0, 1, 0.01, matState[matPart].clearcoat, (v) => { matState[matPart].clearcoat = v; render.setPartClearcoat(matPart, v); }, () => {}, 'Clearcoat layer (if supported).');
    slider(sections.Render, 'Clearcoat Rough', 0, 1, 0.01, matState[matPart].clearcoatRoughness, (v) => { matState[matPart].clearcoatRoughness = v; render.setPartClearcoatRoughness(matPart, v); }, () => {}, 'Clearcoat roughness (if supported).');
    // Material presets
    select(sections.Render, 'Mat Preset', ['None','Steel','Iron','Bronze','Brass','Leather','Wood','Matte','Glass','Gem'], matState[matPart].preset, (v) => {
      const apply = (c:number,m:number,r:number,cc:number,ccr:number, extra?: Partial<MatExt>) => {
        matState[matPart].color = '#' + c.toString(16).padStart(6,'0');
        matState[matPart].metalness = m; matState[matPart].roughness = r; matState[matPart].clearcoat = cc; matState[matPart].clearcoatRoughness = ccr; matState[matPart].preset = v;
        render.setPartColor(matPart, c); render.setPartMetalness(matPart, m); render.setPartRoughness(matPart, r); render.setPartClearcoat(matPart, cc); render.setPartClearcoatRoughness(matPart, ccr);
        if (extra) {
          Object.assign(matState[matPart], extra);
          (render as any).setPartMaterial?.(matPart, extra);
        }
        syncMaterialInputs(matPart);
      };
      if (v==='Steel') apply(0xb9c6ff,0.9,0.25,0.2,0.4);
      else if (v==='Iron') apply(0x9aa4b2,0.8,0.45,0.05,0.6);
      else if (v==='Bronze') apply(0xcd7f32,0.6,0.5,0.05,0.6);
      else if (v==='Brass') apply(0xb5a642,0.6,0.5,0.05,0.6);
      else if (v==='Leather') apply(0x6b4f3a,0.05,0.85,0.0,0.8);
      else if (v==='Wood') apply(0x8b6f47,0.02,0.8,0.0,0.8);
      else if (v==='Matte') apply(0xbfbfbf,0.0,0.9,0.0,1.0);
      else if (v==='Glass') apply(0xffffff,0.0,0.05,0.0,1.0, { transmission: 0.95, ior: 1.5, thickness: 0.2, attenuationColor: '#ffffff', attenuationDistance: 1.0, envMapIntensity: 1.5 });
      else if (v==='Gem') apply(0xc0e0ff,0.0,0.02,0.1,0.2, { transmission: 0.98, ior: 2.3, thickness: 0.4, attenuationColor: '#a0c8ff', attenuationDistance: 0.2, iridescence: 0.2 });
      else { matState[matPart].preset = 'None'; syncMaterialInputs(matPart); }
    }, () => {}, 'Quick material presets');
    // Reset material for selected part
    const resetBtn = document.createElement('button'); resetBtn.textContent = 'Reset Material'; resetBtn.title = 'Reset selected part material to defaults'; resetBtn.style.margin='4px 0';
    resetBtn.addEventListener('click', () => {
      const def = JSON.parse(JSON.stringify(matDefaults[matPart])) as MatExt;
      matState[matPart] = def;
      const c = parseInt(def.color.replace('#','0x'));
      render.setPartColor(matPart, c);
      render.setPartMetalness(matPart, def.metalness);
      render.setPartRoughness(matPart, def.roughness);
      render.setPartClearcoat(matPart, def.clearcoat);
      render.setPartClearcoatRoughness(matPart, def.clearcoatRoughness);
      (render as any).setPartMaterial?.(matPart, { emissiveColor: def.emissiveColor, emissiveIntensity: def.emissiveIntensity, transmission: def.transmission, ior: def.ior, thickness: def.thickness, attenuationColor: def.attenuationColor, attenuationDistance: def.attenuationDistance, sheen: def.sheen, sheenColor: def.sheenColor, iridescence: def.iridescence, iridescenceIOR: def.iridescenceIOR, iridescenceThicknessMin: def.iridescenceThicknessMin, iridescenceThicknessMax: def.iridescenceThicknessMax, envMapIntensity: def.envMapIntensity });
      syncMaterialInputs(matPart);
    });
    sections.Render.appendChild(resetBtn);
    // Procedural bump/noise for selected part
    checkbox(sections.Render, 'Bump Enabled', matState[matPart].bumpEnabled, (v) => { matState[matPart].bumpEnabled = v; render.setPartBump(matPart, v, matState[matPart].bumpScale, matState[matPart].bumpNoiseScale, matState[matPart].bumpSeed); }, () => {}, 'Procedural noise bump.');
    slider(sections.Render, 'Bump Scale', 0, 0.08, 0.001, matState[matPart].bumpScale, (v) => { matState[matPart].bumpScale = v; render.setPartBump(matPart, matState[matPart].bumpEnabled, v, matState[matPart].bumpNoiseScale, matState[matPart].bumpSeed); }, () => {}, 'Bump map scale.');
    slider(sections.Render, 'Noise Scale', 1, 32, 1, matState[matPart].bumpNoiseScale, (v) => { matState[matPart].bumpNoiseScale = Math.round(v); render.setPartBump(matPart, matState[matPart].bumpEnabled, matState[matPart].bumpScale, matState[matPart].bumpNoiseScale, matState[matPart].bumpSeed); }, () => {}, 'Noise frequency.');
    slider(sections.Render, 'Noise Seed', 0, 9999, 1, matState[matPart].bumpSeed, (v) => { matState[matPart].bumpSeed = Math.round(v); render.setPartBump(matPart, matState[matPart].bumpEnabled, matState[matPart].bumpScale, matState[matPart].bumpNoiseScale, matState[matPart].bumpSeed); }, () => {}, 'Noise seed.');
    // Advanced materials
    colorPicker(sections.Render, 'Emissive Color', matState[matPart].emissiveColor ?? '#000000', (hex) => { matState[matPart].emissiveColor = hex; (render as any).setPartMaterial?.(matPart, { emissiveColor: hex }); }, () => {}, 'Glow color.');
    slider(sections.Render, 'Emissive Intensity', 0, 10, 0.01, matState[matPart].emissiveIntensity ?? 0, (v) => { matState[matPart].emissiveIntensity = v; (render as any).setPartMaterial?.(matPart, { emissiveIntensity: v }); }, () => {}, 'Glow intensity.');
    slider(sections.Render, 'Transmission', 0, 1, 0.01, matState[matPart].transmission ?? 0, (v) => { matState[matPart].transmission = v; (render as any).setPartMaterial?.(matPart, { transmission: v }); }, () => {}, 'Glass-like transmission.');
    slider(sections.Render, 'IOR', 1, 2.5, 0.01, matState[matPart].ior ?? 1.5, (v) => { matState[matPart].ior = v; (render as any).setPartMaterial?.(matPart, { ior: v }); }, () => {}, 'Index of refraction.');
    slider(sections.Render, 'Thickness', 0, 5, 0.01, matState[matPart].thickness ?? 0.2, (v) => { matState[matPart].thickness = v; (render as any).setPartMaterial?.(matPart, { thickness: v }); }, () => {}, 'Volume thickness.');
    colorPicker(sections.Render, 'Atten Color', matState[matPart].attenuationColor ?? '#ffffff', (hex) => { matState[matPart].attenuationColor = hex; (render as any).setPartMaterial?.(matPart, { attenuationColor: hex }); }, () => {}, 'Transmission attenuation color.');
    slider(sections.Render, 'Atten Dist', 0, 10, 0.01, matState[matPart].attenuationDistance ?? 0, (v) => { matState[matPart].attenuationDistance = v; (render as any).setPartMaterial?.(matPart, { attenuationDistance: v }); }, () => {}, 'Attenuation distance.');
    slider(sections.Render, 'Sheen', 0, 1, 0.01, matState[matPart].sheen ?? 0, (v) => { matState[matPart].sheen = v; (render as any).setPartMaterial?.(matPart, { sheen: v }); }, () => {}, 'Cloth sheen.');
    colorPicker(sections.Render, 'Sheen Color', matState[matPart].sheenColor ?? '#ffffff', (hex) => { matState[matPart].sheenColor = hex; (render as any).setPartMaterial?.(matPart, { sheenColor: hex }); }, () => {}, 'Sheen color.');
    slider(sections.Render, 'Iridescence', 0, 1, 0.01, matState[matPart].iridescence ?? 0, (v) => { matState[matPart].iridescence = v; (render as any).setPartMaterial?.(matPart, { iridescence: v }); }, () => {}, 'Iridescence intensity.');
    slider(sections.Render, 'Iridescence IOR', 1, 3, 0.01, matState[matPart].iridescenceIOR ?? 1.3, (v) => { matState[matPart].iridescenceIOR = v; (render as any).setPartMaterial?.(matPart, { iridescenceIOR: v }); }, () => {}, 'Iridescence IOR.');
    slider(sections.Render, 'Iri Thick Min', 0, 2000, 1, matState[matPart].iridescenceThicknessMin ?? 100, (v) => { const iv=Math.round(v); matState[matPart].iridescenceThicknessMin = iv; (render as any).setPartMaterial?.(matPart, { iridescenceThicknessMin: iv }); }, () => {}, 'Iridescence thickness min (nm).');
    slider(sections.Render, 'Iri Thick Max', 0, 2000, 1, matState[matPart].iridescenceThicknessMax ?? 400, (v) => { const iv=Math.round(v); matState[matPart].iridescenceThicknessMax = iv; (render as any).setPartMaterial?.(matPart, { iridescenceThicknessMax: iv }); }, () => {}, 'Iridescence thickness max (nm).');
    slider(sections.Render, 'EnvMap Intensity', 0, 8, 0.01, matState[matPart].envMapIntensity ?? 1, (v) => { matState[matPart].envMapIntensity = v; (render as any).setPartMaterial?.(matPart, { envMapIntensity: v }); }, () => {}, 'Per-material env intensity.');
    checkbox(sections.Render, 'Aniso Fake', matState[matPart].anisotropyFake ?? false, (v) => { matState[matPart].anisotropyFake = v; (render as any).setPartMaterial?.(matPart, { anisotropyFake: v }); }, () => {}, 'Enable visual anisotropy.');
    slider(sections.Render, 'Aniso Dir', -180, 180, 1, (matState[matPart].anisotropyDirection ?? 0) * 180/Math.PI, (v) => { const rad=v*Math.PI/180; matState[matPart].anisotropyDirection = rad; (render as any).setPartMaterial?.(matPart, { anisotropyDirection: rad }); }, () => {}, 'Anisotropy direction (deg).');
    textRow(sections.Render, 'Map URL', matState[matPart].map ?? '', (v) => { matState[matPart].map = v; (render as any).setPartMaterial?.(matPart, { map: v }); }, 'Albedo map URL (sRGB).');
    textRow(sections.Render, 'Normal URL', matState[matPart].normalMap ?? '', (v) => { matState[matPart].normalMap = v; (render as any).setPartMaterial?.(matPart, { normalMap: v }); }, 'Normal map URL.');
    textRow(sections.Render, 'Rough URL', matState[matPart].roughnessMap ?? '', (v) => { matState[matPart].roughnessMap = v; (render as any).setPartMaterial?.(matPart, { roughnessMap: v }); }, 'Roughness map URL.');
    textRow(sections.Render, 'Metal URL', matState[matPart].metalnessMap ?? '', (v) => { matState[matPart].metalnessMap = v; (render as any).setPartMaterial?.(matPart, { metalnessMap: v }); }, 'Metalness map URL.');
    textRow(sections.Render, 'AO URL', matState[matPart].aoMap ?? '', (v) => { matState[matPart].aoMap = v; (render as any).setPartMaterial?.(matPart, { aoMap: v }); }, 'AO map URL.');
    textRow(sections.Render, 'Bump URL', matState[matPart].bumpMap ?? '', (v) => { matState[matPart].bumpMap = v; (render as any).setPartMaterial?.(matPart, { bumpMap: v }); }, 'Bump map URL.');
    textRow(sections.Render, 'Disp URL', matState[matPart].displacementMap ?? '', (v) => { matState[matPart].displacementMap = v; (render as any).setPartMaterial?.(matPart, { displacementMap: v }); }, 'Displacement map URL.');
    textRow(sections.Render, 'Alpha URL', matState[matPart].alphaMap ?? '', (v) => { matState[matPart].alphaMap = v; (render as any).setPartMaterial?.(matPart, { alphaMap: v }); }, 'Alpha map URL.');
    textRow(sections.Render, 'CC Normal URL', matState[matPart].clearcoatNormalMap ?? '', (v) => { matState[matPart].clearcoatNormalMap = v; (render as any).setPartMaterial?.(matPart, { clearcoatNormalMap: v }); }, 'Clearcoat normal map URL.');
    // Blade gradient/wear overlay
    let gradEnabled = false; let gradBase = '#b9c6ff'; let gradEdge = '#ffffff'; let gradFade = 0.2; let gradWear = 0.2;
    checkbox(sections.Render, 'Blade Gradient', false, (v) => { gradEnabled = v; render.setBladeGradientWear(gradEnabled, parseInt(gradBase.replace('#','0x')), parseInt(gradEdge.replace('#','0x')), gradFade, gradWear); }, () => {}, 'Enable blade gradient/wear overlay.');
    colorPicker(sections.Render, 'Grad Base', gradBase, (hex) => { gradBase = hex; render.setBladeGradientWear(true, parseInt(gradBase.replace('#','0x')), parseInt(gradEdge.replace('#','0x')), gradFade, gradWear); }, () => {}, 'Gradient base color.');
    colorPicker(sections.Render, 'Grad Edge', gradEdge, (hex) => { gradEdge = hex; render.setBladeGradientWear(true, parseInt(gradBase.replace('#','0x')), parseInt(gradEdge.replace('#','0x')), gradFade, gradWear); }, () => {}, 'Gradient edge color.');
    slider(sections.Render, 'Grad Edge Fade', 0, 1, 0.01, gradFade, (v) => { gradFade = v; render.setBladeGradientWear(true, parseInt(gradBase.replace('#','0x')), parseInt(gradEdge.replace('#','0x')), gradFade, gradWear); }, () => {}, 'Edge fade thickness.');
    slider(sections.Render, 'Wear Intensity', 0, 1, 0.01, gradWear, (v) => { gradWear = v; render.setBladeGradientWear(true, parseInt(gradBase.replace('#','0x')), parseInt(gradEdge.replace('#','0x')), gradFade, gradWear); }, () => {}, 'Wear noise amount.');
  }

  // Blade controls
  // Serration pattern & seed
  select(sections.Blade, 'Serration Pattern', ['sine','saw','scallop','random'], (state.blade as any).serrationPattern ?? 'sine', (v) => { (state.blade as any).serrationPattern = v as any; }, rerender, 'Pattern used for serrations along edges.');
  slider(sections.Blade, 'Serration Seed', 0, 999999, 1, (state.blade as any).serrationSeed ?? 1337, (v) => { (state.blade as any).serrationSeed = Math.round(v); }, rerender, 'Seed value for random serration pattern.');
  // Fuller carve options
  select(sections.Blade, 'Fuller Mode', ['overlay','carve'], (state.blade as any).fullerMode ?? 'overlay', (v) => { (state.blade as any).fullerMode = v as any; }, rerender, 'overlay: visual ribbons; carve: actual groove reduces thickness.');
  select(sections.Blade, 'Fuller Profile', ['u','v','flat'], (state.blade as any).fullerProfile ?? 'u', (v) => { (state.blade as any).fullerProfile = v as any; }, rerender, 'Cross-section profile for carved fuller.');
  slider(sections.Blade, 'Fuller Width', 0, 0.6, 0.001, (state.blade as any).fullerWidth ?? 0, (v) => { (state.blade as any).fullerWidth = v; }, rerender, 'Groove width across the blade face (scene units). 0 = auto.');
  slider(sections.Blade, 'Fuller Inset', 0, 0.2, 0.001, (state.blade as any).fullerInset ?? (state.blade.fullerDepth ?? 0), (v) => { (state.blade as any).fullerInset = v; }, rerender, 'Groove depth inside thickness when carving. Defaults to Fuller Depth.');
  slider(sections.Blade, 'Length', 0.5, 6, 0.01, state.blade.length, (v) => (state.blade.length = v), rerender);
  slider(sections.Blade, 'Base Width', 0.05, 1.0, 0.005, state.blade.baseWidth, (v) => (state.blade.baseWidth = v), rerender);
  slider(sections.Blade, 'Tip Width', 0, 0.5, 0.005, state.blade.tipWidth, (v) => (state.blade.tipWidth = v), rerender);
  select(sections.Blade, 'Tip Shape', ['pointed', 'rounded', 'leaf'], (state.blade.tipShape ?? 'pointed') as string, (v) => (state.blade.tipShape = v as any), rerender, 'Pointed (default), Rounded (softer kissaki), Leaf (mid-bulge).');
  slider(sections.Blade, 'Leaf Bulge', 0, 1, 0.01, state.blade.tipBulge ?? 0.2, (v) => (state.blade.tipBulge = v), rerender, 'Mid-blade bulge for Leaf tip shape.');
  select(sections.Blade, 'Cross Section', ['flat', 'diamond', 'lenticular', 'hexagonal'], (state.blade.crossSection ?? 'flat') as string, (v) => (state.blade.crossSection = v as any), rerender, 'Blade cross-section profile.');
  slider(sections.Blade, 'Edge Bevel', 0, 1, 0.01, state.blade.bevel ?? 0.5, (v) => (state.blade.bevel = v), rerender, '0 sharp (thin spine), 1 thickened spine/facets.');
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
  // Text Engraving (simple)
  checkbox(sections.Blade, 'Text Engraving', false, (v) => {
    const list = (((state.blade as any).engravings) || []) as any[];
    const rest = list.filter((e:any) => e.type !== 'text');
    if (v) rest.push({ type:'text', content:'ᚠᚢᚦ', fontUrl:'https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json', width:0.18, height:0.03, depth:0.002, offsetY: state.blade.length*0.5, offsetX:0, rotation:0, side:'right' });
    (state.blade as any).engravings = rest;
  }, rerender, 'Adds a text engraving (provide font URL and content).');
  // Manage multiple engravings: add/remove/reorder and edit index
  const engrToolbar = document.createElement('div'); engrToolbar.style.margin='4px 0'; engrToolbar.style.display='flex'; engrToolbar.style.gap='6px';
  const engrAddBtn = document.createElement('button'); engrAddBtn.textContent = 'Add Engraving'; engrAddBtn.onclick = ()=>{ const arr = (((state.blade as any).engravings)||[]) as any[]; arr.push({ type:'text', content:'TEXT', fontUrl:'', width:0.1, height:0.02, depth:0.002, offsetY: state.blade.length*0.5, offsetX:0, rotation:0, side:'right', align:'center' }); (state.blade as any).engravings = arr; rerender(); };
  const engrRemoveBtn = document.createElement('button'); engrRemoveBtn.textContent = 'Remove This'; engrRemoveBtn.onclick = ()=>{ const arr = (((state.blade as any).engravings)||[]) as any[]; if (!arr.length) return; if (engrIndex<0||engrIndex>=arr.length) return; arr.splice(engrIndex,1); (state.blade as any).engravings = arr; engrIndex = Math.max(0, Math.min(engrIndex, arr.length-1)); rerender(); };
  const engrUpBtn = document.createElement('button'); engrUpBtn.textContent = 'Move Up'; engrUpBtn.onclick = ()=>{ const arr = (((state.blade as any).engravings)||[]) as any[]; if (engrIndex>0) { const t = arr[engrIndex]; arr[engrIndex] = arr[engrIndex-1]; arr[engrIndex-1] = t; engrIndex--; (state.blade as any).engravings = arr; rerender(); }};
  const engrDownBtn = document.createElement('button'); engrDownBtn.textContent = 'Move Down'; engrDownBtn.onclick = ()=>{ const arr = (((state.blade as any).engravings)||[]) as any[]; if (engrIndex < arr.length-1) { const t = arr[engrIndex]; arr[engrIndex] = arr[engrIndex+1]; arr[engrIndex+1] = t; engrIndex++; (state.blade as any).engravings = arr; rerender(); }};
  engrToolbar.appendChild(engrAddBtn); engrToolbar.appendChild(engrRemoveBtn); engrToolbar.appendChild(engrUpBtn); engrToolbar.appendChild(engrDownBtn);
  sections.Blade.appendChild(engrToolbar);
  let engrIndex = 0; const getEngr = ()=>{ const arr = (((state.blade as any).engravings)||[]) as any[]; if (!arr.length) return null; if (engrIndex>=arr.length) engrIndex = arr.length-1; return arr[engrIndex]; };
  slider(sections.Blade, 'Engrave Index', 0, 10, 1, 0, (v)=>{ engrIndex = Math.max(0, Math.round(v)); }, ()=>{}, 'Which engraving to edit (0..N-1).');
  select(sections.Blade, 'Engrave Type', ['text','shape','decal'], 'text', (v) => { const e = getEngr(); if (!e) return; e.type = v; rerender(); }, ()=>{}, 'Type of engraving primitive.');
  textRow(sections.Blade, 'Engrave Text', 'ᚠᚢᚦ', (v) => {
    const e = getEngr(); if (!e) return; e.content = v; rerender();
  }, 'Unicode supported by the chosen font.');
  textRow(sections.Blade, 'Font URL', 'https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json', (v) => {
    const e = getEngr(); if (!e) return; e.fontUrl = v; rerender();
  }, 'Typeface JSON URL (typeface.js format). For full Unicode, supply a suitable font.');
  slider(sections.Blade, 'Engrave Width', 0.02, 0.6, 0.001, 0.18, (val) => {
    const e = getEngr(); if (!e) return; e.width = val; rerender();
  }, rerender, 'Max width of text region.');
  slider(sections.Blade, 'Engrave Height', 0.005, 0.1, 0.001, 0.03, (val) => {
    const e = getEngr(); if (!e) return; e.height = val; rerender();
  }, rerender, 'Text letter height.');
  slider(sections.Blade, 'Engrave Depth', 0.0005, 0.02, 0.0005, 0.002, (val) => {
    const e = getEngr(); if (!e) return; e.depth = val; rerender();
  }, rerender, 'Extrusion depth of the engraving.');
  slider(sections.Blade, 'Engrave OffsetY', 0, 1, 0.001, 0.5, (val) => {
    const e = getEngr(); if (!e) return; e.offsetY = state.blade.length * val; rerender();
  }, rerender, 'Position along blade length (0..1).');
  slider(sections.Blade, 'Engrave OffsetX', -0.4, 0.4, 0.001, 0, (val) => {
    const e = getEngr(); if (!e) return; e.offsetX = val; rerender();
  }, rerender, 'Lateral offset across blade width.');
  slider(sections.Blade, 'Engrave RotY', -180, 180, 1, 0, (deg) => {
    const e = getEngr(); if (!e) return; e.rotation = deg*Math.PI/180; rerender();
  }, rerender, 'Rotation around Y axis (deg).');
  select(sections.Blade, 'Engrave Side', ['left','right','both'], 'right', (v) => {
    const e = getEngr(); if (!e) return; e.side = v; rerender();
  }, rerender, 'Which blade face.');
  select(sections.Blade, 'Text Align', ['left','center','right'], 'center', (v) => {
    const e = getEngr(); if (!e) return; e.align = v as any; rerender();
  }, rerender, 'Horizontal alignment for text.');

  // Guard controls
  slider(sections.Guard, 'Width', 0.2, 3.0, 0.01, state.guard.width, (v) => (state.guard.width = v), rerender);
  slider(sections.Guard, 'Guard Thickness', 0.05, 0.6, 0.005, state.guard.thickness, (v) => (state.guard.thickness = v), rerender);
  slider(sections.Guard, 'Curve', -1, 1, 0.01, state.guard.curve, (v) => (state.guard.curve = v), rerender, 'Bends ornate guards upward/downward.');
  slider(sections.Guard, 'Tilt', -1.57, 1.57, 0.01, state.guard.tilt, (v) => (state.guard.tilt = v), rerender, 'Rotates the guard around the blade axis.');
  select(sections.Guard, 'Style', ['bar', 'winged', 'claw', 'disk', 'knucklebow', 'swept', 'basket'], state.guard.style, (v) => (state.guard.style = v as any), rerender);
  slider(sections.Guard, 'Blend Fillet', 0, 1, 0.01, (state.guard as any).guardBlendFillet ?? 0, (v) => ((state.guard as any).guardBlendFillet = v), rerender, 'Small bridge piece between blade and guard.');
  checkbox(sections.Guard, 'Finger Guard', false, (v) => {
    const arr = (((state.guard as any).extras) || []) as any[];
    const without = arr.filter((e) => e.kind !== 'fingerGuard');
    if (v) without.push({ kind: 'fingerGuard', radius: 0.12, thickness: 0.03, offsetY: 0 });
    (state.guard as any).extras = without;
  }, rerender, 'Add a small bar under the knuckles.');
  // Side rings controls
  checkbox(sections.Guard, 'Side Rings', false, (v) => {
    const arr = (((state.guard as any).extras) || []) as any[];
    const without = arr.filter((e) => e.kind !== 'sideRing');
    if (v) without.push({ kind: 'sideRing', radius: 0.12, thickness: 0.03, offsetY: 0 });
    (state.guard as any).extras = without;
  }, rerender, 'Add decorative rings at guard sides.');
  slider(sections.Guard, 'Ring Radius', 0.01, 0.4, 0.001, 0.12, (v) => {
    const arr = (((state.guard as any).extras) || []) as any[];
    (state.guard as any).extras = arr.map((e:any) => e.kind==='sideRing' ? { ...e, radius: v } : e);
  }, rerender, 'Side ring radius.');
  slider(sections.Guard, 'Ring Thick', 0.005, 0.1, 0.001, 0.03, (v) => {
    const arr = (((state.guard as any).extras) || []) as any[];
    (state.guard as any).extras = arr.map((e:any) => e.kind==='sideRing' ? { ...e, thickness: v } : e);
  }, rerender, 'Side ring thickness.');
  slider(sections.Guard, 'Ring OffsetY', -0.2, 0.2, 0.001, 0, (v) => {
    const arr = (((state.guard as any).extras) || []) as any[];
    (state.guard as any).extras = arr.map((e:any) => e.kind==='sideRing' ? { ...e, offsetY: v } : e);
  }, rerender, 'Side ring vertical offset.');
  checkbox(sections.Guard, 'Asymmetric Arms', state.guard.asymmetricArms ?? false, (v) => (state.guard.asymmetricArms = v), rerender, 'Scale left/right guard arms differently.');
  slider(sections.Guard, 'Arm Asymmetry', -1, 1, 0.01, state.guard.asymmetry ?? 0, (v) => (state.guard.asymmetry = v), rerender, 'Negative enlarges left; positive enlarges right.');
  slider(sections.Guard, 'Guard Detail', 3, 64, 1, state.guard.curveSegments ?? 12, (v) => (state.guard.curveSegments = Math.round(v)), rerender, 'Detail for guard curves.');
  checkbox(sections.Guard, 'Habaki', state.guard.habakiEnabled ?? false, (v) => (state.guard.habakiEnabled = v), rerender, 'Blade collar above the guard.');
  slider(sections.Guard, 'Habaki Height', 0.02, 0.2, 0.001, state.guard.habakiHeight ?? 0.06, (v) => (state.guard.habakiHeight = v), rerender, 'Height of the habaki collar.');
  slider(sections.Guard, 'Habaki Margin', 0.002, 0.08, 0.001, state.guard.habakiMargin ?? 0.01, (v) => (state.guard.habakiMargin = v), rerender, 'Clearance added to blade width/thickness.');
  slider(sections.Guard, 'Guard Height', -0.15, 0.15, 0.001, state.guard.heightOffset ?? 0, (v) => (state.guard.heightOffset = v), rerender, 'Vertical offset: top of guard vs blade base.');
  slider(sections.Guard, 'Quillon Count', 0, 4, 2, state.guard.quillonCount ?? 0, (v) => (state.guard.quillonCount = Math.round(v)), rerender, 'Number of quillons (0, 2, 4).');
  slider(sections.Guard, 'Quillon Length', 0.05, 1.5, 0.01, state.guard.quillonLength ?? 0.25, (v) => (state.guard.quillonLength = v), rerender, 'Length of each quillon.');
  slider(sections.Guard, 'Ornamentation', 0, 1, 0.01, state.guard.ornamentation ?? 0, (v) => (state.guard.ornamentation = v), rerender, 'Richer ends and facets.');
  slider(sections.Guard, 'Tip Sharpness', 0, 1, 0.01, state.guard.tipSharpness ?? 0.5, (v) => (state.guard.tipSharpness = v), rerender, 'Continuous tip shape for wing/claw.');
  slider(sections.Guard, 'Cutouts', 0, 12, 1, state.guard.cutoutCount ?? 0, (v) => (state.guard.cutoutCount = Math.round(v)), rerender, 'Tsuba (disk) radial cutouts.');
  slider(sections.Guard, 'Cutout Radius', 0.1, 0.8, 0.01, state.guard.cutoutRadius ?? 0.5, (v) => (state.guard.cutoutRadius = v), rerender, 'Cutout hole radius fraction.');
  // Basket-specific knobs
  slider(sections.Guard, 'Basket Rods', 4, 24, 1, (state.guard as any).basketRodCount ?? 12, (v) => ((state.guard as any).basketRodCount = Math.round(v)), rerender, 'Number of radial rods in basket.');
  slider(sections.Guard, 'Basket Rod Thick', 0.004, 0.08, 0.001, (state.guard as any).basketRodRadius ?? 0.02, (v) => ((state.guard as any).basketRodRadius = v), rerender, 'Rod radius for basket bars.');
  slider(sections.Guard, 'Basket Rings', 0, 2, 1, (state.guard as any).basketRingCount ?? 1, (v) => ((state.guard as any).basketRingCount = Math.round(v)), rerender, 'Number of rim rings (0..2).');
  slider(sections.Guard, 'Ring Thickness', 0.002, 0.06, 0.001, (state.guard as any).basketRingThickness ?? 0.012, (v) => ((state.guard as any).basketRingThickness = v), rerender, 'Minor radius of rim rings.');
  slider(sections.Guard, 'Ring Radius +', 0, 0.2, 0.001, (state.guard as any).basketRingRadiusAdd ?? 0.0, (v) => ((state.guard as any).basketRingRadiusAdd = v), rerender, 'Additional radius added to basket rim rings.');

  // Handle controls
  slider(sections.Handle, 'Length', 0.2, 2.0, 0.01, state.handle.length, (v) => (state.handle.length = v), rerender);
  slider(sections.Handle, 'Radius Top', 0.05, 0.3, 0.001, state.handle.radiusTop, (v) => (state.handle.radiusTop = v), rerender);
  slider(sections.Handle, 'Radius Bottom', 0.05, 0.3, 0.001, state.handle.radiusBottom, (v) => (state.handle.radiusBottom = v), rerender);
  checkbox(sections.Handle, 'Ridges', state.handle.segmentation, (v) => (state.handle.segmentation = v), rerender, 'Adds axial ridges along the grip.');
  slider(sections.Handle, 'Ridge Count', 0, 64, 1, state.handle.segmentationCount ?? 8, (v) => (state.handle.segmentationCount = Math.round(v)), rerender, 'Number of ridge cycles when Ridges enabled.');
  checkbox(sections.Handle, 'Wrap Enabled', state.handle.wrapEnabled ?? false, (v) => (state.handle.wrapEnabled = v), rerender, 'Enable helical wrap deformation for the grip.');
  slider(sections.Handle, 'Wrap Turns', 0, 20, 1, state.handle.wrapTurns ?? 6, (v) => (state.handle.wrapTurns = v), rerender, 'Number of helical cycles along the grip.');
  slider(sections.Handle, 'Wrap Depth', 0, 0.05, 0.001, state.handle.wrapDepth ?? 0.015, (v) => (state.handle.wrapDepth = v), rerender, 'Radial amplitude of the wrap pattern.');
  slider(sections.Handle, 'Handle Sides', 8, 128, 1, state.handle.phiSegments ?? 64, (v) => (state.handle.phiSegments = Math.round(v)), rerender, 'Radial tessellation (higher is smoother).');
  checkbox(sections.Handle, 'Wrap Texture', state.handle.wrapTexture ?? false, (v) => (state.handle.wrapTexture = v), rerender, 'Procedural diagonal stripe texture on grip.');
  slider(sections.Handle, 'Wrap Tex Scale', 1, 32, 1, state.handle.wrapTexScale ?? 10, (v) => (state.handle.wrapTexScale = Math.round(v)), rerender, 'Texture repeat scale.');
  slider(sections.Handle, 'Wrap Tex Angle', -90, 90, 1, (state.handle.wrapTexAngle ?? (Math.PI/4)) * 180/Math.PI, (v) => (state.handle.wrapTexAngle = (v*Math.PI/180)), rerender, 'Stripe angle (degrees).');
  slider(sections.Handle, 'Oval Ratio', 1, 1.8, 0.01, state.handle.ovalRatio ?? 1, (v) => (state.handle.ovalRatio = v), rerender, 'Wider X vs Z for an oval tsuka.');
  slider(sections.Handle, 'Flare', 0, 0.2, 0.001, state.handle.flare ?? 0, (v) => (state.handle.flare = v), rerender, 'Extra radius near the pommel.');
  slider(sections.Handle, 'Handle Curvature', -0.2, 0.2, 0.001, state.handle.curvature ?? 0, (v) => (state.handle.curvature = v), rerender, 'Slight bend in handle along length.');
  checkbox(sections.Handle, 'Tang Visible', state.handle.tangVisible ?? false, (v) => (state.handle.tangVisible = v), rerender, 'Show a rectangular tang through the handle.');
  slider(sections.Handle, 'Tang Width', 0.005, 0.2, 0.001, state.handle.tangWidth ?? 0.05, (v) => (state.handle.tangWidth = v), rerender, 'Visible tang width.');
  slider(sections.Handle, 'Tang Thickness', 0.003, 0.1, 0.001, state.handle.tangThickness ?? 0.02, (v) => (state.handle.tangThickness = v), rerender, 'Visible tang thickness.');
  // Handle layers (simple)
  checkbox(sections.Handle, 'Crisscross Wrap Layer', false, (v) => {
    const arr = (((state.handle as any).handleLayers) || []) as any[];
    const rest = arr.filter((e:any) => !(e.kind==='wrap' && e.wrapPattern==='crisscross'));
    if (v) rest.push({ kind:'wrap', wrapPattern:'crisscross', y0Frac:0, lengthFrac:1, turns:7, depth:0.012 });
    (state.handle as any).handleLayers = rest;
  }, rerender, 'Adds two intertwined helices around the grip.');
  slider(sections.Handle, 'Wrap Turns L', 1, 20, 1, 7, (val) => {
    const arr = (((state.handle as any).handleLayers) || []) as any[];
    (state.handle as any).handleLayers = arr.map((e:any) => e.kind==='wrap' && e.wrapPattern==='crisscross' ? { ...e, turns: Math.round(val) } : e);
  }, rerender, 'Number of crisscross turns.');
  slider(sections.Handle, 'Wrap Depth', 0.001, 0.05, 0.001, 0.012, (val) => {
    const arr = (((state.handle as any).handleLayers) || []) as any[];
    (state.handle as any).handleLayers = arr.map((e:any) => e.kind==='wrap' && e.wrapPattern==='crisscross' ? { ...e, depth: val } : e);
  }, rerender, 'Radial height of the wrap layer.');
  slider(sections.Handle, 'Wrap Y0 %', 0, 100, 1, 0, (val) => {
    const arr = (((state.handle as any).handleLayers) || []) as any[];
    (state.handle as any).handleLayers = arr.map((e:any) => e.kind==='wrap' && e.wrapPattern==='crisscross' ? { ...e, y0Frac: (val/100) } : e);
  }, rerender, 'Start position of wrap (percent of handle length).');
  slider(sections.Handle, 'Wrap Len %', 1, 100, 1, 100, (val) => {
    const arr = (((state.handle as any).handleLayers) || []) as any[];
    (state.handle as any).handleLayers = arr.map((e:any) => e.kind==='wrap' && e.wrapPattern==='crisscross' ? { ...e, lengthFrac: Math.max(0.01, (val/100)) } : e);
  }, rerender, 'Length of the wrap section (percent of handle).');
  checkbox(sections.Handle, 'Handle Ring', false, (v) => {
    const arr = (((state.handle as any).handleLayers) || []) as any[];
    const rest = arr.filter((e:any) => e.kind!=='ring');
    if (v) rest.push({ kind:'ring', y0Frac:0.5, radiusAdd:0.0 });
    (state.handle as any).handleLayers = rest;
  }, rerender, 'Add a decorative ring around the grip.');
  slider(sections.Handle, 'Ring Y %', 0, 100, 1, 50, (val) => {
    const arr = (((state.handle as any).handleLayers) || []) as any[];
    (state.handle as any).handleLayers = arr.map((e:any) => e.kind==='ring' ? { ...e, y0Frac: (val/100) } : e);
  }, rerender, 'Vertical position of ring.');
  slider(sections.Handle, 'Ring Radius +', 0, 0.2, 0.001, 0.0, (val) => {
    const arr = (((state.handle as any).handleLayers) || []) as any[];
    (state.handle as any).handleLayers = arr.map((e:any) => e.kind==='ring' ? { ...e, radiusAdd: val } : e);
  }, rerender, 'Additional radius for ring.');
  slider(sections.Handle, 'Rings Count', 0, 3, 1, 1, (val) => {
    const n = Math.max(0, Math.round(val));
    const arr = (((state.handle as any).handleLayers) || []) as any[];
    const others = arr.filter((e:any) => e.kind!=='ring');
    const rings: any[] = [];
    if (n>0) {
      for (let i=0;i<n;i++) {
        const t = (n===1) ? 0.5 : (i/(n-1))*0.8 + 0.1; // spread 10%..90%
        rings.push({ kind:'ring', y0Frac: t, radiusAdd: 0.0 });
      }
    }
    (state.handle as any).handleLayers = [...others, ...rings];
  }, rerender, 'Create multiple ring layers, evenly spaced.');
  checkbox(sections.Handle, 'Menuki', false, (v) => {
    (state.handle as any).menuki = v ? [{ positionFrac: 0.55, side:'left', size:0.02 }] : [];
  }, rerender, 'Add a menuki ornament on the grip.');
  // Rivets
  checkbox(sections.Handle, 'Rivets', false, (v) => {
    (state.handle as any).rivets = v ? [{ count: 8, ringFrac: 0.3, radius: 0.01 }] : [];
  }, rerender, 'Add a ring of rivets.');
  slider(sections.Handle, 'Rivets Count', 1, 32, 1, 8, (val) => {
    const arr = (((state.handle as any).rivets) || []) as any[];
    (state.handle as any).rivets = arr.map((r:any) => ({ ...r, count: Math.round(val) }));
  }, rerender, 'Number of rivets around the ring.');
  slider(sections.Handle, 'Rivets Y %', 0, 100, 1, 30, (val) => {
    const arr = (((state.handle as any).rivets) || []) as any[];
    (state.handle as any).rivets = arr.map((r:any) => ({ ...r, ringFrac: (val/100) }));
  }, rerender, 'Vertical position of rivets ring.');
  slider(sections.Handle, 'Rivet Size', 0.002, 0.05, 0.001, 0.01, (val) => {
    const arr = (((state.handle as any).rivets) || []) as any[];
    (state.handle as any).rivets = arr.map((r:any) => ({ ...r, radius: val }));
  }, rerender, 'Rivet sphere radius.');

  // Pommel controls
  select(sections.Pommel, 'Style', ['orb', 'disk', 'spike'], state.pommel.style, (v) => (state.pommel.style = v as any), rerender);
  slider(sections.Pommel, 'Size', 0.05, 0.5, 0.001, state.pommel.size, (v) => (state.pommel.size = v), rerender);
  slider(sections.Pommel, 'Elongation', 0.5, 2.0, 0.01, state.pommel.elongation, (v) => (state.pommel.elongation = v), rerender);
  slider(sections.Pommel, 'Morph', 0, 1, 0.01, state.pommel.shapeMorph, (v) => (state.pommel.shapeMorph = v), rerender);
  slider(sections.Pommel, 'Offset X', -0.3, 0.3, 0.001, state.pommel.offsetX ?? 0, (v) => (state.pommel.offsetX = v), rerender, 'Offset pommel sideways.');
  slider(sections.Pommel, 'Offset Y', -0.3, 0.3, 0.001, state.pommel.offsetY ?? 0, (v) => (state.pommel.offsetY = v), rerender, 'Offset pommel up/down.');
  slider(sections.Pommel, 'Facet Count', 6, 64, 1, state.pommel.facetCount ?? 32, (v) => (state.pommel.facetCount = Math.round(v)), rerender, 'Radial facets (lower is more gem-like).');
  slider(sections.Pommel, 'Spike Length', 0.5, 2.0, 0.01, state.pommel.spikeLength ?? 1.0, (v) => (state.pommel.spikeLength = v), rerender, 'Spike length for spike style.');
  slider(sections.Pommel, 'Balance', 0, 1, 0.01, (state.pommel as any).balance ?? 0, (v) => ((state.pommel as any).balance = v), rerender, 'Interpolate pommel size toward blade-balanced target.');

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

  // JSON export: model + render + materials
  btnExportJSON.addEventListener('click', () => {
    const payload = {
      $schema: 'schema/sword.schema.json',
      version: 2,
      model: state,
      render: { ...rstate },
      materials: matState
    } as const;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'swordmaker.json'; a.click();
    URL.revokeObjectURL(url);
  });
  btnImportJSON.addEventListener('click', () => fileJSON.click());
  fileJSON.addEventListener('change', async () => {
    const f = fileJSON.files?.[0]; if (!f) return;
    try {
      const text = await f.text();
      const obj = JSON.parse(text);
      // Validate against JSON Schema using Ajv
      try {
        const schemaUrl = obj?.$schema || 'schema/sword.schema.json';
        const res = await fetch(schemaUrl);
        const schema = await res.json();
        // @ts-ignore
        const Ajv = (await import('ajv')).default;
        const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
        const validate = ajv.compile(schema);
        const valid = validate(obj);
        if (!valid) {
          const errs = (validate.errors || []).map((e:any) => `- ${e.instancePath || e.schemaPath}: ${e.message}`).join('\n');
          alert('Import failed: JSON does not match schema.\n' + errs);
          return;
        }
      } catch (e) {
        console.warn('Schema validation skipped or failed to load:', e);
      }
      if (obj?.model) { assignParams(state, obj.model); rerender(); refreshInputs(el, state); }
      if (obj?.materials) {
        const parts: (keyof typeof matState)[] = ['blade','guard','handle','pommel'];
        for (const part of parts) {
          const m = obj.materials[part]; if (!m) continue;
          matState[part] = { ...matState[part], ...m };
          const c = parseInt((matState[part].color||'#ffffff').replace('#','0x'));
          render?.setPartColor(part, c);
          render?.setPartMetalness(part, matState[part].metalness);
          render?.setPartRoughness(part, matState[part].roughness);
          render?.setPartClearcoat(part, matState[part].clearcoat);
          render?.setPartClearcoatRoughness(part, matState[part].clearcoatRoughness);
          render?.setPartBump(part, matState[part].bumpEnabled, matState[part].bumpScale, matState[part].bumpNoiseScale, matState[part].bumpSeed);
        }
      }
      if (obj?.render && render) {
        const R = obj.render;
        const col = typeof R.bgColor === 'string' ? parseInt(R.bgColor.replace('#','0x')) : undefined;
        if (typeof R.exposure === 'number') { rstate.exposure = R.exposure; render.setExposure(R.exposure); }
        if (typeof R.ambient === 'number') { rstate.ambient = R.ambient; render.setAmbient(R.ambient); }
        if (typeof R.keyIntensity === 'number') { rstate.keyIntensity = R.keyIntensity; render.setKeyIntensity(R.keyIntensity); }
        if (typeof R.keyAz === 'number' || typeof R.keyEl === 'number') { rstate.keyAz = R.keyAz ?? rstate.keyAz; rstate.keyEl = R.keyEl ?? rstate.keyEl; render.setKeyAngles(rstate.keyAz, rstate.keyEl); }
        if (typeof R.rimIntensity === 'number') { rstate.rimIntensity = R.rimIntensity; render.setRimIntensity(R.rimIntensity); }
        if (typeof R.rimAz === 'number' || typeof R.rimEl === 'number') { rstate.rimAz = R.rimAz ?? rstate.rimAz; rstate.rimEl = R.rimEl ?? rstate.rimEl; render.setRimAngles(rstate.rimAz, rstate.rimEl); }
        if (typeof R.rimColor === 'string') { rstate.rimColor = R.rimColor; render.setRimColor(parseInt(R.rimColor.replace('#','0x'))); }
        if (typeof R.bgBrightness === 'number') { rstate.bgBrightness = R.bgBrightness; render.setBackgroundBrightness(R.bgBrightness); }
        if (typeof col === 'number') { rstate.bgColor = R.bgColor; render.setBackgroundColor(col); }
        if (typeof R.bloomEnabled === 'boolean' || typeof R.bloomStrength === 'number' || typeof R.bloomThreshold === 'number' || typeof R.bloomRadius === 'number') {
          rstate.bloomEnabled = R.bloomEnabled ?? rstate.bloomEnabled; rstate.bloomStrength = R.bloomStrength ?? rstate.bloomStrength; rstate.bloomThreshold = R.bloomThreshold ?? rstate.bloomThreshold; rstate.bloomRadius = R.bloomRadius ?? rstate.bloomRadius;
          render.setBloom(rstate.bloomEnabled, rstate.bloomStrength, rstate.bloomThreshold, rstate.bloomRadius);
        }
      }
      // Sync material UI for current part
      setTimeout(()=>syncMaterialInputs(),0);
    } catch (e) {
      console.error('Import JSON failed', e);
    } finally {
      fileJSON.value = '';
    }
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
  if (tooltip) {
    lab.title = tooltip;
    const hi = document.createElement('span');
    hi.className = 'help-icon';
    hi.textContent = '?';
    hi.title = tooltip;
    lab.appendChild(hi);
  }
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
  if (tooltip) { lab.title = tooltip; const hi = document.createElement('span'); hi.className = 'help-icon'; hi.textContent = '?'; hi.title = tooltip; lab.appendChild(hi); }
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
  if (tooltip) { lab.title = tooltip; const hi = document.createElement('span'); hi.className = 'help-icon'; hi.textContent = '?'; hi.title = tooltip; lab.appendChild(hi); }
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

function colorPicker(parent: HTMLElement, label: string, value: string, onChange: (hex: string) => void, rerender: () => void, tooltip?: string) {
  const row = document.createElement('div');
  row.className = 'row';
  const lab = document.createElement('label');
  lab.textContent = label;
  if (tooltip) { lab.title = tooltip; const hi = document.createElement('span'); hi.className = 'help-icon'; hi.textContent = '?'; hi.title = tooltip; lab.appendChild(hi); }
  const input = document.createElement('input');
  input.type = 'color';
  input.value = value;
  input.addEventListener('input', () => {
    onChange(input.value);
    rerender();
  });
  row.appendChild(lab);
  const span = document.createElement('span');
  span.appendChild(input);
  row.appendChild(span);
  parent.appendChild(row);
}

function textRow(parent: HTMLElement, label: string, value: string, onChange: (v: string) => void, tooltip?: string) {
  const row = document.createElement('div');
  row.className = 'row';
  const lab = document.createElement('label');
  lab.textContent = label;
  if (tooltip) lab.title = tooltip;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
  input.placeholder = 'http(s):// or relative path';
  input.addEventListener('change', () => { onChange(input.value); });
  row.appendChild(lab);
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
    'Tip Shape': (params.blade.tipShape ?? 'pointed'),
    'Leaf Bulge': (params.blade.tipBulge ?? 0.2),
    'Cross Section': (params.blade.crossSection ?? 'flat'),
    'Edge Bevel': (params.blade.bevel ?? 0.5),
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
    'Serration Pattern': (params.blade as any).serrationPattern ?? 'sine',
    'Serration Seed': (params.blade as any).serrationSeed ?? 1337,
    'Fuller Mode': (params.blade as any).fullerMode ?? 'overlay',
    'Fuller Profile': (params.blade as any).fullerProfile ?? 'u',
    'Fuller Width': (params.blade as any).fullerWidth ?? 0,
    'Fuller Inset': (params.blade as any).fullerInset ?? (params.blade.fullerDepth ?? 0),
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
    'Asymmetric Arms': params.guard.asymmetricArms ?? false,
    'Arm Asymmetry': params.guard.asymmetry ?? 0,
    'Guard Detail': params.guard.curveSegments ?? 12,
    'Habaki': params.guard.habakiEnabled ?? false,
    'Habaki Height': params.guard.habakiHeight ?? 0.06,
    'Habaki Margin': params.guard.habakiMargin ?? 0.01,
    'Guard Height': params.guard.heightOffset ?? 0,
    'Quillon Count': params.guard.quillonCount ?? 0,
    'Quillon Length': params.guard.quillonLength ?? 0.25,
    'Ornamentation': params.guard.ornamentation ?? 0,
    'Tip Sharpness': params.guard.tipSharpness ?? 0.5,
    'Cutouts': params.guard.cutoutCount ?? 0,
    'Cutout Radius': params.guard.cutoutRadius ?? 0.5,
    'Length_h': params.handle.length,
    'Radius Top': params.handle.radiusTop,
    'Radius Bottom': params.handle.radiusBottom,
    'Ridges': params.handle.segmentation,
    'Ridge Count': params.handle.segmentationCount ?? 8,
    'Wrap Enabled': params.handle.wrapEnabled ?? false,
    'Wrap Turns': params.handle.wrapTurns ?? 6,
    'Wrap Depth': params.handle.wrapDepth ?? 0.015,
    'Handle Sides': params.handle.phiSegments ?? 64,
    'Oval Ratio': params.handle.ovalRatio ?? 1,
    'Flare': params.handle.flare ?? 0,
    'Handle Curvature': params.handle.curvature ?? 0,
    'Tang Visible': params.handle.tangVisible ?? false,
    'Tang Width': params.handle.tangWidth ?? 0.05,
    'Tang Thickness': params.handle.tangThickness ?? 0.02,
    'Wrap Texture': params.handle.wrapTexture ?? false,
    'Wrap Tex Scale': params.handle.wrapTexScale ?? 10,
    'Wrap Tex Angle': ((params.handle.wrapTexAngle ?? (Math.PI/4)) * 180/Math.PI),
    'Style_p': params.pommel.style,
    'Size': params.pommel.size,
    'Elongation': params.pommel.elongation,
    'Morph': params.pommel.shapeMorph
    ,
    'Offset X': params.pommel.offsetX ?? 0,
    'Offset Y': params.pommel.offsetY ?? 0,
    'Facet Count': params.pommel.facetCount ?? 32,
    'Spike Length': params.pommel.spikeLength ?? 1.0,
    'Balance': (params.pommel as any).balance ?? 0
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
  const styles = ['bar', 'winged', 'claw', 'disk', 'knucklebow', 'swept', 'basket'] as const;
  p.guard.style = (styles as any)[Math.floor(r(0, styles.length))] as any;
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
  (p.blade as any).crossSection = 'lenticular'; (p.blade as any).bevel = 0.6;
  p.blade.fullerEnabled = false; p.blade.fullerDepth = 0; p.blade.fullerLength = 0; (p.blade as any).asymmetry = 0.2; p.blade.chaos = 0.05;
  (p.blade as any).edgeType = 'single'; p.blade.thicknessLeft = 0.10; p.blade.thicknessRight = 0.02; (p.blade as any).hamonEnabled = true; (p.blade as any).hamonWidth = 0.018; (p.blade as any).hamonAmplitude = 0.007; (p.blade as any).hamonFrequency = 6; (p.blade as any).hamonSide = 'right';
  p.guard.style = 'disk'; p.guard.width = 0.36; p.guard.thickness = 0.1; p.guard.curve = 0; p.guard.tilt = 0; (p.blade as any).baseAngle = 0.05; (p.blade as any).soriProfile = 'koshi'; (p.blade as any).soriBias = 0.7; (p.blade as any).kissakiLength = 0.12; (p.blade as any).kissakiRoundness = 0.6; (p.guard as any).habakiEnabled = true; (p.guard as any).habakiHeight = 0.06; (p.guard as any).habakiMargin = 0.012;
  p.handle.length = 1.1; p.handle.radiusTop = 0.11; p.handle.radiusBottom = 0.11; p.handle.segmentation = false; p.handle.wrapEnabled = true; (p.handle as any).wrapTexture = true; p.handle.wrapTurns = 10; p.handle.wrapDepth = 0.012; (p.handle as any).ovalRatio = 1.2;
  p.pommel.style = 'disk'; p.pommel.size = 0.12; p.pommel.elongation = 1.0; p.pommel.shapeMorph = 0.1;
  return p;
}

function presetClaymore(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 2.8; p.blade.baseWidth = 0.32; p.blade.tipWidth = 0.08; p.blade.curvature = 0.0; (p.blade as any).crossSection = 'diamond'; (p.blade as any).bevel = 0.5; p.blade.fullerEnabled = true; p.blade.fullerDepth = 0.03; p.blade.fullerLength = 0.6;
  p.guard.style = 'winged'; p.guard.width = 1.6; p.guard.thickness = 0.24; p.guard.curve = 0.15;
  p.handle.length = 0.9; p.handle.radiusTop = 0.13; p.handle.radiusBottom = 0.13; p.handle.segmentation = false;
  p.pommel.style = 'orb'; p.pommel.size = 0.18; p.pommel.elongation = 1.0; p.pommel.shapeMorph = 0.1;
  return p;
}

function presetRapier(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 3.2; p.blade.baseWidth = 0.18; p.blade.tipWidth = 0.05; p.blade.curvature = 0.0; (p.blade as any).crossSection = 'diamond'; (p.blade as any).bevel = 0.3; p.blade.fullerEnabled = false; p.blade.fullerDepth = 0.0; p.blade.fullerLength = 0.0;
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
