import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';

// Only run on Chromium to keep output consistent and fast
test.skip(({ browserName }) => browserName !== 'chromium', 'Capture runs only on Chromium');

const PRESETS = [
  'showcase-arming',
  'rapier-cup',
  'basket-broadsword',
  "jian-scholar",
  'katana-midare',
  'gladius-leaf',
  'kilij',
  'flamberge-zweihander',
] as const;

async function applyPreset(page, id: string) {
  await page.evaluate(async (presetId) => {
    const sel = Array.from(document.querySelectorAll('select')).find((s) =>
      Array.from((s as HTMLSelectElement).options).some((o) => o.value === presetId)
    ) as HTMLSelectElement | undefined;
    if (sel) {
      sel.value = presetId;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const dbg = (window as any).__swordDebug || {};
    try { dbg.setAutoSpinEnabled?.(false); } catch {}
  }, id);
}

async function hideUI(page) {
  await page.addStyleTag({
    content: `
      header, #sidebar { display: none !important; }
      #app { grid-template-rows: 0 1fr !important; }
      html, body, #app, canvas { margin: 0; padding: 0; height: 100%; }
      canvas#scene { position: fixed !important; inset: 0 !important; width: 100% !important; height: 100% !important; }
    `,
  });
}

test.describe('Capture preset gallery', () => {
  test('takes screenshots for gallery presets', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/?capture=1');
    await page.waitForSelector('#sidebar');
    await hideUI(page);
    // Force resize pass so renderer picks up the full viewport size
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    for (const id of PRESETS) {
      await applyPreset(page, id);
      // Wait for geometry to exist and a couple of RAFs to render
      await page.waitForFunction(() => !!(window as any).__swordDebug?.sword?.bladeMesh);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
      // Read pixels directly via toDataURL to avoid visibility/headless issues
      const dataUrl = await page.evaluate(() => {
        const c = document.getElementById('scene') as HTMLCanvasElement | null;
        if (!c) return null;
        return c.toDataURL('image/jpeg', 0.8);
      });
      await fs.mkdir('public/assets/presets', { recursive: true });
      if (dataUrl && dataUrl.startsWith('data:image')) {
        const base64 = dataUrl.split(',')[1] || '';
        if (base64.length > 2048) {
          await fs.writeFile(`public/assets/presets/${id}.jpg`, Buffer.from(base64, 'base64'));
        } else {
          // Fallback to page clip screenshot if encoded image is suspiciously small
          const rect = await page.evaluate(() => {
            const el = document.getElementById('scene') as HTMLCanvasElement | null;
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          });
          if (!rect) throw new Error('Canvas not found');
          await page.screenshot({
            path: `public/assets/presets/${id}.jpg`,
            type: 'jpeg',
            quality: 80,
            clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          });
        }
      } else {
        // Absolute fallback
        await page.screenshot({ path: `public/assets/presets/${id}.jpg`, type: 'jpeg', quality: 80 });
      }
    }
    // Sanity check that at least the first file exists via page route
    const ok = await page.evaluate(async () => {
      const res = await fetch('assets/presets/showcase-arming.jpg');
      return res.ok;
    });
    expect(ok).toBe(true);
  });
});
