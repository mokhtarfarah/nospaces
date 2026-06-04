import { describe, it, expect } from 'vitest'
import { inReview, reviewCount, clearReviewMeta } from './review'
import type { Item } from './database.types'

function makeItem(metadata: Record<string, unknown>): Item {
  return {
    id: 'x', user_id: 'u', title: 't', creator: null, type: 'film', year: null,
    status: 'want_to', reaction: null, note: null, source: 'manual', source_detail: null,
    recommended_by: null, metadata, tags: [], moods: [],
    date_added: '', date_done: null, created_at: '', updated_at: '',
  }
}

describe('inReview', () => {
  it('is true when the review flag is set', () => {
    expect(inReview(makeItem({ review: true }))).toBe(true)
  })

  it('is false when explicitly cleared, even for a scratch item', () => {
    expect(inReview(makeItem({ review: false }))).toBe(false)
    expect(inReview(makeItem({ scratch: true, review: false }))).toBe(false)
  })

  it('treats legacy scratch captures (no flag) as in-review', () => {
    expect(inReview(makeItem({ scratch: true }))).toBe(true)
  })

  it('is false for an ordinary library item', () => {
    expect(inReview(makeItem({}))).toBe(false)
    expect(inReview(makeItem({ wikiUrl: 'w' }))).toBe(false)
  })
})

describe('reviewCount', () => {
  it('counts only items awaiting review', () => {
    const items = [
      makeItem({ review: true }),
      makeItem({ scratch: true }),       // legacy → counts
      makeItem({ review: false }),       // cleared → no
      makeItem({}),                      // ordinary → no
    ]
    expect(reviewCount(items)).toBe(2)
  })
})

describe('clearReviewMeta', () => {
  it('sets review:false and preserves other metadata', () => {
    const item = makeItem({ scratch: true, wikiUrl: 'w' })
    expect(clearReviewMeta(item)).toEqual({ scratch: true, wikiUrl: 'w', review: false })
  })
})
