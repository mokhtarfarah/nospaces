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

export interface RegionProgress { done: number; total: number; filled: number; failed: number }

// True once an item carries at least one country from the CURRENT resolver.
export function hasRegion(item: Item): boolean {
  return Array.isArray(item.metadata?.countries)
    && (item.metadata.countries as string[]).length > 0
    && ((item.metadata?.regionV as number | undefined) ?? 0) >= REGION_VERSION
}

// Items eligible for a region pull: media types we can resolve, not yet tagged
// (or tagged by an older resolver version).
export function itemsNeedingRegion(items: Item[]): Item[] {
  return items.filter(i => GAP_MEDIA_TYPES.includes(i.type) && !hasRegion(i))
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

// Resolve one item's countries. Returns [] for "resolved, no country"; throws on
// a network/Wikipedia error so the caller can count it as a retryable failure.
async function resolveCountries(item: Item): Promise<string[]> {
  const resolved = await articleResolve(item)
  if (!resolved?.qid) return []
  const qid = resolved.qid
  const claims = (await claimsFor([qid]))[qid]

  let countryIds: string[]
  if (item.type === 'film' || item.type === 'tv') {
    countryIds = claimIds(claims, 'P495')
  } else {
    const creatorIds = entityIds(claims, CREATOR_PROPS[item.type] ?? []).slice(0, 2)
    const creatorClaims = creatorIds.length ? Object.values(await claimsFor(creatorIds)) : []
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
  return [...new Set(
    [...new Set(countryIds)]
      .map(id => labels[id])
      .filter((c): c is string => !!c)
      .map(c => HISTORICAL_COUNTRY[c] ?? c)
  )]
}

// string[] on success (possibly empty), null if it kept failing. Wikipedia
// rate-limits anonymous bursts (429), so retry with exponential backoff.
async function pullOne(item: Item): Promise<string[] | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await resolveCountries(item) }
    catch { await sleep(800 * 2 ** attempt) }  // 0.8s, 1.6s, 3.2s, 6.4s
  }
  return null
}

// Run the backfill over the whole library, browser-direct with modest
// concurrency. Only real hits are persisted; misses/failures stay untagged so
// re-running mops them up. `save` is the caller's patchMetadata (in-place,
// no refetch fan-out). headers is accepted for signature stability but unused
// (Wikipedia needs no auth).
const CONCURRENCY = 3

export async function pullRegions(
  items: Item[],
  _headers: HeadersInit,
  save: (id: string, patch: Record<string, unknown>) => Promise<void> | void,
  onProgress?: (p: RegionProgress) => void,
): Promise<RegionProgress> {
  const queue = itemsNeedingRegion(items)
  const total = queue.length
  let done = 0, filled = 0, failed = 0, next = 0

  const worker = async () => {
    while (next < queue.length) {
      const item = queue[next++]
      const countries = await pullOne(item)
      if (countries === null) failed++
      else if (countries.length) { await save(item.id, { countries, regionV: REGION_VERSION }); filled++ }
      done++
      onProgress?.({ done, total, filled, failed })
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
  return { done, total, filled, failed }
}
