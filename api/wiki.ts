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
    '&prop=pageimages|info|extracts&inprop=url&piprop=thumbnail&pithumbsize=500&pilicense=any' +
    '&exintro=1&exsentences=2&explaintext=1' +
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
// `exintro=1` bounds the extract to the article's lead section — so the "about this"
// blurb never spills past the intro into a later section (Plot, etc.) and never drags
// in a `== Heading ==` label. `exsentences` is a further length cap on that lead.
async function fetchInfoByUrl(wikiUrl: string): Promise<{ title: string; url: string; thumbnail: string | null; extract: string | null; categories: string[] } | null> {
  // Extract page title from URL path — handles encoded chars like parentheses.
  const match = wikiUrl.match(/wikipedia\.org\/wiki\/(.+)/)
  if (!match) return null
  const pageTitle = decodeURIComponent(match[1].replace(/_/g, ' '))
  const apiUrl =
    'https://en.wikipedia.org/w/api.php?action=query&format=json' +
    '&prop=pageimages|info|extracts|categories&inprop=url&piprop=thumbnail&pithumbsize=500&pilicense=any' +
    '&exintro=1&exsentences=5&explaintext=1&redirects=1&cllimit=30' +
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

interface ParsedFields { year: number | null; creator: string | null; runtime: number | null; pages: number | null; genres: string[]; countries: string[] }

const WIKI_UA = 'Nospaces/1.0 (https://nospaces.vercel.app; farahmokhtar94@gmail.com) node-fetch'
const wbFetch = async (url: string) =>
  (await fetch(url, { headers: { 'User-Agent': WIKI_UA } })).json()

// Wikidata property ids for the "creator" claim, by media type. Wikidata stores
// these as entity ids (Q-numbers) that need a second label lookup.
const WD_CREATOR_PROPS: Record<string, string[]> = {
  film: ['P57'],          // director
  tv:   ['P57', 'P170'],  // director, then "creator"
  book: ['P50'],          // author
  music:['P175', 'P86'],  // performer, then composer
}

// Roll dissolved/historical states up to the modern country, so a filter chip
// reads "France" not "French Third Republic". Wikidata lists these as distinct
// country values; collapse the common ones that show up in media metadata.
const HISTORICAL_COUNTRY: Record<string, string> = {
  'French Third Republic': 'France',
  'French Fourth Republic': 'France',
  'French Fifth Republic': 'France',
  'Kingdom of France': 'France',
  'United Kingdom of Great Britain and Ireland': 'United Kingdom',
  'Kingdom of Great Britain': 'United Kingdom',
  'Kingdom of England': 'United Kingdom',
  'Weimar Republic': 'Germany',
  'Nazi Germany': 'Germany',
  'German Reich': 'Germany',
  'German Empire': 'Germany',
  'West Germany': 'Germany',
  'East Germany': 'Germany',
  'Kingdom of Italy': 'Italy',
  'Empire of Japan': 'Japan',
  'Russian Empire': 'Russia',
  'Kingdom of the Netherlands': 'Netherlands',
}

// Pull structured fields straight from Wikidata instead of parsing prose. Wikipedia
// keeps runtime/director/author/pages in the infobox (Wikidata claims), NOT in the
// article text — so the old Haiku-on-extract approach reliably missed them. This reads
// the actual data: free (no Anthropic), no guessing. Genre is intentionally left to the
// client's /api/genres call (title-knowledge), which handles our vocab better than
// Wikidata's genre entities.
async function wikidataFields(pageTitle: string, type: string): Promise<ParsedFields> {
  const empty: ParsedFields = { year: null, creator: null, runtime: null, pages: null, genres: [], countries: [] }
  try {
    // 1. page title → Wikidata Q-id (follow redirects)
    const d1 = await wbFetch(
      'https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageprops&ppprop=wikibase_item' +
      `&titles=${encodeURIComponent(pageTitle)}`
    )
    const pages = d1?.query?.pages
    if (!pages) return empty
    const page = Object.values(pages)[0] as { pageprops?: { wikibase_item?: string } } | undefined
    const qid = page?.pageprops?.wikibase_item
    if (!qid) return empty

    // 2. structured claims for the work
    const d2 = await wbFetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${qid}`
    )
    type Snak = { mainsnak?: { datavalue?: { value?: unknown } } }
    const claims: Record<string, Snak[]> = d2?.entities?.[qid]?.claims ?? {}

    const amounts = (pid: string): number[] =>
      (claims[pid] ?? [])
        .map(c => parseFloat(String((c.mainsnak?.datavalue?.value as { amount?: string })?.amount ?? '')))
        .filter(n => !isNaN(n) && n > 0)
    const entityIds = (pids: string[]): string[] => {
      for (const pid of pids) {
        const ids = (claims[pid] ?? [])
          .map(c => (c.mainsnak?.datavalue?.value as { id?: string })?.id)
          .filter((id): id is string => !!id)
        if (ids.length) return ids
      }
      return []
    }

    // year: earliest date across publication (P577), inception (P571), or start time
    // (P580 — how TV series store their first-aired date). Original release, not re-releases.
    const years = ['P577', 'P571', 'P580']
      .flatMap(pid => claims[pid] ?? [])
      .map(c => String((c.mainsnak?.datavalue?.value as { time?: string })?.time ?? ''))
      .map(t => parseInt(t.slice(1, 5)))
      .filter(y => !isNaN(y) && y > 0)
    const year = years.length ? Math.min(...years) : null

    // runtime: shortest duration (P2047) — usually the theatrical cut. film/tv only.
    const runtimes = type === 'film' || type === 'tv' ? amounts('P2047') : []
    const runtime = runtimes.length ? Math.round(Math.min(...runtimes)) : null

    // pages: P1104. book only.
    const pageCounts = type === 'book' ? amounts('P1104') : []
    const numPages = pageCounts.length ? Math.round(pageCounts[0]) : null

    // Resolve a list of Q-ids to English labels (one batched call).
    const labelsFor = async (ids: string[]): Promise<Record<string, string>> => {
      if (!ids.length) return {}
      const d = await wbFetch(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=en&ids=${ids.join('|')}`
      )
      const out: Record<string, string> = {}
      for (const id of ids) {
        const label = d?.entities?.[id]?.labels?.en?.value as string | undefined
        if (label) out[id] = label
      }
      return out
    }

    // Pull entity-id values for a property out of any claims object.
    const claimIds = (cl: Record<string, Snak[]>, pid: string): string[] =>
      (cl[pid] ?? [])
        .map(c => (c.mainsnak?.datavalue?.value as { id?: string })?.id)
        .filter((q): q is string => !!q)
    // A creator's country. A person has citizenship (P27) — take only the
    // PRIMARY one, since multi-citizenship (Joyce: Ireland/UK/France) is noisy
    // and a book/album's "region" is really one place. A band/org isn't a person
    // (no P27) — its country lives on P495 (Radiohead) or P17; take all (rare to
    // be multi). Returns [] if this entity carries no country signal.
    const creatorCountryIds = (cl: Record<string, Snak[]>): string[] => {
      const citizenship = claimIds(cl, 'P27')
      if (citizenship.length) return [citizenship[0]]
      return [...claimIds(cl, 'P495'), ...claimIds(cl, 'P17')]
    }

    // creator: up to two entity ids (e.g. co-directors / co-authors). Fetch
    // labels (for the display name) + claims (for nationality) in one call.
    let creator: string | null = null
    const creatorClaims: Record<string, Snak[]>[] = []
    const creatorIds = entityIds(WD_CREATOR_PROPS[type] ?? []).slice(0, 2)
    if (creatorIds.length) {
      const d3 = await wbFetch(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|claims&languages=en&ids=${creatorIds.join('|')}`
      )
      const names = creatorIds
        .map(id => (d3?.entities?.[id]?.labels?.en?.value as string | undefined))
        .filter((n): n is string => !!n)
      if (names.length) creator = names.join(' & ')
      for (const id of creatorIds) creatorClaims.push((d3?.entities?.[id]?.claims as Record<string, Snak[]>) ?? {})
    }

    // country of origin. film/tv → the work's P495 — production countries, kept
    // multi (co-productions are real; NOT director nationality, see ROADMAP).
    // book/music → the creator's country (NOT the work's P495, which for books is
    // publication-country noise like Ulysses → France/US).
    let countryIds: string[]
    if (type === 'film' || type === 'tv') {
      countryIds = claimIds(claims, 'P495')
    } else {
      // From each creator entity, then — if none resolved (e.g. the article was
      // the author's own page) — from the work entity itself.
      countryIds = creatorClaims.flatMap(creatorCountryIds)
      if (!countryIds.length && !creatorIds.length) countryIds = creatorCountryIds(claims)
      // Last resort for a band with no direct country: its formation location
      // (P740) → that place's country (P17). One extra lookup, only when needed.
      if (!countryIds.length) {
        const placeIds = creatorClaims.flatMap(cl => claimIds(cl, 'P740'))
        if (placeIds.length) {
          const dp = await wbFetch(
            `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${[...new Set(placeIds)].join('|')}`
          )
          countryIds = placeIds.flatMap(pid => claimIds((dp?.entities?.[pid]?.claims as Record<string, Snak[]>) ?? {}, 'P17'))
        }
      }
    }
    const countryLabels = await labelsFor([...new Set(countryIds)])
    // Resolve → roll historical states up to modern → dedupe (preserves order).
    const countries = [...new Set(
      [...new Set(countryIds)]
        .map(id => countryLabels[id])
        .filter((c): c is string => !!c)
        .map(c => HISTORICAL_COUNTRY[c] ?? c)
    )]

    return { year, creator, runtime, pages: numPages, genres: [], countries }
  } catch {
    return empty
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
      const parsed = (req.query.parse === '1' && type)
        ? await wikidataFields(info.title, type)
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

  const guarded = true
  const a = normalize(title)

  for (const query of queries) {
    try {
      const found = await fetchInfo(query)
      if (!found) continue
      if (guarded) {
        const b = normalize(found.title)
        if (!b.includes(a) && !a.includes(b)) continue
      }
      // Opt-in structured parse (same as the URL branch) — lets the region
      // backfill resolve article + pull fields in a single request.
      const parsed = req.query.parse === '1' ? await wikidataFields(found.title, type) : null
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')
      return res.json({ url: found.url, thumbnail: found.thumbnail, summary: found.summary, parsed })
    } catch {
      // try next query
    }
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  return res.json({ url: null, thumbnail: null, summary: null })
}
