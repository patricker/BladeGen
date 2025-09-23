import { test, expect } from '@playwright/test';

const VALID_PAYLOAD = {
  $schema: 'schema/sword.schema.json',
  version: 4,
  model: {
    blade: { length: 3, baseWidth: 0.25, tipWidth: 0.05, thickness: 0.08, curvature: 0 },
    hiltEnabled: true,
    guardEnabled: true,
    guard: { width: 1.2, thickness: 0.2, curve: 0, tilt: 0, style: 'winged' },
    handle: { length: 0.9, radiusTop: 0.12, radiusBottom: 0.12 },
    pommel: { size: 0.16, elongation: 1, style: 'orb' },
  },
  materials: {
    blade: { color: '#eeeeee', metalness: 0.9, roughness: 0.2 },
    guard: { color: '#888888', metalness: 0.6, roughness: 0.4 },
    handle: { color: '#333333', metalness: 0.1, roughness: 0.8 },
    pommel: { color: '#bbbbbb', metalness: 0.7, roughness: 0.3 },
  },
  render: {
    exposure: 1,
    ambient: 0.4,
    keyIntensity: 2,
    keyAz: 40,
    keyEl: 40,
    rimIntensity: 0.6,
    rimAz: -135,
    rimEl: 25,
    bgColor: '#0f1115',
    bloomEnabled: false,
  },
};

const INVALID_PAYLOAD = {
  $schema: 'schema/sword.schema.json',
  version: 4,
  model: {
    blade: { length: -1 },
  },
};

test.describe('JSON import', () => {
  test('accepts valid payload and rejects invalid payload with alert message', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#sidebar');
    await page.evaluate(() => {
      (window as any).__importAlerts = [] as string[];
      window.alert = (msg: unknown) => {
        const arr = (window as any).__importAlerts as string[];
        arr.push(String(msg));
      };
    });

    const uploadInput = page.locator('input[type="file"][accept="application/json"]');

    const makeFile = (name: string, payload: unknown) => ({
      name,
      mime: 'application/json',
      buffer: Buffer.from(JSON.stringify(payload)),
    });

    await uploadInput.setInputFiles(makeFile('valid.json', VALID_PAYLOAD));
    await expect
      .poll(async () => await uploadInput.evaluate((node) => (node as HTMLInputElement).value))
      .toBe('');

    await uploadInput.setInputFiles(makeFile('invalid.json', INVALID_PAYLOAD));

    const { alerts, debug } = await page.evaluate(() => ({
      alerts: (window as any).__importAlerts as string[],
      debug: (window as any).__swordDebug || {},
    }));
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]).toContain('Import failed');
    expect(debug.lastImportValid).toBe(false);
    expect(Array.isArray(debug.lastImportErrors)).toBe(true);
  });
});
