// Minimal loader for Driver.js via CDN with CSS
// Prefers existing global Driver if already present

const CDN_JS = 'https://cdn.jsdelivr.net/npm/driver.js@1.3.3/dist/driver.min.js';
const CDN_CSS = 'https://cdn.jsdelivr.net/npm/driver.js@1.3.3/dist/driver.min.css';
const LOCAL_JS = '/vendor/driver.min.js';
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
  if (g.Driver) {
    ensureCss();
    return g.Driver;
  }
  if (g.driver || g.driverJs) {
    ensureCss();
    return g.driver || g.driverJs;
  }
  ensureCss();
  // Load script tag (prefer local vendor; fallback to CDN)
  const id = 'driverjs-script';
  if (!document.getElementById(id)) {
    const s = document.createElement('script');
    s.id = id;
    s.src = LOCAL_JS;
    s.async = true;
    s.onerror = () => {
      s.src = CDN_JS;
    };
    document.head.appendChild(s);
  }
  await new Promise<void>((resolve, reject) => {
    const check = () => {
      if ((window as any).Driver) resolve();
      else setTimeout(check, 40);
    };
    setTimeout(check, 40);
    setTimeout(() => reject(new Error('Driver.js load timeout')), 10000);
  }).catch(() => {});
  return (window as any).Driver || (window as any).driver || (window as any).driverJs;
}
