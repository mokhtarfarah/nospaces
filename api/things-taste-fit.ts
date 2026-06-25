import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'
import { HUMANIZER_GUARDRAILS } from './_humanizer.js'

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

  // Compact, readable board summary: each facet's recurring values with how many
  // OTHER things carry them (e.g. "palette: muted (6), earth (3)").
  const boardLines = Object.entries(facets)
    .filter(([, vals]) => Array.isArray(vals) && vals.length)
    .map(([facet, vals]) => `- ${FACET_LABEL[facet] ?? facet}: ${vals.map(([v, n]) => `${v} (${n})`).join(', ')}`)
    .join('\n')

  const itemLine = attrs.map(a => `${FACET_LABEL[a.facet] ?? a.facet}: ${a.value}`).join(', ')

  const prompt = `Someone keeps a personal "taste board" of things they've saved (clothes, objects, homeware). Across the board, these aesthetic tags keep recurring — the number in parens is how many saved things carry each value:

${boardLines || '(no recurring facets)'}
${thread.length ? `\nTheir board reads, in short, as: ${thread.join(' · ')}.\n` : ''}
Now they've saved this one thing:
- ${title ? title : 'an item'}${brand ? ` — ${brand}` : ''}${price ? ` (${price})` : ''}
- its taste tags: ${itemLine}

Write ONE short line (second person, ~12–20 words, no period needed) on how THIS thing sits against the rest of their board — where it leans into a recurring streak, and, if there's a real one, the way it differs (dressier, bolder, a softer palette, an outlier). Be specific to the tags shown; name the actual values. If it's a clean match to their usual, say that simply — don't manufacture a contrast. If it genuinely departs from everything else, say so honestly rather than forcing a fit. No hype, no "this piece" filler.

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
