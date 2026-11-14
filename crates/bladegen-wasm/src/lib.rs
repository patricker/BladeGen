//! bladegen-core for the web app (BG1): a wasm32 module with a small C ABI, loaded by
//! `src/three/sword/core/wasm.ts`. No wasm-bindgen: the module exports four functions and the TypeScript loader
//! does the marshalling.
//!
//! - `bg_alloc(len) -> ptr`, `bg_free(ptr, len)`: a byte buffer in the module's memory (the loader writes the op name
//!   and the input JSON there).
//! - `bg_call(op_ptr, op_len, in_ptr, in_len) -> ptr`: runs [`call`]; the result stays valid until the next call.
//! - `bg_result_len() -> len`: the result's length.
//!
//! The result is `[u32 LE json_len][json][zero pad to 4][binary]`. The JSON is `{"ok": true, "value": ..., "meshes":
//! [...]}` or `{"ok": false, "error": "..."}`; each mesh names its attributes like bladegen's mesh dump
//! (`{"position": {"itemSize": 3, "byteOffset": o, "byteLength": n}, ...}`, offsets into the binary part; f32 LE) and
//! its `index` (u32 LE). Numbers in the input JSON are parsed correctly rounded (serde_json `float_roundtrip`), so
//! JavaScript's `JSON.stringify` of a parameter reaches the geometry as the same f64.
use bladegen_core::families::{self, Catalogue, Force, PlanetTraits};
use bladegen_core::geom::Mesh;
use bladegen_core::params::{Blade, Guard, Pommel, Sword};
use bladegen_core::{blade, fault, glow, hilt, keel, model, monument, shear};
use serde_json::{json, Map, Value};

/// One call: `op` names the function, `input` is its JSON argument. Returns the result buffer (see the crate docs).
pub fn call(op: &str, input: &[u8]) -> Vec<u8> {
    let mut meshes = Vec::new();
    let mut bin = Vec::new();
    let head = match run(op, input, &mut meshes) {
        Ok(value) => {
            let ms: Vec<Value> = meshes.iter().map(|(m, extra)| encode(m, extra.clone(), &mut bin)).collect();
            json!({"ok": true, "value": value, "meshes": ms})
        }
        Err(e) => json!({"ok": false, "error": e}),
    };
    let text = serde_json::to_vec(&head).unwrap();
    let mut out = Vec::with_capacity(8 + text.len() + bin.len());
    out.extend_from_slice(&(text.len() as u32).to_le_bytes());
    out.extend_from_slice(&text);
    while out.len() % 4 != 0 {
        out.push(0);
    }
    out.extend_from_slice(&bin);
    out
}

type Meshes = Vec<(Mesh, Value)>;

fn parse<T: serde::de::DeserializeOwned>(v: &Value, what: &str) -> Result<T, String> {
    serde_json::from_value(v.clone()).map_err(|e| format!("{what}: {e}"))
}

fn field<'a>(v: &'a Value, k: &str) -> Result<&'a Value, String> {
    v.get(k).ok_or_else(|| format!("missing `{k}`"))
}

