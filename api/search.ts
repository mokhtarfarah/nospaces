import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GENRE_FLAT as GENRES } from './_genres.js'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'

const TYPES = ['film', 'book', 'music', 'tv']
const STATUSES = ['want_to', 'done', 'in_progress']
const VIBES = ['hazy','dark','melancholic','nostalgic','romantic','off-kilter','epic','playful','sexy','sharp','lush','intense','heavy','easy','demanding','funny','cozy','earnest','arthouse','fun','hype','raw','danceable','groovy','mellow','hypnotic','propulsive','dense','lyrical','immersive','literary','spare']
const VERDICTS = ['comfort','guilty pleasure','hyperfixation','in rotation','unfinished business','delivers','stuck with me','respect, not love','overrated','so bad it\'s good']

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface SearchFilters {
  type: string | null
  status: string | null
  vibe: string | null
  verdict: string | null
  genre: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userId = await getAuthUserId(req.headers['authorization'])
  if (!userId) return res.status(401).end()
  if (!await checkRateLimit(userId, 'search', 60)) return res.status(429).json({ error: 'Rate limit exceeded. Try again next hour.' })

  const { query } = req.body as { query?: string }
  if (!query?.trim()) return res.status(400).json({ error: 'query required' })

  const prompt = `Map this library search to filter values. Return JSON only, no explanation.

Query: "${query}"

Available values — only use exact strings from these lists:
- type: ${TYPES.join(', ')}
- status: want_to (backlog / haven't seen/read), done (finished / watched / read), in_progress (currently reading/watching)
- vibe: ${VIBES.join(', ')}
- verdict: ${VERDICTS.join(', ')}
- genre: ${GENRES.join(', ')}

Return a JSON object with only the fields you're confident about. Use null for anything unclear or not mentioned.
Example: {"type":"film","status":"want_to","vibe":"cozy","verdict":null,"genre":null}`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
    const raw = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())

    const filters: SearchFilters = {
      type:    TYPES.includes(raw.type) ? raw.type : null,
      status:  STATUSES.includes(raw.status) ? raw.status : null,
      vibe:    VIBES.includes(raw.vibe) ? raw.vibe : null,
      verdict: VERDICTS.includes(raw.verdict) ? raw.verdict : null,
      genre:   GENRES.includes(raw.genre) ? raw.genre : null,
    }

    res.status(200).json({ filters })
  } catch (err) {
    console.error('[search] error:', err instanceof Error ? err.message : err)
    res.status(500).json({ error: 'interpretation failed' })
  }
}
