import { describe, it, expect } from 'vitest'
import { flipThingToMedia, flipMediaToThing } from './flip'
import type { Item } from './database.types'

function baseItem(over: Partial<Item> = {}): Item {
  return {
    id: 'i1', user_id: 'u1', title: 'Untitled', creator: null, type: 'thing', year: null,
    status: 'want_to', reaction: null, note: null, source: 'email', source_detail: null,
    recommended_by: null, metadata: {}, tags: [], moods: [], date_added: '2026-01-01',
    date_done: null, created_at: '2026-01-01', updated_at: '2026-01-01', ...over,
  }
}

describe('flipThingToMedia', () => {
  it('moves a board product to a media type, brand → creator, strips product shell', () => {
    const thing = baseItem({
      title: 'Dune', type: 'thing',
      metadata: { kind: 'product', title: 'Dune', brand: 'Penguin', price: '£12', attributes: [{ facet: 'palette', value: 'earth' }], review: true },
    })
    const p = flipThingToMedia(thing, 'book')
    expect(p.type).toBe('book')
    expect(p.creator).toBe('Penguin')
    expect(p.metadata).toEqual({ review: false })
    expect(p.tags).toEqual([])
    expect(p.reaction).toBeNull()
  })

  it('clears the review flag (flipping is the triage)', () => {
    const thing = baseItem({ metadata: { kind: 'product', title: 'x', brand: null, review: true } })
    expect(flipThingToMedia(thing, 'film').metadata.review).toBe(false)
  })

  it('keeps a captured blurb across the flip', () => {
    const thing = baseItem({ metadata: { kind: 'product', title: 'x', capturedBlurb: 'a note' } })
    expect(flipThingToMedia(thing, 'film').metadata.capturedBlurb).toBe('a note')
  })

  it('preserves done status', () => {
    const thing = baseItem({ status: 'done', metadata: { kind: 'product', title: 'x' } })
    expect(flipThingToMedia(thing, 'film').status).toBe('done')
  })
})

describe('flipMediaToThing', () => {
  it('moves a media item to a product, creator → brand, builds the product shell', () => {
    const media = baseItem({ title: 'Past Lives', type: 'film', creator: 'Celine Song', year: 2023, reaction: 'loved_it', tags: ['drama'] })
    const p = flipMediaToThing(media)
    expect(p.type).toBe('thing')
    expect(p.creator).toBe('Celine Song')
    expect(p.metadata.kind).toBe('product')
    expect(p.metadata.brand).toBe('Celine Song')
    expect(p.metadata.title).toBe('Past Lives')
    expect(p.metadata.review).toBe(false)
    expect(p.reaction).toBeNull()
    expect(p.year).toBeNull()
    expect(p.tags).toEqual([])
  })

  it('prefers metadata.title when present', () => {
    const media = baseItem({ title: 'fallback', metadata: { title: 'Real Title' } })
    expect(flipMediaToThing(media).metadata.title).toBe('Real Title')
  })

  it('turns a captured blurb into the product note', () => {
    const media = baseItem({ metadata: { title: 'x', capturedBlurb: 'saw it in a shop' } })
    expect(flipMediaToThing(media).metadata.note).toBe('saw it in a shop')
  })
})
