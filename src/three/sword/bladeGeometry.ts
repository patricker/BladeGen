import * as THREE from 'three';
import type { BladeParams } from './types';
import { bendOffsetX, serrationWave, tipWidthWithKissaki, wavinessAt } from './math';
import { callCore, toGeometry } from './core/wasm';

type ResolvedFuller = {
  side: 'left' | 'right';
  offset: number;
  width: number;
  depth: number;
  inset: number;
  start: number;
  end: number;
  profile: 'u' | 'v' | 'flat';
  mode: 'overlay' | 'carve';
  taper: number;
};

const resolveFullers = (b: BladeParams): ResolvedFuller[] => {
  const slots = Array.isArray((b as any).fullers) ? (b.fullers as Array<any>) : [];
  const resolved: ResolvedFuller[] = [];
  for (const slot of slots) {
    if (!slot) continue;
    const width = Math.max(0.005, Number(slot.width) || (b.baseWidth || 0.25) * 0.3);
    const start = THREE.MathUtils.clamp(Number(slot.start) || 0.05, 0, 0.98);
    const endRaw = THREE.MathUtils.clamp(Number(slot.end) || 0.95, start + 0.02, 1);
    if (endRaw <= start) continue;
    const depth = Math.max(0, Number(slot.depth) || 0);
    const inset = Math.max(0, Number(slot.inset) || depth);
    const profile: ResolvedFuller['profile'] =
      slot.profile === 'v' || slot.profile === 'flat' ? slot.profile : 'u';
    const mode: ResolvedFuller['mode'] = slot.mode === 'carve' ? 'carve' : 'overlay';
    const taper = THREE.MathUtils.clamp(Number(slot.taper) || 0, 0, 1);
    const baseOffset = Math.abs(Number(slot.offsetFromSpine) || 0);
    const push = (sign: number, side: 'left' | 'right') => {
      const offset = sign >= 0 ? baseOffset : -baseOffset;
      resolved.push({
        side,
        offset,
        width,
        depth,
        inset,
        start,
        end: endRaw,
        profile,
        mode,
        taper,
      });
    };
    switch (slot.side) {
      case 'left':
        push(-1, 'left');
        break;
      case 'right':
        push(1, 'right');
        break;
      default:
        push(-1, 'left');
        push(1, 'right');
        break;
    }
  }
  return resolved;
};

/**
 * Blade geometry helpers.
 *
 * This module provides pure(ish) functions for generating blade meshes and
 * related overlays. The functions below take only the data they need
 * (BladeParams and numeric inputs) and return Three.js geometry or groups.
 *
 * Notes on coordinates and conventions:
 * - Blade runs along +Y with the base at y=0 and tip at y=length.
 * - Width extends along ±X (left negative, right positive when facing +Y).
 * - Thickness extends along ±Z; by default meshes are double-sided.
 * - Many computations are designed to be deterministic for the same params.
 */

/**
 * Compute lateral X bend offset at longitudinal position y using a shaped
 * profile (sori) plus an optional linear base angle.
 */
export { bendOffsetX } from './math';

/**
 * Compute width at a normalized longitudinal position with optional kissaki
 * (tip) segment controlling the final taper curve.
 */
export { tipWidthWithKissaki } from './math';

/**
 * Evaluate distal taper scale at t based on piecewise linear points.
 * Returns a scalar applied to per-edge thickness across Z.
 */
export { thicknessScaleAt } from './math';

/** Expose serration waveform helper for tests/tools. */
export { serrationWave } from './math';

/**
 * Synthesize a blade mesh (BufferGeometry) using the provided parameters.
 *
 * The geometry is bladegen-core's (`crates/bladegen-core/src/blade.rs`, through the wasm module): a grid of
 * `segs + 1` rows by `BLADE_GRID_COLS + 1` columns by 2 sides with positions, index, normals and tangents, plus grid
 * UVs and the glow COLOR_0 when `blade.glow` is on. Same attribute order and values as the TypeScript builder it
 * replaced (BG1).
 */
export function buildBladeGeometry(b: BladeParams): THREE.BufferGeometry {
  const r = callCore('blade', b);
  return toGeometry(r, r.meshes[0], ['position', 'index', 'normal', 'tangent', 'uv', 'color'], {
    boundingBox: true,
  });
}

/**
 * The blade as exported (SW1's export preparation, `prepareExport`): grid UVs, the broad faces' winding made
 * outward-facing (`buildBladeGeometry` winds them inward; the site's material is double-sided), normals and
 * tangents recomputed. bladegen-core's `blade::prepare_export`.
 */
export function bladeExportGeometry(b: BladeParams): THREE.BufferGeometry {
  const r = callCore('blade_export', b);
  return toGeometry(r, r.meshes[0], ['position', 'index', 'normal', 'tangent', 'uv', 'color'], {
    boundingBox: true,
  });
}

/**
 * Build overlay ribbons for fullers (grooves) that sit slightly above the blade
 * surface using polygon offset to avoid z-fighting.
 */
