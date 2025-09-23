type ControlType = 'slider' | 'select' | 'checkbox' | 'color' | 'text';

type ControlHandle = {
  field: string;
  row: HTMLElement;
  section: string;
  label: string;
  type: ControlType;
  setValue: (value: unknown) => void;
};

function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '') || 'field'
  );
}

export class ControlRegistry {
  private controls = new Map<string, ControlHandle>();
  private bySectionLabel = new Map<string, ControlHandle>();

  registerControl(
    parent: HTMLElement,
    row: HTMLElement,
    label: string,
    type: ControlType,
    setValue: (value: unknown) => void,
    fieldOverride?: string
  ) {
    const section = this.resolveSectionSlug(parent);
    const labelSlug = slugify(label);
    const field = fieldOverride || `${section}.${labelSlug}`;
    row.dataset.field = field;
    // Dev-only: collect all control ids for help coverage
    try {
      if ((import.meta as any)?.env?.DEV) {
        const w = window as any;
        w.__smkAllFields = w.__smkAllFields || new Set();
        w.__smkAllFields.add(field);
      }
    } catch {}
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
    if (!(lab as any).dataset?.warnOriginalTitle) {
      (lab as any).dataset.warnOriginalTitle = lab.title || '';
    }
    if (on) {
      lab.style.color = '#eab308';
      if (tooltip) {
        lab.title = tooltip;
      } else {
        lab.title = (lab as any).dataset.warnOriginalTitle || '';
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
      lab.title = (lab as any).dataset.warnOriginalTitle || '';
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
      if ((current as any).dataset && (current as any).dataset.fieldNamespace) {
        return (current as any).dataset.fieldNamespace;
      }
      current = current.parentElement;
    }
    return undefined;
  }
}
