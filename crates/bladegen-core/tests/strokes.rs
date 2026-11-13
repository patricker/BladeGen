//! The monument stroke kernel (`monument.rs`): closed tubes and rings wound outward, mirrors that stay outward, a
//! centre line that turns with `turn` and `bend`. Moved from bladegen's `monument.spec.ts` ("monument strokes") when
//! the TypeScript kernel was retired (BG1).
use bladegen_core::geom::Mesh;
use bladegen_core::monument::{
    merge_parts, mirror_part, ring_part, section_outline, stroke_part, Part, RingStroke, SizeLaw, Stroke, Tip,
};
use std::collections::HashMap;

fn base() -> Stroke {
    Stroke {
        x: 0.1,
        y: 0.0,
        z: 0.0,
        heading: 0.2,
        length: 1.0,
        turn: 0.0,
        bend: 0.8,
        hy: 0.08,
        hz: 0.06,
        size: SizeLaw::Taper { taper: 0.4, belly: false },
        tip: Tip::Point,
        knob: 0.0,
        segments: 12.0,
    }
}

/// Every directed edge once and its reverse once, with vertices welded at 1e-7 (the seam copy differs from its
/// twin in the last bits, as in three's primitives); degenerate seam slivers skipped.
fn closed_and_consistent(p: &Part) -> bool {
    let q = |x: f64| (x * 1e7).round() as i64;
    let key = |i: u32| {
        let i = i as usize * 3;
        (q(p.pos[i]), q(p.pos[i + 1]), q(p.pos[i + 2]))
    };
    let mut directed: HashMap<_, u32> = HashMap::new();
    for t in p.idx.chunks_exact(3) {
        let v = [key(t[0]), key(t[1]), key(t[2])];
        if v[0] == v[1] || v[1] == v[2] || v[0] == v[2] {
            continue;
        }
        for e in 0..3 {
            *directed.entry((v[e], v[(e + 1) % 3])).or_insert(0) += 1;
        }
    }
    directed.iter().all(|((a, b), n)| *n == 1 && directed.get(&(*b, *a)) == Some(&1))
}

fn signed_volume(m: &Mesh) -> f64 {
    let p = |i: u32| {
        let i = i as usize * 3;
        [m.pos[i] as f64, m.pos[i + 1] as f64, m.pos[i + 2] as f64]
    };
    let mut v = 0.0;
    for t in m.idx.chunks_exact(3) {
        let (a, b, c) = (p(t[0]), p(t[1]), p(t[2]));
        v += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0])
            + a[2] * (b[0] * c[1] - b[1] * c[0]);
    }
    v / 6.0
}

#[test]
fn every_stroke_tip_is_a_closed_tube_wound_outward() {
    let sec = section_outline(0.5, 16);
    for tip in [Tip::Flat, Tip::Point, Tip::Knob] {
        let p = stroke_part(&Stroke { tip, knob: 0.5, ..base() }, &sec);
        assert!(closed_and_consistent(&p), "{tip:?}");
        assert!(signed_volume(&merge_parts(&[p])) > 0.0, "{tip:?}");
    }
}

#[test]
fn a_ring_is_closed_and_outward_and_a_mirror_stays_outward() {
    let sec = section_outline(0.5, 16);
    let r = ring_part(&RingStroke { cx: 0.0, cy: 0.2, radius: 0.5, hy: 0.04, hz: 0.05, segments: 40.0 }, &sec);
    assert!(closed_and_consistent(&r));
    assert!(signed_volume(&merge_parts(&[r])) > 0.0);
    let m = mirror_part(&stroke_part(&base(), &sec));
    assert!(closed_and_consistent(&m));
    assert!(signed_volume(&merge_parts(&[m])) > 0.0);
}

#[test]
fn the_centre_line_turns_by_bend() {
    let sec = section_outline(0.5, 16);
    let up = stroke_part(&Stroke { heading: 0.0, bend: 1.2, ..base() }, &sec);
    let down = stroke_part(&Stroke { heading: 0.0, bend: -1.2, ..base() }, &sec);
    let n = up.pos.len() / 3 - 1;
    assert!(up.pos[3 * n + 1] > 0.2);
    assert!(down.pos[3 * n + 1] < -0.2);
}
