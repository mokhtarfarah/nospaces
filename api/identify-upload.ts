import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  api: { bodyParser: false },
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // Read raw body from stream
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const imageBuffer = Buffer.concat(chunks)

  if (!imageBuffer.length) return res.status(400).json({ error: 'No image data' })

  const rawType = req.headers['content-type'] ?? 'image/jpeg'
  // Strip any params like "; boundary=..."
  const mimeType = rawType.split(';')[0].trim() as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
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

    // Build a ready-to-open URL so the Shortcut only needs one dictionary lookup
    const params = new URLSearchParams({
      title: json.title ?? '',
      type: json.type ?? 'other',
      creator: json.creator ?? '',
      year: json.year ? String(json.year) : '',
      confidence: json.confidence ?? 'high',
    })
    json.open_url = `https://nospaces.vercel.app/add?${params.toString()}`

    res.status(200).json(json)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to identify image' })
  }
}
