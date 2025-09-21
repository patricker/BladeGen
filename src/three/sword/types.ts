import * as THREE from 'three'

/**
 * Sword parameter type definitions used across geometry builders and the generator.
 *
 * This module is intentionally framework-agnostic aside from Three.js types used
 * in a few helper signatures (e.g. returning `THREE.Vector2[]` from outline helpers).
 *
 * Design goals:
 * - Keep a single canonical definition for all geometry knobs to avoid drift.
 * - Provide descriptive comments so UI and schema authors can understand intent/units.
 * - Avoid side effects: this file only exports TypeScript types and enums.
 */

export type CurveProfile = {
  /** Normalized distance along blade (0..1) mapped to lateral offsets. */
  points?: Array<[number, number]>;
  /** 'absolute' offsets are scene units; 'relative' are multiplied by blade length. */
  mode?: 'absolute' | 'relative';
  /** Optional multiplier applied to sampled values. */
  scale?: number;
};

export type WidthProfile = {
  /** Normalized distance along blade (0..1) mapped to scale/width values. */
  points?: Array<[number, number]>;
  /** 'scale' multiplies procedural width, 'absolute' overrides in scene units. */
  mode?: 'scale' | 'absolute';
};

export type BladeWaviness = {
  /** Lateral amplitude in scene units applied to the selected waviness mode. */
  amplitude: number;
  /** Number of oscillations along the blade span. */
  frequency: number;
  /** Optional phase offset in radians. */
  phase?: number;
  /** Blend factor fading amplitude toward the tip (0 no fade, 4 strong). */
  taper?: number;
  /** Static offset added to the result (scene units). */
  offset?: number;
  /** Controls which aspect is modulated. */
  mode?: 'centerline' | 'width' | 'both';
};

export type HollowGrindProfile = {
  /** Enable concave hollow grind shaping. */
  enabled?: boolean;
  /** Strength of the concave carve (0 flush, 1 full depth). */
  mix?: number;
  /** Depth scalar relative to the local half-thickness. */
  depth?: number;
  /** Controls falloff from edge toward spine; higher = tighter near edge. */
  radius?: number;
  /** Bias toward the spine (negative) or edge (positive). */
  bias?: number;
};

export type BladeFamily = 'straight' | 'flamberge' | 'kris';

export type FullerSlot = {
  /** Which side(s) receive this groove. */
  side?: 'left' | 'right' | 'both';
  /** Lateral offset from the spine in scene units (positive = +X). */
  offsetFromSpine?: number;
  /** Width of the groove across X in scene units. */
  width?: number;
  /** Visual depth used for overlays (scene units). */
  depth?: number;
  /** Physical inset for carve mode (scene units). */
  inset?: number;
  /** Normalized start position along the blade (0..1). */
  start?: number;
  /** Normalized end position along the blade (0..1). */
  end?: number;
  /** Cross profile shape. */
  profile?: 'u' | 'v' | 'flat';
  /** Realization per groove (defaults to global fullerMode). */
  mode?: 'overlay' | 'carve';
  /** Linear taper multiplier toward the end (0 none, 1 full). */
  taper?: number;
};

export type FullerFaceConfig = {
  left?: Array<Omit<FullerSlot, 'side'>>;
  right?: Array<Omit<FullerSlot, 'side'>>;
};

