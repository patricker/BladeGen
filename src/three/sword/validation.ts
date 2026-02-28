import type {
  BladeParams,
  GuardParams,
  GuardStyle,
  HandleParams,
  PommelParams,
  PommelStyle,
  SwordParams,
  BladeWaviness,
  HollowGrindProfile,
  FullerSlot,
  FullerFaceConfig,
  AccessoriesParams,
  ScabbardParams,
  TasselParams,
} from './types';

/**
 * Clamp helper to bound numeric values.
 */
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const sanitizeProfilePoints = (
  points: any,
  clampT = (t: number) => clamp(t, 0, 1),
  clampV = (v: number) => v
) => {
  if (!Array.isArray(points)) return undefined;
  const sanitized: Array<[number, number]> = [];
  for (const entry of points) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    let [t, val] = entry as [number, number];
    if (!Number.isFinite(t) || !Number.isFinite(val)) continue;
    t = clampT(t);
    val = clampV(val);
    sanitized.push([t, val]);
  }
  if (sanitized.length < 2) return undefined;
  sanitized.sort((a, b) => a[0] - b[0]);
  const dedup: Array<[number, number]> = [];
  for (const pt of sanitized) {
    if (dedup.length && Math.abs(dedup[dedup.length - 1][0] - pt[0]) < 1e-4) {
      dedup[dedup.length - 1] = pt;
    } else {
      dedup.push(pt);
    }
  }
  return dedup.length >= 2 ? dedup : undefined;
};

const sanitizeCurveProfile = (b: any): BladeParams['curveProfile'] | undefined => {
  if (!b || !Array.isArray(b.points)) return undefined;
  const mode: 'absolute' | 'relative' = b.mode === 'relative' ? 'relative' : 'absolute';
  const scale = clamp(typeof b.scale === 'number' ? b.scale : 1, 0, 5);
  const points = sanitizeProfilePoints(
    b.points,
    (t) => clamp(t, 0, 1),
    (v) => clamp(v, -5, 5)
  );
  if (!points) return undefined;
  return { points, mode, scale };
};

const sanitizeWidthProfile = (b: any): BladeParams['widthProfile'] | undefined => {
  if (!b || !Array.isArray(b.points)) return undefined;
  const mode: 'scale' | 'absolute' = b.mode === 'absolute' ? 'absolute' : 'scale';
  const points = sanitizeProfilePoints(
    b.points,
    (t) => clamp(t, 0, 1),
    (v) => (mode === 'absolute' ? clamp(v, 0.02, 10) : clamp(v, 0.1, 5))
  );
  if (!points) return undefined;
  return { points, mode };
};

const sanitizeWaviness = (raw: any, baseWidth: number): BladeWaviness | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const amplitude = clamp(
    typeof raw.amplitude === 'number' ? raw.amplitude : 0,
    0,
    Math.max(0.001, baseWidth * 1.2)
  );
  const frequency = clamp(typeof raw.frequency === 'number' ? raw.frequency : 0, 0, 24);
  if (amplitude <= 0 || frequency <= 0) return undefined;
  const phase = clamp(typeof raw.phase === 'number' ? raw.phase : 0, -Math.PI * 8, Math.PI * 8);
  const taper = clamp(typeof raw.taper === 'number' ? raw.taper : 0, 0, 6);
  const offset = clamp(
    typeof raw.offset === 'number' ? raw.offset : 0,
    -Math.max(0.5, baseWidth),
    Math.max(0.5, baseWidth)
  );
  const mode: BladeWaviness['mode'] =
    raw.mode === 'centerline' || raw.mode === 'both' ? raw.mode : 'width';
  return { amplitude, frequency, phase, taper, offset, mode };
};

