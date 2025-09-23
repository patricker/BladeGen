import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname, extname } from 'node:path';

// Migrates Markdown docs under docs/help/controls/** into src/components/help/docs.json
// Each .md file should contain a fenced JSON block at the top:
// ```json
// { "id":"blade.curvature", "label":"Blade Curvature", "summary":"...", "details":["..."], "parts":["blade"] }
// ```

const ROOT = process.cwd();
const mdRoots = [
  resolve(ROOT, 'docs/help/controls'),
  resolve(ROOT, 'docs/help/concepts'),
  resolve(ROOT, 'docs/help/tasks'),
];
const jsonTarget = resolve(ROOT, 'src/components/help/docs.json');

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (s.isFile() && extname(p).toLowerCase() === '.md') out.push(p);
  }
  return out;
}

function extractJsonFromMd(md) {
  // Find first fenced JSON block
  const start = md.indexOf('```json');
  if (start < 0) return null;
  const rest = md.slice(start + 7);
  const end = rest.indexOf('```');
  if (end < 0) return null;
  const jsonText = rest.slice(0, end).trim();
  if (!jsonText) return null;
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function readExistingDocsJSON() {
  try {
    const raw = readFileSync(jsonTarget, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

try {
  const incoming = [];
  const files = mdRoots.flatMap((dir) => walk(dir));
  for (const f of files) {
    try {
      const md = readFileSync(f, 'utf8');
      const doc = extractJsonFromMd(md);
      if (doc && doc.id && doc.label && doc.summary) incoming.push(doc);
    } catch {}
  }

  const existing = readExistingDocsJSON();
  const byId = new Map(existing.map((d) => [d.id, d]));
  for (const d of incoming) byId.set(d.id, d);
  const merged = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
  mkdirSync(dirname(jsonTarget), { recursive: true });
  writeFileSync(jsonTarget, JSON.stringify(merged, null, 2));
  console.log(
    `[help-docs] Merged ${incoming.length} MD docs into ${merged.length} JSON docs -> ${jsonTarget}`
  );
} catch (err) {
  console.error('[help-docs] Failed to build docs.json from Markdown:', err);
  process.exit(0);
}
