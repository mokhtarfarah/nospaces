import type { Item } from './database.types'
import { GAP_MEDIA_TYPES } from './gaps'

// Country-of-origin backfill. Pulls each media item's region from Wikidata and
// stores it on metadata.countries. film/tv use the work's country (P495);
// book/music use the creator's country (P27 for people; P495/P17, then formation
// place P740→P17, for bands). See ROADMAP "Regions map / country filter".
//
// The lookups run DIRECTLY against Wikipedia/Wikidata from the browser (their
// APIs allow cross-origin reads via origin=*), NOT through our /api/wiki. That's
// deliberate: routing through Vercel funnels every user's calls through one
// shared cloud IP that Wikipedia rate-limits hard — the batch came back empty
// for everyone. From the user's own residential IP, Wikipedia serves freely.
// Free either way (no Anthropic, public APIs).
//
// We only persist real hits — an item with no country found is left untagged so
// a later run (better data, or an improved resolver) retries it. Re-running is
// free and idempotent.
//
// REGION_VERSION stamps each saved tag. Bump it when the resolver logic changes
// so the next backfill re-cleans already-tagged items.
export const REGION_VERSION = 2

export interface FactsProgress { done: number; total: number; filled: number; failed: number }

// True once an item carries at least one country from the CURRENT resolver.
export function hasRegion(item: Item): boolean {
  return Array.isArray(item.metadata?.countries)
    && (item.metadata.countries as string[]).length > 0
    && ((item.metadata?.regionV as number | undefined) ?? 0) >= REGION_VERSION
}

// Items eligible for a fill-from-wikipedia pass: media types we can resolve that
// are still missing any of the fields one Wikidata lookup can supply — creator,
// year, runtime (film/tv), pages (book), or region. A gap the user has dismissed
// (marked "no data exists") is not counted, so the pending count can reach 0.
// Region is versioned separately (re-clean on resolver bumps), so it's always
// re-checked. Re-running is free + idempotent — only real hits get written.
export function itemsNeedingFacts(items: Item[]): Item[] {
  return items.filter(i => {
    if (!GAP_MEDIA_TYPES.includes(i.type)) return false
    const dismissed = new Set<string>((i.metadata?.dismissedGaps as string[] | undefined) ?? [])
    const needCreator = !i.creator?.trim() && !dismissed.has('creator')
    const needYear = !i.year && !dismissed.has('year')
    const needRuntime = (i.type === 'film' || i.type === 'tv') && !i.metadata?.runtime && !dismissed.has('runtime')
    const needPages = i.type === 'book' && !i.metadata?.pages && !dismissed.has('pages')
    const needRegion = !hasRegion(i)
    return needCreator || needYear || needRuntime || needPages || needRegion
  })
}

// ---- Wikidata resolution (browser-direct) ----

const WIKI = 'https://en.wikipedia.org/w/api.php'
const WD = 'https://www.wikidata.org/w/api.php'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// "creator" claim by media type — entity ids (Q-numbers) needing a label lookup.
const CREATOR_PROPS: Record<string, string[]> = {
  film: ['P57'], tv: ['P57', 'P170'], book: ['P50'], music: ['P175', 'P86'],
}

// Roll dissolved/historical states up to the modern country (cleaner chips).
const HISTORICAL_COUNTRY: Record<string, string> = {
  'French Third Republic': 'France', 'French Fourth Republic': 'France',
  'French Fifth Republic': 'France', 'Kingdom of France': 'France',
  'United Kingdom of Great Britain and Ireland': 'United Kingdom',
  'Kingdom of Great Britain': 'United Kingdom', 'Kingdom of England': 'United Kingdom',
  'Weimar Republic': 'Germany', 'Nazi Germany': 'Germany', 'German Reich': 'Germany',
  'German Empire': 'Germany', 'West Germany': 'Germany', 'East Germany': 'Germany',
  'Kingdom of Italy': 'Italy', 'Empire of Japan': 'Japan',
  'Russian Empire': 'Russia', 'Kingdom of the Netherlands': 'Netherlands',
}

type Claims = Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>

const norm = (s: string) => s.toLowerCase().replace(/\s*\([^)]*\)\s*/g, '').trim()

// Throws on network / non-2xx so the caller can tell a failure from "no country".
async function jget(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`http ${res.status}`)
  return res.json()
}

type Resolved = { title: string; qid: string | null }

function wikiQueries(type: string, title: string, creator: string, year: string): string[] {
  const bare = title.replace(/^(the|a|an)\s+/i, '').trim()
  switch (type) {
    case 'film': return [...(year ? [`${title} ${year} film`] : []), `${title} film`, ...(bare !== title ? [`${bare} film`] : []), title]
    case 'tv':   return [`${title} TV series`, `${title} television series`, title]
    case 'book': return [[title, creator].filter(Boolean).join(' '), title]
    case 'music':return [[title, creator, 'album'].filter(Boolean).join(' '), `${title} album`, title]
    default:     return []
  }
}

