import { test, expect } from '@playwright/test';

test.describe('Auto Spin persistence', () => {
  test('toggle persists across reloads', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#sidebar');

    // Read initial state via debug API
    const initial = await page.evaluate(() => {
      const dbg = (window as any).__swordDebug;
      return !!dbg?.getAutoSpinEnabled?.();
    });

    // Find the Auto Spin checkbox in the toolbar and toggle it
    const toolbar = page.locator('#toolbar, .toolbar, body');
    const checkbox = page.locator('label:has-text("Auto Spin") input[type="checkbox"]');
    const present = await checkbox.count();
    expect(present).toBeGreaterThan(0);
    await checkbox.scrollIntoViewIfNeeded();
    await checkbox.click();

    const toggled = await page.evaluate(() => {
      const dbg = (window as any).__swordDebug;
      return !!dbg?.getAutoSpinEnabled?.();
    });
    expect(toggled).toBe(!initial);

    // Reload and confirm persistence
    await page.reload();
    await page.waitForSelector('#sidebar');
    const afterReload = await page.evaluate(() => {
      const dbg = (window as any).__swordDebug;
      return !!dbg?.getAutoSpinEnabled?.();
    });
    expect(afterReload).toBe(toggled);

    // Restore original state to avoid affecting subsequent tests
    if (afterReload !== initial) {
      const cb = page.locator('label:has-text("Auto Spin") input[type="checkbox"]');
      await cb.scrollIntoViewIfNeeded();
      await cb.click();
      const restored = await page.evaluate(() => {
        const dbg = (window as any).__swordDebug;
        return !!dbg?.getAutoSpinEnabled?.();
      });
      expect(restored).toBe(initial);
    }
  });
});
