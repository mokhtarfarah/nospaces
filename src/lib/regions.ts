import type { Item } from './database.types'
import { GAP_MEDIA_TYPES } from './gaps'

// Country-of-origin backfill. Pulls each media item's region from Wikidata
// (free — no Anthropic) and stores it on metadata.countries. film/tv use the
// work's country (P495); book/music use the creator's country (P27/P495/P17) —
// resolved server-side in /api/wiki. See ROADMAP "Regions map / country filter".
//
// We only persist real hits — an item with no country found is left untagged so
// a later run (better data, or an improved resolver) retries it. Re-running is
// free and idempotent.
//
// REGION_VERSION stamps each saved tag. Bump it when the resolver logic changes
// so the next backfill re-cleans already-tagged items (e.g. v2 fixed bands +
// over-tagging like Ulysses → France/UK/Ireland/US). Items below the current
// version are treated as needing a re-pull.
export const REGION_VERSION = 2

export interface RegionProgress { done: number; total: number; filled: number; failed: number }

// True once an item carries at least one country from the CURRENT resolver.
export function hasRegion(item: Item): boolean {
  return Array.isArray(item.metadata?.countries)
    && (item.metadata.countries as string[]).length > 0
    && ((item.metadata?.regionV as number | undefined) ?? 0) >= REGION_VERSION
}

// Items eligible for a region pull: media types we can resolve, not yet tagged
// (or tagged by an older resolver version).
export function itemsNeedingRegion(items: Item[]): Item[] {
  return items.filter(i => GAP_MEDIA_TYPES.includes(i.type) && !hasRegion(i))
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const CHUNK = 12        // items resolved per server request
const CONCURRENCY = 3   // chunks in flight at once

interface BatchResult { id: string; countries: string[] }

// Resolve one chunk server-side (/api/wiki POST). Returns the per-item results,
// or null if the request kept failing. Retried with backoff — but failures are
// now rare because we make ~70 requests total instead of 835+.
async function pullChunk(chunk: Item[], headers: HeadersInit): Promise<BatchResult[] | null> {
  const body = JSON.stringify({
    items: chunk.map(i => ({
      id: i.id, type: i.type, title: i.title,
      creator: i.creator ?? '', year: i.year ?? '',
      wikiUrl: (i.metadata?.wikiUrl as string | undefined) ?? '',
    })),
  })
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('/api/wiki', { method: 'POST', headers, body })
      if (res.ok) {
        const data = await res.json() as { results?: BatchResult[] }
        return Array.isArray(data.results) ? data.results : []
      }
      if (res.status < 500 && res.status !== 429) return null
    } catch { /* network — retry */ }
    await sleep(500 * (attempt + 1))
  }
  return null
}

// Run the backfill over the whole library in server-side batches. Each request
// resolves a chunk of items, so the browser makes few calls (no per-item
// fan-out that overran Vercel's function limits). Only real hits are persisted;
// misses and failures stay untagged so re-running mops them up.
export async function pullRegions(
  items: Item[],
  headers: HeadersInit,
  save: (id: string, patch: Record<string, unknown>) => Promise<void> | void,
  onProgress?: (p: RegionProgress) => void,
): Promise<RegionProgress> {
  const queue = itemsNeedingRegion(items)
  const total = queue.length
  let done = 0
  let filled = 0
  let failed = 0

  const chunks: Item[][] = []
  for (let i = 0; i < queue.length; i += CHUNK) chunks.push(queue.slice(i, i + CHUNK))

  let next = 0
  const worker = async () => {
    while (next < chunks.length) {
      const chunk = chunks[next++]
      const results = await pullChunk(chunk, headers)
      if (results === null) {
        failed += chunk.length  // whole chunk couldn't be reached — re-run retries
      } else {
        const byId = new Map(results.map(r => [r.id, r.countries]))
        for (const item of chunk) {
          const countries = byId.get(item.id)
          if (countries === undefined) { failed++; continue }
          if (countries.length) { await save(item.id, { countries, regionV: REGION_VERSION }); filled++ }
        }
      }
      done += chunk.length
      onProgress?.({ done, total, filled, failed })
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker))
  return { done, total, filled, failed }
}
