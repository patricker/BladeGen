# Phase 1: Foundations & Setup

### 1. Project Setup

* [x] Initialize project with Vite/Webpack (or Create React App if using React).
* [x] Install dependencies:

  * `three` (core library).
  * `@react-three/fiber` & `@react-three/drei` (if React-based).
  * `dat.GUI` or a modern UI lib for sliders (or custom UI components).
  * `three/examples/jsm/exporters/GLTFExporter`.
* [x] Set up project structure:

  * `/src/components` – UI panels, sliders, presets.
  * `/src/three` – sword generator classes, geometry builders.
  * `/src/utils` – export helpers, presets definitions.
* [x] Configure bundler to support GLTF export and static asset hosting.

### 2. Three.js Scene Setup

* [x] Create scene with:

  * PerspectiveCamera (FOV \~45–60).
  * OrbitControls for interaction.
  * Lights: ambient + 1–2 directional lights.
  * Neutral background (flat color or subtle gradient).
* [x] Add test geometry to verify rendering loop.

---

# Phase 2: Core Sword Generator

### 3. Sword Group Architecture

* [x] Define `SwordGenerator` class:

  * Holds `THREE.Group`.
  * Sub-components: `bladeMesh`, `guardMesh`, `handleMesh`, `pommelMesh`.
* [x] Add `updateGeometry(params)` method.
* [x] Implement parameter validation (min > 0, etc.).

### 4. Blade Geometry

* [x] Build via `THREE.ExtrudeGeometry` of a 2D shape.
* [x] Parameters:

  * [x] `length`, `baseWidth`, `tipWidth`, `thickness`.
  * [x] `curvature` (implemented via bend deformation).
  * [x] `fullerDepth`, `fullerLength` (visual overlay grooves).
  * [x] `serration` amplitude & frequency.
* [x] Implement rebuild vs scale optimization.

### 5. Guard Geometry

* [x] Start with stretched box, then upgrade to extruded shape.
* [x] Parameters:

  * [x] `width`, `thickness`, `curve`, `tilt`, `style`.
* [x] Add symmetry logic (mirror halves).
* [x] Add style presets (bar, winged, claw).

### 6. Handle Geometry

* [x] Use `THREE.LatheGeometry` with profile curve.
* [x] Parameters:

  * [x] `length`, `radiusTop`, `radiusBottom`.
  * [x] `segmentation` (wrap ridges toggle).
* [x] Optional wrap texture (procedural stripes).

### 7. Pommel Geometry

* [x] Use primitive + scaling:

  * Sphere, cylinder, cone (based on style params).
* [x] Parameters:

  * [x] `size`, `elongation`, `shapeMorph`.
* [x] Map style presets (disk, orb, spike).

---

# Phase 3: UI & Parameter Controls

### 8. UI Framework & Layout

* [x] Implement sidebar with categories (Blade, Guard, Handle, Pommel, Other).
* [x] Collapsible/sectioned layout for clarity.
* [x] Add sliders with labels + numeric inputs.
* [x] Add tooltips for advanced params.

### 9. Parameter Mapping

* [x] Connect UI sliders to state object.
* [x] On change → trigger `SwordGenerator.updateGeometry(params)`.
* [x] Ensure immediate visual feedback (<100ms).

### 10. Presets System

* [x] Define JSON objects for presets (Katana, Claymore, Rapier, Demon Blade).
* [x] Add UI dropdown or buttons for presets.
* [x] On select → load preset values into state & update sword.
* [x] Add “Save Custom Preset” (store in localStorage).

### 11. Randomizer

* [x] Button: randomize params within ranges.
* [x] Modes: full-range vs constrained realistic.
* [x] Optional “shuffle only this category”.

---

# Phase 4: Advanced Features

### 12. Fantasy Enhancements

* [x] Add “chaos” param: jagged/noisy blade edges.
* [x] Add “symmetry toggle”: asymmetrical designs.
* [x] Add “stylization slider”: realistic ↔ exaggerated scaling.
* [ ] Add decorative noise/displacement.

### 12b. KNOBS.md Coverage — New TODOs

