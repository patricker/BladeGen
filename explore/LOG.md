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

Preview correction: first drone eye (28,43,45) cropped tall pommels. Moved both rasterizers to
(35,48,65), target (0,22,0), preserving 45° FOV and a complete monument silhouette.

## 6 — Shear-gate guard

Built two separately identified stepped jaws, central load-bearing hub and orange luminous throat.
Jaws slide outward analytically during a read; the blade and planted tip remain fixed. Polygon
extrusion uses deterministic first-ear triangulation, capped front/back and explicit side walls.
Parameters: jawHeight 0.5–1.5 W (0.9), stagger 0–0.5 W (0.22), readTravel 0.1–0.7 W (0.35).
[GLB](out/06-gate/sword.glb), [mast](out/06-gate/mast.png), [drone](out/06-gate/drone.png).
Tests: every gate component closed/outward/finite, repeatability, 66 fixed-time samples verify
jaws remain on separate sides and move outward; hub/root overlaps are intentional slide bearings.
Verdict **keep**: severe mechanical cross. Proposed guard weight 0.8, heavy ×2, barren ×1.8.
Bevel omitted in this first study; a broad step reads better than tiny chamfers at 75 m.

## 3 — Faultbound blade

Built individually capped fragments with seed-indexed shared zigzag fracture boundaries, large
open gaps, inset orange fault bars and independent lateral alignment tracks. Root and planted
terminal fragment stay fixed. Parameters: segments 2–7 (4), gap 0.1–0.3 W (0.22), offset
0–0.35 W (0.18), readClosure 0–0.9 (0.65). Read closes lateral misalignment only; axial gaps
stay open to preserve attachment and guaranteed clearance. Dropped rotation for this slice:
translation alone communicates restraint without risking swept-face collisions.
[GLB](out/03-faultbound/sword.glb), [mast](out/03-faultbound/mast.png), [drone](out/03-faultbound/drone.png).
Tests across 2/4/7 fragments and three seeds: closed/outward/finite/deterministic, fixed endpoints,
and conservative disjoint Y bounds at read samples (motion only X, so bounds prove all-time clearance).
Verdict **keep**: clear impossible mass. Proposed blade weight 0.45, volcanic ×2.5, eccentric ×2.
Legacy nodes/channels/scars are rejected on this topology until fragment-local routes are authored.

## 1 — Window-keel blade

Built a **single closed manifold solid** around one long angular aperture. Front/back annular
faces, inner walls, outside walls and tip are explicit; no Boolean subtraction or guessed winding
repair. Separate closed luminous lips surround the opening on both faces without filling it.
Parameters: start 0.08–0.35 L (0.18), end 0.45–0.78 L (0.68), width 0.2–0.6 W (0.48).
Rails retain ≥0.2 W and the planted terminal keel stays solid. Bridge count and arched shoulders
deferred: the unbroken opening is the strongest distant shape.
[GLB](out/01-window/sword.glb), [mast](out/01-window/mast.png), [drone](out/01-window/drone.png).
Tests cover three aperture widths, single-solid closed/outward/finite topology, no centre-ray hit
through the opening, real rail hits, exact bounds/determinism, and visible void area in both views.
Verdict **keep, first production family**. Proposed blade weight 0.6, magnetic ×3, light ×2.
All additions remain outside the shipped catalogue; legacy recipes and wasm are unchanged.

## 2 — Cleft-keel blade

Built a single closed forked blade with two real guard roots and a common planted keel. The
slot opens at the guard and merges through a biased chevron shoulder. Parameters: separation
0.3–0.9 W (0.6), mergeAt 0.6–0.8 L (0.72), bias ±0.1 L (0.05). Two limbs only: three
read too readily as a trident. Fixed 0.25 W rail ligaments keep mass around the opening.
[GLB](out/02-cleft/sword.glb), [mast](out/02-cleft/mast.png), [drone](out/02-cleft/drone.png).
Tests: nine separation/bias pairs, manifold closure/winding, determinism, both guard-root hits,
empty upper centre and solid terminal keel. Verdict **promising**; window-keel is more coherent
at distance, but the open slot produces a severe tuning-fork variant. Weight 0.3, moons ×1.8.

## 4 — Rib-vault blade

Built 2–4 paired angular closed ribs, each rooted twice into the blade, with broad open bays.
Parameters: pairs 3, reach 0.4–1 W (0.7). Used hard swept facets rather than smooth bone arches:
more containment-frame than folklore. Restricted to continuous legacy blade roots.
[GLB](out/04-ribs/sword.glb), [mast](out/04-ribs/mast.png), [drone](out/04-ribs/drone.png).
Tests: all counts, manifold members/outward/finite/repeatable, two attachment zones, extent bounds.
Verdict **promising**, likely too busy at four pairs; prefer two or three. Weight 0.35, heavy ×2,
magnetic ×2.5. Aiming for a few enormous bays rather than high-frequency serration.

## 5 — Accretion crown

Built seed-indexed six-vertex faceted mineral intrusions with deeply embedded blade-edge roots.
Parameters: count 1–6 (4), length 0.4–1.5 W (0.95), width 0.15–0.35 W (0.24). Directions
come from three deterministic libm angles per side; every crystal extends beyond the blade silhouette.
[GLB](out/05-crystals/sword.glb), [mast](out/05-crystals/mast.png), [drone](out/05-crystals/drone.png).
Tests across counts/seeds: closed/outward facets, finite bounds, repeatability, embedded roots and
large projection. Verdict **promising** at 2–4 growths; six approaches a rock cluster. Weight 0.4,
cold ×2, volcanic ×1.4. Root color/strength is preview material, not a new shipped look.

