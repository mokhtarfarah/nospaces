import type { VercelRequest, VercelResponse } from '@vercel/node'

// Real-catalog search for the "look it up online" action: queries iTunes (music),
// TMDB (film/TV), and Open Library (books) for the literal text and returns concrete
// matches — useful for obscure titles Claude doesn't know from memory.
// No auth required: only queries public external APIs, no sensitive data or Anthropic calls.
const TMDB = process.env.TMDB_API_KEY

// Light per-IP throttle. This endpoint is intentionally unauthenticated (public
// catalog APIs only, no Anthropic), so it can't use the Supabase-user rate limiter.
// An in-memory sliding window slows casual scraping of the shared TMDB key quota.
// Best-effort: serverless instances are ephemeral and may run in parallel, so this
// is a speed bump, not a hard guarantee.
const LOOKUP_WINDOW_MS = 60_000
const LOOKUP_MAX = 40 // requests per IP per minute
const _hits = new Map<string, number[]>()
function lookupThrottled(ip: string): boolean {
  const now = Date.now()
  const recent = (_hits.get(ip) ?? []).filter(t => now - t < LOOKUP_WINDOW_MS)
  recent.push(now)
  _hits.set(ip, recent)
  if (_hits.size > 5000) for (const [k, v] of _hits) if (!v.some(t => now - t < LOOKUP_WINDOW_MS)) _hits.delete(k) // GC stale IPs
  return recent.length > LOOKUP_MAX
}

interface Candidate {
  title: string
  creator: string
  type: string
  year: number | null
}

const yearOf = (d?: string | null) => (d ? new Date(d).getFullYear() || null : null)

// --- Relevance ranking + dedup (the normal, non-recency lookup path) ----------
// The catalog APIs return raw relevance only: iTunes floats soundtracks/singles
// that merely share a film's name ("Oppenheimer (Original Motion Picture
// Soundtrack)"), and Open Library returns the same book three times as separate
// editions. Without ranking, results were concatenated music-first, so a
// soundtrack could beat the film and duplicate editions flooded the picker. These
// helpers (kept pure + exported for unit tests) score each candidate against the
// query and collapse duplicates, so the closest real match leads regardless of
// which source it came from. The recency path keeps its own by-artist sorting.

const norm = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim()

const tokenSet = (s: string) => new Set(norm(s).split(' ').filter(Boolean))

// 0..1 closeness of a candidate title to the search query. Exact (normalized)
// match wins; otherwise blends token overlap (Dice) with containment (rewards a
// clean title that's a subset of an author-augmented query like "Middlemarch
// George Eliot"), plus a small prefix bonus.
export function scoreMatch(title: string, query: string): number {
  const a = norm(title), b = norm(query)
  if (!a || !b) return 0
  if (a === b) return 1
  const T = tokenSet(title), Q = tokenSet(query)
  let inter = 0
  for (const t of T) if (Q.has(t)) inter++
  if (inter === 0) return 0
  const dice = (2 * inter) / (T.size + Q.size)
  const containment = inter / Math.min(T.size, Q.size)
  const prefix = a.startsWith(b) || b.startsWith(a) ? 0.15 : 0
  return Math.min(1, 0.5 * dice + 0.5 * containment + prefix)
}

// Collapse duplicate editions (same normalized title + type) and rank the whole
// pool by closeness to the query. A matching preferredType (the AI's medium
// guess) is a gentle boost, never a hard filter, so a wrong guess can't hide the
// right answer. Ties fall back to the newer year.
export function rankCandidates(candidates: Candidate[], query: string, preferredType?: string | null): Candidate[] {
  const byKey = new Map<string, Candidate>()
  for (const c of candidates) {
    if (!c.title) continue
    const key = `${c.type}|${norm(c.title)}`
    const prev = byKey.get(key)
    if (!prev) { byKey.set(key, c); continue }
    // Backfill a missing creator/year from the duplicate; keep the earliest year.
    byKey.set(key, {
      ...prev,
      creator: prev.creator || c.creator,
      year: prev.year != null && c.year != null ? Math.min(prev.year, c.year) : (prev.year ?? c.year),
    })
  }
  return [...byKey.values()]
    .map(c => ({ c, s: scoreMatch(c.title, query) + (preferredType && c.type === preferredType ? 0.2 : 0) }))
    .sort((a, b) => b.s - a.s || (b.c.year ?? 0) - (a.c.year ?? 0))
    .map(x => x.c)
}

