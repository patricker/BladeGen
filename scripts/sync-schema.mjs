import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// Copies the canonical JSON Schema into the public/ tree so it is served at
// '/schema/sword.schema.json' in dev and production builds.

const ROOT = process.cwd()
const SRC = resolve(ROOT, 'schema/sword.schema.json')
const DEST = resolve(ROOT, 'public/schema/sword.schema.json')

function main() {
  if (!existsSync(SRC)) {
    console.warn('[sync-schema] Source not found:', SRC)
    return
  }
  const outDir = dirname(DEST)
  mkdirSync(outDir, { recursive: true })
  const srcText = readFileSync(SRC, 'utf-8')
  let needsWrite = true
  try {
    const prev = readFileSync(DEST, 'utf-8')
    needsWrite = prev !== srcText
  } catch {}
  if (needsWrite) {
    writeFileSync(DEST, srcText)
    console.log('[sync-schema] Wrote', DEST)
  } else {
    console.log('[sync-schema] Up to date')
  }
}

main()

