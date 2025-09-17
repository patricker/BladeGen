import { SwordGenerator, SwordParams, defaultSwordParams, buildBladeOutlinePoints, bladeOutlineToSVG } from '../three/SwordGenerator';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

type Category = 'Blade' | 'Engravings' | 'Guard' | 'Handle' | 'Pommel' | 'Other' | 'Render';

type RenderHooks = {
  setBladeVisible?: (visible: boolean, occlude?: boolean) => void;
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
  setBladeMistAdvanced?: (cfg: { occlude?: boolean; lifeRate?: number; noiseAmp?: number; noiseFreqX?: number; noiseFreqZ?: number; windX?: number; windZ?: number; emission?: 'base'|'edge'|'tip'|'full'; sizeMinRatio?: number }) => void;
  setSelectiveBloom?: (enabled: boolean, strength?: number, threshold?: number, radius?: number, intensity?: number) => void;
  markForBloom?: (obj: any, enable?: boolean) => void;
  setHeatHaze?: (enabled: boolean, distortion?: number) => void;
  markForHeat?: (obj: any, enable?: boolean) => void;
  setFlameAura?: (enabled: boolean, opts?: { scale?: number; color1?: number; color2?: number; noiseScale?: number; speed?: number; intensity?: number }) => void;
  setEmbers?: (enabled: boolean, opts?: { count?: number; size?: number; color?: number }) => void;
  setMistTurbulence?: (v: number) => void;
  setPartColor: (part: 'blade'|'guard'|'handle'|'pommel', hex: number) => void;
  setPartMetalness: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => void;
  setPartRoughness: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => void;
  setPartClearcoat: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => void;
  setPartClearcoatRoughness: (part: 'blade'|'guard'|'handle'|'pommel', v: number) => void;
};

type ControlType = 'slider' | 'select' | 'checkbox' | 'color' | 'text';

type ControlHandle = {
  field: string;
  row: HTMLElement;
  section: string;
  label: string;
  type: ControlType;
  setValue: (value: unknown) => void;
};

export class ControlRegistry {
  private controls = new Map<string, ControlHandle>();
  private bySectionLabel = new Map<string, ControlHandle>();

  registerControl(parent: HTMLElement, row: HTMLElement, label: string, type: ControlType, setValue: (value: unknown) => void, fieldOverride?: string) {
    const section = this.resolveSectionSlug(parent);
    const labelSlug = slugify(label);
    const field = fieldOverride || `${section}.${labelSlug}`;
    row.dataset.field = field;
    const handle: ControlHandle = { field, row, section, label: labelSlug, type, setValue };
    this.controls.set(field, handle);
    this.bySectionLabel.set(`${section}:${labelSlug}`, handle);
    return field;
  }

  setValueByField(field: string, value: unknown) {
    const handle = this.controls.get(field);
    if (!handle) return;
    handle.setValue(value);
  }

  setValue(section: string, label: string, value: unknown) {
    const handle = this.bySectionLabel.get(`${section}:${slugify(label)}`);
    if (!handle) return;
    handle.setValue(value);
  }

  setWarningByField(field: string, on: boolean, tooltip?: string) {
    const handle = this.controls.get(field);
    if (!handle) return;
    this.applyWarning(handle, on, tooltip);
  }

  setWarning(section: string, label: string, on: boolean, tooltip?: string) {
    const handle = this.bySectionLabel.get(`${section}:${slugify(label)}`);
    if (!handle) return;
    this.applyWarning(handle, on, tooltip);
  }

  clearWarnings() {
    for (const handle of this.controls.values()) {
      this.applyWarning(handle, false);
    }
  }

  getField(section: string, label: string) {
    const handle = this.bySectionLabel.get(`${section}:${slugify(label)}`);
    return handle?.field;
  }

  private applyWarning(handle: ControlHandle, on: boolean, tooltip?: string) {
    const lab = handle.row.querySelector('label') as HTMLElement | null;
    if (!lab) return;
    if (!lab.dataset.warnOriginalTitle) {
      lab.dataset.warnOriginalTitle = lab.title || '';
    }
    if (on) {
      lab.style.color = '#eab308';
      if (tooltip) {
        lab.title = tooltip;
      } else {
        lab.title = lab.dataset.warnOriginalTitle || '';
      }
      let icon = handle.row.querySelector('.warn-icon') as HTMLElement | null;
      if (!icon) {
        icon = document.createElement('span');
        icon.className = 'warn-icon';
        icon.textContent = '⚠';
        icon.title = tooltip || 'Extreme value';
        icon.style.marginLeft = '4px';
        icon.style.color = '#eab308';
        icon.style.fontSize = '12px';
        lab.insertAdjacentElement('beforeend', icon);
      } else {
        icon.title = tooltip || icon.title || 'Extreme value';
      }
    } else {
      lab.style.color = '';
      lab.title = lab.dataset.warnOriginalTitle || '';
      const existing = handle.row.querySelector('.warn-icon');
      existing?.remove();
    }
  }

  private resolveSectionSlug(elem: HTMLElement) {
    const namespace = this.findNamespace(elem);
    return namespace || 'root';
  }

  private findNamespace(elem: HTMLElement | null): string | undefined {
    let current: HTMLElement | null = elem;
    while (current) {
      if (current.dataset && current.dataset.fieldNamespace) {
        return current.dataset.fieldNamespace;
      }
      current = current.parentElement;
    }
    return undefined;
  }
}

let activeRegistry: ControlRegistry | null = null;

function getActiveRegistry() {
  if (!activeRegistry) {
    throw new Error('Control registry not initialised');
  }
  return activeRegistry;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '') || 'field';
}