export type BladeParams = {
  /** High-level silhouette family for presets (straight default). */
  family?: BladeFamily;
  /** Odd wave count helper for kris family (>=1). */
  krisWaveCount?: number;
  /** Total blade length along +Y, in scene units (meters-ish). */
  length: number;
  /** Width near guard (at y=0). */
  baseWidth: number;
  /** Width at the tip (at y=length). Can be wider than base for exotic shapes. */
  tipWidth: number;
  /** Base thickness (across Z). For asymmetric edges use thicknessLeft/Right. */
  thickness: number;
  /** Curvature: -1..1 bends along X; positive bends toward -X along the span. */
  curvature: number;
  /** Edge serration amplitude. Prefer per-side values when asymmetric. */
  serrationAmplitude?: number;
  /** Edge serration frequency (cycles along blade). */
  serrationFrequency?: number;
  /** Left edge serration amplitude override. */
  serrationAmplitudeLeft?: number;
  /** Right edge serration amplitude override. */
  serrationAmplitudeRight?: number;
  /** Sharpen serration waveforms toward pointier teeth (0 smooth, 1 sharp). */
  serrationSharpness?: number;
  /** Lean/skew serration teeth against the blade travel on the left edge (-1 back, +1 forward). */
  serrationLeanLeft?: number;
  /** Lean/skew serration teeth on the right edge (-1 back, +1 forward). */
  serrationLeanRight?: number;
  /** Fuller (groove) visual depth hint for overlay mode. */
  fullerDepth?: number;
  /** Portion of blade length (0..1) occupied by fuller. */
  fullerLength?: number;
  /** Enable fuller rendering. */
  fullerEnabled?: boolean;
  /** Number of grooves per face. */
  fullerCount?: number;
  /** How fullers are realized: overlay ribbons or carved reduction; or 'none' to disable explicitly. */
  fullerMode?: 'overlay' | 'carve' | 'none';
  /** Fuller cross profile. */
  fullerProfile?: 'u' | 'v' | 'flat';
  /** Groove width across the blade face (scene units). */
  fullerWidth?: number;
  /** Inset into thickness for carve mode (fallback to fullerDepth). */
  fullerInset?: number;
  /** Longitudinal tessellation for blade sweep (resolution). */
  sweepSegments?: number;
  /** Small edge randomness 0..1. */
  chaos?: number;
  /** Width asymmetry: -1..1 widens left(-)/right(+) edge. */
  asymmetry?: number;
  /** Single or double edged. Affects hamon and spine behavior. */
  edgeType?: 'single' | 'double';
  /** Per-edge thickness (Z) overrides. */
  thicknessLeft?: number;
  thicknessRight?: number;
  /** Base tangent angle in radians, adds linear bend component. */
  baseAngle?: number;
  /** Sori curvature profile family. */
  soriProfile?: 'torii' | 'koshi' | 'saki';
  /** Sori profile bias exponent (0.3..3). */
  soriBias?: number;
  /** Fraction of length defining a kissaki (tip) segment. */
  kissakiLength?: number;
  /** Easing of tip taper (0 sharp, 1 round). */
  kissakiRoundness?: number;
  /** Fraction (0..1) where the main blade begins tapering toward the tip. 0 preserves legacy behavior (continuous taper). */
  tipRampStart?: number;
  /** Hamon visual overlay on edges. */
  hamonEnabled?: boolean;
  /** Hamon band width across X. */
  hamonWidth?: number;
  /** Hamon waviness amplitude across X. */
  hamonAmplitude?: number;
  /** Hamon wave frequency along Y. */
  hamonFrequency?: number;
  /** Which edge(s) receive hamon. */
  hamonSide?: 'auto' | 'left' | 'right' | 'both';
  /** Serration waveform family. */
  serrationPattern?: 'sine' | 'saw' | 'scallop' | 'random';
  /** Seed for pseudo-random serrations. */
  serrationSeed?: number;
  /** Total twist from base to tip, radians. */
  twistAngle?: number;
  /** Cross section profile family. */
  crossSection?: 'flat' | 'lenticular' | 'diamond' | 'hexagonal' | 'triangular' | 'tSpine' | 'compound';
  /** Cross-section bevel intensity 0..1. */
  bevel?: number;
  /** Tip family. Controls taper behavior near tip. */
  tipShape?: 'pointed' | 'rounded' | 'leaf' | 'clip' | 'tanto' | 'spear' | 'sheepsfoot';
  /** Extra mid-blade bulge for 'leaf' tips (0..1). */
  tipBulge?: number;
  /** Optional per-face engravings/decals. */
  engravings?: Array<{ type:'text'|'shape'|'decal', content?: string, fontUrl?: string, width:number, height:number, depth?: number, offsetY:number, offsetX:number, rotation?: number, side?: 'left'|'right'|'both', align?: 'left'|'center'|'right', letterSpacing?: number }>;
  /** Distal taper profile: piecewise linear [t, scale] points (t in 0..1). */
  thicknessProfile?: { points?: Array<[number, number]> };
  /** Optional curve profile for the blade centerline (lateral offsets). */
  curveProfile?: CurveProfile;
  /** Optional width profile to scale/override procedural outline width. */
  widthProfile?: WidthProfile;
  /** Optional ricasso length fraction near base (0..0.3). */
  ricassoLength?: number;
  /** False edge length fraction near tip (0..1). */
  falseEdgeLength?: number;
  /** False edge depth fraction (0..0.2). */
  falseEdgeDepth?: number;
  /** Optional oscillation profile for flamberge/kris style waviness. */
  waviness?: BladeWaviness;
  /** Optional hollow grind shaping parameters. */
  hollowGrind?: HollowGrindProfile;
  /** Advanced fuller definition array supporting per-side grooves. */
  fullers?: Array<FullerSlot>;
  /** Alternative per-face fuller configuration (mapped to fullers internally). */
  fullerFaces?: FullerFaceConfig;
};

