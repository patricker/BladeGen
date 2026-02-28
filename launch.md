Love the project—Bladegen already has the right building blocks. Here’s a tight plan: one **hero default** that feels instantly premium, plus a short, curated gallery that shows range without “randomizer chaos.”

---

## The better default on load

**Hero preset:** **“Showcase Arming (Type XVIII) — Winter Steel”**

**Why this works as the first impression**

* **Recognizable silhouette** (straight, double‑edged, elegant taper) → instantly communicates “sword” to non‑experts.
* **Mid‑range proportions** avoid parameter extremes, so subsequent user tweaks behave predictably.
* **One tasteful flourish** (single fuller) shows geometry sophistication without visual clutter.
* **High-contrast materials** (bright blade, warm gilt fittings, dark grip) read well on any background and look great under studio lighting.
* **No occlusion traps** (e.g., baskets/shells) so the blade & fuller are immediately visible on small screens.

**Suggested geometry highlights (mapped to your schema)**

* Blade: length ~**2.6–2.8**, baseWidth **0.22**, tipWidth **0.01–0.02**, **diamond** section, tipShape **'spear'**, **fullerEnabled** true, **fullerLength ~0.55**, **fullerWidth ~0.05**, **fullerProfile 'u'**, **ricassoLength ~0.04**, **chaos 0.0**.
* Guard: style **'winged'**, width **1.10–1.20**, thickness **0.18**, curve **0.0** (keep clean), **guardBlendFillet ~0.05** with **'smooth'**.
* Handle: length **0.85–0.90**, radiusTop/Bottom **0.11**, **wrapEnabled true**, **wrapTexture true**, **wrapTurns ~6**, **wrapDepth ~0.01**, **wrapTexScale ~9**, **wrapTexAngle ~π/6**, **ovalRatio ~1.1**.
* Pommel: style **'scentStopper'**, size **0.17**, elongation **1.2**, shapeMorph **0.25**, facetCount **20**, balance **0.1**.

**Looks (materials)**

* **Default look (Winter Steel)**

  * Blade: color `#eef4ff`, **metalness ~0.93**, **roughness ~0.15**, **clearcoat ~0.30**, **envMapIntensity ~1.6**, light **anisotropy (0.3–0.4)**.
  * Guard & Pommel: **gilt brass** `#c9a347`, metalness **~0.82**, roughness **~0.32**.
  * Handle: deep charcoal leather `#2f3338`, roughness **~0.52**, **sheen ~0.36** (sheenColor `#556d8a`).
* **Variant chips for the Looks dropdown**

  1. *Battleworn Steel*: blade slightly darker & rougher, guard/pommel tarnished brass; handle warm brown.
  2. *Nocturne*: **blued blade** (e.g., `#5c6599`), blackened fittings, black grip.
  3. *Ivory & Gold*: pale bone grip, bright gilt fittings, lighter blade polish.

**Render & post defaults (subtle, studio‑ish)**

* Exposure **~1.15**; ambient **~0.18**; key **~1.30** at **az 35°, el 22°**; rim **~0.9** at **az −145°, el 35°**; rimColor `#9ec9ff`.
* Post: **ink outline off** by default (toggle available), **vignette low** (strength **~0.15**, softness **~0.6**).
* Background: neutral to slightly cool gray, brightness **~0.6**.

> These values mirror the vibe of your existing “Winter Steel” styling in presets and read beautifully under the RoomEnvironment.

---

## A compact, killer preset gallery

Each of these is intentionally “heroable,” shows a distinct feature cluster, and avoids redundancy. Offer 2–3 material variants per preset.

1. **Cup‑Hilt Rapier (Late Renaissance)**

   * Guard: **'shell'** with coverage, **sideRing** + **fingerGuard** extras.
   * Blade: slim, long, **diamond** or **hexagonal** section; **ricasso** enabled.
   * Why: shows sculpted guard complexity + engraving/inlay on ricasso.

2. **Basket‑Hilt Broadsword (Scottish)**

   * Guard: **'basket'** (good stress test for mesh density), quillon extras minimal.
   * Blade: moderate length, fuller short.
   * Why: demonstrates ornate guard families and anisotropic metal on the basket.

3. **Jian — Scholar’s Edge**

   * Guard: **'disk'** (simple round guard), **tassel enabled** on **handle**.
   * Blade: straight, **lenticular** section, **tipShape 'spear'**, minimal fuller (or none).
   * Accessories: **scabbard enabled** with throat/locket/chape.
   * Why: shows **tassel physics look**, scabbard builder, and elegant minimalism.