- Blade
  - [x] Twist angle (spiral/twisted blades)
  - [x] Tip shape control (pointed ↔ rounded ↔ leaf)
  - [x] Cross‑section profile (diamond ↔ lenticular ↔ hexagonal)
  - [x] Edge bevel angle (sharp vs thick edge)
  - [x] Double‑edge toggle (single/double edged rendering)
  - [x] Number of fullers (1–3) and layout
  - [x] Dedicated taper ratio knob (alt to base/tip widths)
  - [x] Serration per side (independent L/R; one‑sided)
  - [x] Thickness per side (edge thickness per edge)
  - [x] Edge type: single vs double‑edged (with dull‑side thickness control)
  - [x] Sori profile type (koshi/torii/saki) — curvature distribution along length
  - [x] Kissaki parameters (length, shape) + Yokote line
  - [x] Hamon visual (material/shader pattern)
  - [x] Base angle (blade departure angle at handle)

- Guard / Crosspiece
  - [x] Guard height (vertical offset/clearance)
  - [x] Quillons: count and length
  - [x] Ornamentation complexity (flat ↔ ornate)
  - [x] Guard tip style as continuous control
  - [x] Asymmetry toggle for guard arms
  - [x] Tsuba/disk guard details (slot, optional cutouts)
  - [x] Habaki collar (blade collar at guard)

- Handle / Grip
  - [x] Segmentation count (rings/bands)
  - [x] Grip flare at pommel
  - [x] Handle curvature (straight ↔ slightly bent)
  - [x] Tang visibility (hidden ↔ full tang)
  - [x] Oval handle cross-section (katana tsuka shape)

- Pommel
  - [x] Offset (centered ↔ angled)
  - [x] Facet count (gem‑like)
  - [x] Balance weight ratio (vs blade mass)
  - [x] Spike length (when applicable)

### 13. Validation & Feedback

* [x] Implement soft warnings for extreme ratios (e.g. guard >> blade).
* [x] Non-blocking indicators (icon + tooltip).
* [x] Ensure geometry doesn’t break on extremes (clamps + rebuild path).

---

# Phase 5: Export & Integration

### 14. GLTF Export

* [x] Integrate `GLTFExporter`.
* [x] Export entire `SwordGenerator.group` as `.glb`.
* [x] Trigger download via Blob.
* [ ] Test import into Blender (verify scale & orientation).

### 15. Additional Exports (optional)

* [x] Add `.OBJ` or `.STL` export for flexibility.
* [x] Add 2D blueprint export (SVG outline).

---

# Phase 6: Polish & Delivery

### 16. UX Enhancements

* [x] Add highlight (e.g. outline effect) when user selects a category (Blade panel highlights blade mesh).
* [ ] Smooth transitions when updating geometry (optional).
* [ ] Style UI (dark theme, fantasy aesthetic).

### 17. Performance Optimization

* [x] Profile geometry rebuilds – debounce expensive ones. (UI updates rAF-debounced)
* [x] Limit vertex counts (low-poly vs high-poly toggle). (Blade Detail)
* [x] Dispose unused geometries/materials to free memory.

### 18. Documentation

* [x] Write developer docs: parameter definitions, code structure.
* [x] Write user guide: how to use presets, randomizer, export.

### 19. Deployment

* [ ] Deploy static site (Vercel/Netlify).
* [ ] Provide example presets on landing page.
* [ ] Add demo swords (images/screenshots).

---

✅ **End Goal**: A fully functional web app where users can design swords by adjusting 30–50 parameters, instantly preview them in 3D, load presets or randomize, push designs to extremes, and export to Blender via GLTF.

---

# Phase 7: Rendering Quality & Effects

This phase focuses on visual fidelity and performance, guided by renderguidance.md. Goals: physically‑based lighting/materials, robust post‑processing, crisp edges, pleasant defaults on desktop/mobile, and a future “Render” tab to expose controls.

## 20. Renderer & Color Management

* [ ] Switch to physical pipeline defaults
  * [x] `renderer.outputColorSpace = SRGBColorSpace`
  * [x] `renderer.toneMapping = ACESFilmicToneMapping`
  * [x] `renderer.toneMappingExposure` knob (UI) with sane default (≈1.0–1.2)
