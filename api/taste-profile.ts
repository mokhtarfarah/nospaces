import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
const _ce = (s: string | undefined) => (s ?? '').replace(/[^\x20-\x7E]/g, '').trim()
let _sba: ReturnType<typeof createClient> | null = null
const _ac = () => { if (!_sba) _sba = createClient(_ce(process.env.SUPABASE_URL), _ce(process.env.SUPABASE_SERVICE_ROLE_KEY)); return _sba }
async function requireAuth(req: VercelRequest): Promise<boolean> { const a = req.headers['authorization']; if (!a?.startsWith('Bearer ')) return false; try { const { error } = await _ac().auth.getUser(a.slice(7)); return !error } catch { return false } }

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

  const { items, vibes } = req.body as { items: InputItem[]; vibes?: string[] }
  if (!items?.length) return res.status(400).json({ error: 'no items' })

  // Only loved + liked, capped at 150 for token budget
  const signal = items
    .filter(i => i.reaction === 'loved_it' || i.reaction === 'liked_it')
    .slice(0, 150)

  if (!signal.length) return res.status(400).json({ error: 'no liked items' })

  const list = signal.map(i => {
    const label = REACTION_LABEL[i.reaction] ?? i.reaction
    const creator = i.creator ? ` — ${i.creator}` : ''
    const note = i.note ? ` (private note: ${i.note})` : ''
    return `[${label}] ${i.title}${creator} (${i.type})${note}`
  }).join('\n')

  const vibeLine = vibes?.length
    ? `\n\nThe page already displays these vibe words (surfaced from the person's own tags), just above your text: ${vibes.join(', ')}. Treat them as anchors — your profile should feel consistent with them and deepen them with specifics. Do NOT simply list or restate them.`
    : ''

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      system: `You are a taste profiler. Given a list of films, books, music, and TV — each marked [loved] or [liked], some with a private note — write a short taste profile.

One opening sentence: name the sharpest pattern you see, grounded in specific titles. Not a mood word — a real observation.

Then 4–5 bullet points (each starting with "- "), one sentence each. Say what you actually see. Treat [loved] as core signal, [liked] as supporting evidence.

The private notes are evidence for you to reason from — they sharpen the patterns you name — but they are NOT for publication. Never quote, paraphrase, or echo a note's wording in your output. Write everything in your own profiler's voice.

Specific examples, plain English, second person. No hedging. Wrap media titles in *asterisks*. No preamble.`,
      messages: [{ role: 'user', content: `Here is the list:\n\n${list}${vibeLine}` }],
    })
    const profile = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return res.status(200).json({ profile })
  } catch (err) {
    console.error('[taste-profile]', err)
    return res.status(500).json({ error: 'Failed to generate taste profile' })
  }
}
