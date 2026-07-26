import { describe, it, expect } from 'vitest'
import { genresForType, isGenreTag, isNonfictionGenre } from './genres'

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

describe('isNonfictionGenre', () => {
  it('recognizes non-fiction book genres case-insensitively', () => {
    expect(isNonfictionGenre('memoir')).toBe(true)
    expect(isNonfictionGenre('History')).toBe(true)
    expect(isNonfictionGenre('self-help')).toBe(true)
  })

  it('treats fiction and ambiguous genres as not non-fiction', () => {
    expect(isNonfictionGenre('sci-fi')).toBe(false)
    expect(isNonfictionGenre('literary fiction')).toBe(false)
    // deliberately excluded: canon is mostly fiction, poetry isn't nf prose
    expect(isNonfictionGenre('classics')).toBe(false)
    expect(isNonfictionGenre('poetry')).toBe(false)
  })
})
