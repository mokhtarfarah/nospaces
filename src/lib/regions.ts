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

export interface RegionProgress { done: number; total: number; filled: number }

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

interface ParsedRegion { countries?: string[] }

async function pullOne(item: Item, headers: HeadersInit): Promise<string[] | null> {
  const wikiUrl = (item.metadata?.wikiUrl as string | undefined)?.trim()
  // Prefer a stored article (reliable); otherwise resolve by title/type search.
  const url = wikiUrl
    ? `/api/wiki?url=${encodeURIComponent(wikiUrl)}&type=${encodeURIComponent(item.type)}&parse=1`
    : `/api/wiki?type=${encodeURIComponent(item.type)}&title=${encodeURIComponent(item.title)}` +
      `${item.creator ? `&creator=${encodeURIComponent(item.creator)}` : ''}` +
      `${item.year ? `&year=${item.year}` : ''}&parse=1`
  try {
    const res = await fetch(url, { headers })
    if (!res.ok) return null
    const data = await res.json() as { parsed?: ParsedRegion | null }
    return Array.isArray(data.parsed?.countries) ? data.parsed.countries : null
  } catch {
    return null
  }
}

// Run the backfill over the whole library. Sequential-ish with light concurrency
// to stay gentle on Wikidata. Saves via the caller's patchMetadata.
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
  const CONCURRENCY = 3

  async function worker(slice: Item[]) {
    for (const item of slice) {
      const countries = await pullOne(item, headers)
      // Only persist real hits — leave misses untagged so a re-run retries them.
      if (countries && countries.length) {
        await save(item.id, { countries, regionV: REGION_VERSION })
        filled++
      }
      done++
      onProgress?.({ done, total, filled })
    }
  }

  // Round-robin items into N worker slices.
  const slices: Item[][] = Array.from({ length: CONCURRENCY }, () => [])
  queue.forEach((item, i) => slices[i % CONCURRENCY].push(item))
  await Promise.all(slices.map(worker))

  return { done, total, filled }
}
