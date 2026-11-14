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

## 16 — Read choreography

Built an event-relative smoothstep ascent and return, with independent emissive envelopes and local
translation tracks for later moving assemblies. `durationMs` 2000–15000 (6500 default),
`emissionGain` 1–4 (2.5 default). The blade stays fixed. Node activation advances from buried end
toward guard and pommel; no simulation or frame history. Preview uses 4000 ms.
[GLB](out/16-read/sword.glb), [mast](out/16-read/mast.png), [drone](out/16-read/drone.png).
Tests cover rest at both endpoints and after duration, stage ordering, deterministic out-of-order
samples, fixed blade and bounded gain. Verdict **keep** as shared show infrastructure. No family
weight; all selected experimental families can carry this descriptor. Static PNG cannot show gain
because it intentionally has no exposure/bloom; the GLB carries real emissive strength.

## 15 — Stellar emission roles

Built separate closed front/back edge and mineral channel ribbons, plus white resonance nodes.
Widths are 2.5%+2.5%+6.5% of local width: 11.5% bright face area before nodes. Authored
linear-RGB temperature table at 2500/5500/10000/30000 K; strength defaults edge 4, channel 2,
node 7. Ribbons sample actual blade triangles. Tests: closed/outward/finite/deterministic,
surface clearance, exact palette knots and interpolation bounds.
[GLB](out/15-emission/sword.glb), [mast](out/15-emission/mast.png), [drone](out/15-emission/drone.png).
Verdict **keep** as a shared look. Restrict current mirrored back ribbons to symmetric untwisted
blades until a back-surface sampler is added; no claim of general asymmetric back attachment.
Suggested feature frequency 0.7, blueStar ×1.5; currently opt-in only, no catalogue edits.

## 12 — Planetary scars

Built seeded alternating impact bites in a dedicated closed loft blade. This is a broad, severe
slab section with explicit notch boundaries, rather than carving the legacy 13-column grid.
Parameters: count 1–6 (3), depth 0.05–0.3 widths (0.24), length 0.02–0.09 blade lengths (0.075).
Each wound keeps ≥70% local width. Tests exercise seeds/counts, closed manifold edge pairs,
positive volume, finite bounds, exact repeatability, notch count and minimum ligament.
[GLB](out/12-scars/sword.glb), [mast](out/12-scars/mast.png), [drone](out/12-scars/drone.png).
Verdict **promising**: reads as damage from the mast, but needs exposed fracture emission before
production; rectangular section is intentionally brutal. Proposed feature frequency 0.35,
volcanic ×2.5, barren ×1.6. Current API opts in; legacy blade outputs are untouched.

## 7 — Open-stave grip

Built three to six bowed square staves around an empty shaft, two true annular collars and a
slender floating luminous diamond column. Parameters in blade widths: radius 0.2–0.45 (0.34),
section 0.07–0.15 (0.11), bow 0–0.2 (0.08). Fixed guard plane y=0 and pommel plane y=-H;
the old solid grip is removed only in this opt-in assembly. No angular platform maths: libm.
[GLB](out/07-staves/sword.glb), [mast](out/07-staves/mast.png), [drone](out/07-staves/drone.png).
Tests: closed/outward members and collars, finite/repeatable buffers, all counts, open shaft
clearance, attachment planes and bounded core. Verdict **keep**: strong drone energy chamber,
secondary mast silhouette. Suggested grip weight 0.65, magnetic ×3, light ×1.4 (currently absent).

## 20 — Assembly grammar

Built a conservative explicit preflight: major motif budget (1–4, default 2), minimum shaft/core
gap (0.05–0.3 W, default 0.12), and route incompatibility reasons. Rejects crowded staves,
over-budget designs and legacy ribbons crossing scar voids. Deliberately reduced the original
candidate-search proposal: a deterministic error is more honest than silently replacing the owner's
chosen feature. No new PRNG draws. Demonstration combines scars, open staves and read nodes.
[GLB](out/20-grammar/sword.glb), [mast](out/20-grammar/mast.png), [drone](out/20-grammar/drone.png).
Tests prove each rejection and repeatability of the accepted composition; constituent topology tests
apply. Verdict **keep** as opt-in validation infrastructure; no catalogue weight. Further topology
families will extend this explicit compatibility table rather than rely on generic touching tests.

## 21 — Silhouette distance scoring

Built a Rust CPU perspective rasterizer (64/128/256 px) with integer 1/256 px coverage, fixed
45° mast and drone cameras, perspective-correct depth, ground masking, binary silhouette/emission
masks, 32-bin width profile, and flood-filled enclosed void area. No aggregate beauty score.
Every example now exports Rust `metrics.json`; the dependency-free Python renderer gives larger
512 px PNGs for review. Preview uses staves plus stellar roles.
[GLB](out/21-silhouette/sword.glb), [mast](out/21-silhouette/mast.png),
[drone](out/21-silhouette/drone.png), [numeric masks](out/21-silhouette/metrics.json).
Tests: repeated masks identical, measured occupied/emission counts, width bounds, and staves add
real enclosed voids in both views. Verdict **keep** as offline diagnostics; no catalogue weight.
No bloom model yet, so narrow-gap survival under show exposure remains a renderer review task.