const sanitizeHollowGrind = (raw: any): HollowGrindProfile | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const enabled = !!raw.enabled;
  const mix = clamp(typeof raw.mix === 'number' ? raw.mix : enabled ? 0.65 : 0, 0, 1);
  const depth = clamp(typeof raw.depth === 'number' ? raw.depth : 0.45, 0, 1);
  const radius = clamp(typeof raw.radius === 'number' ? raw.radius : 0.6, 0.1, 6);
  const bias = clamp(typeof raw.bias === 'number' ? raw.bias : 0, -1, 1);
  if (!enabled && mix <= 0) return undefined;
  return { enabled, mix, depth, radius, bias };
};

const sanitizeFullers = (raw: any, blade: BladeParams): Array<FullerSlot> | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const result: Array<FullerSlot> = [];
  const maxOffset = Math.max(0.05, blade.baseWidth * 0.6);
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const side: FullerSlot['side'] =
      entry.side === 'left' || entry.side === 'right' ? entry.side : 'both';
    const width = clamp(
      typeof entry.width === 'number' ? entry.width : (blade.baseWidth || 0.25) * 0.3,
      0.005,
      Math.max(0.05, blade.baseWidth * 0.9)
    );
    const offsetFromSpine = clamp(
      typeof entry.offsetFromSpine === 'number' ? entry.offsetFromSpine : 0,
      -maxOffset,
      maxOffset
    );
    const depth = clamp(
      typeof entry.depth === 'number' ? entry.depth : (blade.fullerDepth ?? 0.02),
      0,
      0.2
    );
    const inset = clamp(
      typeof entry.inset === 'number' ? entry.inset : (blade.fullerInset ?? depth),
      0,
      0.2
    );
    let start = clamp(typeof entry.start === 'number' ? entry.start : 0.05, 0, 0.98);
    let end = clamp(typeof entry.end === 'number' ? entry.end : 0.95, 0, 1);
    if (end - start < 0.02) end = Math.min(1, start + 0.02);
    if (end <= start) continue;
    const profile: FullerSlot['profile'] =
      entry.profile === 'v' || entry.profile === 'flat' ? entry.profile : 'u';
    const mode: FullerSlot['mode'] = entry.mode === 'carve' ? 'carve' : 'overlay';
    const taper = clamp(typeof entry.taper === 'number' ? entry.taper : 0, 0, 1);
    result.push({ side, width, offsetFromSpine, depth, inset, start, end, profile, mode, taper });
  }
  return result.length ? result : undefined;
};

const sanitizeFullerFaces = (
  raw: any,
  blade: BladeParams
): { faces: FullerFaceConfig; slots: Array<FullerSlot> } | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const combined: any[] = [];
  const collect = (side: 'left' | 'right') => {
    const entries = Array.isArray(raw[side]) ? raw[side] : [];
    for (const entry of entries.slice(0, 3)) {
      if (!entry || typeof entry !== 'object') continue;
      combined.push({ ...entry, side });
    }
  };
  collect('left');
  collect('right');
  if (!combined.length) return undefined;
  const slots = sanitizeFullers(combined, blade);
  if (!slots || !slots.length) return undefined;
  const faces: FullerFaceConfig = {};
  for (const slot of slots) {
    const { side, ...rest } = slot;
    if (!side) continue;
    const arr = (faces[side] ??= []);
    arr.push(rest);
  }
  return { faces, slots };
};

const buildLegacyFullers = (blade: BladeParams): Array<FullerSlot> | undefined => {
  if (!(blade.fullerEnabled ?? false)) return undefined;
  const count = Math.max(0, Math.min(3, Math.round(blade.fullerCount ?? 0)));
  if (count <= 0) return undefined;
  const width =
    blade.fullerWidth && blade.fullerWidth > 0
      ? blade.fullerWidth
      : (blade.baseWidth || 0.25) * 0.3;
  const depth = blade.fullerDepth ?? 0.02;
  const inset = blade.fullerInset ?? depth;
  const profile: FullerSlot['profile'] =
    blade.fullerProfile === 'v' || blade.fullerProfile === 'flat' ? blade.fullerProfile : 'u';
  const mode: FullerSlot['mode'] = blade.fullerMode === 'carve' ? 'carve' : 'overlay';
  const offsets: number[] = [];
  if (count === 1) offsets.push(0);
  else if (count === 2) {
    const off = (blade.baseWidth || 0.3) * 0.12;
    offsets.push(-off, off);
  } else {
    const off = (blade.baseWidth || 0.3) * 0.14;
    offsets.push(0, -off, off);
  }
  const len = clamp(blade.fullerLength ?? 0.8, 0, 1);
  const start = 0.05;
  const remaining = Math.max(0.1, 0.9 - start);
  const end = Math.min(0.98, start + len * remaining);
  const fullers: Array<FullerSlot> = offsets.map((offsetFromSpine) => ({
    side: 'both',
    offsetFromSpine,
    width,
    depth,
    inset,
    start,
    end,
    profile,
    mode,
    taper: 0,
  }));
  return fullers.length ? fullers : undefined;
};

