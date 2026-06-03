import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './auth'

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
  if (!await requireAuth(req)) return res.status(401).end()

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

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      system: `You are a taste profiler. Given a list of films, books, music, and TV — each marked [loved] or [liked], with optional notes — write a short taste profile.

One opening sentence: name the sharpest pattern you see, grounded in specific titles. Not a mood word — a real observation.

Then 4–5 bullet points (each starting with "- "), one sentence each. Say what you actually see. Treat [loved] as core signal, [liked] as supporting evidence, notes as the person's own words. Specific examples, plain English, second person. No hedging.

Wrap media titles in *asterisks*. No preamble.`,
      messages: [{ role: 'user', content: `Here is the list:\n\n${list}` }],
    })
    const profile = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return res.status(200).json({ profile })
  } catch (err) {
    console.error('[taste-profile]', err)
    return res.status(500).json({ error: 'Failed to generate taste profile' })
  }
}
