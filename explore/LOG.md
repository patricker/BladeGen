# CX2 sword experiments

Branch: `explore/codex-sword-ideas`, starting at f09919c. Offline. Ranking follows CX1:
18, 16, 15, 12, 7, 20, 21, 6, 3, 1; then the remaining ideas in numeric order.

Compatibility boundary: the public `explore` Rust module is an explicit opt-in API. The existing
SwordParams, catalogue, presets, builders, goldens and committed wasm remain untouched. Experimental
components retain stable IDs and material roles. The reference blank has a 36 m blade, 6 m width,
and 12% burial. New operations use the existing deterministic libm/seed functions or polynomial maths.

Reproduction (offline): `cargo run --offline -p bladegen-core --example explore -- <idea-id>`;
then `python explore/render.py <idea-id>`. Output is in `explore/out/<idea-id>/` (ignored).
Run `cargo test --offline` for invariants and unchanged legacy golden bytes.

Toolchain: Windows stable 1.88 failed to launch rustc through Cargo; installed 1.94.1 works when
RUSTC and Cargo point directly to that toolchain. Neither has wasm32 installed. No network used.
Initial `npm test` failed before tests with esbuild `spawn EPERM`; investigation continues.

This session permits only reads under `.git`: the first `git add` was rejected creating index.lock.
`explore/commit.ps1` therefore maintains the requested branch in **separate writable metadata** at
`explore/out/git-history`, based on f09919c, with Peter's identity and Codex trailers. The real branch
ref cannot advance here. `explore/out/ideas.bundle` contains the per-idea commits for the main agent
to import. This is an environment limitation, not a request for further approval.

## 18 — Resonance anatomy

Built five visible diamond read nodes with stable seed-derived IDs, vocabulary 1, source/conduction/
containment roles and real triangle-sampled surface anchors/normals. Parameters: count 3–9, radius
0.03–0.08 blade widths. Hardware intersects its attachment surface intentionally; its exposed half
is luminous. No random stream consumption by the old generator.

Preview: [GLB](out/18-resonance/sword.glb), [mast](out/18-resonance/mast.png),
[drone](out/18-resonance/drone.png). Tests: exact off-path meshes/matrices; node closure, winding,
finite bounds, attachment, positive normal and repeat builds across counts/seeds.
Validation: both new Rust tests pass; legacy golden test passes. Mast preview shows a sparse ladder
of tiny bright diamonds: useful targets, not a new family silhouette. Verdict **keep** as shared
read hardware; enlarge toward radius 0.08 for bright show shots. Suggested future feature frequency
0.6; magnetic ×2. Currently opt-in only. GLB retains the buried tip; PNGs mask geometry below ground.
