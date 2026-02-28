# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BladeGen is a browser-based 3D sword generator built with Three.js and TypeScript. It renders parametric swords with PBR materials, post-processing effects, and exports to GLB/OBJ/STL/SVG/JSON. Live at bladegen.net.

## Commands

| Task | Command |
|---|---|
| Install | `npm i` (requires Node 24+) |
| Dev server | `npm run dev` (localhost:5173; auto-syncs schema) |
| Build | `npm run build` |
| Unit tests | `npm test` |
| Unit tests (watch) | `npm run test:watch` |
| Single unit test | `npx vitest run src/three/sword/__tests__/bladeGeometry.spec.ts` |
| E2E tests | `npm run test:e2e` |
| Single E2E test | `npx playwright test tests/e2e/export.spec.ts` |
| E2E single browser | `npx playwright test --project=chromium` |
| Lint | `npm run lint` |
| Format | `npm run format` |

## Architecture

**Entry flow:** `index.html` → `src/main.ts` → `setupScene(canvas)` + `createSidebar(sidebar, ...)` → render loop.

**Two-layer separation:**
- **Three.js layer** (`src/three/`): Scene setup, geometry builders, materials, FX, render pipeline. No DOM access.
- **UI layer** (`src/components/`): Sidebar panels, control registration, presets, exporters. Communicates with Three.js exclusively through the `RenderHooks` API (`createRenderHooks.ts`).

**Key modules:**
- `SwordGenerator` (`src/three/SwordGenerator.ts`): Orchestrates geometry by delegating to pure per-part builders in `src/three/sword/` (blade, guard, handle, pommel, engravings, accessories).
- `RenderHooks` (`src/three/render/createRenderHooks.ts`): Typed API boundary — UI must never directly manipulate Three.js objects.
- `controls.ts` (`src/components/controls.ts`): Wires all UI sub-panels and delegates control registration to `ControlRegistry`.

**Coordinate system:** Blade runs along +Y, guard/handle toward -Y, X is width, Z is thickness.

**Post-processing:** EffectComposer with UnrealBloom, FXAA/SMAA/MSAA, OutlinePass, vignette, and optional pixelate pass, toggled via `RenderPipeline`.

## Schema as Source of Truth

`schema/sword.schema.json` is the canonical schema for exports/imports (validated with Ajv 2020-12). When modifying `SwordParams`, render state, or material state:
1. Update `schema/sword.schema.json`
2. Update `src/three/sword/defaults.ts` and presets
3. Add/adjust schema unit tests in `src/__tests__/schema.spec.ts`

The schema is auto-copied to `public/` by pre-scripts on `dev` and `build` — never copy it manually.

## Testing

- **Unit tests** (Vitest): Co-located in `__tests__/` folders next to source. Globals enabled (`describe`, `it`, `expect` without imports). Coverage thresholds: 75% lines/functions/statements, 65% branches.
- **E2E tests** (Playwright): In `tests/e2e/`. Runs against dev server on port 4173. Chromium, Firefox, WebKit. Install browsers with `npx playwright install`.

## Code Style

- TypeScript strict mode, 2-space indent
- `PascalCase` classes, `camelCase` vars/functions, `UPPER_CASE` constants, `kebab-case` directories
- ESLint: `no-explicit-any` is off; unused vars prefixed with `_` are allowed
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- Minimal diffs; when adding params, update defaults/presets/tests in the same change
