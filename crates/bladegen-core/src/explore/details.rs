//! Secondary opt-in structural motifs. Every member is a real closed solid; no renderer-only tricks.
use super::*;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct Ribs {pub pairs:u32,pub reach:f64}
impl Default for Ribs {fn default()->Self {Self {pairs:3,reach:0.7}}}

pub(super) fn apply(a:&mut Assembly,s:&Sword,_seed:u32,f:&Features)->anyhow::Result<()> {
    if let Some(r)=&f.ribs {
        anyhow::ensure!((2..=4).contains(&r.pairs),"rib pairs must be 2..=4");valid(r.reach,0.4,1.,"rib reach")?;
        anyhow::ensure!(f.fracture.is_none() && f.aperture.is_none() && f.cleft.is_none() && f.scars.is_none(),"ribs require continuous legacy blade roots");
        let w=s.blade.base_width;
        for i in 0..r.pairs {for sign in [1.,-1.] {
            let y=(0.10+0.48*i as f64/(r.pairs-1) as f64)*s.blade.length;
            let path=[[0.38,0.],[0.5+r.reach*0.85,0.18],[0.5+r.reach,0.55],[0.85,0.95],[0.38,1.],
                [0.38,0.85],[0.72,0.80],[0.35+r.reach,0.50],[0.35+r.reach*0.85,0.30],[0.38,0.15]];
            let poly:Vec<_>=path.iter().map(|p|[p[0]*w,y+p[1]*w]).collect();
            let mut mesh=extrude(&poly,0.16*w)?;
            if sign<0. {for p in mesh.pos.chunks_exact_mut(3) {p[0] = -p[0];} for t in mesh.idx.chunks_exact_mut(3) {t.swap(1,2);}mesh.compute_vertex_normals();}
            a.components.push(component(&format!("rib/{i}/{sign}"),mesh));
        }}
    } Ok(())
}