4. **Katana — Midare Hamon**

   * Blade: curvature (**sori**), **edgeType 'single'**, **kissakiLength/Roundness** tuned; **hamon overlay** enabled.
   * Guard: **habaki** enabled.
   * Handle: **hineri** wrap style, **rayskin** overlay, **menuki** pair.
   * Why: showcases **hamon** + wrap texture + ornamental grip layers.

5. **Gladius (Mainz/“Leaf”)**

   * Blade: **tipShape 'leaf'** with **tipBulge**, short length; fuller optional short.
   * Guard: compact bar; Pommel: **'disk'** or **'ring'**.
   * Why: highlights alternate blade profile family + SVG blueprint export readability.

6. **Sabre / Kilij Hybrid**

   * Blade: single edge, pronounced curvature, **falseEdgeLength** near tip; **lenticular** section.
   * Guard: **'knucklebow'** with slight tilt; Pommel: **'ring'**.
   * Why: shows curved dynamics + asymmetry controls, and knucklebow style.

7. **Flamberge Zweihänder (Showpiece)**

   * Blade: family **'flamberge'** (waviness amplitude/frequency); **extended ricasso**; partial guard **sideRing**/**loop** extras.
   * Handle: longer **two‑hand** proportions.
   * Why: shows **wave blade** system & edge case proportions (stress‑test).

8. **Kris (Southeast Asia)**

   * Blade: family **'kris'** (waviness), **single‑edge**; short guard **'winged'** slight curve.
   * Handle: organic oval ratio.
   * Why: a different wave aesthetic with unique silhouette.

9. **Falchion (Late Medieval)**

   * Blade: single edge, dramatic **clip** or **sheepsfoot** tip, no fuller.
   * Guard: simple **'bar'** with tiny curve; Pommel: **'wheel'**.
   * Why: shows radical width taper + alternate tip families.

10. **Rune‑Etched “Frostbrand” (Fantasy)**

* Blade: engravings **type 'text'/'decal'** along fuller; **innerGlow** low; optional **mist** (edge emission).
* Materials: cool steel with subtle emissive in runes.
* Why: shows engravings + FX pipeline without going overboard.

11. **Obsidian Glass (Fantasy/Sci‑Fi)**

* Blade: **flat** cross‑section, **transmission** material with higher clearcoat; **edgeType 'double'**; faint **heatHaze** post.
* Guard: **'disk'** very thin; Pommel: **'crown'** small.
* Why: shows transmission + post FX variety.

12. **Lightsaber (Minimal)**

* Blade: energy blade via **innerGlow**/**flame** (hilt‑only geometry) with **bloom**.
* Why: shows your FX stack & non‑metal look; good “palette cleanser” in the list.

> Order the gallery from “grounded → ornate → fantasy” to help new users ramp up.

---

## (Optional) ready‑to‑drop preset scaffold

If you want to wire the hero default exactly, you can model it as a `PresetEntry` with render/post/fx overrides and a few variants. This mirrors your existing `presets.ts` patterns:

