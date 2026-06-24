import { describe, it, expect } from 'vitest'
import { isFailure, isThingsCapture, type EmailCapture } from './captures'

const make = (outcome: EmailCapture['outcome'], detail: string | null = null): EmailCapture => ({
  id: '1', from_email: 'a@b.com', subject: 's', outcome,
  saved_count: 0, detail, snippet: null, created_at: new Date().toISOString(),
})

describe('isFailure', () => {
  it('treats nothing_found and error as failures (need attention)', () => {
    expect(isFailure(make('nothing_found'))).toBe(true)
    expect(isFailure(make('error'))).toBe(true)
  })

  it('treats duplicates as a benign no-op, not a failure', () => {
    expect(isFailure(make('duplicates'))).toBe(false)
  })
})

describe('isThingsCapture', () => {
  it('matches the things-path detail strings the server writes', () => {
    expect(isThingsCapture(make('nothing_found', 'could not read product link'))).toBe(true)
    expect(isThingsCapture(make('nothing_found', 'no link in things email'))).toBe(true)
    expect(isThingsCapture(make('duplicates', 'thing already on board'))).toBe(true)
  })

  it('leaves media misses out (they stay on the Library side)', () => {
    expect(isThingsCapture(make('nothing_found', 'no media found in text'))).toBe(false)
    expect(isThingsCapture(make('nothing_found', 'no media read from photo(s)'))).toBe(false)
    expect(isThingsCapture(make('error', null))).toBe(false)
  })
})
