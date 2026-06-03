import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const config = { maxDuration: 30 }

interface InputItem {
  title: string
  creator?: string | null
  type: string
  reaction: string
  note?: string | null
}

const REACTION_LABEL: Record<string, string> = {
  loved_it: 'loved',
  liked_it: 'liked',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { items } = req.body as { items: InputItem[] }
  if (!items?.length) return res.status(400).json({ error: 'no items' })

  // Only loved + liked, capped at 150 for token budget
  const signal = items
    .filter(i => i.reaction === 'loved_it' || i.reaction === 'liked_it')
    .slice(0, 150)

  if (!signal.length) return res.status(400).json({ error: 'no liked items' })

  const list = signal.map(i => {
    const label = REACTION_LABEL[i.reaction] ?? i.reaction
    const creator = i.creator ? ` — ${i.creator}` : ''
    const note = i.note ? ` (note: "${i.note}")` : ''
    return `[${label}] ${i.title}${creator} (${i.type})${note}`
  }).join('\n')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 800,
    system: `You are a taste profiler. Given a list of films, books, music, and TV — each marked [loved] or [liked], with optional notes — write a short taste profile in this exact format:

One opening sentence that names a specific cross-medium pattern and anchors it with at least two titles or names — thematic analysis is fine, but it must be grounded in something concrete from the list, not a mood word floating on its own.

Then 4–5 bullet points (each starting with "- "), exactly one sentence each. Use the full signal available: treat [loved] items as core taste (what they consistently reach for), [liked] as supporting evidence, and notes as first-person confirmation. Music, books, and film must each appear meaningfully across the bullets — do not let any one medium dominate or get a single token mention at the end. Prioritise cross-medium observations where they exist, but if a medium has a genuinely distinct pattern, give it its own bullet. Each bullet: one concrete observation, two or three examples, nothing else. No hedging, no editorialising, no "probably" or "seems like".

Plain English, second person. Wrap media titles in *asterisks*. No preamble.`,
    messages: [{ role: 'user', content: `Here is the list:\n\n${list}` }],
  })

  const profile = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  return res.status(200).json({ profile })
}
