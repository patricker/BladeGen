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
  if (g.Driver) {
    ensureCss();
    return g.Driver;
  }
  if (g.driver || g.driverJs) {
    ensureCss();
    return g.driver || g.driverJs;
  }
  ensureCss();
  // Try ESM dynamic import (local vendored first, then CDN)
  try {
    // @vite-ignore to allow external/absolute import path
    const mod: any = await import(/* @vite-ignore */ LOCAL_ESM);
    if (mod?.driver) {
      const Wrapper: any = function (opts?: any) {
        return mod.driver(opts);
      };
      return Wrapper;
    }
    return mod?.Driver || mod?.default || mod;
  } catch {}
  try {
    const mod: any = await import(/* @vite-ignore */ CDN_ESM);
    if (mod?.driver) {
      const Wrapper: any = function (opts?: any) {
        return mod.driver(opts);
      };
      return Wrapper;
    }
    return mod?.Driver || mod?.default || mod;
  } catch {}
  // As a last resort, poll for any global that may have been provided by other means
  await new Promise<void>((resolve) => setTimeout(resolve, 200));
  return (window as any).Driver || (window as any).driver || (window as any).driverJs;
}
