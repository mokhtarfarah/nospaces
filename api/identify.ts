import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an assistant that identifies films, books, music albums, and TV shows from text descriptions or titles. Return JSON only, no preamble, no markdown.`

const USER_PROMPT = (input: string) => `Given this input: "${input}"

Identify the item and return JSON only:
{
  "title": "exact title",
  "creator": "director / author / artist / showrunner",
  "type": "film|book|music|tv|other",
  "year": 1234,
  "confidence": "high|medium|low",
  "metadata": {},
  "tags": ["tag1", "tag2"],
  "ambiguous": false,
  "alternatives": []
}

If confidence is low, populate alternatives with up to 3 other possible matches with the same shape.
If you cannot identify anything, return type "other" with the input as the title.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { input, imageBase64, mimeType } = req.body as {
    input?: string
    imageBase64?: string
    mimeType?: string
  }

  try {
    const content: Anthropic.MessageParam['content'] = []

    if (imageBase64 && mimeType) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: imageBase64,
        },
      })
      content.push({
        type: 'text',
        text: 'Identify the film, book, music album, or TV show in this image. Return JSON only:\n{\n  "title": "...",\n  "creator": "...",\n  "type": "film|book|music|tv|other",\n  "year": 1234,\n  "confidence": "high|medium|low",\n  "metadata": {},\n  "tags": [],\n  "ambiguous": false,\n  "alternatives": []\n}',
      })
    } else {
      content.push({ type: 'text', text: USER_PROMPT(input ?? '') })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const json = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())

    res.status(200).json(json)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to identify item' })
  }
}
