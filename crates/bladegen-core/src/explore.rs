//! Opt-in planet-sword experiments. Legacy params, recipes and operation order remain untouched.
//! Coordinates follow `model`: +Y toward the tip. Geometry is Rust-only; preview tools consume buffers.
use crate::{
    geom::{self, Mesh},
    glow::hash_seed,
    model,
    params::Sword,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Resonance {
    pub count: u32,
    /// Node radius in base blade widths.
    pub radius: f64,
}
impl Default for Resonance {
    fn default() -> Self {
        Self {
            count: 5,
            radius: 0.055,
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Features {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resonance: Option<Resonance>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub read: Option<Read>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub emission: Option<Emission>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct Emission { pub star_k:f64, pub edge_strength:f64, pub channel_strength:f64 }
impl Default for Emission {
    fn default()->Self { Self {star_k:10000.,edge_strength:4.,channel_strength:2.} }
}

/// Authored linear-RGB knots; interpolate in specified table order, never blackbody platform maths.
pub fn star_color(k:f64)->[f64;3] {
    let knots=[(2500.,[1.,0.24,0.06]),(5500.,[1.,0.85,0.65]),(10000.,[0.38,0.65,1.]),(30000.,[0.25,0.42,1.])];
    let k=k.clamp(2500.,30000.);
    for i in 0..3 { if k<=knots[i+1].0 {
        let t=(k-knots[i].0)/(knots[i+1].0-knots[i].0);
        return std::array::from_fn(|j|knots[i].1[j]+(knots[i+1].1[j]-knots[i].1[j])*t);
    }} knots[3].1
}

/// Closed four-corner loft. Each ring is clockwise viewed down +Y, no zero-size tips.
pub fn loft(rings:&[[[f64;3];4]])->Mesh {
    let mut m=Mesh::default();
    for ring in rings { for p in ring { m.pos.extend(p.map(|v|v as f32)); } }
    m.idx.extend([0,1,2,0,2,3]);
    for i in 0..rings.len()-1 { for k in 0..4 {
        let a=(i*4+k) as u32; let b=(i*4+(k+1)%4) as u32;
        m.idx.extend([a,a+4,b,b,a+4,b+4]);
    }}
    let n=(rings.len()*4-4) as u32;
    m.idx.extend([n,n+2,n+1,n,n+3,n+2]);
    m.compute_vertex_normals(); m
}

fn luminous_ribbon(s:&Sword,mesh:&Mesh,offset:f64,width:f64)->anyhow::Result<Mesh> {
    let mut rings=vec![];
    for i in 0..=24 {
        let t=0.08+0.70*i as f64/24.; let y=t*s.blade.length;
        let w=crate::blade::tip_width_with_kissaki(&s.blade,t,s.blade.base_width,s.blade.tip_width);
        let cx=crate::blade::bend_offset_x(&s.blade,y,s.blade.length)+crate::blade::waviness_at(&s.blade,t).0;
        let x0=cx+(offset-width*0.5)*w; let x1=cx+(offset+width*0.5)*w;
        let p0=surface(mesh,x0,y).ok_or_else(||anyhow::anyhow!("ribbon outside surface"))?.0;
        let p1=surface(mesh,x1,y).ok_or_else(||anyhow::anyhow!("ribbon outside surface"))?.0;
        let z0=p0[2]+0.004*s.blade.base_width; let z1=p1[2]+0.004*s.blade.base_width;
        let d=0.006*s.blade.base_width;
        rings.push([[x0,y,z0],[x1,y,z1],[x1,y,z1+d],[x0,y,z0+d]]);
    }
    Ok(loft(&rings))
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Read { pub duration_ms: u32, pub emission_gain: f64 }
impl Default for Read {
    fn default() -> Self { Self { duration_ms:6500, emission_gain:2.5 } }
}

/// Event-relative polynomial envelope, always returns to rest; no accumulated frame deltas.
pub fn read_envelope(time_ms:u32, duration_ms:u32, phase:f64) -> f64 {
    let t = time_ms as f64 / duration_ms.max(1) as f64;
    let smooth = |v:f64| { let v=v.clamp(0.,1.); v*v*(3.-2.*v) };
    smooth((t-phase)/0.12) * (1.-smooth((t-0.78)/0.22))
}

/// Sample a rest assembly. Future mechanical components use these same local translation tracks.
pub fn sample_read(rest:&Assembly, read:&Read, time_ms:u32) -> anyhow::Result<Assembly> {
    anyhow::ensure!((2000..=15000).contains(&read.duration_ms),"read duration must be 2000..=15000 ms");
    valid(read.emission_gain,1.,4.,"read emission gain")?;
    let mut a=rest.clone();
    for c in &mut a.components {
        let y = geom::world_bbox(&c.mesh,&c.matrix).0[1];
        let phase=(0.50 - y*0.075).clamp(0.,0.65);
        let e=read_envelope(time_ms,read.duration_ms,phase);
        c.strength *= 1. + (read.emission_gain-1.)*e;
        for k in 0..3 { c.matrix[12+k] += c.travel[k]*e; }
    }
    Ok(a)
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Anchor {
    pub id: String,
    pub parent: String,
    pub position: [f64; 3],
    pub normal: [f64; 3],
    pub role: String,
    pub vocabulary: u32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Component {
    pub id: String,
    pub mesh: Mesh,
    pub matrix: geom::Mat4,
    pub role: String,
    pub color: [f64; 3],
    pub strength: f64,
    pub travel: [f64;3],
}

#[derive(Clone, Debug, PartialEq)]
pub struct Assembly {
    pub components: Vec<Component>,
    pub anchors: Vec<Anchor>,
}

fn valid(x: f64, lo: f64, hi: f64, name: &str) -> anyhow::Result<()> {
    anyhow::ensure!(
        x.is_finite() && x >= lo && x <= hi,
        "{name} must be finite in {lo}..={hi}"
    );
    Ok(())
}

/// Front-face ray intersection with the actual exported triangles; works independently of grid topology.
pub fn surface(mesh: &Mesh, x: f64, y: f64) -> Option<([f64; 3], [f64; 3])> {
    let mut hit: Option<([f64; 3], [f64; 3])> = None;
    for t in mesh.idx.chunks_exact(3) {
        let p = |i: u32| {
            let k = i as usize * 3;
            [
                mesh.pos[k] as f64,
                mesh.pos[k + 1] as f64,
                mesh.pos[k + 2] as f64,
            ]
        };
        let (a, b, c) = (p(t[0]), p(t[1]), p(t[2]));
        let d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        if d.abs() < 1e-15 {
            continue;
        }
        let u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d;
        let v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d;
        if u < -1e-8 || v < -1e-8 || u + v > 1.0 + 1e-8 {
            continue;
        }
        let z = u * a[2] + v * b[2] + (1.0 - u - v) * c[2];
        let ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        let ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        let (nx, ny, nz) = geom::normalize3(
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            d,
        );
        if hit.as_ref().is_none_or(|h| z > h.0[2]) {
            hit = Some(([x, y, z], [nx, ny, nz]));
        }
    }
    hit
}

/// Closed, outward octahedron. Shared indices permit exact topological edge tests.
pub fn node_mesh(p: [f64; 3], r: f64) -> Mesh {
    let mut m = Mesh::default();
    for d in [
        [r, 0., 0.],
        [-r, 0., 0.],
        [0., r, 0.],
        [0., -r, 0.],
        [0., 0., r],
        [0., 0., -r],
    ] {
        m.pos.extend((0..3).map(|k| (p[k] + d[k]) as f32));
    }
    m.idx = vec![
        0, 2, 4, 2, 1, 4, 1, 3, 4, 3, 0, 4, 2, 0, 5, 1, 2, 5, 3, 1, 5, 0, 3, 5,
    ];
    m.compute_vertex_normals();
    m
}

pub fn build(s: &Sword, seed: u32, f: &Features) -> anyhow::Result<Assembly> {
    valid(s.blade.length, 0.01, 1000., "blade length")?;
    valid(s.blade.base_width, 0.002, 100., "blade width")?;
    let mut counts = std::collections::BTreeMap::new();
    let components = model::build_model(s)?
        .into_iter()
        .map(|p| {
            let k = counts.entry(p.name).or_insert(0);
            let id = format!("{}#{k}", p.name);
            *k += 1;
            Component {
                id,
                mesh: p.mesh,
                matrix: p.matrix,
                role: "metal".into(),
                color: [0.14, 0.17, 0.21],
                strength: 0.,
                travel: [0.;3],
            }
        })
        .collect();
    let mut a = Assembly {
        components,
        anchors: vec![],
    };
    if let Some(r) = &f.resonance {
        anyhow::ensure!((3..=9).contains(&r.count), "resonance count must be 3..=9");
        valid(r.radius, 0.03, 0.08, "resonance radius")?;
        for i in 0..r.count {
            let t = 0.12 + 0.60 * i as f64 / (r.count - 1) as f64;
            let y = t * s.blade.length;
            let x = crate::blade::bend_offset_x(&s.blade, y, s.blade.length)
                + crate::blade::waviness_at(&s.blade, t).0;
            let (p, n) = surface(&a.components[0].mesh, x, y)
                .ok_or_else(|| anyhow::anyhow!("node outside blade"))?;
            let id = format!(
                "resonance/{:08x}/{i}",
                hash_seed(&format!("{seed}|resonance"))
            );
            a.anchors.push(Anchor {
                id: id.clone(),
                parent: "blade#0".into(),
                position: p,
                normal: n,
                role: ["source", "conduction", "containment"][i as usize % 3].into(),
                vocabulary: 1,
            });
            a.components.push(Component {
                id,
                mesh: node_mesh(p, r.radius * s.blade.base_width),
                matrix: geom::IDENTITY,
                role: "node".into(),
                color: [0.8, 0.95, 1.],
                strength: 7.,
                travel: [0.;3],
            });
        }
    }
    if let Some(e)=&f.emission {
        valid(e.star_k,2500.,30000.,"stellar temperature")?;
        valid(e.edge_strength,0.,12.,"edge strength")?; valid(e.channel_strength,0.,12.,"channel strength")?;
        for (i,(offset,width,role,color,strength)) in [(-0.43,0.025,"edge",star_color(e.star_k),e.edge_strength),
            (0.43,0.025,"edge",star_color(e.star_k),e.edge_strength),(0.,0.065,"channel",[0.10,0.85,0.5],e.channel_strength)].into_iter().enumerate() {
            let m=luminous_ribbon(s,&a.components[0].mesh,offset,width)?;
            // Separate front/back meshes keep semantic material roles and face culling intact.
            for face in [1.,-1.] {
                let mut mesh=m.clone();
                if face<0. { for p in mesh.pos.chunks_exact_mut(3) {p[2] = -p[2];} for t in mesh.idx.chunks_exact_mut(3) {t.swap(1,2);} mesh.compute_vertex_normals(); }
                a.components.push(Component {id:format!("emission/{i}/{face}"),mesh,matrix:geom::IDENTITY,
                    role:role.into(),color,strength,travel:[0.;3]});
            }
        }
    }
    Ok(a)
}

/// A deliberately broad, severe reference blank, with a 36 m blade in previews.
pub fn reference() -> Sword {
    use crate::params::*;
    Sword {
        blade: Blade {
            length: 6.,
            base_width: 1.,
            tip_width: 0.02,
            thickness: Some(0.16),
            tip_ramp_start: Some(0.8),
            cross_section: Some("diamond".into()),
            ..Blade::default()
        },
        guard: Guard {
            style: Some("forged".into()),
            width: 3.2,
            thickness: 0.3,
            forged: Some(crate::families::forged_defaults()),
            ..Guard::default()
        },
        handle: Handle {
            length: 1.4,
            radius_top: 0.18,
            radius_bottom: 0.18,
            ..Handle::default()
        },
        pommel: Pommel {
            style: Some("gem".into()),
            size: 0.42,
            elongation: 1.,
            ..Pommel::default()
        },
        ..Sword::default()
    }
}
