# BladeGen Roadmap (Phase 8+)

Reference specs: see `VISION.md` (goals), `uxplan.md` (in‑app help), and `KNOBS.md` (controls/parameters).

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

### Code review follow‑ups

- [ ] Controls module refactor — split `src/components/controls.ts` into smaller modules: `registry`, `modelPanel`, `presets`, `exportImport`, and `renderPanel` (reduce scope and ease testing).
  - [x] Extracted `ControlRegistry` to `src/components/ControlRegistry.ts`.
  - [x] Extracted preset builders to `src/components/presets.ts`.
  - [x] Moved full preset list (materials/variants) to `src/components/presets.ts` and wired in.
  - [x] Extract export/import helpers to `src/components/exporters.ts` and wire in.
  - [x] Extract Looks/Variants panel to `src/components/looksPanel.ts` and wire in.
  - [ ] Extract Model panel (Blade/Guard/Handle/Pommel/Accessories) to `src/components/modelPanel.ts`.
  - [ ] Consider further splitting panels once stable.
- [x] Add ESLint/Prettier configs and scripts; wire a CI lint step.
- [x] Remove TypeScript suppressions by using typed dynamic imports:
  - [x] Replace `@ts-ignore` around JSON import in `src/components/help/HelpRegistry.ts`.
  - [x] Replace `@ts-ignore` around Ajv import in `src/components/controls.ts`.
- [x] Remove unused imports/variables to reduce noise:
  - [x] `buildGuardHalfShape` import and unused guard placement variables in `src/three/SwordGenerator.ts`.
  - [x] `_fpsAccum` in `src/main.ts`.
  - [x] Unused `Material` type import in `src/three/sword/materials.ts`.
- [x] Improve `TextureCache` placeholder: use a 1×1 neutral `DataTexture` and set color space to avoid black flashes before load.

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

## UX — In‑App Help & Docs

Context: implement contextual help as described in uxplan.md. Ship in phases with minimal UI disruption and clear a11y.

### Decisions (pick before Phase 1)

- [x] Tooltip/Popover: custom lightweight micro-tooltips and popovers; native Popover used when available.
- [x] Search: custom build-time index (`scripts/build-help-index.mjs`) + runtime filter with simple synonyms; defer MiniSearch/Lunr to future if needed.
- [x] Guided tours: use Driver.js (MIT). Load on demand from CDN; keep fallback lightweight tour for offline/dev.
  - [x] Loader hardening: prefer local vendored Driver.js (`/vendor/driver.min.js` + CSS) with CDN fallback; add integrity attributes when using CDN. (Integrity still TODO if vendoring with hash.)

### Phase 1 — Tooltips & Popovers

- [x] Introduce HelpRegistry (in‑memory map `helpId → doc`) in `src/ui/help/` with `getDoc(id)`, `getSummary(id)`, `preload()`.
- [x] Define doc front‑matter schema: `id`, `label`, `summary`, `details[]`, `parts[]`, `dependsOn[]`, `affects[]`, `related[]`, `warnings[]`, `tryThis[]` (authoring under `docs/help/controls/`).
- [x] Author starter docs for 10–15 top controls (Blade length/width/curvature/fullers, Guard width/tilt, Handle wrap, Pommel shape). (Seeded 25+ topics.)
- [x] Replace `title` attributes with micro‑tooltips (hover/focus) using chosen tech; 120‑char max, no jargon.
- [x] Add `?` icon click to open rich popover: details bullets (≤6), related links, and “Try this” micro‑demo placeholder.
- [x] Wire 3D highlight: on popover open/hover call `sword.setHighlight(parts)`; clear on close.
- [x] A11y: tooltip and popover roles, `Esc` to dismiss, restore focus to trigger, keyboard access from labels. (Plus visible focus row flash.)
- [x] Fallback: if `helpId` missing, show plain `title` tooltip (non‑blocking). (Also auto-add `?` icon when a doc exists.)

### Phase 2 — Help Panel & Search

