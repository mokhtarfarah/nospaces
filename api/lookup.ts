import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './_auth'

// Real-catalog search for the "look it up online" action: queries iTunes (music),
// TMDB (film/TV), and Open Library (books) for the literal text and returns concrete
// matches — useful for obscure titles Claude doesn't know from memory.
// No auth required: only queries public external APIs, no sensitive data or Anthropic calls.
const TMDB = process.env.TMDB_API_KEY

interface Candidate {
  title: string
  creator: string
  type: string
  year: number | null
}

const yearOf = (d?: string | null) => (d ? new Date(d).getFullYear() || null : null)

async function itunes(q: string): Promise<Candidate[]> {
  const data = await (await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=4`)).json()
  return (data?.results ?? []).map((r: { collectionName?: string; artistName?: string; releaseDate?: string }) => ({
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

// Google Books is faster and more reliable than Open Library for popular titles.
async function googleBooks(q: string): Promise<Candidate[]> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 4000)
  try {
    const data = await (await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=4&langRestrict=en`, { signal: ac.signal })).json()
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
  const t = setTimeout(() => ac.abort(), 4000)
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

// For regular book queries, try Google Books first (fast), fall back to Open Library.
async function bookSearch(q: string): Promise<Candidate[]> {
  const gb = await googleBooks(q)
  if (gb.length > 0) return gb
  return openLibrary(q)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!await requireAuth(req)) return res.status(401).end()
  const q = String(req.query.q ?? '')
  if (!q) return res.status(200).json({ results: [] })
  const recency = req.query.recency === '1'
  const [music, screen, books] = await Promise.all([
    (recency ? itunesByArtist(q) : itunes(q)).catch(() => []),
    tmdb(q).catch(() => []),
    (recency ? openLibraryByAuthor(q) : bookSearch(q)).catch(() => []),
  ])
  let results = [...music, ...screen, ...books].filter(r => r.title)
  // For recency queries, float the newest release to the top across all types.
  if (recency) results = results.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
  results = results.slice(0, 10)
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  return res.status(200).json({ results })
}
