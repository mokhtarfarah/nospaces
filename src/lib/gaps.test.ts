import { describe, it, expect } from 'vitest'
import { itemGaps, dismissGaps, gapQueue } from './gaps'
import type { Item } from './database.types'

// Minimal Item factory — only the fields gaps logic reads matter; the rest are
// filled with valid defaults so the type is satisfied.
function makeItem(partial: Partial<Item>): Item {
  return {
    id: 'x', user_id: 'u', title: 't', creator: 'c', type: 'film', year: 2020,
    status: 'want_to', reaction: null, note: null, source: 'manual', source_detail: null,
    recommended_by: null, metadata: {}, tags: ['drama'], moods: [],
    date_added: '', date_done: null, created_at: '', updated_at: '',
    ...partial,
  }
}

describe('itemGaps', () => {
  it('returns no gaps for a fully-filled film', () => {
    const item = makeItem({ metadata: { runtime: 120, wikiUrl: 'http://w' } })
    expect(itemGaps(item)).toEqual([])
  })

  it('ignores non-media types entirely', () => {
    expect(itemGaps(makeItem({ type: 'other', year: null, creator: null, tags: [] }))).toEqual([])
  })

  it('flags missing year, creator, and genre', () => {
    const item = makeItem({ year: null, creator: '  ', tags: ['short'], metadata: { runtime: 90, wikiUrl: 'w' } })
    expect(itemGaps(item)).toEqual(expect.arrayContaining(['year', 'creator', 'genre']))
  })

  it('does not count a descriptor-only tag list as having a genre', () => {
    // 'short' is a free-text descriptor, not in the genre vocab.
    const item = makeItem({ tags: ['short'], metadata: { runtime: 90, wikiUrl: 'w' } })
    expect(itemGaps(item)).toContain('genre')
  })

  it('flags pages for books and runtime for film/tv', () => {
    const book = makeItem({ type: 'book', tags: ['fiction'], metadata: { wikiUrl: 'w' } })
    expect(itemGaps(book)).toContain('pages')
    expect(itemGaps(book)).not.toContain('runtime')

    const film = makeItem({ type: 'film', tags: ['drama'], metadata: { wikiUrl: 'w' } })
    expect(itemGaps(film)).toContain('runtime')
    expect(itemGaps(film)).not.toContain('pages')
  })

  it('flags a missing wiki link', () => {
    const item = makeItem({ metadata: { runtime: 90 } })
    expect(itemGaps(item)).toContain('wiki')
  })

  it('excludes gaps the user has dismissed', () => {
    const item = makeItem({ year: null, metadata: { runtime: 90, wikiUrl: 'w', dismissedGaps: ['year'] } })
    expect(itemGaps(item)).not.toContain('year')
  })
})

describe('dismissGaps', () => {
  it('adds gaps to dismissedGaps without duplicating', () => {
    const item = makeItem({ metadata: { dismissedGaps: ['year'] } })
    const meta = dismissGaps(item, ['year', 'creator'])
    expect(meta.dismissedGaps).toEqual(['year', 'creator'])
  })

  it('preserves other metadata keys', () => {
    const item = makeItem({ metadata: { wikiUrl: 'w' } })
    expect(dismissGaps(item, ['year'])).toMatchObject({ wikiUrl: 'w', dismissedGaps: ['year'] })
  })
})

describe('gapQueue', () => {
  it('keeps only gappy items, most-gappy first', () => {
    const clean = makeItem({ id: 'clean', metadata: { runtime: 90, wikiUrl: 'w' } })
    const oneGap = makeItem({ id: 'one', metadata: { wikiUrl: 'w' } }) // missing runtime
    const manyGaps = makeItem({ id: 'many', year: null, creator: null, tags: [], metadata: {} })
    const q = gapQueue([oneGap, clean, manyGaps])
    expect(q.map(x => x.item.id)).toEqual(['many', 'one'])
  })
})
