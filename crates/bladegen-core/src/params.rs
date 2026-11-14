//! bladegen's parameter types (`src/three/sword/types.ts`, export schema v5), the subset the Rust port reads.
//! Field names are bladegen's (camelCase), so a bladegen `model` object deserialises directly; unknown fields are
//! ignored. Optional fields keep JS `??` semantics: `None` is "undefined".
use serde::{Deserialize, Serialize};

pub type Points = Vec<[f64; 2]>;

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    #[serde(default)]
    pub points: Option<Points>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scale: Option<f64>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Waviness {
    pub amplitude: f64,
    pub frequency: f64,
    #[serde(default)]
    pub phase: Option<f64>,
    #[serde(default)]
    pub taper: Option<f64>,
    #[serde(default)]
    pub offset: Option<f64>,
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HollowGrind {
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub mix: Option<f64>,
    #[serde(default)]
    pub depth: Option<f64>,
    #[serde(default)]
    pub radius: Option<f64>,
    #[serde(default)]
    pub bias: Option<f64>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FullerSlot {
    #[serde(default)]
    pub side: Option<String>,
    #[serde(default)]
    pub width: Option<f64>,
    #[serde(default)]
    pub offset_from_spine: Option<f64>,
    #[serde(default)]
    pub depth: Option<f64>,
    #[serde(default)]
    pub inset: Option<f64>,
    #[serde(default)]
    pub start: Option<f64>,
    #[serde(default)]
    pub end: Option<f64>,
    #[serde(default)]
    pub profile: Option<String>,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub taper: Option<f64>,
}

/// SW1's glow channel (`blade.glow`, bladegen sword/planet-swords): a COLOR_0 alpha mask on the blade (edge and
/// core bands) and an emissive mesh of edge strips and seeded runes. Field names and defaults as `sanitizeGlow`.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Glow {
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub intensity: Option<f64>,
    #[serde(default)]
    pub edge_width: Option<f64>,
    #[serde(default)]
    pub edge_mask: Option<f64>,
    #[serde(default)]
    pub core_width: Option<f64>,
    #[serde(default)]
    pub core_mask: Option<f64>,
    #[serde(default)]
    pub rune_count: Option<f64>,
    #[serde(default)]
    pub rune_seed: Option<f64>,
    #[serde(default)]
    pub rune_start: Option<f64>,
    #[serde(default)]
    pub rune_end: Option<f64>,
    #[serde(default)]
    pub rune_scale: Option<f64>,
    #[serde(default)]
    pub rune_stroke: Option<f64>,
    #[serde(default)]
    pub rune_faces: Option<String>,
    #[serde(default)]
    pub pulse_hz: Option<f64>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Blade {
    #[serde(default)]
    pub family: Option<String>,
    pub length: f64,
    pub base_width: f64,
    pub tip_width: f64,
    #[serde(default)]
    pub thickness: Option<f64>,
    #[serde(default)]
    pub thickness_left: Option<f64>,
    #[serde(default)]
    pub thickness_right: Option<f64>,
    #[serde(default)]
    pub curvature: Option<f64>,
    #[serde(default)]
    pub base_angle: Option<f64>,
    #[serde(default)]
    pub sori_profile: Option<String>,
    #[serde(default)]
    pub sori_bias: Option<f64>,
    #[serde(default)]
    pub curve_profile: Option<Profile>,
    #[serde(default)]
    pub width_profile: Option<Profile>,
    #[serde(default)]
    pub thickness_profile: Option<Profile>,
    #[serde(default)]
    pub tip_shape: Option<String>,
    #[serde(default)]
    pub tip_bulge: Option<f64>,
    #[serde(default)]
    pub tip_ramp_start: Option<f64>,
    #[serde(default)]
    pub kissaki_length: Option<f64>,
    #[serde(default)]
    pub kissaki_roundness: Option<f64>,
    #[serde(default)]
    pub waviness: Option<Waviness>,
    #[serde(default)]
    pub twist_angle: Option<f64>,
    #[serde(default)]
    pub cross_section: Option<String>,
    #[serde(default)]
    pub bevel: Option<f64>,
    #[serde(default)]
    pub edge_type: Option<String>,
    #[serde(default)]
    pub hollow_grind: Option<HollowGrind>,
    #[serde(default)]
    pub serration_amplitude: Option<f64>,
    #[serde(default)]
    pub serration_amplitude_left: Option<f64>,
    #[serde(default)]
    pub serration_amplitude_right: Option<f64>,
    #[serde(default)]
    pub serration_frequency: Option<f64>,
    #[serde(default)]
    pub serration_pattern: Option<String>,
    #[serde(default)]
    pub serration_seed: Option<f64>,
    #[serde(default)]
    pub serration_sharpness: Option<f64>,
    #[serde(default)]
    pub serration_lean_left: Option<f64>,
    #[serde(default)]
    pub serration_lean_right: Option<f64>,
    #[serde(default)]
    pub chaos: Option<f64>,
    #[serde(default)]
    pub asymmetry: Option<f64>,
    #[serde(default)]
    pub ricasso_length: Option<f64>,
    #[serde(default)]
    pub false_edge_length: Option<f64>,
    #[serde(default)]
    pub false_edge_depth: Option<f64>,
    #[serde(default)]
    pub fuller_enabled: Option<bool>,
    #[serde(default)]
    pub fullers: Option<Vec<FullerSlot>>,
    #[serde(default)]
    pub sweep_segments: Option<f64>,
    #[serde(default)]
    pub glow: Option<Glow>,
    /// SW12 window-keel ([`crate::keel`]): one long opening through the blade, a rail either side, a solid planted
    /// keel. Absent on every design before SW12, and skipped when serialising, so their JSON is unchanged.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aperture: Option<Aperture>,
    /// SW12 faultbound ([`crate::fault`]): the blade broken into separate fragments across zigzag fractures. Takes
    /// precedence over `aperture` when both are set.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fracture: Option<Fracture>,
}

/// SW12 window-keel (`blade.aperture`, [`crate::keel`]); `None` = the default. Positions are fractions of the blade
/// length from the guard (t), widths multiples of the blade's base width (W). Field order is the order the family
/// recipe writes.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Aperture {
    /// Where the opening starts (t), 0.08..0.4; default 0.2.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start: Option<f64>,
    /// Where it ends (t), 0.4..0.8 and at least 0.2 after `start`; default 0.66.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end: Option<f64>,
    /// The opening's widest span (x W), 0.15..0.65; default 0.42. The rails keep at least `rail`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub width: Option<f64>,
    /// The tip-side shoulder's length, a fraction of the opening's length (the guard side's is half of it), 0..0.45;
    /// default 0.22.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shoulder: Option<f64>,
    /// The opening's width at its two ends, a fraction of `width`, 0.05..1; default 0.22 (pointed shoulders).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub point: Option<f64>,
    /// 0 = straight (angular) shoulders, 1 = arched, 0..1; default 0.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub arch: Option<f64>,
    /// The thinnest a rail may get (x W), 0.08..0.4; default 0.18.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rail: Option<f64>,
    /// The glowing lip round the opening on both faces, a fraction of the rail's width, 0..0.6; default 0.2
    /// (0 = none). Part of the glow mesh, so only with `blade.glow` on.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lip: Option<f64>,
}

/// SW12 faultbound (`blade.fracture`, [`crate::fault`]); `None` = the default. Lengths are multiples of the blade's
/// base width (W). Field order is the order the family recipe writes.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Fracture {
    /// Fragments, 2..7; default 4. The first (at the guard) and the last (the planted keel) never move.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub segments: Option<f64>,
    /// The open gap along the blade between neighbours (x W), 0.08..0.4; default 0.24.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gap: Option<f64>,
    /// Sideways displacement of the free fragments (x W), 0..0.35; default 0.14.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offset: Option<f64>,
    /// Turn of the free fragments about the blade's normal (radians), 0..0.08; default 0.03. Limited so that no
    /// corner closes more than 40 % of the gap.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tilt: Option<f64>,
    /// The fracture's zigzag (x W), 0..0.12; default 0.07.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub zigzag: Option<f64>,
    /// Seed of the per-fracture signs (zigzag direction, offset side, turn), an integer; default 1.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seed: Option<f64>,
    /// Glowing rims along each fracture on both faces (x W), 0..0.2; default 0.07 (0 = none). Part of the glow mesh,
    /// so only with `blade.glow` on.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rim: Option<f64>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Guard {
    #[serde(default)]
    pub style: Option<String>,
    pub width: f64,
    pub thickness: f64,
    #[serde(default)]
    pub height_offset: Option<f64>,
    #[serde(default)]
    pub tilt: Option<f64>,
    #[serde(default)]
    pub quillon_count: Option<f64>,
    #[serde(default)]
    pub quillon_length: Option<f64>,
    #[serde(default)]
    pub ornamentation: Option<f64>,
    #[serde(default)]
    pub tip_sharpness: Option<f64>,
    /// Style `forged` (SW7, bladegen `sword/monument-guard`): the cross's proportions, relative to the blade.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub forged: Option<Forged>,
    /// The monument styles (SW10, bladegen `sword/monument-variety`: recurve, crescent, halo, wings, talon, ziggurat):
    /// proportions relative to the blade and each style's shape knobs.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub monument: Option<GuardMonument>,
    /// SW12 style `shear` (shear-gate, [`crate::shear`]): two stepped jaws either side of a hub with a glowing
    /// throat, sized from the blade like the monument styles.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shear: Option<GuardShear>,
}

