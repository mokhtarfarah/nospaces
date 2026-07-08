import { describe, it, expect } from 'vitest'
import { scoreMatch, rankCandidates } from '../../api/lookup'

// These guard the "look it up online" (add → catalog lookup) ranking. Before this,
// the normal path concatenated results music-first with no dedup, so a film's
// soundtrack could beat the film and the same book appeared three times.

describe('scoreMatch', () => {
  it('gives an exact (normalized) title the top score', () => {
    expect(scoreMatch('The Godfather', 'the godfather')).toBe(1)
    expect(scoreMatch('Dune: Part Two', 'Dune Part Two')).toBe(1) // punctuation ignored
    expect(scoreMatch('Rosalía', 'rosalia')).toBe(1)              // diacritics folded
  })

  it('ranks the film above a soundtrack that merely shares its name', () => {
    const film = scoreMatch('Oppenheimer', 'Oppenheimer')
    const soundtrack = scoreMatch('Oppenheimer (Original Motion Picture Soundtrack)', 'Oppenheimer')
    expect(film).toBeGreaterThan(soundtrack)
  })

  it('still matches a clean title against an author-augmented query', () => {
    // describe rewrites "middlemarch" → "Middlemarch George Eliot"
    const hit = scoreMatch('Middlemarch', 'Middlemarch George Eliot')
    const miss = scoreMatch('War and Peace', 'Middlemarch George Eliot')
    expect(hit).toBeGreaterThan(0.4)
    expect(miss).toBe(0)
  })

  it('scores an unrelated title at zero', () => {
    expect(scoreMatch('Barbie', 'Oppenheimer')).toBe(0)
  })

  it('does not treat a shared stopword as a match (s109 — "the memory police" scored "The Police" and "The Complete Sherlock Holmes")', () => {
    expect(scoreMatch('The Complete Sherlock Holmes', 'the memory police')).toBe(0)
    expect(scoreMatch('The Great Gatsby', 'the memory police')).toBe(0)
  })
})

describe('rankCandidates', () => {
  const c = (title: string, type: string, year: number | null = null, creator = '') =>
    ({ title, type, year, creator })

  it('collapses duplicate editions of the same book', () => {
    const out = rankCandidates([
      c('Middlemarch', 'book', 1800, 'George Eliot'),
      c('Middlemarch', 'book', 1964, 'George Eliot'),
      c('Middlemarch', 'book', 2000, 'George Eliot'),
    ], 'Middlemarch George Eliot')
    expect(out).toHaveLength(1)
    expect(out[0].year).toBe(1800) // keeps the earliest across the duplicates
  })

  it('floats the film above the soundtrack across sources', () => {
    const out = rankCandidates([
      c('Oppenheimer (Original Motion Picture Soundtrack)', 'music', 2023, 'Ludwig Göransson'),
      c('Oppenheimer', 'film', 2023),
    ], 'Oppenheimer')
    expect(out[0].type).toBe('film')
  })

  it('uses the medium guess as a tiebreak boost, not a hard filter', () => {
    const items = [c('Dune', 'book', 1965, 'Frank Herbert'), c('Dune', 'film', 2021)]
    // guessing "film" floats the film…
    expect(rankCandidates(items, 'Dune', 'film')[0].type).toBe('film')
    // …but a wrong "music" guess still keeps both real matches present
    const wrong = rankCandidates(items, 'Dune', 'music')
    expect(wrong.map(x => x.type).sort()).toEqual(['book', 'film'])
  })

  it('backfills a missing creator/year from a duplicate', () => {
    const out = rankCandidates([
      c('Normal People', 'book', null, ''),
      c('Normal People', 'book', 2018, 'Sally Rooney'),
    ], 'Normal People Sally Rooney')
    expect(out).toHaveLength(1)
    expect(out[0].creator).toBe('Sally Rooney')
    expect(out[0].year).toBe(2018)
  })

  it('drops candidates with zero real relevance instead of ranking them last (s109)', () => {
    const out = rankCandidates([
      c('The Memory Police', 'book', 2020, 'Yōko Ogawa'),
      c('The Police (Remastered)', 'music', 2007, 'The Police'),
      c('Pretty. Odd. (Deluxe Version)', 'music', 2008, 'Panic! At the Disco'),
      c('The Complete Sherlock Holmes', 'book', 1900, 'Arthur Conan Doyle'),
    ], 'the memory police')
    expect(out.map(x => x.title)).not.toContain('Pretty. Odd. (Deluxe Version)')
    expect(out.map(x => x.title)).not.toContain('The Complete Sherlock Holmes')
    expect(out[0].title).toBe('The Memory Police')
  })
})
