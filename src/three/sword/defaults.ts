import type { SwordParams } from './types'

/**
 * Returns a fresh set of sensible default sword parameters.
 * These defaults are intentionally conservative so the initial render looks clean
 * (e.g. fullers disabled) while still exposing variety through the UI.
 */
export function defaultSwordParams(): SwordParams {
  return {
    blade: {
      family: 'straight',
      length: 3.0,
      baseWidth: 0.25,
      tipWidth: 0.05,
      thickness: 0.08,
      curvature: 0.0,
      tipRampStart: 0,
      serrationAmplitude: 0.0,
      serrationFrequency: 0,
      serrationSharpness: 0,
      serrationLeanLeft: 0,
      serrationLeanRight: 0,
      fullerDepth: 0.0,
      fullerLength: 0.0,
      fullerEnabled: false,
      sweepSegments: 128,
      chaos: 0.0,
      asymmetry: 0.0,
      edgeType: 'double',
      thicknessLeft: 0.08,
      thicknessRight: 0.08,
      baseAngle: 0.0,
      tipShape: 'pointed',
      tipBulge: 0.2
    },
    // Hilt (guard/handle/pommel) enabled by default
    hiltEnabled: true,
    // Guard enabled by default; allow disabling guard only
    guardEnabled: true,
    guard: {
      width: 1.2,
      thickness: 0.2,
      curve: 0.3,
      tilt: 0.0,
      style: 'winged',
      habakiEnabled: false,
      habakiHeight: 0.06,
      habakiMargin: 0.01,
      asymmetricArms: false,
      asymmetry: 0
    },
    handle: {
      length: 0.9,
      radiusTop: 0.12,
      radiusBottom: 0.12,
      segmentation: true,
      wrapEnabled: false,
      wrapTurns: 6,
      wrapDepth: 0.015,
      phiSegments: 64,
      wrapTexture: false,
      wrapTexScale: 10,
      wrapTexAngle: Math.PI / 4,
      wrapStyle: 'none',
      ovalRatio: 1.0,
      menukiPreset: 'none'
    },
    pommel: {
      size: 0.16,
      elongation: 1.0,
      style: 'orb',
      shapeMorph: 0.2,
      offsetX: 0,
      offsetY: 0,
      facetCount: 32,
      spikeLength: 1.0,
      balance: 0,
      peenVisible: false
    },
    accessories: {
      scabbard: {
        enabled: false,
        bodyMargin: 0.035,
        bodyThickness: 0.12,
        tipExtension: 0.06,
        throatLength: 0.08,
        throatScale: 1.12,
        locketOffset: 0.18,
        locketLength: 0.12,
        locketScale: 1.05,
        chapeLength: 0.22,
        chapeScale: 0.45,
        bodyRoundness: 0.5,
        offsetX: 0.16,
        offsetZ: -0.02,
        hangAngle: -0.18
      },
      tassel: {
        enabled: false,
        attachTo: 'guard',
        anchorOffset: 0.35,
        length: 0.55,
        droop: 0.55,
        sway: 0.3,
        thickness: 0.018,
        tuftSize: 0.05,
        tuftLength: 0.14,
        strands: 10
      }
    }
  };
}
