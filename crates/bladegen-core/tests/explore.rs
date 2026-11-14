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
            })
        }
    )
    .is_err());
}
