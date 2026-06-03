import type { Item } from './database.types'
import { isGenreTag } from './genres'

export const GAP_MEDIA_TYPES = ['film', 'tv', 'book', 'music']

// Cheap, data-only gaps for an item (cover is resolved separately per row, since
// it needs the art API). Returns the human labels of what's missing.
// Gaps listed in metadata.dismissedGaps are excluded — the user has confirmed
// that data doesn't exist for this item.
export function itemGaps(item: Item): string[] {
  if (!GAP_MEDIA_TYPES.includes(item.type)) return []
  const dismissed = new Set<string>((item.metadata?.dismissedGaps as string[] | undefined) ?? [])
  const gaps: string[] = []
  if (!item.year && !dismissed.has('year')) gaps.push('year')
  if (!item.creator?.trim() && !dismissed.has('creator')) gaps.push('creator')
  if (!(item.tags ?? []).some(isGenreTag) && !dismissed.has('genre')) gaps.push('genre')
  if (item.type === 'book') { if (!item.metadata?.pages && !dismissed.has('pages')) gaps.push('pages') }
  else if (item.type === 'film' || item.type === 'tv') { if (!item.metadata?.runtime && !dismissed.has('runtime')) gaps.push('runtime') }
  if (!item.metadata?.wikiUrl && !dismissed.has('wiki')) gaps.push('wiki')
  return gaps
}

// Mark specific gaps as dismissed for an item (data confirmed non-existent).
// Returns the new metadata object to save via editItem.
export function dismissGaps(item: Item, gaps: string[]): Record<string, unknown> {
  const existing = (item.metadata?.dismissedGaps as string[] | undefined) ?? []
  const next = [...new Set([...existing, ...gaps])]
  return { ...item.metadata, dismissedGaps: next }
}

// The fill-by-hand / tidy-queue order: most-gappy items first.
export function gapQueue(items: Item[]): { item: Item; gaps: string[] }[] {
  return items
    .map(i => ({ item: i, gaps: itemGaps(i) }))
    .filter(x => x.gaps.length > 0)
    .sort((a, b) => b.gaps.length - a.gaps.length)
}
