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
    /// Not read by the geometry (validation turns it into `waviness` on kris blades); kept so the monument
    /// recipes drop it as bladegen's TypeScript did (`straighten`).
    #[serde(default)]
    pub kris_wave_count: Option<f64>,
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
