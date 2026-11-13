import * as THREE from 'three';

/**
 * bladegen-core (crates/bladegen-core, the Rust sword geometry) compiled to WebAssembly (crates/bladegen-wasm).
 *
 * The geometry the galaxy kit's planet swords use lives in Rust only (BG1); this module loads the wasm build once,
 * with top-level await, so every builder that calls it stays synchronous. In Node (vitest, vite-node, the headless
 * CLI) it reads the file; in the browser it fetches the asset Vite emits for `new URL(..., import.meta.url)`.
 *
 * The module's ABI (crates/bladegen-wasm/src/lib.rs): `bg_alloc`/`bg_free` for the input buffer, `bg_call(op, json)`
 * returning `[u32 json_len][json][pad 4][binary]`, `bg_result_len`. Meshes come back as f32/u32 arrays (the
 * `bladegen-mesh-dump` layout), and `toGeometry` turns them into a `THREE.BufferGeometry` with the attribute order
 * and index type the TypeScript builders produced, so a wasm geometry is the same object, value for value.
 *
 * Rebuild the module after changing the Rust: `scripts/build-wasm.sh` (needs the wasm32-unknown-unknown target).
 */

type Exports = {
  memory: WebAssembly.Memory;
  bg_alloc(len: number): number;
  bg_free(ptr: number, len: number): void;
  bg_call(op: number, opLen: number, input: number, inLen: number): number;
  bg_result_len(): number;
};

export type CoreAttribute = { itemSize: number; count: number; byteOffset: number; byteLength: number };
export type CoreMesh = {
  vertexCount: number;
  attributes: Record<string, CoreAttribute>;
  index: { count: number; byteOffset: number; byteLength: number };
  /** build_parts only: the part name (blade, glow, handle, guard, pommel) and its matrix (column-major). */
  part?: string;
  matrix?: number[];
};
export type CoreResult<V = any> = { value: V; meshes: CoreMesh[]; bin: Uint8Array };

const WASM_URL = new URL('./bladegen_core.wasm', import.meta.url);

async function loadBytes(): Promise<BufferSource> {
  const proc = (globalThis as any).process;
  if (proc?.versions?.node) {
    // Node: read the file (the specifier is a variable so the browser bundle never resolves it)
    const fsName = 'node:fs/promises';
    const fs = await import(/* @vite-ignore */ fsName);
    return fs.readFile(WASM_URL);
  }
  const res = await fetch(WASM_URL);
  if (!res.ok) throw new Error(`bladegen-core: cannot load ${WASM_URL} (${res.status})`);
  return res.arrayBuffer();
}

const { instance } = await WebAssembly.instantiate(await loadBytes(), {});
const ex = instance.exports as unknown as Exports;
const enc = new TextEncoder();
const dec = new TextDecoder();

function put(bytes: Uint8Array): [number, number] {
  const len = bytes.length;
  const ptr = ex.bg_alloc(len);
  new Uint8Array(ex.memory.buffer, ptr, len).set(bytes);
  return [ptr, len];
}

/** One call into the core: `op` with its JSON input. Throws the core's error message. */
export function callCore<V = any>(op: string, input?: unknown): CoreResult<V> {
  const [op_p, op_n] = put(enc.encode(op));
  const [in_p, in_n] = input === undefined ? [0, 0] : put(enc.encode(JSON.stringify(input)));
  let out: Uint8Array;
  try {
    const rp = ex.bg_call(op_p, op_n, in_p, in_n);
    const rn = ex.bg_result_len();
    // copy out: the next call (or a memory growth) invalidates the module's buffer
    out = new Uint8Array(ex.memory.buffer, rp, rn).slice();
  } finally {
    ex.bg_free(op_p, op_n);
    if (in_n) ex.bg_free(in_p, in_n);
  }
  const jl = new DataView(out.buffer).getUint32(0, true);
  const head = JSON.parse(dec.decode(out.subarray(4, 4 + jl)));
  if (!head.ok) throw new Error(`bladegen-core ${op}: ${head.error}`);
  const binStart = (4 + jl + 3) & ~3;
  return { value: head.value, meshes: head.meshes, bin: out.subarray(binStart) };
}

/** A mesh attribute as a fresh Float32Array. */
export function f32Of(r: CoreResult, a: CoreAttribute): Float32Array {
  const b = r.bin;
  return new Float32Array(b.buffer.slice(b.byteOffset + a.byteOffset, b.byteOffset + a.byteOffset + a.byteLength));
}

/** A mesh's index as a fresh Uint32Array. */
export function indexOf(r: CoreResult, m: CoreMesh): Uint32Array {
  const b = r.bin;
  const o = b.byteOffset + m.index.byteOffset;
  return new Uint32Array(b.buffer.slice(o, o + m.index.byteLength));
}

/** What `BufferGeometry.setIndex(array)` does with a plain array: Uint16 below 65535, else Uint32. */
function indexAttribute(idx: Uint32Array): THREE.BufferAttribute {
  let max = 0;
  for (let i = 0; i < idx.length; i++) if (idx[i] > max) max = idx[i];
  return max >= 65535
    ? new THREE.Uint32BufferAttribute(idx, 1)
    : new THREE.Uint16BufferAttribute(Uint16Array.from(idx), 1);
}

/**
 * A core mesh as a BufferGeometry. `order` is the TypeScript builder's own order of `setAttribute`/`setIndex`
 * ('index' marks where the index went), so attribute iteration (GLTFExporter, dumps) is unchanged; attributes the
 * mesh does not have are skipped.
 */
export function toGeometry(
  r: CoreResult,
  m: CoreMesh,
  order: string[] = ['position', 'index', 'normal', 'tangent', 'uv', 'color'],
  opts: { boundingBox?: boolean; float32Attribute?: boolean } = {}
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  for (const k of order) {
    if (k === 'index') {
      geo.setIndex(indexAttribute(indexOf(r, m)));
      continue;
    }
    const a = m.attributes[k];
    if (!a) continue;
    const arr = f32Of(r, a);
    geo.setAttribute(
      k,
      opts.float32Attribute ? new THREE.Float32BufferAttribute(arr, a.itemSize) : new THREE.BufferAttribute(arr, a.itemSize)
    );
  }
  if (opts.boundingBox) geo.computeBoundingBox();
  return geo;
}