```ts
// presets.ts
import { defaultSwordParams, type SwordParams } from '../three/SwordGenerator';
import type { PresetEntry } from './presets'; // if you separate types, adjust path
import type { Part } from './types';

export function presetShowcaseArming(): SwordParams {
  const p = defaultSwordParams();

  // Blade
  p.blade.length = 2.65;
  p.blade.baseWidth = 0.22;
  p.blade.tipWidth = 0.012;
  p.blade.tipRampStart = 0.82;
  p.blade.tipShape = 'spear';
  p.blade.crossSection = 'diamond' as any;
  p.blade.thickness = 0.07;
  p.blade.thicknessLeft = 0.07;
  p.blade.thicknessRight = 0.07;
  p.blade.fullerEnabled = true;
  p.blade.fullerDepth = 0.015;
  p.blade.fullerLength = 0.55;
  (p.blade as any).fullerWidth = 0.05;
  p.blade.fullerProfile = 'u';
  p.blade.fullerMode = 'overlay';
  (p.blade as any).fullerCount = 1;
  p.blade.ricassoLength = 0.04;
  p.blade.chaos = 0;
  p.blade.edgeType = 'double';

  // Guard
  p.guard.style = 'winged';
  p.guard.width = 1.15;
  p.guard.thickness = 0.18;
  p.guard.curve = 0.0;
  p.guard.tilt = 0.0;
  p.guard.guardBlendFillet = 0.05;
  p.guard.guardBlendFilletStyle = 'smooth';

  // Handle
  p.handle.length = 0.88;
  p.handle.radiusTop = 0.11;
  p.handle.radiusBottom = 0.11;
  p.handle.segmentation = false;
  p.handle.wrapEnabled = true;
  p.handle.wrapTurns = 6;
  p.handle.wrapDepth = 0.01;
  (p.handle as any).wrapTexture = true;
  p.handle.wrapTexScale = 9;
  p.handle.wrapTexAngle = Math.PI / 6;
  (p.handle as any).ovalRatio = 1.1;

  // Pommel
  p.pommel.style = 'scentStopper';
  p.pommel.size = 0.17;
  p.pommel.elongation = 1.2;
  p.pommel.shapeMorph = 0.25;
  p.pommel.facetCount = 20;
  p.pommel.balance = 0.1;

  return p;
}

export const ShowcaseArming: PresetEntry = {
  id: 'showcase-arming',
  label: 'Showcase Arming',
  build: presetShowcaseArming,
  materials: {
    blade: { color: '#eef4ff', metalness: 0.93, roughness: 0.15, clearcoat: 0.30, envMapIntensity: 1.6, anisotropy: 0.36 },
    guard: { color: '#c9a347', metalness: 0.82, roughness: 0.32, anisotropy: 0.28 },
    pommel: { color: '#c9a347', metalness: 0.80, roughness: 0.33, anisotropy: 0.24 },
    handle: { color: '#2f3338', roughness: 0.52, sheen: 0.36, sheenColor: '#556d8a' },
  },
  variants: [
    {
      name: 'Battleworn Steel',
      parts: {
        blade: { color: '#e6ebf5', roughness: 0.24, metalness: 0.88, envMapIntensity: 1.3 },
        guard: { color: '#a6843f', roughness: 0.44, metalness: 0.76 },
        pommel: { color: '#a6843f', roughness: 0.46, metalness: 0.76 },
        handle: { color: '#4a3b2d', roughness: 0.62, sheen: 0.22, sheenColor: '#3d2a1d' },
      },
    },
    {
      name: 'Nocturne',
      parts: {
        blade: { color: '#5c6599', metalness: 0.70, roughness: 0.22, envMapIntensity: 1.4, anisotropy: 0.18 },
        guard: { color: '#3f2a22', metalness: 0.30, roughness: 0.52 },
        pommel: { color: '#3f2a22', metalness: 0.30, roughness: 0.52 },
        handle: { color: '#1f2328', roughness: 0.56, sheen: 0.18 },
      },
    },
    {
      name: 'Ivory & Gold',
      parts: {
        blade: { color: '#fdfdf8', metalness: 0.95, roughness: 0.16, envMapIntensity: 1.5, anisotropy: 0.24 },
        guard: { color: '#e4b972', metalness: 0.86, roughness: 0.32 },
        pommel: { color: '#e4b972', metalness: 0.86, roughness: 0.34 },
        handle: { color: '#e8d9b7', metalness: 0.02, roughness: 0.58, sheen: 0.22, sheenColor: '#f3e9ce' },
      },
    },
  ],
  render: {
    exposure: 1.15, ambient: 0.18, keyIntensity: 1.3, keyAz: 35, keyEl: 22,
    rimIntensity: 0.9, rimAz: -145, rimEl: 35, rimColor: '#9ec9ff',
  },
  post: {
    vignetteEnabled: true, vignetteStrength: 0.15, vignetteSoftness: 0.6,
    // keep ink/outline off by default; users can toggle in UI
  },
};
```

**Hook it up as the default**
In `main.ts`, instead of `defaultSwordParams()`, build from your new preset and (optionally) apply the render overrides via your existing hooks:

```ts
// main.ts (pseudocode)
import { ShowcaseArming, presetShowcaseArming } from './components/presets';

const swordParams = presetShowcaseArming();
createSidebar(sidebar, sword, swordParams, renderHooks);

// Optionally apply ShowcaseArming.render/post/fx on start
```

---

## Small UX touches that elevate the first 10 seconds

* **Auto-rotate on**, but pause on pointer down; resume after ~1.5 s of idle (you already have logic for this).
* **Camera seed** that frames ~¾ length of the blade with a slight downward tilt so the fuller catches the key light.
* **Looks dropdown** pre‑populated with the 3 variants above so users can click between drastically different finishes.

---

If you want, I can turn any of the gallery items into drop‑in `PresetEntry` objects (with materials + render tweaks) next.
