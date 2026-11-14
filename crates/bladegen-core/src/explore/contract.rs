//! Inspectable, replay-checked exploration recipes. A fingerprint mismatch is an error, not silent migration.
use super::*;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Record {
  pub id: String,
  pub role: String,
  pub digest: String,
  pub travel: [f64; 3],
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Manifest {
  pub format: String,
  pub recipe_version: u32,
  pub core_version: String,
  pub math_profile: String,
  pub catalogue_fnv1a64: String,
  pub implementation_fnv1a64: String,
  pub seed: u32,
  /// Rust core subset, deliberately separate from the full editor SwordParams document envelope.
  pub base: Sword,
  pub features: Features,
  pub height_m: f64,
  pub sink: f64,
  pub components: Vec<Record>,
  pub anchors: Vec<Anchor>,
}
fn hash(bytes: &[u8]) -> String {
  let mut h = 0xcbf29ce484222325u64;
  for b in bytes {
    h ^= *b as u64;
    h = h.wrapping_mul(0x100000001b3);
  }
  format!("{h:016x}")
}
fn implementation() -> String {
  hash(
    concat!(
      include_str!("../explore.rs"),
      include_str!("details.rs"),
      include_str!("authoring.rs"),
      include_str!("../blade.rs"),
      include_str!("../geom.rs"),
      include_str!("../hilt.rs"),
      include_str!("../glow.rs"),
      include_str!("../monument.rs"),
      include_str!("../model.rs"),
      include_str!("../families.rs"),
      include_str!("../params.rs"),
      include_str!("presets.rs")
    )
    .as_bytes(),
  )
}
fn records(a: &Assembly) -> Vec<Record> {
  a.components
    .iter()
    .map(|c| {
      let mut bytes = vec![];
      for xs in [
        &c.mesh.pos,
        &c.mesh.nrm,
        &c.mesh.uv,
        &c.mesh.color,
        &c.mesh.tangent,
      ] {
        bytes.extend((xs.len() as u64).to_le_bytes());
        for x in xs {
          bytes.extend(x.to_le_bytes());
        }
      }
      bytes.extend((c.mesh.idx.len() as u64).to_le_bytes());
      for i in &c.mesh.idx {
        bytes.extend(i.to_le_bytes());
      }
      for x in c
        .matrix
        .iter()
        .chain(&c.color)
        .chain(std::iter::once(&c.strength))
      {
        bytes.extend(x.to_le_bytes());
      }
      Record {
        id: c.id.clone(),
        role: c.role.clone(),
        digest: hash(&bytes),
        travel: c.travel,
      }
    })
    .collect()
}
pub fn record(
  base: &Sword,
  seed: u32,
  features: &Features,
  height_m: f64,
  sink: f64,
) -> anyhow::Result<Manifest> {
  valid(height_m, 30., 42., "contract height")?;
  valid(sink, 0., 0.4, "contract sink")?;
  for placement_sink in [
    features.electrodes.as_ref().map(|e| e.sink),
    features.encroachment.as_ref().map(|e| e.sink),
  ]
  .into_iter()
  .flatten()
  {
    anyhow::ensure!(
      placement_sink == sink,
      "placement sink differs from contract sink"
    );
  }
  let a = build(base, seed, features)?;
  Ok(Manifest {
    format: "bladegen-explore-recipe/1".into(),
    recipe_version: 1,
    core_version: crate::VERSION.into(),
    math_profile: "libm-f64-f32-v1".into(),
    catalogue_fnv1a64: hash(crate::families::CATALOGUE_JSON.as_bytes()),
    implementation_fnv1a64: implementation(),
    seed,
    base: base.clone(),
    features: features.clone(),
    height_m,
    sink,
    components: records(&a),
    anchors: a.anchors,
  })
}
pub fn replay(m: &Manifest) -> anyhow::Result<Assembly> {
  anyhow::ensure!(
    m.format == "bladegen-explore-recipe/1" && m.recipe_version == 1,
    "unsupported recipe version"
  );
  anyhow::ensure!(
    m.core_version == crate::VERSION && m.math_profile == "libm-f64-f32-v1",
    "unsupported core/math profile"
  );
  anyhow::ensure!(
    m.catalogue_fnv1a64 == hash(crate::families::CATALOGUE_JSON.as_bytes()),
    "catalogue fingerprint changed"
  );
  anyhow::ensure!(
    m.implementation_fnv1a64 == implementation(),
    "implementation fingerprint changed; use the recorded checkout"
  );
  let expected = record(&m.base, m.seed, &m.features, m.height_m, m.sink)?;
  anyhow::ensure!(
    expected.components == m.components && expected.anchors == m.anchors,
    "resolved output does not match manifest"
  );
  build(&m.base, m.seed, &m.features)
}
