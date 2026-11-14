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
