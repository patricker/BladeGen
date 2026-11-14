use bladegen_core::{
    explore::*,
    geom::{self, Mesh},
};
use std::collections::BTreeMap;

fn closed_outward(m: &Mesh) {
    let mut edges = BTreeMap::new();
    let mut volume = 0.;
    for t in m.idx.chunks_exact(3) {
        let p = |i: u32| {
            let k = i as usize * 3;
            [m.pos[k] as f64, m.pos[k + 1] as f64, m.pos[k + 2] as f64]
        };
        let (a, b, c) = (p(t[0]), p(t[1]), p(t[2]));
        for j in 0..3 {
            *edges.entry((t[j], t[(j + 1) % 3])).or_insert(0) += 1;
        }
        volume += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0])
            + a[2] * (b[0] * c[1] - b[1] * c[0]);
    }
    assert!(edges
        .iter()
        .all(|(&(a, b), &n)| n == 1 && edges.get(&(b, a)) == Some(&1)));
    assert!(volume > 0.);
    assert!(m.pos.iter().chain(&m.nrm).all(|x| x.is_finite()));
}

#[test]
fn off_is_byte_identical_to_existing_builder() {
    let s = reference();
    let a = build(&s, 42, &Features::default()).unwrap();
    let old = bladegen_core::model::build_model(&s).unwrap();
    for (a, b) in a.components.iter().zip(&old) {
        assert_eq!(a.mesh, b.mesh);
        assert_eq!(a.matrix, b.matrix);
    }
    assert_eq!(a.components.len(), old.len());
    assert!(a.anchors.is_empty());
}

#[test]
fn resonance_nodes_are_closed_attached_finite_and_repeatable() {
    for seed in [0, 42, u32::MAX] {
        for count in [3, 5, 9] {
            let f = Features {
                resonance: Some(Resonance {
                    count,
                    ..Resonance::default()
                }),
                ..Features::default()
            };
            let a = build(&reference(), seed, &f).unwrap();
            assert_eq!(a, build(&reference(), seed, &f).unwrap());
            assert_eq!(a.anchors.len(), count as usize);
            for n in &a.anchors {
                let c = a.components.iter().find(|c| c.id == n.id).unwrap();
                closed_outward(&c.mesh);
                let (hit, normal) =
                    surface(&a.components[0].mesh, n.position[0], n.position[1]).unwrap();
                assert_eq!(n.position, hit);
                assert_eq!(n.normal, normal);
                assert!(normal[2] > 0.);
                let (lo, hi) = geom::world_bbox(&c.mesh, &c.matrix);
                assert!(lo[2] < hit[2] && hi[2] > hit[2]);
                assert!(lo[1] > 0. && hi[1] < reference().blade.length * 0.88);
            }
        }
    }
    assert!(build(
        &reference(),
        0,
        &Features {
            resonance: Some(Resonance {
                count: 100,
                radius: 0.05
            }),
            ..Features::default()
        }
    )
    .is_err());
}

#[test]
fn read_is_event_relative_ordered_and_returns_to_rest() {
    let f=Features {resonance:Some(Resonance::default()),..Features::default()};
    let a=build(&reference(),42,&f).unwrap(); let r=Read::default();
    for t in [0,6500,u32::MAX] { assert_eq!(sample_read(&a,&r,t).unwrap(),a); }
    let frame=sample_read(&a,&r,4000).unwrap();
    for t in [1,2000,4000,6000,6500] {
        let b=sample_read(&a,&r,t).unwrap();
        assert_eq!(b,sample_read(&a,&r,t).unwrap());
        assert_eq!(b.components[0],a.components[0]);
        for (x,y) in b.components.iter().zip(&a.components) {
            assert!(x.strength>=y.strength && x.strength<=y.strength*r.emission_gain);
        }
    }
    assert_eq!(frame,sample_read(&a,&r,4000).unwrap());
    assert!(read_envelope(2200,6500,0.1)>read_envelope(2200,6500,0.5));
}