fn run(op: &str, input: &[u8], meshes: &mut Meshes) -> Result<Value, String> {
    let v: Value = if input.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(input).map_err(|e| format!("input: {e}"))?
    };
    match op {
        // buildBladeGeometry(b): position, normal, tangent, index; uv + color when the glow is on
        "blade" => {
            let b: Blade = parse(&v, "blade")?;
            meshes.push((blade::build_blade(&b), Value::Null));
            Ok(Value::Null)
        }
        // the blade after SW1's export preparation (grid UVs, winding fix, normals, tangents; SW12's window-keel and
        // faultbound blades are built ready for export)
        "blade_export" => {
            let b: Blade = parse(&v, "blade")?;
            let mut m = blade::build_blade(&b);
            blade::prepare_export_blade(&b, &mut m);
            meshes.push((m, Value::Null));
            Ok(Value::Null)
        }
        // buildBladeGlowGeometry(b, geo): the glow mesh, or none
        "glow" => {
            let b: Blade = parse(&v, "blade")?;
            let m = blade::build_blade(&b);
            match glow::build_glow(&b, &m.pos) {
                Some(g) => {
                    meshes.push((g, Value::Null));
                    Ok(json!(true))
                }
                None => Ok(json!(false)),
            }
        }
        // buildForgedGuardGeometry(g, blade) / buildMonumentGuardGeometry(g, blade): {geometry, halfHeight}
        "guard_forged" | "guard_monument" => {
            let g: Guard = parse(field(&v, "guard")?, "guard")?;
            let b: Blade = parse(field(&v, "blade")?, "blade")?;
            let (m, half) = if op == "guard_forged" {
                hilt::forged_guard_geometry(&g, &b)
            } else {
                monument::monument_guard_geometry(&g, &b)
            };
            meshes.push((m, Value::Null));
            Ok(json!({ "halfHeight": half }))
        }
        // SW12 shear-gate: {halfHeight, throat}; meshes[0] the metal, meshes[1] the throat's glow when it has one
        "guard_shear" => {
            let g: Guard = parse(field(&v, "guard")?, "guard")?;
            let b: Blade = parse(field(&v, "blade")?, "blade")?;
            let (m, t, half) = shear::geometry(&g, &b);
            meshes.push((m, Value::Null));
            let throat = t.is_some();
            if let Some(t) = t {
                meshes.push((t, Value::Null));
            }
            Ok(json!({ "halfHeight": half, "throat": throat }))
        }
        // SW12: the defaults validation writes back for blade.aperture, blade.fracture and guard.shear
        "sw12_defaults" => Ok(json!({
            "aperture": keel::defaults(),
            "fracture": fault::defaults(),
            "shear": shear::defaults(),
        })),
        // buildMonumentPommelGeometry(p, se)
        "pommel_monument" => {
            let p: Pommel = parse(field(&v, "pommel")?, "pommel")?;
            let se = field(&v, "se")?.as_f64().ok_or("se: not a number")?;
            meshes.push((monument::build_pommel_monument_geometry(&p, se), Value::Null));
            Ok(Value::Null)
        }
        // the whole sword, as the kit and the headless dump build it: parts in bladegen order with their matrices
        "build_parts" => {
            let s: Sword = parse(field(&v, "sword")?, "sword")?;
            let export = v.get("export").and_then(Value::as_bool).unwrap_or(true);
            let (parts, skipped) = model::build_parts(&s, export);
            for p in parts {
                meshes.push((p.mesh, json!({"part": p.name, "matrix": p.matrix.to_vec()})));
            }
            Ok(json!({ "skipped": skipped }))
        }
        // model::digests: the exported model's fingerprint (core.spec.ts checks the module against the goldens)
        "digests" => {
            let s: Sword = parse(field(&v, "sword")?, "sword")?;
            Ok(Value::Array(model::digests(&s).into_iter().map(|(n, c, d)| json!([n, c, d])).collect()))
        }
        "monument_transform" => {
            let b: Blade = parse(field(&v, "blade")?, "blade")?;
            let h = field(&v, "heightM")?.as_f64().ok_or("heightM: not a number")?;
            let sink = field(&v, "sink")?.as_f64().ok_or("sink: not a number")?;
            let (scale, t) = model::monument(&b, h, sink);
            Ok(json!({"scale": scale, "translation": t.to_vec()}))
        }
        // monument/design.ts
        "monument_seed" => {
            let s = field(&v, "systemSeed")?.as_str().ok_or("systemSeed: not a string")?;
            let p = field(&v, "planetId")?.as_str().ok_or("planetId: not a string")?;
            Ok(json!(glow::hash_seed(&format!("sword-family|{s}|{p}"))))
        }
        "trait_strengths" => {
            let cat = catalogue_of(&v)?;
            let t = PlanetTraits::from_json(field(&v, "traits")?);
            Ok(pairs_obj(&families::trait_strengths(&t, &cat)))
        }
        // entryWeights(entries, strengths, picked): `entries` is a stage list (a catalogue's `blades`, ...)
        "entry_weights" => {
            let list: Vec<families::Entry> = parse(field(&v, "entries")?, "entries")?;
            let strengths: Vec<(String, f64)> = field(&v, "strengths")?
                .as_object()
                .ok_or("strengths: not an object")?
                .iter()
                .map(|(k, x)| (k.clone(), x.as_f64().unwrap_or(0.0)))
                .collect();
            let picked: Vec<String> = parse(field(&v, "picked")?, "picked")?;
            let picked: Vec<&str> = picked.iter().map(String::as_str).collect();
            let ws = families::entry_weights(&list, &strengths, &picked);
            Ok(Value::Array(ws.into_iter().map(|(id, w)| json!([id, w])).collect()))
        }
        "pick_monument" => {
            let cat = catalogue_of(&v)?;
            let t = PlanetTraits::from_json(field(&v, "traits")?);
            let seed = seed_of(field(&v, "seed")?)?;
            let (p, st) = families::pick_monument(&t, seed, &cat);
            Ok(json!({"picks": picks_json(&p), "strengths": pairs_obj(&st)}))
        }
        // designMonument(base, traits, seed, cat, force): `params` is returned as a patch on the base (the fields the
        // recipes set or remove), so every field the core does not model stays the caller's own, untouched
        "design_monument" => {
            let cat = catalogue_of(&v)?;
            let base_v = field(&v, "base")?;
            let base: Sword = parse(base_v, "base")?;
            let t = PlanetTraits::from_json(field(&v, "traits")?);
            let seed = seed_of(field(&v, "seed")?)?;
            let force = v.get("force").filter(|f| f.is_object()).map(|f| {
                let g = |k: &str| f.get(k).and_then(Value::as_str).map(String::from);
                Force { blade: g("blade"), guard: g("guard"), pommel: g("pommel"), grip: g("grip") }
            });
            let d = families::design_monument(&base, &t, seed, &cat, force.as_ref());
            let before = serde_json::to_value(&base).unwrap();
            let after = serde_json::to_value(&d.params).unwrap();
            let mut patch = Vec::new();
            diff(&before, &after, &mut Vec::new(), &mut patch);
            Ok(json!({"seed": d.seed, "picks": picks_json(&d.picks), "strengths": pairs_obj(&d.strengths),
                "patch": patch}))
        }
        // the defaults tables validation and the recipes share (MONUMENT_GUARD_DEFAULTS, FORGED_DEFAULTS)
        "guard_defaults" => {
            let mut out = Map::new();
            for s in monument::GUARD_STYLES {
                out.insert(s.to_string(), serde_json::to_value(monument::guard_defaults(s)).unwrap());
            }
            Ok(Value::Object(out))
        }
        "forged_defaults" => Ok(serde_json::to_value(families::forged_defaults()).unwrap()),
        "version" => Ok(json!({"bladegen_core": bladegen_core::VERSION, "catalogue": families::catalogue().version})),
        _ => Err(format!("unknown op {op}")),
    }
}

