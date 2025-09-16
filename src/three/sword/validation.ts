import type { BladeParams, GuardParams, GuardStyle, HandleParams, PommelParams, PommelStyle, SwordParams } from './types'

/**
 * Clamp helper to bound numeric values.
 */
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * Validate and normalize a SwordParams object.
 * - Clamps numeric ranges to sane bounds to keep geometry stable.
 * - Fills defaults for optional fields and coerces enums.
 * - Returns a new object; does not mutate the input.
 */
export function validateSwordParams(params: SwordParams): SwordParams {
  const b = params.blade
  const blade: BladeParams = {
    length: clamp(b.length, 0.1, 20),
    baseWidth: clamp(b.baseWidth, 0.02, 5),
    tipWidth: clamp(b.tipWidth, 0, 5),
    thickness: clamp(b.thickness, 0.01, 2),
    curvature: clamp(b.curvature, -1, 1),
    serrationAmplitude: clamp(b.serrationAmplitude ?? 0, 0, (b.baseWidth || 0.2) / 3),
    serrationAmplitudeLeft: clamp((b.serrationAmplitudeLeft ?? b.serrationAmplitude ?? 0), 0, (b.baseWidth || 0.2) / 3),
    serrationAmplitudeRight: clamp((b.serrationAmplitudeRight ?? b.serrationAmplitude ?? 0), 0, (b.baseWidth || 0.2) / 3),
    serrationFrequency: clamp(b.serrationFrequency ?? 0, 0, 40),
    fullerDepth: clamp(b.fullerDepth ?? 0, 0, 0.2),
    fullerLength: clamp(b.fullerLength ?? 0, 0, 1),
    fullerEnabled: !!b.fullerEnabled,
    fullerCount: Math.round(clamp(b.fullerCount ?? 1, 0, 3)),
    fullerMode: (b.fullerMode ?? 'overlay') as any,
    fullerProfile: (b.fullerProfile ?? 'u') as any,
    fullerWidth: clamp(b.fullerWidth ?? 0, 0, (b.baseWidth || 0.25)),
    fullerInset: clamp(b.fullerInset ?? (b.fullerDepth ?? 0), 0, 0.2),
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
    hamonEnabled: !!b.hamonEnabled,
    hamonWidth: clamp(b.hamonWidth ?? 0, 0, Math.max(0.02, (b.baseWidth || 0.25) * 0.5)),
    hamonAmplitude: clamp(b.hamonAmplitude ?? 0, 0, Math.max(0.005, (b.baseWidth || 0.25) * 0.2)),
    hamonFrequency: clamp(b.hamonFrequency ?? 0, 0, 30),
    hamonSide: (b.hamonSide ?? 'auto') as any,
    serrationPattern: (b.serrationPattern ?? 'sine') as any,
    serrationSeed: Math.round(clamp(b.serrationSeed ?? 1337, 0, 999999)),
    twistAngle: clamp(b.twistAngle ?? 0, -Math.PI * 2, Math.PI * 2),
    crossSection: (b.crossSection ?? 'flat') as any,
    bevel: clamp(b.bevel ?? 0.5, 0, 1),
    tipShape: (b.tipShape ?? 'pointed') as any,
    tipBulge: clamp(b.tipBulge ?? 0.2, 0, 1),
    engravings: Array.isArray((b as any).engravings) ? (b as any).engravings : undefined,
    ricassoLength: clamp((b as any).ricassoLength ?? 0, 0, 0.3),
    falseEdgeLength: clamp((b as any).falseEdgeLength ?? 0, 0, 1),
    falseEdgeDepth: clamp((b as any).falseEdgeDepth ?? 0, 0, 0.2)
  }

  const g = params.guard
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
    extras: Array.isArray((g as any).extras) ? (g as any).extras.map((e: any) => ({
      kind: (e.kind ?? 'sideRing') as any,
      radius: clamp(e.radius ?? 0.12, 0.01, 0.6),
      thickness: clamp(e.thickness ?? 0.03, 0.005, 0.2),
      offsetY: clamp(e.offsetY ?? 0, -0.5, 0.5),
      offsetX: clamp(e.offsetX ?? 0, -0.5, 0.5),
      tilt: clamp(e.tilt ?? 0, -Math.PI/2, Math.PI/2)
    })) : undefined
  }

  const h = params.handle
  const handle: HandleParams = {
    length: clamp(h.length, 0.2, 5),
    radiusTop: clamp(h.radiusTop, 0.05, 1),
    radiusBottom: clamp(h.radiusBottom, 0.05, 1),
    segmentation: !!h.segmentation,
    // Additional shaping controls
    curvature: clamp((h as any).curvature ?? 0, -0.2, 0.2),
    // Optional ridge count and flare retained if present on incoming params
    // (not part of strict HandleParams typing but used by the generator)
    ...(typeof (h as any).segmentationCount === 'number' ? { segmentationCount: Math.round(clamp((h as any).segmentationCount, 0, 64)) } : {} as any),
    ...(typeof (h as any).flare === 'number' ? { flare: clamp((h as any).flare, 0, 0.2) } : {} as any),
    wrapEnabled: !!h.wrapEnabled,
    wrapTurns: clamp(h.wrapTurns ?? 6, 0, 40),
    wrapDepth: clamp(h.wrapDepth ?? 0.015, 0, 0.08),
    phiSegments: Math.round(clamp(h.phiSegments ?? 64, 8, 128)),
    wrapTexture: !!h.wrapTexture,
    wrapTexScale: clamp(h.wrapTexScale ?? 10, 1, 64),
    wrapTexAngle: clamp(h.wrapTexAngle ?? (Math.PI / 4), -Math.PI, Math.PI),
    ovalRatio: clamp(h.ovalRatio ?? 1, 1, 3),
    tangVisible: !!h.tangVisible,
    tangWidth: clamp(h.tangWidth ?? 0.05, 0.005, 0.3),
    tangThickness: clamp(h.tangThickness ?? 0.02, 0.005, 0.2),
    handleLayers: Array.isArray((h as any).handleLayers) ? (h as any).handleLayers : undefined,
    menuki: Array.isArray((h as any).menuki) ? (h as any).menuki : undefined,
    rivets: Array.isArray((h as any).rivets) ? (h as any).rivets : undefined
  }

  const p = params.pommel
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
    ringInnerRadius: clamp(p.ringInnerRadius ?? (p.size * 0.4), 0.005, 1),
    crownSpikes: Math.round(clamp(p.crownSpikes ?? 8, 3, 24)),
    crownSharpness: clamp(p.crownSharpness ?? 0.6, 0, 1)
  }

  return {
    blade,
    guard,
    handle,
    pommel,
    hiltEnabled: (params as any).hiltEnabled === undefined ? true : !!(params as any).hiltEnabled,
    guardEnabled: (params as any).guardEnabled === undefined ? true : !!(params as any).guardEnabled,
    useRatios: !!params.useRatios,
    ratios: params.ratios ? {
      guardWidthToBlade: typeof params.ratios.guardWidthToBlade === 'number' ? clamp(params.ratios.guardWidthToBlade, 0.01, 10) : undefined,
      handleLengthToBlade: typeof params.ratios.handleLengthToBlade === 'number' ? clamp(params.ratios.handleLengthToBlade, 0.01, 10) : undefined,
      pommelSizeToBlade: typeof params.ratios.pommelSizeToBlade === 'number' ? clamp(params.ratios.pommelSizeToBlade, 0.01, 10) : undefined,
    } : undefined
  }
}
