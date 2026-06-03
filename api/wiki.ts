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
async function fetchInfoByUrl(wikiUrl: string): Promise<{ title: string; url: string; thumbnail: string | null; extract: string | null } | null> {
  // Extract page title from URL path — handles encoded chars like parentheses.
  const match = wikiUrl.match(/wikipedia\.org\/wiki\/(.+)/)
  if (!match) return null
  const pageTitle = decodeURIComponent(match[1].replace(/_/g, ' '))
  const apiUrl =
    'https://en.wikipedia.org/w/api.php?action=query&format=json' +
    '&prop=pageimages|info|extracts&inprop=url&piprop=thumbnail&pithumbsize=160&pilicense=any' +
    '&exsentences=5&explaintext=1&redirects=1' +
    `&titles=${encodeURIComponent(pageTitle)}`
  const data = await (await fetch(apiUrl, {
    headers: { 'User-Agent': 'Nospaces/1.0 (https://nospaces.vercel.app; farahmokhtar94@gmail.com) node-fetch' },
  })).json()
  const pages = data?.query?.pages
  if (!pages) return null
  const page = Object.values(pages)[0] as { missing?: boolean; title?: string; fullurl?: string; thumbnail?: { source?: string }; extract?: string } | undefined
  if (!page?.title || page.missing) return null
  return {
    title: page.title,
    url: page.fullurl ?? wikiUrl,
    thumbnail: page.thumbnail?.source ?? null,
    extract: page.extract?.trim() || null,
  }
}

interface ParsedFields { year: number | null; creator: string | null; runtime: number | null; pages: number | null }

// Use Haiku to pull structured fields out of a Wikipedia extract.
async function parseFields(extract: string, type: string): Promise<ParsedFields> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `Extract these fields from the Wikipedia article extract below.
Type: ${type}
Extract: """${extract}"""

Return ONLY valid JSON (no markdown) with these keys:
- "year": the release/publication year as a number, or null
- "creator": the director (film/tv), author (book), or primary artist (music) as a string, or null
- "runtime": runtime in minutes as a number (film/tv only), or null
- "pages": page count as a number (book only), or null`
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 128,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}'
  try { return JSON.parse(text) } catch { return { year: null, creator: null, runtime: null, pages: null } }
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
        ? await parseFields(info.extract, type)
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
