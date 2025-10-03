import { test, expect } from '@playwright/test';

test.describe('Engraving controls', () => {
  test('add engraving, switch to shape, knobs update geometry', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });

    await page.goto('/');
    await page.waitForSelector('#sidebar');

    // Ensure Engravings section is visible (Model tab is default active)
    const addBtn = page.locator('button:has-text("Add Engraving")');
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();

    // Wait for an engraving group to appear on the sword
    await expect
      .poll(async () => {
        return await page.evaluate(() => !!(window as any).__swordDebug?.sword?.engravingGroup);
      })
      .toBe(true);

    // Switch type to 'shape' to avoid font loading paths
    const typeRow = page.locator('[data-field="engravings.engrave-type"] select');
    await typeRow.scrollIntoViewIfNeeded();
    await typeRow.selectOption('shape');
    await expect(typeRow).toHaveValue('shape');

    // Helper to read first engraving mesh info
    const readFirstMesh = async () =>
      await page.evaluate(() => {
        const g = (window as any).__swordDebug?.sword?.engravingGroup as any;
        if (!g) return null;
        let first: any = null;
        g.traverse((o: any) => {
          if (!first && o && o.isMesh) first = o;
        });
        if (!first) return null;
        const geom: any = first.geometry;
        return {
          type: geom?.type || null,
          params: geom?.parameters || null,
          x: first.position?.x ?? null,
        };
      });

    // Initial width should reflect default (0.1 for Add Engraving)
    let info = await readFirstMesh();
    expect(info).toBeTruthy();
    expect(info!.type).toBe('BoxGeometry');
    expect(info!.params?.width).toBeCloseTo(0.1, 3);

    // Increase Engrave Width and verify geometry parameter updates
    const wNum = page.locator('[data-field="engravings.engrave-width"] input[type="number"]');
    await wNum.scrollIntoViewIfNeeded();
    await wNum.fill('0.18');
    await wNum.blur();

    await expect
      .poll(async () => {
        const ii = await readFirstMesh();
        return ii?.params?.width ?? null;
      })
      .toBeCloseTo(0.18, 3);

    // Change side to both and ensure we now have 2+ meshes
    const sideSel = page.locator('[data-field="engravings.engrave-side"] select');
    await sideSel.scrollIntoViewIfNeeded();
    await sideSel.selectOption('both');
    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const g = (window as any).__swordDebug?.sword?.engravingGroup as any;
          if (!g) return 0;
          let count = 0;
          g.traverse((o: any) => {
            if (o && o.isMesh) count++;
          });
          return count;
        });
      })
      .toBeGreaterThanOrEqual(2);

    // Shift offsetX slightly and verify position.x changes
    const xNum = page.locator('[data-field="engravings.engrave-offsetx"] input[type="number"]');
    await xNum.scrollIntoViewIfNeeded();
    const xBefore = (await readFirstMesh())!.x as number;
    await xNum.fill('0.05');
    await xNum.blur();
    await expect
      .poll(async () => (await readFirstMesh())?.x ?? null)
      .toBeGreaterThan(xBefore);

    expect(errors, errors.join('\n')).toEqual([]);
  });
});

