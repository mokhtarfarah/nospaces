import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'

// Vibe vocab — mirrors vibesForType() in src/lib/moods.ts (keep in sync)
const VIBES_CORE = ['hazy','dark','melancholic','nostalgic','romantic','off-kilter','epic','playful','sexy','sharp','lush']
const VIBES_NARRATIVE = ['intense','heavy','easy','demanding','funny','cozy','earnest']
const VIBES_FILM_TV = ['arthouse','fun']
const VIBES_MUSIC = ['hype','raw','danceable','groovy','mellow','hypnotic']
const VIBES_BOOK = ['propulsive','dense','lyrical','immersive','literary','spare']

function vibesForType(type: string): string[] {
  switch (type) {
    case 'film':
    case 'tv':   return [...VIBES_CORE, ...VIBES_NARRATIVE, ...VIBES_FILM_TV]
    case 'book': return [...VIBES_CORE, ...VIBES_NARRATIVE, ...VIBES_BOOK]
    case 'music':return [...VIBES_CORE, ...VIBES_MUSIC]
    default:     return VIBES_CORE
  }
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userId = await getAuthUserId(req.headers['authorization'])
  if (!userId) return res.status(401).end()
  if (!await checkRateLimit(userId, 'vibes', 60)) return res.status(429).json({ error: 'Rate limit exceeded. Try again next hour.' })

  const { title, creator, type, year } = req.body as { title?: string; creator?: string; type?: string; year?: number | null }
  if (!title || !type) return res.status(400).json({ suggestions: [] })

  const vocab = vibesForType(type)
  if (!vocab.length) return res.status(200).json({ suggestions: [] })

  const creatorLine = creator ? ` by ${creator}` : ''
  const yearLine = year ? ` (${year})` : ''
  const prompt = `You are a media taste assistant. Based on your knowledge of this ${type}, suggest 1–3 vibes that describe what it feels like — the texture, tone, or atmosphere of the work itself.

${type}: "${title}"${creatorLine}${yearLine}

Pick ONLY from this list (return as a JSON array, no other text):
${vocab.join(', ')}

Be confident — only include vibes you're sure fit. Return [] if nothing fits well.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]'
    const raw = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    const suggestions = (Array.isArray(raw) ? raw : [])
      .filter((s: unknown) => typeof s === 'string' && vocab.includes(s))
      .slice(0, 3)
    res.status(200).json({ suggestions })
  } catch (err) {
    console.error('[vibes] error for', JSON.stringify({ title, type }), ':', err instanceof Error ? err.message : err)
    res.status(200).json({ suggestions: [] })
  }
}
