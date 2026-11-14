# Headless bladegen: CLI, seeded swords, glow channel and conformance fixtures

Everything here runs under Node with no DOM and is not part of the website bundle.
The site's default behaviour is unchanged: the new features are opt-in (`blade.glow`,
`giantPresets`, the headless export path).

Node: the scripts run through `vite-node` (already a dev dependency through Vitest), so
they work on any Node the test suite runs on (checked on Node 20.15; the site still asks
for Node 24).

## Rust core (BG1)

Since BG1 the sword geometry below the "Algorithm boundaries" line, the monument families and the stroke kernel are
implemented once, in Rust: `crates/bladegen-core` (a 1:1 port of this repo's TypeScript made for the galaxy kit,
SW2/SW7/SW11, bit-exact on every corpus here). The web app and these headless tools call it through
`crates/bladegen-wasm` (a wasm32 module with a small C ABI: `bg_alloc`, `bg_free`, `bg_call(op, json)`,
`bg_result_len`; no wasm-bindgen) and `src/three/sword/core/wasm.ts`, which loads it once with top-level await and
turns its mesh buffers into `THREE.BufferGeometry` with the attribute order and index type the TypeScript builders
produced. The ops: `blade`, `blade_export`, `glow`, `guard_forged`, `guard_monument`, `pommel_monument`,
`build_parts`, `digests`, `monument_transform`, `monument_seed`, `trait_strengths`, `entry_weights`, `pick_monument`,
`design_monument` (its params come back as a patch on the base, so fields the core does not model stay the
caller's), `guard_defaults`, `forged_defaults`, `version`.

Retired TypeScript (the Rust is the implementation): `buildBladeGeometry`'s body, `computeBladeTangents`,
`fixBladeWinding` (now `bladeExportGeometry`), the glow mask/UV/rune/glow-mesh code in `glow.ts`, the forged cross
in `guardForged.ts`, `monument/strokes.ts`, the builders in `monument/guards.ts` and `monument/pommels.ts`, and the
selection and recipes in `monument/design.ts`. Kept in TypeScript because nothing duplicates them: `math.ts` (the
blade's scalar profile helpers, used by the fuller and hamon overlays, the outline, engravings, accessories, dynamics
and `monumentTransform`), `rng.ts` (the randomizer), and the hilt parts built from three's primitives in
`guardGeometry.ts`, `handleGeometry.ts`, `pommelGeometry.ts` and `guardDecor.ts` (the core has its own port of those
for the kit; see "Not switched" in BG1's report).

The conformance corpora below are now the core's reference: `crates/bladegen-core/tests/conformance.rs` matches the
SW1/SW2/SW7/SW10 corpora when they are present (`BLADEGEN_SW1`, `BLADEGEN_FIXTURES`, `BLADEGEN_SW7`,
`BLADEGEN_SW10`), and `tests/goldens.rs` checks committed digests of the same meshes without them. Regenerating a
corpus with the tools below now runs the core (through the wasm module); before BG1 it ran the TypeScript, and the
outputs are byte-identical (BG1: SW1's 20 fixtures with their GLBs, SW10's corpus and GI11's end-to-end corpus).

## CLI

### Opt-in CX2 experiments

The Rust `bladegen_core::explore` module is a separate review API, with 25 explicit presets,
closed structural meshes, semantic read targets, analytical read samples, silhouette diagnostics,
trait sweeps, LODs and replay-checked manifests. It is never called by the shipped recipes or
catalogue. See [the experiment log](../explore/LOG.md) for individual verdicts and previews.

Offline reproduction: `cargo run --offline -p bladegen-core --example explore -- --all`, then
`python explore/render.py --all` and `python explore/gallery.py`. On this Windows clone,
`./explore/run.ps1 -Idea '--all'` chooses the installed working Rust toolchain. Open
`explore/out/index.html` for mast/drone views, binary silhouettes and fixed-time read samples.

`src/headless/explore.ts` (`buildExplorationGroup`, re-exported from the headless entry point)
adapts Rust `mesh.json` buffers into a Three group at metre scale. It preserves component IDs,
matrices, emissive roles and semantic metadata and can be passed to `exportGLB`. It contains no
sword geometry. The experimental `recipe.json` envelope has its own
`schema/explore.recipe.schema.json`; it is not a site document accepted by the regular import UI.
Replay it natively with `cargo run --offline -p bladegen-core --example explore -- --verify <recipe.json>`.
The committed wasm has no experimental operations; adding live editor controls requires a wasm rebuild.

```sh
npm run bladegen -- presets                       # list presets (site + giant)
npm run bladegen -- gen --seed 42 --monument --out sword.glb --params-out sword.json
npm run bladegen -- gen --preset monument --monument --height-m 18 --out monument.glb
npm run bladegen -- gen --params my-export.json --out sword.glb --svg blade.svg --stats
npm run bladegen -- gen --seed 42 --dump fixtures/s42   # s42.mesh.json + s42.mesh.bin
```

Sources: `--params <file>` (a site JSON export, a headless doc, bare `SwordParams`, or a
planet `sword.json` whose `blade.bladegen` holds one of those), `--preset <id>`, or
`--seed <n|text>` (the seeded randomizer). Relative paths resolve against the directory
`npm` was started from. `npm run bladegen -- help` prints every flag.

`--params-out` writes a headless doc:

```json
{ "version": 5, "generator": "bladegen-headless/1", "seed": 42, "style": "monument/leaf",
  "model": { "blade": {}, "guard": {}, "handle": {}, "pommel": {} },
  "materials": { "blade": {}, "guard": {}, "handle": {}, "pommel": {} },
  "monument": { "heightM": 16, "sink": 0.12 } }
```

`model` is the exact `SwordParams` schema (`schema/sword.schema.json#/$defs/SwordParams`).
Feeding the doc back with `--params` reproduces the same sword.

Library entry point: `src/headless/index.ts` (`buildSword`, `prepareExport`, `exportGLB`,
`dumpMeshes`, `monumentTransform`, `readDoc`, `swordStats`).

## Seeded randomizer

`randomSword(seed)` in `src/three/sword/randomize.ts` returns `{ params, materials,
archetype }`. It is weighted toward silhouettes that read at giant scale: eight archetypes
(greatsword 3, flamberge 2, leaf 2, kris 1.5, cleaver 1.5, spire 1.5, crescent 1,
serrated 1), broad blades (base width 0.3 to 0.65), a cross 3.2 to 5 blade-widths wide,
long two-hand grips, heavy pommels, carved fullers only, low-frequency serration only, and
always a glow channel. It never emits basket, shell, knucklebow or swept guards,
scabbards, tassels, engravings or canvas textures, and puts quillons only on bar guards
(on other guards `decorateGuard` leaves them floating). Every value it emits survives
`validateSwordParams` unchanged and validates against the schema (unit-tested over 60
seeds).

## Monument convention (giant swords)

`prepareExport(sword, params, { monument: { heightM, sink } })` (CLI `--monument`) wraps
the sword in a root node named `sword`:

- rotation pi about +Z (tip down; quaternion `[0, 0, 1, 0]`);
- uniform scale `heightM / L`, where `L` is the validated blade length, so the blade
  (guard line to tip) is `heightM` metres long;
- translation so that the blade centre line at `y = L * (1 - sink)` lands on the origin.
  `sink` (default 0.12) is the buried fraction of the blade.

So the GLB is in metres, +Y up, origin at the point where the blade meets the ground. Lean
and yaw are left to the consumer. The root node's `extras.bladegen` repeats the convention.

**Guards at monument scale.** The `bar` guard is a box of fixed height (`GUARD_HEIGHT`
0.08 units), so on a broad monument blade it reads as a thin plate. The `forged` guard
style (the `monument` preset's) is sized from the blade instead: block height
`forged.height` x the blade's base width, depth `forged.depth` x its thickness, block
half-length `forged.block` x the base width, then arms that taper (`taper`), turn toward
the blade (`curl`, radians; negative toward the grip) and end in knobs (`finial`), with a
square, round or diamond-ridged section (`section` -1..1). Only `guard.width`, the span,
is absolute. Validation writes the whole `forged` block back for that style only.

## Glow channel (`blade.glow`)

```json
"glow": { "enabled": true, "color": "#7fd8ff", "intensity": 4, "edgeWidth": 0.06,
          "edgeMask": 1, "coreWidth": 0.12, "coreMask": 0.35, "runeCount": 7,
          "runeSeed": 1066, "runeStart": 0.12, "runeEnd": 0.7, "runeScale": 0.5,
          "runeStroke": 0.14, "runeFaces": "both", "pulseHz": 0.4 }
```

When enabled:

- The blade mesh gets `TEXCOORD_0` (u = across the width 0..1, v = along the length 0..1)
  and `COLOR_0` with RGB = 1 (no tint) and **alpha = glow mask**: an edge band plus a core
  band, from `glowMaskAt` in `src/three/sword/glow.ts`. Viewers that multiply by vertex
  colour are unaffected. A custom shader reads `COLOR_0.a` (Unity glTFast: `mesh.colors[i].a`).
- A separate mesh `glow#0` holds emissive geometry: edge strips (`edgeWidth`) and seeded
  rune strokes along the centre line, laid 0.004 + 0.025 * thickness off the blade
  surface. Its material is named `glow` with `emissiveFactor` = colour and
  `KHR_materials_emissive_strength` = `intensity`, so Blender and glTFast show the glow
  without custom shaders. It also has `COLOR_0` = 1 so one shader can treat both meshes.
- `pulseHz` is metadata for consumers (`extras` on the glow material); it does not change
  geometry.

Without `glow` (or with `enabled: false`) the blade geometry is byte-identical to before.

## Export preparation

`prepareExport` makes these changes before the GLB is written. The conformance dump is
taken after them:

1. Meshes are named `<part>#<k>` (`blade`, `glow`, `blade.fuller`, `blade.hamon`, `guard`,
   `guard.extra`, `handle`, `pommel`, `scabbard`, `tassel`). Helper anchors are hidden and
   not exported.
2. Blade grid UVs are added if the blade has none (`--no-uvs` to skip).
3. **Blade winding fix** (`fixBladeWinding`; `--no-fix-winding` to skip). `buildBladeGeometry`
   winds its two broad faces inward while the side strips and end caps wind outward. The
   site does not show this because the blade material is double-sided, but vertex normals
   along the edges average the two directions. The fix reverses the broad-face triangles
   (in each of the `segs` row blocks of `12 * 4 + 4` triangles, the first `12 * 4`), then
   recomputes normals and tangents. The site keeps the original geometry; turning the fix
   on in `buildBladeGeometry` is a separate upstream decision.
4. With `--monument`, the root node described above.

GLB export uses Three's `GLTFExporter` (`binary: true, trs: true`) with a small
`FileReader` shim for Node.

## Conformance fixtures (for ports)

```sh
npm run fixtures -- --out <dir> --count 20 [--start 1] [--height-m 16] [--sink 0.12]
```

For each seed `s`, with `id = seed-<s, 4 digits>`:

| File | Content |
|---|---|
| `<id>.params.json` | headless doc: randomizer output (`model`, `materials`) plus `monument` |
| `<id>.validated.json` | `validateSwordParams(model)`: what the builders consume |
| `<id>.mesh.json` + `<id>.mesh.bin` | canonical mesh dump (below) |
| `<id>.glb` | the monument GLB |
| `index.json` | one row per seed: archetype, counts, bounds, monument TRS, hashes |
| `rng.json` | PRNG test vectors (`fmix32`, `hashSeed`, `q3`, the first 8 `next()` per seed) |

### Mesh dump format (`bladegen-mesh-dump`, version 1)

`mesh.json` lists meshes in canonical order: depth-first over the sword group's children
in insertion order (`Object3D.traverse`), anchors skipped. For each mesh:

- `name`, `part`, `vertexCount`, `triangleCount`;
- `matrix`: the 4x4 transform relative to the sword group (column-major f64, the product
  of local matrices from the mesh up to, not including, the sword group; the monument
  root is not included);
- `attributes`: every geometry attribute in sorted name order (`color`, `normal`,
  `position`, `tangent`, `uv`), each as little-endian **f32** in `mesh.bin` at
  `byteOffset`/`byteLength`, with `itemSize`, `count` and a SHA-256;
- `index`: little-endian **u32** (null for non-indexed geometry such as `ExtrudeGeometry`);
- `quantizedSha256`: SHA-256 over int32 LE `floor(v / 1e-4 + 0.5)` of each position
  transformed by `matrix` (f64), xyz per vertex. The file-level `quantizedSha256` hashes
  all meshes' quantized bytes in order.

Compare in this order: counts, then per-attribute SHA-256 (bit-exact), then the quantized
hash (1e-4 units, tolerant of last-bit differences), then per-vertex values within a
tolerance to locate any drift.

### Algorithm boundaries a port must match

The pipeline is: seed -> `randomSword` -> `validateSwordParams` -> `SwordGenerator` part
builders -> `prepareExport` -> dump/GLB. Each stage is a checkpoint (`params.json`,
`validated.json`, `mesh.*`).

1. **Seed and PRNG** (`src/three/sword/rng.ts`). Seed to u32: numbers are
   `floor(abs(x)) mod 2^32`; decimal strings up to 2^32 - 1 parse as numbers; other strings
   use FNV-1a over UTF-16 code units. State = `fmix32(seed)` (MurmurHash3 finalizer), then
   mulberry32. `next()` = u32 / 2^32 exactly. `range(a, b) = a + (b - a) * next()`,
   `int(a, b) = a + floor(next() * (b - a + 1))`, `chance(p) = next() < p`,
   `pick(xs) = xs[floor(next() * len)]`, `weighted` walks the list subtracting weights
   from `next() * total`. All of these are exact in IEEE 754 f64.
2. **Randomizer** (`src/three/sword/randomize.ts`). The draw order is the statement order,
   including conditional draws (for example `g.style === 'bar' && rng.chance(0.5)` draws
   only for bar guards). Continuous values go through `q3(x) = floor(x * 1000 + 0.5) / 1000`.
   It starts from `defaultSwordParams()` (`defaults.ts`); those literal defaults are part of
   the contract.
3. **Validation** (`validation.ts`). Clamping, defaults, enum coercion, and two derived
   rules that change geometry: kris blades get `waviness` from `krisWaveCount` when none
   is given, and `fullerEnabled` with `fullerCount` becomes explicit `fullers` slots
   (`buildLegacyFullers`). JS `Math.round` rounds halves toward +infinity; Rust's
   `f64::round` rounds them away from zero. They differ only at exact negative halves.
4. **Blade** (`bladeGeometry.ts`: `buildBladeGeometry`, `math.ts`). Grid of `segs + 1` rows
   by 13 columns by 2 sides, vertex index `i * 26 + j * 2 + side`. Positions are computed
   in f64 and stored as f32. Index order is part of the contract, because it drives normals.
   Normals come from `BufferGeometry.computeVertexNormals`. For each triangle (A, B, C),
   `(C - B) x (A - B)` is added to each corner's normal, and the running sum is **stored
   back as f32 after every add**. Each normal is then normalized (`x / sqrt(x^2 + y^2 +
   z^2)`) and stored as f32. Tangents (`computeBladeTangents`) use `Math.hypot`. V8 computes
   it as max-abs scaling plus a Kahan-compensated sum of squares, then `sqrt(sum) * max`.
   That is not the same as C/Rust `hypot`, so transcribe V8's version.
5. **Glow** (`glow.ts`). The UVs and mask are pure functions of (i, j). Glow vertices sample
   the blade surface on the blade's own triangles: in cell (i0, j0) with local (a, b), use
   triangle 00-01-11 if a >= b and 00-11-10 otherwise. Positions are read back as f32.
   Vertices are pushed out along `normalize(P(side) - P(other side))`. Each triangle's
   winding is chosen by the sign of `dot(cross(B - A, C - A), outward(A))`, computed in f64
   before the f32 store. Rune glyphs use `runeGlyph`'s documented draw order.
6. **Hilt and pommel.** These use Three.js primitives, so a port reimplements the Three
   0.180 algorithms exactly. The randomizer limits the set to:
   - guard `bar`: `BoxGeometry`;
   - guard `winged`/`claw`: `Shape` + `ExtrudeGeometry` (bevel off, 1 step, 12 curve
     segments), earcut triangulation, and `WorldUVGenerator` UVs. The mirrored half is a
     `clone()` with `scale.x = -1`, so its node matrix has a negative determinant;
   - guard `disk`: `Shape.absarc` + holes, `ExtrudeGeometry`, then `center()`;
   - quillons: `CylinderGeometry` + `ConeGeometry` (bar guards only);
   - guard `forged` (the monument preset's): no Three primitive; `buildForgedGuardGeometry`
     (`guardForged.ts`) writes its own indexed `BufferGeometry` (position, uv) and calls
     `computeVertexNormals`. A port follows that file's operation order in f64: the
     section scale `mix(1, root * mix(1, taper, tu), smooth(uBlock, uBlock + 0.12, u))`;
     `segments + 1` arm stations at `t = t0 * i / segments`, then 10 finial stations at
     `t = tk - rk * cos(pi * j / 10)` (knob `max(arm, rk * sin)` up to `j = 5`, then
     `hk * sin`); the centre line turns by `curl * u * u` and is integrated from the centre
     with 4 midpoint sub-steps per interval (`x = x + cos(th) * sub`); sections mix
     `(cos, sin)` toward `/ (|cos| + |sin|)` (diamond) or `/ max(|cos|, |sin|)` (square);
     rings run left tip, centre, right tip with `radial + 1` vertices each. The mesh sits at
     `(0, guardLine - halfHeight, 0)` with `rotation.z = tilt`;
   - guards `recurve`, `crescent`, `halo`, `wings`, `talon`, `ziggurat` and pommels `gem`,
     `sunwheel`, `horned`, `tiered` (SW10): no Three primitive; built from the monument
     stroke kernel (see "Monument families" below);
   - handle: `LatheGeometry` (33 profile points, 64 segments; its normals come from the
     profile, and a few are zero-length, so GLTFExporter warns and normalizes them in the
     GLB). The `crisscross` wrap is `TubeGeometry` (160 x 12) along a custom helix. Its
     Frenet frames use arc-length sampling (`getUtoTmapping`, 200 divisions). The `wire`
     wrap is `TorusGeometry` x 10;
   - pommel: `SphereGeometry` (orb), `CylinderGeometry` (disk, wheel), `ConeGeometry`
     (spike, crown), `OctahedronGeometry` (scentStopper, detail = round(shapeMorph * 2)),
     `TorusGeometry` (ring), and `BoxGeometry` plus a deformation and
     `computeVertexNormals` (fishtail).
   - Placement uses `Box3.setFromObject` (not precise). That transforms the geometry's f32
     bounding box corners by `matrixWorld` and takes the AABB. Node matrices come from
     `Euler` (XYZ) -> `Quaternion` (half-angle sin/cos) -> `Matrix4.compose`.
7. **Export preparation.** Grid UVs, then `fixBladeWinding` (swap index slots 1 and 2 of
   the broad-face triangles, recompute normals as in step 4, recompute tangents), then the
   monument TRS (`monumentTransform`).

Transcendental functions: V8's `Math.sin/cos/tan/atan2/exp/log` are fdlibm ports (V8's
`ieee754` namespace). The Rust `libm` crate is also fdlibm-derived and is the best starting
point. Check against the fixtures, and transcribe V8's code wherever a hash differs.
`sqrt`, `floor`, `+ - * /` are exact everywhere.

## Monument families (SW10)

A planet sword picks a **blade family**, a **guard**, a **pommel** and a **grip** from a tuning
table, by planet traits, and reshapes a base sword (the engine's own design) with that
family's recipe. Everything lives in `src/three/sword/monument/`:

| File | What |
|---|---|
| `catalogue.json` | the owner's tuning table: trait ramps, and per entry a base weight, trait affinities and pairings |
| `design.ts` | `PlanetTraits`, `monumentSeed`, `traitStrengths`, `entryWeights`, `pickMonument`, `designMonument` (wrappers over bladegen-core `families.rs`, where the recipes are) |
| `guards.ts` | guard styles `recurve`, `crescent`, `halo`, `wings`, `talon`, `ziggurat` (`guard.monument` block; geometry: bladegen-core `monument.rs`) |
| `pommels.ts` | pommel styles `gem`, `sunwheel`, `horned`, `tiered` (geometry: bladegen-core `monument.rs`) |

The stroke kernel (swept strokes, rings, mirroring, merging; `strokes.ts` before BG1) is bladegen-core's
`monument.rs`.

Catalogue entries: blades `classic` (the base blade, untouched), `greatsword`, `leaf`,
`flamberge`, `falchion`, `cleaver`, `stepped`, `shard`, `serpent`; guards `forged` (the base's
forged cross, untouched) and the six styles above; pommels `native` (the base pommel) and the
four styles above; grips `native`, `ridged`, `smooth`, `wound`, `banded`.

### Selection (port contract)

1. **Seed:** `monumentSeed(systemSeed, planetId)` = `hashSeed("sword-family|" + systemSeed + "|" +
   planetId)` (FNV-1a over UTF-16 units, as `rng.ts`), with the system seed as its u64 decimal
   string.
2. **Strengths:** for each catalogue trait in order: `ramp` = `min(1, max(0, (x - from) / (to -
   from)))`; `flag` = 1 when the input is true (or non-zero); `archetype` = 1 when listed; then 0
   when its `gate` input is false. Booleans read as 1/0, missing numbers as 0.
3. **Weights:** `w = weight`; for each `[trait, m]` of `affinity` in order `w = w * (1 + (m - 1) *
   s)`; for each `[id, m]` of `pairs` in order, `w = w * m` when `id` was picked earlier.
4. **Picks:** one PRNG `createRng(seed)`; blade, guard, pommel, grip in that order, one `next()`
   each: `total` = the sum of the weights in order, `r = next() * total`; if `total` is not > 0
   the first entry; else the first entry with `r < w` (`r -= w` after each), else the last entry
   with `w > 0`.
5. **Recipes:** each stage draws from its own PRNG `createRng("<seed>|blade")`, `|guard`,
   `|pommel`, `|grip` (the u32 seed in decimal, so the string is hashed), in statement order,
   and every drawn continuous value goes through `q3`. The blade recipe first "straightens" the
   base (family `straight`, no waviness, curvature 0, double edge, symmetric thickness); for any
   family but `classic` the glow's `runeStart` becomes `q3(ricassoLength + 0.06)`. The guard
   span scales by the blade's new/old base width and then (monument styles) by a drawn factor;
   `forged` with an unchanged base width keeps the base guard byte for byte. Picks forced by the
   caller (`designMonument(..., force)`) replace the picks after the draws.
6. **Identity:** a sword that picks `classic` / `forged` / `native` / `native` is the base sword.

### Monument strokes (port contract)

Every monument guard and pommel is a list of parts merged in order into one indexed
`BufferGeometry` (position, uv), with one `computeVertexNormals` at the end. A part is:

- **Stroke** (`strokePart`): a closed tube along a planar centre line in XY. Stations along
  length `L` (`u = s / L`), section scale `f(u)`: `taper` law `mix(1, taper, belly ? u*u : u)`;
  `gem` law `u < waist ? mix(top, 1, u / waist) : mix(1, taper, (u - waist) / (1 - waist))`.
  - tips `flat` / `point`: `S + 1` rings at `s = L * i / S`;
  - tip `knob`: `rTip = max(hy, hz) * f(1)`, `rk = min(rTip * (1 + knob), 0.45 * L)`,
    `tk = L - rk`, `t0 = tk - rk`; `S + 1` rings at `s = t0 * i / S`, then 9 rings at
    `s = tk - rk * cos(pi * j / 10)`, `j = 1..9`, sized `max(h * f(s / L), rk * sin)` for
    `2j <= 10`, then `max(h * f(tk / L), rk) * sin`;
  - the end apex at `s = L` (flat), `tk + rk` (knob) or `L + 3 * max(hy, hz) * f(1)` (point);
  - the centre line `theta(s) = heading + turn * u + bend * u * u`, integrated from `(x, y)`
    over every station and the apex with 4 midpoint sub-steps per interval
    (`x = x + cos(th) * sub; y = y + sin(th) * sub`);
  - ring vertex `k`: `n = (-sin theta, cos theta)`, `a = hy_i * secA[k]`,
    `(cx + n.x * a, cy + n.y * a, z + hz_i * secB[k])`, `radial + 1` per ring, uv
    `(ring / (rings - 1), k / radial)`; the apexes have uv `(0, 0.5)` and `(1, 0.5)`;
  - vertex order: start apex, rings, end apex; triangles: start fan `(r0[k+1], r0[k], apex0)`,
    tube `(a, c, b), (b, c, d)` as the forged cross, end fan `(rN[k], rN[k+1], apexN)`.
- **Ring** (`ringPart`): `segments + 1` rings at angle `2 pi (r mod segments) / segments` around
  `(cx, cy)`, in-plane normal `(-cos, -sin)`, constant section; tube triangles only.
- **Mirror** (`mirrorPart`): `x = -x`, triangles `(i, j, k) -> (i, k, j)`. Each right-hand
  stroke is followed by its mirror.
- **Section** (`sectionOutline`): as the forged cross (`section` -1 square .. 0 round .. 1 diamond).

Each style's parts, sizes and order are listed at the top of `guards.ts` and `pommels.ts`
(e.g. `halo`: block; ring of radius `max(ring * half, 1.3 * bl)`; bars; `count` rays per side at
`1.05 * (2 (i + 0.5) / count - 1)` radians). Guards sit like the forged cross (`(0, guardLine -
hy0, 0)`, `rotation.z = tilt`); monument pommels at `(offsetX, gripBottom + 0.04 * se + offsetY,
0)`, where `gripBottom` is the grip's `Box3.setFromObject` minimum and `se` the usual pommel
`sizeEff`.

### Corpus

```sh
npm run monument-corpus -- --out <dir> [--designs <designs.json>] [--seeds 48] [--glb]
```

`picks.json` holds the pick table (12 trait profiles x `--seeds` seeds on the giant `monument`
preset: strengths, every stage's weights, picks and the designed params); each mesh case
(every guard twice, every pommel twice, every blade family, every grip, plus `--designs`)
has `<id>.case.json` (inputs and the designed params), `<id>.validated.json` and the SW1 mesh
dump. A port matches the pick table by JSON equality and the meshes as the SW1 fixtures.
