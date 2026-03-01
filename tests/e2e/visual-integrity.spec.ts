import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

// Only run on Chromium for consistency
test.skip(({ browserName }) => browserName !== 'chromium', 'Visual integrity runs only on Chromium');

// ---------------------------------------------------------------------------
// Preset list and feature map
// ---------------------------------------------------------------------------

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

interface PresetFeatures {
  hasGuard: boolean;
  hasScabbard: boolean;
  hasTassel: boolean;
}

const PRESET_FEATURES: Record<string, Partial<PresetFeatures>> = {
  'lightsaber': { hasGuard: false },
  'jian-scholar': { hasScabbard: true, hasTassel: true },
};

function getFeatures(presetId: string): PresetFeatures {
  const overrides = PRESET_FEATURES[presetId] ?? {};
  return {
    hasGuard: overrides.hasGuard ?? true,
    hasScabbard: overrides.hasScabbard ?? false,
    hasTassel: overrides.hasTassel ?? false,
  };
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

const OUT_DIR = 'test-results/visual-integrity';

interface CheckResult {
  name: string;
  pass: boolean;
  message: string;
  data?: Record<string, any>;
}

interface PresetReport {
  preset: string;
  allPassed: boolean;
  checks: CheckResult[];
  screenshotFile?: string;
}

// ---------------------------------------------------------------------------
// Helpers (same patterns as visual-audit.spec.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Core inspection — runs all 8 check categories inside page.evaluate()
// ---------------------------------------------------------------------------

async function inspectPreset(
  page: any,
  features: PresetFeatures
): Promise<CheckResult[]> {
  return page.evaluate((feat: PresetFeatures) => {
    const dbg = (window as any).__swordDebug;
    if (!dbg?.sword) return [{ name: 'debug-api', pass: false, message: 'No __swordDebug' }];

    const sword = dbg.sword;
    const group = sword.group;
    group.updateMatrixWorld(true);

    const checks: CheckResult[] = [];

    // --- Bounding box helper (world-space, no THREE import needed) ---
    type BBox = {
      minX: number; maxX: number;
      minY: number; maxY: number;
      minZ: number; maxZ: number;
      sizeX: number; sizeY: number; sizeZ: number;
    };

    function worldBBox(obj: any): BBox | null {
      if (!obj) return null;
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      let found = false;

      obj.traverse((child: any) => {
        const pos = child.geometry?.attributes?.position;
        if (!pos) return;
        found = true;
        const e = child.matrixWorld.elements;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
          const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
          const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
          if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
          if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
          if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
        }
      });

      if (!found || !isFinite(minX)) return null;
      return {
        minX, maxX, minY, maxY, minZ, maxZ,
        sizeX: maxX - minX, sizeY: maxY - minY, sizeZ: maxZ - minZ,
      };
    }

    function yOverlap(a: BBox, b: BBox): number {
      return Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
    }

    // --- Geometry health helper ---
    function geoHealth(obj: any): { allFinite: boolean; vertexCount: number } {
      let allFinite = true;
      let vertexCount = 0;
      obj.traverse((child: any) => {
        const pos = child.geometry?.attributes?.position;
        if (!pos) return;
        vertexCount += pos.count;
        const arr = pos.array;
        for (let i = 0; i < arr.length; i++) {
          if (!Number.isFinite(arr[i])) { allFinite = false; break; }
        }
      });
      return { allFinite, vertexCount };
    }

    // =======================================================================
    // CHECK 1: Part existence
    // =======================================================================
    const bladeBB = worldBBox(sword.bladeMesh);
    checks.push({
      name: 'blade-exists',
      pass: !!sword.bladeMesh && !!bladeBB,
      message: sword.bladeMesh ? 'Blade mesh exists' : 'MISSING blade mesh',
    });

    checks.push({
      name: 'handle-exists',
      pass: !!sword.handleMesh,
      message: sword.handleMesh ? 'Handle mesh exists' : 'MISSING handle mesh',
    });

    checks.push({
      name: 'pommel-exists',
      pass: !!sword.pommelMesh,
      message: sword.pommelMesh ? 'Pommel mesh exists' : 'MISSING pommel mesh',
    });

    const guardObj = sword.guardMesh ?? (sword as any).guardGroup;
    if (feat.hasGuard) {
      checks.push({
        name: 'guard-exists',
        pass: !!guardObj,
        message: guardObj ? 'Guard exists' : 'MISSING guard',
      });
    }

    if (feat.hasScabbard) {
      checks.push({
        name: 'scabbard-exists',
        pass: !!sword.scabbardGroup,
        message: sword.scabbardGroup ? 'Scabbard group exists' : 'MISSING scabbard',
      });
    }

    if (feat.hasTassel) {
      checks.push({
        name: 'tassel-exists',
        pass: !!sword.tasselGroup,
        message: sword.tasselGroup ? 'Tassel group exists' : 'MISSING tassel',
      });
    }

    // =======================================================================
    // CHECK 2: Connectivity (Y-axis bounding box overlap)
    // =======================================================================
    const handleBB = worldBBox(sword.handleMesh);
    const pommelBB = worldBBox(sword.pommelMesh);
    const guardBB = guardObj ? worldBBox(guardObj) : null;

    if (handleBB && pommelBB) {
      const overlap = yOverlap(handleBB, pommelBB);
      checks.push({
        name: 'pommel-handle-connectivity',
        pass: overlap > 0.001,
        message: `Pommel-handle Y overlap: ${overlap.toFixed(4)} (need > 0.001)`,
        data: { overlap, handleMinY: handleBB.minY, pommelMaxY: pommelBB.maxY },
      });
    }

    if (feat.hasGuard && guardBB && bladeBB) {
      const overlap = yOverlap(guardBB, bladeBB);
      // Guard and blade share a boundary at y≈0 — touching (overlap ≈ 0) is fine,
      // only flag actual gaps. -0.001 absorbs floating-point noise.
      checks.push({
        name: 'guard-blade-connectivity',
        pass: overlap > -0.001,
        message: `Guard-blade Y overlap: ${overlap.toFixed(4)} (need > -0.001)`,
        data: { overlap },
      });
    }

    if (feat.hasGuard && guardBB && handleBB) {
      const overlap = yOverlap(guardBB, handleBB);
      checks.push({
        name: 'guard-handle-connectivity',
        pass: overlap > 0.001,
        message: `Guard-handle Y overlap: ${overlap.toFixed(4)} (need > 0.001)`,
        data: { overlap },
      });
    }

    // =======================================================================
    // CHECK 3: No-clip (scabbard separation)
    // =======================================================================
    if (feat.hasScabbard && sword.scabbardGroup) {
      const scabBB = worldBBox(sword.scabbardGroup);
      if (scabBB && bladeBB) {
        const bladeMidX = (bladeBB.minX + bladeBB.maxX) / 2;
        const scabMidX = (scabBB.minX + scabBB.maxX) / 2;
        const xSep = Math.abs(scabMidX - bladeMidX);
        checks.push({
          name: 'scabbard-blade-x-separation',
          pass: xSep > 0.02,
          message: `Scabbard-blade X separation: ${xSep.toFixed(4)} (need > 0.02)`,
          data: { bladeMidX, scabMidX, xSep },
        });

        const xOverlap = Math.min(scabBB.maxX, bladeBB.maxX) - Math.max(scabBB.minX, bladeBB.minX);
        if (xOverlap > 0.01) {
          checks.push({
            name: 'scabbard-blade-no-clip',
            pass: xOverlap < bladeBB.sizeX * 0.5,
            message: `Scabbard-blade X overlap: ${xOverlap.toFixed(4)} (should be < ${(bladeBB.sizeX * 0.5).toFixed(4)})`,
            data: { xOverlap, bladeWidth: bladeBB.sizeX },
          });
        }
      }
    }

    // =======================================================================
    // CHECK 4: Tassel attachment
    // =======================================================================
    if (feat.hasTassel && sword.tasselGroup) {
      let clampPos: { x: number; y: number; z: number } | null = null;
      sword.tasselGroup.traverse((child: any) => {
        if (child.name === 'TasselClamp' && !clampPos) {
          const e = child.matrixWorld.elements;
          clampPos = { x: e[12], y: e[13], z: e[14] };
        }
      });

      // Determine the anchor region (guard or scabbard)
      const anchorBB = guardBB ?? worldBBox(sword.scabbardGroup);
      if (clampPos && anchorBB) {
        const tol = 0.15;
        const inRange =
          clampPos.x >= anchorBB.minX - tol && clampPos.x <= anchorBB.maxX + tol &&
          clampPos.y >= anchorBB.minY - tol && clampPos.y <= anchorBB.maxY + tol &&
          clampPos.z >= anchorBB.minZ - tol && clampPos.z <= anchorBB.maxZ + tol;
        checks.push({
          name: 'tassel-attachment',
          pass: inRange,
          message: inRange
            ? 'Tassel clamp is near guard/anchor'
            : `Tassel clamp at (${clampPos.x.toFixed(3)}, ${clampPos.y.toFixed(3)}, ${clampPos.z.toFixed(3)}) too far from anchor`,
          data: { clampPos, anchorBB },
        });
      }
    }

    // =======================================================================
    // CHECK 5: Proportionality
    // =======================================================================
    if (bladeBB) {
      if (feat.hasGuard && guardBB) {
        checks.push({
          name: 'guard-width-proportion',
          pass: guardBB.sizeX >= bladeBB.sizeX * 0.3,
          message: `Guard width ${guardBB.sizeX.toFixed(3)} vs blade ${bladeBB.sizeX.toFixed(3)} (need >= 30%)`,
        });
      }

      if (handleBB) {
        checks.push({
          name: 'handle-length-minimum',
          pass: handleBB.sizeY > 0.1,
          message: `Handle length: ${handleBB.sizeY.toFixed(3)} (need > 0.1)`,
        });
      }

      if (pommelBB && guardBB) {
        checks.push({
          name: 'pommel-not-oversized',
          pass: pommelBB.sizeX <= guardBB.sizeX * 2.0,
          message: `Pommel width ${pommelBB.sizeX.toFixed(3)} vs guard ${guardBB.sizeX.toFixed(3)} (need <= 2x)`,
        });
      }
    }

    // =======================================================================
    // CHECK 6 & 7: Finite geometry + Non-degenerate
    // =======================================================================
    const parts = [
      { name: 'blade', obj: sword.bladeMesh },
      { name: 'guard', obj: guardObj },
      { name: 'handle', obj: sword.handleMesh },
      { name: 'pommel', obj: sword.pommelMesh },
      { name: 'scabbard', obj: sword.scabbardGroup },
      { name: 'tassel', obj: sword.tasselGroup },
    ];

    for (const { name, obj } of parts) {
      if (!obj) continue;
      const { allFinite, vertexCount } = geoHealth(obj);
      const bb = worldBBox(obj);
      const hasVolume = bb && bb.sizeX > 1e-6 && bb.sizeY > 1e-6 && bb.sizeZ > 1e-6;

      checks.push({
        name: `${name}-finite`,
        pass: allFinite,
        message: allFinite
          ? `${name}: ${vertexCount} vertices all finite`
          : `${name}: contains NaN/Infinity`,
      });

      checks.push({
        name: `${name}-non-degenerate`,
        pass: vertexCount > 0 && !!hasVolume,
        message: vertexCount > 0 && hasVolume
          ? `${name}: ${vertexCount} verts, non-zero volume`
          : `${name}: degenerate (verts=${vertexCount}, volume=${!!hasVolume})`,
      });
    }

    // =======================================================================
    // CHECK 8: Pixel sanity
    // =======================================================================
    try {
      if (dbg.composer) dbg.composer.render();
      else dbg.renderer.render(dbg.scene, dbg.camera);

      const gl = dbg.renderer.getContext() as WebGLRenderingContext;
      const w = dbg.renderer.domElement.width;
      const h = dbg.renderer.domElement.height;
      const sw = Math.floor(w * 0.4);
      const sh = Math.floor(h * 0.4);
      const sx = Math.floor((w - sw) / 2);
      const sy = Math.floor((h - sh) / 2);
      const pixels = new Uint8Array(sw * sh * 4);
      gl.readPixels(sx, sy, sw, sh, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let bright = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 30) {
          bright++;
          if (bright > 20) break;
        }
      }
      checks.push({
        name: 'pixel-sanity',
        pass: bright > 20,
        message: bright > 20
          ? `Center region has ${bright}+ bright pixels`
          : `Only ${bright} bright pixels — possible blank render`,
      });
    } catch (e: any) {
      checks.push({
        name: 'pixel-sanity',
        pass: false,
        message: `Pixel read error: ${e.message}`,
      });
    }

    return checks;
  }, features);
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe('Visual integrity — structural checks for all presets', () => {
  test('all presets pass structural visual integrity checks', async ({ page }) => {
    test.setTimeout(120_000);

    await fs.mkdir(OUT_DIR, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForSelector('#sidebar', { timeout: 15_000 });

    // Dismiss gallery overlay if present
    await page.evaluate(() => {
      try { localStorage.setItem('bladegen-gallery-seen', '1'); } catch {}
      const gal = document.querySelector('.gallery') as HTMLElement | null;
      if (gal) gal.remove();
    });

    await waitForRender(page);

    const reports: PresetReport[] = [];

    for (const presetId of ALL_PRESETS) {
      await applyPreset(page, presetId);
      await waitForRender(page);

      const features = getFeatures(presetId);
      const checks = await inspectPreset(page, features);

      const allPassed = checks.every((c: CheckResult) => c.pass);
      const report: PresetReport = { preset: presetId, allPassed, checks };

      if (!allPassed) {
        const filename = `${presetId}_failure.png`;
        try {
          await page.screenshot({ path: path.join(OUT_DIR, filename), fullPage: false });
          report.screenshotFile = filename;
        } catch { /* ignore screenshot failures */ }
      }

      reports.push(report);
    }

    // Write manifest
    const manifest = {
      timestamp: new Date().toISOString(),
      totalPresets: ALL_PRESETS.length,
      passed: reports.filter((r) => r.allPassed).length,
      failed: reports.filter((r) => !r.allPassed).length,
      reports,
    };
    await fs.writeFile(
      path.join(OUT_DIR, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Report
    const failures = reports.filter((r) => !r.allPassed);
    if (failures.length > 0) {
      const summary = failures.map((f) => {
        const bad = f.checks.filter((c) => !c.pass);
        return `  ${f.preset}: ${bad.map((c) => `${c.name} — ${c.message}`).join('; ')}`;
      }).join('\n');
      console.error(`\n${failures.length}/${ALL_PRESETS.length} presets FAILED:\n${summary}\n`);
    } else {
      console.log(`\nAll ${ALL_PRESETS.length} presets passed visual integrity checks.\n`);
    }

    expect(failures.length, `${failures.length} presets failed — see ${OUT_DIR}/manifest.json`).toBe(0);
  });
});
