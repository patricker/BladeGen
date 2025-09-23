import { test, expect } from '@playwright/test';

test.describe('Editor sanity flow', () => {
  test('select preset, tweak blade, export assets', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });

    await page.goto('/');
    await page.waitForSelector('#sidebar');

    const initialLength = await page.evaluate(
      () => (window as any).__swordDebug?.sword?.lastParams?.blade?.length ?? null
    );
    expect(initialLength).not.toBeNull();

    const presetSelect = page.locator('select:has(option[value="arming"])');
    await presetSelect.selectOption('arming');

    await expect
      .poll(async () => {
        return await page.evaluate(
          () => (window as any).__swordDebug?.sword?.lastParams?.guard?.style ?? null
        );
      })
      .toBe('bar');

    const lengthSlider = page.locator('[data-field="blade.length"] input[type="range"]');
    await lengthSlider.evaluate((input) => {
      const el = input as HTMLInputElement;
      el.value = '3.1';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect
      .poll(async () => {
        return await page.evaluate(
          () => (window as any).__swordDebug?.sword?.lastParams?.blade?.length ?? 0
        );
      })
      .toBeCloseTo(3.1, 2);

    const exportButton = page.locator('button:has-text("Export ▾")');
    const targets = [{ label: 'GLB', name: 'sword.glb' }] as const;

    const sidebar = page.locator('#sidebar');
    await sidebar.evaluate((el) => {
      el.scrollTo({ top: 0 });
    });

    for (const { label, name } of targets) {
      await expect(exportButton).toBeEnabled();
      await exportButton.scrollIntoViewIfNeeded();
      await exportButton.click({ timeout: 2000 });
      const item = page.locator(`.menu button:has-text("${label}")`);
      await expect(item).toBeVisible();
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }),
        item.click(),
      ]);
      expect(await download.suggestedFilename()).toBe(name);
      const stream = await download.createReadStream();
      if (stream) {
        stream.resume();
        await new Promise((resolve) => stream.on('end', resolve));
      }
    }

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
