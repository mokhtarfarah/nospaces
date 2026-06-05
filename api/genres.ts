import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
const _ce = (s: string | undefined) => (s ?? '').replace(/[^\x20-\x7E]/g, '').trim()
let _sba: ReturnType<typeof createClient> | null = null
const _ac = () => { if (!_sba) _sba = createClient(_ce(process.env.SUPABASE_URL), _ce(process.env.SUPABASE_SERVICE_ROLE_KEY)); return _sba }
async function requireAuth(req: VercelRequest): Promise<boolean> { const a = req.headers['authorization']; if (!a?.startsWith('Bearer ')) return false; try { const { error } = await _ac().auth.getUser(a.slice(7)); return !error } catch { return false } }

// Keep in sync with src/lib/genres.ts (can't import across dirs in Vercel functions).
const GENRE_VOCAB: Record<string, string[]> = {
  film:  ['action','animation','classic','comedy','crime','documentary','drama','fantasy','horror','musical','period piece','romance','satire','sci-fi','thriller','western'],
  tv:    ['animation','classic','comedy','crime','documentary','drama','fantasy','horror','period piece','reality','satire','sci-fi','thriller'],
  book:  ['biography','business','classics','crime','essay','fantasy','historical fiction','history','horror','literary fiction','memoir','mystery','period piece','philosophy','poetry','romance','satire','sci-fi','self-help','short stories','thriller','travel'],
  music: ['afrobeats','ambient','art pop','classical','country','electronic','experimental','folk','funk','glam rock','hip-hop','indie','jazz','latin','metal','new wave','pop','post-punk','punk','r&b','rock','soul'],
  other: [],
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
  } catch (err) {
    console.error('[genres] error for', JSON.stringify({ title, type }), ':', err instanceof Error ? err.message : err)
    res.status(200).json({ tags: [] })
  }
}
