import { loadDriver } from './driverLoader';

type Step = { selector?: string; title: string; body?: string };

function toDriverSteps(def: Step[]) {
  return def.map((s) => ({
    element: s.selector || 'body',
    popover: { title: s.title, description: s.body || '', side: 'bottom', align: 'start' },
  }));
}

export async function startIntroTourDriver() {
  const Driver: any = await loadDriver();
  if (!Driver) throw new Error('Driver.js not available');
  const driver = new Driver({ allowClose: true, overlayOpacity: 0.45 });
  const def: Step[] = [
    {
      selector: '#scene',
      title: 'Viewport',
      body: 'Drag to orbit. Mouse wheel to zoom. Use Auto Spin for turntable.',
    },
    { selector: '.tabs', title: 'Tabs', body: 'Switch between Model and Render controls.' },
    {
      selector: '#sidebar .row',
      title: 'Controls',
      body: 'Hover labels for micro-tooltips; click ? for details and related topics.',
    },
    {
      selector: '.toolbar .dropdown',
      title: 'Export',
      body: 'Export GLB/OBJ/STL, plus SVG blueprint.',
    },
    {
      selector: '.toolbar button',
      title: 'Help',
      body: 'Open Help (Cmd/Ctrl+/). Search with Cmd/Ctrl+K.',
    },
    {
      selector: '.toolbar button',
      title: 'Explain Mode',
      body: 'Toggle labels in the viewport with the Explain button or press E.',
    },
  ];
  driver.defineSteps(toDriverSteps(def));
  try {
    (window as any).__smkHelpEvents = (window as any).__smkHelpEvents || [];
    (window as any).__smkHelpEvents.push({
      t: Date.now(),
      event: 'help.tour_started',
      data: { lib: 'driver.js' },
    });
  } catch {}
  driver.start();
}

export async function startAddFullerTourDriver() {
  const Driver: any = await loadDriver();
  if (!Driver) throw new Error('Driver.js not available');
  const driver = new Driver({ allowClose: true, overlayOpacity: 0.45 });
  const def: Step[] = [
    {
      selector: '#sidebar [data-field^="blade"]',
      title: 'Blade controls',
      body: 'Locate blade controls in the Model tab.',
    },
    {
      selector: '#sidebar [data-field="blade.fuller-mode"]',
      title: 'Fuller Mode',
      body: 'Choose Overlay for visuals or Carve for a true groove.',
    },
    {
      selector: '#sidebar [data-field="blade.fuller-width"]',
      title: 'Width',
      body: 'Adjust groove width; use slots for multiple grooves.',
    },
    {
      selector: '#sidebar [data-field="blade.fuller-profile"]',
      title: 'Profile',
      body: 'Pick U, V, or flat-bottom.',
    },
  ];
  driver.defineSteps(toDriverSteps(def));
  try {
    (window as any).__smkHelpEvents?.push({
      t: Date.now(),
      event: 'help.tour_started',
      data: { lib: 'driver.js', task: 'add-fuller' },
    });
  } catch {}
  driver.start();
}

export async function startLeafBladeTourDriver() {
  const Driver: any = await loadDriver();
  if (!Driver) throw new Error('Driver.js not available');
  const driver = new Driver({ allowClose: true, overlayOpacity: 0.45 });
  const def: Step[] = [
    {
      selector: '#sidebar [data-field="blade.tip-shape"]',
      title: 'Tip Shape',
      body: 'Choose Leaf to unlock the bulge control.',
    },
    {
      selector: '#sidebar [data-field="blade.leaf-bulge"]',
      title: 'Leaf Bulge',
      body: 'Increase bulge to create a leaf-shaped outline.',
    },
    {
      selector: '#sidebar [data-field^="blade.taper-"]',
      title: 'Taper',
      body: 'Adjust distal taper to balance mass and stiffness.',
    },
  ];
  driver.defineSteps(toDriverSteps(def));
  try {
    (window as any).__smkHelpEvents?.push({
      t: Date.now(),
      event: 'help.tour_started',
      data: { lib: 'driver.js', task: 'leaf-blade' },
    });
  } catch {}
  driver.start();
}

export async function startExportStlTourDriver() {
  const Driver: any = await loadDriver();
  if (!Driver) throw new Error('Driver.js not available');
  const driver = new Driver({ allowClose: true, overlayOpacity: 0.45 });
  const def: Step[] = [
    {
      selector: '.toolbar .dropdown',
      title: 'Export Menu',
      body: 'Open the Export menu to choose a format.',
    },
    {
      selector: '.toolbar .dropdown .menu',
      title: 'Export STL',
      body: 'Click STL to export a printable mesh.',
    },
    {
      selector: '#sidebar',
      title: 'Tip',
      body: 'For colored materials and variants, prefer exporting GLB (GLTF).',
    },
  ];
  driver.defineSteps(toDriverSteps(def));
  try {
    (window as any).__smkHelpEvents?.push({
      t: Date.now(),
      event: 'help.tour_started',
      data: { lib: 'driver.js', task: 'export-stl' },
    });
  } catch {}
  driver.start();
}
