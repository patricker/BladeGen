//! bladegen's sword geometry, in Rust: the one implementation behind the bladegen web app (through `bladegen-wasm`)
//! and the galaxy kit's planet swords (a path dependency, `Native/worldgen/src/sword/`).
//!
//! History: written as a 1:1 port of bladegen's TypeScript for the kit (SW2: `sword/planet-swords` f6f3e54; SW7:
//! the forged cross of `sword/monument-guard` f6b5ec8; SW11: the monument families of `sword/monument-variety`
//! 38daabe) and kept bit-exact with it by the SW1/SW2/SW7/SW10/SW11 conformance corpora; moved here in BG1, when the
//! TypeScript it duplicated was retired. Every computation keeps bladegen's operation order in f64, stores f32 where
//! three.js stores a `Float32Array`, and calls `libm` for transcendentals, so the bytes are the same on every
//! platform (x86_64, arm64, wasm32).
//!
//! - [`params`]: the validated `SwordParams` subset (bladegen's camelCase names; serde).
//! - [`blade`], [`glow`]: the blade, its tangents, grid UVs, glow mask and glow mesh; the PRNG.
//! - [`hilt`], [`monument`]: guards (bar, forged cross, six monument styles), quillons, the lathe grip and wire wrap,
//!   pommels (orb, disk, wheel, spike, crown, ring and four monument styles).
//! - [`families`]: the planet-sword catalogue families (`src/three/sword/monument/catalogue.json`).
//! - [`model`]: the whole sword in bladegen's mesh order, the export preparation and the monument transform.
//! - [`geom`]: three r180's primitives and maths, ported 1:1.
//!
//! Not here (bladegen keeps them in TypeScript; nothing duplicates them): extruded, tube and shell guards, tube grip
//! wraps, octahedron and fishtail pommels, fuller and hamon overlays, engravings, scabbard, tassel, the randomizer and
//! validation. [`model::build_parts`] names any such part it skips.
pub mod blade;
pub mod fault;
pub mod families;
pub mod geom;
pub mod glow;
pub mod hilt;
pub mod keel;
pub mod model;
pub mod monument;
pub mod params;
pub mod shear;
mod solid;

/// The crate's version, for consumers that record what built their geometry.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