#[test]
fn emission_ribbons_are_closed_outward_and_clear_of_blade() {
    let f=Features {emission:Some(Emission::default()),..Features::default()};
    let a=build(&reference(),42,&f).unwrap(); assert_eq!(a,build(&reference(),42,&f).unwrap());
    for c in a.components.iter().filter(|c|c.role=="edge" || c.role=="channel") {
        closed_outward(&c.mesh);
        for p in c.mesh.pos.chunks_exact(3) {
            let z=surface(&a.components[0].mesh,p[0] as f64,p[1] as f64).unwrap().0[2];
            assert!(p[2].abs() as f64>z);
        }
    }
    assert_eq!(star_color(10000.),[0.38,0.65,1.]);
    assert_eq!(star_color(2500.),[1.,0.24,0.06]);
    assert!(star_color(8000.).iter().all(|x|*x>=0. && *x<=1.));
}

#[test]
fn scars_have_explicit_notches_closed_winding_and_ligaments() {
    for seed in 0..8 { for count in [1,3,6] {
        let s=reference(); let f=Features {scars:Some(Scars {count,..Scars::default()}),..Features::default()};
        let a=build(&s,seed,&f).unwrap(); assert_eq!(a,build(&s,seed,&f).unwrap());
        let m=&a.components[0].mesh; closed_outward(m);
        let (lo,hi)=geom::world_bbox(m,&geom::IDENTITY);
        assert_eq!(lo[1],0.); assert_eq!(hi[1],s.blade.length);
        for ring in m.pos.chunks_exact(12) {
            assert!(ring[3]-ring[0]>=0.019); // terminal section remains real, not a degenerate cap
        }
        let notched=m.pos.chunks_exact(12).filter(|r|r[1]>0. && r[1]<4.8 && (r[0]>-0.49 || r[3]<0.49)).count();
        assert_eq!(notched,count as usize);
    }}
}

#[test]
fn staves_have_open_shaft_closed_members_and_fixed_attachments() {
    for count in 3..=6 {
        let s=reference();let f=Features {staves:Some(Staves {count,..Staves::default()}),..Features::default()};
        let a=build(&s,42,&f).unwrap();assert_eq!(a,build(&s,42,&f).unwrap());
        assert!(!a.components.iter().any(|c|c.id.starts_with("handle#")));
        for c in a.components.iter().filter(|c|c.id.starts_with("stave/")) {
            closed_outward(&c.mesh);
            let (lo,hi)=geom::world_bbox(&c.mesh,&c.matrix);
            assert!(lo[1]>=-s.handle.length-1e-6 && hi[1]<=1e-6);
            if c.id.matches('/').count()==1 && c.id!="stave/core" {
                assert!((lo[1]+s.handle.length).abs()<1e-6 && hi[1].abs()<1e-6);
                for p in c.mesh.pos.chunks_exact(3) {assert!(p[0]*p[0]+p[2]*p[2]>0.035);}
            }
        }
    }
}

#[test]
fn grammar_rejects_crowding_budget_and_routes_through_voids() {
    let mut f=Features {scars:Some(Scars::default()),staves:Some(Staves::default()),grammar:Some(Grammar::default()),..Features::default()};
    assert!(check_grammar(&f).is_ok());
    assert_eq!(build(&reference(),42,&f).unwrap(),build(&reference(),42,&f).unwrap());
    f.grammar.as_mut().unwrap().major_motif_budget=1;assert!(check_grammar(&f).unwrap_err().to_string().contains("budget"));
    f.grammar.as_mut().unwrap().major_motif_budget=2;
    f.staves.as_mut().unwrap().radius=0.2;assert!(check_grammar(&f).unwrap_err().to_string().contains("clearance"));
    f.staves=None;f.emission=Some(Emission::default());assert!(check_grammar(&f).unwrap_err().to_string().contains("voids"));
}

