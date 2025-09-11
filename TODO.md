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
* [ ] Optional wrap texture (procedural stripes).

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
* [ ] Add “symmetry toggle”: asymmetrical designs.
* [ ] Add “stylization slider”: realistic ↔ exaggerated scaling.
* [ ] Add decorative noise/displacement.

### 13. Validation & Feedback

* [x] Implement soft warnings for extreme ratios (e.g. guard >> blade).
* [ ] Non-blocking indicators (icon + tooltip).
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

* [ ] Write developer docs: parameter definitions, code structure.
* [ ] Write user guide: how to use presets, randomizer, export.

### 19. Deployment

* [ ] Deploy static site (Vercel/Netlify).
* [ ] Provide example presets on landing page.
* [ ] Add demo swords (images/screenshots).

---

✅ **End Goal**: A fully functional web app where users can design swords by adjusting 30–50 parameters, instantly preview them in 3D, load presets or randomize, push designs to extremes, and export to Blender via GLTF.
