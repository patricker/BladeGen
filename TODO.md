# SwordMaker Roadmap (Phase 8+)

Reference specs: see newfeatures.md (Phase 8) and new2features.md (extended knobs and UX).

## Near‑Term Priorities
- Distal taper + dynamics readouts: thicknessProfile along blade; compute PoB, CoP, inertia; show in UI/export.
- Guard↔blade smooth fillet: replace box bridge with a small shaped profile.
- Edge/tip taxonomy: ricasso and false edge; add tip families (clip, tanto, spear, sheepsfoot).
- Render polish: MSAA (WebGL2), contact shadow plane, composer toggle, mobile heuristics, global envMapIntensity hook.

## Geometry & Dynamics
- [ ] Distal taper thicknessProfile (Bezier/points) varying Z thickness along Y.
- [ ] Derived metrics: PoB (cmY), CoP, polar moment; expose in UI/JSON.
- [ ] Blade families: wavy/flamberge; kris with odd wave counts.
- [ ] Cross‑section upgrades: hollow grind (radius/depth), compound grinds; triangular and T‑spine.
- [ ] Fuller v2: per‑face array with width/offsetFromSpine/taper (1–3 per side).

## Guard & Hilt
- [ ] Shell guards (simple lathed/extruded shells).
- [ ] Langets along blade flats (length, thickness).
- [ ] Asymmetry beyond scale (shape/profile bias per side).
- [ ] Advanced guard↔blade fillet (smooth profile).

## Handle & Grip
- [ ] Wrap style presets: hineri‑maki, katate‑maki, wire wrap.
- [ ] Rayskin (samegawa) visual layer (procedural/texture; density/scale).
- [ ] Menuki presets/placement helpers (left/right arrays with common positions).

## Pommel & Assembly
- [ ] Additional variants: fishtail.
- [ ] Peen visible / peen block visuals.

## Materials & Export
- [ ] glTF KHR_materials_variants and a simple Look switcher in UI.
- [ ] Anisotropy direction UI and helper maps (beyond current fake direction).

## Accessories
- [ ] Scabbard generator (throat/locket/chape) matching blade profile + sword knot/tassel; simple rope curve with idle.

## UX
- [ ] Archetype‑first start screen (family presets grid).
- [ ] Goal sliders (Cut↔Thrust, Agility↔Authority, Elegant↔Brutal) driving grouped knobs.
- [ ] Progressive disclosure polish for advanced controls.

## Render & Performance
- [ ] MSAA path for WebGL2 (fallback to FXAA/SMAA; UI toggle).
- [ ] Contact shadow plane option.
- [ ] Toggle composer vs direct render for perf fallback.
- [ ] Mobile heuristics: auto‑disable bloom/outline; lower DPR/shadow size.
- [ ] Dispose/GC of composers/passes/materials on toggles.
- [ ] Animated shimmer (time uniform) for gradient/wear (optional).
- [ ] Wire up global envMapIntensity in UI; persist in JSON.

## QA, Demos & Docs
- [ ] Visual QA checklist and screenshot gallery (consistent lighting).
- [ ] Blender import parity (sRGB/linear, exposure/shadows check).
- [ ] Landing page presets and images; publish to Pages.

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
