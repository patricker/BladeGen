# SwordMaker

Parametric sword generator and renderer for the web.

- Website: https://patricker.github.io/SwordMaker/

## Quick start

- Node 24+
- Install: `npm install`
- Dev server: `npm run dev` then open the URL shown
- Build: `npm run build`
- Tests: `npm test`
- E2E tests: `npm run test:e2e` (run `npx playwright install` once to grab browsers)

## Features

- Fully parametric blade/guard/handle/pommel with presets and randomizer
- Advanced controls: cross-section profiles, fullers (overlay/carve), serrations
- Engravings/inlays (text/decals) with alignment and letter spacing
- Guard styles: bar/winged/claw/disk plus knucklebow, swept, basket, and extras
- Handle layers: wrap/crisscross/rings/inlays, menuki and rivets
- Pommel variants: orb/disk/spike plus wheel, ring, scent-stopper, crown
- Materials system (MeshPhysicalMaterial) with transmission/emissive/anisotropy controls plus preset Looks
- Render tab: tone mapping, environment presets, outline/bloom/vignette, gradient/wear
- Exports: `.glb` (GLTF), `.obj`, `.stl`, and SVG blueprint
- Built-in historical & fantasy presets with curated material variants (exports via `KHR_materials_variants`)

### Included presets

| Preset | Highlights |
| --- | --- |
| **Katana** | Lenticular single-edge blade, hamon overlay, brushed anisotropic polish with “Winter Steel” and “Midnight Oni” variants. |
| **Arming Sword** | Classic cruciform proportions, fuller and scent-stopper pommel with “Tournament Bright” / “Battleworn” material variants. |
| **Claymore** | Two-handed greatsword with flared guard, leather grip, and bronze/dark runic variants that showcase emissive accents. |
| **Rapier** | Swept/claw guard with high anisotropy and polished or blackened variant looks. |
| **Demon Blade** | Aggressive serrations, emissive arcane base material plus molten and voidglass variants. |
| **Lightsaber** | Energy blade using transmission + emissive glow, auto-bloom tuning, and cyan/green/red/purple crystal variants. |

### FX modules

Rendering effects and overlays are organized under `src/three/fx` and are UI‑agnostic builders where possible:

- `fx/shaders.ts` — central shader definitions (Fresnel, Flame Aura, Mist, Vignette, Bloom composite, Heat Haze)
- `fx/overlays.ts` — overlay builders (`buildInkOutline`, `buildFresnel`, `buildBladeGradientOverlay`, `buildBladeGradientWearOverlay`)
- `fx/aura.ts` — flame aura mesh builder cloned from the blade geometry
- `fx/embers.ts` — simple GPUPoints embers system
- `fx/innerGlow.ts` — inner glow overlay + shader
- `fx/mist.ts` — mist noise texture, mist builder, and particle update step
- `fx/manager.ts` — orchestrates selective bloom and heat haze passes
- `fx/noise.ts` — value noise texture generator for bump maps

`src/three/setupScene.ts` wires these modules into a working demo and exposes strongly‑typed `renderHooks` for UI components.

## License

MIT — see [LICENSE](./LICENSE).
