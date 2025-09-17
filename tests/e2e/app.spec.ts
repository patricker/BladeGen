import { test, expect } from '@playwright/test';

test.describe('SwordMaker smoke', () => {
  test('renders main UI without runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(`pageerror: ${error.message}`);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(`console: ${message.text()}`);
      }
    });

    await page.goto('/');

    await expect(page).toHaveTitle(/SwordMaker/i);
    await expect(page.locator('#sidebar')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
