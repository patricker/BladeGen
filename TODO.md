# SwordMaker Roadmap (Phase 8+)

Reference specs: see newfeatures.md (Phase 8) and new2features.md (extended knobs and UX).

## Near‑Term Priorities
- Distal taper + dynamics readouts: thicknessProfile along blade; compute PoB, CoP, inertia; show in UI/export.
- Guard↔blade smooth fillet: replace box bridge with a small shaped profile.
- Edge/tip taxonomy: ricasso and false edge (implemented); tip families expanded (clip, tanto, spear, sheepsfoot) with asymmetric shaping; further refinement pending.
- Render polish: MSAA (WebGL2), contact shadow plane, composer toggle, mobile heuristics, global envMapIntensity hook.

## Architecture & Code Health
- [x] Split `src/three/setupScene.ts` into renderer/bootstrap, lighting, post, and FX modules; return a typed context instead of `any`/`scene.__renderHooks` so `src/main.ts` can import explicit hooks.
- [x] Introduce parameter diffing in `SwordGenerator.updateGeometry` so guard/handle/pommel/accessories only rebuild when their inputs change; reuse existing meshes to reduce GC churn.
- [x] Replace the JSON deep-clone in `resolveDerivedParams` with a typed normaliser that preserves texture/material references and shared objects.
- [x] Extract a render-material service so highlight/emissive toggles and material patching live outside the generator class (fewer side effects, easier testing).

## Geometry & Dynamics
- [x] Distal taper thicknessProfile (Bezier/points) varying Z thickness along Y.
- [x] Derived metrics: PoB (cmY), CoP, polar moment; expose in UI (readout).
- [x] Blade families: wavy/flamberge; kris with odd wave counts.
- [x] Cross‑section upgrades: hollow grind (radius/depth), compound grinds; triangular and T‑spine.
- [x] Fuller v2: per‑face array with width/offsetFromSpine/taper (1–3 per side).

## Guard & Hilt
- [ ] Shell guards (simple lathed/extruded shells).
- [ ] Langets along blade flats (length, thickness).
- [ ] Asymmetry beyond scale (shape/profile bias per side).
- [x] Advanced guard↔blade fillet (smooth profile).

## Handle & Grip
- [x] Wrap style presets: hineri‑maki, katate‑maki, wire wrap.
- [ ] Rayskin (samegawa) visual layer (procedural/texture; density/scale).
- [ ] Menuki presets/placement helpers (left/right arrays with common positions).

## Pommel & Assembly
- [ ] Additional variants: fishtail.
- [ ] Peen visible / peen block visuals.

## Materials & Export
- [ ] glTF KHR_materials_variants and a simple Look switcher in UI.
- [ ] Anisotropy direction UI and helper maps (beyond current fake direction).
 - [ ] Damascus blade look: procedural or texture‑driven maps; expose as a blade material preset.

## Accessories
- [x] Scabbard generator (throat/locket/chape) matching blade profile + sword knot/tassel; simple rope curve with idle.

## UX
- [ ] Archetype‑first start screen (family presets grid).
- [ ] Goal sliders (Cut↔Thrust, Agility↔Authority, Elegant↔Brutal) driving grouped knobs.
- [ ] Progressive disclosure polish for advanced controls.

## Render & Performance
- [x] MSAA path for WebGL2 (fallback to FXAA/SMAA; UI toggle).
- [ ] Contact shadow plane option.
- [x] Toggle composer vs direct render for perf fallback.
- [ ] Mobile heuristics: auto‑disable bloom/outline; lower DPR/shadow size.
- [ ] Dispose/GC of composers/passes/materials on toggles.
- [ ] Animated shimmer (time uniform) for gradient/wear (optional).
- [x] Wire up global envMapIntensity in UI; persist in JSON.

## Schema & Versioning
- [ ] Schema v2 bump; add new fields as optional with safe defaults and clamps.
- [ ] Extend Ajv tests to cover new fields and defaulting; keep `SwordParams` and `schema/sword.schema.json` in sync.

## QA, Demos & Docs
- [ ] Visual QA checklist and screenshot gallery (consistent lighting).
- [ ] Blender import parity (sRGB/linear, exposure/shadows check).
- [ ] Landing page presets and images; publish to Pages.
- [x] e2e sanity flow: load preset → tweak → export GLB/OBJ/SVG.
- [x] Expand Playwright coverage: drive render toggles (AA, bloom).
- [x] Expand Playwright coverage: export flows (GLB/OBJ/SVG).
- [x] Expand Playwright coverage: JSON import/export error paths.
- [x] Add unit tests around accessories (scabbard/tassel anchor sampling) and render hook mutations to prevent regressions.
- [x] Validate schema vs `SwordParams` with a generated fixture per guard/handle/pommel style so Ajv tests cover more combinations.

---

## Completed Highlights (concise)
- Materials system with presets and texture slots; emissive/transmission/iridescence/sheen.
- Blade: carved fullers or overlay; serration patterns; engravings (text/decals) with alignment and letter spacing.
- Guard: basket/knucklebow/swept; extras (side rings, loops, finger guard); simple fillet.
- Handle: ovalization and curvature; layers (wrap/crisscross/ring/inlay); menuki/rivets; handleGroup.
- Pommel: orb/disk/spike plus wheel, scent‑stopper, ring, crown.
- Ratios: guard/handle/pommel auto‑sizing from blade length.
- Render: tone mapping selector; environment loader + presets; gradient/wear overlay; FXAA/SMAA; bloom/outline/ink/fresnel/vignette.
- Exports: GLB/OBJ/STL + SVG blueprint.
- Tests: 40+ geometry/schema tests; Ajv 2020 validation.
- CI: GitHub Pages workflow configured.

## Deployment
- [x] GitHub Pages CI workflow configured
- [x] Enable Pages for the repo and verify Vite base path
- [ ] Optional: Vercel/Netlify one‑click deploy
- [ ] Landing presets and images on homepage

## Sword Archetypes & Presets
- [ ] Ship “Arming Sword” + “Hand-and-a-half” presets (double-edge, straight guard) leveraging existing blade/guard options.
- [ ] Add “Katana / Uchigatana” presets demonstrating curvature, hamon, wrap, rayskin once wrap styles land.
- [ ] Add “Rapier / Swept-hilt” preset using narrow diamond cross-section and basket/swept guard styles.
- [x] Document what’s blocking greatsword/Zweihänder presets (needs side rings/parrying lugs, extended ricasso support) and plan required knobs.
- [x] Outline fantasy variants we’re close to (flamberge with `waviness`, rune-etched blade using engravings) vs. ones blocked by tech (energy blades, segmented whips) in docs.
