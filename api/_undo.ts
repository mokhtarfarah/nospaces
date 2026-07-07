// Signed "undo" tokens for email talkback. Every confirmation email can carry a
// link that removes exactly the item(s) that email just saved — for when the
// reader (a human or the AI) got it wrong. The token is an HMAC-signed capability:
// it names the user + the row ids it may remove, so a leaked/forwarded link can
// only ever touch that user's own rows, and only for a bounded window.
//
// Signed with EMAIL_WEBHOOK_SECRET (already required for the inbound webhook), so
// no new env var. If the secret is unset, signing returns null and the caller
// simply omits the undo line — same no-op-safely posture as talkback itself.
import { createHmac, timingSafeEqual } from 'node:crypto'

// Strip any non-ASCII that crept in via copy-paste, matching email.ts's cleanEnv.
const cleanEnv = (s: string | undefined) => (s ?? '').replace(/[^\x20-\x7E]/g, '').trim()
// Read lazily (not at module load) so tests can set the env before first use.
const getSecret = () => cleanEnv(process.env.EMAIL_WEBHOOK_SECRET)

// A token is valid for 60 days — long enough that an old confirmation email is
// still actionable, short enough to bound the blast radius of a leaked link.
export const UNDO_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 60

// What the signed token carries. `l` (a short label) and `n` (count) are only for
// the confirmation page's copy; the delete is driven by `u` + `i` alone.
export type UndoPayload = { u: string; i: string[]; t: number; l?: string; n?: number }

const b64url = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64urlDecode = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

const mac = (body: string, secret: string) =>
  b64url(createHmac('sha256', secret).update(body).digest())

// Sign a payload into a `body.signature` token. Returns null (no undo link) if the
// signing secret isn't set, or if there are no ids to undo.
export function signUndo(p: UndoPayload): string | null {
  const secret = getSecret()
  if (!secret || !Array.isArray(p.i) || p.i.length === 0) return null
  const body = b64url(Buffer.from(JSON.stringify(p)))
  return `${body}.${mac(body, secret)}`
}

// Verify a token and return its payload, or null if it's forged, malformed, or
// outside the validity window. `now` is passed in (not read from the clock) so the
// function stays pure and testable.
export function verifyUndo(token: string, now: number): UndoPayload | null {
  const secret = getSecret()
  if (!secret || typeof token !== 'string' || !token.includes('.')) return null
  const dot = token.lastIndexOf('.')
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!body || !sig) return null
  const expected = mac(body, secret)
  const a = new Uint8Array(Buffer.from(sig))
  const b = new Uint8Array(Buffer.from(expected))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  let p: UndoPayload
  try {
    p = JSON.parse(b64urlDecode(body).toString('utf8'))
  } catch {
    return null
  }
  if (!p || typeof p.u !== 'string' || !Array.isArray(p.i) || typeof p.t !== 'number') return null
  if (p.i.length === 0 || p.i.some(id => typeof id !== 'string')) return null
  // Reject anything expired or dated in the future (clock-skew guard).
  if (now - p.t > UNDO_MAX_AGE_MS || p.t > now + 60_000) return null
  return p
}

// Build the absolute undo URL for a token. Points at the deployed app's /api/undo.
export function undoUrl(token: string): string {
  const base = cleanEnv(process.env.PUBLIC_BASE_URL) || 'https://nospaces.vercel.app'
  return `${base.replace(/\/+$/, '')}/api/undo?t=${encodeURIComponent(token)}`
}
