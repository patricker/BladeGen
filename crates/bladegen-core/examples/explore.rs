//! Rust geometry -> portable mesh buffers. `python explore/render.py` makes GLB/PNG from these buffers.
use bladegen_core::explore::{self, Features, Resonance, Read, Emission, Scars};
use serde_json::json;
fn main() -> anyhow::Result<()> {
    let id = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "18-resonance".into());
    let features = match id.as_str() {
        "18-resonance" => Features {
            resonance: Some(Resonance::default()),
            ..Features::default()
        },
        "16-read" => Features {resonance:Some(Resonance {radius:0.08,..Resonance::default()}),read:Some(Read::default()),..Features::default()},
        "15-emission" => Features {resonance:Some(Resonance::default()),emission:Some(Emission::default()),..Features::default()},
        "12-scars" => Features {scars:Some(Scars::default()),resonance:Some(Resonance::default()),..Features::default()},
        _ => anyhow::bail!("unknown experiment {id}"),
    };
    let s = explore::reference();
    let rest = explore::build(&s, 42, &features)?;
    let time_ms=std::env::args().nth(2).map(|v|v.parse::<u32>()).transpose()?.unwrap_or(4000);
    let a = match &features.read { Some(r)=>explore::sample_read(&rest,r,time_ms)?,None=>rest };
    let components: Vec<_> = a.components.iter().map(|c| json!({"id":c.id,"position":c.mesh.pos,
        "normal":c.mesh.nrm,"index":c.mesh.idx,"matrix":c.matrix.to_vec(),"role":c.role,"color":c.color,"strength":c.strength})).collect();
    let dir = std::path::Path::new("explore/out").join(&id);
    std::fs::create_dir_all(&dir)?;
    std::fs::write(
        dir.join("mesh.json"),
        serde_json::to_vec(&json!({"format":"bladegen-explore/1","idea":id,
        "seed":42,"features":features,"bladeLength":s.blade.length,"heightM":36,"sink":0.12,
        "timeMs":time_ms,"anchors":a.anchors,"components":components}))?,
    )?;
    println!("{}", dir.display());
    Ok(())
}
