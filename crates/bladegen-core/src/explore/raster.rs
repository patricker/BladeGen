//! Perceptual diagnostics, not an aesthetic fitness function. Fixed-point pixel coverage,
//! fixed camera conventions, perspective-correct depth, ground clipping, stable triangle order.
use super::Assembly;
use crate::geom;
use serde::Serialize;

#[derive(Clone, Copy, Debug)]
pub enum View { Mast, Drone }
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all="camelCase")]
pub struct Mask {
    pub size:usize,
    /// 0=background, 1=metal, 2=emissive; row-major, top to bottom.
    pub pixels:Vec<u8>,
    pub occupied:u32,
    pub emission:u32,
    pub enclosed_void:u32,
    pub width_profile:Vec<u32>,
}
fn dot(a:[f64;3],b:[f64;3])->f64 { a[0]*b[0]+a[1]*b[1]+a[2]*b[2] }
fn cross(a:[f64;3],b:[f64;3])->[f64;3] { [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]] }
fn norm(p:[f64;3])->[f64;3] {let (x,y,z)=geom::normalize3(p[0],p[1],p[2]);[x,y,z]}

pub fn render(a:&Assembly,blade_length:f64,height_m:f64,sink:f64,view:View,size:usize)->anyhow::Result<Mask> {
    anyhow::ensure!([64,128,256].contains(&size),"raster resolution must be 64, 128 or 256");
    super::valid(blade_length,0.01,1000.,"raster blade length")?;
    super::valid(height_m,30.,42.,"raster height")?;super::valid(sink,0.,0.6,"raster sink")?;
    let eye=match view {View::Mast=>[0.,22.,75.],View::Drone=>[35.,48.,65.]};
    let forward=norm([-eye[0],22.-eye[1],-eye[2]]);
    let right=norm(cross(forward,[0.,1.,0.]));let up=cross(right,forward);
    let focal=size as f64/(2.*geom::tan(std::f64::consts::PI/8.));
    let scale=height_m/blade_length;
    let mut pixels=vec![0;size*size];let mut depth=vec![f64::INFINITY;size*size];
    for c in &a.components {
        let points:Vec<_>=c.mesh.pos.chunks_exact(3).map(|p| {
            let p=geom::apply_point(&c.matrix,[p[0] as f64,p[1] as f64,p[2] as f64]);
            [-p[0]*scale,height_m*(1.-sink)-p[1]*scale,p[2]*scale]
        }).collect();
        let screen:Vec<_>=points.iter().map(|p| {
            let v=[p[0]-eye[0],p[1]-eye[1],p[2]-eye[2]];let z=dot(v,forward);
            (geom::jround((size as f64*0.5+focal*dot(v,right)/z)*256.) as i64,
             geom::jround((size as f64*0.5-focal*dot(v,up)/z)*256.) as i64,z)
        }).collect();
        for tri in c.mesh.idx.chunks_exact(3) {
            let t=[screen[tri[0] as usize],screen[tri[1] as usize],screen[tri[2] as usize]];
            if t.iter().any(|p|p.2<=0.01) {continue;}
            let edge=|a:(i64,i64,f64),b:(i64,i64,f64),x:i64,y:i64| (x-a.0)*(b.1-a.1)-(y-a.1)*(b.0-a.0);
            let area=edge(t[0],t[1],t[2].0,t[2].1);if area==0 {continue;}
            let minx=(t.iter().map(|p|p.0).min().unwrap()/256).clamp(0,size as i64-1);
            let maxx=(t.iter().map(|p|p.0).max().unwrap()/256).clamp(0,size as i64-1);
            let miny=(t.iter().map(|p|p.1).min().unwrap()/256).clamp(0,size as i64-1);
            let maxy=(t.iter().map(|p|p.1).max().unwrap()/256).clamp(0,size as i64-1);
            for y in miny..=maxy {for x in minx..=maxx {
                let (px,py)=(x*256+128,y*256+128);
                let e=[edge(t[1],t[2],px,py),edge(t[2],t[0],px,py),edge(t[0],t[1],px,py)];
                if e.iter().any(|v|if area>0 {*v<0} else {*v>0}) {continue;}
                let weights=e.map(|v|v as f64/area as f64);
                let invz=weights[0]/t[0].2+weights[1]/t[1].2+weights[2]/t[2].2;
                let z=1./invz;
                let wy=z*(weights[0]*points[tri[0] as usize][1]/t[0].2+
                    weights[1]*points[tri[1] as usize][1]/t[1].2+weights[2]*points[tri[2] as usize][1]/t[2].2);
                if wy<0. {continue;}
                let q=y as usize*size+x as usize;
                if z<depth[q] {depth[q]=z;pixels[q]=if c.strength>0. {2} else {1};}
            }}
        }
    }
    let occupied=pixels.iter().filter(|p|**p>0).count() as u32;
    let emission=pixels.iter().filter(|p|**p==2).count() as u32;
    let mut outside=vec![false;size*size];let mut queue=std::collections::VecDeque::new();
    for q in 0..size*size {if (q<size || q>=size*(size-1) || q%size==0 || q%size==size-1) && pixels[q]==0 {
        outside[q]=true;queue.push_back(q);
    }}
    while let Some(q)=queue.pop_front() {
        let (x,y)=(q%size,q/size);
        for (nx,ny) in [(x as i32-1,y as i32),(x as i32+1,y as i32),(x as i32,y as i32-1),(x as i32,y as i32+1)] {
            if nx<0 || ny<0 || nx>=size as i32 || ny>=size as i32 {continue;}
            let j=ny as usize*size+nx as usize;
            if !outside[j] && pixels[j]==0 {outside[j]=true;queue.push_back(j);}
        }
    }
    let enclosed_void=(0..pixels.len()).filter(|q|pixels[*q]==0 && !outside[*q]).count() as u32;
    let width_profile=(0..32).map(|bin| {
        let mut width=0;
        for row in bin*size/32..(bin+1)*size/32 {
            let xs:Vec<_>=(0..size).filter(|x|pixels[row*size+x]>0).collect();
            if let (Some(lo),Some(hi))=(xs.first(),xs.last()) {width=width.max(hi-lo+1);}
        } width as u32
    }).collect();
    Ok(Mask {size,pixels,occupied,emission,enclosed_void,width_profile})
}