#[test]
fn silhouette_metrics_are_deterministic_and_measure_real_voids() {
    use bladegen_core::explore::raster::{render,View};
    let a=build(&reference(),42,&Features::default()).unwrap();
    let b=build(&reference(),42,&Features {staves:Some(Staves::default()),..Features::default()}).unwrap();
    for view in [View::Mast,View::Drone] {
        let m=render(&a,6.,36.,0.12,view,128).unwrap();
        assert_eq!(m,render(&a,6.,36.,0.12,view,128).unwrap());
        assert!(m.occupied>500 && m.occupied<4000);assert_eq!(m.emission,0);
        assert!(m.width_profile.iter().max().unwrap()>&20);
        let n=render(&b,6.,36.,0.12,view,128).unwrap();
        assert!(n.emission>0);assert!(n.enclosed_void>m.enclosed_void);
        assert_eq!(n.occupied as usize,n.pixels.iter().filter(|p|**p>0).count());
    }
}

#[test]
fn gate_jaws_are_closed_and_move_outward_without_crossing() {
    let s=reference(); let f=Features {gate:Some(Gate::default()),..Features::default()};
    let a=build(&s,42,&f).unwrap();assert_eq!(a,build(&s,42,&f).unwrap());
    for c in a.components.iter().filter(|c|c.id.starts_with("gate/")) {closed_outward(&c.mesh);}
    for t in (0..=6500).step_by(100) {
        let b=sample_read(&a,&Read::default(),t).unwrap();
        for (before,after) in a.components.iter().zip(&b.components).filter(|(c,_)|c.id.starts_with("gate/jaw")) {
            let (lo,hi)=geom::world_bbox(&after.mesh,&after.matrix);
            assert!(lo[0]>0. || hi[0]<0.);
            assert!((after.matrix[12]-before.matrix[12])*before.travel[0]>=0.);
        }
        assert_eq!(a.components[0],b.components[0]);
    }
}

#[test]
fn faultbound_fragments_are_closed_capped_and_never_collide_during_read() {
    for segments in [2,4,7] {for seed in [0,42,99] {
        let f=Features {fracture:Some(Fracture {segments,..Fracture::default()}),..Features::default()};
        let a=build(&reference(),seed,&f).unwrap();assert_eq!(a,build(&reference(),seed,&f).unwrap());
        let fragments:Vec<_>=a.components.iter().filter(|c|c.id.starts_with("fragment/")).collect();
        assert_eq!(fragments.len(),segments as usize);
        for c in &fragments {closed_outward(&c.mesh);}
        assert_eq!(fragments.first().unwrap().travel,[0.;3]);assert_eq!(fragments.last().unwrap().travel,[0.;3]);
        for t in [0,1500,3000,4500,6000,6500] {
            let b=sample_read(&a,&Read::default(),t).unwrap();
            let fr:Vec<_>=b.components.iter().filter(|c|c.id.starts_with("fragment/")).collect();
            for pair in fr.windows(2) {
                let hi=geom::world_bbox(&pair[0].mesh,&pair[0].matrix).1;
                let lo=geom::world_bbox(&pair[1].mesh,&pair[1].matrix).0;
                assert!(lo[1]-hi[1]>0.12,"fracture gap survives entire motion");
            }
        }
    }}
}

#[test]
fn window_keel_is_one_closed_solid_with_a_real_through_aperture() {
    use bladegen_core::explore::raster::{render,View};
    for width in [0.2,0.48,0.6] {
        let f=Features {aperture:Some(Aperture {width,..Aperture::default()}),..Features::default()};
        let a=build(&reference(),42,&f).unwrap();assert_eq!(a,build(&reference(),42,&f).unwrap());
        for c in a.components.iter().filter(|c|c.id.starts_with("window/")) {closed_outward(&c.mesh);}
        let keel=a.components.iter().find(|c|c.id=="window/keel").unwrap();
        assert!(surface(&keel.mesh,0.,2.4).is_none());
        assert!(surface(&keel.mesh,0.45,2.4).is_some());
        let (lo,hi)=geom::world_bbox(&keel.mesh,&keel.matrix);
        assert_eq!(lo[1],0.);assert_eq!(hi[1],6.);
        for view in [View::Mast,View::Drone] {assert!(render(&a,6.,36.,0.12,view,128).unwrap().enclosed_void>20);}
    }
}

