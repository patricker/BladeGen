# Headless bladegen: CLI, seeded swords, glow channel and conformance fixtures

Everything here runs under Node with no DOM and is not part of the website bundle.
The site's default behaviour is unchanged: the new features are opt-in (`blade.glow`,
`giantPresets`, the headless export path).

Node: the scripts run through `vite-node` (already a dev dependency through Vitest), so
they work on any Node the test suite runs on (checked on Node 20.15; the site still asks
for Node 24).

## CLI

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
