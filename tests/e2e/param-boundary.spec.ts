import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

// Only run on Chromium for consistency
test.skip(({ browserName }) => browserName !== 'chromium', 'Param boundary runs only on Chromium');

// ---------------------------------------------------------------------------
// Data table types
// ---------------------------------------------------------------------------

type ParamKind = 'numeric' | 'enum' | 'boolean';

interface ParamTestEntry {
  /** Dot-separated path from SwordParams root, e.g. "blade.length" */
  path: string;
  kind: ParamKind;
  /** numeric: [min, mid, max]; enum: all values; boolean: [true, false] */
  values: Array<number | string | boolean>;
  /** Params that must be set for this knob to have effect */
  prerequisites?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Parameter test table — ranges from validation.ts clamp() calls
// ---------------------------------------------------------------------------

const PARAM_TESTS: ParamTestEntry[] = [
  // ========================== BLADE ==========================
  // --- Core numerics ---
  { path: 'blade.length',    kind: 'numeric', values: [0.1, 3.0, 20] },
  { path: 'blade.baseWidth', kind: 'numeric', values: [0.02, 0.25, 5] },
  { path: 'blade.tipWidth',  kind: 'numeric', values: [0, 0.05, 5] },
  { path: 'blade.thickness', kind: 'numeric', values: [0.01, 0.08, 2] },
  { path: 'blade.thicknessLeft',  kind: 'numeric', values: [0.003, 0.08, 2] },
  { path: 'blade.thicknessRight', kind: 'numeric', values: [0.003, 0.08, 2] },
  { path: 'blade.curvature', kind: 'numeric', values: [-1, 0, 1] },
  { path: 'blade.bevel',     kind: 'numeric', values: [0, 0.5, 1] },
  { path: 'blade.twistAngle', kind: 'numeric', values: [-37.7, 0, 37.7] },
  { path: 'blade.chaos',     kind: 'numeric', values: [0, 0.5, 1] },
  { path: 'blade.asymmetry', kind: 'numeric', values: [-1, 0, 1] },
  { path: 'blade.baseAngle', kind: 'numeric', values: [-0.35, 0, 0.35] },
  { path: 'blade.sweepSegments', kind: 'numeric', values: [16, 128, 512] },

  // --- Curvature & tip ---
  { path: 'blade.kissakiLength',    kind: 'numeric', values: [0, 0.15, 0.35] },
  { path: 'blade.kissakiRoundness', kind: 'numeric', values: [0, 0.5, 1] },
  { path: 'blade.tipRampStart',     kind: 'numeric', values: [0, 0.5, 0.98] },
  { path: 'blade.tipBulge',         kind: 'numeric', values: [0, 0.5, 1] },
  { path: 'blade.soriBias',         kind: 'numeric', values: [0.3, 1.5, 3] },
  { path: 'blade.ricassoLength',    kind: 'numeric', values: [0, 0.15, 0.3] },
  { path: 'blade.falseEdgeLength',  kind: 'numeric', values: [0, 0.5, 1] },
  { path: 'blade.falseEdgeDepth',   kind: 'numeric', values: [0, 0.1, 0.2] },

  // --- Serrations ---
  { path: 'blade.serrationAmplitude',  kind: 'numeric', values: [0, 0.03, 0.08] },
  { path: 'blade.serrationFrequency',  kind: 'numeric', values: [0, 60, 120] },
  { path: 'blade.serrationSharpness',  kind: 'numeric', values: [0, 0.5, 1] },
  { path: 'blade.serrationLeanLeft',   kind: 'numeric', values: [-1, 0, 1] },
  { path: 'blade.serrationLeanRight',  kind: 'numeric', values: [-1, 0, 1] },

  // --- Fullers ---
  { path: 'blade.fullerWidth',  kind: 'numeric', values: [0, 0.1, 0.25],
    prerequisites: { 'blade.fullerEnabled': true, 'blade.fullerCount': 1 } },
  { path: 'blade.fullerDepth',  kind: 'numeric', values: [0, 0.05, 0.2],
    prerequisites: { 'blade.fullerEnabled': true } },
  { path: 'blade.fullerLength', kind: 'numeric', values: [0, 0.5, 1],
    prerequisites: { 'blade.fullerEnabled': true } },
  { path: 'blade.fullerCount',  kind: 'numeric', values: [0, 1, 3],
    prerequisites: { 'blade.fullerEnabled': true } },

  // --- Hamon ---
  { path: 'blade.hamonWidth',     kind: 'numeric', values: [0, 0.03, 0.06],
    prerequisites: { 'blade.hamonEnabled': true } },
  { path: 'blade.hamonAmplitude', kind: 'numeric', values: [0, 0.015, 0.03],
    prerequisites: { 'blade.hamonEnabled': true } },
  { path: 'blade.hamonFrequency', kind: 'numeric', values: [0, 10, 30],
    prerequisites: { 'blade.hamonEnabled': true } },

  // --- Blade enums ---
  { path: 'blade.crossSection', kind: 'enum',
    values: ['flat', 'lenticular', 'diamond', 'hexagonal', 'triangular', 'tSpine', 'compound'] },
  { path: 'blade.tipShape', kind: 'enum',
    values: ['pointed', 'rounded', 'leaf', 'clip', 'tanto', 'spear', 'sheepsfoot'] },
  { path: 'blade.edgeType', kind: 'enum', values: ['single', 'double'] },
  { path: 'blade.family', kind: 'enum', values: ['straight', 'flamberge', 'kris'] },
  { path: 'blade.serrationPattern', kind: 'enum', values: ['sine', 'saw', 'scallop', 'random'] },
  { path: 'blade.fullerMode', kind: 'enum', values: ['overlay', 'carve', 'none'] },
  { path: 'blade.fullerProfile', kind: 'enum', values: ['u', 'v', 'flat'] },
  { path: 'blade.hamonSide', kind: 'enum', values: ['auto', 'left', 'right', 'both'],
    prerequisites: { 'blade.hamonEnabled': true } },
  { path: 'blade.soriProfile', kind: 'enum', values: ['torii', 'koshi', 'saki'] },

  // --- Blade booleans ---
  { path: 'blade.fullerEnabled', kind: 'boolean', values: [true, false],
    prerequisites: { 'blade.fullers': null, 'blade.fullerCount': 2, 'blade.fullerWidth': 0.08, 'blade.fullerDepth': 0.05 } },
  { path: 'blade.hamonEnabled',  kind: 'boolean', values: [true, false] },

  // ========================== GUARD ==========================
  // --- Guard numerics ---
  { path: 'guard.width',     kind: 'numeric', values: [0.2, 1.2, 10] },
  { path: 'guard.thickness', kind: 'numeric', values: [0.05, 0.2, 2] },
  { path: 'guard.curve',     kind: 'numeric', values: [-1, 0, 1] },
  { path: 'guard.tilt',      kind: 'numeric', values: [-1.57, 0, 1.57] },
  { path: 'guard.guardBlendFillet', kind: 'numeric', values: [0, 0.5, 1] },
  { path: 'guard.ornamentation',   kind: 'numeric', values: [0, 0.5, 1] },
  { path: 'guard.tipSharpness',    kind: 'numeric', values: [0, 0.5, 1] },
  { path: 'guard.heightOffset',    kind: 'numeric', values: [-0.5, 0, 0.5] },
  { path: 'guard.shellCoverage',   kind: 'numeric', values: [0.3, 0.65, 1],
    prerequisites: { 'guard.style': 'shell' } },
  { path: 'guard.shellThickness',  kind: 'numeric', values: [0.2, 1.0, 1.5],
    prerequisites: { 'guard.style': 'shell' } },
  { path: 'guard.shellFlare',      kind: 'numeric', values: [0.5, 1.0, 2],
    prerequisites: { 'guard.style': 'shell' } },
  { path: 'guard.habakiHeight',    kind: 'numeric', values: [0.02, 0.06, 0.2],
    prerequisites: { 'guard.habakiEnabled': true } },
  { path: 'guard.habakiMargin',    kind: 'numeric', values: [0.002, 0.01, 0.08],
    prerequisites: { 'guard.habakiEnabled': true } },

  // --- Guard enums ---
  { path: 'guard.style', kind: 'enum',
    values: ['bar', 'winged', 'claw', 'disk', 'basket', 'knucklebow', 'swept', 'shell'] },
  { path: 'guard.guardBlendFilletStyle', kind: 'enum', values: ['box', 'smooth'] },

  // --- Guard booleans ---
  { path: 'guard.habakiEnabled',  kind: 'boolean', values: [true, false] },
  // guard.asymmetricArms — param exists in types but geometry code does not implement it (dead knob)
  // { path: 'guard.asymmetricArms', kind: 'boolean', values: [true, false] },

  // ========================== HANDLE ==========================
  // --- Handle numerics ---
  { path: 'handle.length',       kind: 'numeric', values: [0.2, 0.9, 5] },
  { path: 'handle.radiusTop',    kind: 'numeric', values: [0.05, 0.12, 1] },
  { path: 'handle.radiusBottom', kind: 'numeric', values: [0.05, 0.12, 1] },
  { path: 'handle.ovalRatio',    kind: 'numeric', values: [1, 1.5, 3] },
  { path: 'handle.curvature',    kind: 'numeric', values: [-0.2, 0, 0.2] },
  { path: 'handle.wrapTurns',    kind: 'numeric', values: [0, 10, 40],
    prerequisites: { 'handle.wrapEnabled': true } },
  { path: 'handle.wrapDepth',    kind: 'numeric', values: [0, 0.03, 0.08],
    prerequisites: { 'handle.wrapEnabled': true } },

  // --- Handle enums ---
  { path: 'handle.wrapStyle', kind: 'enum',
    values: ['none', 'crisscross', 'hineri', 'katate', 'wire'] },
  { path: 'handle.menukiPreset', kind: 'enum', values: ['none', 'katana', 'paired'] },

  // --- Handle booleans ---
  { path: 'handle.segmentation', kind: 'boolean', values: [true, false] },
  { path: 'handle.wrapEnabled',  kind: 'boolean', values: [true, false] },
  { path: 'handle.wrapTexture',  kind: 'boolean', values: [true, false] },
  { path: 'handle.tangVisible',  kind: 'boolean', values: [true, false] },

  // ========================== POMMEL ==========================
  // --- Pommel numerics ---
  { path: 'pommel.size',       kind: 'numeric', values: [0.05, 0.16, 1] },
  { path: 'pommel.elongation', kind: 'numeric', values: [0.3, 1.0, 3] },
  { path: 'pommel.shapeMorph', kind: 'numeric', values: [0, 0.5, 1] },
  { path: 'pommel.facetCount', kind: 'numeric', values: [3, 32, 128],
    prerequisites: { 'pommel.style': 'disk', 'pommel.size': 0.3 } },
  { path: 'pommel.spikeLength',    kind: 'numeric', values: [0.2, 1.0, 3],
    prerequisites: { 'pommel.style': 'spike' } },
  { path: 'pommel.crownSpikes',    kind: 'numeric', values: [3, 12, 24],
    prerequisites: { 'pommel.style': 'crown' } },
  { path: 'pommel.crownSharpness', kind: 'numeric', values: [0, 0.5, 1],
    prerequisites: { 'pommel.style': 'crown' } },
  { path: 'pommel.ringInnerRadius', kind: 'numeric', values: [0.005, 0.06, 1],
    prerequisites: { 'pommel.style': 'ring' } },

  // --- Pommel enums ---
  { path: 'pommel.style', kind: 'enum',
    values: ['orb', 'disk', 'spike', 'wheel', 'scentStopper', 'ring', 'crown', 'fishtail'] },
  { path: 'pommel.peenShape', kind: 'enum', values: ['dome', 'block'],
    prerequisites: { 'pommel.peenVisible': true } },

  // --- Pommel booleans ---
  { path: 'pommel.peenVisible', kind: 'boolean', values: [true, false] },

  // ========================== ACCESSORIES: SCABBARD ==========================
  { path: 'accessories.scabbard.enabled', kind: 'boolean', values: [true, false] },
  { path: 'accessories.scabbard.bodyMargin',    kind: 'numeric', values: [0.002, 0.035, 0.4],
    prerequisites: { 'accessories.scabbard.enabled': true } },
  { path: 'accessories.scabbard.bodyThickness', kind: 'numeric', values: [0.02, 0.12, 0.8],
    prerequisites: { 'accessories.scabbard.enabled': true } },
  { path: 'accessories.scabbard.tipExtension',  kind: 'numeric', values: [0, 0.06, 0.5],
    prerequisites: { 'accessories.scabbard.enabled': true } },
  { path: 'accessories.scabbard.throatLength',  kind: 'numeric', values: [0, 0.08, 0.5],
    prerequisites: { 'accessories.scabbard.enabled': true, 'accessories.scabbard.bodyThickness': 0.3 } },
  { path: 'accessories.scabbard.throatScale',   kind: 'numeric', values: [1, 1.12, 3],
    prerequisites: { 'accessories.scabbard.enabled': true, 'accessories.scabbard.bodyThickness': 0.3, 'accessories.scabbard.throatLength': 0.2 } },
  { path: 'accessories.scabbard.locketOffset',  kind: 'numeric', values: [0, 0.18, 0.9],
    prerequisites: { 'accessories.scabbard.enabled': true, 'accessories.scabbard.bodyThickness': 0.3, 'accessories.scabbard.locketLength': 0.3 } },
  { path: 'accessories.scabbard.locketLength',  kind: 'numeric', values: [0, 0.12, 0.6],
    prerequisites: { 'accessories.scabbard.enabled': true, 'accessories.scabbard.bodyThickness': 0.3 } },
  { path: 'accessories.scabbard.locketScale',   kind: 'numeric', values: [1, 1.05, 2.5],
    prerequisites: { 'accessories.scabbard.enabled': true, 'accessories.scabbard.bodyThickness': 0.3, 'accessories.scabbard.locketLength': 0.3 } },
  { path: 'accessories.scabbard.chapeLength',   kind: 'numeric', values: [0.01, 0.22, 0.7],
    prerequisites: { 'accessories.scabbard.enabled': true, 'accessories.scabbard.bodyThickness': 0.3 } },
  { path: 'accessories.scabbard.chapeScale',    kind: 'numeric', values: [0.1, 0.45, 1],
    prerequisites: { 'accessories.scabbard.enabled': true } },
  { path: 'accessories.scabbard.bodyRoundness', kind: 'numeric', values: [0, 0.5, 1],
    prerequisites: { 'accessories.scabbard.enabled': true, 'accessories.scabbard.bodyThickness': 0.3 } },
  { path: 'accessories.scabbard.offsetX',       kind: 'numeric', values: [-1, 0.16, 1],
    prerequisites: { 'accessories.scabbard.enabled': true } },
  { path: 'accessories.scabbard.hangAngle',     kind: 'numeric', values: [-1.57, 0, 1.57],
    prerequisites: { 'accessories.scabbard.enabled': true, 'accessories.scabbard.bodyThickness': 0.3 } },

  // ========================== ACCESSORIES: TASSEL ==========================
  { path: 'accessories.tassel.enabled', kind: 'boolean', values: [true, false] },
  { path: 'accessories.tassel.length',    kind: 'numeric', values: [0.05, 0.55, 2.5],
    prerequisites: { 'accessories.tassel.enabled': true } },
  { path: 'accessories.tassel.droop',     kind: 'numeric', values: [0, 0.5, 1],
    prerequisites: { 'accessories.tassel.enabled': true } },
  { path: 'accessories.tassel.sway',      kind: 'numeric', values: [-1, 0, 1],
    prerequisites: { 'accessories.tassel.enabled': true, 'accessories.tassel.length': 1.5, 'accessories.tassel.thickness': 0.05 } },
  { path: 'accessories.tassel.thickness', kind: 'numeric', values: [0.002, 0.018, 0.12],
    prerequisites: { 'accessories.tassel.enabled': true, 'accessories.tassel.length': 1.5 } },
  { path: 'accessories.tassel.tuftSize',  kind: 'numeric', values: [0.005, 0.05, 0.4],
    prerequisites: { 'accessories.tassel.enabled': true, 'accessories.tassel.length': 1.5, 'accessories.tassel.strands': 16 } },
  { path: 'accessories.tassel.tuftLength', kind: 'numeric', values: [0.01, 0.14, 0.6],
    prerequisites: { 'accessories.tassel.enabled': true, 'accessories.tassel.length': 1.5, 'accessories.tassel.strands': 16 } },
  { path: 'accessories.tassel.strands',   kind: 'numeric', values: [1, 10, 32],
    prerequisites: { 'accessories.tassel.enabled': true, 'accessories.tassel.length': 1.5 } },
  { path: 'accessories.tassel.anchorOffset', kind: 'numeric', values: [0, 0.5, 1],
    prerequisites: { 'accessories.tassel.enabled': true, 'accessories.tassel.length': 1.5, 'accessories.tassel.thickness': 0.05,
      'accessories.tassel.attachTo': 'scabbard', 'accessories.scabbard.enabled': true } },
  { path: 'accessories.tassel.attachTo', kind: 'enum', values: ['guard', 'scabbard'],
    prerequisites: { 'accessories.tassel.enabled': true, 'accessories.tassel.length': 1.5, 'accessories.scabbard.enabled': true } },

  // ========================== TOP-LEVEL ==========================
  { path: 'hiltEnabled',  kind: 'boolean', values: [true, false] },
  { path: 'guardEnabled', kind: 'boolean', values: [true, false] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepSet(obj: any, dotPath: string, value: any): void {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

/** Patterns for console messages we expect and should ignore. */
const IGNORE_PATTERNS = [
  /THREE\.WebGLRenderer/,
  /ResizeObserver/,
  /favicon/i,
];

function isBenign(text: string): boolean {
  return IGNORE_PATTERNS.some((re) => re.test(text));
}

// ---------------------------------------------------------------------------
// Test result type
// ---------------------------------------------------------------------------

interface TestResult {
  path: string;
  value: number | string | boolean;
  pass: boolean;
  hasPixels: boolean;
  hasBladeMesh: boolean;
  error?: string;
  consoleErrors?: string[];
  screenshotFile?: string;
}

// ---------------------------------------------------------------------------

const OUT_DIR = 'test-results/param-boundary';

test.describe.serial('Parameter boundary sweep', () => {
  test('all knobs at boundary values render without crashes', async ({ page }) => {
    test.setTimeout(180_000);

    await fs.mkdir(OUT_DIR, { recursive: true });

    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');
    await page.waitForSelector('#sidebar', { timeout: 15_000 });

    // Dismiss gallery if present
    await page.evaluate(() => {
      try { localStorage.setItem('bladegen-gallery-seen', '1'); } catch {}
      const gal = document.querySelector('.gallery') as HTMLElement | null;
      if (gal) gal.remove();
    });

    // Wait for sword to appear
    await page.waitForFunction(
      () => !!(window as any).__swordDebug?.sword?.bladeMesh,
      { timeout: 15_000 }
    );

    // Apply showcase-arming as clean baseline
    await page.evaluate(() => {
      const sel = document.querySelector('#preset-selector') as HTMLSelectElement | null
        ?? Array.from(document.querySelectorAll('select')).find((s) =>
          Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'showcase-arming')
        ) as HTMLSelectElement | undefined;
      if (sel) {
        sel.value = 'showcase-arming';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      try { (window as any).__swordDebug?.setAutoSpinEnabled?.(false); } catch {}
    });

    // Wait for geometry to settle
    await page.evaluate(() => new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r()))
    ));
    await page.waitForTimeout(300);

    // Snapshot base state
    const baseState = await page.evaluate(() => {
      const dbg = (window as any).__swordDebug;
      return JSON.parse(JSON.stringify(dbg.sword.lastParams));
    });

    // Console error tracking
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => {
      const text = `pageerror: ${err.message}`;
      if (!isBenign(text)) consoleErrors.push(text);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = `console.error: ${msg.text()}`;
        if (!isBenign(text)) consoleErrors.push(text);
      }
    });

    const results: TestResult[] = [];
    let totalTests = 0;

    for (const entry of PARAM_TESTS) {
      for (const value of entry.values) {
        totalTests++;

        // Build test state from clean base
        const state = JSON.parse(JSON.stringify(baseState));
        if (entry.prerequisites) {
          for (const [p, v] of Object.entries(entry.prerequisites)) {
            deepSet(state, p, v);
          }
        }
        deepSet(state, entry.path, value);

        const errorsBefore = consoleErrors.length;

        // Atomic: updateGeometry + render + pixel check — single IPC round-trip
        const result = await page.evaluate((paramState) => {
          const dbg = (window as any).__swordDebug;
          if (!dbg?.sword || !dbg?.renderer || !dbg?.camera) {
            return { ok: false, error: 'Debug API unavailable', hasPixels: false, hasBladeMesh: false };
          }

          try {
            dbg.sword.updateGeometry(paramState);
          } catch (e: any) {
            return { ok: false, error: `updateGeometry: ${e.message}`, hasPixels: false, hasBladeMesh: false };
          }

          try {
            if (dbg.composer) dbg.composer.render();
            else dbg.renderer.render(dbg.scene, dbg.camera);
          } catch (e: any) {
            return { ok: false, error: `render: ${e.message}`, hasPixels: false, hasBladeMesh: !!dbg.sword.bladeMesh };
          }

          const hasBladeMesh = !!dbg.sword.bladeMesh;

          // Sample center 10% strip for non-blank pixels
          const gl = dbg.renderer.getContext() as WebGLRenderingContext;
          const w = dbg.renderer.domElement.width;
          const h = dbg.renderer.domElement.height;
          const sampleH = Math.max(10, Math.floor(h * 0.1));
          const startY = Math.floor((h - sampleH) / 2);
          const pixels = new Uint8Array(w * sampleH * 4);
          gl.readPixels(0, startY, w, sampleH, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

          let bright = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 30) {
              bright++;
              if (bright > 5) break;
            }
          }

          return { ok: true, hasPixels: bright > 5, hasBladeMesh };
        }, state);

        const newErrors = consoleErrors.slice(errorsBefore);
        const pass = result.ok && result.hasBladeMesh && result.hasPixels && newErrors.length === 0;

        const tr: TestResult = {
          path: entry.path,
          value,
          pass,
          hasPixels: result.hasPixels,
          hasBladeMesh: result.hasBladeMesh,
          error: result.error,
          consoleErrors: newErrors.length > 0 ? newErrors : undefined,
        };

        // Diagnostic screenshot only on failure
        if (!pass) {
          const safeName = `${entry.path.replace(/\./g, '_')}_${String(value).replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          try {
            await page.screenshot({
              path: path.join(OUT_DIR, `${safeName}.png`),
              fullPage: false,
            });
            tr.screenshotFile = `${safeName}.png`;
          } catch { /* ignore */ }
        }

        results.push(tr);
      }
    }

    // Reset to base state
    await page.evaluate((s) => {
      try { (window as any).__swordDebug?.sword?.updateGeometry(s); } catch {}
    }, baseState);

    // Write manifest
    const failures = results.filter((r) => !r.pass);
    const manifest = {
      timestamp: new Date().toISOString(),
      totalTests,
      passed: results.filter((r) => r.pass).length,
      failed: failures.length,
      results,
    };
    await fs.writeFile(
      path.join(OUT_DIR, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    if (failures.length > 0) {
      const summary = failures
        .map((f) => `  ${f.path}=${JSON.stringify(f.value)}: ${f.error ?? (f.hasBladeMesh ? 'blank render' : 'no bladeMesh')}${f.consoleErrors?.length ? ' +' + f.consoleErrors.length + ' console errors' : ''}`)
        .join('\n');
      console.error(`\n${failures.length}/${totalTests} param boundary tests FAILED:\n${summary}\n`);
    } else {
      console.log(`\nAll ${totalTests} param boundary tests passed.\n`);
    }

    expect(failures.length, `${failures.length} parameter boundary tests failed — see ${OUT_DIR}/manifest.json`).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Test 2: Verify each knob actually CHANGES the sword
  // -------------------------------------------------------------------------

  test('each knob produces a measurable effect on the output', async ({ page }) => {
    test.setTimeout(180_000);

    const effectDir = path.join(OUT_DIR, 'effect');
    await fs.mkdir(effectDir, { recursive: true });

    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');
    await page.waitForSelector('#sidebar', { timeout: 15_000 });

    // Dismiss gallery
    await page.evaluate(() => {
      try { localStorage.setItem('bladegen-gallery-seen', '1'); } catch {}
      const gal = document.querySelector('.gallery') as HTMLElement | null;
      if (gal) gal.remove();
    });

    await page.waitForFunction(
      () => !!(window as any).__swordDebug?.sword?.bladeMesh,
      { timeout: 15_000 }
    );

    // Apply baseline preset
    await page.evaluate(() => {
      const sel = document.querySelector('#preset-selector') as HTMLSelectElement | null
        ?? Array.from(document.querySelectorAll('select')).find((s) =>
          Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'showcase-arming')
        ) as HTMLSelectElement | undefined;
      if (sel) {
        sel.value = 'showcase-arming';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      try { (window as any).__swordDebug?.setAutoSpinEnabled?.(false); } catch {}
    });

    await page.evaluate(() => new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r()))
    ));
    await page.waitForTimeout(300);

    const baseState = await page.evaluate(() => {
      const dbg = (window as any).__swordDebug;
      return JSON.parse(JSON.stringify(dbg.sword.lastParams));
    });

    /**
     * Apply params, rebuild, render, and return a fingerprint of the result:
     * - vertexCount: total vertices across all sword group children
     * - positionHash: sum of all vertex positions (detects any geometry change)
     * - bbox: { minX, maxX, minY, maxY, minZ, maxZ } of sword group
     * - pixelHash: sum of R+G+B values in center pixel strip (cheap diff)
     */
    async function fingerprint(paramState: any): Promise<{
      vertexCount: number;
      positionHash: number;
      bbox: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
      pixelHash: number;
      error?: string;
    }> {
      return page.evaluate((state: any) => {
        const dbg = (window as any).__swordDebug;
        if (!dbg?.sword || !dbg?.renderer || !dbg?.camera) {
          return {
            vertexCount: 0,
            positionHash: 0,
            bbox: { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 },
            pixelHash: 0,
            error: 'Debug API unavailable',
          };
        }

        try {
          dbg.sword.updateGeometry(state);
        } catch (e: any) {
          return {
            vertexCount: 0,
            positionHash: 0,
            bbox: { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 },
            pixelHash: 0,
            error: `updateGeometry: ${e.message}`,
          };
        }

        // Vertex count + position hash across all meshes in group
        let vertexCount = 0;
        let positionHash = 0;
        const group = dbg.sword.group;
        // Propagate parent transforms (e.g. scabbard hangAngle rotation) to all children
        group.updateMatrixWorld(true);
        group.traverse((child: any) => {
          const pos = child.geometry?.attributes?.position;
          if (!pos) return;
          vertexCount += pos.count;
          const arr = pos.array as Float32Array;
          const mat = child.matrixWorld;
          const e = mat.elements;
          for (let i = 0; i < arr.length; i += 3) {
            const x = arr[i], y = arr[i + 1], z = arr[i + 2];
            // World-space position
            positionHash += Math.abs(e[0]*x + e[4]*y + e[8]*z + e[12]);
            positionHash += Math.abs(e[1]*x + e[5]*y + e[9]*z + e[13]);
            positionHash += Math.abs(e[2]*x + e[6]*y + e[10]*z + e[14]);
          }
        });

        // Bounding box of sword group
        let mnX = Infinity, mxX = -Infinity;
        let mnY = Infinity, mxY = -Infinity;
        let mnZ = Infinity, mxZ = -Infinity;
        group.traverse((child: any) => {
          const pos = child.geometry?.attributes?.position;
          if (!pos) return;
          const arr = pos.array as Float32Array;
          const mat = child.matrixWorld;
          const el = mat.elements;
          for (let i = 0; i < arr.length; i += 3) {
            const x = arr[i], y = arr[i + 1], z = arr[i + 2];
            const wx = el[0]*x + el[4]*y + el[8]*z + el[12];
            const wy = el[1]*x + el[5]*y + el[9]*z + el[13];
            const wz = el[2]*x + el[6]*y + el[10]*z + el[14];
            if (wx < mnX) mnX = wx; if (wx > mxX) mxX = wx;
            if (wy < mnY) mnY = wy; if (wy > mxY) mxY = wy;
            if (wz < mnZ) mnZ = wz; if (wz > mxZ) mxZ = wz;
          }
        });

        const bbox = { minX: mnX, maxX: mxX, minY: mnY, maxY: mxY, minZ: mnZ, maxZ: mxZ };

        // Render and read center pixel strip
        try {
          if (dbg.composer) dbg.composer.render();
          else dbg.renderer.render(dbg.scene, dbg.camera);
        } catch { /* ignore render errors here */ }

        const gl = dbg.renderer.getContext() as WebGLRenderingContext;
        const w = dbg.renderer.domElement.width;
        const h = dbg.renderer.domElement.height;
        const sampleH = Math.max(10, Math.floor(h * 0.15));
        const startY = Math.floor((h - sampleH) / 2);
        const pixels = new Uint8Array(w * sampleH * 4);
        gl.readPixels(0, startY, w, sampleH, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        // Compute a pixel hash: sum of all channel values
        let pixelHash = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          pixelHash += pixels[i] + pixels[i + 1] + pixels[i + 2];
        }

        return { vertexCount, positionHash, bbox, pixelHash };
      }, paramState);
    }

    function bboxDiffers(
      a: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
      b: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
      tolerance = 0.001
    ): boolean {
      return (
        Math.abs(a.minX - b.minX) > tolerance ||
        Math.abs(a.maxX - b.maxX) > tolerance ||
        Math.abs(a.minY - b.minY) > tolerance ||
        Math.abs(a.maxY - b.maxY) > tolerance ||
        Math.abs(a.minZ - b.minZ) > tolerance ||
        Math.abs(a.maxZ - b.maxZ) > tolerance
      );
    }

    interface EffectResult {
      path: string;
      valueA: number | string | boolean;
      valueB: number | string | boolean;
      pass: boolean;
      vertexChanged: boolean;
      positionChanged: boolean;
      bboxChanged: boolean;
      pixelChanged: boolean;
      error?: string;
    }

    const effectResults: EffectResult[] = [];

    for (const entry of PARAM_TESTS) {
      // Pick two values that should produce different output
      const valueA = entry.values[0];
      const valueB = entry.values[entry.values.length - 1];
      if (valueA === valueB) continue; // skip single-value entries

      // Build state A
      const stateA = JSON.parse(JSON.stringify(baseState));
      if (entry.prerequisites) {
        for (const [p, v] of Object.entries(entry.prerequisites)) {
          deepSet(stateA, p, v);
        }
      }
      deepSet(stateA, entry.path, valueA);

      // Build state B
      const stateB = JSON.parse(JSON.stringify(baseState));
      if (entry.prerequisites) {
        for (const [p, v] of Object.entries(entry.prerequisites)) {
          deepSet(stateB, p, v);
        }
      }
      deepSet(stateB, entry.path, valueB);

      const fpA = await fingerprint(stateA);
      const fpB = await fingerprint(stateB);

      if (fpA.error || fpB.error) {
        effectResults.push({
          path: entry.path, valueA, valueB,
          pass: false,
          vertexChanged: false, positionChanged: false, bboxChanged: false, pixelChanged: false,
          error: fpA.error || fpB.error,
        });
        continue;
      }

      const vertexChanged = fpA.vertexCount !== fpB.vertexCount;
      // Position hash: absolute threshold — any geometry change > float noise
      const posDelta = Math.abs(fpA.positionHash - fpB.positionHash);
      const positionChanged = posDelta > 0.01;
      const bboxChanged_ = bboxDiffers(fpA.bbox, fpB.bbox);
      // Pixel hash: require >0.5% change to avoid float noise
      const hashDelta = Math.abs(fpA.pixelHash - fpB.pixelHash);
      const hashBase = Math.max(fpA.pixelHash, fpB.pixelHash, 1);
      const pixelChanged = hashDelta / hashBase > 0.005;

      const hasEffect = vertexChanged || positionChanged || bboxChanged_ || pixelChanged;

      effectResults.push({
        path: entry.path, valueA, valueB,
        pass: hasEffect,
        vertexChanged, positionChanged, bboxChanged: bboxChanged_, pixelChanged,
      });
    }

    // Write effect manifest
    const effectFailures = effectResults.filter((r) => !r.pass);
    const effectManifest = {
      timestamp: new Date().toISOString(),
      totalKnobs: effectResults.length,
      effective: effectResults.filter((r) => r.pass).length,
      deadKnobs: effectFailures.length,
      results: effectResults,
    };
    await fs.writeFile(
      path.join(effectDir, 'manifest.json'),
      JSON.stringify(effectManifest, null, 2)
    );

    if (effectFailures.length > 0) {
      const summary = effectFailures
        .map((f) => `  ${f.path}: ${JSON.stringify(f.valueA)} → ${JSON.stringify(f.valueB)} (no visible change)${f.error ? ' — ' + f.error : ''}`)
        .join('\n');
      console.warn(`\n${effectFailures.length}/${effectResults.length} knobs had NO measurable effect:\n${summary}\n`);
    } else {
      console.log(`\nAll ${effectResults.length} knobs produce measurable effects.\n`);
    }

    // Reset
    await page.evaluate((s) => {
      try { (window as any).__swordDebug?.sword?.updateGeometry(s); } catch {}
    }, baseState);

    expect(
      effectFailures.length,
      `${effectFailures.length} dead knobs — see ${effectDir}/manifest.json`
    ).toBe(0);
  });
});
