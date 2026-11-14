//! Secondary opt-in structural motifs. Every member is a real closed solid; no renderer-only tricks.
use super::*;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct Ribs {pub pairs:u32,pub reach:f64}
impl Default for Ribs {fn default()->Self {Self {pairs:3,reach:0.7}}}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct Crystals {pub count:u32,pub length:f64,pub width:f64}
impl Default for Crystals {fn default()->Self {Self {count:4,length:0.95,width:0.24}}}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct Kernel {pub core_radius:f64,pub read_lift:f64}
impl Default for Kernel {fn default()->Self {Self {core_radius:0.18,read_lift:0.1}}}

pub(super) fn apply(a:&mut Assembly,s:&Sword,seed:u32,f:&Features)->anyhow::Result<()> {
    if let Some(k)=&f.kernel {
        valid(k.core_radius,0.12,0.20,"kernel radius")?;valid(k.read_lift,0.,0.1,"kernel lift")?;
        a.components.retain(|c|!c.id.starts_with("pommel#"));let w=s.blade.base_width;let y=-s.handle.length;
        let poly=[[0.1,0.],[0.1,-0.18],[0.28,-0.3],[0.44,-0.5],[0.25,-0.9],[0.4,-1.],[0.65,-0.5],[0.4,-0.15]];
        for sign in [1.,-1.] {
            let ps:Vec<_>=poly.iter().map(|p|[p[0]*w,y+p[1]*w]).collect();let mut mesh=extrude(&ps,0.28*w)?;
            if sign<0. {for p in mesh.pos.chunks_exact_mut(3) {p[0] = -p[0];}for t in mesh.idx.chunks_exact_mut(3) {t.swap(1,2);}mesh.compute_vertex_normals();}
            a.components.push(component(&format!("kernel/cage/{sign}"),mesh));
        }
        a.components.push(component("kernel/socket",extrude(&[[-0.18*w,y-0.12*w],[0.18*w,y-0.12*w],[0.18*w,y],[-0.18*w,y]],0.3*w)?));
        let mut c=component("kernel/core",node_mesh([0.,y-0.55*w,0.],k.core_radius*w));
        c.role="node".into();c.color=[1.,0.75,0.25];c.strength=8.;c.travel=[0.,-k.read_lift*w,0.];a.components.push(c);
    }
    if let Some(c)=&f.crystals {
        anyhow::ensure!((1..=6).contains(&c.count),"crystal count must be 1..=6");valid(c.length,0.4,1.5,"crystal length")?;valid(c.width,0.15,0.35,"crystal width")?;
        anyhow::ensure!(f.fracture.is_none() && f.cleft.is_none() && f.aperture.is_none(),"crystals need a continuous blade edge");
        let w=s.blade.base_width;
        for i in 0..c.count {
            let hash=hash_seed(&format!("{seed}|crystal/{i}"));let sign=if hash&1==0 {1.} else {-1.};
            let y=(0.16+0.48*i as f64/c.count.max(1) as f64)*s.blade.length;
            let mut mesh=node_mesh([0.;3],c.width*w*0.5);
            for p in mesh.pos.chunks_exact_mut(3) {p[1]=(p[1] as f64*c.length/c.width+c.length*w*0.35) as f32;}
            mesh.compute_vertex_normals();let mut part=component(&format!("crystal/{i}"),mesh);
            let angle=-sign*std::f64::consts::PI*(0.28+0.04*((hash>>8)%3) as f64);
            part.matrix=geom::compose([sign*0.36*w,y,0.],[0.,0.,angle],[1.;3]);
            part.role="mineral".into();part.color=[0.09,0.65,0.8];part.strength=0.7;a.components.push(part);
        }
    }
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
