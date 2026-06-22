import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GENRE_VOCAB } from './_genres.js'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userId = await getAuthUserId(req.headers['authorization'])
  if (!userId) return res.status(401).end()
  if (!await checkRateLimit(userId, 'genres', 60)) return res.status(429).json({ error: 'Rate limit exceeded. Try again next hour.' })

  const { title, creator, type } = req.body as { title?: string; creator?: string; type?: string }
  if (!title || !type) return res.status(400).json({ tags: [] })

  const genres = GENRE_VOCAB[type]
  if (!genres?.length) return res.status(200).json({ tags: [] })

  const creatorLine = creator ? ` by ${creator}` : ''
  const prompt = `Given this ${type}: "${title}"${creatorLine}

Pick 1–3 genres from this list only (return as JSON array, no other text):
${genres.join(', ')}

If none fit, return [].`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]'
    const raw = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    const tags = (Array.isArray(raw) ? raw : [])
      .filter((t: unknown) => typeof t === 'string' && genres.includes(t))
    res.status(200).json({ tags })
  } catch (err) {
    console.error('[genres] error for', JSON.stringify({ title, type }), ':', err instanceof Error ? err.message : err)
    res.status(200).json({ tags: [] })
  }
}
