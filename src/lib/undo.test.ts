import { describe, it, expect, beforeEach } from 'vitest'
import { signUndo, verifyUndo, undoUrl, UNDO_MAX_AGE_MS } from '../../api/_undo'

// The signing secret is read lazily from the env, so set it before each test.
beforeEach(() => {
  process.env.EMAIL_WEBHOOK_SECRET = 'test-secret-abc123'
})

const NOW = 1_700_000_000_000

describe('signUndo / verifyUndo', () => {
  it('round-trips a payload', () => {
    const token = signUndo({ u: 'user-1', i: ['a', 'b'], t: NOW, l: 'Yesteryear', n: 2 })!
    expect(token).toBeTruthy()
    const p = verifyUndo(token, NOW + 1000)
    expect(p).toMatchObject({ u: 'user-1', i: ['a', 'b'], l: 'Yesteryear', n: 2 })
  })

  it('returns null when there is nothing to undo', () => {
    expect(signUndo({ u: 'user-1', i: [], t: NOW })).toBeNull()
  })

  it('returns null when the secret is unset', () => {
    delete process.env.EMAIL_WEBHOOK_SECRET
    expect(signUndo({ u: 'user-1', i: ['a'], t: NOW })).toBeNull()
  })

  it('rejects a tampered payload body', () => {
    const token = signUndo({ u: 'user-1', i: ['a'], t: NOW })!
    const [body, sig] = token.split('.')
    // Flip a character in the body — signature no longer matches.
    const forged = `${body.slice(0, -1)}${body.at(-1) === 'A' ? 'B' : 'A'}.${sig}`
    expect(verifyUndo(forged, NOW)).toBeNull()
  })

  it('rejects a tampered signature', () => {
    const token = signUndo({ u: 'user-1', i: ['a'], t: NOW })!
    const [body] = token.split('.')
    expect(verifyUndo(`${body}.deadbeef`, NOW)).toBeNull()
  })

  it('rejects a token signed with a different secret', () => {
    const token = signUndo({ u: 'user-1', i: ['a'], t: NOW })!
    process.env.EMAIL_WEBHOOK_SECRET = 'a-completely-different-secret'
    expect(verifyUndo(token, NOW)).toBeNull()
  })

  it('rejects an expired token', () => {
    const token = signUndo({ u: 'user-1', i: ['a'], t: NOW })!
    expect(verifyUndo(token, NOW + UNDO_MAX_AGE_MS + 1)).toBeNull()
    // Still valid just inside the window.
    expect(verifyUndo(token, NOW + UNDO_MAX_AGE_MS - 1)).not.toBeNull()
  })

  it('rejects a token dated in the future (clock skew guard)', () => {
    const token = signUndo({ u: 'user-1', i: ['a'], t: NOW + 5 * 60_000 })!
    expect(verifyUndo(token, NOW)).toBeNull()
  })

  it('rejects garbage', () => {
    expect(verifyUndo('', NOW)).toBeNull()
    expect(verifyUndo('no-dot', NOW)).toBeNull()
    expect(verifyUndo('...', NOW)).toBeNull()
  })
})

describe('undoUrl', () => {
  it('builds an absolute /api/undo link with the token encoded', () => {
    const url = undoUrl('body.sig+with/chars')
    expect(url).toMatch(/^https:\/\/[^/]+\/api\/undo\?t=/)
    expect(url).toContain(encodeURIComponent('body.sig+with/chars'))
  })
})
