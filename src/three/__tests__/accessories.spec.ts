import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { defaultSwordParams, SwordGenerator } from '../SwordGenerator';
import { buildScabbard } from '../sword/accessories';

const closeTo = (a: number, b: number, eps = 1e-4) => Math.abs(a - b) <= eps;

describe('sword accessories', () => {
  it('buildScabbard returns consistent sampling helpers', () => {
    const params = defaultSwordParams();
    params.accessories!.scabbard!.enabled = true;
    const scabbard = params.accessories!.scabbard!;

    const result = buildScabbard(params.blade, scabbard);
    expect(result).not.toBeNull();

    const scabbardBuild = result!;
    const start = scabbardBuild.samplePoint(0);
    const end = scabbardBuild.samplePoint(1);
    const tangent = scabbardBuild.sampleTangent(0.37);
    const totalLength = params.blade.length + scabbard.tipExtension * params.blade.length;

    expect(closeTo(start.y, 0)).toBe(true);
    expect(closeTo(end.y, totalLength, 1e-3)).toBe(true);
    expect(tangent.length()).toBeCloseTo(1, 5);
    expect(scabbardBuild.widthAt(0.5)).toBeGreaterThan(params.blade.tipWidth);
  });

  it('resolves tassel anchors on the scabbard path when requested', () => {
    const params = defaultSwordParams();
    params.accessories!.scabbard!.enabled = true;
    params.accessories!.tassel!.enabled = true;
    params.accessories!.tassel!.attachTo = 'scabbard';
    params.accessories!.tassel!.anchorOffset = 0.42;

    const sword = new SwordGenerator(params);
    const tassel = params.accessories!.tassel!;
    const anchorData = (sword as any).resolveTasselAnchor(tassel, params.blade) as {
      anchor: THREE.Vector3;
      tangent?: THREE.Vector3;
    } | null;

    expect(anchorData).not.toBeNull();
    const scabbardGroup = sword.scabbardGroup;
    const scabbardBuild = (sword as any).scabbardBuild;
    expect(scabbardGroup).toBeTruthy();
    expect(scabbardBuild).toBeTruthy();

    const u = THREE.MathUtils.clamp(tassel.anchorOffset ?? 0.5, 0, 1);
    const expectedLocal = scabbardBuild.samplePoint(u);
    const expectedWorld = expectedLocal.clone();
    scabbardGroup!.localToWorld(expectedWorld);

    expect(anchorData!.anchor.distanceTo(expectedWorld)).toBeLessThan(1e-6);
    expect(anchorData!.tangent?.length()).toBeCloseTo(1, 5);
  });

  it('falls back to guard bounds when scabbard anchors are unavailable', () => {
    const params = defaultSwordParams();
    params.accessories!.tassel!.enabled = true;
    params.accessories!.tassel!.attachTo = 'guard';
    params.accessories!.tassel!.anchorOffset = 0.3;

    const sword = new SwordGenerator(params);
    const tassel = params.accessories!.tassel!;
    const anchorData = (sword as any).resolveTasselAnchor(tassel, params.blade) as {
      anchor: THREE.Vector3;
    } | null;

    expect(anchorData).not.toBeNull();
    const guardSource = (sword.guardMesh ?? (sword as any).guardGroup) as THREE.Object3D;
    const guardBounds = new THREE.Box3().setFromObject(guardSource);

    expect(anchorData!.anchor.x).toBeGreaterThanOrEqual(guardBounds.max.x - 1e-4);
    expect(anchorData!.anchor.y).toBeLessThanOrEqual(guardBounds.max.y + 1e-4);
  });
});
