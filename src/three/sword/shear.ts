import * as THREE from 'three';
import type {
  BladeAperture,
  BladeFracture,
  BladeParams,
  GuardParams,
  GuardShearParams,
} from './types';
import { callCore, toGeometry } from './core/wasm';
import { bladeOrDefault } from './guardForged';

/**
 * SW12: the shear-gate guard (style 'shear') and the defaults of the three SW12 blocks, from bladegen-core
 * (`shear.rs`, `keel.rs`, `fault.rs`, through the wasm module). The window-keel and faultbound blades need nothing
 * here: `buildBladeGeometry` and `buildBladeGlowGeometry` return them when `blade.aperture` / `blade.fracture` is set.
 *
 * The shear-gate is sized from the blade like the monument guards and placed the same way (its hub's blade-side face
 * on the guard line, tilted about Z). Guard-local space: the hub's centre at the origin, span along X, +Y toward the
 * blade. Its throat is a separate emissive mesh (two thin plates on the hub's faces) drawn with the glow material.
 */

type Sw12Defaults = {
  aperture: Required<BladeAperture>;
  fracture: Required<BladeFracture>;
  shear: Required<GuardShearParams>;
};

/** The defaults validation writes back for blade.aperture, blade.fracture and guard.shear (bladegen-core's). */
export const SW12_DEFAULTS: Sw12Defaults = Object.freeze(
  callCore<Sw12Defaults>('sw12_defaults').value
);

export type ShearGuardBuild = {
  geometry: THREE.BufferGeometry;
  /** The glowing throat, or null (throat 0). */
  throat: THREE.BufferGeometry | null;
  halfHeight: number;
};

/** The shear-gate's geometry in guard-local space (see the file comment). */
export function buildShearGuardGeometry(
  g: GuardParams,
  blade?: BladeParams | null
): ShearGuardBuild {
  const r = callCore<{ halfHeight: number; throat: boolean }>('guard_shear', {
    guard: g,
    blade: bladeOrDefault(blade),
  });
  const geometry = toGeometry(r, r.meshes[0], ['index', 'position', 'uv', 'normal']);
  const throat = r.value.throat
    ? toGeometry(r, r.meshes[1], ['index', 'position', 'uv', 'normal', 'color'])
    : null;
  return { geometry, throat, halfHeight: r.value.halfHeight };
}
