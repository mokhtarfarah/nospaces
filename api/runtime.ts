import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
const _ce = (s: string | undefined) => (s ?? '').replace(/[^\x20-\x7E]/g, '').trim()
let _sba: ReturnType<typeof createClient> | null = null
const _ac = () => { if (!_sba) _sba = createClient(_ce(process.env.SUPABASE_URL), _ce(process.env.SUPABASE_SERVICE_ROLE_KEY)); return _sba }
async function requireAuth(req: VercelRequest): Promise<boolean> { const a = req.headers['authorization']; if (!a?.startsWith('Bearer ')) return false; try { const { error } = await _ac().auth.getUser(a.slice(7)); return !error } catch { return false } }

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!await requireAuth(req)) return res.status(401).end()

  const { title, creator, type, year } = req.body as {
    title: string
    creator?: string | null
    type: string
    year?: number | null
  }

  const desc = [title, creator, year].filter(Boolean).join(', ')

  const prompt = type === 'book'
    ? `How many pages is the book "${desc}"? Return JSON only: { "pages": 324 }. Use the most common edition. If unknown, return { "pages": null }.`
    : `What is the runtime in minutes of the ${type} "${desc}"? Return JSON only: { "runtime": 112 }. For a TV series use the average episode runtime. If unknown, return { "runtime": null }.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const json = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    res.status(200).json(json)
  } catch (err) {
    console.error('[runtime] error for', JSON.stringify({ title, type }), ':', err instanceof Error ? err.message : err)
    res.status(500).json({ error: 'Failed to fetch runtime/pages' })
  }
}
