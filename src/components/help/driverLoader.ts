// Minimal loader for Driver.js via CDN with CSS
// Prefers existing global Driver if already present

// Prefer ESM build for modern browsers; fallback to older UMD only if needed
const CDN_ESM = 'https://cdn.jsdelivr.net/npm/driver.js@1.3.6/dist/driver.js.mjs';
const CDN_CSS = 'https://cdn.jsdelivr.net/npm/driver.js@1.3.6/dist/driver.min.css';
const LOCAL_ESM = '/vendor/driver.mjs';
const LOCAL_CSS = '/vendor/driver.min.css';

function ensureCss(): void {
  if (document.getElementById('driverjs-css')) return;
  const link = document.createElement('link');
  link.id = 'driverjs-css';
  link.rel = 'stylesheet';
  // Prefer local vendor copy; fallback to CDN on error
  link.href = LOCAL_CSS;
  link.onerror = () => {
    link.href = CDN_CSS;
  };
  document.head.appendChild(link);
}

export async function loadDriver(): Promise<any> {
  const g: any = window as any;
  if (g.Driver || g.driver || g.driverJs) {
    ensureCss();
    return g.Driver || g.driver || g.driverJs;
  }
  ensureCss();
  // Avoid importing from /public in source — inject a module script that imports
  // the vendored ESM and assigns a global for consumers.
  if (!g.__smkDriverInjecting) {
    g.__smkDriverInjecting = true;
    const s = document.createElement('script');
    s.type = 'module';
    s.textContent = `
      (async () => {
        try {
          const mod = await import('${LOCAL_ESM}');
          const drv = mod.driver || mod.default || mod.Driver;
          window.driver = drv;
          window.Driver = window.Driver || drv;
        } catch (err) {
          try {
            const mod = await import('${CDN_ESM}');
            const drv = mod.driver || mod.default || mod.Driver;
            window.driver = drv;
            window.Driver = window.Driver || drv;
          } catch (e) {
            // leave globals undefined; caller will see null and can handle
          }
        }
      })();
    `;
    document.head.appendChild(s);
  }
  // Poll for the global to appear
  for (let i = 0; i < 60; i++) {
    const drv = g.Driver || g.driver || g.driverJs;
    if (drv) return drv;
    await new Promise((r) => setTimeout(r, 50));
  }
  return g.Driver || g.driver || g.driverJs;
}
