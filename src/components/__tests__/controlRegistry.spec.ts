import { describe, it, expect, beforeEach } from 'vitest';
import { ControlRegistry } from '../controls';

class ElementStub {
  tagName: string;
  children: ElementStub[] = [];
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  parentElement: ElementStub | null = null;
  textContent: string | null = null;
  title = '';
  private _className = '';

  constructor(tag: string) {
    this.tagName = tag.toUpperCase();
  }

  appendChild(child: ElementStub) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  insertAdjacentElement(_position: string, child: ElementStub) {
    return this.appendChild(child);
  }

  querySelector(selector: string): ElementStub | null {
    const matches = (el: ElementStub) => {
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        return el.className === cls;
      }
      return el.tagName === selector.toUpperCase();
    };
    for (const child of this.children) {
      if (matches(child)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }

  remove() {
    if (!this.parentElement) return;
    const idx = this.parentElement.children.indexOf(this);
    if (idx >= 0) this.parentElement.children.splice(idx, 1);
    this.parentElement = null;
  }

  set className(value: string) {
    this._className = value;
  }

  get className() {
    return this._className;
  }
}

describe('ControlRegistry', () => {
  let registry: ControlRegistry;
  let parent: HTMLElement;
  let row: HTMLElement;
  let label: HTMLLabelElement;
  let recorded: unknown;

  beforeEach(() => {
    registry = new ControlRegistry();
    (globalThis as any).document = {
      createElement: (tag: string) => new ElementStub(tag),
    };
    parent = document.createElement('div') as unknown as HTMLElement;
    parent.dataset.fieldNamespace = 'test-section';
    row = document.createElement('div') as unknown as HTMLElement;
    row.className = 'row';
    label = document.createElement('label') as unknown as HTMLLabelElement;
    label.textContent = 'Field';
    row.appendChild(label);
    parent.appendChild(row);
    recorded = undefined;
    registry.registerControl(parent, row, 'Field', 'slider', (value) => {
      recorded = value;
    });
  });

  it('updates registered control value', () => {
    registry.setValue('test-section', 'Field', 42);
    expect(recorded).toBe(42);
  });

  it('applies and clears warnings', () => {
    registry.setWarning('test-section', 'Field', true, 'Be careful');
    const icon = row.querySelector('.warn-icon');
    expect(icon).not.toBeNull();
    expect(label.style.color.toLowerCase()).toContain('eab308');
    expect(label.title).toBe('Be careful');

    registry.clearWarnings();
    expect(row.querySelector('.warn-icon')).toBeNull();
    expect(label.style.color).toBe('');
  });
});