export function buildFullerOverlays(b: BladeParams): THREE.Group {
  const group = new THREE.Group();
  const hasExplicitFullers = Array.isArray((b as any).fullers) && (b as any).fullers.length > 0;
  if (!((b.fullerEnabled ?? false) || hasExplicitFullers)) return group;
  const totalLen = b.length;
  const resolved = resolveFullers(b);
  if (!resolved.length) return group;

  const color = 0xdfe6ff;
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.2,
    roughness: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });

  const halfTL = Math.max(0.001, (b.thicknessLeft ?? b.thickness ?? 0.08) * 0.5);
  const halfTR = Math.max(0.001, (b.thicknessRight ?? b.thickness ?? 0.08) * 0.5);
  const eps = 0.0006;
  const zFrontL = halfTL - eps;
  const zFrontR = halfTR - eps;

  const buildRibbon = (slot: ResolvedFuller, faceZ: number) => {
    const positions: number[] = [];
    const index: number[] = [];
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const t = slot.start + (slot.end - slot.start) * u;
      const y = t * totalLen;
      let width = tipWidthWithKissaki(b, t, b.baseWidth, b.tipWidth);
      const wav = wavinessAt(b, t);
      if (wav.width !== 0) width = Math.max(0.0005, width + wav.width * 2);
      const availableHalf = Math.max(0.001, width * 0.5);
      const bend = bendOffsetX(b, y, totalLen) + wav.center;
      const span = Math.max(1e-6, slot.end - slot.start);
      const along = THREE.MathUtils.clamp((t - slot.start) / span, 0, 1);
      const widthScale = Math.max(0.1, 1 - slot.taper * along);
      const halfSlot = Math.min(
        availableHalf * 0.95,
        Math.max(0.002, slot.width * 0.5 * widthScale)
      );
      const cx = bend + slot.offset;
      const left = cx - halfSlot;
      const right = cx + halfSlot;
      positions.push(left, y, faceZ, right, y, faceZ);
      if (i > 0) {
        const a = (i - 1) * 2;
        const bI = a + 1;
        const c = a + 2;
        const d = a + 3;
        index.push(a, bI, d, a, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  };

  for (const slot of resolved) {
    if (slot.mode !== 'overlay' && slot.depth <= 0) continue;
    const depthNorm = Math.max(0, Math.min(1, slot.depth / Math.max(1e-3, b.thickness ?? 0.08)));
    const frontBase = slot.side === 'right' ? zFrontR : zFrontL;
    const offsetZ = depthNorm * 0.5 * (slot.side === 'right' ? halfTR : halfTL);
    const frontZ = frontBase - Math.max(0.001, offsetZ + 0.001);
    const backZ = -frontZ;
    group.add(buildRibbon(slot, frontZ), buildRibbon(slot, backZ));
  }

  return group;
}

/**
 * Build hamon overlays: thin, slightly offset ribbons that follow each edge
 * with a wavy inner boundary.
 */
export function buildHamonOverlays(b: BladeParams): THREE.Group {
  const group = new THREE.Group();
  const totalLen = b.length;
  const segments = 96;
  const width = Math.max(0.002, b.hamonWidth ?? 0.015);
  const amp = Math.max(0, b.hamonAmplitude ?? 0.006);
  const freq = Math.max(0, b.hamonFrequency ?? 6);
  const color = 0xe3e7f3;
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.2,
    roughness: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });

  const halfTL = Math.max(0.001, (b.thicknessLeft ?? b.thickness ?? 0.08) * 0.5);
  const halfTR = Math.max(0.001, (b.thicknessRight ?? b.thickness ?? 0.08) * 0.5);
  const eps = 0.0006;
  const zFrontL = halfTL - eps;
  const zFrontR = halfTR - eps;

  const serrAmp = b.serrationAmplitude ?? 0;
  const serrAmpL = b.serrationAmplitudeLeft ?? serrAmp;
  const serrAmpR = b.serrationAmplitudeRight ?? serrAmp;
  const serrFreq = b.serrationFrequency ?? 0;

  const buildEdgeRibbon = (side: 'left' | 'right', z: number) => {
    const positions: number[] = [];
    const index: number[] = [];
    const pushV = (x: number, y: number) => {
      positions.push(x, y, z);
    };
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = t * totalLen;
      let widthAt = tipWidthWithKissaki(b, t, b.baseWidth, b.tipWidth);
      const waviness = wavinessAt(b, t);
      if (waviness.width !== 0) widthAt = Math.max(0.0005, widthAt + waviness.width * 2);
      const bend = bendOffsetX(b, y, totalLen) + waviness.center;
      const serr = side === 'right' ? serrAmpR : serrAmpL;
      const serrX =
        serr > 0 && serrFreq > 0 ? Math.sin(t * Math.PI * serrFreq) * serr * (1 - t) : 0;
      const halfBase = Math.max(0.001, widthAt * 0.5 + serrX);
      const edgeHalf = Math.max(0.001, halfBase + waviness.width);
      const edgeX = side === 'right' ? bend + edgeHalf : bend - edgeHalf;
      const dir = side === 'right' ? -1 : 1;
      const hamonWave = amp > 0 && freq > 0 ? Math.sin(t * Math.PI * freq) * amp : 0;
      const outer = edgeX + dir * 0.002;
      const inner = edgeX + dir * (width + hamonWave);
      pushV(outer, y);
      pushV(inner, y);
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const bIdx = a + 1;
      const c = a + 2;
      const d = a + 3;
      index.push(a, bIdx, d, a, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  };

  const sidePref = b.hamonSide ?? 'auto';
  const single = b.edgeType === 'single';
  const thinnerRight =
    (b.thicknessRight ?? b.thickness ?? 0.08) < (b.thicknessLeft ?? b.thickness ?? 0.08);
  const autoSide: 'left' | 'right' = thinnerRight ? 'right' : 'left';

  const wantLeft =
    sidePref === 'left' ||
    sidePref === 'both' ||
    (sidePref === 'auto' && (!single || autoSide === 'left'));
  const wantRight =
    sidePref === 'right' ||
    sidePref === 'both' ||
    (sidePref === 'auto' && (!single || autoSide === 'right'));

  if (wantLeft) {
    group.add(buildEdgeRibbon('left', zFrontL), buildEdgeRibbon('left', -zFrontL));
  }
  if (wantRight) {
    group.add(buildEdgeRibbon('right', zFrontR), buildEdgeRibbon('right', -zFrontR));
  }
  return group;
}