async function itunes(q: string): Promise<Candidate[]> {
  const data = await (await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=8`)).json()
  return (data?.results ?? [])
    .filter((r: { collectionName?: string }) => r.collectionName && !/\s-\sSingle$/i.test(r.collectionName)) // drop singles that share a title
    .slice(0, 4)
    .map((r: { collectionName?: string; artistName?: string; releaseDate?: string }) => ({
      title: r.collectionName ?? '', creator: r.artistName ?? '', type: 'music', year: yearOf(r.releaseDate),
    }))
}

// Recency music queries ("rosalía's latest album") need the artist's actual discography
// sorted by date — iTunes relevance search buries full albums under singles/remixes and
// often omits the newest release entirely. So: resolve the artist, list their albums,
// drop singles, collapse deluxe variants, sort newest-first.
async function itunesByArtist(q: string): Promise<Candidate[]> {
  const found = await (await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=musicArtist&limit=1`)).json()
  const artist = found?.results?.[0]
  if (!artist?.artistId) return itunes(q)

  const data = await (await fetch(`https://itunes.apple.com/lookup?id=${artist.artistId}&entity=album&limit=50`)).json()
  const albums = (data?.results ?? [])
    .filter((r: { wrapperType?: string; collectionName?: string; trackCount?: number }) =>
      r.wrapperType === 'collection'
      && !!r.collectionName
      && !/\s-\sSingle$/i.test(r.collectionName) // drop singles
      && (r.trackCount ?? 0) >= 4)               // drop EPs / single-track releases

  // Collapse deluxe variants ("LUX (Complete Works)", "MOTOMAMI +") onto the base title,
  // keeping the cleanest (shortest) name and the earliest release year (the original drop).
  const byBase = new Map<string, { title: string; year: number | null }>()
  for (const r of albums as { collectionName: string; releaseDate?: string }[]) {
    const key = r.collectionName.toLowerCase().replace(/\s*\(.*$/, '').replace(/\s*\+\s*$/, '').trim()
    const year = yearOf(r.releaseDate)
    const prev = byBase.get(key)
    const title = !prev || r.collectionName.length < prev.title.length ? r.collectionName : prev.title
    const earliest = prev?.year != null && (year == null || prev.year < year) ? prev.year : year
    byBase.set(key, { title, year: earliest })
  }

  return [...byBase.values()]
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .map(a => ({ title: a.title, creator: artist.artistName ?? '', type: 'music', year: a.year }))
}

async function tmdb(q: string): Promise<Candidate[]> {
  if (!TMDB) return []
  const data = await (await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB}&query=${encodeURIComponent(q)}`)).json()
  return (data?.results ?? [])
    .filter((r: { media_type?: string }) => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, 4)
    .map((r: { title?: string; name?: string; media_type?: string; release_date?: string; first_air_date?: string }) => ({
      title: r.title || r.name || '', creator: '', type: r.media_type === 'tv' ? 'tv' : 'film',
      year: yearOf(r.release_date || r.first_air_date),
    }))
}

// Recency film/TV queries ("that new Villeneuve movie", "latest A24 film") — resolve
// the person by name, pull their combined credits, sort newest-first. Crew credits
// (Director role) come first and carry the person's name as creator; cast credits fill
// in if the person isn't a director. Falls back to plain tmdb() if no person found.
async function tmdbByPerson(q: string): Promise<Candidate[]> {
  if (!TMDB) return []

  // Step 1: find the person
  const personData = await (await fetch(`https://api.themoviedb.org/3/search/person?api_key=${TMDB}&query=${encodeURIComponent(q)}`)).json()
  const person = personData?.results?.[0]
  if (!person?.id) return tmdb(q)

  // Step 2: combined credits (crew + cast in one call)
  const creditsData = await (await fetch(`https://api.themoviedb.org/3/person/${person.id}/combined_credits?api_key=${TMDB}`)).json()

  type CrewCredit  = { job?: string; media_type?: string; title?: string; name?: string; release_date?: string; first_air_date?: string }
  type CastCredit  = { media_type?: string; title?: string; name?: string; release_date?: string; first_air_date?: string }

  // Director/Writer crew credits — person IS the creator
  const crewItems: Candidate[] = ((creditsData?.crew ?? []) as CrewCredit[])
    .filter(c => (c.job === 'Director' || c.job === 'Writer') && (c.title || c.name))
    .map(c => ({
      title: c.title || c.name || '',
      creator: person.name as string,
      type: c.media_type === 'tv' ? 'tv' : 'film',
      year: yearOf(c.release_date || c.first_air_date),
    }))

  // Cast credits — person appears in the work but isn't necessarily creator
  const castItems: Candidate[] = ((creditsData?.cast ?? []) as CastCredit[])
    .filter(c => (c.title || c.name))
    .map(c => ({
      title: c.title || c.name || '',
      creator: '',
      type: c.media_type === 'tv' ? 'tv' : 'film',
      year: yearOf(c.release_date || c.first_air_date),
    }))

  // Merge: crew first (with creator filled), then cast as fallback. Dedup by title+type.
  const seen = new Set<string>()
  const merged: Candidate[] = []
  for (const item of [...crewItems, ...castItems]) {
    if (!item.title) continue
    const key = `${item.type}|${item.title.toLowerCase()}`
    if (!seen.has(key)) { seen.add(key); merged.push(item) }
  }

  const sorted = merged
    .filter(c => c.year != null)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .slice(0, 8)

  return sorted.length > 0 ? sorted : tmdb(q)
}