* [x] Use `renderer.physicallyCorrectLights = true`
* [x] Device pixel ratio cap (2.0 desktop)
  * [x] Mobile DPR cap (≈1.5) via Quality preset
* [ ] AA strategy
  * [x] FXAA (baseline) via composer
  * [x] SMAA option (optional; asset textures required)
  * [ ] MSAA for WebGL2 (fallback to FXAA when not available)

## 21. Lighting & Environment

* [x] Key/fill/rim setup with physically meaningful intensities
  * [x] Directional key (cast shadows, rotatable via knob)
  * [x] Soft fill (hemisphere/ambient)
  * [x] Optional rim light (color/intensity knobs)
* [ ] Environment lighting
  * [x] `RoomEnvironment` + PMREM for default IBL; `scene.environment` set
  * [ ] Env intensity knob per material or global
  * [ ] Optional HDR equirect support (drop‑in URL)

## 22. Shadows

* [ ] Enable soft shadows
  * [x] `renderer.shadowMap.enabled = true`, `PCFSoftShadowMap`
  * [x] Proper shadow mapSize tuning
  * [x] Bias knob (normalBias pending)
* [ ] Ensure sword meshes cast/receive appropriately
  * [x] Blade/guard/handle/pommel cast on
  * [x] Ground receive only
  * [x] Overlay ribbons (fullers/hamon) do not cast (avoid artifacts)
* [ ] Optional “contact shadow” plane (cheap shadow matte)

## 23. Materials: PBR and Procedural

* [ ] Material presets per part
  * [ ] Blade: MeshPhysicalMaterial base (metalness/roughness/clearcoat)
  * [ ] Guard: metal presets (iron/bronze/brass) with tinted specular
  * [ ] Handle: leather/wood wrap (dielectric, high roughness)
  * [ ] Pommel: matches guard with variation
* [ ] Procedural bump/noise (Technique 1)
  * [ ] Noise DataTexture generator (seed/scale/intensity)
  * [ ] Hook into bumpMap/normalMap (bumpScale knob)
  * [ ] Per‑part toggles (blade/guard/handle/pommel)
* [ ] Gradient/wear shader overlay (Technique 5)
  * [ ] ShaderMaterial with gradient base→tip, edge fade, optional noise
  * [ ] Time uniform for subtle animated shimmer (optional)
  * [ ] Blend strategy: separate overlay mesh or material onBeforeCompile

## 24. Post‑Processing

* [ ] EffectComposer wiring
  * [x] RenderPass, FXAA baseline
  * [x] Bloom (UnrealBloomPass) with intensity/threshold/radius knobs
  * [x] Outline (OutlinePass) for selection/highlight mode
  * [x] Optional vignette pass knobs
* [x] Resize handling for composer + AA pass uniforms
* [ ] Toggle composer vs direct render for perf fallback

## 25. Edge/Outline Techniques

* [x] Back‑face “ink” outline mesh for cheap silhouette
* [ ] Post OutlinePass for crisp white outline on selection
* [ ] Fresnel/specular edge accent (shader or mat onBeforeCompile)

## 26. Render UI (“Render” Tab)

* [ ] Create Render tab with groups and knobs (see renderguidance.md)
  * [ ] Material Base: base color, metalness, roughness, clearcoat
  * [ ] Gradient/Wear/Noise: edge color, edge fade thickness, noise scale/seed, wear intensity
  * [x] Emission/Glow: bloom toggle/params
  * [x] Outline/Edge: outline toggle/thickness, ink outline; (fresnel pending)
  * [x] Lighting: ambient intensity, key light angle, rim light color/intensity
  * [x] Global: exposure
* [ ] Per‑part material selectors (Blade/Guard/Handle/Pommel)

## 27. Performance & Quality

* [x] Quality presets (Low/Med/High): AA type, shadow map size, DPR cap
* [ ] Mobile heuristics: disable bloom/outline, lower shadow map size, DPR cap
* [ ] Metrics: track frame time; simple FPS readout in dev mode
* [ ] Garbage collection of composers/passes/materials on dispose or toggles

## 28. Validation & Demos