fn catalogue_of(v: &Value) -> Result<Catalogue, String> {
    match v.get("catalogue").filter(|c| c.is_object()) {
        Some(c) => {
            let cat: Catalogue = parse(c, "catalogue")?;
            cat.check().map_err(|e| format!("catalogue: {e}"))?;
            Ok(cat)
        }
        None => Ok(families::catalogue().clone()),
    }
}

/// bladegen's `normalizeSeed` for a design seed: a number or a string.
fn seed_of(v: &Value) -> Result<u32, String> {
    match v {
        Value::String(s) => Ok(glow::normalize_seed_str(s)),
        Value::Number(n) => Ok(glow::normalize_seed(n.as_f64().unwrap_or(f64::NAN))),
        _ => Err("seed: not a number or string".into()),
    }
}

fn picks_json(p: &families::Picks) -> Value {
    json!({"blade": p.blade, "guard": p.guard, "pommel": p.pommel, "grip": p.grip})
}

fn pairs_obj(xs: &[(String, f64)]) -> Value {
    Value::Object(xs.iter().map(|(k, x)| (k.clone(), json!(x))).collect())
}

/// `[path, value]` to set and `[path]` to delete, turning `a` into `b` (objects recursed, everything else whole;
/// `null` and absent are both "undefined").
fn diff(a: &Value, b: &Value, path: &mut Vec<String>, out: &mut Vec<Value>) {
    match (a, b) {
        (Value::Object(x), Value::Object(y)) => {
            for (k, bv) in y {
                path.push(k.clone());
                match x.get(k) {
                    Some(av) => diff(av, bv, path, out),
                    None if bv.is_null() => {}
                    None => out.push(json!([path.clone(), strip_nulls(bv.clone())])),
                }
                path.pop();
            }
            for (k, av) in x {
                if !y.contains_key(k) && !av.is_null() {
                    let mut p = path.clone();
                    p.push(k.clone());
                    out.push(json!([p]));
                }
            }
        }
        _ if a == b => {}
        (_, Value::Null) => out.push(json!([path.clone()])),
        _ => out.push(json!([path.clone(), strip_nulls(b.clone())])),
    }
}

