import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'
import { isSafePublicUrl } from './_ssrf.js'

// Free product-link reader for the "Things" domain. Given a product URL, fetch the
// page server-side and pull image/title/price/brand out of its OpenGraph + product
// meta tags. No Anthropic call — this just reads a public page, so it costs nothing.
//
// SSRF-guarded (reuses _ssrf): the URL comes from user input, so we refuse loopback /
// private / link-local hosts before fetching. Auth + a light per-user rate limit keep
// it from being used as an open proxy.

const MAX_BYTES = 512 * 1024 // only need the <head>; cap the read so a huge page can't blow memory
const FETCH_TIMEOUT_MS = 8000

// Pull <meta property="og:title" content="..."> / <meta name="..." content="..."> values.
// Order-agnostic: content can come before or after the property/name attribute.
function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${esc}["'][^>]+content=["']([^"']*)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name|itemprop)=["']${esc}["']`, 'i'),
    ]
    for (const re of patterns) {
      const m = html.match(re)
      if (m && m[1].trim()) return decodeEntities(m[1].trim())
    }
  }
  return null
}

function titleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return m && m[1].trim() ? decodeEntities(m[1].trim()) : null
}

// Minimal HTML entity decode — meta content is often entity-encoded (&amp; &#39; …).
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

// Normalise a price string to a clean display value. We don't try to be a currency
// engine — just keep a leading symbol/code + the number, drop trailing junk.
function cleanPrice(raw: string | null, currency: string | null): string | null {
  if (!raw) return null
  const num = raw.match(/\d[\d.,]*/)
  if (!num) return null
  const sym = currency
    ? ({ USD: '$', GBP: '£', EUR: '€', CAD: '$', AUD: '$' }[currency.toUpperCase()] ?? `${currency.toUpperCase()} `)
    : (raw.match(/[$£€]/)?.[0] ?? '')
  return `${sym}${num[0]}`.trim()
}

// Resolve a possibly-relative image URL against the page URL.
function absoluteUrl(maybe: string | null, base: string): string | null {
  if (!maybe) return null
  try { return new URL(maybe, base).href } catch { return null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userId = await getAuthUserId(req.headers['authorization'])
  if (!userId) return res.status(401).end()
  // Generous — link-pasting a few candidates in a row is normal; this just stops abuse.
  if (!await checkRateLimit(userId, 'og-parse', 120)) return res.status(429).json({ error: 'Slow down a moment, then try again.' })

  const { url } = req.body as { url?: string }
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing url' })
  const trimmed = url.trim()
  if (!isSafePublicUrl(trimmed)) return res.status(400).json({ error: "That doesn't look like a valid product link." })

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let resp: Response
    try {
      resp = await fetch(trimmed, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          // Some shops gate bot UAs; present as a normal browser to get the OG-tagged HTML.
          'User-Agent': 'Mozilla/5.0 (compatible; Nospaces/1.0; +https://nospaces.vercel.app)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      })
    } finally {
      clearTimeout(timer)
    }

    if (!resp.ok) return res.status(200).json({ ok: false, reason: `The page returned ${resp.status}.` })
    const ctype = resp.headers.get('content-type') ?? ''
    if (!ctype.includes('html')) return res.status(200).json({ ok: false, reason: 'That link is not a web page.' })

    // Read only enough bytes to cover the <head>.
    const reader = resp.body?.getReader()
    let html = ''
    if (reader) {
      const decoder = new TextDecoder()
      let total = 0
      while (total < MAX_BYTES) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.length
        html += decoder.decode(value, { stream: true })
        if (/<\/head>/i.test(html)) break // got the head; stop early
      }
      try { await reader.cancel() } catch { /* ignore */ }
    } else {
      html = (await resp.text()).slice(0, MAX_BYTES)
    }

    const finalUrl = resp.url || trimmed
    const title =
      metaContent(html, ['og:title', 'twitter:title']) ??
      titleTag(html)
    const image = absoluteUrl(
      metaContent(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']),
      finalUrl,
    )
    const currency = metaContent(html, ['product:price:currency', 'og:price:currency'])
    const price = cleanPrice(
      metaContent(html, ['product:price:amount', 'og:price:amount', 'product:price', 'price']),
      currency,
    )
    const brand = metaContent(html, ['product:brand', 'og:brand', 'twitter:data1'])
    const siteName = metaContent(html, ['og:site_name'])
      ?? (() => { try { return new URL(finalUrl).hostname.replace(/^www\./, '') } catch { return null } })()

    return res.status(200).json({ ok: true, url: finalUrl, title, image, price, brand, siteName })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    console.error('[og-parse] error for', trimmed, ':', err instanceof Error ? err.message : err)
    return res.status(200).json({ ok: false, reason: aborted ? 'The page took too long to load.' : "Couldn't read that link." })
  }
}
