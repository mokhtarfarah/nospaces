import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Web search + parsing a full list takes ~30–50s — well past Vercel's 10s default.
export const config = { maxDuration: 60 }

const GENRE_VOCAB: Record<string, string[]> = {
  film:  ['action','animation','comedy','crime','documentary','drama','fantasy','horror','musical','romance','sci-fi','thriller','western'],
  tv:    ['animation','comedy','crime','documentary','drama','fantasy','horror','reality','sci-fi','thriller'],
  book:  ['biography','business','classics','crime','essay','fantasy','history','horror','literary fiction','mystery','philosophy','poetry','romance','sci-fi','self-help','short stories','thriller','travel'],
  music: ['afrobeats','ambient','classical','country','electronic','folk','hip-hop','indie','jazz','latin','metal','pop','punk','r&b','rock','soul'],
}

const SYSTEM_PROMPT = `You are a media-recommendation assistant. The user gives you either a URL or a description of a published list. Use web search to find and read the real list, then return its entries as structured data.`

const userPrompt = (input: string, isUrl: boolean) => {
  const finding = isUrl
    ? `Fetch and read this URL, then extract its list of media items: ${input}`
    : `Find this list and read it: "${input}"\nSearch the web for the real, current list from the named publication (or a well-known outlet if none is named).`

  return `${finding}

Return ONLY a JSON object — no preamble, no text outside the JSON — in this exact shape:

{
  "source": "list name + outlet, e.g. \\"The New York Times — Best Books of Summer 2026\\"",
  "sourceUrl": "the canonical URL of the list you read (empty string if unknown)",
  "items": [
    {
      "rank": 1,
      "title": "exact title",
      "creator": "director / author / artist / showrunner",
      "type": "film|book|music|tv|other",
      "year": 2026,
      "tags": ["genre1", "genre2"],
      "blurb": "2–3 sentences describing the work itself — what it sounds/reads/feels like, what makes it notable or distinctive — drawn from what the source says about it. Do NOT say things like 'ranked #1' or 'included in this list'. Describe the actual work."
    }
  ]
}

Rules:
- Preserve the original list order. Set "rank" to the item's position in the list (1-based). If the list is unranked, still number sequentially.
- Cap at 30 items.
- "type": film, book, music, tv, or other. Albums → music. Movies → film. Series → tv.
- Always fill "creator". Only null if genuinely unknowable.
- "tags": 1–3 genres from the relevant vocab below. Empty array if type is "other".
  film: action, animation, comedy, crime, documentary, drama, fantasy, horror, musical, romance, sci-fi, thriller, western
  tv: animation, comedy, crime, documentary, drama, fantasy, horror, reality, sci-fi, thriller
  book: biography, business, classics, crime, essay, fantasy, history, horror, literary fiction, mystery, philosophy, poetry, romance, sci-fi, self-help, short stories, thriller, travel
  music: afrobeats, ambient, classical, country, electronic, folk, hip-hop, indie, jazz, latin, metal, pop, punk, r&b, rock, soul
- "blurb": describe the actual work — its sound, style, themes, what makes it distinctive. Pull from the source's own writing. Do NOT mention rankings, list placement, or that it "made the list".
- "year": release/publication year as a number, or null.
- If you cannot find or access the list, return {"source":"","sourceUrl":"","items":[]}.
- Output the JSON object only.`
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

function isUrl(s: string) {
  return /^https?:\/\//i.test(s.trim())
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { query } = req.body as { query?: string }
  if (!query || !query.trim()) return res.status(400).json({ error: 'Missing query' })

  const input = query.trim()
  const url = isUrl(input)

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages: [{ role: 'user', content: userPrompt(input, url) }],
    })

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return res.status(200).json({ source: '', sourceUrl: '', items: [] })

    const parsed = JSON.parse(match[0]) as { source?: string; sourceUrl?: string; items?: RecItem[] }

    const validTypes = new Set(['film', 'book', 'music', 'tv', 'other'])
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

    res.status(200).json({
      source: parsed.source ?? '',
      sourceUrl: parsed.sourceUrl ?? (url ? input : ''),
      items,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch recommendations' })
  }
}
