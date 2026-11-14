//! Opt-in planet-sword experiments. Legacy params, recipes and operation order remain untouched.
//! Coordinates follow `model`: +Y toward the tip. Geometry is Rust-only; preview tools consume buffers.
use crate::{
  geom::{self, Mesh},
  glow::hash_seed,
  model,
  params::Sword,
};
use serde::{Deserialize, Serialize};
pub mod audit;
pub mod authoring;
pub mod contract;
mod details;
pub mod presets;
pub mod raster;
pub use details::*;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Resonance {
  pub count: u32,
  /// Node radius in base blade widths.
  pub radius: f64,
}
impl Default for Resonance {
  fn default() -> Self {
    Self {
      count: 5,
      radius: 0.055,
    }
  }
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Features {
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub resonance: Option<Resonance>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub read: Option<Read>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub emission: Option<Emission>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub scars: Option<Scars>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub staves: Option<Staves>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub grammar: Option<Grammar>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub gate: Option<Gate>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub fracture: Option<Fracture>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub aperture: Option<Aperture>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub cleft: Option<Cleft>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub ribs: Option<Ribs>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub crystals: Option<Crystals>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub kernel: Option<Kernel>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub chains: Option<Chains>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub sutures: Option<Sutures>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub strata: Option<Strata>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub encroachment: Option<Encroachment>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub terminator: Option<Terminator>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub circuit: Option<Circuit>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub electrodes: Option<Electrodes>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Cleft {
  pub separation: f64,
  pub merge_at: f64,
  pub bias: f64,
}
impl Default for Cleft {
  fn default() -> Self {
    Self {
      separation: 0.6,
      merge_at: 0.72,
      bias: 0.05,
    }
  }
}
fn add_cleft(a: &mut Assembly, s: &Sword, c: &Cleft) -> anyhow::Result<()> {
  valid(c.separation, 0.3, 0.9, "cleft separation")?;
  valid(c.merge_at, 0.6, 0.8, "cleft merge")?;
  valid(c.bias, -0.1, 0.1, "cleft bias")?;
  let w = s.blade.base_width;
  let l = s.blade.length;
  let gap = c.separation * w * 0.5;
  let rail = 0.25 * w;
  let poly = [
    [-gap - rail, 0.],
    [-gap, 0.],
    [-gap, c.merge_at * l - 0.1 * w],
    [0., c.merge_at * l + c.bias * l],
    [gap, c.merge_at * l - 0.1 * w],
    [gap, 0.],
    [gap + rail, 0.],
    [gap + rail, 0.82 * l],
    [0.01 * w, l],
    [-0.01 * w, l],
    [-gap - rail, 0.82 * l],
  ];
  a.components
    .retain(|p| !p.id.starts_with("blade#") && !p.id.starts_with("glow#"));
  a.components.push(component(
    "cleft/keel",
    extrude(&poly, s.blade.thickness.unwrap_or(0.16))?,
  ));
  Ok(())
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Aperture {
  pub start: f64,
  pub end: f64,
  pub width: f64,
}
impl Default for Aperture {
  fn default() -> Self {
    Self {
      start: 0.18,
      end: 0.68,
      width: 0.48,
    }
  }
}

/// Explicit annular face topology: front/back rails, outside walls, inside walls. One closed solid.
fn window_mesh(outer: &[[f64; 2]], inner: &[[f64; 2]], depth: f64) -> Mesh {
  let n = outer.len() as u32;
  let mut m = Mesh::default();
  for z in [-depth * 0.5, depth * 0.5] {
    for ring in [outer, inner] {
      for p in ring {
        m.pos.extend([p[0] as f32, p[1] as f32, z as f32]);
      }
    }
  }
  for i in 0..n {
    let j = (i + 1) % n;
    m.idx.extend([i, j + n, j, i, i + n, j + n]); // back face
    m.idx.extend([
      i + 2 * n,
      j + 2 * n,
      j + 3 * n,
      i + 2 * n,
      j + 3 * n,
      i + 3 * n,
    ]); // front face
    m.idx.extend([i, j, i + 2 * n, j, j + 2 * n, i + 2 * n]); // outer wall
    m.idx
      .extend([i + n, i + 3 * n, j + n, j + n, i + 3 * n, j + 3 * n]); // inner wall
  }
  m.compute_vertex_normals();
  m
}

fn add_aperture(a: &mut Assembly, s: &Sword, ap: &Aperture) -> anyhow::Result<()> {
  valid(ap.start, 0.08, 0.35, "aperture start")?;
  valid(ap.end, 0.45, 0.78, "aperture end")?;
  valid(ap.width, 0.2, 0.6, "aperture width")?;
  anyhow::ensure!(
    ap.end - ap.start >= 0.25,
    "aperture too short for angular shoulders"
  );
  let w = s.blade.base_width;
  let l = s.blade.length;
  let h = ap.width * w * 0.5;
  let d = s.blade.thickness.unwrap_or(0.16);
  let outer = [
    [-w * 0.5, 0.],
    [w * 0.5, 0.],
    [w * 0.5, l * 0.8],
    [w * 0.01, l],
    [-w * 0.01, l],
    [-w * 0.5, l * 0.8],
  ];
  let inner = [
    [-h, ap.start * l],
    [h, ap.start * l],
    [h, (ap.end - 0.06) * l],
    [h * 0.3, ap.end * l],
    [-h * 0.3, ap.end * l],
    [-h, (ap.end - 0.06) * l],
  ];
  a.components
    .retain(|c| !c.id.starts_with("blade#") && !c.id.starts_with("glow#"));
  a.components
    .push(component("window/keel", window_mesh(&outer, &inner, d)));
  // Inner bevel lip on both faces: a closed annulus offset away from the opening, never fills it.
  let lip: Vec<_> = inner
    .iter()
    .map(|p| {
      [
        p[0] * 1.10,
        (p[1] - 0.5 * (ap.start + ap.end) * l) * 1.035 + 0.5 * (ap.start + ap.end) * l,
      ]
    })
    .collect();
  for sign in [1., -1.] {
    let mut c = component(
      &format!("window/lip/{sign}"),
      window_mesh(&lip, &inner, 0.012 * w),
    );
    c.matrix[14] = sign * (d * 0.5 + 0.008 * w);
    c.role = "channel".into();
    c.color = [0.2, 0.75, 1.];
    c.strength = 4.;
    a.components.push(c);
  }
  Ok(())
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Fracture {
  pub segments: u32,
  pub gap: f64,
  pub offset: f64,
  pub read_closure: f64,
}
impl Default for Fracture {
  fn default() -> Self {
    Self {
      segments: 4,
      gap: 0.22,
      offset: 0.18,
      read_closure: 0.65,
    }
  }
}

fn blank_width(s: &Sword, t: f64) -> f64 {
  s.blade.base_width
    * if t > 0.8 {
      1. - 0.98 * (t - 0.8) / 0.2
    } else {
      1.
    }
}
fn add_fracture(a: &mut Assembly, s: &Sword, seed: u32, f: &Fracture) -> anyhow::Result<()> {
  anyhow::ensure!(
    (2..=7).contains(&f.segments),
    "fracture segments must be 2..=7"
  );
  valid(f.gap, 0.10, 0.30, "fracture gap")?;
  valid(f.offset, 0., 0.35, "fracture offset")?;
  valid(f.read_closure, 0., 0.9, "read closure")?;
  let w = s.blade.base_width;
  let l = s.blade.length;
  let d = s.blade.thickness.unwrap_or(0.16);
  anyhow::ensure!(
    l / f.segments as f64 > f.gap * w + 0.3 * w,
    "fracture leaves insufficient fragment height"
  );
  a.components
    .retain(|c| !c.id.starts_with("blade#") && !c.id.starts_with("glow#"));
  let boundary = |i: u32, shift: f64| -> Vec<[f64; 2]> {
    let t = i as f64 / f.segments as f64;
    let width = blank_width(s, t);
    let y = t * l + shift;
    if i == 0 || i == f.segments {
      return vec![[-width * 0.5, y], [width * 0.5, y]];
    }
    let sign = if hash_seed(&format!("{seed}|fault/{i}")) & 1 == 0 {
      1.
    } else {
      -1.
    };
    vec![
      [-width * 0.5, y],
      [-width * 0.15, y - 0.045 * w * sign],
      [width * 0.15, y + 0.045 * w * sign],
      [width * 0.5, y],
    ]
  };
  for i in 0..f.segments {
    let mut poly = boundary(i, if i == 0 { 0. } else { f.gap * w * 0.5 });
    let top = boundary(
      i + 1,
      if i + 1 == f.segments {
        0.
      } else {
        -f.gap * w * 0.5
      },
    );
    // Preserve the broad shoulder before the planted terminal taper.
    let crosses_shoulder =
      (i as f64 / f.segments as f64) < 0.8 && ((i + 1) as f64 / f.segments as f64) > 0.8;
    if crosses_shoulder {
      poly.push([w * 0.5, 0.8 * l]);
    }
    poly.extend(top.into_iter().rev());
    if crosses_shoulder {
      poly.push([-w * 0.5, 0.8 * l]);
    }
    let mut c = component(&format!("fragment/{i}"), extrude(&poly, d)?);
    let fixed = i == 0 || i + 1 == f.segments;
    let sign = if hash_seed(&format!("{seed}|offset/{i}")) & 1 == 0 {
      1.
    } else {
      -1.
    };
    c.matrix[12] = if fixed { 0. } else { sign * f.offset * w };
    c.travel[0] = -c.matrix[12] * f.read_closure;
    a.components.push(c);
    if i + 1 < f.segments {
      let y = (i + 1) as f64 / f.segments as f64 * l - f.gap * w * 0.5 - 0.08 * w;
      let mut seam = component(
        &format!("fault/light/{i}"),
        extrude(
          &[
            [-0.32 * w, y - 0.018 * w],
            [0.32 * w, y - 0.018 * w],
            [0.32 * w, y + 0.018 * w],
            [-0.32 * w, y + 0.018 * w],
          ],
          0.018 * w,
        )?,
      );
      seam.matrix[12] = a.components.last().unwrap().matrix[12];
      seam.matrix[14] = d * 0.5 + 0.01 * w;
      seam.travel[0] = a.components.last().unwrap().travel[0];
      seam.role = "fracture".into();
      seam.color = [1., 0.2, 0.03];
      seam.strength = 5.;
      a.components.push(seam);
    }
  }
  Ok(())
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Gate {
  pub jaw_height: f64,
  pub stagger: f64,
  pub read_travel: f64,
}
impl Default for Gate {
  fn default() -> Self {
    Self {
      jaw_height: 0.9,
      stagger: 0.22,
      read_travel: 0.35,
    }
  }
}

/// Extrude a simple CCW polygon without booleans. Deterministic first-ear triangulation.
pub fn extrude(poly: &[[f64; 2]], depth: f64) -> anyhow::Result<Mesh> {
  anyhow::ensure!(
    poly.len() >= 3 && depth > 0. && depth.is_finite(),
    "invalid extrusion"
  );
  let cross = |a: [f64; 2], b: [f64; 2], c: [f64; 2]| {
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  };
  let mut remaining: Vec<_> = (0..poly.len()).collect();
  let mut faces = vec![];
  while remaining.len() > 3 {
    let mut found = false;
    for i in 0..remaining.len() {
      let (a, b, c) = (
        remaining[(i + remaining.len() - 1) % remaining.len()],
        remaining[i],
        remaining[(i + 1) % remaining.len()],
      );
      if cross(poly[a], poly[b], poly[c]) <= 1e-12 {
        continue;
      }
      if remaining.iter().any(|&p| {
        p != a
          && p != b
          && p != c
          && cross(poly[a], poly[b], poly[p]) >= -1e-12
          && cross(poly[b], poly[c], poly[p]) >= -1e-12
          && cross(poly[c], poly[a], poly[p]) >= -1e-12
      }) {
        continue;
      }
      faces.extend([a as u32, b as u32, c as u32]);
      remaining.remove(i);
      found = true;
      break;
    }
    anyhow::ensure!(found, "polygon is not simple CCW");
  }
  faces.extend(remaining.iter().map(|v| *v as u32));
  let n = poly.len() as u32;
  let mut m = Mesh::default();
  for z in [-depth * 0.5, depth * 0.5] {
    for p in poly {
      m.pos.extend([p[0] as f32, p[1] as f32, z as f32]);
    }
  }
  for f in faces.chunks_exact(3) {
    m.idx
      .extend([f[0], f[2], f[1], f[0] + n, f[1] + n, f[2] + n]);
  }
  for a in 0..n {
    let b = (a + 1) % n;
    m.idx.extend([a, b, a + n, b, b + n, a + n]);
  }
  m.compute_vertex_normals();
  Ok(m)
}

fn add_gate(a: &mut Assembly, s: &Sword, g: &Gate) -> anyhow::Result<()> {
  valid(g.jaw_height, 0.5, 1.5, "gate jaw height")?;
  valid(g.stagger, 0., 0.5, "gate stagger")?;
  valid(g.read_travel, 0.1, 0.7, "gate travel")?;
  let w = s.blade.base_width;
  let h = g.jaw_height * w;
  let d = s.blade.thickness.unwrap_or(0.16) * 3.;
  a.components.retain(|c| !c.id.starts_with("guard#"));
  let polygon = [
    [0.25, -0.4],
    [1.7, -0.4],
    [1.7, 0.1],
    [1.35, 0.1],
    [1.35, 0.6],
    [0.65, 0.6],
    [0.65, 0.1],
    [0.25, 0.1],
  ];
  for sign in [1., -1.] {
    let poly: Vec<_> = polygon.iter().map(|p| [p[0] * w, p[1] * h]).collect();
    let mut mesh = extrude(&poly, d)?;
    for p in mesh.pos.chunks_exact_mut(3) {
      p[0] *= sign as f32;
      p[1] = (p[1] as f64 * sign + sign * g.stagger * w * 0.5) as f32;
    }
    // 180 degrees about Z preserves winding.
    mesh.compute_vertex_normals();
    let mut c = component(&format!("gate/jaw/{sign}"), mesh);
    c.travel = [sign * g.read_travel * w, 0., 0.];
    a.components.push(c);
  }
  a.components.push(component(
    "gate/hub",
    extrude(
      &[
        [-0.55 * w, -0.18 * w],
        [0.55 * w, -0.18 * w],
        [0.55 * w, 0.02 * w],
        [-0.55 * w, 0.02 * w],
      ],
      d * 0.8,
    )?,
  ));
  let mut throat = component(
    "gate/throat",
    node_mesh([0., -0.29 * w, d * 0.5 + 0.03 * w], 0.13 * w),
  );
  throat.role = "channel".into();
  throat.color = [1., 0.18, 0.04];
  throat.strength = 5.;
  a.components.push(throat);
  Ok(())
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Grammar {
  pub major_motif_budget: u32,
  pub min_shaft_gap: f64,
}
impl Default for Grammar {
  fn default() -> Self {
    Self {
      major_motif_budget: 2,
      min_shaft_gap: 0.12,
    }
  }
}

/// Conservative preflight with explicit reasons; never silently changes the chosen recipe.
/// Numeric sanitation stays in each builder. No visit-order state or unbounded rejection loops.
pub fn check_grammar(f: &Features) -> anyhow::Result<()> {
  if f.cleft.is_some() {
    anyhow::ensure!(
      f.aperture.is_none()
        && f.fracture.is_none()
        && f.scars.is_none()
        && f.resonance.is_none()
        && f.emission.is_none(),
      "cleft requires limb-local features"
    );
  }
  anyhow::ensure!(
    !(f.aperture.is_some()
      && (f.fracture.is_some()
        || f.scars.is_some()
        || f.resonance.is_some()
        || f.emission.is_some())),
    "aperture requires rail-local surface features; incompatible blade topology"
  );
  anyhow::ensure!(
    !(f.fracture.is_some() && (f.scars.is_some() || f.resonance.is_some() || f.emission.is_some())),
    "fracture requires fragment-specific nodes and channels; incompatible legacy surface feature"
  );
  if let Some(g) = &f.grammar {
    anyhow::ensure!(
      (1..=4).contains(&g.major_motif_budget),
      "motif budget must be 1..=4"
    );
    valid(g.min_shaft_gap, 0.05, 0.3, "minimum shaft gap")?;
    let motifs = [
      f.scars.is_some(),
      f.staves.is_some(),
      f.gate.is_some(),
      f.fracture.is_some(),
      f.aperture.is_some(),
      f.cleft.is_some(),
      f.ribs.is_some(),
      f.crystals.is_some(),
      f.kernel.is_some(),
      f.strata.is_some(),
    ]
    .into_iter()
    .filter(|v| *v)
    .count() as u32;
    anyhow::ensure!(
      motifs <= g.major_motif_budget,
      "major motif budget exceeded: {motifs}"
    );
    if let Some(st) = &f.staves {
      anyhow::ensure!(
        st.radius - st.section * 0.75 - 0.08 >= g.min_shaft_gap,
        "stave/core clearance below grammar minimum"
      );
    }
    anyhow::ensure!(
      !(f.scars.is_some() && f.emission.is_some()),
      "legacy ribbon route crosses scar voids; supply scar-specific channels"
    );
  }
  Ok(())
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Staves {
  pub count: u32,
  pub radius: f64,
  pub section: f64,
  pub bow: f64,
}
impl Default for Staves {
  fn default() -> Self {
    Self {
      count: 4,
      radius: 0.34,
      section: 0.11,
      bow: 0.08,
    }
  }
}

fn component(id: &str, mesh: Mesh) -> Component {
  Component {
    id: id.into(),
    mesh,
    matrix: geom::IDENTITY,
    role: "metal".into(),
    color: [0.14, 0.17, 0.21],
    strength: 0.,
    travel: [0.; 3],
  }
}

/// Shared-index rectangular annulus about Y; used as real load-bearing end collars.
pub fn annulus_y(y: f64, r: f64, section: f64, height: f64) -> Mesh {
  let mut m = Mesh::default();
  let n = 24;
  for i in 0..n {
    let angle = std::f64::consts::TAU * i as f64 / n as f64;
    let (c, s) = (geom::cos(angle), geom::sin(angle));
    for (radius, dy) in [
      (r - section * 0.5, -height * 0.5),
      (r + section * 0.5, -height * 0.5),
      (r + section * 0.5, height * 0.5),
      (r - section * 0.5, height * 0.5),
    ] {
      m.pos
        .extend([(radius * c) as f32, (y + dy) as f32, (radius * s) as f32]);
    }
  }
  for i in 0..n {
    for k in 0..4 {
      let a = (i * 4 + k) as u32;
      let b = (i * 4 + (k + 1) % 4) as u32;
      let c = (((i + 1) % n) * 4 + k) as u32;
      let d = (((i + 1) % n) * 4 + (k + 1) % 4) as u32;
      m.idx.extend([a, b, c, b, d, c]);
    }
  }
  m.compute_vertex_normals();
  m
}

fn add_staves(a: &mut Assembly, s: &Sword, st: &Staves) -> anyhow::Result<()> {
  anyhow::ensure!((3..=6).contains(&st.count), "staves count must be 3..=6");
  valid(st.radius, 0.2, 0.45, "stave radius")?;
  valid(st.section, 0.07, 0.15, "stave section")?;
  valid(st.bow, 0., 0.2, "stave bow")?;
  let w = s.blade.base_width;
  let d = st.section * w * 0.5;
  a.components.retain(|c| !c.id.starts_with("handle#"));
  for i in 0..st.count {
    let theta = std::f64::consts::TAU * (i as f64 + 0.5) / st.count as f64;
    let (c, sn) = (geom::cos(theta), geom::sin(theta));
    let rings: Vec<_> = (0..=12)
      .map(|j| {
        let t = j as f64 / 12.;
        let r = w * (st.radius + st.bow * 4. * t * (1. - t));
        let (x, z) = (c * r, sn * r);
        let y = -s.handle.length * (1. - t);
        [
          [x - d, y, z - d],
          [x + d, y, z - d],
          [x + d, y, z + d],
          [x - d, y, z + d],
        ]
      })
      .collect();
    a.components
      .push(component(&format!("stave/{i}"), loft(&rings)));
  }
  for (i, y) in [-s.handle.length + 0.04 * w, -0.04 * w]
    .into_iter()
    .enumerate()
  {
    a.components.push(component(
      &format!("stave/collar/{i}"),
      annulus_y(y, st.radius * w, st.section * w * 1.5, 0.08 * w),
    ));
  }
  let mut core = component(
    "stave/core",
    node_mesh([0., -s.handle.length * 0.5, 0.], 0.08 * w),
  );
  // A closed elongated octahedron leaves air around the contained power source.
  for p in core.mesh.pos.chunks_exact_mut(3) {
    p[1] = (-s.handle.length * 0.5
      + (p[1] as f64 + s.handle.length * 0.5) * s.handle.length / (0.2 * w)) as f32;
  }
  core.mesh.compute_vertex_normals();
  core.role = "channel".into();
  core.color = [0.1, 0.85, 0.5];
  core.strength = 3.;
  a.components.push(core);
  Ok(())
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Scars {
  pub count: u32,
  pub depth: f64,
  pub length: f64,
}
impl Default for Scars {
  fn default() -> Self {
    Self {
      count: 3,
      depth: 0.24,
      length: 0.075,
    }
  }
}

/// Rectangular-section blade with explicit notch stations and a nonzero terminal section.
/// Scar boundaries exist independently of tessellation; no modification of the legacy blade grid.
fn scar_blade(s: &Sword, seed: u32, sc: &Scars) -> anyhow::Result<Mesh> {
  anyhow::ensure!((1..=6).contains(&sc.count), "scar count must be 1..=6");
  valid(sc.depth, 0.05, 0.3, "scar depth")?;
  valid(sc.length, 0.02, 0.09, "scar length")?;
  let mut scars = vec![];
  for i in 0..sc.count {
    let t = 0.16 + 0.52 * i as f64 / sc.count.max(1) as f64;
    let left = hash_seed(&format!("{seed}|scar|{i}")) & 1 == 0;
    scars.push((t, left));
  }
  let mut stations = vec![0., 0.8, 1.];
  for &(t, _) in &scars {
    stations.extend([t - sc.length * 0.5, t, t + sc.length * 0.5]);
  }
  stations.sort_by(f64::total_cmp);
  stations.dedup();
  let w = s.blade.base_width;
  let halfz = s.blade.thickness.unwrap_or(0.16) * 0.5;
  let rings: Vec<_> = stations
    .into_iter()
    .map(|t| {
      let width = w
        * (if t > 0.8 {
          1. - 0.98 * (t - 0.8) / 0.2
        } else {
          1.
        });
      let mut left = -width * 0.5;
      let mut right = width * 0.5;
      for &(at, is_left) in &scars {
        let e = (1. - (t - at).abs() / (sc.length * 0.5)).max(0.);
        if is_left {
          left += e * sc.depth * width;
        } else {
          right -= e * sc.depth * width;
        }
      }
      let y = t * s.blade.length;
      [
        [left, y, -halfz],
        [right, y, -halfz],
        [right, y, halfz],
        [left, y, halfz],
      ]
    })
    .collect();
  Ok(loft(&rings))
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Emission {
  pub star_k: f64,
  pub edge_strength: f64,
  pub channel_strength: f64,
}
impl Default for Emission {
  fn default() -> Self {
    Self {
      star_k: 10000.,
      edge_strength: 4.,
      channel_strength: 2.,
    }
  }
}

/// Authored linear-RGB knots; interpolate in specified table order, never blackbody platform maths.
pub fn star_color(k: f64) -> [f64; 3] {
  let knots = [
    (2500., [1., 0.24, 0.06]),
    (5500., [1., 0.85, 0.65]),
    (10000., [0.38, 0.65, 1.]),
    (30000., [0.25, 0.42, 1.]),
  ];
  let k = k.clamp(2500., 30000.);
  for i in 0..3 {
    if k <= knots[i + 1].0 {
      let t = (k - knots[i].0) / (knots[i + 1].0 - knots[i].0);
      return std::array::from_fn(|j| knots[i].1[j] + (knots[i + 1].1[j] - knots[i].1[j]) * t);
    }
  }
  knots[3].1
}

/// Closed four-corner loft. Each ring is clockwise viewed down +Y, no zero-size tips.
pub fn loft(rings: &[[[f64; 3]; 4]]) -> Mesh {
  let mut m = Mesh::default();
  for ring in rings {
    for p in ring {
      m.pos.extend(p.map(|v| v as f32));
    }
  }
  m.idx.extend([0, 1, 2, 0, 2, 3]);
  for i in 0..rings.len() - 1 {
    for k in 0..4 {
      let a = (i * 4 + k) as u32;
      let b = (i * 4 + (k + 1) % 4) as u32;
      m.idx.extend([a, a + 4, b, b, a + 4, b + 4]);
    }
  }
  let n = (rings.len() * 4 - 4) as u32;
  m.idx.extend([n, n + 2, n + 1, n, n + 3, n + 2]);
  m.compute_vertex_normals();
  m
}

fn luminous_ribbon(
  s: &Sword,
  mesh: &Mesh,
  offset: f64,
  width: f64,
  front: bool,
) -> anyhow::Result<Mesh> {
  let mut rings = vec![];
  let side = if front { 1. } else { -1. };
  for i in 0..=24 {
    let t = 0.08 + 0.70 * i as f64 / 24.;
    let y = t * s.blade.length;
    let w =
      crate::blade::tip_width_with_kissaki(&s.blade, t, s.blade.base_width, s.blade.tip_width);
    let cx = crate::blade::bend_offset_x(&s.blade, y, s.blade.length)
      + crate::blade::waviness_at(&s.blade, t).0;
    let x0 = cx + (offset - width * 0.5) * w;
    let x1 = cx + (offset + width * 0.5) * w;
    let p0 = surface_side(mesh, x0, y, front)
      .ok_or_else(|| anyhow::anyhow!("ribbon outside surface"))?
      .0;
    let p1 = surface_side(mesh, x1, y, front)
      .ok_or_else(|| anyhow::anyhow!("ribbon outside surface"))?
      .0;
    let z0 = p0[2] + side * 0.004 * s.blade.base_width;
    let z1 = p1[2] + side * 0.004 * s.blade.base_width;
    let d = side * 0.006 * s.blade.base_width;
    rings.push([[x0, y, z0], [x1, y, z1], [x1, y, z1 + d], [x0, y, z0 + d]]);
  }
  let mut m = loft(&rings);
  if !front {
    for t in m.idx.chunks_exact_mut(3) {
      t.swap(1, 2);
    }
    m.compute_vertex_normals();
  }
  Ok(m)
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Read {
  pub duration_ms: u32,
  pub emission_gain: f64,
}
impl Default for Read {
  fn default() -> Self {
    Self {
      duration_ms: 6500,
      emission_gain: 2.5,
    }
  }
}

/// Event-relative polynomial envelope, always returns to rest; no accumulated frame deltas.
pub fn read_envelope(time_ms: u32, duration_ms: u32, phase: f64) -> f64 {
  let t = time_ms as f64 / duration_ms.max(1) as f64;
  let smooth = |v: f64| {
    let v = v.clamp(0., 1.);
    v * v * (3. - 2. * v)
  };
  smooth((t - phase) / 0.12) * (1. - smooth((t - 0.78) / 0.22))
}

/// Sample a rest assembly. Future mechanical components use these same local translation tracks.
pub fn sample_read(rest: &Assembly, read: &Read, time_ms: u32) -> anyhow::Result<Assembly> {
  anyhow::ensure!(
    (2000..=15000).contains(&read.duration_ms),
    "read duration must be 2000..=15000 ms"
  );
  valid(read.emission_gain, 1., 4., "read emission gain")?;
  let mut a = rest.clone();
  for c in &mut a.components {
    let y = geom::world_bbox(&c.mesh, &c.matrix).0[1];
    let phase = (0.50 - y / rest.blade_length * 0.45).clamp(0., 0.65);
    let e = read_envelope(time_ms, read.duration_ms, phase);
    c.strength *= 1. + (read.emission_gain - 1.) * e;
    for k in 0..3 {
      c.matrix[12 + k] += c.travel[k] * e;
    }
  }
  Ok(a)
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Anchor {
  pub id: String,
  pub parent: String,
  pub position: [f64; 3],
  pub normal: [f64; 3],
  pub role: String,
  pub vocabulary: u32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Component {
  pub id: String,
  pub mesh: Mesh,
  pub matrix: geom::Mat4,
  pub role: String,
  pub color: [f64; 3],
  pub strength: f64,
  pub travel: [f64; 3],
}

#[derive(Clone, Debug, PartialEq)]
pub struct Assembly {
  pub components: Vec<Component>,
  pub anchors: Vec<Anchor>,
  pub blade_length: f64,
}

fn valid(x: f64, lo: f64, hi: f64, name: &str) -> anyhow::Result<()> {
  anyhow::ensure!(
    x.is_finite() && x >= lo && x <= hi,
    "{name} must be finite in {lo}..={hi}"
  );
  Ok(())
}

/// Front-face ray intersection with the actual exported triangles; works independently of grid topology.
pub fn surface(mesh: &Mesh, x: f64, y: f64) -> Option<([f64; 3], [f64; 3])> {
  surface_side(mesh, x, y, true)
}

pub fn surface_side(mesh: &Mesh, x: f64, y: f64, front: bool) -> Option<([f64; 3], [f64; 3])> {
  let mut hit: Option<([f64; 3], [f64; 3])> = None;
  for t in mesh.idx.chunks_exact(3) {
    let p = |i: u32| {
      let k = i as usize * 3;
      [
        mesh.pos[k] as f64,
        mesh.pos[k + 1] as f64,
        mesh.pos[k + 2] as f64,
      ]
    };
    let (a, b, c) = (p(t[0]), p(t[1]), p(t[2]));
    let d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if d.abs() < 1e-15 {
      continue;
    }
    let u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d;
    let v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d;
    if u < -1e-8 || v < -1e-8 || u + v > 1.0 + 1e-8 {
      continue;
    }
    let z = u * a[2] + v * b[2] + (1.0 - u - v) * c[2];
    let ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    let ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let (nx, ny, nz) = geom::normalize3(
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      d,
    );
    if hit
      .as_ref()
      .is_none_or(|h| if front { z > h.0[2] } else { z < h.0[2] })
    {
      hit = Some(([x, y, z], [nx, ny, nz]));
    }
  }
  hit
}

/// Closed, outward octahedron. Shared indices permit exact topological edge tests.
pub fn node_mesh(p: [f64; 3], r: f64) -> Mesh {
  let mut m = Mesh::default();
  for d in [
    [r, 0., 0.],
    [-r, 0., 0.],
    [0., r, 0.],
    [0., -r, 0.],
    [0., 0., r],
    [0., 0., -r],
  ] {
    m.pos.extend((0..3).map(|k| (p[k] + d[k]) as f32));
  }
  m.idx = vec![
    0, 2, 4, 2, 1, 4, 1, 3, 4, 3, 0, 4, 2, 0, 5, 1, 2, 5, 3, 1, 5, 0, 3, 5,
  ];
  m.compute_vertex_normals();
  m
}

pub fn build(s: &Sword, seed: u32, f: &Features) -> anyhow::Result<Assembly> {
  check_grammar(f)?;
  if let Some(r) = &f.read {
    anyhow::ensure!(
      (2000..=15000).contains(&r.duration_ms),
      "invalid read duration"
    );
    valid(r.emission_gain, 1., 4., "read gain")?;
  }
  anyhow::ensure!(
    s.hilt_enabled != Some(false)
      || (f.staves.is_none() && f.gate.is_none() && f.kernel.is_none() && f.chains.is_none()),
    "hilt features need an enabled hilt"
  );
  anyhow::ensure!(
    s.guard_enabled != Some(false) || (f.gate.is_none() && f.chains.is_none()),
    "guard features need an enabled guard"
  );
  valid(s.blade.length, 0.01, 1000., "blade length")?;
  valid(s.blade.base_width, 0.002, 100., "blade width")?;
  let mut counts = std::collections::BTreeMap::new();
  let components = model::build_model(s)?
    .into_iter()
    .map(|p| {
      let k = counts.entry(p.name).or_insert(0);
      let id = format!("{}#{k}", p.name);
      *k += 1;
      Component {
        id,
        mesh: p.mesh,
        matrix: p.matrix,
        role: "metal".into(),
        color: [0.14, 0.17, 0.21],
        strength: 0.,
        travel: [0.; 3],
      }
    })
    .collect();
  let mut a = Assembly {
    components,
    anchors: vec![],
    blade_length: s.blade.length,
  };
  if let Some(sc) = &f.scars {
    a.components[0].mesh = scar_blade(s, seed, sc)?;
    a.components.retain(|c| !c.id.starts_with("glow#"));
  }
  if let Some(st) = &f.staves {
    add_staves(&mut a, s, st)?;
  }
  if let Some(g) = &f.gate {
    add_gate(&mut a, s, g)?;
  }
  if let Some(fr) = &f.fracture {
    add_fracture(&mut a, s, seed, fr)?;
  }
  if let Some(ap) = &f.aperture {
    add_aperture(&mut a, s, ap)?;
  }
  if let Some(c) = &f.cleft {
    add_cleft(&mut a, s, c)?;
  }
  details::apply(&mut a, s, seed, f)?;
  if let Some(r) = &f.resonance {
    anyhow::ensure!((3..=9).contains(&r.count), "resonance count must be 3..=9");
    valid(r.radius, 0.03, 0.08, "resonance radius")?;
    for i in 0..r.count {
      let t = 0.12 + 0.60 * i as f64 / (r.count - 1) as f64;
      let y = t * s.blade.length;
      let x = crate::blade::bend_offset_x(&s.blade, y, s.blade.length)
        + crate::blade::waviness_at(&s.blade, t).0;
      let (p, n) = surface(&a.components[0].mesh, x, y)
        .ok_or_else(|| anyhow::anyhow!("node outside blade"))?;
      let id = format!(
        "resonance/{:08x}/{i}",
        hash_seed(&format!("{seed}|resonance"))
      );
      a.anchors.push(Anchor {
        id: id.clone(),
        parent: "blade#0".into(),
        position: p,
        normal: n,
        role: ["source", "conduction", "containment"][i as usize % 3].into(),
        vocabulary: 1,
      });
      a.components.push(Component {
        id,
        mesh: node_mesh(p, r.radius * s.blade.base_width),
        matrix: geom::IDENTITY,
        role: "node".into(),
        color: [0.8, 0.95, 1.],
        strength: 7.,
        travel: [0.; 3],
      });
    }
  }
  if let Some(e) = &f.emission {
    valid(e.star_k, 2500., 30000., "stellar temperature")?;
    valid(e.edge_strength, 0., 12., "edge strength")?;
    valid(e.channel_strength, 0., 12., "channel strength")?;
    for (i, (offset, width, role, color, strength)) in [
      (-0.43, 0.025, "edge", star_color(e.star_k), e.edge_strength),
      (0.43, 0.025, "edge", star_color(e.star_k), e.edge_strength),
      (0., 0.065, "channel", [0.10, 0.85, 0.5], e.channel_strength),
    ]
    .into_iter()
    .enumerate()
    {
      // Separate front/back meshes keep semantic material roles and face culling intact.
      for face in [1., -1.] {
        let mesh = luminous_ribbon(s, &a.components[0].mesh, offset, width, face > 0.)?;
        a.components.push(Component {
          id: format!("emission/{i}/{face}"),
          mesh,
          matrix: geom::IDENTITY,
          role: role.into(),
          color,
          strength,
          travel: [0.; 3],
        });
      }
    }
  }
  if let Some(t) = &f.terminator {
    details::terminator(&mut a, s, t, f)?;
  }
  Ok(a)
}

/// A deliberately broad, severe reference blank, with a 36 m blade in previews.
pub fn reference() -> Sword {
  use crate::params::*;
  Sword {
    blade: Blade {
      length: 6.,
      base_width: 1.,
      tip_width: 0.02,
      thickness: Some(0.16),
      tip_ramp_start: Some(0.8),
      cross_section: Some("diamond".into()),
      ..Blade::default()
    },
    guard: Guard {
      style: Some("forged".into()),
      width: 3.2,
      thickness: 0.3,
      forged: Some(crate::families::forged_defaults()),
      ..Guard::default()
    },
    handle: Handle {
      length: 1.4,
      radius_top: 0.18,
      radius_bottom: 0.18,
      ..Handle::default()
    },
    pommel: Pommel {
      style: Some("gem".into()),
      size: 0.42,
      elongation: 1.,
      ..Pommel::default()
    },
    ..Sword::default()
  }
}
