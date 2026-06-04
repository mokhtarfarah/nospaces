import { describe, it, expect } from 'vitest'
import { milesBetween, likedArtists, lovedArtistKeys } from './shows'
import type { Item } from './database.types'

function music(partial: Partial<Item>): Item {
  return {
    id: 'x', user_id: 'u', title: 't', creator: 'Artist', type: 'music', year: 2020,
    status: 'done', reaction: 'loved_it', note: null, source: 'manual', source_detail: null,
    recommended_by: null, metadata: {}, tags: [], moods: [],
    date_added: '', date_done: null, created_at: '', updated_at: '',
    ...partial,
  }
}

describe('milesBetween', () => {
  it('is zero for the same point', () => {
    expect(milesBetween(40.7, -74, 40.7, -74)).toBeCloseTo(0, 5)
  })

  it('approximates NYC→LA (~2440 mi)', () => {
    const d = milesBetween(40.7128, -74.006, 34.0522, -118.2437)
    expect(d).toBeGreaterThan(2400)
    expect(d).toBeLessThan(2500)
  })
})

describe('likedArtists', () => {
  it('includes only positively-rated music, deduped and sorted', () => {
    const items = [
      music({ creator: 'Beach House', reaction: 'loved_it' }),
      music({ creator: 'beach house', reaction: 'liked_it' }), // dup (case)
      music({ creator: 'Aphex Twin', reaction: 'liked_it' }),
      music({ creator: 'Nickelback', reaction: 'eh' }),         // not positive
      music({ creator: 'Skip', reaction: null }),               // no reaction
    ]
    expect(likedArtists(items)).toEqual(['Aphex Twin', 'Beach House'])
  })

  it('excludes non-music and "various artists"', () => {
    const items = [
      music({ creator: 'Various Artists', reaction: 'loved_it' }),
      music({ type: 'film', creator: 'A Director', reaction: 'loved_it' }),
    ]
    expect(likedArtists(items)).toEqual([])
  })
})

describe('lovedArtistKeys', () => {
  it('returns lowercased keys for loved music only (not merely liked)', () => {
    const items = [
      music({ creator: 'Fishmans', reaction: 'loved_it' }),
      music({ creator: 'Liked Band', reaction: 'liked_it' }),
    ]
    const keys = lovedArtistKeys(items)
    expect(keys.has('fishmans')).toBe(true)
    expect(keys.has('liked band')).toBe(false)
  })
})
