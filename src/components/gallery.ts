import { swordPresets } from './presets';

type GalleryMeta = {
  family: string;
  description: string;
};

const galleryMeta: Record<string, GalleryMeta> = {
  'showcase-arming':      { family: 'European',  description: 'Classic medieval one-handed sword with crossguard.' },
  'rapier-cup':           { family: 'European',  description: 'Elegant thrusting sword with protective cup hilt.' },
  'basket-broadsword':    { family: 'European',  description: 'Highland broadsword with basket guard.' },
  'claymore':             { family: 'European',  description: 'Scottish two-handed greatsword with angled quillons.' },
  'arming':               { family: 'European',  description: 'Versatile knightly sword for sword-and-shield combat.' },
  'gladius':              { family: 'European',  description: 'Short Roman infantry sword for close-quarters combat.' },
  'gladius-leaf':         { family: 'European',  description: 'Leaf-bladed gladius with wider cutting profile.' },
  'flamberge-zweihander': { family: 'European',  description: 'Massive flame-bladed two-hander.' },
  'rapier':               { family: 'European',  description: 'Light, nimble dueling blade for precise thrusting.' },
  'sabre':                { family: 'European',  description: 'Curved cavalry sword for mounted slashing.' },
  'kilij':                { family: 'European',  description: 'Ottoman curved sword with widening yelman.' },
  'katana':               { family: 'Japanese',  description: 'Iconic curved Japanese sword with single edge.' },
  'katana-midare':        { family: 'Japanese',  description: 'Katana with irregular midare hamon temper line.' },
  'jian':                 { family: 'Chinese',   description: 'Double-edged straight sword of scholarly tradition.' },
  'jian-scholar':         { family: 'Chinese',   description: 'Refined jian with jade fittings.' },
  'kris':                 { family: 'Southeast Asian', description: 'Wavy-bladed dagger with spiritual significance.' },
  'demon':                { family: 'Fantasy',   description: 'Dark fantasy blade with eldritch energy.' },
  'lightsaber':           { family: 'Sci-Fi',    description: 'Plasma energy blade with transmissive glow.' },
};

const STORAGE_KEY = 'bladegen.galleryDismissed';

export function shouldShowGallery(): boolean {
  try {
    if ((navigator as any).webdriver === true) return false;
    return localStorage.getItem(STORAGE_KEY) !== '1';
  } catch {
    return true;
  }
}

export function dismissGallery(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {}
}

export type GalleryCallbacks = {
  onSelectPreset: (presetId: string) => void;
  onDismiss: () => void;
};

export function createGallery(container: HTMLElement, callbacks: GalleryCallbacks): HTMLElement {
  const gallery = document.createElement('div');
  gallery.id = 'gallery';
  gallery.className = 'gallery';

  // Header
  const header = document.createElement('div');
  header.className = 'gallery-header';
  header.innerHTML = '<h1>Choose Your Blade</h1><p>Select a sword to start customizing, or skip to the full editor.</p>';
  gallery.appendChild(header);

  const skipBtn = document.createElement('button');
  skipBtn.className = 'gallery-skip';
  skipBtn.textContent = 'Skip to Editor';
  skipBtn.addEventListener('click', () => {
    dismissGallery();
    callbacks.onDismiss();
  });
  header.appendChild(skipBtn);

  // Family filter bar
  const families = ['All', ...new Set(
    swordPresets.map(p => galleryMeta[p.id]?.family).filter(Boolean)
  )];
  const filterBar = document.createElement('div');
  filterBar.className = 'gallery-filters';
  let activeFamily = 'All';

  for (const family of families) {
    const btn = document.createElement('button');
    btn.className = 'gallery-filter-btn' + (family === 'All' ? ' active' : '');
    btn.textContent = family;
    btn.addEventListener('click', () => {
      activeFamily = family;
      filterBar.querySelectorAll('.gallery-filter-btn').forEach(b =>
        b.classList.toggle('active', b.textContent === family)
      );
      renderCards();
    });
    filterBar.appendChild(btn);
  }
  gallery.appendChild(filterBar);

  // Card grid
  const grid = document.createElement('div');
  grid.className = 'gallery-grid';
  gallery.appendChild(grid);

  function renderCards() {
    grid.innerHTML = '';
    const filtered = swordPresets.filter(p => {
      if (activeFamily === 'All') return true;
      return galleryMeta[p.id]?.family === activeFamily;
    });

    for (const preset of filtered) {
      const meta = galleryMeta[preset.id] || { family: 'Other', description: preset.label };
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      const tag = document.createElement('span');
      tag.className = 'gallery-tag';
      tag.textContent = meta.family;

      const name = document.createElement('h3');
      name.textContent = preset.label;

      const desc = document.createElement('p');
      desc.textContent = meta.description;

      card.appendChild(tag);
      card.appendChild(name);
      card.appendChild(desc);

      const variantCount = preset.variants?.length || 0;
      if (variantCount > 0) {
        const variants = document.createElement('span');
        variants.className = 'gallery-variants';
        variants.textContent = `${variantCount} look${variantCount > 1 ? 's' : ''}`;
        card.appendChild(variants);
      }

      const select = () => {
        dismissGallery();
        callbacks.onSelectPreset(preset.id);
      };
      card.addEventListener('click', select);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
      });

      grid.appendChild(card);
    }
  }

  renderCards();
  container.appendChild(gallery);
  return gallery;
}