async function googleBooks(q: string): Promise<Candidate[]> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 5000)
  try {
    const resp = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=4&langRestrict=en`, { signal: ac.signal })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    return (data?.items ?? []).slice(0, 4).map((item: { volumeInfo?: { title?: string; authors?: string[]; publishedDate?: string } }) => {
      const v = item.volumeInfo ?? {}
      return { title: v.title ?? '', creator: v.authors?.[0] ?? '', type: 'book', year: v.publishedDate ? (parseInt(v.publishedDate) || null) : null }
    }).filter((c: Candidate) => c.title)
  } catch {
    return []
  } finally {
    clearTimeout(t)
  }
}

async function openLibrary(q: string): Promise<Candidate[]> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 7000)
  try {
    const data = await (await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=3`, { signal: ac.signal })).json()
    return (data?.docs ?? []).slice(0, 3).map((d: { title?: string; author_name?: string[]; first_publish_year?: number }) => ({
      title: d.title ?? '', creator: d.author_name?.[0] ?? '', type: 'book', year: d.first_publish_year ?? null,
    }))
  } catch {
    return []
  } finally {
    clearTimeout(t)
  }
}

// Recency book queries ("Ottessa Moshfegh's latest book") — search by author, dedupe
// editions onto the base title, drop non-Latin translations, sort newest-first by
// first_publish_year. Open Library's own sort=new is unusable (it floats recent reprints
// of old books), and first_publish_year is the cleanest "real" date available.
async function openLibraryByAuthor(q: string): Promise<Candidate[]> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 5000)
  try {
    const data = await (await fetch(`https://openlibrary.org/search.json?author=${encodeURIComponent(q)}&limit=40&fields=title,author_name,first_publish_year`, { signal: ac.signal })).json()
    const byBase = new Map<string, Candidate>()
    for (const d of (data?.docs ?? []) as { title?: string; author_name?: string[]; first_publish_year?: number }[]) {
      if (!d.title || !d.first_publish_year || !/[a-z]/i.test(d.title)) continue
      const base = d.title.split(/\s*\/\s*/)[0].trim()
      const key = base.toLowerCase().replace(/[^a-z0-9]/g, '')
      const prev = byBase.get(key)
      if (!prev || (prev.year != null && d.first_publish_year < prev.year)) {
        byBase.set(key, { title: base, creator: d.author_name?.[0] ?? '', type: 'book', year: d.first_publish_year })
      }
    }
    const out = [...byBase.values()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).slice(0, 6)
    return out.length > 0 ? out : googleBooks(q)
  } catch {
    return googleBooks(q)
  } finally {
    clearTimeout(t)
  }
}

// Run both in parallel — Google Books rate-limits on Vercel's shared IPs;
// Open Library is slower but always available. First non-empty result wins.
async function bookSearch(q: string): Promise<Candidate[]> {
  const [gb, ol] = await Promise.all([
    googleBooks(q).catch(() => [] as Candidate[]),
    openLibrary(q).catch(() => [] as Candidate[]),
  ])
  return gb.length > 0 ? gb : ol
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fwd = req.headers['x-forwarded-for']
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd ?? '').split(',')[0].trim() || 'unknown'
  if (lookupThrottled(ip)) return res.status(429).json({ error: 'Too many requests. Slow down.' })

  const q = String(req.query.q ?? '')
  if (!q) return res.status(200).json({ results: [] })
  const recency = req.query.recency === '1'
  const preferredType = req.query.type ? String(req.query.type) : null
  const [music, screen, books] = await Promise.all([
    (recency ? itunesByArtist(q) : itunes(q)).catch((e) => { console.error('[lookup] itunes error:', e?.message); return [] }),
    (recency ? tmdbByPerson(q) : tmdb(q)).catch((e) => { console.error('[lookup] tmdb error:', e?.message); return [] }),
    (recency ? openLibraryByAuthor(q) : bookSearch(q)).catch((e) => { console.error('[lookup] books error:', e?.message); return [] }),
  ])
  let results = [...music, ...screen, ...books].filter(r => r.title)
  // Recency queries float the newest release to the top across all types; every
  // other query gets relevance-ranked + deduped so the closest match leads and
  // duplicate editions collapse (the AI's medium guess is a gentle tiebreak boost).
  if (recency) results = results.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
  else results = rankCandidates(results, q, preferredType)
  results = results.slice(0, 10)
  console.log('[lookup] q=%s results=%d (music=%d screen=%d books=%d)', q, results.length, music.length, screen.length, books.length)
  return res.status(200).json({ results })
}