## 8 — Captive kernel

Built two massive open-seam pommel cage lobes, a real grip socket and an independent gold luminous
octahedral core. Radius 0.12–0.2 W (0.18), analytical readLift 0–0.1 W (0.1), fixed cage.
Rotation dropped: a slow vertical lift exposes the seam clearly and admits conservative clearance
bounds. Topology is capped polygonal hardware with intentionally floating core.
[GLB](out/08-kernel/sword.glb), [mast](out/08-kernel/mast.png), [drone](out/08-kernel/drone.png).
Tests: closed/outward components, repeatability, true centre seam and core's free-corridor bounds
over 66 read samples. Verdict **keep** with open staves; strong beacon, useful drone reveal.
Proposed pommel weight 0.6, magnetic ×2.5, blueStar ×1.5.

## 9 — Tension chains

Built two seeded-design-independent restraint chains from named forged-guard roots to blade-edge
anchors. Parameters: links 4–10 (6), polynomial lateral slack 0–0.3 W (0.2). Closed rectangular
annular links alternate orientation; static only, no gravity simulation. This is a visual chain
study, not physically validated interlocking: end rings/fittings and link intersection tolerances
need another pass before production.
[GLB](out/09-chains/sword.glb), [mast](out/09-chains/mast.png), [drone](out/09-chains/drone.png).
Tests: 12 closed/outward/finite links, bounded extent, named endpoints, repeat buffers.
Verdict **drop current recipe**: links risk reading as disconnected beads at distance, attachment
hardware is unfinished. Keep the kernel/annulus helpers. Suggested weight 0 until redesigned.

## 10 — Siege sutures

Built huge raised bronze staples across the **actual seeded scar records**. Each bridge runs
lengthwise over an edge wound and has two feet on intact blade above/below it. Parameters:
standOff 0.04–0.2 W (0.1), section 0.07–0.16 W (0.1); count comes from the scars, avoiding
independent placement drift. Closed bridge and foot solids overlap intentionally at their joints.
[GLB](out/10-sutures/sword.glb), [mast](out/10-sutures/mast.png), [drone](out/10-sutures/drone.png).
Tests weld primitive seam copies, verify closure/winding, deterministic assemblies, and all six
anchors hit intact scar-blade surfaces. Verdict **promising**, stronger drone story than mast
silhouette. Feature frequency 0.25 on scarred swords, heavy ×1.5, barren ×2.

## 11 — Exposed strata

Built 2–6 (default 4) capped transverse material regions with shared diagonal boundaries
(0–0.5 W bias, default 0.28). This is exported geometry/material partitioning, not a shader.
Dark metal alternates with dull bronze; no added bloom. Deliberately limited this slice to
transverse laminations rather than inventing a general material Boolean system.
[GLB](out/11-strata/sword.glb), [mast](out/11-strata/mast.png), [drone](out/11-strata/drone.png).
Tests: all region solids closed/outward/finite/repeatable, four identical shared-boundary vertices
between neighboring layers. Verdict **drop current recipe**: color bands flatten the mass and
change little in silhouette. Keep the partitioning API for actual bevel-revealed strata later.
Suggested weight 0; a future version could favor heavy/cold worlds.

## 13 — Planetary encroachment

Built five massive angular basalt crusts rooted through the declared burial plane, with seed-indexed
heights. Parameters: height 0.04–0.2 L (0.1), sink 0–0.4 (0.12), projection 0.1–0.35 W (0.18).
No biological inference. World ground is explicit: consumers must use the same sink in placement.
[GLB](out/13-basalt/sword.glb), [mast](out/13-basalt/mast.png), [drone](out/13-basalt/drone.png).
Tests: closed/outward/finite/repeatable crusts, each crosses ground, stays near burial and physically
intersects the blade thickness. Verdict **promising** as environment integration, not a family.
Feature frequency 0.3 on barren/volcanic worlds; keep a bright-clear band in a later material pass.

## 14 — Terminator anatomy

Built a coordinated static hemisphere warp across blade, guard, grip and pommel: one side widens
and thickens, the other contracts. Bias ±0.7 (0.5). Positive width factors and a continuous rational
thickness transition preserve triangle indexing and fixed Y attachment planes. Existing matrices
are baked once, then normals recomputed. Symbolic left/right only: no world star direction is inferred.
[GLB](out/14-terminator/sword.glb), [mast](out/14-terminator/mast.png), [drone](out/14-terminator/drone.png).
Tests: both bias extremes, exact repeatability, unchanged indices/Y bounds and finite buffers for
every part. Moving support recipes explicitly rejected. Verdict **promising**, but asymmetric mass
alone is subtler than the proposed heat vents; use as a locked-world modifier, frequency 0.5 when locked.

## 17 — Furnace script

Built one connected axial conduit with 1–3 (default 3) paired chevron branches, stable path IDs,
closed dark rims and inset orange channels following actual blade triangles. Width 0.03–0.09 W
(0.055). Changed carved trenches to **raised conduits**: substantially safer to combine with the
legacy surface topology, with a heavy containment appearance. Front face only in this study.
[GLB](out/17-circuit/sword.glb), [mast](out/17-circuit/mast.png), [drone](out/17-circuit/drone.png).
Tests: all 14 route/rim solids closed/outward/finite, deterministic, above surface; branches terminate
on the main trunk. Verdict **keep** as a shared emission motif; weight/frequency 0.5, volcanic ×2,
magnetic ×1.6. A true engraved network would need dedicated channel-floor topology, not grid deformation.