export function createSidebar(el: HTMLElement, sword: SwordGenerator, params: SwordParams, render?: RenderHooks) {
  const registry = new ControlRegistry();
  const previousRegistry = activeRegistry;
  activeRegistry = registry;
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
    envIntensity: 1.0,
    aaMode: 'fxaa' as 'none'|'fxaa'|'smaa',
    shadowMapSize: 2048 as 1024|2048|4096,
    qualityPreset: 'Medium' as 'Low'|'Medium'|'High',
    toneMapping: 'ACES' as 'ACES'|'Reinhard'|'Cineon'|'Linear'|'None'
  };
  const postState = {
    outlineEnabled: false,
    outlineStrength: 2.5,
    outlineThickness: 1.0,
    outlineColor: '#ffffff',
    inkEnabled: false,
    inkThickness: 0.02,
    inkColor: '#000000',
    vignetteEnabled: false,
    vignetteStrength: 0.25,
    vignetteSoftness: 0.5,
    bladeGradientEnabled: false,
    gradBase: '#b9c6ff',
    gradEdge: '#ffffff',
    gradFade: 0.2,
    gradWear: 0.2
  };
  const atmosState = {
    envUrl: '',
    envPreset: 'None' as 'None' | 'Room' | 'Royal Esplanade' | 'Venice Sunset',
    envAsBackground: false,
    fogColor: '#ffffff',
    fogDensity: 0.03,
    fresnelEnabled: false,
    fresnelColor: '#ffffff',
    fresnelIntensity: 0.6,
    fresnelPower: 2.0,
    bladeInvisible: false,
    occludeInvisible: false,
  };
  const fxState = {
    innerGlow: { enabled: false, color: '#88ccff', min: 0.2, max: 0.9, speed: 1.5 },
    mist: {
      enabled: false,
      color: '#88aadd',
      density: 0.4,
      speed: 0.6,
      spread: 0.08,
      size: 6.0,
      lifeRate: 0.25,
      turbulence: 0.08,
      windX: 0,
      windZ: 0,
      emission: 'base' as 'base' | 'edge' | 'tip' | 'full',
      sizeMinRatio: 0.5,
      occlude: false,
    },
    flame: {
      enabled: false,
      color1: '#ff5a00',
      color2: '#fff18a',
      intensity: 1.0,
      speed: 1.6,
      noiseScale: 2.2,
      scale: 1.05,
      direction: 'Up' as 'Up' | 'Down',
      blend: 'Add' as 'Add' | 'Darken' | 'Multiply',
    },
    selectiveBloom: false,
    heatHaze: false,
    embers: { enabled: false, count: 120, size: 3, color: '#ffaa55' },
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
  let matPart: Part = 'blade';
  let raf = 0; let needs = false;
  const flush = () => { raf = 0; if (!needs) return; needs = false; sword.updateGeometry(state); updateWarnings(); updateDynamics(); };
  const refreshWarnings = () => { try { updateWarnings(); } catch {} };
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
  toolbar.dataset.fieldNamespace = 'toolbar';
  el.appendChild(toolbar);

  // Presets dropdown
  const presetSel = document.createElement('select');
  presetSel.innerHTML = `
    <option value="custom">Preset: Custom</option>
    <option value="katana">Katana</option>
    <option value="claymore">Claymore</option>
    <option value="rapier">Rapier</option>
    <option value="arming">Arming Sword</option>
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

  // Export dropdown (combo button)
  const exportWrap = document.createElement('div');
  exportWrap.className = 'dropdown model-only';
  const btnExportMenu = document.createElement('button');
  btnExportMenu.textContent = 'Export ▾';
  exportWrap.appendChild(btnExportMenu);
  const exportMenu = document.createElement('div');
  exportMenu.className = 'menu';
  const makeMenuBtn = (label: string) => { const b = document.createElement('button'); b.type='button'; b.textContent = label; return b; };
  const menuGLB = makeMenuBtn('GLB');
  const menuOBJ = makeMenuBtn('OBJ');
  const menuSTL = makeMenuBtn('STL');
  const menuSVG = makeMenuBtn('SVG Blueprint');
  const menuJSON = makeMenuBtn('JSON (Model + Render + Materials)');
  exportMenu.appendChild(menuGLB);
  exportMenu.appendChild(menuOBJ);
  exportMenu.appendChild(menuSTL);
  exportMenu.appendChild(menuSVG);
  exportMenu.appendChild(menuJSON);
  exportWrap.appendChild(exportMenu);
  toolbar.appendChild(exportWrap);

  // JSON Import
  const btnImportJSON = document.createElement('button');
  btnImportJSON.textContent = 'Import JSON';
  toolbar.appendChild(btnImportJSON);
  const fileJSON = document.createElement('input');
  fileJSON.type = 'file'; fileJSON.accept = 'application/json'; fileJSON.style.display = 'none';
  el.appendChild(fileJSON);

  // Sections
  const sections: Record<Category, HTMLElement> = {
    Blade: addSection(el, 'Blade'),
    Engravings: addSection(el, 'Engravings'),
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
    sections.Engravings.style.display = isRender ? 'none' : '';
    sections.Guard.style.display = isRender ? 'none' : '';
    sections.Handle.style.display = isRender ? 'none' : '';
    sections.Pommel.style.display = isRender ? 'none' : '';
    sections.Other.style.display = isRender ? 'none' : '';
    sections.Render.style.display = isRender ? '' : 'none';
    // Hide model-only toolbar items on Render tab
    const modelOnly = toolbar.querySelectorAll('.model-only');
    modelOnly.forEach((b) => { (b as HTMLElement).style.display = isRender ? 'none' : ''; });
  };
  tabModel.addEventListener('click', () => { try{ localStorage.setItem('swordmaker.ui.tab','Model'); }catch{} try { const t = localStorage.getItem('swordmaker.ui.tab'); showTab(t==='Render'?'Render':'Model'); } catch { showTab('Model'); } });
  tabRender.addEventListener('click', () => { try{ localStorage.setItem('swordmaker.ui.tab','Render'); }catch{} showTab('Render'); });
  showTab('Model');

  // Per-section shuffle buttons
  addShuffleButton(sections.Blade, () => { randomizeBlade(state, true); rerender(); syncUi(); });
  addShuffleButton(sections.Guard, () => { randomizeGuard(state, true); rerender(); syncUi(); });
  addShuffleButton(sections.Handle, () => { randomizeHandle(state, true); rerender(); syncUi(); });
  addShuffleButton(sections.Pommel, () => { randomizePommel(state, true); rerender(); syncUi(); });

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
  const dynamicsBox = document.createElement('div');
  dynamicsBox.style.fontSize = '12px';
  dynamicsBox.style.color = '#93c5fd';
  dynamicsBox.style.marginTop = '6px';
  sections.Other.appendChild(dynamicsBox);
  const fxSyncBox = document.createElement('div');
  fxSyncBox.style.fontSize = '12px';
  fxSyncBox.style.color = '#10b981';
  fxSyncBox.style.marginTop = '4px';
  fxSyncBox.textContent = '';
  sections.Other.appendChild(fxSyncBox);
  try {
    window.addEventListener('swordmaker:fx-synced' as any, (e: any) => {
      const when = new Date();
      const hh = String(when.getHours()).padStart(2,'0');
      const mm = String(when.getMinutes()).padStart(2,'0');
      const ss = String(when.getSeconds()).padStart(2,'0');
      const parts = (e?.detail?.parts || []).join(', ');
      fxSyncBox.textContent = `FX synced ${hh}:${mm}:${ss}` + (parts ? ` (${parts})` : '');
    });
  } catch {}

  // Render controls (if hooks available)
  // Keep handles to Render subsections needed later
  let rMatSec: HTMLElement | null = null;
  let rGradSec: HTMLElement | null = null;
  function syncMaterialInputs(currentPart?: Part) {
    const partKey: Part = currentPart || matPart;
    const m = matState[partKey];
    registry.setValue('render-materials', 'Material Part', partKey);
    registry.setValue('render-materials', 'Base Color', m.color);
    registry.setValue('render-materials', 'Metalness', m.metalness);
    registry.setValue('render-materials', 'Roughness', m.roughness);
    registry.setValue('render-materials', 'Clearcoat', m.clearcoat);
    registry.setValue('render-materials', 'Clearcoat Rough', m.clearcoatRoughness);
    registry.setValue('render-materials', 'Mat Preset', m.preset || 'None');
    registry.setValue('render-materials', 'Bump Enabled', m.bumpEnabled);
    registry.setValue('render-materials', 'Bump Scale', m.bumpScale);
    registry.setValue('render-materials', 'Noise Scale', m.bumpNoiseScale);
    registry.setValue('render-materials', 'Noise Seed', m.bumpSeed);
    registry.setValue('render-materials', 'Emissive Color', m.emissiveColor ?? '#000000');
    registry.setValue('render-materials', 'Emissive Intensity', m.emissiveIntensity ?? 0);
    registry.setValue('render-materials', 'Transmission', m.transmission ?? 0);
    registry.setValue('render-materials', 'IOR', m.ior ?? 1.5);
    registry.setValue('render-materials', 'Thickness', m.thickness ?? 0);
    registry.setValue('render-materials', 'Atten Color', m.attenuationColor ?? '#ffffff');
    registry.setValue('render-materials', 'Atten Dist', m.attenuationDistance ?? 1);
    registry.setValue('render-materials', 'Sheen', m.sheen ?? 0);
    registry.setValue('render-materials', 'Sheen Color', m.sheenColor ?? '#ffffff');
    registry.setValue('render-materials', 'Iridescence', m.iridescence ?? 0);
    registry.setValue('render-materials', 'Iridescence IOR', m.iridescenceIOR ?? 1.3);
    registry.setValue('render-materials', 'Iridescence Min', m.iridescenceThicknessMin ?? 100);
    registry.setValue('render-materials', 'Iridescence Max', m.iridescenceThicknessMax ?? 400);
    registry.setValue('render-materials', 'EnvMap Intensity', m.envMapIntensity ?? 1);
  }

  const syncRenderControls = () => {
    registry.setValue('render-quality-exposure', 'AA Mode', rstate.aaMode);
    registry.setValue('render-quality-exposure', 'Quality', rstate.qualityPreset);
    registry.setValue('render-quality-exposure', 'Shadow Map', String(rstate.shadowMapSize));
    registry.setValue('render-quality-exposure', 'Tone Mapping', rstate.toneMapping);
    registry.setValue('render-quality-exposure', 'Exposure', rstate.exposure);
    registry.setValue('render-quality-exposure', 'Env Intensity', rstate.envIntensity);
    registry.setValue('render-background', 'Background Color', rstate.bgColor);
    registry.setValue('render-background', 'Background Bright', rstate.bgBrightness);
    registry.setValue('render-lights', 'Ambient Intensity', rstate.ambient);
    registry.setValue('render-lights', 'Key Intensity', rstate.keyIntensity);
    registry.setValue('render-lights', 'Key Azimuth', rstate.keyAz);
    registry.setValue('render-lights', 'Key Elevation', rstate.keyEl);
    registry.setValue('render-lights', 'Rim Intensity', rstate.rimIntensity);
    registry.setValue('render-lights', 'Rim Azimuth', rstate.rimAz);
    registry.setValue('render-lights', 'Rim Elevation', rstate.rimEl);
    registry.setValue('render-lights', 'Rim Color', rstate.rimColor);
    registry.setValue('render-post', 'Bloom Enabled', rstate.bloomEnabled);
    registry.setValue('render-post', 'Bloom Strength', rstate.bloomStrength);
    registry.setValue('render-post', 'Bloom Threshold', rstate.bloomThreshold);
    registry.setValue('render-post', 'Bloom Radius', rstate.bloomRadius);
    registry.setValue('render-post', 'Outline Enabled', postState.outlineEnabled);
    registry.setValue('render-post', 'Outline Strength', postState.outlineStrength);
    registry.setValue('render-post', 'Outline Thickness', postState.outlineThickness);
    registry.setValue('render-post', 'Outline Color', postState.outlineColor);
    registry.setValue('render-post', 'Ink Outline', postState.inkEnabled);
    registry.setValue('render-post', 'Ink Thickness', postState.inkThickness);
    registry.setValue('render-post', 'Ink Color', postState.inkColor);
    registry.setValue('render-post', 'Vignette', postState.vignetteEnabled);
    registry.setValue('render-post', 'Vignette Strength', postState.vignetteStrength);
    registry.setValue('render-post', 'Vignette Softness', postState.vignetteSoftness);
    registry.setValue('render-blade-gradient', 'Blade Gradient', postState.bladeGradientEnabled);
    registry.setValue('render-blade-gradient', 'Grad Base', postState.gradBase);
    registry.setValue('render-blade-gradient', 'Grad Edge', postState.gradEdge);
    registry.setValue('render-blade-gradient', 'Grad Edge Fade', postState.gradFade);
    registry.setValue('render-blade-gradient', 'Wear Intensity', postState.gradWear);
    registry.setValue('render-atmospherics', 'EnvMap URL', atmosState.envUrl);
    registry.setValue('render-atmospherics', 'Env Preset', atmosState.envPreset);
    registry.setValue('render-atmospherics', 'Env as Background', atmosState.envAsBackground);
    registry.setValue('render-atmospherics', 'Fog Color', atmosState.fogColor);
    registry.setValue('render-atmospherics', 'Fog Density', atmosState.fogDensity);
    registry.setValue('render-atmospherics', 'Fresnel', atmosState.fresnelEnabled);
    registry.setValue('render-atmospherics', 'Fresnel Intensity', atmosState.fresnelIntensity);
    registry.setValue('render-atmospherics', 'Fresnel Power', atmosState.fresnelPower);
    registry.setValue('render-atmospherics', 'Fresnel Color', atmosState.fresnelColor);
    registry.setValue('render-atmospherics', 'Blade Invisible', atmosState.bladeInvisible);
    registry.setValue('render-atmospherics', 'Occlude When Invisible', atmosState.occludeInvisible);
    registry.setValue('render-fx', 'Inner Glow', fxState.innerGlow.enabled);
    registry.setValue('render-fx', 'Glow Color', fxState.innerGlow.color);
    registry.setValue('render-fx', 'Glow Min', fxState.innerGlow.min);
    registry.setValue('render-fx', 'Glow Max', fxState.innerGlow.max);
    registry.setValue('render-fx', 'Glow Speed', fxState.innerGlow.speed);
    registry.setValue('render-fx', 'Blade Mist', fxState.mist.enabled);
    registry.setValue('render-fx', 'Mist Color', fxState.mist.color);
    registry.setValue('render-fx', 'Mist Density', fxState.mist.density);
    registry.setValue('render-fx', 'Mist Speed', fxState.mist.speed);
    registry.setValue('render-fx', 'Mist Spread', fxState.mist.spread);
    registry.setValue('render-fx', 'Mist Size', fxState.mist.size);
    registry.setValue('render-fx', 'Mist Life Rate', fxState.mist.lifeRate);
    registry.setValue('render-fx', 'Mist Turbulence', fxState.mist.turbulence);
    registry.setValue('render-fx', 'Wind X', fxState.mist.windX);
    registry.setValue('render-fx', 'Wind Z', fxState.mist.windZ);
    registry.setValue('render-fx', 'Emit Region', fxState.mist.emission);
    registry.setValue('render-fx', 'Size Min Ratio', fxState.mist.sizeMinRatio);
    registry.setValue('render-fx', 'Occlude by Blade', fxState.mist.occlude);
    registry.setValue('render-fx', 'Flame Aura', fxState.flame.enabled);
    registry.setValue('render-fx', 'Flame Color A', fxState.flame.color1);
    registry.setValue('render-fx', 'Flame Color B', fxState.flame.color2);
    registry.setValue('render-fx', 'Flame Intensity', fxState.flame.intensity);
    registry.setValue('render-fx', 'Flame Speed', fxState.flame.speed);
    registry.setValue('render-fx', 'Flame NoiseScale', fxState.flame.noiseScale);
    registry.setValue('render-fx', 'Flame Scale', fxState.flame.scale);
    registry.setValue('render-fx', 'Flame Direction', fxState.flame.direction);
    registry.setValue('render-fx', 'Flame Blend', fxState.flame.blend);
    registry.setValue('render-fx', 'Selective Bloom', fxState.selectiveBloom);
    registry.setValue('render-fx', 'Heat Haze', fxState.heatHaze);
    registry.setValue('render-fx', 'Embers', fxState.embers.enabled);
    registry.setValue('render-fx', 'Ember Count', fxState.embers.count);
    registry.setValue('render-fx', 'Ember Size', fxState.embers.size);
    registry.setValue('render-fx', 'Ember Color', fxState.embers.color);
  };

  const syncUi = () => {
    refreshInputs(registry, state);
    syncEngravingControls();
    if (render) {
      syncRenderControls();
      syncMaterialInputs(matPart);
    }
  };

  if (render) {
    // Subsections for Render tab
    const rQual = addSection(sections.Render, 'Render: Quality & Exposure');
    const rBg = addSection(sections.Render, 'Render: Background');
    const rLights = addSection(sections.Render, 'Render: Lights');
    const rPost = addSection(sections.Render, 'Render: Post');
    const rAtmos = addSection(sections.Render, 'Render: Atmospherics');
    const rGrad = addSection(sections.Render, 'Render: Blade Gradient');
    const rFX = addSection(sections.Render, 'Render: FX');
    const rMat = addSection(sections.Render, 'Render: Materials');
    rMatSec = rMat;
    rGradSec = rGrad;

    const hexToInt = (hex: string) => parseInt(hex.replace('#', '0x'));
    const applyEnvMap = (url?: string | null, asBackground?: boolean) => {
      if (!render?.setEnvMap) return;
      const effectiveUrl = url === undefined ? atmosState.envUrl : (url || '');
      const background = asBackground === undefined ? atmosState.envAsBackground : asBackground;
      render.setEnvMap(effectiveUrl ? effectiveUrl : undefined, background);
    };
    const applyFresnel = () => {
      (render as any).setFresnel?.(atmosState.fresnelEnabled, hexToInt(atmosState.fresnelColor), atmosState.fresnelIntensity, atmosState.fresnelPower);
    };
    const applyBladeVisibility = () => {
      render.setBladeVisible?.(!atmosState.bladeInvisible, atmosState.occludeInvisible);
    };
    const applyInnerGlow = () => {
      const ig = fxState.innerGlow;
      (render as any).setInnerGlow?.(ig.enabled, hexToInt(ig.color), ig.min, ig.max, ig.speed);
    };
    const applyMist = () => {
      const m = fxState.mist;
      (render as any).setBladeMist?.(m.enabled, hexToInt(m.color), m.density, m.speed, m.spread, m.size);
      (render as any).setBladeMistAdvanced?.({
        lifeRate: m.lifeRate,
        noiseAmp: m.turbulence,
        windX: m.windX,
        windZ: m.windZ,
        emission: m.emission,
        sizeMinRatio: m.sizeMinRatio,
        occlude: m.occlude,
      });
    };
    const applyFlame = () => {
      const f = fxState.flame;
      const blendMap: Record<'Add' | 'Darken' | 'Multiply', string> = { Add: 'add', Darken: 'normal', Multiply: 'multiply' };
      (render as any).setFlameAura?.(f.enabled, {
        scale: f.scale,
        color1: hexToInt(f.color1),
        color2: hexToInt(f.color2),
        noiseScale: f.noiseScale,
        speed: f.speed,
        intensity: f.intensity,
        direction: f.direction === 'Down' ? 'down' : 'up',
        blend: blendMap[f.blend],
      });
    };
    const applyEmbers = () => {
      const e = fxState.embers;
      (render as any).setEmbers?.(e.enabled, { count: Math.max(1, Math.floor(e.count)), size: e.size, color: hexToInt(e.color) });
    };

    // Material Base (Render tab)
    const matPartOpts = ['blade','guard','handle','pommel'] as const;
    matPart = 'blade';
    const rm = rMatSec || sections.Render;
    select(rm, 'Material Part', [...matPartOpts] as unknown as string[], 'blade', (v) => { matPart = v as Part; syncMaterialInputs(matPart); }, () => {});
    colorPicker(rm, 'Base Color', matState[matPart].color, (hex) => { matState[matPart].color = hex; const n = parseInt(hex.replace('#','0x')); render.setPartColor(matPart, n); }, () => {}, 'Albedo color.');
    slider(rm, 'Metalness', 0, 1, 0.01, matState[matPart].metalness, (v) => { matState[matPart].metalness = v; render.setPartMetalness(matPart, v); }, () => {}, 'PBR metalness.');
    slider(rm, 'Roughness', 0, 1, 0.01, matState[matPart].roughness, (v) => { matState[matPart].roughness = v; render.setPartRoughness(matPart, v); }, () => {}, 'PBR roughness.');
    slider(rm, 'Clearcoat', 0, 1, 0.01, matState[matPart].clearcoat, (v) => { matState[matPart].clearcoat = v; render.setPartClearcoat(matPart, v); }, () => {}, 'Clearcoat layer (if supported).');
    slider(rm, 'Clearcoat Rough', 0, 1, 0.01, matState[matPart].clearcoatRoughness, (v) => { matState[matPart].clearcoatRoughness = v; render.setPartClearcoatRoughness(matPart, v); }, () => {}, 'Clearcoat roughness (if supported).');
    // Material presets
    select(rm, 'Mat Preset', ['None','Steel','Iron','Bronze','Brass','Leather','Wood','Matte','Glass','Gem'], matState[matPart].preset, (v) => {
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
    rm.appendChild(resetBtn);
    // Procedural bump/noise for selected part
    checkbox(rm, 'Bump Enabled', matState[matPart].bumpEnabled, (v) => { matState[matPart].bumpEnabled = v; render.setPartBump(matPart, v, matState[matPart].bumpScale, matState[matPart].bumpNoiseScale, matState[matPart].bumpSeed); }, () => {}, 'Procedural noise bump.');
    slider(rm, 'Bump Scale', 0, 0.08, 0.001, matState[matPart].bumpScale, (v) => { matState[matPart].bumpScale = v; render.setPartBump(matPart, matState[matPart].bumpEnabled, v, matState[matPart].bumpNoiseScale, matState[matPart].bumpSeed); }, () => {}, 'Bump map scale.');
    slider(rm, 'Noise Scale', 1, 32, 1, matState[matPart].bumpNoiseScale, (v) => { matState[matPart].bumpNoiseScale = Math.round(v); render.setPartBump(matPart, matState[matPart].bumpEnabled, matState[matPart].bumpScale, matState[matPart].bumpNoiseScale, matState[matPart].bumpSeed); }, () => {}, 'Noise frequency.');
    slider(rm, 'Noise Seed', 0, 9999, 1, matState[matPart].bumpSeed, (v) => { matState[matPart].bumpSeed = Math.round(v); render.setPartBump(matPart, matState[matPart].bumpEnabled, matState[matPart].bumpScale, matState[matPart].bumpNoiseScale, matState[matPart].bumpSeed); }, () => {}, 'Noise seed.');
    // Advanced materials
    colorPicker(rm, 'Emissive Color', matState[matPart].emissiveColor ?? '#000000', (hex) => { matState[matPart].emissiveColor = hex; (render as any).setPartMaterial?.(matPart, { emissiveColor: hex }); }, () => {}, 'Glow color.');
    slider(rm, 'Emissive Intensity', 0, 10, 0.01, matState[matPart].emissiveIntensity ?? 0, (v) => { matState[matPart].emissiveIntensity = v; (render as any).setPartMaterial?.(matPart, { emissiveIntensity: v }); }, () => {}, 'Glow intensity.');
    slider(rm, 'Transmission', 0, 1, 0.01, matState[matPart].transmission ?? 0, (v) => { matState[matPart].transmission = v; (render as any).setPartMaterial?.(matPart, { transmission: v }); }, () => {}, 'Glass-like transmission.');
    slider(rm, 'IOR', 1, 2.5, 0.01, matState[matPart].ior ?? 1.5, (v) => { matState[matPart].ior = v; (render as any).setPartMaterial?.(matPart, { ior: v }); }, () => {}, 'Index of refraction.');
    slider(rm, 'Thickness', 0, 5, 0.01, matState[matPart].thickness ?? 0.2, (v) => { matState[matPart].thickness = v; (render as any).setPartMaterial?.(matPart, { thickness: v }); }, () => {}, 'Volume thickness.');
    colorPicker(rm, 'Atten Color', matState[matPart].attenuationColor ?? '#ffffff', (hex) => { matState[matPart].attenuationColor = hex; (render as any).setPartMaterial?.(matPart, { attenuationColor: hex }); }, () => {}, 'Transmission attenuation color.');
    slider(rm, 'Atten Dist', 0, 10, 0.01, matState[matPart].attenuationDistance ?? 0, (v) => { matState[matPart].attenuationDistance = v; (render as any).setPartMaterial?.(matPart, { attenuationDistance: v }); }, () => {}, 'Attenuation distance.');
    slider(rm, 'Sheen', 0, 1, 0.01, matState[matPart].sheen ?? 0, (v) => { matState[matPart].sheen = v; (render as any).setPartMaterial?.(matPart, { sheen: v }); }, () => {}, 'Cloth sheen.');
    colorPicker(rm, 'Sheen Color', matState[matPart].sheenColor ?? '#ffffff', (hex) => { matState[matPart].sheenColor = hex; (render as any).setPartMaterial?.(matPart, { sheenColor: hex }); }, () => {}, 'Sheen color.');
    slider(rm, 'Iridescence', 0, 1, 0.01, matState[matPart].iridescence ?? 0, (v) => { matState[matPart].iridescence = v; (render as any).setPartMaterial?.(matPart, { iridescence: v }); }, () => {}, 'Iridescent layer strength.');
    slider(rm, 'Iridescence IOR', 1, 2.5, 0.01, matState[matPart].iridescenceIOR ?? 1.3, (v) => { matState[matPart].iridescenceIOR = v; (render as any).setPartMaterial?.(matPart, { iridescenceIOR: v }); }, () => {}, 'Iridescence index of refraction.');
    slider(rm, 'Iridescence Min', 0, 1200, 1, matState[matPart].iridescenceThicknessMin ?? 100, (v) => { matState[matPart].iridescenceThicknessMin = Math.round(v); (render as any).setPartMaterial?.(matPart, { iridescenceThicknessMin: Math.round(v) }); }, () => {}, 'Thin-film min thickness (nm).');
    slider(rm, 'Iridescence Max', 0, 1200, 1, matState[matPart].iridescenceThicknessMax ?? 400, (v) => { matState[matPart].iridescenceThicknessMax = Math.round(v); (render as any).setPartMaterial?.(matPart, { iridescenceThicknessMax: Math.round(v) }); }, () => {}, 'Thin-film max thickness (nm).');
    slider(rm, 'EnvMap Intensity', 0, 3, 0.01, matState[matPart].envMapIntensity ?? 1, (v) => { matState[matPart].envMapIntensity = v; (render as any).setPartMaterial?.(matPart, { envMapIntensity: v }); }, () => {}, 'Boost environment reflections.');

    // Quality & AA
    select(rQual, 'AA Mode', ['none','fxaa','smaa'], rstate.aaMode, (v) => { rstate.aaMode = v as 'none'|'fxaa'|'smaa'; render.setAAMode(rstate.aaMode); }, () => {}, 'Anti-aliasing mode.');
    select(rQual, 'Quality', ['Low','Medium','High'], 'Medium', (v) => {
      type Preset = { aa: 'none'|'fxaa'|'smaa'; shadow: 1024|2048|4096; bloom: boolean; outline: boolean; dpr: number; };
      const presets: Record<string, Preset> = {
        Low: { aa: 'none', shadow: 1024, bloom: false, outline: false, dpr: 1.0 },
        Medium: { aa: 'fxaa', shadow: 2048, bloom: false, outline: false, dpr: 1.5 },
        High: { aa: 'smaa', shadow: 2048, bloom: false, outline: false, dpr: 2.0 }
      };
      const preset = presets[v] || presets.Medium;
      render.setAAMode(preset.aa);
      render.setShadowMapSize(preset.shadow);
      render.setBloom(preset.bloom, rstate.bloomStrength, rstate.bloomThreshold, rstate.bloomRadius);
      render.setOutline(preset.outline);
      render.setDPRCap(preset.dpr);
      rstate.bloomEnabled = preset.bloom;
      postState.outlineEnabled = preset.outline;
      rstate.aaMode = preset.aa;
      rstate.shadowMapSize = preset.shadow;
      rstate.qualityPreset = v as 'Low'|'Medium'|'High';
      registry.setValue('render-quality-exposure', 'AA Mode', preset.aa);
      registry.setValue('render-quality-exposure', 'Shadow Map', String(preset.shadow));
      registry.setValue('render-quality-exposure', 'Quality', rstate.qualityPreset);
      registry.setValue('render-post', 'Bloom Enabled', preset.bloom);
      registry.setValue('render-post', 'Outline Enabled', preset.outline);
      refreshWarnings();
    }, () => {}, 'Quality preset (affects AA, shadows, DPR).');
    select(rQual, 'Shadow Map', ['1024','2048','4096'], '2048', (v) => { const size = parseInt(v,10) as 1024|2048|4096; rstate.shadowMapSize = size; render.setShadowMapSize(size); }, () => {}, 'Shadow map resolution.');
    slider(rQual, 'Shadow Bias', -0.01, 0.01, 0.0001, -0.0005, (v) => { render.setShadowBias(v); }, () => {}, 'Shadow acne/peter-panning tweak.');
    select(rQual, 'Tone Mapping', ['ACES','Reinhard','Cineon','Linear','None'], 'ACES', (v) => { rstate.toneMapping = v as any; (render as any).setToneMapping?.(v as any); }, () => {}, 'Renderer tone mapping curve.');
    slider(rQual, 'Exposure', 0.5, 2.0, 0.01, rstate.exposure, (v) => { rstate.exposure = v; render.setExposure(v); }, () => {} , 'Tone mapping exposure.');
    slider(rQual, 'Env Intensity', 0, 3.0, 0.01, rstate.envIntensity, (v) => { rstate.envIntensity = v; render.setEnvIntensity(v); }, () => {}, 'Environment map intensity (reflections).');

    // Background
    colorPicker(rBg, 'Background Color', rstate.bgColor, (hex) => { rstate.bgColor = hex; const n = parseInt(hex.replace('#','0x')); render.setBackgroundColor(n); }, () => {}, 'Renderer clear color.');
    slider(rBg, 'Background Bright', 0, 1.0, 0.01, rstate.bgBrightness, (v) => { rstate.bgBrightness = v; render.setBackgroundBrightness(v); }, () => {}, 'Lighten/darken the background.');

    // Lights
    slider(rLights, 'Ambient Intensity', 0, 2.0, 0.01, rstate.ambient, (v) => { rstate.ambient = v; render.setAmbient(v); }, () => {}, 'Hemisphere ambient light.');
    slider(rLights, 'Key Intensity', 0, 4.0, 0.01, rstate.keyIntensity, (v) => { rstate.keyIntensity = v; render.setKeyIntensity(v); }, () => {}, 'Directional key light intensity.');
    slider(rLights, 'Key Azimuth', -180, 180, 1, rstate.keyAz, (v) => { rstate.keyAz = v; render.setKeyAngles(rstate.keyAz, rstate.keyEl); }, () => {}, 'Key light horizontal angle (deg).');
    slider(rLights, 'Key Elevation', -10, 85, 1, rstate.keyEl, (v) => { rstate.keyEl = v; render.setKeyAngles(rstate.keyAz, rstate.keyEl); }, () => {}, 'Key light elevation (deg).');
    slider(rLights, 'Rim Intensity', 0, 3.0, 0.01, rstate.rimIntensity, (v) => { rstate.rimIntensity = v; render.setRimIntensity(v); }, () => {}, 'Back/rim light intensity.');
    slider(rLights, 'Rim Azimuth', -180, 180, 1, rstate.rimAz, (v) => { rstate.rimAz = v; render.setRimAngles(rstate.rimAz, rstate.rimEl); }, () => {}, 'Rim light horizontal angle (deg).');
    slider(rLights, 'Rim Elevation', -10, 85, 1, rstate.rimEl, (v) => { rstate.rimEl = v; render.setRimAngles(rstate.rimAz, rstate.rimEl); }, () => {}, 'Rim light elevation (deg).');
    colorPicker(rLights, 'Rim Color', rstate.rimColor, (hex) => { rstate.rimColor = hex; const n = parseInt(hex.replace('#','0x')); render.setRimColor(n); }, () => {}, 'Rim light color.');

    // Post-processing
    checkbox(rPost, 'Bloom Enabled', rstate.bloomEnabled, (v) => { rstate.bloomEnabled = v; render.setBloom(rstate.bloomEnabled, rstate.bloomStrength, rstate.bloomThreshold, rstate.bloomRadius); refreshWarnings(); }, () => {}, 'Enable bloom post-process.');
    slider(rPost, 'Bloom Strength', 0, 3.0, 0.01, rstate.bloomStrength, (v) => { rstate.bloomStrength = v; render.setBloom(rstate.bloomEnabled, rstate.bloomStrength, rstate.bloomThreshold, rstate.bloomRadius); }, () => {}, 'Bloom intensity.');
    slider(rPost, 'Bloom Threshold', 0, 1.5, 0.01, rstate.bloomThreshold, (v) => { rstate.bloomThreshold = v; render.setBloom(rstate.bloomEnabled, rstate.bloomStrength, rstate.bloomThreshold, rstate.bloomRadius); }, () => {}, 'Bloom threshold.');
    slider(rPost, 'Bloom Radius', 0, 1.0, 0.01, rstate.bloomRadius, (v) => { rstate.bloomRadius = v; render.setBloom(rstate.bloomEnabled, rstate.bloomStrength, rstate.bloomThreshold, rstate.bloomRadius); }, () => {}, 'Bloom radius.');
    // Outline
    checkbox(rPost, 'Outline Enabled', postState.outlineEnabled, (v) => { postState.outlineEnabled = v; render.setOutline(v, postState.outlineStrength, postState.outlineThickness, parseInt(postState.outlineColor.replace('#','0x'))); refreshWarnings(); }, () => {}, 'Enable Outline pass.');
    slider(rPost, 'Outline Strength', 0.0, 10.0, 0.1, postState.outlineStrength, (v) => { postState.outlineStrength = v; if (postState.outlineEnabled) render.setOutline(true, v, postState.outlineThickness, parseInt(postState.outlineColor.replace('#','0x'))); }, () => {}, 'OutlinePass edgeStrength.');
    slider(rPost, 'Outline Thickness', 0.0, 4.0, 0.05, postState.outlineThickness, (v) => { postState.outlineThickness = v; if (postState.outlineEnabled) render.setOutline(true, postState.outlineStrength, v, parseInt(postState.outlineColor.replace('#','0x'))); }, () => {}, 'OutlinePass edgeThickness.');
    colorPicker(rPost, 'Outline Color', postState.outlineColor, (hex) => { postState.outlineColor = hex; const n = parseInt(hex.replace('#','0x')); if (postState.outlineEnabled) render.setOutline(true, postState.outlineStrength, postState.outlineThickness, n); }, () => {}, 'Outline visible edge color.');
    // Ink outline (mesh based)
    checkbox(rPost, 'Ink Outline', postState.inkEnabled, (v) => { postState.inkEnabled = v; render.setInkOutline(v, postState.inkThickness, parseInt(postState.inkColor.replace('#','0x'))); refreshWarnings(); }, () => {}, 'Back-face mesh outline.');
    slider(rPost, 'Ink Thickness', 0, 0.2, 0.005, postState.inkThickness, (v) => { postState.inkThickness = v; if (postState.inkEnabled) render.setInkOutline(true, v, parseInt(postState.inkColor.replace('#','0x'))); }, () => {}, 'Scale factor for ink outline.');
    colorPicker(rPost, 'Ink Color', postState.inkColor, (hex) => { postState.inkColor = hex; const n = parseInt(hex.replace('#','0x')); if (postState.inkEnabled) render.setInkOutline(true, postState.inkThickness, n); }, () => {}, 'Ink outline color.');
    // Vignette
    checkbox(rPost, 'Vignette', postState.vignetteEnabled, (v) => { postState.vignetteEnabled = v; render.setVignette(v, postState.vignetteStrength, postState.vignetteSoftness); refreshWarnings(); }, () => {}, 'Enable vignette shading.');
    slider(rPost, 'Vignette Strength', 0, 1.0, 0.01, postState.vignetteStrength, (v) => { postState.vignetteStrength = v; if (postState.vignetteEnabled) render.setVignette(true, v, postState.vignetteSoftness); }, () => {}, 'Strength of vignette.');
    slider(rPost, 'Vignette Softness', 0, 1.0, 0.01, postState.vignetteSoftness, (v) => { postState.vignetteSoftness = v; if (postState.vignetteEnabled) render.setVignette(true, postState.vignetteStrength, v); }, () => {}, 'Softness of vignette edge.');
    // Blade gradient/wear overlay (moved to rGrad below)
    // Environment & Atmospherics
    textRow(rAtmos, 'EnvMap URL', atmosState.envUrl, (v) => {
      atmosState.envUrl = v.trim();
      atmosState.envPreset = 'None';
      atmosState.envAsBackground = false;
      applyEnvMap();
      registry.setValue('render-atmospherics', 'Env Preset', 'None');
      registry.setValue('render-atmospherics', 'Env as Background', atmosState.envAsBackground);
    }, 'Equirectangular image URL.');
    select(rAtmos, 'Env Preset', ['None','Room','Royal Esplanade','Venice Sunset'], atmosState.envPreset, (v) => {
      const preset = v as 'None' | 'Room' | 'Royal Esplanade' | 'Venice Sunset';
      const map: Record<typeof preset, string | undefined> = {
        None: undefined,
        Room: undefined,
        'Royal Esplanade': 'https://threejs.org/examples/textures/equirectangular/royal_esplanade_1k.hdr',
        'Venice Sunset': 'https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr'
      } as any;
      atmosState.envPreset = preset;
      atmosState.envUrl = map[preset] ?? '';
      atmosState.envAsBackground = preset !== 'None';
      applyEnvMap(atmosState.envUrl, atmosState.envAsBackground);
      registry.setValue('render-atmospherics', 'EnvMap URL', atmosState.envUrl);
      registry.setValue('render-atmospherics', 'Env as Background', atmosState.envAsBackground);
    }, () => {}, 'Quick env presets (loads remote HDR).');
    checkbox(rAtmos, 'Env as Background', atmosState.envAsBackground, (v) => {
      atmosState.envAsBackground = v;
      applyEnvMap(undefined, v);
    }, () => {}, 'Use environment as background. Load URL first, then toggle.');
    colorPicker(rAtmos, 'Fog Color', atmosState.fogColor, (hex) => {
      atmosState.fogColor = hex;
      (render as any).setFog?.(hexToInt(atmosState.fogColor), atmosState.fogDensity);
    }, () => {}, 'Fog base color (exp2).');
    slider(rAtmos, 'Fog Density', 0, 0.1, 0.001, atmosState.fogDensity, (v) => {
      atmosState.fogDensity = v;
      (render as any).setFog?.(hexToInt(atmosState.fogColor), atmosState.fogDensity);
    }, () => {}, 'FogExp2 density (0 disables).');
    // Fresnel edge accent
    checkbox(rAtmos, 'Fresnel', atmosState.fresnelEnabled, (v) => {
      atmosState.fresnelEnabled = v;
      applyFresnel();
    }, () => {}, 'Additive edge accent based on view angle.');
    slider(rAtmos, 'Fresnel Intensity', 0, 2.0, 0.01, atmosState.fresnelIntensity, (v) => {
      atmosState.fresnelIntensity = v;
      applyFresnel();
    }, () => {}, 'Fresnel intensity.');
    slider(rAtmos, 'Fresnel Power', 0.5, 6.0, 0.1, atmosState.fresnelPower, (v) => {
      atmosState.fresnelPower = v;
      applyFresnel();
    }, () => {}, 'Fresnel power exponent.');
    colorPicker(rAtmos, 'Fresnel Color', atmosState.fresnelColor, (hex) => {
      atmosState.fresnelColor = hex;
      applyFresnel();
    }, () => {}, 'Fresnel color.');
    // Blade visibility controls (for "fire sword" / "sword of light")
    checkbox(rAtmos, 'Blade Invisible', atmosState.bladeInvisible, (v) => {
      atmosState.bladeInvisible = v;
      applyBladeVisibility();
    }, () => {}, 'Hide blade surface but keep effects like aura, glow, mist.');
    checkbox(rAtmos, 'Occlude When Invisible', atmosState.occludeInvisible, (v) => {
      atmosState.occludeInvisible = v;
      applyBladeVisibility();
    }, () => {}, 'When enabled, hidden blade still writes depth (occludes).');

    // FX: Inner Glow (pulsing)
    checkbox(rFX, 'Inner Glow', fxState.innerGlow.enabled, (v) => {
      fxState.innerGlow.enabled = v;
      applyInnerGlow();
    }, () => {}, 'Pulsing fresnel-like inner glow overlay.');
    colorPicker(rFX, 'Glow Color', fxState.innerGlow.color, (hex) => {
      fxState.innerGlow.color = hex;
      applyInnerGlow();
    }, () => {}, 'Inner glow color.');
    slider(rFX, 'Glow Min', 0, 2.0, 0.01, fxState.innerGlow.min, (v) => {
      fxState.innerGlow.min = v;
      applyInnerGlow();
    }, () => {}, 'Minimum intensity.');
    slider(rFX, 'Glow Max', 0, 2.0, 0.01, fxState.innerGlow.max, (v) => {
      fxState.innerGlow.max = v;
      applyInnerGlow();
    }, () => {}, 'Maximum intensity.');
    slider(rFX, 'Glow Speed', 0, 10.0, 0.01, fxState.innerGlow.speed, (v) => {
      fxState.innerGlow.speed = v;
      applyInnerGlow();
    }, () => {}, 'Pulse speed.');

    // FX: Blade Mist
    checkbox(rFX, 'Blade Mist', fxState.mist.enabled, (v) => {
      fxState.mist.enabled = v;
      applyMist();
    }, () => {}, 'Subtle mist particles rising from blade.');
    colorPicker(rFX, 'Mist Color', fxState.mist.color, (hex) => {
      fxState.mist.color = hex;
      applyMist();
    }, () => {}, 'Mist color.');
    slider(rFX, 'Mist Density', 0, 1.0, 0.01, fxState.mist.density, (v) => {
      fxState.mist.density = v;
      applyMist();
    }, () => {}, 'Particle count factor.');
    slider(rFX, 'Mist Speed', 0, 2.0, 0.01, fxState.mist.speed, (v) => {
      fxState.mist.speed = v;
      applyMist();
    }, () => {}, 'Rise speed.');
    slider(rFX, 'Mist Spread', 0, 0.2, 0.001, fxState.mist.spread, (v) => {
      fxState.mist.spread = v;
      applyMist();
    }, () => {}, 'Horizontal drift factor.');
    slider(rFX, 'Mist Size', 1, 16, 0.1, fxState.mist.size, (v) => {
      fxState.mist.size = v;
      applyMist();
    }, () => {}, 'Sprite size (px-scaled).');
    // Advanced mist shaping
    slider(rFX, 'Mist Life Rate', 0.05, 1.0, 0.01, fxState.mist.lifeRate, (v) => {
      fxState.mist.lifeRate = v;
      applyMist();
    }, () => {}, 'How fast particles age (fade in/out).');
    slider(rFX, 'Mist Turbulence', 0.0, 0.3, 0.005, fxState.mist.turbulence, (v) => {
      fxState.mist.turbulence = v;
      applyMist();
    }, () => {}, 'Wavy drift amplitude.');
    slider(rFX, 'Wind X', -0.5, 0.5, 0.01, fxState.mist.windX, (v) => {
      fxState.mist.windX = v;
      applyMist();
    }, () => {}, 'Constant push along X.');
    slider(rFX, 'Wind Z', -0.5, 0.5, 0.01, fxState.mist.windZ, (v) => {
      fxState.mist.windZ = v;
      applyMist();
    }, () => {}, 'Constant push along Z.');
    select(rFX, 'Emit Region', ['base','edge','tip','full'], fxState.mist.emission, (v) => {
      fxState.mist.emission = v as typeof fxState.mist.emission;
      applyMist();
    }, () => {}, 'Where to spawn mist.');
    slider(rFX, 'Size Min Ratio', 0.0, 1.0, 0.01, fxState.mist.sizeMinRatio, (v) => {
      fxState.mist.sizeMinRatio = v;
      applyMist();
    }, () => {}, 'Min size as ratio of mist size.');
    checkbox(rFX, 'Occlude by Blade', fxState.mist.occlude, (v) => {
      fxState.mist.occlude = v;
      applyMist();
    }, () => {}, 'When on, mist hides behind geometry.');

    // FX: Flame Aura & Selective Bloom & Heat Haze & Embers
    checkbox(rFX, 'Flame Aura', fxState.flame.enabled, (v) => {
      fxState.flame.enabled = v;
      applyFlame();
    }, () => {}, 'Animated aura overlay around blade.');
    colorPicker(rFX, 'Flame Color A', fxState.flame.color1, (hex) => {
      fxState.flame.color1 = hex;
      applyFlame();
    }, () => {}, 'Inner flame color.');
    colorPicker(rFX, 'Flame Color B', fxState.flame.color2, (hex) => {
      fxState.flame.color2 = hex;
      applyFlame();
    }, () => {}, 'Outer flame color.');
    slider(rFX, 'Flame Intensity', 0.0, 3.0, 0.01, fxState.flame.intensity, (v) => {
      fxState.flame.intensity = v;
      applyFlame();
    }, () => {}, 'Brightness scaling for aura.');
    slider(rFX, 'Flame Speed', 0.0, 8.0, 0.01, fxState.flame.speed, (v) => {
      fxState.flame.speed = v;
      applyFlame();
    }, () => {}, 'Noise scroll speed.');
    slider(rFX, 'Flame NoiseScale', 0.2, 8.0, 0.01, fxState.flame.noiseScale, (v) => {
      fxState.flame.noiseScale = v;
      applyFlame();
    }, () => {}, 'Spatial scale of flame noise.');
    slider(rFX, 'Flame Scale', 1.0, 1.2, 0.001, fxState.flame.scale, (v) => {
      fxState.flame.scale = v;
      applyFlame();
    }, () => {}, 'Mesh scale factor for aura shell.');
    select(rFX, 'Flame Direction', ['Up','Down'], fxState.flame.direction, (v) => {
      fxState.flame.direction = v as typeof fxState.flame.direction;
      applyFlame();
    }, () => {}, 'Flow direction along blade. Up = rise; Down = fall.');
    select(rFX, 'Flame Blend', ['Add','Darken','Multiply'], fxState.flame.blend, (v) => {
      fxState.flame.blend = v as typeof fxState.flame.blend;
      applyFlame();
    }, () => {}, 'Add: bright glow. Darken: normal blend (black flames visible). Multiply: strong darkening.');
    checkbox(rFX, 'Selective Bloom', fxState.selectiveBloom, (v) => {
      fxState.selectiveBloom = v;
      (render as any).setSelectiveBloom?.(v, 1.1, 0.8, 0.35, 1.0);
    }, () => {}, 'Use bloom only on marked objects.');
    checkbox(rFX, 'Heat Haze', fxState.heatHaze, (v) => {
      fxState.heatHaze = v;
      (render as any).setHeatHaze?.(v, 0.004);
    }, () => {}, 'Mask-based refractive shimmer.');
    checkbox(rFX, 'Embers', fxState.embers.enabled, (v) => {
      fxState.embers.enabled = v;
      applyEmbers();
    }, () => {}, 'Floating sparks/embers.');
    slider(rFX, 'Ember Count', 10, 400, 1, fxState.embers.count, (v) => {
      fxState.embers.count = v;
      applyEmbers();
    }, () => {}, 'Number of ember particles.');
    slider(rFX, 'Ember Size', 1, 12, 0.1, fxState.embers.size, (v) => {
      fxState.embers.size = v;
      applyEmbers();
    }, () => {}, 'Ember sprite size.');
    colorPicker(rFX, 'Ember Color', fxState.embers.color, (hex) => {
      fxState.embers.color = hex;
      applyEmbers();
    }, () => {}, 'Ember tint.');

  }

  // Blade controls
  // Sub-heading: Serrations (non-collapsible, keeps controls within Blade)
  const bSerr = addSubheading(sections.Blade, 'Serrations');
  select(bSerr, 'Serration Pattern', ['sine','saw','scallop','random'], (state.blade as any).serrationPattern ?? 'sine', (v) => { (state.blade as any).serrationPattern = v as any; }, rerender, 'Pattern used for serrations along edges.');
  slider(bSerr, 'Serration Seed', 0, 999999, 1, (state.blade as any).serrationSeed ?? 1337, (v) => { (state.blade as any).serrationSeed = Math.round(v); }, rerender, 'Seed value for random serration pattern.');
  // Fuller carve options
  select(sections.Blade, 'Fuller Mode', ['overlay','carve'], (state.blade as any).fullerMode ?? 'overlay', (v) => { (state.blade as any).fullerMode = v as any; }, rerender, 'overlay: visual ribbons; carve: actual groove reduces thickness.');
  select(sections.Blade, 'Fuller Profile', ['u','v','flat'], (state.blade as any).fullerProfile ?? 'u', (v) => { (state.blade as any).fullerProfile = v as any; }, rerender, 'Cross-section profile for carved fuller.');
  slider(sections.Blade, 'Fuller Width', 0, 0.6, 0.001, (state.blade as any).fullerWidth ?? 0, (v) => { (state.blade as any).fullerWidth = v; }, rerender, 'Groove width across the blade face (scene units). 0 = auto.');
  slider(sections.Blade, 'Fuller Inset', 0, 0.2, 0.001, (state.blade as any).fullerInset ?? (state.blade.fullerDepth ?? 0), (v) => { (state.blade as any).fullerInset = v; }, rerender, 'Groove depth inside thickness when carving. Defaults to Fuller Depth.');
  slider(sections.Blade, 'Length', 0.5, 6, 0.01, state.blade.length, (v) => (state.blade.length = v), rerender);
  slider(sections.Blade, 'Base Width', 0.05, 1.0, 0.005, state.blade.baseWidth, (v) => (state.blade.baseWidth = v), rerender);
  slider(sections.Blade, 'Tip Width', 0, 0.5, 0.005, state.blade.tipWidth, (v) => (state.blade.tipWidth = v), rerender);
  select(sections.Blade, 'Tip Shape', ['pointed', 'rounded', 'leaf', 'clip', 'tanto', 'spear', 'sheepsfoot'], (state.blade.tipShape ?? 'pointed') as string, (v) => (state.blade.tipShape = v as any), rerender, 'Tip family: Pointed, Rounded, Leaf, Clip, Tanto, Spear, Sheepsfoot.');
  slider(sections.Blade, 'Leaf Bulge', 0, 1, 0.01, state.blade.tipBulge ?? 0.2, (v) => (state.blade.tipBulge = v), rerender, 'Mid-blade bulge for Leaf tip shape.');
  select(sections.Blade, 'Cross Section', ['flat', 'diamond', 'lenticular', 'hexagonal'], (state.blade.crossSection ?? 'flat') as string, (v) => (state.blade.crossSection = v as any), rerender, 'Blade cross-section profile.');
  slider(sections.Blade, 'Edge Bevel', 0, 1, 0.01, state.blade.bevel ?? 0.5, (v) => (state.blade.bevel = v), rerender, '0 sharp (thin spine), 1 thickened spine/facets.');
  slider(sections.Blade, 'Blade Thickness', 0.02, 0.2, 0.001, state.blade.thickness, (v) => (state.blade.thickness = v), rerender);
  slider(sections.Blade, 'Left Thickness', 0.003, 0.2, 0.001, state.blade.thicknessLeft ?? state.blade.thickness, (v) => (state.blade.thicknessLeft = v), rerender, 'Z thickness at left edge (−X).');
  slider(sections.Blade, 'Right Thickness', 0.003, 0.2, 0.001, state.blade.thicknessRight ?? state.blade.thickness, (v) => (state.blade.thicknessRight = v), rerender, 'Z thickness at right edge (+X).');

  // Distal taper profile (Base/Mid/Tip %)
  const getTaper = (): [number, number, number] => {
    const pts = (state.blade as any).thicknessProfile?.points as Array<[number,number]> | undefined;
    if (!pts || pts.length < 2) return [100, 100, 100];
    const base = Math.round((pts[0]?.[1] ?? 1) * 100);
    const tip  = Math.round((pts[pts.length-1]?.[1] ?? 1) * 100);
    let mid = 100; for (const [t,s] of pts) { if (t >= 0.5 && t <= 0.7) { mid = Math.round(s*100); break; } }
    return [base, mid, tip];
  };
  const setTaper = (b:number,m:number,t:number) => {
    (state.blade as any).thicknessProfile = { points: [[0, b/100], [0.6, m/100], [1, t/100]] } as any;
  };
  let [tb, tm, tt] = getTaper();
  slider(sections.Blade, 'Taper Base %', 50, 120, 1, tb, (v) => { tb = Math.round(v as number); setTaper(tb, tm, tt); }, rerender, 'Thickness scale at base (100% = no change).');
  slider(sections.Blade, 'Taper Mid %', 30, 110, 1, tm, (v) => { tm = Math.round(v as number); setTaper(tb, tm, tt); }, rerender, 'Thickness scale at mid-blade (t≈0.6).');
  slider(sections.Blade, 'Taper Tip %', 10, 100, 1, tt, (v) => { tt = Math.round(v as number); setTaper(tb, tm, tt); }, rerender, 'Thickness scale at tip (lower = thinner tip).');
  // Ricasso and False Edge (edge/tip taxonomy)
  slider(sections.Blade, 'Ricasso %', 0, 30, 1, Math.round(((state.blade as any).ricassoLength ?? 0) * 100), (v) => { (state.blade as any).ricassoLength = (v as number)/100; }, rerender, 'Unsharpened base length (0–30%).');
  slider(sections.Blade, 'False Edge %', 0, 100, 1, Math.round(((state.blade as any).falseEdgeLength ?? 0) * 100), (v) => { (state.blade as any).falseEdgeLength = (v as number)/100; }, rerender, 'False edge length from tip (0–100%).');
  slider(sections.Blade, 'False Edge Depth', 0, 0.2, 0.001, ((state.blade as any).falseEdgeDepth ?? 0), (v) => { (state.blade as any).falseEdgeDepth = v as number; }, rerender, 'Spine bevel reduction amount.');
  slider(sections.Blade, 'Curvature', -1, 1, 0.01, state.blade.curvature, (v) => (state.blade.curvature = v), rerender, 'Bends the blade along its length (negative curves opposite).');
  slider(sections.Blade, 'Base Angle', -10, 10, 0.1, (state.blade.baseAngle ?? 0) * 180/Math.PI, (v) => (state.blade.baseAngle = v * Math.PI/180), rerender, 'Angle (deg) that the blade departs from the handle.');
  // Extended to ±2160° (±12π) to allow extreme stylized twists
  slider(sections.Blade, 'Twist Angle', -2160, 2160, 1, (state.blade.twistAngle ?? 0) * 180/Math.PI, (v) => (state.blade.twistAngle = v * Math.PI/180), rerender, 'Total twist along blade (deg).');
  select(sections.Blade, 'Sori Profile', ['torii', 'koshi', 'saki'], state.blade.soriProfile ?? 'torii', (v) => (state.blade.soriProfile = v as any), rerender, 'Curvature distribution: centered (torii), base (koshi), tip (saki).');
  slider(sections.Blade, 'Sori Bias', 0.3, 3.0, 0.01, state.blade.soriBias ?? 0.8, (v) => (state.blade.soriBias = v), rerender, 'Bias exponent for sori profile.');
  slider(sections.Blade, 'Kissaki Length', 0, 0.35, 0.005, state.blade.kissakiLength ?? 0, (v) => (state.blade.kissakiLength = v), rerender, 'Tip segment fraction (yokote position).');
  slider(sections.Blade, 'Kissaki Round', 0, 1, 0.01, state.blade.kissakiRoundness ?? 0.5, (v) => (state.blade.kissakiRoundness = v), rerender, 'Tip rounding (0 sharp, 1 round).');
  slider(sections.Blade, 'Tip Ramp %', 0, 95, 1, Math.round((state.blade.tipRampStart ?? 0) * 100), (v) => {
    state.blade.tipRampStart = clamp((v as number) / 100, 0, 0.98);
  }, rerender, 'Percent of blade length kept at base width before the tip taper begins.');
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
  slider(bSerr, 'Serration Left', 0, 0.2, 0.001, state.blade.serrationAmplitudeLeft ?? (state.blade.serrationAmplitude ?? 0), (v) => (state.blade.serrationAmplitudeLeft = v), rerender, 'Left edge serration amplitude.');
  slider(bSerr, 'Serration Right', 0, 0.2, 0.001, state.blade.serrationAmplitudeRight ?? (state.blade.serrationAmplitude ?? 0), (v) => (state.blade.serrationAmplitudeRight = v), rerender, 'Right edge serration amplitude.');
  slider(bSerr, 'Serration Freq', 0, 120, 1, state.blade.serrationFrequency ?? 0, (v) => (state.blade.serrationFrequency = v), rerender, 'Number of serration cycles along the blade.');
  slider(bSerr, 'Serration Sharpness', 0, 1, 0.01, (state.blade as any).serrationSharpness ?? 0, (v) => { (state.blade as any).serrationSharpness = v; }, rerender, '0 = smooth (rounded teeth), 1 = pointy teeth.');
  slider(bSerr, 'Serration Lean L', -1, 1, 0.01, (state.blade as any).serrationLeanLeft ?? 0, (v) => { (state.blade as any).serrationLeanLeft = v; }, rerender, 'Lean left edge teeth backward (-1) or forward (+1).');
  slider(bSerr, 'Serration Lean R', -1, 1, 0.01, (state.blade as any).serrationLeanRight ?? 0, (v) => { (state.blade as any).serrationLeanRight = v; }, rerender, 'Lean right edge teeth backward (-1) or forward (+1).');
  // Text Engraving (simple)
  checkbox(sections.Engravings, 'Text Engraving', false, (v) => {
    const list = (((state.blade as any).engravings) || []) as any[];
    const rest = list.filter((e:any) => e.type !== 'text');
    if (v) rest.push({ type:'text', content:'ᚠᚢᚦ', fontUrl:'https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json', width:0.18, height:0.03, depth:0.002, offsetY: state.blade.length*0.5, offsetX:0, rotation:0, side:'right' });
    (state.blade as any).engravings = rest;
  }, rerender, 'Adds a text engraving (provide font URL and content).');
  // Manage multiple engravings: add/remove/reorder and edit index
  const engrRow = document.createElement('div'); engrRow.className = 'row full';
  const engrToolbar = document.createElement('div'); engrToolbar.className = 'toolbar';
  const engrAddBtn = document.createElement('button'); engrAddBtn.textContent = 'Add Engraving'; engrAddBtn.onclick = (e)=>{ e.stopPropagation(); const arr = (((state.blade as any).engravings)||[]) as any[]; arr.push({ type:'text', content:'TEXT', fontUrl:'', width:0.1, height:0.02, depth:0.002, offsetY: state.blade.length*0.5, offsetX:0, rotation:0, side:'right', align:'center' }); (state.blade as any).engravings = arr; engrIndex = arr.length - 1; rerender(); syncEngravingControls(); };
  const engrRemoveBtn = document.createElement('button'); engrRemoveBtn.textContent = 'Remove This'; engrRemoveBtn.onclick = (e)=>{ e.stopPropagation(); const arr = (((state.blade as any).engravings)||[]) as any[]; if (!arr.length) return; if (engrIndex<0||engrIndex>=arr.length) return; arr.splice(engrIndex,1); (state.blade as any).engravings = arr; engrIndex = Math.max(0, Math.min(engrIndex, arr.length-1)); rerender(); syncEngravingControls(); };
  const engrUpBtn = document.createElement('button'); engrUpBtn.textContent = 'Move Up'; engrUpBtn.onclick = (e)=>{ e.stopPropagation(); const arr = (((state.blade as any).engravings)||[]) as any[]; if (engrIndex>0) { const t = arr[engrIndex]; arr[engrIndex] = arr[engrIndex-1]; arr[engrIndex-1] = t; engrIndex--; (state.blade as any).engravings = arr; rerender(); syncEngravingControls(); }};
  const engrDownBtn = document.createElement('button'); engrDownBtn.textContent = 'Move Down'; engrDownBtn.onclick = (e)=>{ e.stopPropagation(); const arr = (((state.blade as any).engravings)||[]) as any[]; if (engrIndex < arr.length-1) { const t = arr[engrIndex]; arr[engrIndex] = arr[engrIndex+1]; arr[engrIndex+1] = t; engrIndex++; (state.blade as any).engravings = arr; rerender(); syncEngravingControls(); }};
  engrToolbar.appendChild(engrAddBtn); engrToolbar.appendChild(engrRemoveBtn); engrToolbar.appendChild(engrUpBtn); engrToolbar.appendChild(engrDownBtn);
  engrRow.appendChild(engrToolbar);
  sections.Engravings.appendChild(engrRow);
  let engrIndex = 0; const getEngr = ()=>{ const arr = (((state.blade as any).engravings)||[]) as any[]; if (!arr.length) return null; if (engrIndex>=arr.length) engrIndex = arr.length-1; return arr[engrIndex]; };
  const engrFields = {
    index: '',
    type: '',
    text: '',
    font: '',
    width: '',
    height: '',
    depth: '',
    spacing: '',
    offsetY: '',
    offsetX: '',
    rotY: '',
    side: '',
    align: ''
  };
  engrFields.index = slider(sections.Engravings, 'Engrave Index', 0, 10, 1, 0, (v)=>{ engrIndex = Math.max(0, Math.round(v)); syncEngravingControls(); }, ()=>{}, 'Which engraving to edit (0..N-1).');
  engrFields.type = select(sections.Engravings, 'Engrave Type', ['text','shape','decal'], 'text', (v) => { const e = getEngr(); if (!e) return; e.type = v; rerender(); }, ()=>{}, 'Type of engraving primitive.');
  engrFields.text = textRow(sections.Engravings, 'Engrave Text', 'ᚠᚢᚦ', (v) => {
    const e = getEngr(); if (!e) return; e.content = v; rerender();
  }, 'Unicode supported by the chosen font.');
  engrFields.font = textRow(sections.Engravings, 'Font URL', 'https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json', (v) => {
    const e = getEngr(); if (!e) return; e.fontUrl = v; rerender();
  }, 'Typeface JSON URL (typeface.js format). For full Unicode, supply a suitable font.');
  engrFields.width = slider(sections.Engravings, 'Engrave Width', 0.02, 0.6, 0.001, 0.18, (val) => {
    const e = getEngr(); if (!e) return; e.width = val; rerender();
  }, rerender, 'Max width of text region.');
  engrFields.height = slider(sections.Engravings, 'Engrave Height', 0.005, 0.1, 0.001, 0.03, (val) => {
    const e = getEngr(); if (!e) return; e.height = val; rerender();
  }, rerender, 'Text letter height.');
  engrFields.depth = slider(sections.Engravings, 'Engrave Depth', 0.0005, 0.02, 0.0005, 0.002, (val) => {
    const e = getEngr(); if (!e) return; e.depth = val; rerender();
  }, rerender, 'Extrusion depth of the engraving.');
  engrFields.spacing = slider(sections.Engravings, 'Letter Spacing', 0, 0.3, 0.005, 0.05, (val) => {
    const e = getEngr(); if (!e) return; (e as any).letterSpacing = val; rerender();
  }, rerender, 'Additional spacing between characters (in letter heights).');
  engrFields.offsetY = slider(sections.Engravings, 'Engrave OffsetY', 0, 1, 0.001, 0.5, (val) => {
    const e = getEngr(); if (!e) return; e.offsetY = state.blade.length * val; rerender();
  }, rerender, 'Position along blade length (0..1).');
  engrFields.offsetX = slider(sections.Engravings, 'Engrave OffsetX', -0.4, 0.4, 0.001, 0, (val) => {
    const e = getEngr(); if (!e) return; e.offsetX = val; rerender();
  }, rerender, 'Lateral offset across blade width.');
  engrFields.rotY = slider(sections.Engravings, 'Engrave RotY', -180, 180, 1, 0, (deg) => {
    const e = getEngr(); if (!e) return; e.rotation = deg*Math.PI/180; rerender();
  }, rerender, 'Rotation around Y axis (deg).');
  engrFields.side = select(sections.Engravings, 'Engrave Side', ['left','right','both'], 'right', (v) => {
    const e = getEngr(); if (!e) return; e.side = v; rerender();
  }, rerender, 'Which blade face.');
  engrFields.align = select(sections.Engravings, 'Text Align', ['left','center','right'], 'center', (v) => {
    const e = getEngr(); if (!e) return; e.align = v as any; rerender();
  }, rerender, 'Horizontal alignment for text.');

  function syncEngravingControls() {
    const arr = (((state.blade as any).engravings) || []) as any[];
    const bladeLen = state.blade.length || 1;
    if (!arr.length) {
      engrIndex = 0;
      registry.setValue('engravings', 'Engrave Index', 0);
      registry.setValue('engravings', 'Engrave Type', 'text');
      registry.setValue('engravings', 'Engrave Text', '');
      registry.setValue('engravings', 'Font URL', '');
      registry.setValue('engravings', 'Engrave Width', 0.18);
      registry.setValue('engravings', 'Engrave Height', 0.03);
      registry.setValue('engravings', 'Engrave Depth', 0.002);
      registry.setValue('engravings', 'Letter Spacing', 0);
      registry.setValue('engravings', 'Engrave OffsetY', 0.5);
      registry.setValue('engravings', 'Engrave OffsetX', 0);
      registry.setValue('engravings', 'Engrave RotY', 0);
      registry.setValue('engravings', 'Engrave Side', 'right');
      registry.setValue('engravings', 'Text Align', 'center');
      return;
    }
    if (engrIndex >= arr.length) engrIndex = arr.length - 1;
    if (engrIndex < 0) engrIndex = 0;
    const e = arr[engrIndex] || {};
    registry.setValue('engravings', 'Engrave Index', engrIndex);
    registry.setValue('engravings', 'Engrave Type', e.type ?? 'text');
    registry.setValue('engravings', 'Engrave Text', e.content ?? '');
    registry.setValue('engravings', 'Font URL', e.fontUrl ?? '');
    registry.setValue('engravings', 'Engrave Width', e.width ?? 0.18);
    registry.setValue('engravings', 'Engrave Height', e.height ?? 0.03);
    registry.setValue('engravings', 'Engrave Depth', e.depth ?? 0.002);
    registry.setValue('engravings', 'Letter Spacing', e.letterSpacing ?? 0);
    registry.setValue('engravings', 'Engrave OffsetY', (e.offsetY ?? (bladeLen * 0.5)) / bladeLen);
    registry.setValue('engravings', 'Engrave OffsetX', e.offsetX ?? 0);
    registry.setValue('engravings', 'Engrave RotY', ((e.rotation ?? 0) * 180) / Math.PI);
    registry.setValue('engravings', 'Engrave Side', e.side ?? 'right');
    registry.setValue('engravings', 'Text Align', e.align ?? 'center');
  }

  syncEngravingControls();

  // Guard controls
  const guardExtras = () => (((state.guard as any).extras) || []) as any[];
  const findGuardExtra = (kind: string) => guardExtras().find((e: any) => e.kind === kind);
  const hasGuardExtra = (kind: string) => guardExtras().some((e: any) => e.kind === kind);
  slider(sections.Guard, 'Width', 0.2, 3.0, 0.01, state.guard.width, (v) => (state.guard.width = v), rerender);
  slider(sections.Guard, 'Guard Thickness', 0.05, 0.6, 0.005, state.guard.thickness, (v) => (state.guard.thickness = v), rerender);
  slider(sections.Guard, 'Curve', -1, 1, 0.01, state.guard.curve, (v) => (state.guard.curve = v), rerender, 'Bends ornate guards upward/downward.');
  slider(sections.Guard, 'Tilt', -1.57, 1.57, 0.01, state.guard.tilt, (v) => (state.guard.tilt = v), rerender, 'Rotates the guard around the blade axis.');
  select(sections.Guard, 'Style', ['bar', 'winged', 'claw', 'disk', 'knucklebow', 'swept', 'basket'], state.guard.style, (v) => (state.guard.style = v as any), rerender);
  slider(sections.Guard, 'Blend Fillet', 0, 1, 0.01, (state.guard as any).guardBlendFillet ?? 0, (v) => ((state.guard as any).guardBlendFillet = v), rerender, 'Small bridge piece between blade and guard.');
  select(sections.Guard, 'Fillet Style', ['box','smooth'], ((state.guard as any).guardBlendFilletStyle ?? 'box') as string, (v) => { (state.guard as any).guardBlendFilletStyle = v as any; }, rerender, 'Fillet style between guard and blade.');
  checkbox(sections.Guard, 'Finger Guard', hasGuardExtra('fingerGuard'), (v) => {
    const arr = guardExtras();
    const without = arr.filter((e) => e.kind !== 'fingerGuard');
    if (v) without.push({ kind: 'fingerGuard', radius: 0.12, thickness: 0.03, offsetY: 0 });
    (state.guard as any).extras = without;
  }, rerender, 'Add a small bar under the knuckles.');
  // Side rings controls
  checkbox(sections.Guard, 'Side Rings', hasGuardExtra('sideRing'), (v) => {
    const arr = guardExtras();
    const without = arr.filter((e) => e.kind !== 'sideRing');
    if (v) without.push({ kind: 'sideRing', radius: 0.12, thickness: 0.03, offsetY: 0 });
    (state.guard as any).extras = without;
  }, rerender, 'Add decorative rings at guard sides.');
  slider(sections.Guard, 'Ring Radius', 0.01, 0.4, 0.001, findGuardExtra('sideRing')?.radius ?? 0.12, (v) => {
    const arr = guardExtras();
    (state.guard as any).extras = arr.map((e:any) => e.kind==='sideRing' ? { ...e, radius: v } : e);
  }, rerender, 'Side ring radius.');
  slider(sections.Guard, 'Ring Thick', 0.005, 0.1, 0.001, findGuardExtra('sideRing')?.thickness ?? 0.03, (v) => {
    const arr = guardExtras();
    (state.guard as any).extras = arr.map((e:any) => e.kind==='sideRing' ? { ...e, thickness: v } : e);
  }, rerender, 'Side ring thickness.');
  slider(sections.Guard, 'Ring OffsetY', -0.2, 0.2, 0.001, findGuardExtra('sideRing')?.offsetY ?? 0, (v) => {
    const arr = guardExtras();
    (state.guard as any).extras = arr.map((e:any) => e.kind==='sideRing' ? { ...e, offsetY: v } : e);
  }, rerender, 'Side ring vertical offset.');
  // Loops controls
  checkbox(sections.Guard, 'Loops', hasGuardExtra('loop'), (v) => {
    const arr = guardExtras();
    const without = arr.filter((e) => e.kind !== 'loop');
    if (v) without.push({ kind: 'loop', radius: 0.12, thickness: 0.02, offsetY: 0 });
    (state.guard as any).extras = without;
  }, rerender, 'Add decorative loops near quillon ends.');
  slider(sections.Guard, 'Loop Radius', 0.01, 0.4, 0.001, findGuardExtra('loop')?.radius ?? 0.12, (v) => {
    const arr = guardExtras();
    (state.guard as any).extras = arr.map((e:any) => e.kind==='loop' ? { ...e, radius: v } : e);
  }, rerender, 'Loop radius.');
  slider(sections.Guard, 'Loop Thick', 0.005, 0.1, 0.001, findGuardExtra('loop')?.thickness ?? 0.02, (v) => {
    const arr = guardExtras();
    (state.guard as any).extras = arr.map((e:any) => e.kind==='loop' ? { ...e, thickness: v } : e);
  }, rerender, 'Loop thickness.');
  slider(sections.Guard, 'Loop OffsetY', -0.2, 0.2, 0.001, findGuardExtra('loop')?.offsetY ?? 0, (v) => {
    const arr = guardExtras();
    (state.guard as any).extras = arr.map((e:any) => e.kind==='loop' ? { ...e, offsetY: v } : e);
  }, rerender, 'Loop vertical offset.');
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
  const handleLayers = () => (((state.handle as any).handleLayers) || []) as any[];
  const findHandleLayer = (kind: string, predicate?: (layer: any) => boolean) => handleLayers().find((layer) => layer.kind === kind && (!predicate || predicate(layer)));
  const ringLayers = () => handleLayers().filter((layer) => layer.kind === 'ring');
  const crisscrossLayer = () => findHandleLayer('wrap', (layer) => layer.wrapPattern === 'crisscross');
  const ringLayer = () => ringLayers()[0];
  const menukiLayers = () => (((state.handle as any).menuki) || []) as any[];
  const rivetLayers = () => (((state.handle as any).rivets) || []) as any[];
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
  checkbox(sections.Handle, 'Crisscross Wrap Layer', !!crisscrossLayer(), (v) => {
    const arr = handleLayers();
    const rest = arr.filter((e:any) => !(e.kind==='wrap' && e.wrapPattern==='crisscross'));
    if (v) rest.push({ kind:'wrap', wrapPattern:'crisscross', y0Frac:0, lengthFrac:1, turns:7, depth:0.012 });
    (state.handle as any).handleLayers = rest;
  }, rerender, 'Adds two intertwined helices around the grip.');
  slider(sections.Handle, 'Wrap Turns L', 1, 20, 1, Math.round(crisscrossLayer()?.turns ?? 7), (val) => {
    const arr = handleLayers();
    (state.handle as any).handleLayers = arr.map((e:any) => e.kind==='wrap' && e.wrapPattern==='crisscross' ? { ...e, turns: Math.round(val) } : e);
  }, rerender, 'Number of crisscross turns.');
  slider(sections.Handle, 'Wrap Depth', 0.001, 0.05, 0.001, crisscrossLayer()?.depth ?? 0.012, (val) => {
    const arr = handleLayers();
    (state.handle as any).handleLayers = arr.map((e:any) => e.kind==='wrap' && e.wrapPattern==='crisscross' ? { ...e, depth: val } : e);
  }, rerender, 'Radial height of the wrap layer.', 'handle.layer-wrap-depth');
  slider(sections.Handle, 'Wrap Y0 %', 0, 100, 1, Math.round((crisscrossLayer()?.y0Frac ?? 0) * 100), (val) => {
    const arr = handleLayers();
    (state.handle as any).handleLayers = arr.map((e:any) => e.kind==='wrap' && e.wrapPattern==='crisscross' ? { ...e, y0Frac: (val/100) } : e);
  }, rerender, 'Start position of wrap (percent of handle length).');
  slider(sections.Handle, 'Wrap Len %', 1, 100, 1, Math.round((crisscrossLayer()?.lengthFrac ?? 1) * 100), (val) => {
    const arr = handleLayers();
    (state.handle as any).handleLayers = arr.map((e:any) => e.kind==='wrap' && e.wrapPattern==='crisscross' ? { ...e, lengthFrac: Math.max(0.01, (val/100)) } : e);
  }, rerender, 'Length of the wrap section (percent of handle).');
  checkbox(sections.Handle, 'Handle Ring', ringLayers().length > 0, (v) => {
    const arr = handleLayers();
    const rest = arr.filter((e:any) => e.kind!=='ring');
    if (v) rest.push({ kind:'ring', y0Frac:0.5, radiusAdd:0.0 });
    (state.handle as any).handleLayers = rest;
  }, rerender, 'Add a decorative ring around the grip.');
  slider(sections.Handle, 'Ring Y %', 0, 100, 1, Math.round((ringLayer()?.y0Frac ?? 0.5) * 100), (val) => {
    const arr = handleLayers();
    (state.handle as any).handleLayers = arr.map((e:any) => e.kind==='ring' ? { ...e, y0Frac: (val/100) } : e);
  }, rerender, 'Vertical position of ring.');
  slider(sections.Handle, 'Ring Radius +', 0, 0.2, 0.001, ringLayer()?.radiusAdd ?? 0.0, (val) => {
    const arr = handleLayers();
    (state.handle as any).handleLayers = arr.map((e:any) => e.kind==='ring' ? { ...e, radiusAdd: val } : e);
  }, rerender, 'Additional radius for ring.');
  slider(sections.Handle, 'Rings Count', 0, 3, 1, ringLayers().length, (val) => {
    const n = Math.max(0, Math.round(val));
    const arr = handleLayers();
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
  checkbox(sections.Handle, 'Menuki', menukiLayers().length > 0, (v) => {
    (state.handle as any).menuki = v ? [{ positionFrac: 0.55, side:'left', size:0.02 }] : [];
  }, rerender, 'Add a menuki ornament on the grip.');
  // Rivets
  checkbox(sections.Handle, 'Rivets', rivetLayers().length > 0, (v) => {
    (state.handle as any).rivets = v ? [{ count: 8, ringFrac: 0.3, radius: 0.01 }] : [];
  }, rerender, 'Add a ring of rivets.');
  slider(sections.Handle, 'Rivets Count', 1, 32, 1, Math.round((rivetLayers()[0]?.count ?? 8)), (val) => {
    const arr = rivetLayers();
    (state.handle as any).rivets = arr.map((r:any) => ({ ...r, count: Math.round(val) }));
  }, rerender, 'Number of rivets around the ring.');
  slider(sections.Handle, 'Rivets Y %', 0, 100, 1, Math.round(((rivetLayers()[0]?.ringFrac) ?? 0.3) * 100), (val) => {
    const arr = rivetLayers();
    (state.handle as any).rivets = arr.map((r:any) => ({ ...r, ringFrac: (val/100) }));
  }, rerender, 'Vertical position of rivets ring.');
  slider(sections.Handle, 'Rivet Size', 0.002, 0.05, 0.001, rivetLayers()[0]?.radius ?? 0.01, (val) => {
    const arr = rivetLayers();
    (state.handle as any).rivets = arr.map((r:any) => ({ ...r, radius: val }));
  }, rerender, 'Rivet sphere radius.');

  // Pommel controls
  select(sections.Pommel, 'Style', ['orb', 'disk', 'spike', 'wheel', 'scentStopper', 'ring', 'crown'], state.pommel.style, (v) => (state.pommel.style = v as any), rerender);
  slider(sections.Pommel, 'Size', 0.05, 0.5, 0.001, state.pommel.size, (v) => (state.pommel.size = v), rerender);
  slider(sections.Pommel, 'Elongation', 0.5, 2.0, 0.01, state.pommel.elongation, (v) => (state.pommel.elongation = v), rerender);
  slider(sections.Pommel, 'Morph', 0, 1, 0.01, state.pommel.shapeMorph, (v) => (state.pommel.shapeMorph = v), rerender);
  slider(sections.Pommel, 'Offset X', -0.3, 0.3, 0.001, state.pommel.offsetX ?? 0, (v) => (state.pommel.offsetX = v), rerender, 'Offset pommel sideways.');
  slider(sections.Pommel, 'Offset Y', -0.3, 0.3, 0.001, state.pommel.offsetY ?? 0, (v) => (state.pommel.offsetY = v), rerender, 'Offset pommel up/down.');
  slider(sections.Pommel, 'Facet Count', 6, 64, 1, state.pommel.facetCount ?? 32, (v) => (state.pommel.facetCount = Math.round(v)), rerender, 'Radial facets (lower is more gem-like).');
  slider(sections.Pommel, 'Spike Length', 0.5, 2.0, 0.01, state.pommel.spikeLength ?? 1.0, (v) => (state.pommel.spikeLength = v), rerender, 'Spike length for spike style.');
  slider(sections.Pommel, 'Balance', 0, 1, 0.01, (state.pommel as any).balance ?? 0, (v) => ((state.pommel as any).balance = v), rerender, 'Interpolate pommel size toward blade-balanced target.');
  // Style-specific
  slider(sections.Pommel, 'Ring Inner R', 0.01, 0.6, 0.001, (state.pommel as any).ringInnerRadius ?? 0.08, (v) => ((state.pommel as any).ringInnerRadius = v), rerender, 'Inner radius for ring style.');
  slider(sections.Pommel, 'Crown Spikes', 5, 24, 1, (state.pommel as any).crownSpikes ?? 8, (v) => ((state.pommel as any).crownSpikes = Math.round(v)), rerender, 'Number of spikes for crown style.');
  slider(sections.Pommel, 'Crown Sharp', 0, 1, 0.01, (state.pommel as any).crownSharpness ?? 0.6, (v) => ((state.pommel as any).crownSharpness = v), rerender, 'Sharpness for crown style.');

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
  // Proportional ratios (see newfeatures.md §6)
  checkbox(sections.Other, 'Use Ratios', (state as any).useRatios ?? false, (v) => ((state as any).useRatios = v), rerender, 'Drive key sizes from blade length.');
  slider(sections.Other, 'Guard:Blade', 0.1, 0.8, 0.01, ((state as any).ratios?.guardWidthToBlade ?? 0.35), (v) => {
    (state as any).ratios = { ...(state as any).ratios, guardWidthToBlade: v };
  }, rerender, 'Guard width = v * blade.length');
  slider(sections.Other, 'Handle:Blade', 0.1, 0.6, 0.01, ((state as any).ratios?.handleLengthToBlade ?? 0.3), (v) => {
    (state as any).ratios = { ...(state as any).ratios, handleLengthToBlade: v };
  }, rerender, 'Handle length = v * blade.length');
  slider(sections.Other, 'Pommel:Blade', 0.01, 0.2, 0.001, ((state as any).ratios?.pommelSizeToBlade ?? 0.05), (v) => {
    (state as any).ratios = { ...(state as any).ratios, pommelSizeToBlade: v };
  }, rerender, 'Pommel size = v * blade.length');

  // Presets handling
  presetSel.addEventListener('change', () => {
    const p = presetSel.value;
    let next: SwordParams | null = null;
    if (p === 'katana') next = presetKatana();
    if (p === 'claymore') next = presetClaymore();
    if (p === 'rapier') next = presetRapier();
    if (p === 'arming') next = presetArming();
    if (p === 'demon') next = presetDemon();
    if (p && next) {
      assignParams(state, next);
      rerender();
      syncUi();
    }
  });
  btnSave.addEventListener('click', () => {
    localStorage.setItem('swordmaker.preset.custom', JSON.stringify(state));
    presetSel.value = 'custom';
  });
  btnRandom.addEventListener('click', () => {
    randomize(state, false);
    rerender();
    syncUi();
  });
  btnRandomSafe.addEventListener('click', () => {
    randomize(state, true);
    rerender();
    syncUi();
  });
  // Export helpers for dropdown
  const doExportGLB = async () => {
    const exporter = new GLTFExporter();
    exporter.parse(
      sword.group,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'sword.glb'; a.click();
        URL.revokeObjectURL(url);
      },
      (error) => { console.error('GLTF export error', error); },
      { binary: true }
    );
  };
  const doExportOBJ = () => {
    const exporter = new OBJExporter();
    const result = exporter.parse(sword.group);
    const blob = new Blob([result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sword.obj'; a.click();
    URL.revokeObjectURL(url);
  };
  const doExportSTL = () => {
    const exporter = new STLExporter();
    const result = exporter.parse(sword.group, { binary: true } as any);
    const blob = new Blob([result as ArrayBuffer], { type: 'model/stl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sword.stl'; a.click();
    URL.revokeObjectURL(url);
  };
  const doExportSVG = () => {
    const pts = buildBladeOutlinePoints(state.blade);
    const svg = bladeOutlineToSVG(pts);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'blade_outline.svg'; a.click();
    URL.revokeObjectURL(url);
  };
  const doExportJSON = () => {
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
  };
  // Dropdown interactions
  btnExportMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = exportMenu.style.display === 'block';
    exportMenu.style.display = isOpen ? 'none' : 'block';
  });
  document.addEventListener('click', () => { exportMenu.style.display = 'none'; });
  menuGLB.addEventListener('click', () => { exportMenu.style.display='none'; doExportGLB(); });
  menuOBJ.addEventListener('click', () => { exportMenu.style.display='none'; doExportOBJ(); });
  menuSTL.addEventListener('click', () => { exportMenu.style.display='none'; doExportSTL(); });
  menuSVG.addEventListener('click', () => { exportMenu.style.display='none'; doExportSVG(); });
  menuJSON.addEventListener('click', () => { exportMenu.style.display='none'; doExportJSON(); });
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
      if (obj?.model) { assignParams(state, obj.model); rerender(); }
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
      syncUi();
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
    registry.clearWarnings();
    // General proportion hints
    if (guard.width > blade.length) {
      w.push('Guard very wide vs. blade length');
      registry.setWarning('guard', 'Width', true, 'Guard width is large vs. blade length');
    }
    if (handle.length > blade.length * 0.8) {
      w.push('Handle unusually long for blade');
      registry.setWarning('handle', 'Length', true, 'Handle length is large relative to blade');
    }
    if (blade.tipWidth > blade.baseWidth * 0.8) {
      w.push('Tip width close to base width');
      registry.setWarning('blade', 'Tip Width', true, 'Tip nearly as wide as base');
    }
    // Serration sanity
    const serrL = blade.serrationAmplitudeLeft ?? (blade.serrationAmplitude ?? 0);
    const serrR = blade.serrationAmplitudeRight ?? (blade.serrationAmplitude ?? 0);
    const serrMax = Math.max(serrL, serrR);
    if (serrMax > blade.baseWidth * 0.2) {
      w.push('Serration amplitude high for base width');
      registry.setWarning('blade', 'Serration Left', serrL > blade.baseWidth * 0.2, 'Left serration amplitude is high');
      registry.setWarning('blade', 'Serration Right', serrR > blade.baseWidth * 0.2, 'Right serration amplitude is high');
    }
    // Disabled/ineffective controls hints (Blade)
    const hamonOn = !!blade.hamonEnabled;
    registry.setWarning('blade', 'Hamon Width', !hamonOn, 'Enable Hamon to see effect');
    registry.setWarning('blade', 'Hamon Amp', !hamonOn, 'Enable Hamon to see effect');
    registry.setWarning('blade', 'Hamon Freq', !hamonOn, 'Enable Hamon to see effect');
    registry.setWarning('blade', 'Hamon Side', !hamonOn, 'Enable Hamon to see effect');
    // Leaf bulge only for leaf tip
    registry.setWarning('blade', 'Leaf Bulge', (blade.tipShape ?? 'pointed') !== 'leaf', 'Only affects Leaf tip shape');
    // False edge coupling
    const feLen = (blade as any).falseEdgeLength ?? 0;
    const feDepth = (blade as any).falseEdgeDepth ?? 0;
    registry.setWarning('blade', 'False Edge Depth', feLen <= 0, 'Set False Edge % > 0 for depth to do anything');
    registry.setWarning('blade', 'False Edge %', feDepth <= 0 && feLen > 0, 'Depth is 0; no visible effect');
    // Sori disabled when curvature ~ 0
    const curvZero = Math.abs(blade.curvature || 0) < 1e-6;
    registry.setWarning('blade', 'Sori Profile', curvZero, 'Curvature is 0; profile has no visible effect');
    registry.setWarning('blade', 'Sori Bias', curvZero, 'Curvature is 0; bias has no visible effect');
    // Fullers dependencies
    const fEnabled = !!blade.fullerEnabled;
    const fLen = blade.fullerLength ?? 0;
    const fMode = (blade.fullerMode ?? 'overlay');
    const fDepth = blade.fullerDepth ?? 0;
    const fInset = (blade.fullerInset ?? fDepth);
    const noFuller = !fEnabled || fLen <= 0;
    registry.setWarning('blade', 'Fuller Count', noFuller, 'Enable Fullers and set Length > 0');
    registry.setWarning('blade', 'Fuller Length', !fEnabled, 'Enable Fullers');
    registry.setWarning('blade', 'Fuller Mode', !fEnabled, 'Enable Fullers');
    registry.setWarning('blade', 'Fuller Depth', (!fEnabled || fMode !== 'overlay') || (fMode === 'overlay' && (fLen <= 0 || fDepth <= 0)), fMode === 'overlay' ? 'Enable Fullers, Length > 0, set Depth > 0' : 'Depth is used only in Overlay mode');
    registry.setWarning('blade', 'Fuller Profile', (!fEnabled || fMode !== 'carve') || (fMode === 'carve' && fLen <= 0), fMode === 'carve' ? 'Set Length > 0' : 'Profile is used only in Carve mode');
    registry.setWarning('blade', 'Fuller Width', (!fEnabled || fMode !== 'carve') || (fMode === 'carve' && fLen <= 0), fMode === 'carve' ? 'Set Length > 0 to see carving width' : 'Width is used only in Carve mode');
    registry.setWarning('blade', 'Fuller Inset', (!fEnabled || fMode !== 'carve') || (fMode === 'carve' && (fLen <= 0 || fInset <= 0)), fMode === 'carve' ? 'Set Length > 0 and Inset > 0 to carve' : 'Inset is used only in Carve mode');
    // Engravings
    const engr = (((state.blade as any).engravings) || []) as any[];
    const engrEmpty = engr.length === 0;
    const engrLabels = ['Engrave Index','Engrave Type','Engrave Text','Font URL','Engrave Width','Engrave Height','Engrave Depth','Letter Spacing','Engrave OffsetY','Engrave OffsetX','Engrave RotY','Engrave Side','Text Align'];
    engrLabels.forEach((lab) => registry.setWarning('engravings', lab, engrEmpty, 'No engravings — add one first'));
    // Render dependent warnings
    registry.setWarning('render-post', 'Bloom Strength', !rstate.bloomEnabled, 'Enable Bloom to see effect');
    registry.setWarning('render-post', 'Bloom Threshold', !rstate.bloomEnabled, 'Enable Bloom to see effect');
    registry.setWarning('render-post', 'Bloom Radius', !rstate.bloomEnabled, 'Enable Bloom to see effect');
    registry.setWarning('render-post', 'Outline Strength', !postState.outlineEnabled, 'Enable Outline to see effect');
    registry.setWarning('render-post', 'Outline Thickness', !postState.outlineEnabled, 'Enable Outline to see effect');
    registry.setWarning('render-post', 'Outline Color', !postState.outlineEnabled, 'Enable Outline to see effect');
    registry.setWarning('render-post', 'Ink Thickness', !postState.inkEnabled, 'Enable Ink Outline to see effect');
    registry.setWarning('render-post', 'Ink Color', !postState.inkEnabled, 'Enable Ink Outline to see effect');
    registry.setWarning('render-post', 'Vignette Strength', !postState.vignetteEnabled, 'Enable Vignette to see effect');
    registry.setWarning('render-post', 'Vignette Softness', !postState.vignetteEnabled, 'Enable Vignette to see effect');
    registry.setWarning('render-blade-gradient', 'Grad Base', !postState.bladeGradientEnabled, 'Enable Blade Gradient to see effect');
    registry.setWarning('render-blade-gradient', 'Grad Edge', !postState.bladeGradientEnabled, 'Enable Blade Gradient to see effect');
    registry.setWarning('render-blade-gradient', 'Grad Edge Fade', !postState.bladeGradientEnabled, 'Enable Blade Gradient to see effect');
    registry.setWarning('render-blade-gradient', 'Wear Intensity', !postState.bladeGradientEnabled, 'Enable Blade Gradient to see effect');
    warningsBox.innerHTML = w.length ? ('Warnings:\n- ' + w.join('\n- ')).replace(/\n/g, '<br/>') : 'No warnings';
  }
  const updateDynamics = () => {
    const d = (sword as any)?.getDerived?.();
    if (!d) { dynamicsBox.textContent = ''; return; }
    const L = state.blade.length || 1;
    const fmt = (x:number)=> (Math.round(x*100)/100).toFixed(2);
    const pct = (x:number)=> Math.round((x/L)*100);
    const text = 'Dynamics: PoB ' + fmt(d.cmY) + ' (' + pct(d.cmY) + '%), CoP ' + fmt(d.copY) + ' (' + pct(d.copY) + '%), Ibase ' + fmt(d.Ibase) + ', Icm ' + fmt(d.Icm);
    dynamicsBox.textContent = text;
  };

  syncUi();
  rerender();
  activeRegistry = previousRegistry;
}

function addSection(root: HTMLElement, title: string) {
  const wrap = document.createElement('div');
  wrap.className = 'section';
  wrap.dataset.fieldNamespace = slugify(title);
  const h = document.createElement('h2');
  const caret = document.createElement('span'); caret.className = 'caret'; caret.textContent = '▾';
  const text = document.createElement('span'); text.textContent = ' ' + title;
  h.appendChild(caret); h.appendChild(text);
  // Persisted collapsed state
  const key = `swordmaker.ui.section.${title}.collapsed`;
  try {
    const col = localStorage.getItem(key);
    if (col === '1') wrap.classList.add('collapsed');
  } catch {}
  h.addEventListener('click', (e) => {
    // Ignore clicks originating from buttons within the header
    if ((e.target as HTMLElement).closest('button')) return;
    wrap.classList.toggle('collapsed');
    // Defensive: ensure immediate children visibility is reset when expanding
    if (!wrap.classList.contains('collapsed')) {
      const kids = Array.from(wrap.children) as HTMLElement[];
      kids.forEach((child) => { if (child.tagName !== 'H2') (child as HTMLElement).style.removeProperty('display'); });
    }
    try { localStorage.setItem(key, wrap.classList.contains('collapsed') ? '1' : '0'); } catch {}
  });
  // Alt+double-click to reset entire section to defaults
  h.addEventListener('dblclick', (e) => {
    if ((e as MouseEvent).altKey) {
      resetSection(wrap);
    }
  });
  wrap.appendChild(h);
  root.appendChild(wrap);
  return wrap;
}

// Simple non-collapsible subheading within a section
function addSubheading(parent: HTMLElement, title: string) {
  const row = document.createElement('div')
  row.className = 'subheading'
  const h = document.createElement('h3')
  h.textContent = title
  row.appendChild(h)
  parent.appendChild(row)
  // Return the same parent as the target container for subsequent controls
  return parent
}

function addShuffleButton(section: HTMLElement, onClick: () => void) {
  const header = section.querySelector('h2');
  if (!header) return;
  const btn = document.createElement('button');
  btn.textContent = 'Shuffle';
  btn.style.marginLeft = '8px';
  btn.title = 'Randomize values in this section';
  btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  header.appendChild(btn);
}

function resetRow(row: HTMLElement) {
  const type = row.dataset.type;
  const def = row.dataset.defaultValue;
  if (def === undefined || !type) return;
  if (type === 'slider') {
    const range = row.querySelector('input[type="range"]') as HTMLInputElement | null;
    const num = row.querySelector('input[type="number"]') as HTMLInputElement | null;
    if (range && num) {
      range.value = def; num.value = def;
      range.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } else if (type === 'select') {
    const sel = row.querySelector('select') as HTMLSelectElement | null;
    if (sel) { sel.value = def; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  } else if (type === 'checkbox') {
    const chk = row.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    if (chk) { chk.checked = (def === 'true'); chk.dispatchEvent(new Event('change', { bubbles: true })); }
  } else if (type === 'color') {
    const col = row.querySelector('input[type="color"]') as HTMLInputElement | null;
    if (col) { col.value = def; col.dispatchEvent(new Event('input', { bubbles: true })); }
  } else if (type === 'text') {
    const inp = row.querySelector('input[type="text"]') as HTMLInputElement | null;
    if (inp) { inp.value = def; inp.dispatchEvent(new Event('change', { bubbles: true })); }
  }
}

function resetSection(section: HTMLElement) {
  const rows = Array.from(section.querySelectorAll('.row')) as HTMLElement[];
  rows.forEach(resetRow);
}

function slider(
  parent: HTMLElement,
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
  onChange: (v: number) => void,
  rerender: () => void,
  tooltip?: string,
  fieldOverride?: string
) {
  const registry = getActiveRegistry();
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.type = 'slider';
  row.dataset.defaultValue = String(value);
  const lab = document.createElement('label');
  lab.textContent = label;
  if (tooltip) {
    lab.title = tooltip + ' — Double‑click label to reset';
    const hi = document.createElement('span');
    hi.className = 'help-icon';
    hi.textContent = '?';
    hi.title = tooltip;
    lab.appendChild(hi);
  }
  lab.addEventListener('dblclick', (e) => { if (!(e as MouseEvent).altKey) resetRow(row); });
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

  const commit = (raw: unknown, emit = true) => {
    const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw));
    if (!Number.isFinite(parsed)) return;
    const clamped = clamp(parsed, min, max);
    range.value = String(clamped);
    num.value = String(clamped);
    if (emit) {
      onChange(clamped);
      rerender();
    }
  };

  range.addEventListener('input', () => {
    commit(range.value);
  });

  num.addEventListener('input', () => {
    if (!num.value.trim()) return;
    commit(num.value);
  });

  num.addEventListener('blur', () => {
    if (!num.value.trim()) {
      commit(range.value, false);
      return;
    }
    commit(num.value);
  });

  const field = registry.registerControl(parent, row, label, 'slider', (val) => commit(val, false), fieldOverride);
  row.appendChild(lab);
  row.appendChild(range);
  row.appendChild(num);
  parent.appendChild(row);
  return field;
}

function select(
  parent: HTMLElement,
  label: string,
  options: string[],
  value: string,
  onChange: (v: string) => void,
  rerender: () => void,
  tooltip?: string,
  fieldOverride?: string
) {
  const registry = getActiveRegistry();
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.type = 'select';
  row.dataset.defaultValue = String(value);
  const lab = document.createElement('label');
  lab.textContent = label;
  if (tooltip) {
    lab.title = tooltip + ' — Double‑click label to reset';
    const hi = document.createElement('span');
    hi.className = 'help-icon';
    hi.textContent = '?';
    hi.title = tooltip;
    lab.appendChild(hi);
  }
  lab.addEventListener('dblclick', (e) => { if (!(e as MouseEvent).altKey) resetRow(row); });
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

  const setValue = (val: unknown) => {
    if (val === undefined || val === null) return;
    const str = String(val);
    const opts = Array.from(sel.options).map((o) => o.value);
    if (!opts.includes(str)) return;
    sel.value = str;
  };

  const field = registry.registerControl(parent, row, label, 'select', setValue, fieldOverride);
  row.appendChild(lab);
  row.appendChild(sel);
  parent.appendChild(row);
  return field;
}

function checkbox(
  parent: HTMLElement,
  label: string,
  value: boolean,
  onChange: (v: boolean) => void,
  rerender: () => void,
  tooltip?: string,
  fieldOverride?: string
) {
  const registry = getActiveRegistry();
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.type = 'checkbox';
  row.dataset.defaultValue = String(!!value);
  const lab = document.createElement('label');
  lab.textContent = label;
  if (tooltip) {
    lab.title = tooltip + ' — Double‑click label to reset';
    const hi = document.createElement('span');
    hi.className = 'help-icon';
    hi.textContent = '?';
    hi.title = tooltip;
    lab.appendChild(hi);
  }
  lab.addEventListener('dblclick', (e) => { if (!(e as MouseEvent).altKey) resetRow(row); });
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = value;
  input.addEventListener('change', () => {
    onChange(input.checked);
    rerender();
  });
  const field = registry.registerControl(parent, row, label, 'checkbox', (val) => {
    input.checked = !!val;
  }, fieldOverride);
  row.appendChild(lab);
  const span = document.createElement('span');
  span.appendChild(input);
  row.appendChild(span);
  parent.appendChild(row);
  return field;
}

function colorPicker(
  parent: HTMLElement,
  label: string,
  value: string,
  onChange: (hex: string) => void,
  rerender: () => void,
  tooltip?: string,
  fieldOverride?: string
) {
  const registry = getActiveRegistry();
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.type = 'color';
  const normalize = (val: unknown) => {
    if (typeof val === 'number') {
      return '#' + Math.max(0, Math.min(0xffffff, Math.floor(val))).toString(16).padStart(6, '0');
    }
    if (typeof val === 'string') {
      return val.startsWith('#') ? val : `#${val}`;
    }
    return value;
  };
  const initial = normalize(value);
  row.dataset.defaultValue = initial;
  const lab = document.createElement('label');
  lab.textContent = label;
  if (tooltip) {
    lab.title = tooltip + ' — Double‑click label to reset';
    const hi = document.createElement('span');
    hi.className = 'help-icon';
    hi.textContent = '?';
    hi.title = tooltip;
    lab.appendChild(hi);
  }
  lab.addEventListener('dblclick', (e) => { if (!(e as MouseEvent).altKey) resetRow(row); });
  const input = document.createElement('input');
  input.type = 'color';
  input.value = initial;
  input.addEventListener('input', () => {
    onChange(input.value);
    rerender();
  });

  const field = registry.registerControl(parent, row, label, 'color', (val) => {
    input.value = normalize(val);
  }, fieldOverride);
  row.appendChild(lab);
  const span = document.createElement('span');
  span.appendChild(input);
  row.appendChild(span);
  parent.appendChild(row);
  return field;
}

