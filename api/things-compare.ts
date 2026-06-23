import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'
import { HUMANIZER_GUARDRAILS } from './_humanizer.js'

// Opt-in "compare these" for a plan-a-purchase: weighs the candidates a person is
// deliberating between and returns a short, honest take. Text-only (names/brands/
// prices — no images), Haiku, ~$0.001 a call. Never runs unless the user taps it.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type InCandidate = { title?: string; brand?: string | null; price?: string | null; wasPrice?: string | null }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userId = await getAuthUserId(req.headers['authorization'])
  if (!userId) return res.status(401).end()
  if (!await checkRateLimit(userId, 'things-compare', 30)) return res.status(429).json({ error: 'That’s a lot of comparing — try again next hour.' })

  const { intent, candidates } = req.body as { intent?: string; candidates?: InCandidate[] }
  if (!intent || !Array.isArray(candidates) || candidates.length < 2) {
    return res.status(400).json({ error: 'Need a goal and at least two options.' })
  }
  // Cap to keep the payload (and cost) tiny.
  const list = candidates.slice(0, 8)

  const lines = list.map((c, i) => {
    const sale = c.wasPrice && c.price ? `${c.price} (was ${c.wasPrice}, on sale)` : (c.price ?? 'price unknown')
    return `${i + 1}. ${c.title ?? 'Untitled'}${c.brand ? ` — ${c.brand}` : ''} — ${sale}`
  }).join('\n')

  const prompt = `Someone is choosing between options they're weighing for: "${intent}".

Options:
${lines}

For each option, write ONE short, honest line on what stands out — value, price, what you're paying for, whether the sale is real. Then a brief verdict: which you'd lean toward and why, in 1–2 sentences. You only have names and prices, so if it's genuinely a toss-up or you can't really tell them apart from this, say that plainly instead of inventing differences.

${HUMANIZER_GUARDRAILS}

Return JSON only, no prose around it:
{ "notes": ["line for option 1", "line for option 2", ...same order, one per option...], "lean": <1-based option number you'd pick, or null if a toss-up>, "verdict": "1–2 sentences" }`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    const notes: string[] = Array.isArray(parsed.notes) ? parsed.notes.slice(0, list.length).map(String) : []
    const lean = Number.isInteger(parsed.lean) && parsed.lean >= 1 && parsed.lean <= list.length ? parsed.lean : null
    const verdict = typeof parsed.verdict === 'string' ? parsed.verdict.trim() : ''
    return res.status(200).json({ notes, lean, verdict })
  } catch (err) {
    console.error('[things-compare] error:', err instanceof Error ? err.message : err)
    return res.status(500).json({ error: 'Could not compare those right now.' })
  }
}
