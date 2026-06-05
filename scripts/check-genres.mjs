#!/usr/bin/env node
/**
 * Genre sync guard — run as a pre-commit hook.
 * Extracts the GENRES object from all three copies and diffs them.
 * Exits 1 (blocks commit) if any copy is out of sync with src/lib/genres.ts.
 *
 * The three copies exist because Vercel serverless can't import from src/.
 * When you add/remove a genre, update all three manually, then this script
 * confirms they match before letting the commit through.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const FILES = {
  'src/lib/genres.ts':  resolve(root, 'src/lib/genres.ts'),
  'api/genres.ts':      resolve(root, 'api/genres.ts'),
  'api/identify.ts':    resolve(root, 'api/identify.ts'),
}

// Extract genre arrays from any of the three formats:
//   film: ['a', 'b', ...]          (api/ inline object)
//   'film': ['a', 'b', ...]        (quoted keys)
//   film: [\n    'a', 'b', ...\n]  (multi-line, src/ format)
function extractGenres(src) {
  const result = {}
  // Match each key block — greedily capture everything up to the next key or end of object
  const keyRe = /['"]?(film|tv|book|music|other)['"]?\s*:\s*\[([^\]]*)\]/g
  let m
  while ((m = keyRe.exec(src)) !== null) {
    const key = m[1]
    const raw = m[2]
    const items = [...raw.matchAll(/'([^']+)'/g)].map(x => x[1].trim()).sort()
    result[key] = items
  }
  return result
}

function stringify(genres) {
  return Object.entries(genres)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  ${k}: [${v.join(', ')}]`)
    .join('\n')
}

let failed = false
const sources = {}

for (const [label, path] of Object.entries(FILES)) {
  try {
    sources[label] = extractGenres(readFileSync(path, 'utf8'))
  } catch (e) {
    console.error(`✗ could not read ${label}: ${e.message}`)
    failed = true
  }
}

if (failed) process.exit(1)

const truth = sources['src/lib/genres.ts']

for (const label of ['api/genres.ts', 'api/identify.ts']) {
  const copy = sources[label]
  const diffs = []

  for (const type of ['film', 'tv', 'book', 'music', 'other']) {
    const a = truth[type] ?? []
    const b = copy[type] ?? []
    const added   = b.filter(x => !a.includes(x))
    const removed = a.filter(x => !b.includes(x))
    if (added.length)   diffs.push(`  ${type}: ${label} has extra → ${added.join(', ')}`)
    if (removed.length) diffs.push(`  ${type}: ${label} is missing → ${removed.join(', ')}`)
  }

  if (diffs.length) {
    console.error(`\n✗ genre sync: ${label} is out of sync with src/lib/genres.ts`)
    diffs.forEach(d => console.error(d))
    failed = true
  }
}

if (!failed) {
  console.log('✓ genre sync: all three copies match')
} else {
  console.error('\nFix: update all three copies to match src/lib/genres.ts, then re-commit.')
  console.error('Files: src/lib/genres.ts · api/genres.ts · api/identify.ts\n')
  process.exit(1)
}
