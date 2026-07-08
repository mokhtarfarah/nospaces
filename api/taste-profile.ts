import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'
import { HUMANIZER_GUARDRAILS, NO_FLATTERY, VOICE } from './_humanizer.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const config = { maxDuration: 30 }

interface InputItem {
  title: string
  creator?: string | null
  type: string
  reaction: string
  note?: string | null
}

const SYSTEM_PROMPT = `You are summarizing one person's taste in film, books, music, and TV from how they've actually rated things — plain and factual, like a friend stating the pattern back to them, not reading their aura. Not a critic, not a brand, not a horoscope.

Write exactly 1 paragraph, 3–4 sentences, in second person.

How to read the evidence — the RATING is the verdict and your primary signal:
- LOVED items are the core of their taste. Anchor the read on these.
- LIKED items are secondary positives — supporting evidence, not the center.
- EH and NOT FOR ME items are the boundary: what leaves them cold. A clear pattern in what they reject is worth naming if one exists.
- Private notes add specific color, but never override the rating. Weight by how they actually rated things, not by how much they wrote.

Substance rules:
- Name 2–3 specific titles — no more. Wrap titles in *asterisks*. Prefer loved titles unless a lower-rated one is essential to the point.
- Make only observations clearly supported by the ratings. No speculation, no invented tension, no forced contrast.
- State the pattern plainly — genres, tones, structures, creators they return to. Describe what the taste IS, not what it supposedly means about them as a person.
- The vibe words shown on the page are anchors — deepen them with something specific; do not restate or list them.
- Private notes are evidence to reason from, not for publication. Never quote or echo a note's wording.

${VOICE.warm}

${NO_FLATTERY}

${HUMANIZER_GUARDRAILS}

This should read like a fact-based note a friend could send, not a personality read — something they'd be comfortable screenshotting to a group chat, not something that sounds like it's trying too hard. No hedging, no preamble, no bullet points, no closing flourish that sums up who they are. Just the paragraph.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userId = await getAuthUserId(req.headers['authorization'])
  if (!userId) return res.status(401).end()
  if (!await checkRateLimit(userId, 'taste-profile', 20)) return res.status(429).json({ error: 'Rate limit exceeded. Try again next hour.' })

  const { items, vibes, canon } = req.body as {
    items: InputItem[]
    vibes?: string[]
    canon?: string[]
  }
  if (!items?.length) return res.status(400).json({ error: 'no items' })

  // Need at least one positive (loved/liked) reaction to anchor a profile.
  const hasPositive = items.some(i => i.reaction === 'loved_it' || i.reaction === 'liked_it')
  if (!hasPositive) return res.status(400).json({ error: 'no liked items' })

  // Build the list grouped by reaction, strongest signal first, so the model
  // reads the verdicts as a hierarchy. Per-bucket caps keep the token budget
  // sane while preserving the full rating spectrum (loved → not for me).
  const BUCKETS: { reaction: string; label: string; cap: number }[] = [
    { reaction: 'loved_it', label: 'LOVED', cap: 70 },
    { reaction: 'liked_it', label: 'liked', cap: 50 },
    { reaction: 'eh', label: 'eh (lukewarm)', cap: 25 },
    { reaction: 'not_for_me', label: 'not for me (rejected)', cap: 25 },
  ]

  const fmt = (i: InputItem, label: string) => {
    const creator = i.creator ? ` — ${i.creator}` : ''
    const note = i.note ? ` (private note: ${i.note})` : ''
    return `[${label}] ${i.title}${creator} (${i.type})${note}`
  }

  const list = BUCKETS
    .map(b => items.filter(i => i.reaction === b.reaction).slice(0, b.cap).map(i => fmt(i, b.label)))
    .filter(rows => rows.length)
    .map(rows => rows.join('\n'))
    .join('\n')

  const canonLine = canon?.length
    ? `\n\nCanon items (things they have explicitly marked as defining works): ${canon.join(', ')}.`
    : ''

  const vibeLine = vibes?.length
    ? `\n\nVibe words already shown on the page (do not restate): ${vibes.join(', ')}.`
    : ''

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Here is the list:\n\n${list}${canonLine}${vibeLine}`,
      }],
    })
    const profile = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return res.status(200).json({ profile })
  } catch (err) {
    console.error('[taste-profile]', err)
    return res.status(500).json({ error: 'Failed to generate taste profile' })
  }
}
