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
    max_tokens: 300,
    system: `You are a taste profiler. Given a list of films, books, music, and TV that someone loved and liked — with their reactions and any notes they left — write a single short paragraph (3–5 sentences) describing their taste in plain, specific, editorial prose.

Be precise about what you actually see: name genres, moods, directors, eras, or recurring patterns if they appear. Write in second person ("you tend toward…", "your taste runs to…"). Tone: literary and editorial, like a Pitchfork capsule or a Sight & Sound critic's note. No generic filler, no bullet points, no preamble — just the paragraph.`,
    messages: [{ role: 'user', content: `Here is the list:\n\n${list}` }],
  })

  const profile = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  return res.status(200).json({ profile })
}