const claimIds = (cl: Claims, pid: string): string[] =>
  (cl[pid] ?? []).map(c => (c.mainsnak?.datavalue?.value as { id?: string })?.id).filter((q): q is string => !!q)

const entityIds = (cl: Claims, pids: string[]): string[] => {
  for (const pid of pids) { const ids = claimIds(cl, pid); if (ids.length) return ids }
  return []
}

// A creator's country: a person's PRIMARY citizenship (P27, first only — multi
// is noisy), else a band/org's country (P495 or P17).
const creatorCountryIds = (cl: Claims): string[] => {
  const cit = claimIds(cl, 'P27')
  if (cit.length) return [cit[0]]
  return [...claimIds(cl, 'P495'), ...claimIds(cl, 'P17')]
}

// Find the item's Wikipedia article + its Wikidata Q-id. The search query pulls
// pageprops (wikibase_item) in the SAME call, so a title-search costs one request
// not two. A stored wikiUrl skips search but still needs a Q-id lookup.
async function articleResolve(item: Item): Promise<Resolved | null> {
  const wikiUrl = (item.metadata?.wikiUrl as string | undefined)?.trim()
  if (wikiUrl) {
    const m = wikiUrl.match(/wikipedia\.org\/wiki\/(.+)$/)
    if (m) {
      const title = decodeURIComponent(m[1].replace(/_/g, ' '))
      const d = await jget(`${WIKI}?action=query&format=json&origin=*&redirects=1&prop=pageprops&ppprop=wikibase_item&titles=${encodeURIComponent(title)}`) as { query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> } }
      const qid = d?.query?.pages ? Object.values(d.query.pages)[0]?.pageprops?.wikibase_item ?? null : null
      return { title, qid }
    }
  }
  const a = norm(item.title)
  for (const q of wikiQueries(item.type, item.title, item.creator ?? '', item.year ? String(item.year) : '')) {
    const d = await jget(`${WIKI}?action=query&format=json&origin=*&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(q)}&prop=pageprops&ppprop=wikibase_item`) as { query?: { pages?: Record<string, { title?: string; pageprops?: { wikibase_item?: string } }> } }
    const page = d?.query?.pages ? Object.values(d.query.pages)[0] : undefined
    if (!page?.title) continue
    const b = norm(page.title)
    if (b.includes(a) || a.includes(b)) return { title: page.title, qid: page.pageprops?.wikibase_item ?? null }
  }
  return null
}

async function claimsFor(ids: string[]): Promise<Record<string, Claims>> {
  if (!ids.length) return {}
  const d = await jget(`${WD}?action=wbgetentities&format=json&origin=*&props=claims&ids=${ids.join('|')}`) as { entities?: Record<string, { claims?: Claims }> }
  const out: Record<string, Claims> = {}
  for (const id of ids) out[id] = d?.entities?.[id]?.claims ?? {}
  return out
}

async function labelsFor(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {}
  const d = await jget(`${WD}?action=wbgetentities&format=json&origin=*&props=labels&languages=en&ids=${ids.join('|')}`) as { entities?: Record<string, { labels?: { en?: { value?: string } } }> }
  const out: Record<string, string> = {}
  for (const id of ids) { const v = d?.entities?.[id]?.labels?.en?.value; if (v) out[id] = v }
  return out
}

// Fetch entities with labels AND claims in one call — lets us pull a creator's
// display name (label) and nationality (claims) from a single request.
async function entitiesFor(ids: string[]): Promise<Record<string, { labels?: { en?: { value?: string } }; claims?: Claims }>> {
  if (!ids.length) return {}
  const d = await jget(`${WD}?action=wbgetentities&format=json&origin=*&props=labels|claims&languages=en&ids=${ids.join('|')}`) as { entities?: Record<string, { labels?: { en?: { value?: string } }; claims?: Claims }> }
  return d?.entities ?? {}
}

// Numeric-quantity claims (runtime P2047, pages P1104). Wikidata stores these as
// { amount: "+123" } strings. min = theatrical cut for runtime; first = pages.
const amounts = (cl: Claims, pid: string): number[] =>
  (cl[pid] ?? [])
    .map(c => parseFloat(String((c.mainsnak?.datavalue?.value as { amount?: string })?.amount ?? '')))
    .filter(n => !isNaN(n) && n > 0)
const minAmount = (cl: Claims, pid: string): number | null => { const a = amounts(cl, pid); return a.length ? Math.round(Math.min(...a)) : null }
const firstAmount = (cl: Claims, pid: string): number | null => { const a = amounts(cl, pid); return a.length ? Math.round(a[0]) : null }

