import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './auth'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!await requireAuth(req)) return res.status(401).end()

  const { input } = req.body as { input?: string }
  if (!input?.trim()) return res.status(200).json({ searchQuery: '', type: null, sortByRecency: false })

  // Temporal intent ("latest", "new", "recent"…) → caller should surface the newest release.
  const sortByRecency = /\b(latest|newest|recent|new|current|this year)\b/i.test(input)

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      messages: [{
        role: 'user',
        content: `Extract catalog search intent from this media query. Return JSON only: { "searchQuery": string, "type": "film"|"book"|"music"|"tv"|null }

searchQuery: the best keyword string for a catalog search — use the creator name when prominent, strip filler words like "latest", "new", "that", "recent"
type: the media type if clear, otherwise null

Examples:
"rosalía's latest album" → {"searchQuery":"Rosalía","type":"music"}
"that new Villeneuve movie" → {"searchQuery":"Denis Villeneuve","type":"film"}
"the bear" → {"searchQuery":"The Bear","type":"tv"}
"middlemarch" → {"searchQuery":"Middlemarch George Eliot","type":"book"}
"Dune Part Two" → {"searchQuery":"Dune Part Two","type":"film"}
"Taylor Swift folklore" → {"searchQuery":"Taylor Swift folklore","type":"music"}
"something by Ottessa Moshfegh" → {"searchQuery":"Ottessa Moshfegh","type":"book"}

Input: "${input.trim().replace(/"/g, '\\"')}"`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const json = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    const searchQuery = typeof json.searchQuery === 'string' ? json.searchQuery : ''
    console.log('[describe] input=%s → searchQuery=%s type=%s', input, searchQuery, json.type ?? null)
    return res.status(200).json({
      searchQuery,
      type: json.type ?? null,
      sortByRecency,
    })
  } catch (err) {
    console.error('[describe] error:', err instanceof Error ? err.message : err)
    return res.status(200).json({ searchQuery: input.trim(), type: null, sortByRecency })
  }
}
