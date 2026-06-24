import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isSafePublicUrl } from './_ssrf.js'
import { fetchImageBuffer } from './_vision.js'
import { trimToAspect, upscaleUrl } from './_imageTrim.js'

// Image proxy + auto-trim for the Things board. Given a product photo URL, fetch a
// high-res original server-side (browser-spoofed, so retail CDNs don't 403 us),
// trim it to the product, re-frame to the requested aspect, and hand back a clean
// JPEG. This is the server-side replacement for the old client-canvas trim — it
// works on every shop (no CORS) and pulls a crisper source. Free: no AI, pure pixels.
//
// PUBLIC by necessity — an <img> tag can't send an auth header. Kept safe by the
// SSRF guard (no internal targets) and by only ever emitting a re-encoded JPEG, so
// it can't be turned into a general file proxy. Output is immutable-cached on the
// edge, so each photo is processed once.

// Headroom over the 12s fetch timeout inside fetchImageBuffer.
export const config = { maxDuration: 25 }

const YEAR = 60 * 60 * 24 * 365

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const url = typeof req.query.u === 'string' ? req.query.u.trim() : ''
  const referer = typeof req.query.r === 'string' ? req.query.r : undefined
  const aspect = clampAspect(req.query.a)
  if (!url || !isSafePublicUrl(url)) return res.status(400).end()

  // Serve the untrimmed original (302) on any failure so the photo still shows.
  const passthrough = () => {
    res.setHeader('Cache-Control', 'public, max-age=3600') // short — a CDN may relent later
    res.redirect(302, url)
  }

  // Try a higher-res original first; fall back to the URL as-saved if the bigger
  // variant 404s (not every CDN follows the size convention we guessed).
  const upscaled = upscaleUrl(url)
  let img = await fetchImageBuffer(upscaled, referer)
  if (!img.ok && upscaled !== url) img = await fetchImageBuffer(url, referer)
  if (!img.ok) return passthrough()

  try {
    const out = await trimToAspect(img.buf, aspect)
    if (!out) return passthrough() // nothing to trim — let the browser load the original
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Cache-Control', `public, max-age=${YEAR}, immutable`)
    return res.status(200).send(out)
  } catch {
    return passthrough()
  }
}

function clampAspect(raw: unknown): number {
  const n = typeof raw === 'string' ? parseFloat(raw) : NaN
  if (!isFinite(n) || n <= 0) return 4 / 5
  return Math.max(0.2, Math.min(5, n))
}
