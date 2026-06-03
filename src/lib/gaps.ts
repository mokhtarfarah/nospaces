import type { Item } from './database.types'
import { isGenreTag } from './genres'

export const GAP_MEDIA_TYPES = ['film', 'tv', 'book', 'music']

// Cheap, data-only gaps for an item (cover is resolved separately per row, since
// it needs the art API). Returns the human labels of what's missing.
export function itemGaps(item: Item): string[] {
  if (!GAP_MEDIA_TYPES.includes(item.type)) return []
  const gaps: string[] = []
  if (!item.year) gaps.push('year')
  if (!item.creator?.trim()) gaps.push('creator')
  if (!(item.tags ?? []).some(isGenreTag)) gaps.push('genre')
  if (item.type === 'book') { if (!item.metadata?.pages) gaps.push('pages') }
  else if (item.type === 'film' || item.type === 'tv') { if (!item.metadata?.runtime) gaps.push('runtime') }
  if (!item.metadata?.wikiUrl) gaps.push('wiki')
  return gaps
}

// The fill-by-hand / tidy-queue order: most-gappy items first.
export function gapQueue(items: Item[]): { item: Item; gaps: string[] }[] {
  return items
    .map(i => ({ item: i, gaps: itemGaps(i) }))
    .filter(x => x.gaps.length > 0)
    .sort((a, b) => b.gaps.length - a.gaps.length)
}
