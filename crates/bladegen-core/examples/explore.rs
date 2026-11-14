//! Rust geometry -> portable mesh buffers. `python explore/render.py` makes GLB/PNG from these buffers.
use bladegen_core::explore::{self, *};
use serde_json::json;
fn main() -> anyhow::Result<()> {
  let id = std::env::args()
    .nth(1)
    .unwrap_or_else(|| "18-resonance".into());
  if id == "--verify" {
    let path = std::env::args()
      .nth(2)
      .ok_or_else(|| anyhow::anyhow!("missing manifest path"))?;
    let manifest: contract::Manifest = serde_json::from_slice(&std::fs::read(path)?)?;
    contract::replay(&manifest)?;
    println!("manifest replay verified");
    return Ok(());
  }
  let time_ms = std::env::args()
    .nth(2)
    .map(|v| v.parse::<u32>())
    .transpose()?
    .unwrap_or(4000);
  if id == "--all" {
    for id in presets::IDEAS {
      export_idea(id, time_ms)?;
    }
  } else {
    export_idea(&id, time_ms)?;
  }
  Ok(())
}
fn export_idea(id: &str, time_ms: u32) -> anyhow::Result<()> {
  let features = presets::preset(id)?;
  let s = explore::reference();
  let rest = explore::build(&s, 42, &features)?;
  let a = match &features.read {
    Some(r) => explore::sample_read(&rest, r, time_ms)?,
    None => rest,
  };
  let components: Vec<_> = a.components.iter().map(|c| json!({"id":c.id,"position":c.mesh.pos,
        "normal":c.mesh.nrm,"index":c.mesh.idx,"matrix":c.matrix.to_vec(),"role":c.role,"color":c.color,"strength":c.strength})).collect();
  let dir = std::path::Path::new("explore/out").join(&id);
  std::fs::create_dir_all(&dir)?;
  if let Some(read) = &features.read {
    for ms in [0, 1800, 4000, 6500] {
      let rest = build(&s, 42, &features)?;
      let frame = sample_read(&rest, read, ms)?;
      let folder = dir.join("frames").join(format!("time-{ms:04}"));
      std::fs::create_dir_all(&folder)?;
      let cs: Vec<_> = frame.components.iter().map(|c| json!({"id":c.id,"position":c.mesh.pos,
        "normal":c.mesh.nrm,"index":c.mesh.idx,"matrix":c.matrix.to_vec(),"role":c.role,"color":c.color,"strength":c.strength})).collect();
      std::fs::write(
        folder.join("mesh.json"),
        serde_json::to_vec(&json!({"format":"bladegen-explore/1","idea":id,
        "seed":42,"features":features,"bladeLength":s.blade.length,"heightM":36,"sink":0.12,
        "timeMs":ms,"anchors":frame.anchors,"components":cs}))?,
      )?;
    }
  }
  std::fs::write(
    dir.join("recipe.json"),
    serde_json::to_vec_pretty(&explore::contract::record(&s, 42, &features, 36., 0.12)?)?,
  )?;
  if id == "24-lod" {
    let mut counts = vec![];
    for (level, a) in explore::authoring::lods(&s, 42, &features)?
      .into_iter()
      .enumerate()
    {
      let folder = dir.join(format!("lod-{level}"));
      std::fs::create_dir_all(&folder)?;
      let cs: Vec<_> = a
        .components
        .iter()
        .map(|c| {
          json!({"id":c.id,"position":c.mesh.pos,"normal":c.mesh.nrm,"index":c.mesh.idx,
                "matrix":c.matrix.to_vec(),"role":c.role,"color":c.color,"strength":c.strength})
        })
        .collect();
      counts.push(json!({"level":level,"vertices":a.components.iter().map(|c|c.mesh.vertex_count()).sum::<usize>(),
                "triangles":a.components.iter().map(|c|c.mesh.idx.len()/3).sum::<usize>()}));
      std::fs::write(
        folder.join("mesh.json"),
        serde_json::to_vec(
          &json!({"format":"bladegen-explore/1","idea":id,"seed":42,"features":features,
                "bladeLength":s.blade.length,"heightM":36,"sink":0.12,"anchors":a.anchors,"components":cs}),
        )?,
      )?;
    }
    std::fs::write(dir.join("lods.json"), serde_json::to_vec_pretty(&counts)?)?;
  }
  if id == "23-explorer" {
    let mut cells = vec![];
    for (name, traits) in [
      ("magnetic", json!({"hasDynamo":true,"dipoleIndex":0.9})),
      ("volcanic", json!({"volcanismIndex":0.9})),
    ] {
      let t = bladegen_core::families::PlanetTraits::from_json(&traits);
      for c in explore::authoring::candidates(&s, &t, 42, 3, None)? {
        let a = build(&c.base, c.seed, &c.features)?;
        let folder = dir.join("cells").join(format!("{name}-{}", c.seed));
        std::fs::create_dir_all(&folder)?;
        let cs: Vec<_> = a
          .components
          .iter()
          .map(|c| {
            json!({"id":c.id,"position":c.mesh.pos,"normal":c.mesh.nrm,"index":c.mesh.idx,
                    "matrix":c.matrix.to_vec(),"role":c.role,"color":c.color,"strength":c.strength})
          })
          .collect();
        std::fs::write(
          folder.join("mesh.json"),
          serde_json::to_vec(
            &json!({"format":"bladegen-explore/1","idea":id,"seed":c.seed,"features":c.features,
                    "bladeLength":c.base.blade.length,"heightM":36,"sink":0.12,"anchors":a.anchors,"components":cs}),
          )?,
        )?;
        cells.push(c);
      }
    }
    std::fs::write(
      dir.join("candidates.json"),
      serde_json::to_vec_pretty(&cells)?,
    )?;
  }
  if id == "22-dedup" {
    let mut scenes = vec![];
    for (name, f) in [
      ("blank-a", Features::default()),
      ("blank-b", Features::default()),
      ("window", features.clone()),
      (
        "cleft",
        Features {
          cleft: Some(Cleft::default()),
          ..Features::default()
        },
      ),
      (
        "faultbound",
        Features {
          fracture: Some(Fracture::default()),
          ..Features::default()
        },
      ),
    ] {
      scenes.push((name.to_string(), build(&s, 42, &f)?));
    }
    std::fs::write(
      dir.join("audit.json"),
      serde_json::to_vec_pretty(&explore::audit::nearest(&scenes, s.blade.length)?)?,
    )?;
  }
  use explore::raster::{render, View};
  std::fs::write(
    dir.join("metrics.json"),
    serde_json::to_vec(&json!({
        "mast":render(&a,s.blade.length,36.,0.12,View::Mast,128)?,
        "drone":render(&a,s.blade.length,36.,0.12,View::Drone,128)?}))?,
  )?;
  std::fs::write(
    dir.join("mesh.json"),
    serde_json::to_vec(&json!({"format":"bladegen-explore/1","idea":id,
        "seed":42,"features":features,"bladeLength":s.blade.length,"heightM":36,"sink":0.12,
        "timeMs":time_ms,"anchors":a.anchors,"components":components}))?,
  )?;
  println!("{}", dir.display());
  Ok(())
}
