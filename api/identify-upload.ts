import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  api: { bodyParser: false },
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // Read raw body
  const chunks: Uint8Array[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const imageBuffer = Buffer.concat(chunks)

  const rawType = (req.headers['content-type'] ?? 'image/jpeg').split(';')[0].trim()
  console.log('[identify-upload] content-type:', rawType, 'bytes:', imageBuffer.length)

  if (!imageBuffer.length) {
    return res.status(400).json({ error: 'No image data received' })
  }

  // Claude only supports jpeg/png/gif/webp — treat anything else as jpeg
  const mimeType = SUPPORTED_TYPES.includes(rawType)
    ? rawType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    : 'image/jpeg'

  const base64 = imageBuffer.toString('base64')

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 },
          },
          {
            type: 'text',
            text: 'Identify the film, book, music album, or TV show in this image. Return JSON only, no preamble:\n{\n  "title": "...",\n  "creator": "...",\n  "type": "film|book|music|tv|other",\n  "year": 1234,\n  "confidence": "high|medium|low",\n  "metadata": {},\n  "tags": [],\n  "ambiguous": false,\n  "alternatives": []\n}',
          },
        ],
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const json = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())

    const params = new URLSearchParams({
      title: json.title ?? '',
      type: json.type ?? 'other',
      creator: json.creator ?? '',
      year: json.year ? String(json.year) : '',
      confidence: json.confidence ?? 'high',
    })
    json.open_url = `https://nospaces.vercel.app/add?${params.toString()}`

    console.log('[identify-upload] success:', json.title, json.type)
    res.status(200).json(json)
  } catch (err) {
    console.error('[identify-upload] error:', err)
    // Always return a valid open_url so Shortcut clipboard is never emptied on failure
    const params = new URLSearchParams({ title: '', type: 'other', confidence: 'low' })
    res.status(200).json({ error: String(err), open_url: `https://nospaces.vercel.app/add?${params}` })
  }
}