/// SW12 shear-gate (`guard.shear`); `None` = the default. Sizes relative to the blade: multiples of its base width
/// (W) or thickness (T); `guard.width` is the span, tip to tip. Field order is the order the family recipe writes.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GuardShear {
    /// A jaw's bar height (x W), 0.25..0.8; default 0.46.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub height: Option<f64>,
    /// A jaw's depth across the blade's flat (x T), 1.2..4; default 2.6. The hub is 1.15x deeper.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub depth: Option<f64>,
    /// The hub's half width (x W), 0.35..0.9; default 0.6.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub block: Option<f64>,
    /// The tooth's rise above its bar (x bar height), 0.3..1.6; default 0.95.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tooth: Option<f64>,
    /// The tooth's centre along the arm (0 = at the hub, 1 = at the end), 0.25..0.8; default 0.58.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub at: Option<f64>,
    /// The tooth's width, a fraction of the arm, 0.12..0.45; default 0.3.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub span: Option<f64>,
    /// The jaws' offset along the blade, the right one toward the tip, the left toward the grip (x W), 0..0.5;
    /// default 0.18.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stagger: Option<f64>,
    /// Corner chamfers (x bar height), 0..0.35; default 0.18.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chamfer: Option<f64>,
    /// The glowing throat on the hub's two faces (x hub height), 0..0.9; default 0.62 (0 = none).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub throat: Option<f64>,
}

