import { describe, it, expect } from 'vitest'
import { genresForType, isGenreTag } from './genres'

describe('genresForType', () => {
  it('returns the vocab for a known type', () => {
    expect(genresForType('film')).toContain('thriller')
  })

  it('falls back to empty for an unknown type', () => {
    expect(genresForType('podcast')).toEqual([])
    expect(genresForType('other')).toEqual([])
  })
})

describe('isGenreTag', () => {
  it('recognizes real genres case-insensitively', () => {
    expect(isGenreTag('Drama')).toBe(true)
    expect(isGenreTag('hip-hop')).toBe(true)
    expect(isGenreTag('historical fiction')).toBe(true)
  })

  it('rejects free-text descriptors', () => {
    expect(isGenreTag('New York')).toBe(false)
    expect(isGenreTag('ensemble cast')).toBe(false)
    expect(isGenreTag('')).toBe(false)
  })
})