#[test]
fn cleft_has_two_guard_roots_and_a_solid_shared_planted_keel() {
    for separation in [0.3,0.6,0.9] {for bias in [-0.1,0.05,0.1] {
        let f=Features {cleft:Some(Cleft {separation,bias,..Cleft::default()}),..Features::default()};
        let a=build(&reference(),42,&f).unwrap();assert_eq!(a,build(&reference(),42,&f).unwrap());
        let c=a.components.iter().find(|c|c.id=="cleft/keel").unwrap();closed_outward(&c.mesh);
        assert!(surface(&c.mesh,0.,0.01).is_none());assert!(surface(&c.mesh,0.,5.1).is_some());
        assert!(surface(&c.mesh,separation*0.5+0.1,0.01).is_some());
        assert!(surface(&c.mesh,-separation*0.5-0.1,0.01).is_some());
    }}
}

#[test]
fn ribs_have_closed_members_and_two_blade_attachment_roots() {
    for pairs in [2,3,4] {
        let f=Features {ribs:Some(Ribs {pairs,..Ribs::default()}),..Features::default()};
        let a=build(&reference(),42,&f).unwrap();assert_eq!(a,build(&reference(),42,&f).unwrap());
        let ribs:Vec<_>=a.components.iter().filter(|c|c.id.starts_with("rib/")).collect();assert_eq!(ribs.len(),pairs as usize*2);
        for c in ribs {closed_outward(&c.mesh);let (lo,hi)=geom::world_bbox(&c.mesh,&c.matrix);
            assert!(lo[1]>0. && hi[1]<4.6);assert!(lo[0]< -1. || hi[0]>1.);
            let root=c.mesh.pos.chunks_exact(3).filter(|p|p[0].abs()<0.4).count();assert!(root>=8);
        }
    }
}

#[test]
fn crystals_are_closed_facets_with_embedded_roots_and_large_projection() {
    for count in [1,4,6] {for seed in [0,42,777] {
        let f=Features {crystals:Some(Crystals {count,..Crystals::default()}),..Features::default()};
        let a=build(&reference(),seed,&f).unwrap();assert_eq!(a,build(&reference(),seed,&f).unwrap());
        let crystals:Vec<_>=a.components.iter().filter(|c|c.id.starts_with("crystal/")).collect();assert_eq!(crystals.len(),count as usize);
        for c in crystals {closed_outward(&c.mesh);let root=geom::apply_point(&c.matrix,[0.;3]);
            assert!(root[0].abs()<0.5);assert!(surface(&a.components[0].mesh,root[0],root[1]).is_some());
            let (lo,hi)=geom::world_bbox(&c.mesh,&c.matrix);assert!(lo[0]< -0.8 || hi[0]>0.8);
        }
    }}
}

#[test]
fn captive_kernel_has_real_open_seam_and_bounded_core_lift() {
    let f=Features {kernel:Some(Kernel::default()),..Features::default()};let a=build(&reference(),42,&f).unwrap();
    assert_eq!(a,build(&reference(),42,&f).unwrap());
    for c in a.components.iter().filter(|c|c.id.starts_with("kernel/")) {closed_outward(&c.mesh);}
    let core=a.components.iter().find(|c|c.id=="kernel/core").unwrap();
    for t in (0..=6500).step_by(100) {
        let b=sample_read(&a,&Read::default(),t).unwrap();let c=b.components.iter().find(|c|c.id==core.id).unwrap();
        let (lo,hi)=geom::world_bbox(&c.mesh,&c.matrix);assert!(lo[0]>-0.21 && hi[0]<0.21);
        assert!(lo[1]> -2.3 && hi[1]< -1.7); // stays inside declared central free corridor
    }
    let cage=a.components.iter().find(|c|c.id=="kernel/cage/1").unwrap();assert!(surface(&cage.mesh,0.,-1.95).is_none());
}

