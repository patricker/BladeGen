#!/usr/bin/env bash
# Rebuilds src/three/sword/core/bladegen_core.wasm from crates/bladegen-wasm (bladegen-core compiled to wasm32).
# Needs the wasm32-unknown-unknown target (`rustup target add wasm32-unknown-unknown`); no wasm-bindgen.
# Offline by default (crates from the cargo cache, versions from Cargo.lock); pass --online to allow fetching.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
offline="--offline"
[ "${1:-}" = "--online" ] && offline=""
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$root/target}"
cd "$root"
cargo build $offline --locked --release --target wasm32-unknown-unknown -p bladegen-wasm
cp "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/bladegen_wasm.wasm" src/three/sword/core/bladegen_core.wasm
ls -l src/three/sword/core/bladegen_core.wasm
