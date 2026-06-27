import { describe, it, expect } from 'vitest'
import { isFailure, type EmailCapture } from './captures'

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