- [x] Add `HelpPanel` (right slide‑out) toggled by header Help button and `Cmd/Ctrl+/`; render doc with summary/details and “Related” chips.
- [x] Build docs index at build time; index id/title/summary/text to `public/help-index.json`; search uses it when available.
- [x] Add command‑palette overlay (`Cmd/Ctrl+K`) for global search; arrow‑key nav; `Enter` opens doc and flashes the target control.
- [x] Highlight query matches in results and in the panel body (inline span highlight).
- [x] Deep links: support `#help=<helpId>` to open directly to a topic (and on hashchange).
- [x] Synonyms: basic aliases (rib/blood groove → fuller) in search.

### Phase 3 — Explain Mode (3D‑first)

- [x] Add Explain toggle (UI + hotkey `E`).
- [x] Add labels overlay anchored to parts (“Blade”, “Guard”, “Handle”, “Pommel”, “Fuller”); clicking opens Help Panel.
- [x] Tag scene graph with sub‑parts (anchors under `group.__subparts`) for precise labels/highlights.

- ### Phase 4 — Guided Tours / Task Walkthroughs
- [x] Implement short, skippable first‑run tour (prompt with optional auto‑start and “Don’t show again”).
- [x] Add “Replay Intro” in Help (Start Intro Tour button on Help index). Uses Driver.js with fallback.
- [x] Add task guide: Add a fuller (Driver.js) launched from Help.
- [ ] Add remaining task guides (Make a leaf blade; Export to STL).

### Authoring & Governance

- [x] Doc lint script: validate required fields; enforce length limits (summary ≤120 chars; popover ≤6 bullets).
- [x] Authoring guide in `docs/help/README.md` (tone, bullets, relations, images policy, i18n key).

### Accessibility & Interaction

- [x] Tooltips: delay on hover; show on focus; dismiss on `Esc`/pointer out; don’t block arrow keys reaching inputs (WAI‑ARIA APG).
- [x] Popovers: non‑modal for info; restore focus to trigger; focus trap only when interactive.
- [x] Feature‑detect Native Popover API; use when available; otherwise custom popover.
- [x] Explain labels: keyboard reachable; don’t interfere with OrbitControls when not hovered.

### Analytics & Quality Loop

- [x] Instrument events: `help.tooltip_shown`, `help.popover_opened`, `help.panel_opened`, `help.search_query`, `help.search_result_opened`.
- [x] Collect “no‑result” searches and most‑opened topics; show insights + reset in Help index (dev).

### Performance & Packaging

- [x] Pre‑bundle MD → JSON at build time.
- [x] Lazy‑load HelpPanel CSS/JS on first open.
- [ ] Tree‑shake/lazy‑load optional libs (Floating UI/Tippy.js, mark.js, Shepherd/Driver, MiniSearch/Lunr).
- [x] Limit CSS2D labels; render only in Explain Mode; detach overlay on exit.

### Wiring & Integration

- [x] Controls pass `helpId` (read `row.dataset.field`); register micro‑tooltips/popover triggers during `registerControl()`.
- [x] Expose API to open HelpPanel programmatically by `helpId`.
- [x] URL hash handler for `#help=<helpId>` deep‑linking.

### Milestones (exit criteria)

- [x] Phase 1: micro‑tooltips and popovers for the top 15 controls; 3D highlight works; a11y and fallback verified.
- [x] Phase 2: HelpPanel + search + deep‑links + synonyms; keyboard flow validated.
- [ ] Phase 3: Explain labels on ≥5 key parts; open correct topics; performance acceptable.
- [ ] Phase 4: First‑run tour and ≥2 task guides; replayable from Help.

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
- [x] Add Vitest coverage thresholds (gated on CI) targeting ≥80% for core geometry/validation.

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

---

## Cleanup / Refactor (FX & UI)

- Replace renderer.\_dprCap usage with a proper API
  - Add `getDPRCap()` to `RenderHooks` and have `main.ts` read from it.
  - Keep `setDPRCap()` as the single setter; avoid reaching into renderer internals.
- Centralize hex color parsing
  - Standardize a small `hexToInt(hex: string): number` helper and use it consistently across controls to avoid repeated inline conversions.