function textRow(
  parent: HTMLElement,
  label: string,
  value: string,
  onChange: (v: string) => void,
  tooltip?: string,
  fieldOverride?: string
) {
  const registry = getActiveRegistry();
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.type = 'text';
  row.dataset.defaultValue = value || '';
  const lab = document.createElement('label');
  lab.textContent = label;
  if (tooltip) lab.title = tooltip + ' — Double‑click label to reset';
  lab.addEventListener('dblclick', (e) => { if (!(e as MouseEvent).altKey) resetRow(row); });
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
  input.placeholder = 'http(s):// or relative path';
  input.addEventListener('change', () => { onChange(input.value); });
  const field = registry.registerControl(parent, row, label, 'text', (val) => {
    input.value = val == null ? '' : String(val);
  }, fieldOverride);
  row.appendChild(lab);
  const span = document.createElement('span');
  span.appendChild(input);
  row.appendChild(span);
  parent.appendChild(row);
  return field;
}

function refreshInputs(registry: ControlRegistry, params: SwordParams) {
  const set = (section: string, label: string, value: number | string | boolean) => {
    registry.setValue(section, label, value);
  };
  const toDeg = (rad: number | undefined) => ((rad ?? 0) * 180) / Math.PI;
  const blade = params.blade as typeof params.blade & Record<string, any>;
  const guard = params.guard as typeof params.guard & Record<string, any>;
  const handle = params.handle as typeof params.handle & Record<string, any>;
  const pommel = params.pommel as typeof params.pommel & Record<string, any>;
  const extras = params as Record<string, any>;
  const ratios = extras.ratios ?? {};

  const getTaper = (): [number, number, number] => {
    const pts = blade.thicknessProfile?.points as Array<[number, number]> | undefined;
    if (!pts || pts.length < 2) return [100, 100, 100];
    const base = Math.round((pts[0]?.[1] ?? 1) * 100);
    const tip = Math.round((pts[pts.length - 1]?.[1] ?? 1) * 100);
    let mid = 100;
    for (const [t, s] of pts) {
      if (t >= 0.5 && t <= 0.7) {
        mid = Math.round(s * 100);
        break;
      }
    }
    return [base, mid, tip];
  };
  const [taperBase, taperMid, taperTip] = getTaper();

  const guardExtras = (guard.extras ?? []) as any[];
  const guardExtra = (kind: string) => guardExtras.find((e: any) => e.kind === kind);
  const hasGuardExtra = (kind: string) => guardExtras.some((e: any) => e.kind === kind);
  const sideRing = guardExtra('sideRing');
  const loopExtra = guardExtra('loop');

  const handleLayersList = (handle.handleLayers ?? []) as any[];
  const findHandleLayer = (kind: string, predicate?: (layer: any) => boolean) => handleLayersList.find((layer) => layer.kind === kind && (!predicate || predicate(layer)));
  const crisscross = findHandleLayer('wrap', (layer) => layer.wrapPattern === 'crisscross');
  const ringLayers = handleLayersList.filter((layer) => layer.kind === 'ring');
  const firstRing = ringLayers[0];
  const menukiLayers = (handle.menuki ?? []) as any[];
  const rivetLayers = (handle.rivets ?? []) as any[];

  const sections: Record<string, Record<string, number | string | boolean>> = {
    blade: {
      'Length': blade.length,
      'Base Width': blade.baseWidth,
      'Tip Width': blade.tipWidth,
      'Tip Shape': blade.tipShape ?? 'pointed',
      'Leaf Bulge': blade.tipBulge ?? 0.2,
      'Cross Section': blade.crossSection ?? 'flat',
      'Edge Bevel': blade.bevel ?? 0.5,
      'Blade Thickness': blade.thickness,
      'Left Thickness': blade.thicknessLeft ?? blade.thickness,
      'Right Thickness': blade.thicknessRight ?? blade.thickness,
      'Curvature': blade.curvature,
      'Base Angle': toDeg(blade.baseAngle),
      'Sori Profile': blade.soriProfile ?? 'torii',
      'Sori Bias': blade.soriBias ?? 0.8,
      'Kissaki Length': blade.kissakiLength ?? 0,
      'Kissaki Round': blade.kissakiRoundness ?? 0.5,
      'Tip Ramp %': Math.round((blade.tipRampStart ?? 0) * 100),
      'Edge Type': blade.edgeType ?? 'double',
      'Hamon Enabled': blade.hamonEnabled ?? false,
      'Hamon Width': blade.hamonWidth ?? 0.02,
      'Hamon Amp': blade.hamonAmplitude ?? 0.008,
      'Hamon Freq': blade.hamonFrequency ?? 6,
      'Hamon Side': blade.hamonSide ?? 'auto',
      'Asymmetry': blade.asymmetry ?? 0,
      'Chaos': blade.chaos ?? 0,
      'Serration Pattern': blade.serrationPattern ?? blade.serrationMode ?? 'sine',
      'Serration Seed': blade.serrationSeed ?? 1337,
      'Fuller Mode': blade.fullerMode ?? 'overlay',
      'Fuller Profile': blade.fullerProfile ?? 'u',
      'Fuller Width': blade.fullerWidth ?? 0,
      'Fuller Inset': blade.fullerInset ?? (blade.fullerDepth ?? 0),
      'Enable Fullers': blade.fullerEnabled ?? false,
      'Fuller Depth': blade.fullerDepth ?? 0,
      'Fuller Length': blade.fullerLength ?? 0,
      'Fuller Count': blade.fullerCount ?? 1,
      'Serration Left': blade.serrationAmplitudeLeft ?? blade.serrationAmplitude ?? 0,
      'Serration Right': blade.serrationAmplitudeRight ?? blade.serrationAmplitude ?? 0,
      'Serration Freq': blade.serrationFrequency ?? 0,
      'Serration Sharpness': (blade as any).serrationSharpness ?? 0,
      'Serration Lean L': (blade as any).serrationLeanLeft ?? 0,
      'Serration Lean R': (blade as any).serrationLeanRight ?? 0,
      'Taper Base %': taperBase,
      'Taper Mid %': taperMid,
      'Taper Tip %': taperTip,
      'Ricasso %': Math.round((blade.ricassoLength ?? 0) * 100),
      'False Edge %': Math.round((blade.falseEdgeLength ?? 0) * 100),
      'False Edge Depth': blade.falseEdgeDepth ?? 0,
      'Twist Angle': toDeg(blade.twistAngle ?? 0),
    },
    guard: {
      'Width': guard.width,
      'Guard Thickness': guard.thickness,
      'Curve': guard.curve,
      'Tilt': guard.tilt,
      'Style': guard.style,
      'Asymmetric Arms': guard.asymmetricArms ?? false,
      'Arm Asymmetry': guard.asymmetry ?? 0,
      'Guard Detail': guard.curveSegments ?? 12,
      'Habaki': guard.habakiEnabled ?? false,
      'Habaki Height': guard.habakiHeight ?? 0.06,
      'Habaki Margin': guard.habakiMargin ?? 0.01,
      'Guard Height': guard.heightOffset ?? 0,
      'Quillon Count': guard.quillonCount ?? 0,
      'Quillon Length': guard.quillonLength ?? 0.25,
      'Ornamentation': guard.ornamentation ?? 0,
      'Tip Sharpness': guard.tipSharpness ?? 0.5,
      'Cutouts': guard.cutoutCount ?? 0,
      'Cutout Radius': guard.cutoutRadius ?? 0.5,
      'Blend Fillet': guard.guardBlendFillet ?? 0,
      'Fillet Style': guard.guardBlendFilletStyle ?? 'box',
      'Finger Guard': hasGuardExtra('fingerGuard'),
      'Side Rings': hasGuardExtra('sideRing'),
      'Ring Radius': (sideRing?.radius ?? 0.12),
      'Ring Thick': (sideRing?.thickness ?? 0.03),
      'Ring OffsetY': (sideRing?.offsetY ?? 0),
      'Loops': hasGuardExtra('loop'),
      'Loop Radius': (loopExtra?.radius ?? 0.12),
      'Loop Thick': (loopExtra?.thickness ?? 0.02),
      'Loop OffsetY': (loopExtra?.offsetY ?? 0),
      'Basket Rods': guard.basketRodCount ?? 12,
      'Basket Rod Thick': guard.basketRodRadius ?? 0.02,
      'Basket Rings': guard.basketRingCount ?? 1,
      'Ring Thickness': guard.basketRingThickness ?? 0.012,
      'Ring Radius +': guard.basketRingRadiusAdd ?? 0,
    },
    handle: {
      'Length': handle.length,
      'Radius Top': handle.radiusTop,
      'Radius Bottom': handle.radiusBottom,
      'Ridges': handle.segmentation ?? false,
      'Ridge Count': handle.segmentationCount ?? 8,
      'Wrap Enabled': handle.wrapEnabled ?? false,
      'Wrap Turns': handle.wrapTurns ?? 6,
      'Wrap Depth': handle.wrapDepth ?? 0.015,
      'Handle Sides': handle.phiSegments ?? 64,
      'Oval Ratio': handle.ovalRatio ?? 1,
      'Flare': handle.flare ?? 0,
      'Handle Curvature': handle.curvature ?? 0,
      'Tang Visible': handle.tangVisible ?? false,
      'Tang Width': handle.tangWidth ?? 0.05,
      'Tang Thickness': handle.tangThickness ?? 0.02,
      'Wrap Texture': handle.wrapTexture ?? false,
      'Wrap Tex Scale': handle.wrapTexScale ?? 10,
      'Wrap Tex Angle': toDeg(handle.wrapTexAngle ?? Math.PI / 4),
      'Crisscross Wrap Layer': !!crisscross,
      'Wrap Turns L': Math.round(crisscross?.turns ?? 7),
      'Wrap Y0 %': Math.round((crisscross?.y0Frac ?? 0) * 100),
      'Wrap Len %': Math.round((crisscross?.lengthFrac ?? 1) * 100),
      'Handle Ring': ringLayers.length > 0,
      'Ring Y %': Math.round((firstRing?.y0Frac ?? 0.5) * 100),
      'Ring Radius +': firstRing?.radiusAdd ?? 0.0,
      'Rings Count': ringLayers.length,
      'Menuki': menukiLayers.length > 0,
      'Rivets': rivetLayers.length > 0,
      'Rivets Count': Math.round(rivetLayers[0]?.count ?? 8),
      'Rivets Y %': Math.round((rivetLayers[0]?.ringFrac ?? 0.3) * 100),
      'Rivet Size': rivetLayers[0]?.radius ?? 0.01,
    },
    pommel: {
      'Style': pommel.style,
      'Size': pommel.size,
      'Elongation': pommel.elongation,
      'Morph': pommel.shapeMorph,
      'Offset X': pommel.offsetX ?? 0,
      'Offset Y': pommel.offsetY ?? 0,
      'Facet Count': pommel.facetCount ?? 32,
      'Spike Length': pommel.spikeLength ?? 1.0,
      'Balance': pommel.balance ?? 0,
      'Ring Inner R': pommel.ringInnerRadius ?? 0.08,
      'Crown Spikes': pommel.crownSpikes ?? 8,
      'Crown Sharp': pommel.crownSharpness ?? 0.6,
    },
    other: {
      'Stylization': extras.styleFactor ?? 0,
      'Taper Ratio': blade.baseWidth > 0 ? 1 - (blade.tipWidth / blade.baseWidth) : 0,
      'Blade Detail': blade.sweepSegments ?? 128,
      'Use Ratios': extras.useRatios ?? false,
      'Guard:Blade': ratios.guardWidthToBlade ?? 0.35,
      'Handle:Blade': ratios.handleLengthToBlade ?? 0.3,
      'Pommel:Blade': ratios.pommelSizeToBlade ?? 0.05,
    },
  };

  for (const [section, entries] of Object.entries(sections)) {
    for (const [label, value] of Object.entries(entries)) {
      set(section, label, value);
    }
  }

  registry.setValueByField('handle.layer-wrap-depth', crisscross?.depth ?? 0.012);
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

function presetArming(): SwordParams {
  const p = defaultSwordParams();
  p.blade.length = 2.6;
  p.blade.baseWidth = 0.22;
  p.blade.tipWidth = 0.01;
  p.blade.tipRampStart = 0.82;
  p.blade.kissakiLength = 0.16;
  p.blade.kissakiRoundness = 0.05;
  p.blade.tipShape = 'spear';
  p.blade.crossSection = 'diamond';
  p.blade.thickness = 0.07;
  p.blade.thicknessLeft = 0.07;
  p.blade.thicknessRight = 0.07;
  p.blade.fullerEnabled = true;
  p.blade.fullerDepth = 0.015;
  p.blade.fullerLength = 0.55;
  p.blade.fullerWidth = 0.05;
  p.blade.fullerMode = 'overlay';
  p.blade.fullerCount = 1;
  p.blade.chaos = 0;
  p.blade.edgeType = 'double';
  p.blade.ricassoLength = 0.04;
  p.blade.falseEdgeLength = 0;
  p.blade.falseEdgeDepth = 0;

  p.guard.style = 'bar';
  p.guard.width = 1.15;
  p.guard.thickness = 0.18;
  p.guard.curve = 0;
  p.guard.tilt = 0;
  p.guard.guardBlendFillet = 0.05;
  p.guard.guardBlendFilletStyle = 'smooth';
  p.guard.ornamentation = 0.1;

  p.handle.length = 0.85;
  p.handle.radiusTop = 0.11;
  p.handle.radiusBottom = 0.11;
  p.handle.segmentation = false;
  p.handle.wrapEnabled = true;
  p.handle.wrapTurns = 6;
  p.handle.wrapDepth = 0.01;
  p.handle.wrapTexture = true;
  p.handle.wrapTexScale = 9;
  p.handle.wrapTexAngle = Math.PI / 6;
  (p.handle as any).ovalRatio = 1.1;

  p.pommel.style = 'scentStopper';
  p.pommel.size = 0.17;
  p.pommel.elongation = 1.2;
  p.pommel.shapeMorph = 0.25;
  p.pommel.facetCount = 20;
  p.pommel.balance = 0.1;

  return p;
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