/**
 * Sample a dense outline of the blade cross-section for 2D export or UI display.
 * Returns points in scene coordinates around the full closed outline.
 */
export function buildBladeOutlinePoints(b: BladeParams): THREE.Vector2[] {
  const length = Math.max(0.01, b.length);
  const baseW = Math.max(0.002, b.baseWidth);
  const tipW = Math.max(0, b.tipWidth);
  const steps = 200;
  const serrAmp = b.serrationAmplitude ?? 0;
  const serrAmpL = b.serrationAmplitudeLeft ?? serrAmp;
  const serrAmpR = b.serrationAmplitudeRight ?? serrAmp;
  const serrFreq = b.serrationFrequency ?? 0;
  const serPat = b.serrationPattern ?? 'sine';
  const serSeed = b.serrationSeed ?? 1337;
  const sharpOutline = THREE.MathUtils.clamp((b as any).serrationSharpness ?? 0, 0, 1);
  const biasOutlineL = THREE.MathUtils.clamp((b as any).serrationLeanLeft ?? 0, -1, 1);
  const biasOutlineR = THREE.MathUtils.clamp((b as any).serrationLeanRight ?? 0, -1, 1);
  const serr = (t: number, freq: number, amp: number, bias: number, offset = 0) =>
    serrationWave(t, freq, amp, serPat, serSeed + offset, sharpOutline, bias);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * length;
    let w = tipWidthWithKissaki(b, t, baseW, tipW);
    const wav = wavinessAt(b, t);
    if (wav.width !== 0) w = Math.max(0.0005, w + wav.width * 2);
    const serrR = serr(t, serrFreq, serrAmpR, biasOutlineR) * (1 - t);
    const half = Math.max(0.001, w * 0.5);
    const asym = b.asymmetry ?? 0;
    let rightHalf = Math.max(0.0005, (half + serrR) * (1 + 0.5 * asym));
    rightHalf = Math.max(0.0005, rightHalf + wav.width);
    const bend = bendOffsetX(b, y, length) + wav.center;
    pts.push(new THREE.Vector2(+rightHalf + bend, y));
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const y = t * length;
    let w = tipWidthWithKissaki(b, t, baseW, tipW);
    const wav = wavinessAt(b, t);
    if (wav.width !== 0) w = Math.max(0.0005, w + wav.width * 2);
    const serrL = serr(t, serrFreq, serrAmpL, biasOutlineL, 7) * (1 - t);
    const half = Math.max(0.001, w * 0.5);
    const asym = b.asymmetry ?? 0;
    let leftHalf = Math.max(0.0005, (half + serrL) * (1 - 0.5 * asym));
    leftHalf = Math.max(0.0005, leftHalf + wav.width);
    const bend = bendOffsetX(b, y, length) + wav.center;
    pts.push(new THREE.Vector2(-leftHalf + bend, y));
  }
  return pts;
}

/**
 * Convert a closed polyline outline into a simple SVG path string wrapped in an SVG document.
 */
export function bladeOutlineToSVG(points: THREE.Vector2[], stroke = '#111827'): string {
  if (!points.length) return '';
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 10;
  const width = maxX - minX;
  const height = maxY - minY;
  const sx = pad - minX;
  const sy = pad - minY;
  let d = '';
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    d +=
      (i === 0 ? 'M' : 'L') +
      (p.x + sx).toFixed(3) +
      ' ' +
      (height + pad * 2 - (p.y + sy)).toFixed(3) +
      ' ';
  }
  d += 'Z';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${(width + pad * 2).toFixed(2)}" height="${(height + pad * 2).toFixed(2)}" viewBox="0 0 ${(width + pad * 2).toFixed(2)} ${(height + pad * 2).toFixed(2)}" preserveAspectRatio="xMidYMid meet">\n  <path d="${d}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>\n</svg>`;
  return svg;
}
