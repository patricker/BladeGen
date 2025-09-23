import type { Part, MatExt, MaterialVariant } from './types';
import { PARTS } from './types';

export type LooksStateRefs = {
  matVariants: MaterialVariant[];
  currentVariantId: string | null;
  baseSnapshot: Record<Part, MatExt> | null;
};

export type AttachLooksPanelOptions = {
  section: HTMLElement;
  lookSelect: HTMLSelectElement;
  matState: Record<Part, MatExt>;
  stateRefs: LooksStateRefs;
  applyMaterialStateToRenderer: (part: Part, state: MatExt) => void;
  syncAllMaterialInputs: () => void;
  rerender: () => void;
};

export type LooksPanelApi = {
  applyLook: (variantId: string | null) => void;
  renderVariantList: () => void;
  syncLookDropdown: () => void;
};

export function attachLooksPanel(opts: AttachLooksPanelOptions): LooksPanelApi {
  const {
    section,
    lookSelect,
    matState,
    stateRefs,
    applyMaterialStateToRenderer,
    syncAllMaterialInputs,
    rerender,
  } = opts;

  const { matVariants } = stateRefs;
  const BASE_LOOK_VALUE = '__base';

  // Toolbar dropdown handler
  lookSelect.addEventListener('change', () => {
    const value = lookSelect.value === BASE_LOOK_VALUE ? null : lookSelect.value;
    api.applyLook(value);
  });

  // Controls UI
  const variantControls = document.createElement('div');
  variantControls.className = 'row full';
  const variantDescWrapper = document.createElement('div');
  variantDescWrapper.className = 'row full';

  const variantNameInput = document.createElement('input');
  variantNameInput.type = 'text';
  variantNameInput.placeholder = 'Variant name (e.g. Brushed Steel)';
  variantNameInput.style.width = '60%';
  variantNameInput.style.marginRight = '4px';
  const variantDescInput = document.createElement('input');
  variantDescInput.type = 'text';
  variantDescInput.placeholder = 'Optional description';
  variantDescInput.style.width = '60%';
  variantDescInput.style.margin = '4px 0';
  const saveVariantBtn = document.createElement('button');
  saveVariantBtn.textContent = 'Save Variant';
  const clearVariantsBtn = document.createElement('button');
  clearVariantsBtn.textContent = 'Clear All';
  clearVariantsBtn.style.marginLeft = '4px';
  variantControls.appendChild(variantNameInput);
  variantControls.appendChild(saveVariantBtn);
  variantControls.appendChild(clearVariantsBtn);
  variantDescWrapper.appendChild(variantDescInput);
  section.appendChild(variantControls);
  section.appendChild(variantDescWrapper);

  const variantList = document.createElement('div');
  variantList.className = 'variant-list';
  variantList.style.marginTop = '6px';
  section.appendChild(variantList);

  const cloneMaterial = (src: MatExt): MatExt => JSON.parse(JSON.stringify(src));

  const applyLook = (variantId: string | null) => {
    if (variantId === stateRefs.currentVariantId) {
      syncLookDropdown();
      return;
    }

    if (variantId === null) {
      if (stateRefs.currentVariantId !== null && stateRefs.baseSnapshot) {
        for (const part of PARTS) {
          matState[part] = cloneMaterial(stateRefs.baseSnapshot[part]);
          applyMaterialStateToRenderer(part, matState[part]);
        }
      }
      stateRefs.currentVariantId = null;
      stateRefs.baseSnapshot = null;
      syncAllMaterialInputs();
      renderVariantList();
      syncLookDropdown();
      rerender();
      return;
    }

    const variant = matVariants.find((v) => v.id === variantId);
    if (!variant) return;

    if (stateRefs.currentVariantId === null) {
      stateRefs.baseSnapshot = PARTS.reduce(
        (acc, part) => {
          acc[part] = cloneMaterial(matState[part]);
          return acc;
        },
        {} as Record<Part, MatExt>
      );
    }

    const baseSource =
      stateRefs.baseSnapshot ??
      PARTS.reduce(
        (acc, part) => {
          acc[part] = cloneMaterial(matState[part]);
          return acc;
        },
        {} as Record<Part, MatExt>
      );

    for (const part of PARTS) {
      matState[part] = cloneMaterial(baseSource[part]);
      applyMaterialStateToRenderer(part, matState[part]);
    }

    for (const part of Object.keys(variant.parts || {}) as Part[]) {
      const overrides = variant.parts[part];
      if (!overrides) continue;
      matState[part] = {
        ...cloneMaterial(matState[part]),
        ...JSON.parse(JSON.stringify(overrides)),
      } as MatExt;
      applyMaterialStateToRenderer(part, matState[part]);
    }

    stateRefs.currentVariantId = variant.id;
    syncAllMaterialInputs();
    renderVariantList();
    syncLookDropdown();
    rerender();
  };

  const renderVariantList = () => {
    variantList.innerHTML = '';
    if (matVariants.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No variants saved';
      empty.style.fontSize = '12px';
      empty.style.color = '#94a3b8';
      variantList.appendChild(empty);
      clearVariantsBtn.disabled = true;
      syncLookDropdown();
      return;
    }
    clearVariantsBtn.disabled = false;
    for (const variant of matVariants) {
      const row = document.createElement('div');
      row.className = 'variant-row';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '8px';
      row.style.padding = '2px 0';
      const label = document.createElement('div');
      label.style.flex = '1 1 auto';
      label.style.minWidth = '0';
      const name = document.createElement('div');
      name.textContent = variant.name;
      name.style.fontWeight = '600';
      const desc = document.createElement('div');
      desc.textContent = variant.description || '';
      desc.style.fontSize = '12px';
      desc.style.color = '#9aa4b2';
      label.appendChild(name);
      if (variant.description) label.appendChild(desc);
      row.appendChild(label);
      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '6px';
      const applyBtn = document.createElement('button');
      applyBtn.textContent = stateRefs.currentVariantId === variant.id ? 'Applied' : 'Apply';
      applyBtn.disabled = stateRefs.currentVariantId === variant.id;
      applyBtn.addEventListener('click', () => {
        applyLook(variant.id);
      });
      const updateBtn = document.createElement('button');
      updateBtn.textContent = 'Update';
      updateBtn.title = 'Overwrite with current materials';
      updateBtn.addEventListener('click', () => {
        const parts: Partial<Record<Part, MatExt>> = {};
        for (const part of PARTS) {
          parts[part] = JSON.parse(JSON.stringify(matState[part]));
        }
        variant.parts = parts;
        if (stateRefs.currentVariantId === variant.id) {
          applyLook(variant.id);
        } else {
          renderVariantList();
        }
      });
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '✕';
      deleteBtn.title = 'Remove variant';
      deleteBtn.addEventListener('click', () => {
        const idx = matVariants.findIndex((v) => v.id === variant.id);
        if (idx >= 0) matVariants.splice(idx, 1);
        if (stateRefs.currentVariantId === variant.id) {
          applyLook(null);
        } else {
          renderVariantList();
        }
      });
      actions.appendChild(applyBtn);
      actions.appendChild(updateBtn);
      actions.appendChild(deleteBtn);
      row.appendChild(actions);
      variantList.appendChild(row);
    }
    syncLookDropdown();
  };

  const syncLookDropdown = () => {
    lookSelect.innerHTML = '';
    const baseOption = new Option('Look: Base', BASE_LOOK_VALUE);
    lookSelect.appendChild(baseOption);
    for (const variant of matVariants) {
      const opt = new Option(variant.name, variant.id);
      lookSelect.appendChild(opt);
    }
    lookSelect.disabled = matVariants.length === 0;
    lookSelect.value = stateRefs.currentVariantId ?? BASE_LOOK_VALUE;
  };

  const captureVariant = () => {
    const name = variantNameInput.value.trim() || `Variant ${matVariants.length + 1}`;
    const desc = variantDescInput.value.trim() || undefined;
    const parts: Partial<Record<Part, MatExt>> = {};
    for (const part of PARTS) {
      parts[part] = JSON.parse(JSON.stringify(matState[part]));
    }
    matVariants.push({
      id: `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      description: desc,
      parts,
    });
    variantNameInput.value = '';
    variantDescInput.value = '';
    renderVariantList();
  };

  saveVariantBtn.addEventListener('click', captureVariant);
  clearVariantsBtn.addEventListener('click', () => {
    if (!matVariants.length) return;
    if (!confirm('Remove all saved variants?')) return;
    matVariants.splice(0, matVariants.length);
    applyLook(null);
  });

  // Initial sync
  renderVariantList();

  const api: LooksPanelApi = { applyLook, renderVariantList, syncLookDropdown };
  return api;
}
