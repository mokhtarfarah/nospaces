import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
const _ce = (s: string | undefined) => (s ?? '').replace(/[^\x20-\x7E]/g, '').trim()
let _sba: ReturnType<typeof createClient> | null = null
const _ac = () => { if (!_sba) _sba = createClient(_ce(process.env.SUPABASE_URL), _ce(process.env.SUPABASE_SERVICE_ROLE_KEY)); return _sba }
async function requireAuth(req: VercelRequest): Promise<boolean> { const a = req.headers['authorization']; if (!a?.startsWith('Bearer ')) return false; try { const { error } = await _ac().auth.getUser(a.slice(7)); return !error } catch { return false } }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

function wikiQueries(type: string, title: string, creator: string, year: string): string[] {
  const bare = title.replace(/^(the|a|an)\s+/i, '').trim()
  switch (type) {
    case 'film':
      return [
        ...(year ? [`${title} ${year} film`] : []),
        `${title} film`,
        ...(bare !== title ? [`${bare} film`] : []),
        title,
      ]
    case 'tv':
      return [`${title} TV series`, `${title} television series`, title]
    case 'book':
      return [[title, creator].filter(Boolean).join(' '), title]
    case 'music':
      return [[title, creator, 'album'].filter(Boolean).join(' '), `${title} album`, title]
    default:
      return []
  }
}

const normalize = (s: string) => s.toLowerCase().replace(/\s*\([^)]*\)\s*/g, '').trim()

async function fetchInfo(query: string): Promise<{ title: string; url: string; thumbnail: string | null; summary: string | null } | null> {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json' +
    '&prop=pageimages|info|extracts&inprop=url&piprop=thumbnail&pithumbsize=160&pilicense=any' +
    '&exsentences=2&explaintext=1' +
    `&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(query)}`
  const data = await (await fetch(url, {
    headers: { 'User-Agent': 'Nospaces/1.0 (https://nospaces.vercel.app; farahmokhtar94@gmail.com) node-fetch' },
  })).json()
  const pages = data?.query?.pages
  if (!pages) return null
  const page = Object.values(pages)[0] as { title?: string; fullurl?: string; thumbnail?: { source?: string }; extract?: string } | undefined
  if (!page?.title) return null
  return {
    title: page.title,
    url: page.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    thumbnail: page.thumbnail?.source ?? null,
    summary: page.extract?.trim() || null,
  }
}

// Fetch a Wikipedia article by its full URL (e.g. https://en.wikipedia.org/wiki/Mother_(2009_film)).
// Returns a longer extract (5 sentences) for field parsing.
async function fetchInfoByUrl(wikiUrl: string): Promise<{ title: string; url: string; thumbnail: string | null; extract: string | null; categories: string[] } | null> {
  // Extract page title from URL path — handles encoded chars like parentheses.
  const match = wikiUrl.match(/wikipedia\.org\/wiki\/(.+)/)
  if (!match) return null
  const pageTitle = decodeURIComponent(match[1].replace(/_/g, ' '))
  const apiUrl =
    'https://en.wikipedia.org/w/api.php?action=query&format=json' +
    '&prop=pageimages|info|extracts|categories&inprop=url&piprop=thumbnail&pithumbsize=160&pilicense=any' +
    '&exsentences=8&explaintext=1&redirects=1&cllimit=30' +
    `&titles=${encodeURIComponent(pageTitle)}`
  const data = await (await fetch(apiUrl, {
    headers: { 'User-Agent': 'Nospaces/1.0 (https://nospaces.vercel.app; farahmokhtar94@gmail.com) node-fetch' },
  })).json()
  const pages = data?.query?.pages
  if (!pages) return null
  const page = Object.values(pages)[0] as { missing?: boolean; title?: string; fullurl?: string; thumbnail?: { source?: string }; extract?: string; categories?: { title: string }[] } | undefined
  if (!page?.title || page.missing) return null
  // Strip "Category:" prefix and keep only genre-informative ones (skip maintenance/stub categories).
  const categories = (page.categories ?? [])
    .map((c: { title: string }) => c.title.replace(/^Category:\s*/i, ''))
    .filter((c: string) => !/stub|article|page|template|wikipedia|wikiproject|cs1|use |infobox/i.test(c))
  return {
    title: page.title,
    url: page.fullurl ?? wikiUrl,
    thumbnail: page.thumbnail?.source ?? null,
    extract: page.extract?.trim() || null,
    categories,
  }
}

interface ParsedFields { year: number | null; creator: string | null; runtime: number | null; pages: number | null; genres: string[] }