/**
 * Validate and normalize a SwordParams object.
 * - Clamps numeric ranges to sane bounds to keep geometry stable.
 * - Fills defaults for optional fields and coerces enums.
 * - Returns a new object; does not mutate the input.
 */
export function validateSwordParams(params: SwordParams): SwordParams {
  const b = params.blade;
  const rawFamily = (b as any).family;
  const family: BladeParams['family'] =
    rawFamily === 'flamberge' || rawFamily === 'kris' ? rawFamily : 'straight';
  const blade: BladeParams = {
    family,
    length: clamp(b.length, 0.1, 20),
    baseWidth: clamp(b.baseWidth, 0.02, 5),
    tipWidth: clamp(b.tipWidth, 0, 5),
    thickness: clamp(b.thickness, 0.01, 2),
    curvature: clamp(b.curvature, -1, 1),
    serrationAmplitude: clamp(b.serrationAmplitude ?? 0, 0, (b.baseWidth || 0.2) / 3),
    serrationAmplitudeLeft: clamp(
      b.serrationAmplitudeLeft ?? b.serrationAmplitude ?? 0,
      0,
      (b.baseWidth || 0.2) / 3
    ),
    serrationAmplitudeRight: clamp(
      b.serrationAmplitudeRight ?? b.serrationAmplitude ?? 0,
      0,
      (b.baseWidth || 0.2) / 3
    ),
    serrationFrequency: clamp(b.serrationFrequency ?? 0, 0, 120),
    serrationSharpness: clamp((b as any).serrationSharpness ?? 0, 0, 1),
    serrationLeanLeft: clamp((b as any).serrationLeanLeft ?? 0, -1, 1),
    serrationLeanRight: clamp((b as any).serrationLeanRight ?? 0, -1, 1),
    fullerDepth: clamp(b.fullerDepth ?? 0, 0, 0.2),
    fullerLength: clamp(b.fullerLength ?? 0, 0, 1),
    fullerEnabled: !!b.fullerEnabled,
    fullerCount: Math.round(clamp(b.fullerCount ?? 1, 0, 3)),
    fullerMode: (b.fullerMode ?? 'overlay') as any,
    fullerProfile: (b.fullerProfile ?? 'u') as any,
    fullerWidth: clamp(b.fullerWidth ?? 0, 0, b.baseWidth || 0.25),
    fullerInset: clamp(b.fullerInset ?? b.fullerDepth ?? 0, 0, 0.2),
    sweepSegments: Math.round(clamp(b.sweepSegments ?? 128, 16, 512)),
    chaos: clamp(b.chaos ?? 0, 0, 1),
    asymmetry: clamp(b.asymmetry ?? 0, -1, 1),
    edgeType: (b.edgeType ?? 'double') as any,
    thicknessLeft: clamp(b.thicknessLeft ?? b.thickness ?? 0.08, 0.003, 2),
    thicknessRight: clamp(b.thicknessRight ?? b.thickness ?? 0.08, 0.003, 2),
    baseAngle: clamp(b.baseAngle ?? 0, -0.35, 0.35),
    soriProfile: (b.soriProfile ?? 'torii') as any,
    soriBias: clamp(b.soriBias ?? 0.8, 0.3, 3),
    kissakiLength: clamp(b.kissakiLength ?? 0, 0, 0.35),
    kissakiRoundness: clamp(b.kissakiRoundness ?? 0.5, 0, 1),
    tipRampStart: clamp((b as any).tipRampStart ?? 0, 0, 0.98),
    hamonEnabled: !!b.hamonEnabled,
    hamonWidth: clamp(b.hamonWidth ?? 0, 0, Math.max(0.02, (b.baseWidth || 0.25) * 0.5)),
    hamonAmplitude: clamp(b.hamonAmplitude ?? 0, 0, Math.max(0.005, (b.baseWidth || 0.25) * 0.2)),
    hamonFrequency: clamp(b.hamonFrequency ?? 0, 0, 30),
    hamonSide: (b.hamonSide ?? 'auto') as any,
    serrationPattern: (b.serrationPattern ?? 'sine') as any,
    serrationSeed: Math.round(clamp(b.serrationSeed ?? 1337, 0, 999999)),
    // Allow generous multi-turn twists (±12π ≈ ±2160°)
    twistAngle: clamp(b.twistAngle ?? 0, -Math.PI * 12, Math.PI * 12),
    crossSection: (b.crossSection ?? 'flat') as any,
    bevel: clamp(b.bevel ?? 0.5, 0, 1),
    tipShape: (b.tipShape ?? 'pointed') as any,
    tipBulge: clamp(b.tipBulge ?? 0.2, 0, 1),
    // Clone engravings array to avoid sharing references with incoming params.
    // Sharing would make change detection think nothing changed when UI mutates
    // objects in-place, preventing rebuilds (e.g., engraving knobs not updating).
    engravings: Array.isArray((b as any).engravings)
      ? (b as any).engravings.map((e: any) => ({
          ...e,
          depth: clamp(typeof e.depth === 'number' ? e.depth : 0.002, 0.0005, 0.1),
          width: clamp(typeof e.width === 'number' ? e.width : 0.1, 0.005, 5),
          height: clamp(typeof e.height === 'number' ? e.height : 0.02, 0.005, 2),
        }))
      : undefined,
    ricassoLength: clamp((b as any).ricassoLength ?? 0, 0, 0.3),
    falseEdgeLength: clamp((b as any).falseEdgeLength ?? 0, 0, 1),
    falseEdgeDepth: clamp((b as any).falseEdgeDepth ?? 0, 0, 0.2),
  };

  const allowedCrossSections = [
    'flat',
    'lenticular',
    'diamond',
    'hexagonal',
    'triangular',
    'tSpine',
    'compound',
  ] as const;
  if (!allowedCrossSections.includes((blade.crossSection ?? 'flat') as any)) {
    blade.crossSection = 'flat';
  }

  if (family === 'kris' || typeof (b as any).krisWaveCount === 'number') {
    let waves = clamp(Math.round((b as any).krisWaveCount ?? 7), 1, 21);
    if (waves % 2 === 0) {
      waves = waves >= 21 ? waves - 1 : waves + 1;
    }
    blade.krisWaveCount = waves;
  }

  const curveProfile = sanitizeCurveProfile(b.curveProfile);
  if (curveProfile) blade.curveProfile = curveProfile;
  const widthProfile = sanitizeWidthProfile(b.widthProfile);
  if (widthProfile) blade.widthProfile = widthProfile;
  const thicknessPts = sanitizeProfilePoints(
    b.thicknessProfile?.points,
    (t) => clamp(t, 0, 1),
    (v) => clamp(v, 0.05, 5)
  );
  if (thicknessPts) blade.thicknessProfile = { points: thicknessPts };
  const waviness = sanitizeWaviness((b as any).waviness, blade.baseWidth);
  if (waviness) blade.waviness = waviness;
  if (!blade.waviness) {
    if (family === 'flamberge') {
      const baseAmp = clamp(blade.baseWidth * 0.14, 0.001, Math.max(0.002, blade.baseWidth * 1.0));
      const waves = clamp(Math.round(blade.length * 3.5), 3, 18);
      blade.waviness = {
        amplitude: baseAmp,
        frequency: waves,
        mode: 'both',
        taper: 1.2,
        phase: 0,
        offset: 0,
      };
    } else if (family === 'kris') {
      const waves = blade.krisWaveCount ?? 7;
      const amp = clamp(blade.baseWidth * 0.18, 0.001, Math.max(0.004, blade.baseWidth * 1.2));
      blade.waviness = {
        amplitude: amp,
        frequency: waves,
        mode: 'centerline',
        taper: 0.6,
        phase: 0,
        offset: 0,
      };
    }
  }
  const hollow = sanitizeHollowGrind((b as any).hollowGrind);
  if (hollow) blade.hollowGrind = hollow;
  const faceFullers = sanitizeFullerFaces((b as any).fullerFaces, blade);
  if (faceFullers) {
    blade.fullerFaces = faceFullers.faces;
    blade.fullers = faceFullers.slots;
    blade.fullerEnabled = true;
  } else {
    const advancedFullers = sanitizeFullers((b as any).fullers, blade);
    if (advancedFullers && advancedFullers.length) {
      blade.fullers = advancedFullers;
      blade.fullerEnabled = true;
    } else {
      const legacy = buildLegacyFullers(blade);
      if (legacy) {
        blade.fullers = legacy;
        blade.fullerEnabled = true;
      }
    }
  }

  const g = params.guard;
  const guard: GuardParams = {
    width: clamp(g.width, 0.2, 10),
    thickness: clamp(g.thickness, 0.05, 2),
    curve: clamp(g.curve, -1, 1),
    tilt: clamp(g.tilt, -Math.PI / 2, Math.PI / 2),
    style: (g.style ?? 'bar') as GuardStyle,
    curveSegments: Math.round(clamp(g.curveSegments ?? 12, 3, 64)),
    habakiEnabled: !!g.habakiEnabled,
    habakiHeight: clamp(g.habakiHeight ?? 0.06, 0.02, 0.2),
    habakiMargin: clamp(g.habakiMargin ?? 0.01, 0.002, 0.08),
    heightOffset: clamp(g.heightOffset ?? 0, -0.5, 0.5),
    quillonCount: Math.round(clamp(g.quillonCount ?? 0, 0, 4)),
    quillonLength: clamp(g.quillonLength ?? 0.25, 0.05, 1.5),
    ornamentation: clamp(g.ornamentation ?? 0, 0, 1),
    tipSharpness: clamp(g.tipSharpness ?? 0.5, 0, 1),
    cutoutCount: Math.round(clamp(g.cutoutCount ?? 0, 0, 12)),
    cutoutRadius: clamp(g.cutoutRadius ?? 0.5, 0.1, 0.8),
    guardBlendFillet: clamp((g as any).guardBlendFillet ?? 0, 0, 1),
    extras: Array.isArray((g as any).extras)
      ? (g as any).extras.map((e: any) => ({
          kind: (e.kind ?? 'sideRing') as any,
          radius: clamp(e.radius ?? 0.12, 0.01, 0.6),
          thickness: clamp(e.thickness ?? 0.03, 0.005, 0.2),
          offsetY: clamp(e.offsetY ?? 0, -0.5, 0.5),
          offsetX: clamp(e.offsetX ?? 0, -0.5, 0.5),
          tilt: clamp(e.tilt ?? 0, -Math.PI / 2, Math.PI / 2),
        }))
      : undefined,
    basketRodCount: Math.round(clamp((g as any).basketRodCount ?? 12, 4, 64)),
    basketRodRadius: clamp((g as any).basketRodRadius ?? g.thickness * 0.18, 0.001, 0.2),
    basketRingCount: Math.round(clamp((g as any).basketRingCount ?? 1, 0, 2)),
    basketRingRadiusAdd: clamp((g as any).basketRingRadiusAdd ?? 0, 0, 0.5),
    basketRingThickness: clamp((g as any).basketRingThickness ?? 0.012, 0.001, 0.2),
    guardBlendFilletStyle: ((g as any).guardBlendFilletStyle ?? 'box') as any,
    shellCoverage: clamp((g as any).shellCoverage ?? 0.75, 0.3, 1),
    shellThickness: clamp((g as any).shellThickness ?? 1, 0.2, 1.5),
    shellFlare: clamp((g as any).shellFlare ?? 1, 0.5, 2),
    pasDaneCount: Math.round(clamp((g as any).pasDaneCount ?? 0, 0, 2)),
    pasDaneRadius: clamp((g as any).pasDaneRadius ?? 0.05, 0.01, 0.15),
    pasDaneThickness: clamp((g as any).pasDaneThickness ?? 0.01, 0.002, 0.06),
    pasDaneOffsetY: clamp((g as any).pasDaneOffsetY ?? 0, -0.2, 0.2),
  };

  const langRaw = (g as any).langets;
  if (langRaw && (langRaw.enabled ?? false)) {
    guard.langets = {
      enabled: true,
      length: clamp(langRaw.length ?? 0.12, 0.02, 0.4),
      width: clamp(langRaw.width ?? 0.04, 0.005, 0.2),
      thickness: clamp(langRaw.thickness ?? 0.01, 0.002, 0.08),
      chamfer: clamp(langRaw.chamfer ?? 0, 0, 0.5),
    };
  } else if (guard.langets) {
    delete guard.langets;
  }

  const h = params.handle;
  const handle: HandleParams = {
    length: clamp(h.length, 0.2, 5),
    radiusTop: clamp(h.radiusTop, 0.05, 1),
    radiusBottom: clamp(h.radiusBottom, 0.05, 1),
    segmentation: !!h.segmentation,
    // Additional shaping controls
    curvature: clamp((h as any).curvature ?? 0, -0.2, 0.2),
    // Optional ridge count and flare retained if present on incoming params
    // (not part of strict HandleParams typing but used by the generator)
    ...(typeof (h as any).segmentationCount === 'number'
      ? { segmentationCount: Math.round(clamp((h as any).segmentationCount, 0, 64)) }
      : ({} as any)),
    ...(typeof (h as any).flare === 'number'
      ? { flare: clamp((h as any).flare, 0, 0.2) }
      : ({} as any)),
    wrapEnabled: !!h.wrapEnabled,
    wrapTurns: clamp(h.wrapTurns ?? 6, 0, 40),
    wrapDepth: clamp(h.wrapDepth ?? 0.015, 0, 0.08),
    phiSegments: Math.round(clamp(h.phiSegments ?? 64, 8, 128)),
    wrapTexture: !!h.wrapTexture,
    wrapTexScale: clamp(h.wrapTexScale ?? 10, 1, 64),
    wrapTexAngle: clamp(h.wrapTexAngle ?? Math.PI / 4, -Math.PI, Math.PI),
    ovalRatio: clamp(h.ovalRatio ?? 1, 1, 3),
    tangVisible: !!h.tangVisible,
    tangWidth: clamp(h.tangWidth ?? 0.05, 0.005, 0.3),
    tangThickness: clamp(h.tangThickness ?? 0.02, 0.005, 0.2),
    handleLayers: Array.isArray((h as any).handleLayers) ? (h as any).handleLayers : undefined,
    menuki: Array.isArray((h as any).menuki) ? (h as any).menuki : undefined,
    rivets: Array.isArray((h as any).rivets)
      ? (h as any).rivets.map((rv: any) => ({
          ...rv,
          count: Math.round(clamp(typeof rv.count === 'number' ? rv.count : 1, 1, 20)),
          radius: clamp(typeof rv.radius === 'number' ? rv.radius : 0.01, 0.002, 0.1),
          ringFrac: clamp(typeof rv.ringFrac === 'number' ? rv.ringFrac : 0.5, 0, 1),
        }))
      : undefined,
    wrapStyle: ((h as any).wrapStyle ?? 'none') as any,
    menukiPreset: ((h as any).menukiPreset ?? 'none') as any,
  };

  if (!['none', 'crisscross', 'hineri', 'katate', 'wire'].includes(handle.wrapStyle as any))
    handle.wrapStyle = 'none';
  if (!['none', 'katana', 'paired'].includes(handle.menukiPreset as any))
    handle.menukiPreset = 'none';

  const rayskinRaw = (h as any).rayskin;
  if (rayskinRaw && (rayskinRaw.enabled || typeof rayskinRaw.scale === 'number')) {
    handle.rayskin = {
      enabled: !!rayskinRaw.enabled,
      scale: clamp(rayskinRaw.scale ?? 0.01, 0.001, 0.05),
      intensity: clamp(rayskinRaw.intensity ?? 0.6, 0, 1),
    };
  }

  const hasExplicitMenuki = Array.isArray(handle.menuki) && handle.menuki.length > 0;
  if (!hasExplicitMenuki) {
    if (handle.menukiPreset === 'katana') {
      handle.menuki = [
        { positionFrac: 0.35, side: 'left', size: 0.018 },
        { positionFrac: 0.62, side: 'right', size: 0.018 },
      ] as any;
    } else if (handle.menukiPreset === 'paired') {
      handle.menuki = [
        { positionFrac: 0.5, side: 'left', size: 0.02 },
        { positionFrac: 0.5, side: 'right', size: 0.02 },
      ] as any;
    }
  }

  const p = params.pommel;
  const pommel: PommelParams = {
    size: clamp(p.size, 0.05, 1),
    elongation: clamp(p.elongation, 0.3, 3),
    style: (p.style ?? 'orb') as PommelStyle,
    shapeMorph: clamp(p.shapeMorph ?? 0.2, 0, 1),
    offsetX: clamp(p.offsetX ?? 0, -0.5, 0.5),
    offsetY: clamp(p.offsetY ?? 0, -0.5, 0.5),
    facetCount: Math.round(clamp(p.facetCount ?? 32, 3, 128)),
    spikeLength: clamp(p.spikeLength ?? 1, 0.2, 3),
    balance: clamp(p.balance ?? 0, 0, 1),
    ringInnerRadius: clamp(p.ringInnerRadius ?? p.size * 0.4, 0.005, 1),
    crownSpikes: Math.round(clamp(p.crownSpikes ?? 8, 3, 24)),
    crownSharpness: clamp(p.crownSharpness ?? 0.6, 0, 1),
    peenVisible: !!(p as any).peenVisible,
    peenSize: clamp((p as any).peenSize ?? 0.02, 0.005, 0.1),
    peenShape: ((p as any).peenShape ?? 'dome') as any,
  };

  if (!['dome', 'block'].includes(pommel.peenShape as any)) pommel.peenShape = 'dome';

  const rawAccessories =
    (params as any).accessories && typeof (params as any).accessories === 'object'
      ? (params as any).accessories
      : {};
  const rawScabbard =
    rawAccessories && typeof rawAccessories.scabbard === 'object' ? rawAccessories.scabbard : {};
  const rawTassel =
    rawAccessories && typeof rawAccessories.tassel === 'object' ? rawAccessories.tassel : {};

  const scabbard: ScabbardParams = {
    enabled: !!rawScabbard.enabled,
    bodyMargin: clamp(
      typeof rawScabbard.bodyMargin === 'number' ? rawScabbard.bodyMargin : 0.035,
      0.002,
      0.4
    ),
    bodyThickness: clamp(
      typeof rawScabbard.bodyThickness === 'number' ? rawScabbard.bodyThickness : 0.12,
      0.02,
      0.8
    ),
    tipExtension: clamp(
      typeof rawScabbard.tipExtension === 'number' ? rawScabbard.tipExtension : 0.06,
      0,
      0.5
    ),
    throatLength: clamp(
      typeof rawScabbard.throatLength === 'number' ? rawScabbard.throatLength : 0.08,
      0,
      0.5
    ),
    throatScale: clamp(
      typeof rawScabbard.throatScale === 'number' ? rawScabbard.throatScale : 1.12,
      1,
      3
    ),
    locketOffset: clamp(
      typeof rawScabbard.locketOffset === 'number' ? rawScabbard.locketOffset : 0.18,
      0,
      0.9
    ),
    locketLength: clamp(
      typeof rawScabbard.locketLength === 'number' ? rawScabbard.locketLength : 0.12,
      0,
      0.6
    ),
    locketScale: clamp(
      typeof rawScabbard.locketScale === 'number' ? rawScabbard.locketScale : 1.05,
      1,
      2.5
    ),
    chapeLength: clamp(
      typeof rawScabbard.chapeLength === 'number' ? rawScabbard.chapeLength : 0.22,
      0.01,
      0.7
    ),
    chapeScale: clamp(
      typeof rawScabbard.chapeScale === 'number' ? rawScabbard.chapeScale : 0.45,
      0.1,
      1
    ),
    bodyRoundness: clamp(
      typeof rawScabbard.bodyRoundness === 'number' ? rawScabbard.bodyRoundness : 0.5,
      0,
      1
    ),
    offsetX: clamp(typeof rawScabbard.offsetX === 'number' ? rawScabbard.offsetX : 0.16, -1, 1),
    offsetZ: clamp(typeof rawScabbard.offsetZ === 'number' ? rawScabbard.offsetZ : -0.02, -1, 1),
    hangAngle: clamp(
      typeof rawScabbard.hangAngle === 'number' ? rawScabbard.hangAngle : -0.18,
      -Math.PI / 2,
      Math.PI / 2
    ),
  };

  const tassel: TasselParams = {
    enabled: !!rawTassel.enabled,
    attachTo: rawTassel.attachTo === 'scabbard' ? 'scabbard' : 'guard',
    anchorOffset: clamp(
      typeof rawTassel.anchorOffset === 'number' ? rawTassel.anchorOffset : 0.35,
      0,
      1
    ),
    length: clamp(typeof rawTassel.length === 'number' ? rawTassel.length : 0.55, 0.05, 2.5),
    droop: clamp(typeof rawTassel.droop === 'number' ? rawTassel.droop : 0.55, 0, 1),
    sway: clamp(typeof rawTassel.sway === 'number' ? rawTassel.sway : 0.3, -1, 1),
    thickness: clamp(
      typeof rawTassel.thickness === 'number' ? rawTassel.thickness : 0.018,
      0.002,
      0.12
    ),
    tuftSize: clamp(typeof rawTassel.tuftSize === 'number' ? rawTassel.tuftSize : 0.05, 0.005, 0.4),
    tuftLength: clamp(
      typeof rawTassel.tuftLength === 'number' ? rawTassel.tuftLength : 0.14,
      0.01,
      0.6
    ),
    strands: Math.round(
      clamp(typeof rawTassel.strands === 'number' ? rawTassel.strands : 10, 1, 32)
    ),
  };

  const accessories: AccessoriesParams = { scabbard, tassel };

  return {
    blade,
    guard,
    handle,
    pommel,
    hiltEnabled: (params as any).hiltEnabled === undefined ? true : !!(params as any).hiltEnabled,
    guardEnabled:
      (params as any).guardEnabled === undefined ? true : !!(params as any).guardEnabled,
    useRatios: !!params.useRatios,
    ratios: params.ratios
      ? {
          guardWidthToBlade:
            typeof params.ratios.guardWidthToBlade === 'number'
              ? clamp(params.ratios.guardWidthToBlade, 0.01, 10)
              : undefined,
          handleLengthToBlade:
            typeof params.ratios.handleLengthToBlade === 'number'
              ? clamp(params.ratios.handleLengthToBlade, 0.01, 10)
              : undefined,
          pommelSizeToBlade:
            typeof params.ratios.pommelSizeToBlade === 'number'
              ? clamp(params.ratios.pommelSizeToBlade, 0.01, 10)
              : undefined,
        }
      : undefined,
    accessories,
  };
}