fn strip_nulls(mut v: Value) -> Value {
    fn go(v: &mut Value) {
        match v {
            Value::Object(m) => {
                m.retain(|_, x| !x.is_null());
                m.values_mut().for_each(go);
            }
            Value::Array(a) => a.iter_mut().for_each(go),
            _ => {}
        }
    }
    go(&mut v);
    v
}

fn push_attr(bin: &mut Vec<u8>, xs: &[f32], item: usize) -> Value {
    let off = bin.len();
    for x in xs {
        bin.extend_from_slice(&x.to_le_bytes());
    }
    json!({"itemSize": item, "count": xs.len() / item, "byteOffset": off, "byteLength": bin.len() - off})
}

fn encode(m: &Mesh, extra: Value, bin: &mut Vec<u8>) -> Value {
    let mut attrs = Map::new();
    attrs.insert("position".into(), push_attr(bin, &m.pos, 3));
    attrs.insert("normal".into(), push_attr(bin, &m.nrm, 3));
    for (k, xs, item) in [("uv", &m.uv, 2), ("color", &m.color, 4), ("tangent", &m.tangent, 4)] {
        if !xs.is_empty() {
            attrs.insert(k.into(), push_attr(bin, xs, item));
        }
    }
    let off = bin.len();
    for i in &m.idx {
        bin.extend_from_slice(&i.to_le_bytes());
    }
    let mut o = json!({"vertexCount": m.vertex_count(), "attributes": attrs,
        "index": {"count": m.idx.len(), "byteOffset": off, "byteLength": bin.len() - off}});
    if let Value::Object(e) = extra {
        o.as_object_mut().unwrap().extend(e);
    }
    o
}

// ---------------------------------------------------------------- the C ABI (wasm32)

thread_local! {
    static RESULT: std::cell::RefCell<Vec<u8>> = const { std::cell::RefCell::new(Vec::new()) };
}

/// A buffer of `len` bytes for the loader to fill.
#[no_mangle]
pub extern "C" fn bg_alloc(len: usize) -> *mut u8 {
    let mut v = Vec::<u8>::with_capacity(len.max(1));
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}

/// Frees a buffer from [`bg_alloc`].
///
/// # Safety
/// `ptr` and `len` must come from one `bg_alloc(len)` call, freed once.
#[no_mangle]
pub unsafe extern "C" fn bg_free(ptr: *mut u8, len: usize) {
    drop(Vec::from_raw_parts(ptr, 0, len.max(1)));
}

/// Runs [`call`]; returns a pointer to the result ([`bg_result_len`] bytes, valid until the next call).
///
/// # Safety
/// The two (pointer, length) pairs must describe readable memory (UTF-8 for the op).
#[no_mangle]
pub unsafe extern "C" fn bg_call(op: *const u8, op_len: usize, input: *const u8, in_len: usize) -> *const u8 {
    let op = std::str::from_utf8(std::slice::from_raw_parts(op, op_len)).unwrap_or("");
    let input = if in_len == 0 { &[][..] } else { std::slice::from_raw_parts(input, in_len) };
    let out = call(op, input);
    RESULT.with(|r| {
        *r.borrow_mut() = out;
        r.borrow().as_ptr()
    })
}

/// The length of the last result.
#[no_mangle]
pub extern "C" fn bg_result_len() -> usize {
    RESULT.with(|r| r.borrow().len())
}
