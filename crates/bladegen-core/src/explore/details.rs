//! Secondary opt-in structural motifs. Every member is a real closed solid; no renderer-only tricks.
use super::*;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Ribs {
  pub pairs: u32,
  pub reach: f64,
}
impl Default for Ribs {
  fn default() -> Self {
    Self {
      pairs: 3,
      reach: 0.7,
    }
  }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Crystals {
  pub count: u32,
  pub length: f64,
  pub width: f64,
}
impl Default for Crystals {
  fn default() -> Self {
    Self {
      count: 4,
      length: 0.95,
      width: 0.24,
    }
  }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Kernel {
  pub core_radius: f64,
  pub read_lift: f64,
}
impl Default for Kernel {
  fn default() -> Self {
    Self {
      core_radius: 0.18,
      read_lift: 0.1,
    }
  }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Chains {
  pub links: u32,
  pub slack: f64,
}
impl Default for Chains {
  fn default() -> Self {
    Self {
      links: 6,
      slack: 0.2,
    }
  }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Sutures {
  pub stand_off: f64,
  pub section: f64,
}
impl Default for Sutures {
  fn default() -> Self {
    Self {
      stand_off: 0.1,
      section: 0.1,
    }
  }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Strata {
  pub layers: u32,
  pub diagonal: f64,
}
impl Default for Strata {
  fn default() -> Self {
    Self {
      layers: 4,
      diagonal: 0.28,
    }
  }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Encroachment {
  pub height: f64,
  pub sink: f64,
  pub projection: f64,
}
impl Default for Encroachment {
  fn default() -> Self {
    Self {
      height: 0.1,
      sink: 0.12,
      projection: 0.18,
    }
  }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Terminator {
  pub bias: f64,
}
impl Default for Terminator {
  fn default() -> Self {
    Self { bias: 0.5 }
  }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Circuit {
  pub branches: u32,
  pub width: f64,
}
impl Default for Circuit {
  fn default() -> Self {
    Self {
      branches: 3,
      width: 0.055,
    }
  }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Electrodes {
  pub count: u32,
  pub reach: f64,
  pub sink: f64,
}
impl Default for Electrodes {
  fn default() -> Self {
    Self {
      count: 3,
      reach: 1.4,
      sink: 0.12,
    }
  }
}

fn route(
  mesh: &Mesh,
  start: [f64; 2],
  end: [f64; 2],
  width: f64,
  lift: f64,
) -> anyhow::Result<Mesh> {
  let dx = end[0] - start[0];
  let dy = end[1] - start[1];
  let length = geom::v8_hypot(&[dx, dy]);
  let n = [dy / length, -dx / length];
  let mut rings = vec![];
  for i in 0..=16 {
    let t = i as f64 / 16.;
    let p = [start[0] + dx * t, start[1] + dy * t];
    let mut ps = [[0.; 3]; 4];
    for (j, side) in [-1., 1.].into_iter().enumerate() {
      let (x, y) = (
        p[0] + n[0] * width * 0.5 * side,
        p[1] + n[1] * width * 0.5 * side,
      );
      let z = surface(mesh, x, y)
        .ok_or_else(|| anyhow::anyhow!("circuit route outside blade"))?
        .0[2]
        + lift;
      ps[j] = [x, y, z];
      ps[3 - j] = [x, y, z + width * 0.14];
    }
    rings.push(ps);
  }
  Ok(loft(&rings))
}

pub(super) fn terminator(
  a: &mut Assembly,
  s: &Sword,
  t: &Terminator,
  f: &Features,
) -> anyhow::Result<()> {
  valid(t.bias, -0.7, 0.7, "terminator bias")?;
  anyhow::ensure!(
    f.gate.is_none() && f.fracture.is_none() && f.kernel.is_none(),
    "terminator requires static support tracks"
  );
  let warp = |p: [f64; 3]| {
    let side = p[0] / (p[0].abs() + 0.15 * s.blade.base_width);
    [
      p[0] * (1. + if p[0] >= 0. { t.bias } else { -t.bias * 0.5 }),
      p[1],
      p[2] * (1. + t.bias * 0.5 * side),
    ]
  };
  for c in &mut a.components {
    for p in c.mesh.pos.chunks_exact_mut(3) {
      let q = warp(geom::apply_point(
        &c.matrix,
        [p[0] as f64, p[1] as f64, p[2] as f64],
      ));
      for k in 0..3 {
        p[k] = q[k] as f32;
      }
    }
    c.matrix = geom::IDENTITY;
    c.mesh.compute_vertex_normals();
  }
  for n in &mut a.anchors {
    n.position = warp(n.position);
    if let Some(parent) = a.components.iter().find(|c| c.id == n.parent) {
      if let Some((p, normal)) = surface(&parent.mesh, n.position[0], n.position[1]) {
        n.position = p;
        n.normal = normal;
      }
    }
  }
  Ok(())
}

fn block(id: &str, center: [f64; 3], size: [f64; 3]) -> Component {
  let mut c = component(id, geom::box_geometry(size[0], size[1], size[2]));
  c.matrix = geom::compose(center, [0.; 3], [1.; 3]);
  c
}

pub(super) fn apply(a: &mut Assembly, s: &Sword, seed: u32, f: &Features) -> anyhow::Result<()> {
  if let Some(e) = &f.electrodes {
    anyhow::ensure!((2..=6).contains(&e.count), "electrodes count must be 2..=6");
    valid(e.reach, 0.8, 1.8, "electrode reach")?;
    valid(e.sink, 0., 0.4, "electrode sink")?;
    let w = s.blade.base_width;
    let ground = s.blade.length * (1. - e.sink);
    for i in 0..e.count {
      let angle = std::f64::consts::PI * i as f64 / (e.count - 1) as f64;
      let poly = [
        [0.1 * w, ground - 0.35 * w],
        [e.reach * w, ground - 0.06 * w],
        [e.reach * w, ground + 0.06 * w],
        [0.1 * w, ground - 0.15 * w],
      ];
      let id = format!("electrode/{i}");
      let mut c = component(&id, extrude(&poly, 0.18 * w)?);
      c.matrix = geom::compose([0.; 3], [0., angle, 0.], [1.; 3]);
      let socket = geom::apply_point(&c.matrix, [e.reach * w, ground, 0.]);
      a.anchors.push(Anchor {
        id: format!("circle/socket/{i}"),
        parent: id,
        position: socket,
        normal: [0., -1., 0.],
        role: "ground-power".into(),
        vocabulary: 1,
      });
      a.components.push(c);
    }
  }
  if let Some(c) = &f.circuit {
    anyhow::ensure!(
      (1..=3).contains(&c.branches),
      "circuit branches must be 1..=3"
    );
    valid(c.width, 0.03, 0.09, "circuit width")?;
    anyhow::ensure!(
      f.aperture.is_none() && f.fracture.is_none() && f.cleft.is_none() && f.strata.is_none(),
      "circuit needs continuous blade surface"
    );
    let w = s.blade.base_width;
    let l = s.blade.length;
    let mut lines = vec![([0., 0.76 * l], [0., 0.16 * l])];
    for i in 0..c.branches {
      let y = (0.24 + 0.36 * i as f64 / c.branches as f64) * l;
      for sign in [-1., 1.] {
        lines.push(([0., y + 0.07 * l], [sign * 0.29 * w, y]));
      }
    }
    for (i, (p, q)) in lines.into_iter().enumerate() {
      let rim = route(&a.components[0].mesh, p, q, c.width * w * 1.7, 0.005 * w)?;
      a.components
        .push(component(&format!("circuit/rim/{i}"), rim));
      let mesh = route(&a.components[0].mesh, p, q, c.width * w, 0.022 * w)?;
      let mut wire = component(&format!("circuit/path/{i}"), mesh);
      wire.role = "channel".into();
      wire.color = [1., 0.16, 0.015];
      wire.strength = 3.;
      a.components.push(wire);
    }
  }
  if let Some(e) = &f.encroachment {
    valid(e.height, 0.04, 0.2, "encroachment height")?;
    valid(e.sink, 0., 0.4, "encroachment sink")?;
    valid(e.projection, 0.1, 0.35, "encroachment projection")?;
    let w = s.blade.base_width;
    let ground = s.blade.length * (1. - e.sink);
    for i in 0..5 {
      let hash = hash_seed(&format!("{seed}|basalt/{i}"));
      let x = (-0.42 + i as f64 * 0.21) * w;
      let height = e.height * s.blade.length * (0.6 + 0.1 * (hash % 5) as f64);
      let poly = [
        [x - 0.14 * w, ground + 0.03 * s.blade.length],
        [x - 0.12 * w, ground - height * 0.6],
        [x + 0.03 * w, ground - height],
        [x + 0.15 * w, ground - height * 0.3],
        [x + 0.17 * w, ground + 0.03 * s.blade.length],
      ];
      let mut c = component(
        &format!("basalt/{i}"),
        extrude(&poly, s.blade.thickness.unwrap_or(0.16) + e.projection * w)?,
      );
      c.color = [0.045, 0.035, 0.03];
      a.components.push(c);
    }
  }
  if let Some(st) = &f.strata {
    anyhow::ensure!((2..=6).contains(&st.layers), "strata layers must be 2..=6");
    valid(st.diagonal, 0., 0.5, "strata diagonal")?;
    anyhow::ensure!(
      f.scars.is_none()
        && f.cleft.is_none()
        && f.fracture.is_none()
        && f.aperture.is_none()
        && f.resonance.is_none()
        && f.emission.is_none(),
      "strata is a dedicated topology"
    );
    let w = s.blade.base_width;
    let l = s.blade.length;
    a.components
      .retain(|c| !c.id.starts_with("blade#") && !c.id.starts_with("glow#"));
    for i in 0..st.layers {
      let bottom = 0.8 * l * i as f64 / st.layers as f64;
      let top = 0.8 * l * (i + 1) as f64 / st.layers as f64;
      let b = if i == 0 { 0. } else { st.diagonal * w };
      let t = if i + 1 == st.layers {
        0.
      } else {
        st.diagonal * w
      };
      let mut poly = vec![
        [-w * 0.5, bottom - b],
        [w * 0.5, bottom + b],
        [w * 0.5, top + t],
      ];
      if i + 1 == st.layers {
        poly.extend([[w * 0.01, l], [-w * 0.01, l]]);
      }
      poly.push([-w * 0.5, top - t]);
      let mut c = component(
        &format!("strata/{i}"),
        extrude(&poly, s.blade.thickness.unwrap_or(0.16))?,
      );
      c.color = if i % 2 == 0 {
        [0.10, 0.12, 0.15]
      } else {
        [0.38, 0.30, 0.18]
      };
      a.components.push(c);
    }
  }
  if let Some(st) = &f.sutures {
    let sc = f
      .scars
      .as_ref()
      .ok_or_else(|| anyhow::anyhow!("sutures require explicit scar records"))?;
    valid(st.stand_off, 0.04, 0.2, "suture stand-off")?;
    valid(st.section, 0.07, 0.16, "suture section")?;
    let w = s.blade.base_width;
    let z = s.blade.thickness.unwrap_or(0.16) * 0.5;
    for i in 0..sc.count {
      let y = (0.16 + 0.52 * i as f64 / sc.count as f64) * s.blade.length;
      let sign = if hash_seed(&format!("{seed}|scar|{i}")) & 1 == 0 {
        -1.
      } else {
        1.
      };
      let x = sign * 0.40 * w;
      let half = sc.length * s.blade.length * 0.5 + 0.07 * w;
      let mut bar = block(
        &format!("suture/{i}/bridge"),
        [x, y, z + st.stand_off * w],
        [st.section * w, 2. * half + st.section * w, 0.06 * w],
      );
      bar.color = [0.6, 0.3, 0.1];
      a.components.push(bar);
      for side in [-1., 1.] {
        let yy = y + side * half;
        a.components.push(block(
          &format!("suture/{i}/foot/{side}"),
          [x, yy, z + st.stand_off * w * 0.5],
          [st.section * w, st.section * w, st.stand_off * w + 0.04 * w],
        ));
        a.anchors.push(Anchor {
          id: format!("suture/{i}/anchor/{side}"),
          parent: "blade#0".into(),
          position: [x, yy, z],
          normal: [0., 0., 1.],
          role: "repair".into(),
          vocabulary: 1,
        });
      }
    }
  }
  if let Some(ch) = &f.chains {
    anyhow::ensure!((4..=10).contains(&ch.links), "chain links must be 4..=10");
    valid(ch.slack, 0., 0.3, "chain slack")?;
    anyhow::ensure!(
      f.fracture.is_none() && f.cleft.is_none() && f.aperture.is_none() && f.gate.is_none(),
      "chains require fixed forged-guard and blade anchors"
    );
    let w = s.blade.base_width;
    for sign in [1., -1.] {
      let start = [sign * 1.35 * w, 0., 0.];
      let end = [sign * 0.42 * w, 0.44 * s.blade.length, 0.];
      a.anchors.push(Anchor {
        id: format!("chain/root/{sign}"),
        parent: "guard#0".into(),
        position: start,
        normal: [0., 0., 1.],
        role: "restraint".into(),
        vocabulary: 1,
      });
      a.anchors.push(Anchor {
        id: format!("chain/end/{sign}"),
        parent: "blade#0".into(),
        position: end,
        normal: [0., 0., 1.],
        role: "restraint".into(),
        vocabulary: 1,
      });
      let step = (end[1] - start[1]) / ch.links as f64;
      for i in 0..ch.links {
        let t = (i as f64 + 0.5) / ch.links as f64;
        let x = start[0] + (end[0] - start[0]) * t + sign * ch.slack * w * 4. * t * (1. - t);
        let y = start[1] + (end[1] - start[1]) * t;
        let mut mesh = annulus_y(0., step * 0.46, step * 0.22, step * 0.20);
        // Turn annulus Y into a vertical link plane, alternating by 90 degrees about chain axis.
        let tilt = std::f64::consts::FRAC_PI_2;
        let transform = geom::compose(
          [x, y, 0.],
          [tilt, if i % 2 == 0 { 0. } else { tilt }, 0.],
          [0.75, 1., 1.25],
        );
        for p in mesh.pos.chunks_exact_mut(3) {
          let q = geom::apply_point(&transform, [p[0] as f64, p[1] as f64, p[2] as f64]);
          for k in 0..3 {
            p[k] = q[k] as f32;
          }
        }
        mesh.compute_vertex_normals();
        a.components
          .push(component(&format!("chain/{sign}/{i}"), mesh));
      }
    }
  }
  if let Some(k) = &f.kernel {
    valid(k.core_radius, 0.12, 0.20, "kernel radius")?;
    valid(k.read_lift, 0., 0.1, "kernel lift")?;
    a.components.retain(|c| !c.id.starts_with("pommel#"));
    let w = s.blade.base_width;
    let y = -s.handle.length;
    let poly = [
      [0.1, 0.],
      [0.1, -0.18],
      [0.28, -0.3],
      [0.44, -0.5],
      [0.25, -0.9],
      [0.4, -1.],
      [0.65, -0.5],
      [0.4, -0.15],
    ];
    for sign in [1., -1.] {
      let ps: Vec<_> = poly.iter().map(|p| [p[0] * w, y + p[1] * w]).collect();
      let mut mesh = extrude(&ps, 0.28 * w)?;
      if sign < 0. {
        for p in mesh.pos.chunks_exact_mut(3) {
          p[0] = -p[0];
        }
        for t in mesh.idx.chunks_exact_mut(3) {
          t.swap(1, 2);
        }
        mesh.compute_vertex_normals();
      }
      a.components
        .push(component(&format!("kernel/cage/{sign}"), mesh));
    }
    a.components.push(component(
      "kernel/socket",
      extrude(
        &[
          [-0.18 * w, y - 0.12 * w],
          [0.18 * w, y - 0.12 * w],
          [0.18 * w, y],
          [-0.18 * w, y],
        ],
        0.3 * w,
      )?,
    ));
    let mut c = component(
      "kernel/core",
      node_mesh([0., y - 0.55 * w, 0.], k.core_radius * w),
    );
    c.role = "node".into();
    c.color = [1., 0.75, 0.25];
    c.strength = 8.;
    c.travel = [0., -k.read_lift * w, 0.];
    a.components.push(c);
  }
  if let Some(c) = &f.crystals {
    anyhow::ensure!((1..=6).contains(&c.count), "crystal count must be 1..=6");
    valid(c.length, 0.4, 1.5, "crystal length")?;
    valid(c.width, 0.15, 0.35, "crystal width")?;
    anyhow::ensure!(
      f.fracture.is_none() && f.cleft.is_none() && f.aperture.is_none(),
      "crystals need a continuous blade edge"
    );
    let w = s.blade.base_width;
    for i in 0..c.count {
      let hash = hash_seed(&format!("{seed}|crystal/{i}"));
      let sign = if hash & 1 == 0 { 1. } else { -1. };
      let y = (0.16 + 0.48 * i as f64 / c.count.max(1) as f64) * s.blade.length;
      let mut mesh = node_mesh([0.; 3], c.width * w * 0.5);
      for p in mesh.pos.chunks_exact_mut(3) {
        p[1] = (p[1] as f64 * c.length / c.width + c.length * w * 0.35) as f32;
      }
      mesh.compute_vertex_normals();
      let mut part = component(&format!("crystal/{i}"), mesh);
      let angle = -sign * std::f64::consts::PI * (0.28 + 0.04 * ((hash >> 8) % 3) as f64);
      part.matrix = geom::compose([sign * 0.36 * w, y, 0.], [0., 0., angle], [1.; 3]);
      part.role = "mineral".into();
      part.color = [0.09, 0.65, 0.8];
      part.strength = 0.7;
      a.components.push(part);
    }
  }
  if let Some(r) = &f.ribs {
    anyhow::ensure!((2..=4).contains(&r.pairs), "rib pairs must be 2..=4");
    valid(r.reach, 0.4, 1., "rib reach")?;
    anyhow::ensure!(
      f.fracture.is_none() && f.aperture.is_none() && f.cleft.is_none() && f.scars.is_none(),
      "ribs require continuous legacy blade roots"
    );
    let w = s.blade.base_width;
    for i in 0..r.pairs {
      for sign in [1., -1.] {
        let y = (0.10 + 0.48 * i as f64 / (r.pairs - 1) as f64) * s.blade.length;
        let path = [
          [0.38, 0.],
          [0.5 + r.reach * 0.85, 0.18],
          [0.5 + r.reach, 0.55],
          [0.85, 0.95],
          [0.38, 1.],
          [0.38, 0.85],
          [0.72, 0.80],
          [0.35 + r.reach, 0.50],
          [0.35 + r.reach * 0.85, 0.30],
          [0.38, 0.15],
        ];
        let poly: Vec<_> = path.iter().map(|p| [p[0] * w, y + p[1] * w]).collect();
        let mut mesh = extrude(&poly, 0.16 * w)?;
        if sign < 0. {
          for p in mesh.pos.chunks_exact_mut(3) {
            p[0] = -p[0];
          }
          for t in mesh.idx.chunks_exact_mut(3) {
            t.swap(1, 2);
          }
          mesh.compute_vertex_normals();
        }
        a.components
          .push(component(&format!("rib/{i}/{sign}"), mesh));
      }
    }
  }
  Ok(())
}
