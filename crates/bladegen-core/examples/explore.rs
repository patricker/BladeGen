//! Rust geometry -> portable mesh buffers. `python explore/render.py` makes GLB/PNG from these buffers.
use bladegen_core::explore::{self, Features, Resonance};
use serde_json::json;
fn main() -> anyhow::Result<()> {
    let id = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "18-resonance".into());
    let features = match id.as_str() {
        "18-resonance" => Features {
            resonance: Some(Resonance::default()),
        },
        _ => anyhow::bail!("unknown experiment {id}"),
    };
    let s = explore::reference();
    let a = explore::build(&s, 42, &features)?;
    let components: Vec<_> = a.components.iter().map(|c| json!({"id":c.id,"position":c.mesh.pos,
        "normal":c.mesh.nrm,"index":c.mesh.idx,"matrix":c.matrix.to_vec(),"role":c.role,"color":c.color,"strength":c.strength})).collect();
    let dir = std::path::Path::new("explore/out").join(&id);
    std::fs::create_dir_all(&dir)?;
    std::fs::write(
        dir.join("mesh.json"),
        serde_json::to_vec(&json!({"format":"bladegen-explore/1","idea":id,
        "seed":42,"features":features,"bladeLength":s.blade.length,"heightM":36,"sink":0.12,
        "anchors":a.anchors,"components":components}))?,
    )?;
    println!("{}", dir.display());
    Ok(())
}
