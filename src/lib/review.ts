// The "for review" inbox.
//
// Captures that arrive in bulk or without a deliberate confirm step — forwarded
// emails, recommendation PDFs, and un-identified "save & identify later" notes —
// land here first instead of dropping straight into the clean library. The user
// triages them (keep with a status/reaction, or remove) when they next open the
// app.
//
// Membership is a plain `metadata.review` flag (no DB migration, fully
// reversible). Legacy "scratch" captures (saved before this flag existed) are
// also treated as in-review until explicitly cleared, so nothing is stranded.

import type { Item } from './database.types'

/** True if the item is sitting in the review inbox (awaiting triage). */
export function inReview(item: Item): boolean {
  const r = item.metadata?.review
  if (r === true) return true
  if (r === false) return false
  // No explicit flag: legacy un-identified scratch captures still count.
  return item.metadata?.scratch === true
}

/** How many items are awaiting review (for the chip badge). */
export function reviewCount(items: Item[]): number {
  return items.reduce((n, it) => (inReview(it) ? n + 1 : n), 0)
}

/**
 * Metadata for an item being kept/cleared from the inbox. Sets `review:false`
 * explicitly so the item leaves the inbox for good (even legacy scratch items),
 * without disturbing any other metadata.
 */
export function clearReviewMeta(item: Item): Record<string, unknown> {
  return { ...item.metadata, review: false }
}