// Genre vocab per type — must stay in sync with src/lib/genres.ts.
const GENRE_VOCAB: Record<string, string[]> = {
  film: ['action','animation','classic','comedy','crime','documentary','drama','fantasy','horror','musical','period piece','romance','satire','sci-fi','thriller','western'],
  tv:   ['animation','classic','comedy','crime','documentary','drama','fantasy','horror','period piece','reality','satire','sci-fi','thriller'],
  book: ['biography','business','classics','crime','essay','fantasy','historical fiction','history','horror','literary fiction','memoir','mystery','period piece','philosophy','poetry','romance','satire','sci-fi','self-help','short stories','thriller','travel'],
  music:['afrobeats','ambient','classical','country','electronic','folk','hip-hop','indie','jazz','latin','metal','pop','punk','r&b','rock','soul'],
}

const CREATOR_ROLE: Record<string, string> = {
  film: 'primary director (ignore writers, producers, actors)',
  tv:   'primary director or showrunner (ignore writers, actors)',
  book: 'author (ignore editors, translators)',
  music:'primary recording artist or band (ignore producers, featured artists)',
}

// Use Haiku to pull structured fields out of a Wikipedia extract + categories.
async function parseFields(extract: string, categories: string[], type: string, workTitle: string): Promise<ParsedFields> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const vocab = (GENRE_VOCAB[type] ?? []).join(', ')
  const role = CREATOR_ROLE[type] ?? 'primary creator'
  const catLine = categories.length ? `\nWikipedia categories: ${categories.slice(0, 20).join(' · ')}` : ''
  const prompt = `Extract structured data from this Wikipedia article. Return ONLY a JSON object, no markdown.

Media type: ${type}
Work: ${workTitle}
Article extract: """${extract}"""${catLine}

JSON keys (use null if not found):
- "year": release/publication year as integer
- "creator": ${role} — single name as string (e.g. "Justine Triet", "Ursula K. Le Guin")
- "runtime": running time in minutes as integer (${type === 'film' || type === 'tv' ? 'extract it' : 'always null'})
- "pages": page count as integer (${type === 'book' ? 'extract it' : 'always null'})
- "genres": the work's 1–3 genres, lowercase. Determine them from the extract, the categories above, AND your own knowledge of "${workTitle}" — Wikipedia often omits a clean genre label (e.g. it rarely says "literary fiction"), so infer it. Use the EXACT spelling from this list whenever it fits: [${vocab}]. Only if the primary genre genuinely isn't in the list (e.g. "memoir", "graphic novel", "true crime") use that lowercase term. Always return at least one genre.`

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}'
  try {
    const parsed = JSON.parse(text)
    return {
      year: parsed.year ?? null,
      creator: parsed.creator ?? null,
      runtime: parsed.runtime ?? null,
      pages: parsed.pages ?? null,
      genres: Array.isArray(parsed.genres) ? parsed.genres : [],
    }
  } catch {
    return { year: null, creator: null, runtime: null, pages: null, genres: [] }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!await requireAuth(req)) return res.status(401).end()

  // --- New branch: fetch by URL + optionally parse fields ---
  const rawUrl = one(req.query.url)
  if (rawUrl) {
    // SSRF guard — only allow wikipedia.org
    if (!/^https?:\/\/([a-z]{2}\.)?wikipedia\.org\//.test(rawUrl)) return res.status(400).end()
    try {
      const info = await fetchInfoByUrl(rawUrl)
      if (!info) return res.json({ url: null, thumbnail: null, summary: null, parsed: null })
      const type = one(req.query.type)
      const parsed = (req.query.parse === '1' && type && info.extract)
        ? await parseFields(info.extract, info.categories, type, info.title)
        : null
      return res.json({ url: info.url, thumbnail: info.thumbnail, summary: info.extract, parsed })
    } catch {
      return res.json({ url: null, thumbnail: null, summary: null, parsed: null })
    }
  }

  // --- Existing branch: search by title/type ---
  const type = one(req.query.type)
  const title = one(req.query.title)
  const creator = one(req.query.creator)
  const year = one(req.query.year)

  if (!type || !title) return res.status(400).json({ url: null, thumbnail: null, summary: null })

  const queries = wikiQueries(type, title, creator, year)
  if (!queries.length) return res.json({ url: null, thumbnail: null, summary: null })

  const guarded = type === 'book' || type === 'music'
  const a = normalize(title)

  for (const query of queries) {
    try {
      const found = await fetchInfo(query)
      if (!found) continue
      if (guarded) {
        const b = normalize(found.title)
        if (!b.includes(a) && !a.includes(b)) continue
      }
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')
      return res.json({ url: found.url, thumbnail: found.thumbnail, summary: found.summary })
    } catch {
      // try next query
    }
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  return res.json({ url: null, thumbnail: null, summary: null })
}