- Extract quality/AA presets into a config module
  - Move `QUALITY_PRESETS` and the render baseline into a typed module for reuse and unit testing.
- Consider splitting the monolithic `controls.ts`
  - Break into smaller modules: `registry`, `renderPanel`, `modelPanel`, `presets`, `exportImport`.
- EnvMap PMREM lifecycle review
  - Current env flow disposes the source textures and PMREM generator; consider explicit disposal of the PMREM render target if memory growth appears when flipping environments frequently.
- Anisotropy guards for non‑blade parts (optional)
  - If artifacts appear on guard/pommel on some GPUs, extend the guard used for the blade, or synthesize tangents for those meshes where feasible.
- Stronger typing for material patches
  - Replace `any` in `setPartMaterial` patch parameter with a `MaterialPatch` type to catch typos and ensure compile‑time safety.
- Documentation updates
  - Note blade tangent generation (enables anisotropy), Auto Spin persistence (`bladegen.autoSpinEnabled`), and Reset Render baseline.

## Tests to Add

- Unit: Anisotropy guard behavior
  - Verify anisotropy keys are stripped for the blade when tangents are missing; preserved when present.
- Unit: Tangent synthesis on blade geometry
  - Ensure `tangent` attribute exists, normalized, and orthogonal to normals.
- Unit: Env intensity scaling
  - Confirm `setEnvIntensity` scales from a stored base and is idempotent.
- Unit: Material highlight store/restore
  - Ensure emissive color/intensity are stored and restored properly.
- Unit: Reset render idempotence
  - Calling reset twice yields the same state (mock RenderHooks setters).
- E2E: Preset keeps blade colorful (no B/W)
  - Selecting Katana/Arming preserves blade anisotropy with tangents present; no harsh B/W blade.
- E2E: Auto Spin persistence across reloads
  - Toolbar Auto Spin persists via localStorage.
- E2E: Reset Render baseline
  - After tweaks, “Reset Render” returns to defaults (FXAA, fog density, etc.).
  - E2E: Quality preset propagation
  - Quality dropdown updates AA mode and DPR cap accordingly.

- Unit: Export tools (GLB/OBJ/STL/SVG)
  - GLB: validate non-empty buffer and presence of expected nodes; include `KHR_materials_variants` mapping when used.
  - OBJ/STL: verify mesh vertex/face counts are consistent across runs for fixed params.
  - SVG blueprint: ensure valid SVG root and expected path count for the blade outline.
  - Error paths: exporting without meshes or with invalid params yields typed errors (no crashes).

---

## Render Mode — Pixel Art

Goal: Add an optional “Pixel Art” render mode that preserves crisp pixel edges at low internal resolution with optional color posterization, without affecting the default rendering.

Steps

- Define a render mode toggle in RenderHooks
  - Add `setRenderMode('standard'|'pixelArt')` and `getRenderMode()`; default to `standard`.
  - When `pixelArt` is enabled, apply policy switches (AA off, bloom/heat off, cap DPR to 1); restore previous values when returning to `standard`.
- Add Pixelate/Posterize pass
  - Implement a ShaderPass that samples from a snapped pixel grid and optional per‑channel posterize.
  - Insert after tone mapping and before optional outlines in the composer.
- UI controls in Render tab
  - Add “Render Mode: Standard | Pixel Art”. Show Pixel Art sub‑controls only when active: `Pixel Size` (1–12), `Posterize Levels` (Off/3–8).
  - Help micro‑copy for mode and each control.
- Mode policy and interactions
  - Disable FXAA/SMAA/MSAA, set DPR cap to 1, force nearest‑neighbor upscale.
  - Disable selective bloom and heat haze; keep ink outline available.
  - Snap ink outline thickness to pixel size to avoid shimmer.
- Docs
  - Add help topics: `render.pixel-art-mode`, `render.pixel-size`, `render.posterize`.
  - README notes on Pixel Art mode and when to use it.
- Tests
  - E2E: toggling Pixel Art flips AA/FX flags and updates composer pass enablement.
  - E2E: pixel size slider changes a uniform; posterize levels affect rendered colors (coarse assertion).