// Earliest year across publication (P577) / inception (P571) / start time (P580 —
// how TV stores first-aired) — the original release, not re-releases.
const minYear = (cl: Claims, pids: string[]): number | null => {
  const ys = pids.flatMap(pid => cl[pid] ?? [])
    .map(c => parseInt(String((c.mainsnak?.datavalue?.value as { time?: string })?.time ?? '').slice(1, 5)))
    .filter(y => !isNaN(y) && y > 0)
  return ys.length ? Math.min(...ys) : null
}

export interface Facts { countries: string[]; creator: string | null; runtime: number | null; pages: number | null; year: number | null }

// Resolve one item's Wikidata facts (creator, year, runtime, pages, region) in a
// single article+claims pass. null = couldn't resolve the article at all; throws
// on a network/Wikipedia error so the caller can count it as a retryable failure.
async function resolveFacts(item: Item): Promise<Facts | null> {
  const resolved = await articleResolve(item)
  if (!resolved?.qid) return null
  const qid = resolved.qid
  const claims = (await claimsFor([qid]))[qid]

  const runtime = (item.type === 'film' || item.type === 'tv') ? minAmount(claims, 'P2047') : null
  const pages = item.type === 'book' ? firstAmount(claims, 'P1104') : null
  const year = minYear(claims, ['P577', 'P571', 'P580'])

  // creator: up to two entity ids (co-directors / co-authors) → name (label) +
  // nationality (claims) in one call. The claims double as the country source.
  const creatorIds = entityIds(claims, CREATOR_PROPS[item.type] ?? []).slice(0, 2)
  let creator: string | null = null
  let creatorClaims: Claims[] = []
  if (creatorIds.length) {
    const ents = await entitiesFor(creatorIds)
    const names = creatorIds.map(id => ents[id]?.labels?.en?.value).filter((n): n is string => !!n)
    if (names.length) creator = names.join(' & ')
    creatorClaims = creatorIds.map(id => ents[id]?.claims ?? {})
  }

  let countryIds: string[]
  if (item.type === 'film' || item.type === 'tv') {
    countryIds = claimIds(claims, 'P495')
  } else {
    countryIds = creatorClaims.flatMap(creatorCountryIds)
    if (!countryIds.length && !creatorIds.length) countryIds = creatorCountryIds(claims)
    if (!countryIds.length) {
      const placeIds = creatorClaims.flatMap(cl => claimIds(cl, 'P740'))
      if (placeIds.length) {
        const placeClaims = await claimsFor([...new Set(placeIds)])
        countryIds = placeIds.flatMap(pid => claimIds(placeClaims[pid] ?? {}, 'P17'))
      }
    }
  }
  const labels = await labelsFor([...new Set(countryIds)])
  const countries = [...new Set(
    [...new Set(countryIds)]
      .map(id => labels[id])
      .filter((c): c is string => !!c)
      .map(c => HISTORICAL_COUNTRY[c] ?? c)
  )]

  return { countries, creator, runtime, pages, year }
}

// Facts on success, null if it kept failing. Wikipedia rate-limits anonymous
// bursts (429), so retry with exponential backoff.
async function pullOne(item: Item): Promise<Facts | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await resolveFacts(item) }
    catch { await sleep(800 * 2 ** attempt) }  // 0.8s, 1.6s, 3.2s, 6.4s
  }
  return null
}

// Run the fill-from-wikipedia backfill over the whole library, browser-direct
// with modest concurrency. Fills only BLANK fields (never overwrites your edits);
// misses/failures leave the item untouched so re-running mops them up. `save` is
// the caller's patchItem (in-place, no refetch fan-out): it takes top-level
// column edits (creator, year) separately from a metadata delta (runtime, pages,
// countries), since those live in different places on the row.
const CONCURRENCY = 3

export async function pullFacts(
  items: Item[],
  save: (id: string, columns: Record<string, unknown>, metaPatch: Record<string, unknown>) => Promise<void> | void,
  onProgress?: (p: FactsProgress) => void,
): Promise<FactsProgress> {
  const queue = itemsNeedingFacts(items)
  const total = queue.length
  let done = 0, filled = 0, failed = 0, next = 0

  const worker = async () => {
    while (next < queue.length) {
      const item = queue[next++]
      const facts = await pullOne(item)
      if (facts === null) failed++
      else {
        const columns: Record<string, unknown> = {}
        const meta: Record<string, unknown> = {}
        if (facts.creator && !item.creator?.trim()) columns.creator = facts.creator
        if (facts.year && !item.year) columns.year = facts.year
        if (facts.runtime && !item.metadata?.runtime) meta.runtime = facts.runtime
        if (facts.pages && !item.metadata?.pages) meta.pages = facts.pages
        if (facts.countries.length && !hasRegion(item)) { meta.countries = facts.countries; meta.regionV = REGION_VERSION }
        if (Object.keys(columns).length || Object.keys(meta).length) { await save(item.id, columns, meta); filled++ }
      }
      done++
      onProgress?.({ done, total, filled, failed })
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
  return { done, total, filled, failed }
}
