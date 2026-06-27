// The media↔thing flip.
//
// Capture sometimes misroutes — a screenshot of a book cover reads as a "product"
// and lands on the board; a newsletter "bag" reads as media and lands in the
// library. The flip is the cheap, one-tap correction: it moves an item across
// domains, reshaping just enough of the row that the other side renders it cleanly.
//
// This is the real safety net behind the confidence-gated review inbox — a
// false-positive is cheap to undo, so we correct-after rather than gate-before.
// Flipping also clears the `review` flag: choosing where it belongs IS the triage.

import type { Item } from './database.types'

export type MediaType = 'film' | 'book' | 'music' | 'tv'
export const MEDIA_TYPES: MediaType[] = ['film', 'book', 'music', 'tv']

/** The fields an editItem call needs to perform a flip. */
export type FlipPatch = {
  type: string
  creator: string | null
  status: string
  reaction: Item['reaction']
  year: number | null
  metadata: Record<string, unknown>
  tags: string[]
}

// Pull the human-facing title out of either domain's metadata, falling back to the
// row's own title (the source of truth on both sides).
function titleOf(item: Item): string {
  const m = (item.metadata ?? {}) as { title?: string }
  return (m.title ?? item.title ?? '').trim() || item.title
}

/**
 * Board THING → media library item. The brand is the closest thing to a creator,
 * so it carries over as a starting guess (the user fixes it in the library). All
 * thing-only metadata (price, attributes, cutout, url, shotType) is dropped — it
 * has no meaning for media. A `capturedBlurb` is kept if present so the action card
 * still has something to show. Year/genre tags start empty for the user to fill.
 */
export function flipThingToMedia(item: Item, type: MediaType): FlipPatch {
  const m = (item.metadata ?? {}) as { brand?: string | null; capturedBlurb?: string }
  return {
    type,
    creator: m.brand ?? null,
    status: item.status === 'done' ? 'done' : 'want_to',
    reaction: null,
    year: null,
    // Strip the product shell; keep only a captured blurb if there was one.
    metadata: { review: false, ...(m.capturedBlurb ? { capturedBlurb: m.capturedBlurb } : {}) },
    tags: [],
  }
}

/**
 * Media library item → board THING (a product). The creator is the closest thing
 * to a brand, so it carries over. Reaction/year/moods/genre-tags are dropped — for
 * objects the signal is the set, not a verdict. A captured blurb (e.g. read off a
 * screenshot) becomes the product note so the reason for saving isn't lost.
 */
export function flipMediaToThing(item: Item): FlipPatch {
  const title = titleOf(item)
  const m = (item.metadata ?? {}) as { capturedBlurb?: string; image?: string | null }
  return {
    type: 'thing',
    creator: item.creator ?? null,
    status: item.status === 'done' ? 'done' : 'want_to',
    reaction: null,
    year: null,
    metadata: {
      kind: 'product',
      title,
      image: m.image ?? null,
      price: null,
      brand: item.creator ?? null,
      url: null,
      attributes: [],
      shotType: null,
      review: false,
      ...(m.capturedBlurb ? { note: m.capturedBlurb } : {}),
    },
    tags: [],
  }
}
