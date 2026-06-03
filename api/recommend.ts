import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Both text queries and URL input go through web_search_20250305. Direct
// server-side fetch doesn't work for modern editorial sites (JS-rendered, e.g.
// Pitchfork). Anthropic's search infrastructure handles rendering. Typical
// latency: 40–60s for 30 items. Requires Vercel Pro (300s max) — set to 90s
// for a safe margin.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const config = { maxDuration: 120 }

const GENRE_VOCAB: Record<string, string[]> = {
  film:  ['action','animation','comedy','crime','documentary','drama','fantasy','horror','musical','romance','sci-fi','thriller','western'],
  tv:    ['animation','comedy','crime','documentary','drama','fantasy','horror','reality','sci-fi','thriller'],
  book:  ['biography','business','classics','crime','essay','fantasy','history','horror','literary fiction','mystery','philosophy','poetry','romance','sci-fi','self-help','short stories','thriller','travel'],
  music: ['afrobeats','ambient','classical','country','electronic','folk','hip-hop','indie','jazz','latin','metal','pop','punk','r&b','rock','soul'],
}

const SYSTEM_PROMPT = `You are a media-recommendation assistant. Use web search to find and read the exact list the user asks for, then return its entries as structured data. Return JSON only — no preamble, no text outside the JSON.`

function buildPrompt(input: string, isUrl: boolean): string {
  const finding = isUrl
    ? `The user has provided a direct link to a list. Read the content at this exact URL: ${input}`
    : `Find and read this published list: "${input}". Search for it from the named publication, or a well-known outlet if none is named.`

  const genreBlock = Object.entries(GENRE_VOCAB).map(([t, g]) => `  ${t}: ${g.join(', ')}`).join('\n')

  return `${finding}

Return ONLY a JSON object in this exact shape:

{
  "source": "list name + outlet, e.g. \\"Pitchfork — The 50 Best Albums of 2025\\"",
  "sourceUrl": "canonical URL of the page you read (use the provided URL if given, else the URL you found)",
  "items": [
    {
      "rank": 1,
      "title": "exact title",
      "creator": "director / author / artist / showrunner",
      "type": "film|book|music|tv|other",
      "year": 2025,
      "tags": ["genre1", "genre2"],
      "blurb": "1–2 sentences about what this item sounds, reads, or feels like — its style, themes, or what makes it distinctive. Use the source's own writing if you have it; otherwise draw on your own knowledge of the work. Be specific. Never say things like 'ranked #1' or 'makes this list' or 'pushes boundaries'."
    }
  ]
}

Rules:
- Preserve the original list order. rank is 1-based.
- Return ALL items on the list, up to 50.
- type must be one of: film, book, music, tv, other. Albums → music. Movies → film. Series → tv.
- Always fill creator. Only null if genuinely unknowable.
- tags: 1–3 genres from the vocab below — use only these values, no others:
${genreBlock}
- blurb: pull from the source's actual review/description text. Describe the specific sound, writing style, visual language, or themes. Avoid filler phrases.
- year: release/publication year as a number, or null.
- If you cannot find the list, return {"source":"","sourceUrl":"","items":[]}.
- Output the JSON object only.`
}

function isUrl(s: string) {
  return /^https?:\/\//i.test(s.trim())
}

interface RecItem {
  rank: number
  title: string
  creator: string | null
  type: string
  year: number | null
  tags: string[]
  blurb: string
}

function buildPdfPrompt(): string {
  const genreBlock = Object.entries(GENRE_VOCAB).map(([t, g]) => `  ${t}: ${g.join(', ')}`).join('\n')
  return `Extract the ranked list from this PDF document.

Return ONLY a JSON object in this exact shape:

{
  "source": "list name + outlet as it appears in the document",
  "sourceUrl": "",
  "items": [
    {
      "rank": 1,
      "title": "exact title",
      "creator": "director / author / artist / showrunner",
      "type": "film|book|music|tv|other",
      "year": 2025,
      "tags": ["genre1", "genre2"],
      "blurb": "1–2 sentences about what this item sounds, reads, or feels like — its style, themes, or what makes it distinctive. Use the document's own writing if present; otherwise your own knowledge. Never mention rankings or list placement."
    }
  ]
}

Rules:
- Preserve the original list order. rank is 1-based.
- Return ALL items, up to 50.
- type: film, book, music, tv, or other. Albums → music. Movies → film. Series → tv.
- Always fill creator. Only null if genuinely unknowable.
- tags: 1–3 genres from vocab only:
${genreBlock}
- year: release/publication year as a number, or null.
- If you cannot find a list, return {"source":"","sourceUrl":"","items":[]}.
- Output the JSON object only.`
}

const validTypes = new Set(['film', 'book', 'music', 'tv', 'other'])

function parseResponse(text: string, fallbackSourceUrl: string) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return { source: '', sourceUrl: '', items: [] }
  const parsed = JSON.parse(match[0]) as { source?: string; sourceUrl?: string; items?: RecItem[] }
  const items = (parsed.items ?? [])
    .filter(i => i && i.title)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((i, idx) => {
      const type = validTypes.has(i.type) ? i.type : 'other'
      const vocab = GENRE_VOCAB[type] ?? []
      const tags = (Array.isArray(i.tags) ? i.tags : [])
        .map(t => String(t).toLowerCase().trim())
        .filter(t => vocab.includes(t))
        .slice(0, 3)
      return {
        rank: typeof i.rank === 'number' ? i.rank : idx + 1,
        title: String(i.title).trim(),
        creator: i.creator ? String(i.creator).trim() : null,
        type,
        year: typeof i.year === 'number' ? i.year : null,
        tags,
        blurb: i.blurb ? String(i.blurb).trim() : '',
      }
    })
  return {
    source: parsed.source ?? '',
    sourceUrl: parsed.sourceUrl ?? fallbackSourceUrl,
    items,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = req.body as { query?: string; pdfBase64?: string }

  // PDF path: document block, no web_search needed
  if (body.pdfBase64) {
    console.log('pdf path: base64 length', body.pdfBase64.length, 'approx MB', (body.pdfBase64.length * 0.75 / 1024 / 1024).toFixed(2))
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: body.pdfBase64 } },
            { type: 'text', text: buildPdfPrompt() },
          ],
        }],
      }, { headers: { 'anthropic-beta': 'pdfs-2024-09-25' } })
      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text).join('\n')
      return res.status(200).json(parseResponse(text, ''))
    } catch (err) {
      console.error('pdf error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      return res.status(500).json({ error: `Failed to parse PDF: ${msg}` })
    }
  }

  const { query } = body
  if (!query || !query.trim()) return res.status(400).json({ error: 'Missing query' })

  const input = query.trim()
  const url = isUrl(input)

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages: [{ role: 'user', content: buildPrompt(input, url) }],
    })

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')

    res.status(200).json(parseResponse(text, url ? input : ''))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch recommendations' })
  }
}
