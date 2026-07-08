import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'
import { readImageAttributes } from './_vision.js'

// Slice 4 — the first vision surface. Reads taste attributes (material · palette ·
// vibe · category) off a product image so the board mirrors you without manual
// tagging. Reads the LOOK, never the identity. Sonnet 4.6 vision, one image per
// call, ~$0.01 a call. Fires automatically in the background after a save.
//
// The actual fetch + prompt + parse lives in ./_vision.ts so the email-in path
// (api/email.ts) shares exactly the same read.

export const config = { maxDuration: 30 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userId = await getAuthUserId(req.headers['authorization'])
  if (!userId) return res.status(401).end()
  // A little tighter than Compare — this one costs ~5–10× a Compare call.
  if (!await checkRateLimit(userId, 'things-vision', 40)) {
    return res.status(429).json({ error: 'Lots of reads this hour — try again later.' })
  }

  const { image, referer, kind } = req.body as { image?: string; referer?: string; kind?: string }
  if (!image || typeof image !== 'string' || !/^https?:\/\//i.test(image)) {
    return res.status(400).json({ error: 'Need an image URL.' })
  }

  const result = await readImageAttributes(image, typeof referer === 'string' ? referer : undefined, kind === 'inspiration' ? 'inspiration' : 'product')
  if (!result.ok) {
    // An image-fetch failure (403/avif/timeout) is the user's link, not our bug — 422.
    // A vision/parse error is ours — 500.
    const fetchReasons = ['unsafe-url', 'too-big', 'empty', 'timeout', 'fetch-failed']
    const isFetch = fetchReasons.includes(result.reason) || result.reason.startsWith('fetch-') || result.reason.startsWith('bad-type-')
    if (isFetch) {
      console.warn('[things-vision] image fetch failed:', result.reason, '·', image.slice(0, 120))
      return res.status(422).json({ error: 'Could not load that image.', reason: result.reason })
    }
    console.error('[things-vision] error:', result.reason)
    return res.status(500).json({ error: 'Could not read that image right now.' })
  }
  console.log('[things-vision] read', result.attributes.length, 'tags:',
    result.attributes.map(a => `${a.facet}:${a.value}`).join(', ') || '(none)')
  return res.status(200).json({ attributes: result.attributes, shotType: result.shotType })
}