export type GuardStyle = 'bar' | 'winged' | 'claw' | 'disk' | 'basket' | 'knucklebow' | 'swept' | 'shell';

export type GuardParams = {
  /** Span across X. */
  width: number;
  /** Thickness across Z (or bar thickness). */
  thickness: number;
  /** Up/down curvature for winged/claw families (-1..1). */
  curve: number;
  /** Tilt of the entire guard around Z in radians. */
  tilt: number;
  /** Guard family. */
  style: GuardStyle;
  /** 2D tessellation for extrudes. */
  curveSegments?: number;
  /** Habaki settings (small collar near base). */
  habakiEnabled?: boolean;
  habakiHeight?: number;
  habakiMargin?: number;
  /** Vertical offset from blade base for placement. */
  heightOffset?: number;
  /** Quillon options. */
  quillonCount?: number;
  quillonLength?: number;
  /** Ornamentation density 0..1 (abstract control). */
  ornamentation?: number;
  /** Continuous tip style sharpness 0..1. */
  tipSharpness?: number;
  /** Disk-style perforations. */
  cutoutCount?: number;
  cutoutRadius?: number;
  /** Left/right asymmetry toggles and magnitude (-1..1). */
  asymmetricArms?: boolean;
  asymmetry?: number;
  /** Small blend/fillet between guard and blade base. */
  guardBlendFillet?: number;
  guardBlendFilletStyle?: 'box'|'smooth';
  /** Extras like finger guards. */
  extras?: Array<{ kind: 'loop'|'sideRing'|'fingerGuard'; radius: number; thickness: number; offsetY: number; offsetX?: number; tilt?: number }>;
  /** Basket-hilt specific knobs. */
  basketRodCount?: number;
  basketRodRadius?: number;
  basketRingCount?: number;
  basketRingRadiusAdd?: number;
  basketRingThickness?: number;
  /** Shell guard coverage (0..1) for cup-like guards. */
  shellCoverage?: number;
  /** Additional shell thickness scaling (0..1). */
  shellThickness?: number;
  /** Stretch shell along Z (1 normal, >1 elongated). */
  shellFlare?: number;
  /** Pas d'âne (finger rings) count. 0 disables. */
  pasDaneCount?: number;
  /** Pas d'âne ring radius. */
  pasDaneRadius?: number;
  /** Pas d'âne ring thickness. */
  pasDaneThickness?: number;
  /** Vertical offset for pas d'âne rings relative to guard top. */
  pasDaneOffsetY?: number;
  /** Langets hugging the blade flats. */
  langets?: { enabled?: boolean; length?: number; width?: number; thickness?: number; chamfer?: number };
};

export type HandleParams = {
  /** Grip length along Y. */
  length: number;
  /** Radius at top (near guard). */
  radiusTop: number;
  /** Radius at bottom. */
  radiusBottom: number;
  /** Adds ridge segmentation along length. */
  segmentation: boolean;
  /** Slight bend along X; positive bends toward -X around mid. */
  curvature?: number;
  /** Enable helical wrap pattern. */
  wrapEnabled?: boolean;
  /** Number of helical turns along length. */
  wrapTurns?: number;
  /** Radial amplitude of wrap (extrusion). */
  wrapDepth?: number;
  /** Radial tessellation for cylinder. */
  phiSegments?: number;
  /** Enable procedural wrap texture on the grip. */
  wrapTexture?: boolean;
  /** Wrap texture repeat scale. */
  wrapTexScale?: number;
  /** Stripe angle in radians for wrap texture. */
  wrapTexAngle?: number;
  /** >1 flattens Z and widens X (oval grip). */
  ovalRatio?: number;
  /** Visible tang options. */
  tangVisible?: boolean;
  tangWidth?: number;
  tangThickness?: number;
  /** Optional layered details. */
  handleLayers?: Array<any>;
  /** Optional ornaments (position along length, side, size). */
  menuki?: Array<any>;
  /** Optional rivet rings. */
  rivets?: Array<any>;
  /** Preset wrap style generator. */
  wrapStyle?: 'none' | 'crisscross' | 'hineri' | 'katate' | 'wire';
  /** Rayskin overlay controls. */
  rayskin?: { enabled?: boolean; scale?: number; intensity?: number };
  /** Auto menuki placement preset. */
  menukiPreset?: 'none' | 'katana' | 'paired';
};

