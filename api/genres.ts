import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './_auth'

// Genre vocab — keep in sync with src/lib/genres.ts
const GENRE_VOCAB: Record<string, string[]> = {
  film:  ['action','animation','comedy','crime','documentary','drama','fantasy','horror','musical','romance','satire','sci-fi','thriller','western'],
  tv:    ['animation','comedy','crime','documentary','drama','fantasy','horror','reality','satire','sci-fi','thriller'],
  book:  ['biography','business','classics','crime','essay','fantasy','history','horror','literary fiction','mystery','philosophy','poetry','romance','satire','sci-fi','self-help','short stories','thriller','travel'],
  music: ['afrobeats','ambient','classical','country','electronic','folk','hip-hop','indie','jazz','latin','metal','pop','punk','r&b','rock','soul'],
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!await requireAuth(req)) return res.status(401).end()

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
  } catch {
    res.status(200).json({ tags: [] })
  }
}
