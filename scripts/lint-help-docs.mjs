import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const jsonPath = resolve(ROOT, 'src/components/help/docs.json');

function fail(msg) {
  console.error(`[help-lint] ${msg}`);
  process.exitCode = 1;
}

try {
  const raw = readFileSync(jsonPath, 'utf8');
  const docs = JSON.parse(raw);
  const seen = new Set();
  for (const d of docs) {
    if (!d.id || !d.label || !d.summary) fail(`Missing required fields on ${d.id || '(no id)'}`);
    if (seen.has(d.id)) fail(`Duplicate id: ${d.id}`);
    seen.add(d.id);
    if ((d.summary || '').length > 120) fail(`Summary too long (>120) on ${d.id}`);
    if (Array.isArray(d.details)) {
      if (d.details.length > 8) fail(`Too many detail bullets (>8) on ${d.id}`);
      for (const t of d.details)
        if ((t || '').length > 160) fail(`Detail too long (>160) on ${d.id}`);
    }
  }
  console.log(`[help-lint] OK: ${docs.length} docs`);
} catch (err) {
  console.error('[help-lint] Failed:', err);
  process.exitCode = 1;
}
