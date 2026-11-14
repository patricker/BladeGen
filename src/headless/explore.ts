/** Consume exported Rust buffers without duplicating geometry or requiring a new wasm module. */
import * as THREE from 'three';

export interface ExplorationComponent {
  id: string;
  position: number[];
  normal: number[];
  index: number[];
  matrix: number[];
  role: string;
  color: [number, number, number];
  strength: number;
}

export interface ExplorationBuffers {
  format: 'bladegen-explore/1';
  idea: string;
  seed: number;
  bladeLength: number;
  heightM: number;
  sink: number;
  anchors: unknown[];
  components: ExplorationComponent[];
}

/** Returns a metre-scale monument group. Keep this opt-in; regular SwordGenerator is unchanged. */
export function buildExplorationGroup(doc: ExplorationBuffers): THREE.Group {
  if (
    doc.format !== 'bladegen-explore/1' ||
    !Number.isFinite(doc.bladeLength) ||
    doc.bladeLength <= 0
  ) {
    throw new Error('Invalid exploration buffer document');
  }
  if (
    !Number.isFinite(doc.heightM) ||
    doc.heightM < 30 ||
    doc.heightM > 42 ||
    !Number.isFinite(doc.sink) ||
    doc.sink < 0 ||
    doc.sink > 0.4
  ) {
    throw new Error('Invalid exploration monument placement');
  }
  const root = new THREE.Group();
  root.name = 'sword';
  const scale = doc.heightM / doc.bladeLength;
  root.quaternion.set(0, 0, 1, 0);
  root.scale.setScalar(scale);
  root.position.y = doc.heightM * (1 - doc.sink);
  root.userData.exploration = { idea: doc.idea, seed: doc.seed, anchors: doc.anchors };
  const ids = new Set<string>();
  // Validate before allocating any Three resources, so malformed input cannot leak partial groups.
  for (const c of doc.components) {
    if (
      ids.has(c.id) ||
      c.position.length % 3 ||
      c.normal.length !== c.position.length ||
      c.index.length % 3 ||
      c.matrix.length !== 16 ||
      !c.position.length ||
      [...c.position, ...c.normal, ...c.matrix, ...c.color, c.strength].some(
        (x) => !Number.isFinite(x)
      ) ||
      c.index.some((i) => !Number.isInteger(i) || i < 0 || i >= c.position.length / 3)
    ) {
      throw new Error(`Invalid exploration component: ${c.id}`);
    }
    ids.add(c.id);
  }
  for (const c of doc.components) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(c.position, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(c.normal, 3));
    geometry.setIndex(c.index);
    const color = new THREE.Color().setRGB(...c.color, THREE.LinearSRGBColorSpace);
    const material = new THREE.MeshStandardMaterial({
      name: c.role,
      color,
      metalness: c.strength > 0 ? 0 : 0.8,
      roughness: 0.38,
      emissive: c.strength > 0 ? color : new THREE.Color(0),
      emissiveIntensity: c.strength,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = c.id;
    mesh.matrix.fromArray(c.matrix);
    mesh.matrixAutoUpdate = false;
    mesh.userData.role = c.role;
    root.add(mesh);
  }
  root.updateMatrixWorld(true);
  return root;
}
