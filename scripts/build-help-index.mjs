import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const ROOT = process.cwd();
const src = resolve(ROOT, 'src/components/help/docs.json');
const out = resolve(ROOT, 'public/help-index.json');

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function buildIndex(docs) {
  const index = Object.create(null);
  for (const d of docs) {
    const blob = [d.label, d.summary, ...(d.details || [])].join(' ');
    const terms = new Set(tokenize(blob));
    // light synonyms
    if (d.id.includes('fuller')) {
      terms.add('rib');
      terms.add('blood');
      terms.add('groove');
    }
    for (const t of terms) {
      if (!index[t]) index[t] = [];
      index[t].push(d.id);
    }
  }
  return index;
}

try {
  const raw = readFileSync(src, 'utf8');
  const docs = JSON.parse(raw);
  const index = buildIndex(docs);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ version: 1, count: docs.length, index }, null, 2));
  console.log(
    `[help-index] Wrote ${Object.keys(index).length} terms for ${docs.length} docs -> ${out}`
  );
} catch (err) {
  console.error('[help-index] Failed to build index:', err);
  process.exit(0);
}