/// bladegen's `GuardMonumentParams` (`monument/guards.ts`); `None` = the style's default. Field order is the
/// defaults' key order (validation and the family recipes write the block in full, in this order).
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GuardMonument {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub height: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub depth: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub block: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub swell: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub taper: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sweep: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub count: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spike: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ring: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub knob: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub section: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub segments: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub radial: Option<f64>,
}

/// bladegen's `GuardForgedParams` (`guardForged.ts`); `None` = the builder's default.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Forged {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub height: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub depth: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub block: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub swell: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub taper: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub curl: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finial: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub section: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub segments: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub radial: Option<f64>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Handle {
    pub length: f64,
    pub radius_top: f64,
    pub radius_bottom: f64,
    #[serde(default)]
    pub segmentation: Option<bool>,
    #[serde(default)]
    pub segmentation_count: Option<f64>,
    #[serde(default)]
    pub flare: Option<f64>,
    #[serde(default)]
    pub phi_segments: Option<f64>,
    #[serde(default)]
    pub curvature: Option<f64>,
    #[serde(default)]
    pub oval_ratio: Option<f64>,
    #[serde(default)]
    pub wrap_enabled: Option<bool>,
    #[serde(default)]
    pub wrap_depth: Option<f64>,
    #[serde(default)]
    pub wrap_turns: Option<f64>,
    #[serde(default)]
    pub wrap_style: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Pommel {
    #[serde(default)]
    pub style: Option<String>,
    pub size: f64,
    pub elongation: f64,
    pub shape_morph: f64,
    #[serde(default)]
    pub offset_x: Option<f64>,
    #[serde(default)]
    pub offset_y: Option<f64>,
    #[serde(default)]
    pub facet_count: Option<f64>,
    #[serde(default)]
    pub spike_length: Option<f64>,
    #[serde(default)]
    pub balance: Option<f64>,
    #[serde(default)]
    pub ring_inner_radius: Option<f64>,
    #[serde(default)]
    pub crown_spikes: Option<f64>,
    #[serde(default)]
    pub crown_sharpness: Option<f64>,
    #[serde(default)]
    pub peen_visible: Option<bool>,
}

/// bladegen `SwordParams` (the document's `model`).
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Sword {
    pub blade: Blade,
    pub guard: Guard,
    pub handle: Handle,
    pub pommel: Pommel,
    #[serde(default)]
    pub hilt_enabled: Option<bool>,
    #[serde(default)]
    pub guard_enabled: Option<bool>,
}