#[test]
fn tension_links_are_closed_repeatable_and_have_named_endpoints() {
    let f=Features {chains:Some(Chains::default()),..Features::default()};let a=build(&reference(),42,&f).unwrap();
    assert_eq!(a,build(&reference(),42,&f).unwrap());assert_eq!(a.anchors.len(),4);
    let links:Vec<_>=a.components.iter().filter(|c|c.id.starts_with("chain/")).collect();assert_eq!(links.len(),12);
    for c in links {closed_outward(&c.mesh);let (lo,hi)=geom::world_bbox(&c.mesh,&c.matrix);assert!(lo[1]> -0.2 && hi[1]<2.9);}
    assert!(a.anchors.iter().all(|n|n.parent=="guard#0" || n.parent=="blade#0"));
}

#[test]
fn sutures_bridge_actual_scar_records_and_attach_outside_notches() {
    let f=Features {scars:Some(Scars::default()),sutures:Some(Sutures::default()),..Features::default()};
    let a=build(&reference(),42,&f).unwrap();assert_eq!(a,build(&reference(),42,&f).unwrap());
    for c in a.components.iter().filter(|c|c.id.starts_with("suture/")) {
        let mut m=c.mesh.clone();weld(&mut m);closed_outward(&m);
    }
    assert_eq!(a.anchors.len(),6);
    for n in &a.anchors {let hit=surface(&a.components[0].mesh,n.position[0],n.position[1]).unwrap().0;
        assert!((hit[2]-n.position[2]).abs()<1e-6);
    }
}

#[test]
fn strata_are_capped_material_regions_with_matching_shared_boundaries() {
    for layers in [2,4,6] {
        let f=Features {strata:Some(Strata {layers,..Strata::default()}),..Features::default()};
        let a=build(&reference(),42,&f).unwrap();assert_eq!(a,build(&reference(),42,&f).unwrap());
        let parts:Vec<_>=a.components.iter().filter(|c|c.id.starts_with("strata/")).collect();assert_eq!(parts.len(),layers as usize);
        for c in &parts {closed_outward(&c.mesh);}
        for pair in parts.windows(2) {
            let shared=pair[0].mesh.pos.chunks_exact(3).filter(|p|pair[1].mesh.pos.chunks_exact(3).any(|q|p==&q)).count();assert_eq!(shared,4);
        }
    }
}

#[test]
fn basalt_is_closed_ground_anchored_and_stays_near_burial_zone() {
    let f=Features {encroachment:Some(Encroachment::default()),..Features::default()};
    let a=build(&reference(),42,&f).unwrap();assert_eq!(a,build(&reference(),42,&f).unwrap());
    for c in a.components.iter().filter(|c|c.id.starts_with("basalt/")) {
        closed_outward(&c.mesh);let (lo,hi)=geom::world_bbox(&c.mesh,&c.matrix);
        assert!(lo[1]<5.28 && hi[1]>5.28);assert!(lo[1]>4.6);assert!(hi[2]>0.08 && lo[2]< -0.08);
    }
}

