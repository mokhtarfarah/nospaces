import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'

// Slice 4 — the first vision surface. Reads taste attributes (material · palette ·
// vibe · category) off a product image so the board mirrors you without manual
// tagging. Reads the LOOK, never the identity — no brand/logo/text recognition,
// no "this is a Acme Field Coat". Sonnet 4.6 vision, one image per call,
// ~$0.01 a call. Fires automatically in the background after a save.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const config = { maxDuration: 30 }

// The facets the masthead reads from, and the starter vocab (kept in sync with
// SUGGESTED in src/lib/things.ts — light guidance, not a closed list).
const FACET_VOCAB = {
  material: ['wool', 'leather', 'linen', 'cotton', 'silk', 'denim', 'knit', 'suede'],
  palette: ['muted', 'earth', 'monochrome', 'neutral', 'warm', 'bold', 'pastel'],
  vibe: ['structured', 'oversized', 'tailored', 'relaxed', 'minimal', 'statement', 'bold', 'chunky', 'sleek'],
  category: ['coat', 'knitwear', 'boots', 'bag', 'dress', 'trousers'],
} as const
const FACETS = Object.keys(FACET_VOCAB) as (keyof typeof FACET_VOCAB)[]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userId = await getAuthUserId(req.headers['authorization'])
  if (!userId) return res.status(401).end()
  // A little tighter than Compare — this one costs ~5–10× a Compare call.
  if (!await checkRateLimit(userId, 'things-vision', 40)) {
    return res.status(429).json({ error: 'Lots of reads this hour — try again later.' })
  }

  const { image } = req.body as { image?: string }
  if (!image || typeof image !== 'string' || !/^https?:\/\//i.test(image)) {
    return res.status(400).json({ error: 'Need an image URL.' })
  }

  const vocab = FACETS.map(f => `- ${f}: e.g. ${FACET_VOCAB[f].join(', ')}`).join('\n')
  const prompt = `Look at this product image and read its TASTE — the look, not the identity. Do NOT name the brand, read any logo or text, or try to identify the exact product. Just describe what the eye sees.

Tag it on these facets (one or two words each, lowercase). Use the examples as a guide for the vibe and granularity, but pick whatever word actually fits — you're not limited to the list:
${vocab}

Only tag a facet when you can genuinely see it. Skip material if you can't tell the fabric; skip any facet you'd be guessing at. One value per facet (the dominant one). Better to return fewer, honest tags than to pad.

Return JSON only, no prose:
{ "attributes": [ { "facet": "material|palette|vibe|category", "value": "<one or two words>" }, ... ] }`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: image } },
          { type: 'text', text: prompt },
        ],
      }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    const raw: unknown[] = Array.isArray(parsed.attributes) ? parsed.attributes : []
    // Keep only well-formed tags on a known facet, one per facet, value trimmed short.
    const seen = new Set<string>()
    const attributes = raw
      .map(a => a as { facet?: string; value?: string })
      .filter(a => a && FACETS.includes(a.facet as keyof typeof FACET_VOCAB) && typeof a.value === 'string' && a.value.trim())
      .map(a => ({ facet: a.facet as string, value: a.value!.trim().toLowerCase().slice(0, 24) }))
      .filter(a => !seen.has(a.facet) && seen.add(a.facet))
    return res.status(200).json({ attributes })
  } catch (err) {
    console.error('[things-vision] error:', err instanceof Error ? err.message : err)
    return res.status(500).json({ error: 'Could not read that image right now.' })
  }
}
