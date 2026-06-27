import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'
import { readProductFromImage } from './_vision.js'

// In-app "add by screenshot" (s87). The client uploads a screenshot of a product
// (e.g. a walled shop a scraper can't read — Farfetch, Net-a-Porter, miista) to
// Storage, then hands us the hosted URL. We run ONE Sonnet vision read that pulls
// the product's identity (name/brand/price) AND its look-tags + shot type, so a
// bot-walled shop still lands on the board — no email, no Postmark, free except the
// ~1¢ vision call. This is the in-app twin of the email screenshot path; the read
// lives in ./_vision.ts so both share one prompt + parser.

export const config = { maxDuration: 30 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userId = await getAuthUserId(req.headers['authorization'])
  if (!userId) return res.status(401).end()
  // Same budget as things-vision — a vision read of comparable cost.
  if (!await checkRateLimit(userId, 'screenshot-product', 40)) {
    return res.status(429).json({ error: 'Lots of reads this hour — try again later.' })
  }

  const { image, referer } = req.body as { image?: string; referer?: string }
  if (!image || typeof image !== 'string' || !/^https?:\/\//i.test(image)) {
    return res.status(400).json({ error: 'Need an image URL.' })
  }

  const result = await readProductFromImage(image, typeof referer === 'string' ? referer : undefined)
  if (!result.ok) {
    // An image-fetch failure (403/avif/timeout) is the upload/CDN, not our bug — 422.
    // A vision/parse error is ours — 500.
    const fetchReasons = ['unsafe-url', 'too-big', 'empty', 'timeout', 'fetch-failed']
    const isFetch = fetchReasons.includes(result.reason) || result.reason.startsWith('fetch-') || result.reason.startsWith('bad-type-')
    if (isFetch) {
      console.warn('[screenshot-product] image fetch failed:', result.reason, '·', image.slice(0, 120))
      return res.status(422).json({ error: 'Could not load that screenshot.', reason: result.reason })
    }
    console.error('[screenshot-product] error:', result.reason)
    return res.status(500).json({ error: 'Could not read that screenshot right now.' })
  }

  return res.status(200).json({
    title: result.title, brand: result.brand, price: result.price,
    attributes: result.attributes, shotType: result.shotType, confidence: result.confidence,
    box: result.box,
  })
}
