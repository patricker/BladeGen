import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

// Only run on Chromium for consistency
test.skip(({ browserName }) => browserName !== 'chromium', 'Visual audit runs only on Chromium');

const ALL_PRESETS = [
  'showcase-arming',
  'rapier-cup',
  'basket-broadsword',
  'jian-scholar',
  'katana-midare',
  'gladius-leaf',
  'kilij',
  'flamberge-zweihander',
  'katana',
  'arming',
  'gladius',
  'jian',
  'claymore',
  'rapier',
  'demon',
  'lightsaber',
  'sabre',
];

// Camera angles: [azimuth_deg, polar_deg, distance]
const ANGLES = [
  { name: 'front', az: 0, polar: 75, dist: 6 },
  { name: 'side', az: 90, polar: 75, dist: 6 },
  { name: 'top', az: 0, polar: 10, dist: 7 },
] as const;

const OUT_DIR = 'test-results/visual-audit';

async function applyPreset(page: any, id: string) {
  await page.evaluate(async (presetId: string) => {
    const sel = document.querySelector('#preset-selector') as HTMLSelectElement | null
      ?? Array.from(document.querySelectorAll('select')).find((s) =>
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

async function waitForRender(page: any) {
  await page.waitForFunction(
    () => {
      const d = (window as any).__swordDebug;
      return !!(d?.sword?.bladeMesh && d?.renderer && d?.camera);
    },
    { timeout: 15_000 }
  );
  await page.evaluate(() => new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  ));
  await page.waitForTimeout(200);
}

/**
 * Atomic pose + render + capture in a single synchronous JS evaluation.
 * This avoids the animation loop overriding the pose between calls.
 * Uses gl.readPixels (which works without preserveDrawingBuffer when called
 * synchronously after render) to get the raw pixel data.
 */
async function poseRenderCapture(
  page: any,
  az: number,
  polar: number,
  dist: number
): Promise<string> {
  return page.evaluate(({ az, polar, dist }: { az: number; polar: number; dist: number }) => {
    const dbg = (window as any).__swordDebug;
    if (!dbg?.sword || !dbg?.camera || !dbg?.renderer) {
      throw new Error('Debug API not available');
    }

    // 1. Pose: rotate sword, position camera
    dbg.sword.group.rotation.y = az * Math.PI / 180;
    const polarRad = polar * Math.PI / 180;
    const target = dbg.controls.target;
    dbg.camera.position.set(
      target.x,
      target.y + dist * Math.cos(polarRad),
      target.z + dist * Math.sin(polarRad)
    );
    dbg.camera.lookAt(target);

    // 2. Render one frame
    const renderer = dbg.renderer;
    if (dbg.composer) {
      dbg.composer.render();
    } else {
      renderer.render(dbg.scene, dbg.camera);
    }

    // 3. Read pixels synchronously (must be in same task as render)
    const gl = renderer.getContext() as WebGLRenderingContext;
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // 4. Flip vertically (WebGL Y=0 is bottom) and encode as PNG via offscreen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx2d = offscreen.getContext('2d')!;
    const imageData = ctx2d.createImageData(w, h);
    for (let row = 0; row < h; row++) {
      const srcOff = (h - 1 - row) * w * 4;
      const dstOff = row * w * 4;
      imageData.data.set(pixels.subarray(srcOff, srcOff + w * 4), dstOff);
    }
    ctx2d.putImageData(imageData, 0, 0);
    return offscreen.toDataURL('image/png');
  }, { az, polar, dist });
}

test.describe('Visual audit — all presets at multiple angles', () => {
  test('capture all presets', async ({ page }) => {
    test.setTimeout(120_000);

    await fs.mkdir(OUT_DIR, { recursive: true });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForSelector('#sidebar', { timeout: 15_000 });

    // Dismiss gallery if present
    await page.evaluate(() => {
      try { localStorage.setItem('bladegen-gallery-seen', '1'); } catch {}
      const gal = document.querySelector('.gallery') as HTMLElement | null;
      if (gal) gal.remove();
    });

    await waitForRender(page);

    const results: Array<{ preset: string; angle: string; file: string; size: number }> = [];

    for (const presetId of ALL_PRESETS) {
      await applyPreset(page, presetId);
      await waitForRender(page);

      for (const angle of ANGLES) {
        const dataUrl = await poseRenderCapture(page, angle.az, angle.polar, angle.dist);
        const base64 = dataUrl.split(',')[1] || '';
        const buf = Buffer.from(base64, 'base64');
        const filename = `${presetId}_${angle.name}.png`;
        const filepath = path.join(OUT_DIR, filename);
        await fs.writeFile(filepath, buf);

        results.push({
          preset: presetId,
          angle: angle.name,
          file: filepath,
          size: buf.length,
        });
      }
    }

    // Write manifest
    await fs.writeFile(
      path.join(OUT_DIR, 'manifest.json'),
      JSON.stringify(results, null, 2)
    );

    // Sanity: every image should be >5KB (not blank)
    const tooSmall = results.filter((r) => r.size < 5000);
    if (tooSmall.length) {
      console.warn('Suspiciously small images (possible blank render):', tooSmall);
    }
    expect(tooSmall.length).toBe(0);

    console.log(`Captured ${results.length} screenshots across ${ALL_PRESETS.length} presets`);
  });
});
