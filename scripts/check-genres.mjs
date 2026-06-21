#!/usr/bin/env node
/**
 * Genre sync guard — run as a pre-commit hook.
 * Diffs the two genre-vocab copies and exits 1 (blocks commit) if they drift.
 *
 * There are only two copies now: src/lib/genres.ts (frontend source of truth)
 * and api/_genres.ts (shared by every Vercel function — they can't import from
 * src/). All api/ endpoints import from api/_genres.ts, so updating these two
 * files keeps the whole app in sync. When you add/remove a genre, update both,
 * then this script confirms they match before letting the commit through.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const FILES = {
  'src/lib/genres.ts':  resolve(root, 'src/lib/genres.ts'),
  'api/_genres.ts':     resolve(root, 'api/_genres.ts'),
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

for (const label of ['api/_genres.ts']) {
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
  console.log('✓ genre sync: src/lib/genres.ts and api/_genres.ts match')
} else {
  console.error('\nFix: update both copies to match, then re-commit.')
  console.error('Files: src/lib/genres.ts · api/_genres.ts\n')
  process.exit(1)
}