* [ ] Visual QA checklists
  * [ ] No shadow acne or fireflies on blade at extreme angles
  * [ ] Bloom does not wash out metal
  * [ ] Outline correctly respects selection only
  * [ ] Exposure consistent across presets
* [ ] Demo presets gallery screenshots (lighting consistent)
* [ ] Blender import: confirm sRGB/linear and exposure parity

Notes:
- Follow Technique 1/2/3/5 and class abstractions in renderguidance.md; keep rendering concerns in `src/three/**` and expose render params via UI in a separate tab.
- Keep defaults subtle and performant; advanced effects opt‑in.
# Phase 1: Foundations & Setup

### 1. Project Setup

* [x] Initialize project with Vite/Webpack (or Create React App if using React).
* [x] Install dependencies:

  * `three` (core library).
  * `@react-three/fiber` & `@react-three/drei` (if React-based).
  * `dat.GUI` or a modern UI lib for sliders (or custom UI components).
  * `three/examples/jsm/exporters/GLTFExporter`.
* [x] Set up project structure:

  * `/src/components` – UI panels, sliders, presets.
  * `/src/three` – sword generator classes, geometry builders.
  * `/src/utils` – export helpers, presets definitions.
* [x] Configure bundler to support GLTF export and static asset hosting.

### 2. Three.js Scene Setup

* [x] Create scene with:

  * PerspectiveCamera (FOV \~45–60).
  * OrbitControls for interaction.
  * Lights: ambient + 1–2 directional lights.
  * Neutral background (flat color or subtle gradient).
* [x] Add test geometry to verify rendering loop.

---

# Phase 2: Core Sword Generator

### 3. Sword Group Architecture

* [x] Define `SwordGenerator` class:

  * Holds `THREE.Group`.
  * Sub-components: `bladeMesh`, `guardMesh`, `handleMesh`, `pommelMesh`.
* [x] Add `updateGeometry(params)` method.
* [x] Implement parameter validation (min > 0, etc.).

### 4. Blade Geometry

* [x] Build via `THREE.ExtrudeGeometry` of a 2D shape.
* [x] Parameters:

  * [x] `length`, `baseWidth`, `tipWidth`, `thickness`.
  * [x] `curvature` (implemented via bend deformation).
  * [x] `fullerDepth`, `fullerLength` (visual overlay grooves).
  * [x] `serration` amplitude & frequency.
* [x] Implement rebuild vs scale optimization.

### 5. Guard Geometry

* [x] Start with stretched box, then upgrade to extruded shape.
* [x] Parameters:

  * [x] `width`, `thickness`, `curve`, `tilt`, `style`.
* [x] Add symmetry logic (mirror halves).
* [x] Add style presets (bar, winged, claw).

### 6. Handle Geometry

* [x] Use `THREE.LatheGeometry` with profile curve.
* [x] Parameters:

  * [x] `length`, `radiusTop`, `radiusBottom`.
  * [x] `segmentation` (wrap ridges toggle).
* [x] Optional wrap texture (procedural stripes).

### 7. Pommel Geometry

* [x] Use primitive + scaling:

  * Sphere, cylinder, cone (based on style params).
* [x] Parameters:

  * [x] `size`, `elongation`, `shapeMorph`.
* [x] Map style presets (disk, orb, spike).

---

# Phase 3: UI & Parameter Controls

### 8. UI Framework & Layout

* [x] Implement sidebar with categories (Blade, Guard, Handle, Pommel, Other).
* [x] Collapsible/sectioned layout for clarity.
* [x] Add sliders with labels + numeric inputs.
* [x] Add tooltips for advanced params.

### 9. Parameter Mapping

* [x] Connect UI sliders to state object.
* [x] On change → trigger `SwordGenerator.updateGeometry(params)`.
* [x] Ensure immediate visual feedback (<100ms).

### 10. Presets System

* [x] Define JSON objects for presets (Katana, Claymore, Rapier, Demon Blade).
* [x] Add UI dropdown or buttons for presets.
* [x] On select → load preset values into state & update sword.
* [x] Add “Save Custom Preset” (store in localStorage).

### 11. Randomizer

