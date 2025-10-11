import * as THREE from 'three';

/** Ensure the geometry has an index; if not, build a trivial one. */
export function ensureIndexed(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (geo.getIndex()) return geo;
  const pos = geo.getAttribute('position');
  const indices = new Uint32Array((pos.count / 3) * 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

/**
 * Add flat end caps at the minimum and maximum Y extents of the geometry.
 * Intended for revolution shapes like LatheGeometry that are open at the ends.
 *
 * The cap centers are placed on the local Y axis at (0, yMin, 0) and (0, yMax, 0).
 * Triangles are ordered so that normals face outward (-Y at bottom, +Y at top).
 */
export function capEndsByY(geoIn: THREE.BufferGeometry, yTol = 1e-5): THREE.BufferGeometry {
  const geo = geoIn.clone();
  ensureIndexed(geo);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const yMin = bb.min.y;
  const yMax = bb.max.y;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const P = pos.array as unknown as number[];
  const index = geo.getIndex()!.array as unknown as number[];

  const bottom: Array<{ i: number; ang: number }> = [];
  const top: Array<{ i: number; ang: number }> = [];

  const isClose = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;

  for (let i = 0; i < pos.count; i++) {
    const ix = i * 3;
    const x = P[ix + 0];
    const y = P[ix + 1];
    const z = P[ix + 2];
    if (isClose(y, yMin, yTol)) {
      bottom.push({ i, ang: Math.atan2(z, x) });
    } else if (isClose(y, yMax, yTol)) {
      top.push({ i, ang: Math.atan2(z, x) });
    }
  }

  const sortRing = (arr: Array<{ i: number; ang: number }>) => {
    arr.sort((a, b) => a.ang - b.ang);
    // de-duplicate seam vertices (−π and +π)
    const dedup: Array<{ i: number; ang: number }> = [];
    const tol = 1e-6;
    for (const r of arr) {
      if (dedup.length === 0 || Math.abs(r.ang - dedup[dedup.length - 1].ang) > tol) dedup.push(r);
    }
    return dedup;
  };

  const bot = sortRing(bottom);
  const topR = sortRing(top);

  // If we don't have a full ring on either end, bail out gracefully.
  if (bot.length < 3 && topR.length < 3) return geo;

  const newPositions: number[] = [];
  const newIndices: number[] = [];

  // Append centers
  const addVertex = (x: number, y: number, z: number): number => {
    const baseIndex = (pos.count + (newPositions.length / 3)) as number;
    newPositions.push(x, y, z);
    return baseIndex;
  };

  let iCenterBot = -1;
  if (bot.length >= 3) iCenterBot = addVertex(0, yMin, 0);
  let iCenterTop = -1;
  if (topR.length >= 3) iCenterTop = addVertex(0, yMax, 0);

  const fan = (center: number, ring: Array<{ i: number; ang: number }>, outwardIsTop: boolean) => {
    const n = ring.length;
    for (let k = 0; k < n; k++) {
      const a = ring[k].i;
      const b = ring[(k + 1) % n].i;
      // For bottom: outward is -Y so use [center, b, a]; For top: outward +Y use [center, a, b]
      if (outwardIsTop) newIndices.push(center, a, b);
      else newIndices.push(center, b, a);
    }
  };

  if (iCenterBot >= 0) fan(iCenterBot, bot, /*outwardIsTop=*/ false);
  if (iCenterTop >= 0) fan(iCenterTop, topR, /*outwardIsTop=*/ true);

  // Commit appended vertices and indices
  if (newPositions.length) {
    const mergedPos = new Float32Array((pos.count * 3) + newPositions.length);
    mergedPos.set(P as any, 0);
    mergedPos.set(new Float32Array(newPositions), pos.count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
  }
  if (newIndices.length) {
    const mergedIdx = new Uint32Array((index as any).length + newIndices.length);
    mergedIdx.set(index as any, 0);
    mergedIdx.set(new Uint32Array(newIndices), (index as any).length);
    geo.setIndex(new THREE.BufferAttribute(mergedIdx, 1));
  }
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}

/** Count boundary edges (used by tests). Returns number of edges used by only one triangle. */
export function countBoundaryEdges(geoIn: THREE.BufferGeometry): number {
  const geo = ensureIndexed(geoIn.clone());
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const P = pos.array as unknown as number[];
  const idx = (geo.getIndex()!.array as unknown as number[]);
  // Weld vertices by position with a small epsilon to account for separate cap/side vertices
  const eps = 1e-6;
  const quant = 1 / eps;
  const keyPos = (x: number, y: number, z: number) =>
    `${Math.round(x * quant)},${Math.round(y * quant)},${Math.round(z * quant)}`;
  const map = new Map<string, number>();
  const remap: number[] = new Array(pos.count);
  let next = 0;
  for (let i = 0; i < pos.count; i++) {
    const j = i * 3;
    const k = keyPos(P[j], P[j + 1], P[j + 2]);
    let w = map.get(k);
    if (w === undefined) {
      w = next++;
      map.set(k, w);
    }
    remap[i] = w;
  }
  const edges = new Map<string, number>();
  const edgeKey = (a: number, b: number) => (a < b ? a + ',' + b : b + ',' + a);
  for (let i = 0; i < idx.length; i += 3) {
    const a = remap[idx[i + 0]];
    const b = remap[idx[i + 1]];
    const c = remap[idx[i + 2]];
    const e0 = edgeKey(a, b), e1 = edgeKey(b, c), e2 = edgeKey(c, a);
    edges.set(e0, (edges.get(e0) || 0) + 1);
    edges.set(e1, (edges.get(e1) || 0) + 1);
    edges.set(e2, (edges.get(e2) || 0) + 1);
  }
  let boundary = 0;
  for (const [, n] of edges) if (n === 1) boundary++;
  return boundary;
}
