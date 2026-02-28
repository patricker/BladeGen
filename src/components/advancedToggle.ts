const ADVANCED_KEY = 'bladegen.ui.showAdvanced';
const GALLERY_KEY = 'bladegen.galleryDismissed';

export function getAdvancedMode(): boolean {
  try {
    const val = localStorage.getItem(ADVANCED_KEY);
    if (val === null) {
      // Default: show advanced for existing users (who skipped gallery)
      // New users from gallery start in basic mode
      return localStorage.getItem(GALLERY_KEY) !== '1';
    }
    return val === '1';
  } catch {
    return true;
  }
}

export function setAdvancedMode(on: boolean): void {
  try {
    localStorage.setItem(ADVANCED_KEY, on ? '1' : '0');
  } catch {}
}

export function attachAdvancedToggle(
  section: HTMLElement,
  onToggle: (showAdvanced: boolean) => void
): HTMLInputElement {
  const h2 = section.querySelector('h2');
  if (!h2) throw new Error('Section missing h2');

  const wrap = document.createElement('label');
  wrap.className = 'advanced-toggle';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = getAdvancedMode();
  cb.setAttribute('aria-label', 'Show advanced controls');

  const label = document.createElement('span');
  label.textContent = 'Advanced';

  wrap.appendChild(cb);
  wrap.appendChild(label);
  h2.appendChild(wrap);

  // Prevent click on toggle from collapsing section
  wrap.addEventListener('click', (e) => e.stopPropagation());

  cb.addEventListener('change', () => {
    const on = cb.checked;
    setAdvancedMode(on);
    onToggle(on);
  });

  // Initial state
  onToggle(cb.checked);

  return cb;
}
