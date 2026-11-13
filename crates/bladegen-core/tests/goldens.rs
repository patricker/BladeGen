//! Committed digests of the conformance corpora (`tests/goldens/corpora.json`), so a bladegen checkout without
//! vtuber-stack's corpora still checks the geometry bit for bit.
//!
//! The file holds every distinct validated `SwordParams` of the SW1, SW2, SW7 and SW10 corpora and, per case, each
//! mesh this crate builds ([`model::digests`]: `<part>#<k>` name, vertex count, FNV-1a 64 over its attributes,
//! indices and matrix). The web app's `core.spec.ts` checks the committed wasm module against the same file. It was recorded from this
//! crate on the day `tests/conformance.rs` matched every one of those meshes bit for bit to the corpora (BG1), so
//! the digests are the corpora's.
//!
//! A deliberate geometry change re-records it: `BLADEGEN_RECORD_GOLDENS=1 cargo test --test goldens` with the
//! corpora present (the `BLADEGEN_*` variables of `tests/conformance.rs`); say in the commit why the bytes moved, and
//! re-bake the galaxy kit's sword files.
use bladegen_core::{model, params::Sword};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

fn goldens_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/goldens/corpora.json")
}

fn digests(s: &Sword) -> Vec<(String, usize, String)> {
    model::digests(s)
}

fn corpus_dirs() -> Vec<(&'static str, PathBuf)> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../..");
    [
        ("sw1", "BLADEGEN_SW1", "WORLDGEN_BLADEGEN_SW1", "reviews/sw1/fixtures"),
        ("sw2", "BLADEGEN_FIXTURES", "WORLDGEN_BLADEGEN_FIXTURES", "reviews/sw2/corpus"),
        ("sw7", "BLADEGEN_SW7", "WORLDGEN_BLADEGEN_SW7", "reviews/sw7/corpus"),
        ("sw10", "BLADEGEN_SW10", "WORLDGEN_BLADEGEN_SW10", "reviews/sw10/corpus"),
    ]
    .into_iter()
    .map(|(c, ours, kit, d)| {
        let p = std::env::var_os(ours).or_else(|| std::env::var_os(kit)).map(PathBuf::from).unwrap_or(root.join(d));
        (c, p)
    })
    .collect()
}

fn record() {
    let mut params: Vec<Value> = Vec::new();
    let mut cases = Vec::new();
    for (corpus, dir) in corpus_dirs() {
        let index: Value = serde_json::from_slice(
            &std::fs::read(dir.join("index.json")).unwrap_or_else(|e| panic!("{}: {e}", dir.display())),
        )
        .unwrap();
        for row in index.as_array().unwrap() {
            let id = row["id"].as_str().unwrap();
            let v: Value =
                serde_json::from_slice(&std::fs::read(dir.join(format!("{id}.validated.json"))).unwrap()).unwrap();
            let v = v.get("model").cloned().unwrap_or(v);
            let p = match params.iter().position(|q| *q == v) {
                Some(p) => p,
                None => {
                    params.push(v.clone());
                    params.len() - 1
                }
            };
            let s: Sword = serde_json::from_value(v).unwrap();
            let meshes: Vec<Value> = digests(&s).into_iter().map(|(n, c, d)| json!([n, c, d])).collect();
            cases.push(json!({"corpus": corpus, "id": id, "params": p, "meshes": meshes}));
        }
    }
    let out = json!({"format": 1, "note": "bladegen-core tests/goldens.rs; params are validated SwordParams",
        "params": params, "cases": cases});
    std::fs::create_dir_all(goldens_path().parent().unwrap()).unwrap();
    std::fs::write(goldens_path(), serde_json::to_string(&out).unwrap() + "\n").unwrap();
    eprintln!("recorded {} cases, {} distinct params -> {}", cases.len(), params.len(), goldens_path().display());
}

#[test]
fn the_geometry_matches_the_recorded_corpora() {
    if std::env::var_os("BLADEGEN_RECORD_GOLDENS").is_some() {
        record();
    }
    let g: Value = serde_json::from_slice(&std::fs::read(goldens_path()).unwrap()).unwrap();
    let params: Vec<Sword> =
        g["params"].as_array().unwrap().iter().map(|v| serde_json::from_value(v.clone()).unwrap()).collect();
    let mut failures = Vec::new();
    let mut meshes = 0;
    let cases = g["cases"].as_array().unwrap();
    for c in cases {
        let what = format!("{} {}", c["corpus"].as_str().unwrap(), c["id"].as_str().unwrap());
        let ours = digests(&params[c["params"].as_u64().unwrap() as usize]);
        let theirs: Vec<(String, usize, String)> = c["meshes"]
            .as_array()
            .unwrap()
            .iter()
            .map(|m| (m[0].as_str().unwrap().into(), m[1].as_u64().unwrap() as usize, m[2].as_str().unwrap().into()))
            .collect();
        meshes += theirs.len();
        if ours != theirs {
            failures.push(format!("{what}: {ours:?}\n  recorded {theirs:?}"));
        }
    }
    eprintln!("goldens: {} cases, {meshes} meshes", cases.len());
    assert!(cases.len() >= 240 && meshes >= 1200, "goldens too small");
    assert!(failures.is_empty(), "{} cases differ:\n{}", failures.len(), failures.join("\n"));
}
