Developer Guide

Structure

- Core: `src/three/SwordGenerator.ts` — geometry + validation.
- UI: `src/components/controls.ts` — sidebar, sliders, exports, warnings.
- Scene: `src/three/setupScene.ts` — THREE renderer, camera, lights.

Key APIs

- SwordGenerator.updateGeometry(params): validates and rebuilds meshes.
- SwordGenerator.setHighlight(part): emissive highlight for UI hover.

Parameters (selected)

- Blade: length, baseWidth, tipWidth, thickness, curvature, serrationAmplitude/Frequency, fullerEnabled/Depth/Length, sweepSegments, chaos, asymmetry.
- Guard: style, width, thickness, curve, tilt, curveSegments.
- Handle: length, radiusTop/Bottom, segmentation, wrapEnabled/Turns/Depth, wrapTexture/Scale/Angle, phiSegments.
- Pommel: style, size, elongation, shapeMorph.
- Global: styleFactor (0..1) exaggerates guard/pommel/curvature.

Testing Tips

- Use presets and per‑section Shuffle to exercise geometry paths.
- Increase Blade Detail to inspect curvature and seam continuity.
- Toggle DoubleSide only for debugging; fix winding if needed.

Extending

- Add new params to types, validate() clamps, and rebuild functions.
- Keep core math pure; avoid direct DOM/CSS from core modules.
