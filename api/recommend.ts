import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Recommendations: takes a free-text request for a named list (e.g. "NYT best
// books summer 2026", "Pitchfork best albums 2025") and uses Claude + web search
// to pull the *actual, current* list — sidestepping the model's training cutoff.
// Returns concrete items the RecommendScreen dedupes against the library and
// offers as a save-as-want_to checklist. Each item keeps the source's own blurb
// so the user gets a sense of the pick without any extra AI/taste pass.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Web search + parsing a full list takes ~30–50s — well past Vercel's 10s
// default. Raise to the Hobby-plan max so the request isn't killed mid-search.
export const config = { maxDuration: 60 }

const SYSTEM_PROMPT = `You are a media-recommendation assistant. The user names a published list, ranking, or "best of" roundup of films, books, music albums, or TV shows. Use web search to find that exact list from a reputable source, then return its entries as structured data. Capture what the source itself says about each pick.`

const userPrompt = (query: string) => `Find this list and return its items: "${query}"

Search the web for the real, current list from a reputable source (the publication named, or a well-known outlet if none is named). Then return ONLY a JSON object — no preamble, no commentary outside the JSON — in this exact shape:

{
  "source": "the list's name + outlet, e.g. \\"The New York Times — Best Books of Summer 2026\\"",
  "items": [
    {
      "title": "exact title",
      "creator": "director / author / artist / showrunner (best known)",
      "type": "film|book|music|tv|other",
      "year": 2026,
      "blurb": "1–2 sentences capturing what the list/source says about this pick — paraphrase or briefly quote the source's description, not your own opinion"
    }
  ]
}

Rules:
- Return every item on the list (cap at 30 if it's longer).
- "type" must be one of film, book, music, tv, other. Albums → music. Movies → film. Series → tv.
- Always fill "creator" (author/director/artist/showrunner). Only null if genuinely unknowable.
- "blurb" must reflect the SOURCE's take on the item (why it's on the list), not a generic synopsis and not your own judgement. Keep it short.
- "year" is the item's release/publication year if known, else null.
- If you cannot find a credible matching list, return {"source": "", "items": []}.
- Output the JSON object only.`

interface RecItem {
  title: string
  creator: string | null
  type: string
  year: number | null
  blurb: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { query } = req.body as { query?: string }
  if (!query || !query.trim()) return res.status(400).json({ error: 'Missing query' })

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages: [{ role: 'user', content: userPrompt(query.trim()) }],
    })

    // The web_search tool is server-executed, so the final answer arrives in one
    // response. Concatenate all text blocks (skipping tool-use / search-result
    // blocks) and pull the JSON object out.
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return res.status(200).json({ source: '', items: [] })

    const parsed = JSON.parse(match[0]) as { source?: string; items?: RecItem[] }
    const items = (parsed.items ?? [])
      .filter(i => i && i.title)
      .map(i => ({
        title: String(i.title).trim(),
        creator: i.creator ? String(i.creator).trim() : null,
        type: ['film', 'book', 'music', 'tv', 'other'].includes(i.type) ? i.type : 'other',
        year: typeof i.year === 'number' ? i.year : null,
        blurb: i.blurb ? String(i.blurb).trim() : '',
      }))

    res.status(200).json({ source: parsed.source ?? '', items })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch recommendations' })
  }
}
