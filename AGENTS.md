# Repository Guidelines

## Project Structure & Module Organization

- Source lives in `src/` (TypeScript preferred). Suggested layout:
  - `src/core/` geometry logic (e.g., `SwordGenerator.ts`, `parts/Blade.ts`).
  - `src/ui/` controls, panels, and state wiring.
  - `public/` static assets (e.g., `index.html`, `assets/textures/`).
  - `tests/` unit/e2e tests; keep fixtures small.
- `schema/sword.schema.json` defines the canonical JSON document schema for exports/imports. Treat this as a single source of truth and keep it in sync with any changes to model parameters, render state, or material state.
- Keep rendering code (Three.js) isolated from UI logic. Export pure helpers for geometry math where possible to ease testing.

## Build, Test, and Development Commands

- Requires Node 24+ and npm (or pnpm).
- Common scripts (if missing, add via Vite setup):
  - `npm i` – install dependencies.
  - `npm run dev` – start local dev server (Vite) at `http://localhost:5173`.
  - `npm run build` – production build to `dist/`.
  - `npm run preview` – serve built app locally.
  - `npm test` – run unit tests (Vitest/Jest).
  - `npm run lint` / `npm run format` – ESLint/Prettier.

## Coding Style & Naming Conventions

- Use 2‑space indentation; TypeScript with `strict` enabled.
- Naming: `PascalCase` for classes/components (`SwordGenerator`), `camelCase` for variables/functions, `UPPER_CASE` for constants. Directories use `kebab-case`.
- File examples: `src/core/SwordGenerator.ts`, `src/ui/ControlsPanel.ts`.
- Keep modules small and cohesive; avoid side effects in `src/core/**`.
- Run Prettier on save; fix ESLint warnings before committing.

## Testing Guidelines

- Framework: Vitest (unit) and optional Playwright (e2e).
- Place unit tests in `src/**/__tests__/*.spec.ts` and e2e in `tests/e2e/*.spec.ts`.
- Target ≥80% coverage for core geometry and parameter mapping. Prefer deterministic numeric assertions over snapshots for geometry.
- Run: `npm test` (add `--coverage` when checking thresholds).
- When modifying `SwordParams`, render/material state, or JSON export/import paths, update `schema/sword.schema.json` accordingly. Ideally add/adjust a unit test to validate exports against the schema to prevent drift.

## Commit & Pull Request Guidelines

- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- PRs must include:
  - Clear description and linked issue.
  - Screenshots/GIFs for UI/visual changes.
  - Notes on performance impact (FPS, bundle size) and affected parameters/presets.
  - Updated docs when behavior changes (`TODO.md`).

## Security & Assets

- Do not commit secrets or large binaries. Optimize textures; keep single assets <2 MB when possible. Attribute third‑party assets/licenses in `docs/`.

## Agent-Specific Tips

- Make minimal, focused diffs; avoid broad renames. Respect structure above. When adding parameters, update defaults/presets and tests in the same PR.
