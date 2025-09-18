import { test } from '@playwright/test';

test('fog status before/after preset', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#sidebar');

  const fogBefore = await page.evaluate(() => {
    const scene = (window as any).__swordDebug?.scene as any;
    const fog = scene?.fog;
    if (!fog) return null;
    return { density: fog.density, color: fog.color?.getHexString?.() };
  });
  console.log('fog before', fogBefore);

  const presetSelect = page.locator('select:has(option[value="katana"])');
  await presetSelect.selectOption('katana');
  await page.waitForTimeout(500);

  const fogAfter = await page.evaluate(() => {
    const scene = (window as any).__swordDebug?.scene as any;
    const fog = scene?.fog;
    if (!fog) return null;
    return { density: fog.density, color: fog.color?.getHexString?.() };
  });
  console.log('fog after', fogAfter);
});
