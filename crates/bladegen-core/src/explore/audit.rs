//! Deterministic multi-view comparisons. This never changes runtime seed selection.
use super::{Assembly,raster::{self,Mask,View}};
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all="camelCase")]
pub struct Similarity {pub iou_milli:u32,pub emission_iou_milli:u32,pub profile_delta:u32}

pub fn compare(a:&Mask,b:&Mask)->anyhow::Result<Similarity> {
    anyhow::ensure!(a.size==b.size && a.pixels.len()==b.pixels.len(),"mask dimensions differ");
    let mut inter=0;let mut union=0;let mut ei=0;let mut eu=0;
    for (&x,&y) in a.pixels.iter().zip(&b.pixels) {
        inter+=u32::from(x>0 && y>0);union+=u32::from(x>0 || y>0);
        ei+=u32::from(x==2 && y==2);eu+=u32::from(x==2 || y==2);
    }
    let iou=|i:u32,u:u32|if u==0 {1000} else {i*1000/u};
    let profile_delta=a.width_profile.iter().zip(&b.width_profile).map(|(x,y)|x.abs_diff(*y)).sum();
    Ok(Similarity {iou_milli:iou(inter,union),emission_iou_milli:iou(ei,eu),profile_delta})
}

#[derive(Clone,Debug,PartialEq,Eq,Serialize)]
#[serde(rename_all="camelCase")]
pub struct Neighbor {pub id:String,pub neighbor:String,pub silhouette_iou_milli:u32,pub near_duplicate:bool}

/// Pair scores average mast/drone IoU; tie order is the canonical input ID, not visit history.
pub fn nearest(scenes:&[(String,Assembly)],length:f64)->anyhow::Result<Vec<Neighbor>> {
    let masks:Vec<_>=scenes.iter().map(|(_,a)|Ok((raster::render(a,length,36.,0.12,View::Mast,128)?,
        raster::render(a,length,36.,0.12,View::Drone,128)?))).collect::<anyhow::Result<_>>()?;
    let mut out=vec![];
    for i in 0..scenes.len() {
        let mut candidates=vec![];
        for j in 0..scenes.len() {if i!=j {
            let score=(compare(&masks[i].0,&masks[j].0)?.iou_milli+compare(&masks[i].1,&masks[j].1)?.iou_milli)/2;
            candidates.push((score,scenes[j].0.clone()));
        }}
        candidates.sort_by(|a,b|b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
        if let Some((score,id))=candidates.first() {out.push(Neighbor {id:scenes[i].0.clone(),neighbor:id.clone(),silhouette_iou_milli:*score,near_duplicate:*score>=920});}
    }out.sort_by(|a,b|a.id.cmp(&b.id));Ok(out)
}
