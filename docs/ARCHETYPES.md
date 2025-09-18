# Archetype Readiness Notes

## Greatsword / Zweihänder

Current blockers before we can ship a polished preset:

- **Guard extras:** need per-side parrying lugs/side-rings positioned along the ricasso. Existing `guard.extras` cannot yet place lugs above the guard plane or follow the blade.
- **Extended ricasso:** allow longer ricasso segments (>30 %) plus textured leather/cord wrap on the lower blade so hands can slide. Requires relaxing the `ricassoLength` clamp and adding optional wrap materials for the blade segment.
- **Two-stage grip:** add secondary grip parameters for the blade-ward handle (extra leather wraps, thumb ring) so the sword can be held half-sword.
- **Scabbard support:** zweihänder scabbards need optional frog straps and wider chapes; current scabbard builder assumes shorter swords.

## Fantasy Variants

### Close With Existing Systems

- **Flamberge / Kris:** use `blade.waviness` with higher amplitude and odd-frequency counts, plus custom tip shapes.
- **Rune-etched blades:** leverage engravings (text + decals) and emissive material presets.
- **Elemental swords:** combine emissive materials with mist/aura FX (already exposed in render hooks) for fire/ice themes.

### Still Blocked

- **Energy/dual-phase blades:** need realtime animation on blade geometry (scaling/extending) and stronger emissive-only materials with bloom tuning.
- **Segmented whips/chains:** require skeletal/physics-driven geometry; current pipeline is static meshes only.
- **Deployable saw teeth:** would need blend-shape or mesh toggles per frame, which the generator doesn’t support.

Keep this page updated as we add the missing parameters so the preset TODOs in `TODO.md` stay actionable.
