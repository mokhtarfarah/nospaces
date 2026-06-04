import { describe, it, expect } from 'vitest'
import { albumKey, buildSpotifyInserts } from './spotify'
import type { SpotifyAlbum } from './spotify'

const album = (partial: Partial<SpotifyAlbum> & { id: string; title: string; creator: string }): SpotifyAlbum => ({
  year: 2024, url: null, coverUrl: null, addedAt: null, ...partial,
})

describe('albumKey', () => {
  it('normalizes punctuation, case, and spacing', () => {
    expect(albumKey('MOTOMAMI', 'Tyler')).toBe(albumKey('motomami!!', '  tyler  '))
  })

  it('folds accents so accented and unaccented spellings dedupe', () => {
    expect(albumKey('LUX', 'Rosalía')).toBe('lux|rosalia')
    expect(albumKey('LUX', 'Rosalía')).toBe(albumKey('LUX', 'Rosalia'))
    expect(albumKey('Björk', 'Björk')).toBe('bjork|bjork')
  })
})

describe('buildSpotifyInserts', () => {
  it('first import lands everything as want_to', () => {
    const { inserts } = buildSpotifyInserts(
      [album({ id: '1', title: 'LUX', creator: 'Rosalía' })],
      new Set(), new Set(), true,
    )
    expect(inserts[0]).toMatchObject({ status: 'want_to', date_done: null, type: 'music', source_detail: 'spotify' })
  })

  it('later sync lands new albums as done', () => {
    const { inserts } = buildSpotifyInserts(
      [album({ id: '1', title: 'LUX', creator: 'Rosalía', addedAt: '2024-05-01T00:00:00.000Z' })],
      new Set(), new Set(), false,
    )
    expect(inserts[0]).toMatchObject({ status: 'done', date_done: '2024-05-01T00:00:00.000Z' })
  })

  it('skips albums matching an existing title+artist key', () => {
    const existing = new Set([albumKey('LUX', 'Rosalía')])
    const { inserts, skippedExisting } = buildSpotifyInserts(
      [album({ id: '1', title: 'LUX', creator: 'Rosalía' })], existing, new Set(), false,
    )
    expect(inserts).toHaveLength(0)
    expect(skippedExisting).toBe(1)
  })

  it('skips albums whose spotify id was already imported', () => {
    const { inserts, skippedExisting } = buildSpotifyInserts(
      [album({ id: 'abc', title: 'LUX', creator: 'Rosalía' })], new Set(), new Set(['abc']), false,
    )
    expect(inserts).toHaveLength(0)
    expect(skippedExisting).toBe(1)
  })

  it('dedupes within the same batch', () => {
    const { inserts, skippedExisting } = buildSpotifyInserts(
      [
        album({ id: '1', title: 'LUX', creator: 'Rosalia' }),
        album({ id: '2', title: 'lux!', creator: '  rosalia  ' }),
      ],
      new Set(), new Set(), true,
    )
    expect(inserts).toHaveLength(1)
    expect(skippedExisting).toBe(1)
  })

  it('carries spotify metadata through', () => {
    const { inserts } = buildSpotifyInserts(
      [album({ id: 'sid', title: 'LUX', creator: 'Rosalía', url: 'http://s', coverUrl: 'http://c' })],
      new Set(), new Set(), true,
    )
    expect(inserts[0].metadata).toEqual({ spotifyId: 'sid', spotifyUrl: 'http://s', coverUrl: 'http://c' })
  })
})