export type PommelStyle = 'orb' | 'disk' | 'spike' | 'wheel' | 'scentStopper' | 'ring' | 'crown' | 'fishtail';

export type PommelParams = {
  /** Base size controlling radius/extent of the pommel. */
  size: number;
  /** Vertical elongation (Y scale). */
  elongation: number;
  /** Pommel family. */
  style: PommelStyle;
  /** Horizontal squash/stretch morph 0..1 for non-spike types. */
  shapeMorph: number;
  /** Lateral and vertical micro-adjustments. */
  offsetX: number;
  offsetY: number;
  /** Tessellation/faceting control. */
  facetCount?: number;
  /** Spike length factor. */
  spikeLength?: number;
  /** Balance factor: 0 uses user size, 1 auto-balances from blade mass proxy. */
  balance?: number;
  /** Ring/crown specifics. */
  ringInnerRadius?: number;
  crownSpikes?: number;
  crownSharpness?: number;
  /** Show hammer peen or peen block. */
  peenVisible?: boolean;
  peenSize?: number;
  peenShape?: 'dome' | 'block';
};

export type ScabbardParams = {
  /** Enable scabbard geometry generation. */
  enabled: boolean;
  /** Extra clearance added to blade half-width along ±X. */
  bodyMargin: number;
  /** Target overall thickness across ±Z for the scabbard shell. */
  bodyThickness: number;
  /** Fraction of blade length extending past the tip for the chape. */
  tipExtension: number;
  /** Fraction of blade length reserved for the throat collar near the mouth. */
  throatLength: number;
  /** Scale multiplier applied at the throat (1 = same as body). */
  throatScale: number;
  /** Offset fraction from the mouth to place the locket band. */
  locketOffset: number;
  /** Fractional length of the locket band along the scabbard body. */
  locketLength: number;
  /** Scale multiplier applied to the locket band swell. */
  locketScale: number;
  /** Fractional length toward the tip where the chape taper begins. */
  chapeLength: number;
  /** Target scale at the extreme chape tip (0 narrower, 1 same as body). */
  chapeScale: number;
  /** 0 → hard-edged rectangular profile, 1 → round. */
  bodyRoundness: number;
  /** Lateral offset of the scabbard relative to the blade centerline. */
  offsetX: number;
  /** Thickness offset pushing the scabbard toward/away from camera. */
  offsetZ: number;
  /** Rotation around Z (radians) to give the scabbard a hanging cant. */
  hangAngle: number;
};

export type TasselParams = {
  /** Enable tassel/knot geometry. */
  enabled: boolean;
  /** Attachment target. */
  attachTo: 'guard' | 'scabbard';
  /** Normalized offset (0 mouth, 1 tip) when attaching to the scabbard. */
  anchorOffset: number;
  /** Rope length as a fraction of blade length. */
  length: number;
  /** Vertical sag factor (0 taut, 1 fully drooped). */
  droop: number;
  /** Sideways sway factor (-1 left, +1 right). */
  sway: number;
  /** Rope diameter in scene units. */
  thickness: number;
  /** Radius of the knot/terminal bulb. */
  tuftSize: number;
  /** Length of the tassel fringe. */
  tuftLength: number;
  /** Number of fringe strands cloned around the tip. */
  strands: number;
};

export type AccessoriesParams = {
  scabbard: ScabbardParams;
  tassel: TasselParams;
};

export type SwordParams = {
  /** All per-part geometry parameters used to synthesize the sword. */
  blade: BladeParams;
  guard: GuardParams;
  handle: HandleParams;
  pommel: PommelParams;
  /** When false, omit guard, handle and pommel (blade-only). */
  hiltEnabled?: boolean;
  /** When false, omit only the guard while keeping handle/pommel. */
  guardEnabled?: boolean;
  /** Optional ratio-based sizing helpers. */
  useRatios?: boolean;
  ratios?: { guardWidthToBlade?: number; handleLengthToBlade?: number; pommelSizeToBlade?: number };
  /** Optional accessories such as scabbards and tassels. */
  accessories?: AccessoriesParams;
};