#[test]
fn terminator_bias_coordinates_all_parts_without_changing_indices_or_y() {
    let s=reference();let rest=build(&s,42,&Features::default()).unwrap();
    for bias in [-0.7,0.5,0.7] {
        let f=Features {terminator:Some(Terminator {bias}),..Features::default()};
        let a=build(&s,42,&f).unwrap();assert_eq!(a,build(&s,42,&f).unwrap());
        for (c,b) in a.components.iter().zip(&rest.components) {
            assert_eq!(c.mesh.idx,b.mesh.idx);assert!(c.mesh.pos.iter().chain(&c.mesh.nrm).all(|v|v.is_finite()));
            let bb=geom::world_bbox(&b.mesh,&b.matrix);let cb=geom::world_bbox(&c.mesh,&c.matrix);
            assert!((bb.0[1]-cb.0[1]).abs()<1e-6 && (bb.1[1]-cb.1[1]).abs()<1e-6);
            assert!(cb.1[0]>0. && cb.0[0]<0.);
        }
    }
}

#[test]
fn furnace_routes_are_connected_closed_and_clear_of_surface() {
    let f=Features {circuit:Some(Circuit::default()),..Features::default()};let a=build(&reference(),42,&f).unwrap();
    assert_eq!(a,build(&reference(),42,&f).unwrap());
    let paths:Vec<_>=a.components.iter().filter(|c|c.id.starts_with("circuit/path/")).collect();assert_eq!(paths.len(),7);
    for c in a.components.iter().filter(|c|c.id.starts_with("circuit/")) {
        closed_outward(&c.mesh);
        for p in c.mesh.pos.chunks_exact(3) {assert!(p[2] as f64>surface(&a.components[0].mesh,p[0] as f64,p[1] as f64).unwrap().0[2]);}
    }
    // Every branch has a centreline endpoint on the continuous axial conduit.
    for c in paths.iter().skip(1) {assert!(c.mesh.pos.chunks_exact(3).take(4).any(|p|p[0].abs()<0.03));}
}

#[test]
fn electrodes_share_circle_socket_positions_and_preserve_front_approach() {
    for count in [2,3,6] {
        let f=Features {electrodes:Some(Electrodes {count,..Electrodes::default()}),..Features::default()};
        let a=build(&reference(),42,&f).unwrap();assert_eq!(a,build(&reference(),42,&f).unwrap());assert_eq!(a.anchors.len(),count as usize);
        for n in &a.anchors {assert!((n.position[1]-5.28).abs()<1e-10);assert!(n.position[2]<=1e-10);
            let c=a.components.iter().find(|c|c.id==n.parent).unwrap();closed_outward(&c.mesh);
            let endpoint=geom::apply_point(&c.matrix,[1.4,5.28,0.]);assert_eq!(endpoint,n.position);
        }
    }
}

#[test]
fn dedup_detects_identical_silhouettes_and_breaks_ties_by_id() {
    use bladegen_core::explore::audit::*;
    let a=build(&reference(),42,&Features::default()).unwrap();
    let b=build(&reference(),42,&Features {aperture:Some(Aperture::default()),..Features::default()}).unwrap();
    let scenes=vec![("z".into(),a.clone()),("b".into(),a.clone()),("a".into(),a),("window".into(),b)];
    let n=nearest(&scenes,6.).unwrap();assert_eq!(n,nearest(&scenes,6.).unwrap());
    let z=n.iter().find(|n|n.id=="z").unwrap();assert_eq!(z.neighbor,"a");assert_eq!(z.silhouette_iou_milli,1000);
    let w=n.iter().find(|n|n.id=="window").unwrap();assert!(w.silhouette_iou_milli<920);
    let mut reversed=scenes.clone();reversed.reverse();assert_eq!(n,nearest(&reversed,6.).unwrap());
}

