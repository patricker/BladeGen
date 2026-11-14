//! Offline trait-space exploration. Experimental features are never inserted into the live catalogue.
use super::*;
use crate::families::{self,PlanetTraits};

#[derive(Clone,Debug,PartialEq,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Candidate {
    pub seed:u32,
    pub traits:serde_json::Value,
    pub base:Sword,
    pub features:Features,
    pub reason:String,
}

/// Uses the existing catalogue recipes unchanged, then offers opt-in experimental candidates.
/// A lock preserves the complete resolved feature block, independent of subsequent trait changes.
pub fn candidates(base:&Sword,traits:&PlanetTraits,start:u32,count:u32,lock:Option<&Features>)->anyhow::Result<Vec<Candidate>> {
    anyhow::ensure!((1..=24).contains(&count),"explorer count must be 1..=24");
    let mut out=vec![];
    for i in 0..count {
        let seed=start.wrapping_add(i);
        let design=families::design_monument(base,traits,seed,families::catalogue(),None);
        let (features,reason)=if let Some(f)=lock {(f.clone(),"owner-locked resolved feature block".into())}
        else if traits.has_dynamo && traits.dipole_index>=0.5 {
            (Features {aperture:Some(Aperture {width:0.36+0.04*(hash_seed(&format!("{seed}|explorer"))%6) as f64,..Aperture::default()}),..Features::default()},"magnetic: wide containment aperture".into())
        } else if traits.volcanism_index>=0.5 {
            (Features {fracture:Some(Fracture {segments:3+hash_seed(&format!("{seed}|explorer"))%3,..Fracture::default()}),..Features::default()},"volcanic: faultbound masses".into())
        } else {(Features {ribs:Some(Ribs {pairs:2,..Ribs::default()}),..Features::default()},"neutral: structural containment ribs".into())};
        out.push(Candidate {seed,traits:traits.to_json(),base:design.params,features,reason});
    }Ok(out)
}
