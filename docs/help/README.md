# In-App Help Authoring

Location for control/concept docs. Keep entries short, consistent, and oriented to in-app use.

Doc schema (per control):
- id: string (matches `row.dataset.field`, e.g. `blade.curvature`)
- label: string (short title)
- summary: string (<=120 chars; shown as micro‑tooltip)
- details: string[] (<=6 bullets; <=120 chars each)
- parts: string[] (e.g., ["blade"]) — used to highlight the 3D part
- dependsOn: string[] (optional)
- affects: string[] (optional)
- related: string[] (optional)
- warnings: string[] (optional)
- tryThis: { label: string }[] (optional)

Notes
- Prefer one doc per control id; cross‑link using `related` instead of duplicating text.
- Use clear language; avoid jargon unless defined in a Concept doc.
- Images are optional; rely on in‑scene highlight where possible.

Authoring format (Markdown + JSON block)
- Each file under `docs/help/controls/**` starts with a fenced JSON block defining the doc (example below). Any prose after the block is optional and currently ignored by the app.

Example (`docs/help/controls/blade/curvature.md`):

```json
{
  "id": "blade.curvature",
  "label": "Blade Curvature",
  "summary": "Curves the blade into an arc. Higher = more curved.",
  "details": [
    "Positive arcs toward the edge; negative away.",
    "Curvature interacts with fuller placement and tip style."
  ],
  "parts": ["blade"],
  "tryThis": [{ "label": "Animate curvature" }]
}
```

Build/Runtime
- `npm run help:build` parses `docs/help/controls/**.md` and merges them into `src/components/help/docs.json` (existing JSON entries are preserved unless overridden by the same `id`).
- `npm run build` runs the same merge as a `prebuild` step and generates `public/help-index.json` for search.
- At runtime, the Help system dynamically imports `src/components/help/docs.json` so micro-tooltips, popovers, and the Help Panel have content.

Quality gates
- `npm run help:lint` enforces max lengths (summary ≤120 chars; details ≤8 items, each ≤160 chars) and duplicate id checks.
