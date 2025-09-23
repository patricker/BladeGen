import * as THREE from 'three';
import type { GuardParams } from './types';

/**
 * Guard 2D profile builders.
 *
 * Provides parametric 2D Shapes used by guard builders (e.g., extruded wing/claw).
 * These shapes represent one half (right side) mirrored later by callers if needed.
 */

/**
 * Build the right-side half 2D shape for a guard variant. The returned shape is
 * defined in local coordinates with origin near the center, extending along +X.
 */
export function buildGuardHalfShape(g: GuardParams): THREE.Shape {
  const w = Math.max(0.2, g.width * 0.5);
  const sharp = Math.max(0, Math.min(1, g.tipSharpness ?? 0.5));
  const h = 0.12 + Math.abs(g.curve) * 0.25 + sharp * 0.15;
  const shape = new THREE.Shape();
  if (g.style === 'winged') {
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(w * (0.4 + 0.2 * sharp), g.curve * h, w, 0.02 + 0.02 * sharp);
    shape.lineTo(w * (0.8 + 0.1 * sharp), -0.06 - 0.03 * sharp);
    shape.lineTo(0, -0.02);
    shape.closePath();
  } else if (g.style === 'claw') {
    const tipY = 0.06 + 0.06 * sharp + g.curve * h;
    shape.moveTo(0, 0);
    shape.lineTo(w * (0.7 + 0.2 * sharp), tipY);
    shape.lineTo(w * (0.6 + 0.2 * sharp), -0.07 - 0.03 * sharp);
    shape.lineTo(0, -0.02);
    shape.closePath();
  } else {
    shape.moveTo(0, 0);
    shape.lineTo(w, 0);
    shape.lineTo(w, -0.05);
    shape.lineTo(0, -0.05);
    shape.closePath();
  }
  return shape;
}