* [x] Button: randomize params within ranges.
* [x] Modes: full-range vs constrained realistic.
* [x] Optional “shuffle only this category”.

---

# Phase 4: Advanced Features

### 12. Fantasy Enhancements

* [x] Add “chaos” param: jagged/noisy blade edges.
* [x] Add “symmetry toggle”: asymmetrical designs.
* [x] Add “stylization slider”: realistic ↔ exaggerated scaling.
* [ ] Add decorative noise/displacement.

### 12b. KNOBS.md Coverage — New TODOs

- Blade
  - [x] Twist angle (spiral/twisted blades)
  - [x] Tip shape control (pointed ↔ rounded ↔ leaf)
  - [ ] Cross‑section profile (diamond ↔ lenticular ↔ hexagonal)
  - [ ] Edge bevel angle (sharp vs thick edge)
  - [x] Double‑edge toggle (single/double edged rendering)
  - [x] Number of fullers (1–3) and layout
  - [x] Dedicated taper ratio knob (alt to base/tip widths)
  - [x] Serration per side (independent L/R; one‑sided)
  - [x] Thickness per side (edge thickness per edge)
  - [x] Edge type: single vs double‑edged (with dull‑side thickness control)
  - [x] Sori profile type (koshi/torii/saki) — curvature distribution along length
  - [x] Kissaki parameters (length, shape) + Yokote line
  - [x] Hamon visual (material/shader pattern)
  - [x] Base angle (blade departure angle at handle)

- Guard / Crosspiece
  - [x] Guard height (vertical offset/clearance)
  - [x] Quillons: count and length
  - [x] Ornamentation complexity (flat ↔ ornate)
  - [x] Guard tip style as continuous control
  - [x] Asymmetry toggle for guard arms
  - [x] Tsuba/disk guard details (slot, optional cutouts)
  - [x] Habaki collar (blade collar at guard)

- Handle / Grip
  - [x] Segmentation count (rings/bands)
  - [x] Grip flare at pommel
  - [x] Handle curvature (straight ↔ slightly bent)
  - [x] Tang visibility (hidden ↔ full tang)
  - [x] Oval handle cross-section (katana tsuka shape)

- Pommel
  - [x] Offset (centered ↔ angled)
  - [x] Facet count (gem‑like)
  - [ ] Balance weight ratio (vs blade mass)
  - [x] Spike length (when applicable)

### 13. Validation & Feedback

* [x] Implement soft warnings for extreme ratios (e.g. guard >> blade).
* [x] Non-blocking indicators (icon + tooltip).
* [x] Ensure geometry doesn’t break on extremes (clamps + rebuild path).

---

# Phase 5: Export & Integration

### 14. GLTF Export

* [x] Integrate `GLTFExporter`.
* [x] Export entire `SwordGenerator.group` as `.glb`.
* [x] Trigger download via Blob.
* [ ] Test import into Blender (verify scale & orientation).

### 15. Additional Exports (optional)

* [x] Add `.OBJ` or `.STL` export for flexibility.
* [x] Add 2D blueprint export (SVG outline).

---

# Phase 6: Polish & Delivery

### 16. UX Enhancements

* [x] Add highlight (e.g. outline effect) when user selects a category (Blade panel highlights blade mesh).
* [ ] Smooth transitions when updating geometry (optional).
* [ ] Style UI (dark theme, fantasy aesthetic).

### 17. Performance Optimization

* [x] Profile geometry rebuilds – debounce expensive ones. (UI updates rAF-debounced)
* [x] Limit vertex counts (low-poly vs high-poly toggle). (Blade Detail)
* [x] Dispose unused geometries/materials to free memory.

### 18. Documentation

* [x] Write developer docs: parameter definitions, code structure.
* [x] Write user guide: how to use presets, randomizer, export.

### 19. Deployment

* [ ] Deploy static site (Vercel/Netlify).
* [ ] Provide example presets on landing page.
* [ ] Add demo swords (images/screenshots).

---

✅ **End Goal**: A fully functional web app where users can design swords by adjusting 30–50 parameters, instantly preview them in 3D, load presets or randomize, push designs to extremes, and export to Blender via GLTF.
