import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'
import { HUMANIZER_GUARDRAILS, NO_FLATTERY, VOICE } from './_humanizer.js'

// The board's taste synthesis: a 1–2 sentence "what you're reflecting" read across
// the WHOLE Things board — wishlist + mood images together. The set-level sibling
// of the per-item "how this fits" line (things-taste-fit). Text only — it reads the
// already-extracted taste tags, never an image — so it's cheap (Haiku, ~$0.001 a
// call). Never auto-runs: the client calls it on an explicit tap and caches the
// result in user_prefs, so a read costs ~1¢ and only re-runs when you ask.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Board context: the recurring keyword thread + the top recurring values per facet,
// each as [value, itemCount]. Same shape as BoardTasteSummary on the client.
type InBoard = { thread?: string[]; facets?: Record<string, [string, number][]> }

const FACET_LABEL: Record<string, string> = {
  material: 'material', palette: 'palette', vibe: 'vibe', category: 'category', priceTier: 'price',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userId = await getAuthUserId(req.headers['authorization'])
  if (!userId) return res.status(401).end()
  if (!await checkRateLimit(userId, 'things-taste', 20)) return res.status(429).json({ error: 'That’s a lot of reads — try again next hour.' })

  const { board, count } = req.body as { board?: InBoard; count?: number }
  const thread = Array.isArray(board?.thread) ? board!.thread.filter(t => typeof t === 'string') : []
  const facets = (board?.facets ?? {}) as Record<string, [string, number][]>
  if (thread.length === 0 && Object.keys(facets).length === 0) {
    return res.status(400).json({ error: 'Not enough on the board yet to read.' })
  }

  // Category is "what it is" (bag, trousers), not the aesthetic — leave it out so
  // the read goes by feeling, not inventory (Farah: insights should be aesthetic).
  const HIDE = new Set(['category'])
  const boardLines = Object.entries(facets)
    .filter(([facet, vals]) => !HIDE.has(facet) && Array.isArray(vals) && vals.length)
    .map(([facet, vals]) => `- ${FACET_LABEL[facet] ?? facet}: ${vals.map(([v, n]) => `${v} (${n})`).join(', ')}`)
    .join('\n')

  const prompt = `Someone keeps a personal "taste board" — things they've saved and images they're drawn to, across clothes, bags, shoes, objects, interiors. Both the things they'd buy and the pure inspiration sit on one board, and together they reveal a single aesthetic. Here's what recurs (the number after each is how many items carry it):
${thread.length ? `\nIn a phrase, it reads as: ${thread.join(' · ')}.\n` : ''}
Recurring threads:
${boardLines || '(nothing strongly recurring yet)'}
${typeof count === 'number' && count > 0 ? `\nRead across ${count} saved item${count === 1 ? '' : 's'}.` : ''}

Write a short taste read — 1 sentence, second person, ~15–25 words — that names what's actually recurring. This is the headline of their taste page.

What matters most here:
${thread.length ? `- HARD RULE — the words "${thread.join('", "')}" are already shown as this page's headline, directly above what you're writing. Do not use any of them, or an obvious synonym of one, anywhere in your sentence. Repeating the headline back adds nothing. Instead reach into the fuller "recurring threads" list above: a facet or value that ISN'T one of those three, or a specific pairing between two facets (e.g. a material + a shape together) that says something the three-word headline didn't already say.\n` : ''}- Lead with a concrete pattern the reader can picture, stated plainly like a caption — this describes what's on the board, not how it makes someone feel.
- A register word (warm, sharp, quiet, considered) can ride along AFTER something concrete, never in place of it, and never as the opening word. Don't read back a raw tag dump either ("wood, velvet, leather, linen") — pick the one or two tags that actually carry the pattern.
- Be specific and true to the evidence. Don't invent a tension or a story the tags don't support.
- Second person, present tense, no preamble, no title in quotes, no trailing list.
- No hype, no "this board", no "your taste says".
- CRITICAL — don't end on a tidy aphorism or a self-satisfied bow. State the fact and stop — it doesn't need a bow on top.
- Don't psychoanalyse or narrate motive ("you're drawn to things that feel earned" is out; "you gravitate to" / "you reach for" is fine as a connector, not a conclusion). Describe what the taste IS, not what it says about them as a person.
- This should read like something a friend could glance at and nod to, not a personality read — if it would feel try-hard or precious to screenshot into a group chat, it's wrong.

${VOICE.warm}

${NO_FLATTERY}

${HUMANIZER_GUARDRAILS}

Return JSON only, no prose around it:
{ "synthesis": "the 1–2 sentence read" }`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    const synthesis = typeof parsed.synthesis === 'string' ? parsed.synthesis.trim() : ''
    if (!synthesis) return res.status(500).json({ error: 'Could not read that right now.' })
    return res.status(200).json({ synthesis })
  } catch (err) {
    console.error('[things-taste] error:', err instanceof Error ? err.message : err)
    return res.status(500).json({ error: 'Could not read that right now.' })
  }
}
