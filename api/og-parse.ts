import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'
import { isSafePublicUrl } from './_ssrf.js'
import { scrapeProduct } from './_scrape.js'

// Free product-link reader for the "Things" domain. Given a product URL, fetch the
// page server-side (via the shared scrapeProduct) and pull image/title/price/brand
// out of its OpenGraph + product meta tags + JSON-LD. No Anthropic call — this just
// reads a public page, so it costs nothing.
//
// SSRF-guarded inside scrapeProduct (reuses _ssrf). Auth + a light per-user rate
// limit here keep it from being used as an open proxy.

// Give the serverless function headroom over the fetch timeout so a slow shop
// surfaces our friendly "took too long" message instead of a raw 504.
export const config = { maxDuration: 20 }

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

  const result = await scrapeProduct(trimmed)
  if (!result.ok) return res.status(200).json({ ok: false, reason: result.reason })
  const { url: finalUrl, title, image, price, brand, siteName } = result.fields
  return res.status(200).json({ ok: true, url: finalUrl, title, image, price, brand, siteName })
}
