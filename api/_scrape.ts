import { isSafePublicUrl } from './_ssrf.js'

// Shared product-page scraper for the "Things" domain. Given a product URL, fetch
// the page server-side and pull image/title/price/brand from its OpenGraph +
// product meta tags and JSON-LD (schema.org/Product). No Anthropic call — this
// just reads a public page, so it costs nothing.
//
// Used by both the /api/og-parse endpoint (paste-a-link in the app) and the
// inbound email handler (forward-a-link to your board).

const MAX_BYTES = 512 * 1024 // only need <head> + early body; cap the read so a huge page can't blow memory
const FETCH_TIMEOUT_MS = 13000

export type ScrapedFields = {
  url: string
  title: string | null
  image: string | null
  price: string | null
  brand: string | null
  siteName: string | null
  /** Product copy (materials/fit/details) — for the AI Compare take. Often absent. */
  description?: string | null
  /** On-page rating (from JSON-LD aggregateRating) — value + review count as strings. */
  rating?: { value: string; count: string } | null
  /** True when the page looks like a shop page (JSON-LD Product, og:type=product,
   *  or a readable price) — used to gate auto-capture so articles don't become things. */
  productLike?: boolean
}

export type ScrapeResult =
  | { ok: true; fields: ScrapedFields }
  | { ok: false; reason: string }

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

// ---- JSON-LD (schema.org/Product) ----
// Many shops put generic OG tags ("Woman") but the real product in a
// <script type="application/ld+json"> Product node. Read that when present —
// it's the most reliable source for name / brand / price.

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}
function asString(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'number') return String(v)
  return null
}

function collectLdNodes(v: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(v)) { for (const x of v) collectLdNodes(x, out); return }
  const rec = asRecord(v)
  if (!rec) return
  out.push(rec)
  if ('@graph' in rec) collectLdNodes(rec['@graph'], out)
}

function isProductNode(node: Record<string, unknown>): boolean {
  const t = node['@type']
  const types = Array.isArray(t) ? t : [t]
  return types.some(x => typeof x === 'string' && x.toLowerCase().includes('product'))
}

function ldBrand(v: unknown): string | null {
  return asString(v) ?? asString(asRecord(v)?.name)
}
function ldImage(v: unknown): string | null {
  if (Array.isArray(v)) return ldImage(v[0])
  return asString(v) ?? asString(asRecord(v)?.url)
}
function ldRating(v: unknown): { value: string; count: string } | null {
  const r = asRecord(v)
  const value = asString(r?.['ratingValue'])
  if (!value) return null
  return { value, count: asString(r?.['reviewCount']) ?? asString(r?.['ratingCount']) ?? '' }
}

type LdProduct = {
  name: string | null; brand: string | null; price: string | null; currency: string | null
  image: string | null; description: string | null; rating: { value: string; count: string } | null
}

function jsonLdProduct(html: string): LdProduct | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  const nodes: Record<string, unknown>[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const raw = m[1].trim()
    if (!raw) continue
    let data: unknown
    try { data = JSON.parse(raw) } catch { try { data = JSON.parse(decodeEntities(raw)) } catch { continue } }
    collectLdNodes(data, nodes)
  }
  const prod = nodes.find(isProductNode)
  if (!prod) return null
  const offersRaw = prod['offers']
  const offer = asRecord(Array.isArray(offersRaw) ? offersRaw[0] : offersRaw)
  return {
    name: asString(prod['name']),
    brand: ldBrand(prod['brand']),
    price: asString(offer?.['price']) ?? asString(offer?.['lowPrice']),
    currency: asString(offer?.['priceCurrency']),
    image: ldImage(prod['image']),
    description: asString(prod['description']),
    rating: ldRating(prod['aggregateRating']),
  }
}

// Resolve a possibly-relative image URL against the page URL.
function absoluteUrl(maybe: string | null, base: string): string | null {
  if (!maybe) return null
  try { return new URL(maybe, base).href } catch { return null }
}

/**
 * Fetch and parse a product page. SSRF-guarded (the URL is user-supplied), so it
 * refuses loopback / private / link-local hosts before fetching. Never throws —
 * returns a friendly `reason` on any failure so callers can surface it.
 */
export async function scrapeProduct(rawUrl: string): Promise<ScrapeResult> {
  const trimmed = (rawUrl ?? '').trim()
  if (!trimmed || !isSafePublicUrl(trimmed)) return { ok: false, reason: "That doesn't look like a valid product link." }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let resp: Response
    try {
      resp = await fetch(trimmed, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          // Present as a real Chrome doing a top-level navigation, not a bot — many
          // mid-tier shops 403 a "Nospaces/1.0" UA but serve a full browser one. The
          // Sec-Fetch-* + Accept-Language + Upgrade-Insecure-Requests set rounds out
          // the fingerprint (mirrors the image-fetch trick in _vision.ts). Won't beat
          // a real JS challenge (Cloudflare et al.) — those still fall back to manual.
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Upgrade-Insecure-Requests': '1',
        },
      })
    } finally {
      clearTimeout(timer)
    }

    if (!resp.ok) return { ok: false, reason: `The page returned ${resp.status}.` }
    const ctype = resp.headers.get('content-type') ?? ''
    if (!ctype.includes('html')) return { ok: false, reason: 'That link is not a web page.' }

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
        // Stop once we have the <head> — but keep reading into the body if we
        // haven't yet seen a JSON-LD block, since many shops put their real
        // Product data (name/brand/price) in a <script> lower down the page.
        if (/<\/head>/i.test(html) && /application\/ld\+json/i.test(html)) break
      }
      try { await reader.cancel() } catch { /* ignore */ }
    } else {
      html = (await resp.text()).slice(0, MAX_BYTES)
    }

    const finalUrl = resp.url || trimmed
    // JSON-LD Product wins for name/brand/price (most reliable); OG/meta is the
    // fallback. The packshot stays OG-first for a consistent board, JSON-LD last.
    const ld = jsonLdProduct(html)
    const title =
      ld?.name ??
      metaContent(html, ['og:title', 'twitter:title']) ??
      titleTag(html)
    const image = absoluteUrl(
      metaContent(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']) ?? ld?.image ?? null,
      finalUrl,
    )
    const currency = ld?.currency ?? metaContent(html, ['product:price:currency', 'og:price:currency'])
    const price = cleanPrice(
      ld?.price ?? metaContent(html, ['product:price:amount', 'og:price:amount', 'product:price', 'price']),
      currency,
    )
    const brand = ld?.brand ?? metaContent(html, ['product:brand', 'og:brand', 'twitter:data1'])
    const siteName = metaContent(html, ['og:site_name'])
      ?? (() => { try { return new URL(finalUrl).hostname.replace(/^www\./, '') } catch { return null } })()
    const description = (ld?.description ?? metaContent(html, ['og:description', 'twitter:description', 'description']))?.slice(0, 500) ?? null
    const rating = ld?.rating ?? null
    const ogType = metaContent(html, ['og:type'])
    const productLike = !!ld || (ogType?.toLowerCase().includes('product') ?? false) || !!price

    return { ok: true, fields: { url: finalUrl, title, image, price, brand, siteName, description, rating, productLike } }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    console.error('[scrape] error for', trimmed, ':', err instanceof Error ? err.message : err)
    return { ok: false, reason: aborted ? 'The page took too long to load.' : "Couldn't read that link." }
  }
}
