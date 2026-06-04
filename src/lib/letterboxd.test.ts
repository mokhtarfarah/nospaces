import { describe, it, expect } from 'vitest'
import { parseCsv, parseLetterboxdCsv, ratingToReaction, filmKey, buildInserts } from './letterboxd'
import type { ParsedFilm } from './letterboxd'

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })

  it('handles quoted fields with embedded commas', () => {
    expect(parseCsv('Name,Year\n"Dune: Part Two, Extended",2024'))
      .toEqual([['Name', 'Year'], ['Dune: Part Two, Extended', '2024']])
  })

  it('handles escaped quotes inside a field', () => {
    expect(parseCsv('Name\n"She said ""hi"""'))
      .toEqual([['Name'], ['She said "hi"']])
  })

  it('handles quoted fields with embedded newlines', () => {
    expect(parseCsv('Name,Note\n"Title","line1\nline2"'))
      .toEqual([['Name', 'Note'], ['Title', 'line1\nline2']])
  })

  it('swallows \\r\\n as one break and strips a BOM', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('drops fully-empty trailing rows', () => {
    expect(parseCsv('a,b\n1,2\n\n')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('parseLetterboxdCsv', () => {
  it('parses a ratings export with star ratings', () => {
    const csv = 'Date,Name,Year,Letterboxd URI,Rating\n2024-01-02,Whiplash,2014,http://x,4.5'
    expect(parseLetterboxdCsv(csv)).toEqual([
      { title: 'Whiplash', year: 2014, dateIso: new Date('2024-01-02').toISOString(), rating: 4.5 },
    ])
  })

  it('parses a watchlist export without ratings (rating null)', () => {
    const csv = 'Date,Name,Year,Letterboxd URI\n2024-01-02,Parasite,2019,http://x'
    const out = parseLetterboxdCsv(csv)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ title: 'Parasite', year: 2019, rating: null })
  })

  it('returns [] when there is no Name column', () => {
    expect(parseLetterboxdCsv('Date,Year\n2024,2019')).toEqual([])
  })

  it('returns [] for an empty/headers-only file', () => {
    expect(parseLetterboxdCsv('Name,Year')).toEqual([])
  })

  it('skips rows with a blank title', () => {
    const csv = 'Name,Year\n,2019\nDune,2021'
    expect(parseLetterboxdCsv(csv).map(f => f.title)).toEqual(['Dune'])
  })

  it('yields null year when the year cell is not a number', () => {
    const csv = 'Name,Year\nUntitled,'
    expect(parseLetterboxdCsv(csv)[0].year).toBeNull()
  })
})

describe('ratingToReaction', () => {
  it('maps the full star scale, rounding half-stars to nearest whole', () => {
    expect(ratingToReaction(5)).toBe('loved_it')
    expect(ratingToReaction(4.5)).toBe('loved_it') // rounds to 5
    expect(ratingToReaction(4)).toBe('liked_it')
    expect(ratingToReaction(3.5)).toBe('liked_it') // rounds to 4
    expect(ratingToReaction(3)).toBe('eh')
    expect(ratingToReaction(2.5)).toBe('eh') // rounds to 3
    expect(ratingToReaction(2)).toBe('not_for_me')
    expect(ratingToReaction(0.5)).toBe('not_for_me')
  })
})

describe('filmKey', () => {
  it('is case-insensitive and trims', () => {
    expect(filmKey('  Dune  ', 2021)).toBe(filmKey('dune', 2021))
  })

  it('distinguishes by year', () => {
    expect(filmKey('Dune', 1984)).not.toBe(filmKey('Dune', 2021))
  })

  it('treats null year as empty', () => {
    expect(filmKey('Dune', null)).toBe('dune|')
  })

  it('folds accents so accented spellings dedupe', () => {
    expect(filmKey('Amélie', 2001)).toBe(filmKey('Amelie', 2001))
  })
})

describe('buildInserts', () => {
  const film = (title: string, year: number | null, rating: number | null = null): ParsedFilm =>
    ({ title, year, rating, dateIso: null })

  it('maps watchlist to want_to and ratings to done+reaction', () => {
    const { inserts } = buildInserts(
      [film('Parasite', 2019)],
      [],
      [film('Whiplash', 2014, 5)],
      new Set(),
    )
    const byTitle = Object.fromEntries(inserts.map(i => [i.title, i]))
    expect(byTitle['Parasite']).toMatchObject({ status: 'want_to', reaction: null })
    expect(byTitle['Whiplash']).toMatchObject({ status: 'done', reaction: 'loved_it' })
    expect(byTitle['Whiplash'].metadata).toEqual({ letterboxdRating: 5 })
  })

  it('skips films already in the library', () => {
    const existing = new Set([filmKey('Dune', 2021)])
    const { inserts, skippedExisting } = buildInserts([film('Dune', 2021)], [], [], existing)
    expect(inserts).toHaveLength(0)
    expect(skippedExisting).toBe(1)
  })

  it('prefers rated over watched over watchlist for the same film', () => {
    // Same film in all three files; rated should win.
    const f = (rating: number | null) => film('Dune', 2021, rating)
    const { inserts } = buildInserts([f(null)], [f(null)], [f(4)], new Set())
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({ status: 'done', reaction: 'liked_it' })
  })

  it('does not let a lower-priority duplicate overwrite a higher one', () => {
    // ratings (done+reaction) processed last but watchlist first; result stays rated.
    const { inserts } = buildInserts(
      [film('Dune', 2021)],          // want_to
      [],
      [film('Dune', 2021, 5)],       // rated
      new Set(),
    )
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({ status: 'done', reaction: 'loved_it' })
  })
})
