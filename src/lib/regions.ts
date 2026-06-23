import type { Item } from './database.types'
import { GAP_MEDIA_TYPES } from './gaps'

// Country-of-origin backfill. Pulls each media item's region from Wikidata
// (free — no Anthropic) and stores it on metadata.countries. An empty array
// means "pulled, none found" so re-runs skip it. film/tv use the work's country
// (P495); book/music use the creator's nationality (P27) — resolved server-side
// in /api/wiki. See ROADMAP "Regions map / country filter".

export interface RegionProgress { done: number; total: number; filled: number }

// True once a region pull has been attempted (countries present, even if empty).
export function regionPulled(item: Item): boolean {
  return Array.isArray(item.metadata?.countries)
}

// Items eligible for a region pull: media types we know how to resolve, not yet attempted.
export function itemsNeedingRegion(items: Item[]): Item[] {
  return items.filter(i => GAP_MEDIA_TYPES.includes(i.type) && !regionPulled(i))
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
    // No parse object at all → article couldn't be resolved; leave unattempted
    // so a later run (with better data) can retry. Empty countries → attempted.
    if (!data.parsed) return null
    return Array.isArray(data.parsed.countries) ? data.parsed.countries : []
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
      if (countries) {
        await save(item.id, { countries })
        if (countries.length) filled++
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
