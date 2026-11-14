// Validate every real Rust manifest and every baked GLB buffer offline.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
const validate = new Ajv2020({ strict: false }).compile(
  JSON.parse(fs.readFileSync('schema/explore.recipe.schema.json', 'utf8'))
);
function* files(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'git-history') yield* files(p);
    else if (e.isFile()) yield p;
  }
}
let manifests = 0;
let glbs = 0;
for (const p of files('explore/out')) {
  if (path.basename(p) === 'recipe.json') {
    assert(
      validate(JSON.parse(fs.readFileSync(p, 'utf8'))),
      `${p}: ${JSON.stringify(validate.errors)}`
    );
    manifests++;
  }
  if (!p.endsWith('.glb')) continue;
  const b = fs.readFileSync(p);
  assert.equal(b.readUInt32LE(0), 0x46546c67);
  assert.equal(b.readUInt32LE(4), 2);
  assert.equal(b.readUInt32LE(8), b.length);
  const jlen = b.readUInt32LE(12);
  const g = JSON.parse(b.toString('utf8', 20, 20 + jlen));
  const binStart = 28 + jlen;
  assert(binStart + g.buffers[0].byteLength <= b.length);
  const read = (id) => {
    const a = g.accessors[id];
    const v = g.bufferViews[a.bufferView];
    const width = a.type === 'VEC3' ? 3 : 1;
    assert.equal(v.byteLength, a.count * width * 4);
    const out = [];
    for (let i = 0; i < a.count * width; i++) {
      out.push(
        a.componentType === 5126
          ? b.readFloatLE(binStart + v.byteOffset + i * 4)
          : b.readUInt32LE(binStart + v.byteOffset + i * 4)
      );
    }
    return out;
  };
  for (const mesh of g.meshes)
    for (const primitive of mesh.primitives) {
      const pos = read(primitive.attributes.POSITION);
      const normals = read(primitive.attributes.NORMAL);
      const index = read(primitive.indices);
      assert.equal(pos.length, normals.length);
      assert(pos.every(Number.isFinite));
      assert(normals.every(Number.isFinite));
      assert(index.every((i) => i >= 0 && i < pos.length / 3));
      for (let i = 0; i < normals.length; i += 3) {
        const length = Math.hypot(...normals.slice(i, i + 3));
        assert(length < 1e-8 || Math.abs(length - 1) < 1e-5, `${p}: nonunit baked normal`);
      }
    }
  glbs++;
}
assert.equal(manifests, 25, 'one replay manifest per idea');
assert(glbs >= 50, 'all ideas plus read frames, explorer cells and LOD exports');
console.log(
  `${manifests} real manifests validate; ${glbs} GLBs have valid lengths, indices and finite unit normals.`
);