#[test]
fn explorer_traits_change_features_and_locks_preserve_resolved_choices() {
    use bladegen_core::{families::PlanetTraits,explore::authoring::candidates};
    let magnetic=PlanetTraits::from_json(&serde_json::json!({"hasDynamo":true,"dipoleIndex":0.9}));
    let volcanic=PlanetTraits::from_json(&serde_json::json!({"volcanismIndex":0.9}));
    let a=candidates(&reference(),&magnetic,42,3,None).unwrap();
    assert_eq!(a,candidates(&reference(),&magnetic,42,3,None).unwrap());
    assert!(a.iter().all(|c|c.features.aperture.is_some()));
    let b=candidates(&reference(),&volcanic,42,3,None).unwrap();assert!(b.iter().all(|c|c.features.fracture.is_some()));
    let locked=candidates(&reference(),&volcanic,42,3,Some(&a[0].features)).unwrap();
    assert!(locked.iter().all(|c|c.features==a[0].features));
    for c in a.iter().chain(&b).chain(&locked) {let scene=build(&c.base,c.seed,&c.features).unwrap();assert!(scene.components.iter().all(|c|c.mesh.pos.iter().all(|v|v.is_finite())));}
}

#[test]
fn lods_keep_aperture_identity_while_reducing_continuous_hilt_meshes() {
    use bladegen_core::explore::{authoring::lods,raster::{render,View},audit::compare};
    let f=Features {aperture:Some(Aperture::default()),..Features::default()};let s=reference();
    let ls=lods(&s,42,&f).unwrap();assert_eq!(ls,lods(&s,42,&f).unwrap());assert_eq!(ls[0],build(&s,42,&f).unwrap());
    let count=|a:&Assembly|a.components.iter().map(|c|c.mesh.vertex_count()).sum::<usize>();
    assert!(count(&ls[0])>count(&ls[1]) && count(&ls[1])>count(&ls[2]));
    for low in &ls[1..] {
        assert_eq!(low.components.iter().map(|c|&c.id).collect::<Vec<_>>(),ls[0].components.iter().map(|c|&c.id).collect::<Vec<_>>());
        for c in low.components.iter().filter(|c|c.id.starts_with("window/")) {
            assert_eq!(c,ls[0].components.iter().find(|p|p.id==c.id).unwrap());closed_outward(&c.mesh);
        }
        let a=render(&ls[0],6.,36.,0.12,View::Mast,128).unwrap();let b=render(low,6.,36.,0.12,View::Mast,128).unwrap();
        assert!(compare(&a,&b).unwrap().iou_milli>=980);
    }
}

#[test]
fn recipe_contract_roundtrips_and_rejects_version_digest_and_sink_drift() {
    use bladegen_core::explore::contract::*;
    let f=Features {aperture:Some(Aperture::default()),..Features::default()};
    let m=record(&reference(),42,&f,36.,0.12).unwrap();
    let json=serde_json::to_vec(&m).unwrap();let parsed:Manifest=serde_json::from_slice(&json).unwrap();assert_eq!(m,parsed);
    assert_eq!(replay(&parsed).unwrap(),build(&reference(),42,&f).unwrap());
    let mut bad=m.clone();bad.recipe_version=2;assert!(replay(&bad).is_err());
    let mut bad=m.clone();bad.components[0].digest="0".repeat(16);assert!(replay(&bad).is_err());
    let mut bad=m.clone();bad.catalogue_fnv1a64="0".repeat(16);assert!(replay(&bad).is_err());
    let mut bad=m;bad.implementation_fnv1a64="0".repeat(16);assert!(replay(&bad).is_err());
    assert!(record(&reference(),42,&Features {electrodes:Some(Electrodes::default()),..Features::default()},36.,0.2).is_err());
}

fn weld(m:&mut Mesh) {
    let mut ids=BTreeMap::new();let mut remap=vec![];let mut pos=vec![];
    for p in m.pos.chunks_exact(3) {
        let key=(p[0].to_bits(),p[1].to_bits(),p[2].to_bits());
        let index=*ids.entry(key).or_insert_with(||{let k=pos.len() as u32/3;pos.extend_from_slice(p);k});remap.push(index);
    }
    for i in &mut m.idx {*i=remap[*i as usize];}m.pos=pos;m.compute_vertex_normals();
}
