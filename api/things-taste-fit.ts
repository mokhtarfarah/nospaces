import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'
import { HUMANIZER_GUARDRAILS, VOICE } from './_humanizer.js'

// The per-item "how this fits your taste" read: one honest line on how a single
// saved thing rhymes with (or departs from) the rest of the board. The item-level
// sibling of the board's keyword thread. Text only — it reads the already-extracted
// taste tags, never an image — so it stays cheap (Haiku, ~$0.001 a call). Never
// auto-runs: the client calls it on an explicit tap and caches the line on
// metadata.tasteFit, so a given product costs ~1¢ once.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type InAttr = { facet?: string; value?: string }
// Board context: the recurring keyword thread + the top recurring values per facet,
// each as [value, itemCount]. Lets the model place the item on the board precisely.
type InBoard = { thread?: string[]; facets?: Record<string, [string, number][]> }

const FACET_LABEL: Record<string, string> = {
  material: 'material', palette: 'palette', vibe: 'vibe', category: 'category', priceTier: 'price',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userId = await getAuthUserId(req.headers['authorization'])
  if (!userId) return res.status(401).end()
  if (!await checkRateLimit(userId, 'things-taste-fit', 40)) return res.status(429).json({ error: 'That’s a lot of reads — try again next hour.' })

  const { title, brand, price, attributes, board } = req.body as {
    title?: string; brand?: string | null; price?: string | null; attributes?: InAttr[]; board?: InBoard
  }
  const attrs = (Array.isArray(attributes) ? attributes : [])
    .filter(a => a && typeof a.value === 'string' && a.value.trim())
    .map(a => ({ facet: String(a.facet ?? ''), value: String(a.value).trim() }))
  if (!attrs.length) return res.status(400).json({ error: 'Need the item’s taste tags to read it.' })

  const thread = Array.isArray(board?.thread) ? board!.thread.filter(t => typeof t === 'string') : []
  const facets = (board?.facets ?? {}) as Record<string, [string, number][]>
  if (thread.length === 0 && Object.keys(facets).length === 0) {
    return res.status(400).json({ error: 'Not enough on the board yet to compare against.' })
  }

  // Category is "what it is" (bag, trousers), not the aesthetic — leave it out of
  // the read entirely, both for the board context and the item, so the line goes by
  // feeling, not inventory (Farah: insights should be aesthetic, not categorical).
  const HIDE = new Set(['category'])
  const boardLines = Object.entries(facets)
    .filter(([facet, vals]) => !HIDE.has(facet) && Array.isArray(vals) && vals.length)
    .map(([facet, vals]) => `- ${FACET_LABEL[facet] ?? facet}: ${vals.map(([v]) => v).join(', ')}`)
    .join('\n')

  const itemAttrsShown = attrs.filter(a => !HIDE.has(a.facet))
  const itemLine = (itemAttrsShown.length ? itemAttrsShown : attrs).map(a => `${FACET_LABEL[a.facet] ?? a.facet}: ${a.value}`).join(', ')

  const prompt = `Someone keeps a personal "taste board" — things they've saved across clothes, bags, shoes, objects. The board has a recurring aesthetic; here's the gist:
${thread.length ? `\nIn a phrase, it reads as: ${thread.join(' · ')}.\n` : ''}
Recurring threads:
${boardLines || '(nothing strongly recurring yet)'}

They just saved:
- ${title ? title : 'an item'}${brand ? ` — ${brand}` : ''}${price ? ` (${price})` : ''}
- reads as: ${itemLine}

Write ONE short line (second person, ~12–18 words, no trailing period) on how this sits with the board — AESTHETICALLY. Read the *feeling*: palette, mood, silhouette, how relaxed or dressy, soft or sharp, quiet or bold.

Rules that matter here:
- Go by aesthetic, NOT category. The board mixes clothes, bags and objects, so a recurring material (e.g. leather) usually comes from accessories — never treat it as a wardrobe staple, and never frame a different category as a departure ("a bag, unlike your coats"). Bag-vs-trousers is not a taste observation.
- Don't force a contrast. If it simply IS her aesthetic, say so with warmth and confidence in a few words — that's a better, truer read than inventing a difference. Only name a tension when it's a genuine aesthetic shift (a softer palette, a dressier mood, a sharper line than usual).
- Vary the phrasing every time. Do NOT use a fixed template like "X and Y check the boxes, but Z…" — that reads robotic. Each line should be put freshly.
- Be specific and human, never a checklist of the tags read back. No hype, no "this piece".

${VOICE.warm}

${HUMANIZER_GUARDRAILS}

Return JSON only, no prose around it:
{ "fit": "the one line" }`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 160,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    const fit = typeof parsed.fit === 'string' ? parsed.fit.trim() : ''
    if (!fit) return res.status(500).json({ error: 'Could not read that right now.' })
    return res.status(200).json({ fit })
  } catch (err) {
    console.error('[things-taste-fit] error:', err instanceof Error ? err.message : err)
    return res.status(500).json({ error: 'Could not read that right now.' })
  }
}
