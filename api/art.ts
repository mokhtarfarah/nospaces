import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './_auth'

// Best-source artwork resolver:
//   film/tv  -> TMDB poster (falls back to a season poster for shows with none)
//   music    -> iTunes album art
//   book     -> Open Library cover
// Returns { url: string | null }. All sources are free; only TMDB needs a key.
const TMDB = process.env.TMDB_API_KEY

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

async function tmdbPoster(media: 'movie' | 'tv', title: string, year: string): Promise<string | null> {
  if (!TMDB) return null
  try {
    const sp = new URLSearchParams({ api_key: TMDB, query: title })
    if (year) sp.set(media === 'tv' ? 'first_air_date_year' : 'year', year)
    const search = await (await fetch(`https://api.themoviedb.org/3/search/${media}?${sp}`)).json()
    const hit = search?.results?.[0]
    if (!hit) return null
    if (hit.poster_path) return `https://image.tmdb.org/t/p/w185${hit.poster_path}`
    if (media === 'tv') {
      const details = await (await fetch(`https://api.themoviedb.org/3/tv/${hit.id}?api_key=${TMDB}`)).json()
      const seasonPoster = (details?.seasons ?? []).map((s: { poster_path?: string }) => s.poster_path).find(Boolean)
      if (seasonPoster) return `https://image.tmdb.org/t/p/w185${seasonPoster}`
    }
    return null
  } catch { return null }
}

const norm = (s: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Pick the best album from a list by title (exact preferred) + artist match.
function pickAlbum<T>(results: T[], title: string, creator: string, getTitle: (r: T) => string, getArtist: (r: T) => string): T | null {
  const t = norm(title)
  const c = creator ? norm(creator) : ''
  const artistOk = (r: T) => !c || norm(getArtist(r)).includes(c) || c.includes(norm(getArtist(r)))
  return (
    results.find(r => norm(getTitle(r)) === t && artistOk(r)) ??
    results.find(r => norm(getTitle(r)).includes(t) && artistOk(r)) ??
    (c ? null : results[0] ?? null)
  )
}

// Deezer first (best coverage), then iTunes.
async function deezerArt(title: string, creator: string): Promise<string | null> {
  try {
    const q = [creator, title].filter(Boolean).join(' ')
    const data = await (await fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=8`)).json()
    const results: { title?: string; artist?: { name?: string }; cover_big?: string; cover_xl?: string }[] = data?.data ?? []
    const m = pickAlbum(results, title, creator, r => r.title ?? '', r => r.artist?.name ?? '')
    return m?.cover_big ?? m?.cover_xl ?? null
  } catch { return null }
}

async function itunesAlbumArt(title: string, creator: string): Promise<string | null> {
  try {
    const term = [creator, title].filter(Boolean).join(' ')
    const data = await (await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=8`)).json()
    const results: { collectionName?: string; artistName?: string; artworkUrl100?: string }[] = data?.results ?? []
    const m = pickAlbum(results, title, creator, r => r.collectionName ?? '', r => r.artistName ?? '')
    return m?.artworkUrl100 ? m.artworkUrl100.replace('100x100bb', '600x600bb') : null
  } catch { return null }
}

async function musicArt(title: string, creator: string): Promise<string | null> {
  return (await deezerArt(title, creator)) ?? (await itunesAlbumArt(title, creator))
}

// Find the best Open Library doc, verifying author (when known) and preferring exact
// title + matching year, so "Pride and Prejudice" doesn't match the Zombies edition.
interface OLDoc { title?: string; author_name?: string[]; first_publish_year?: number; cover_i?: number; key?: string }
async function searchBookDoc(title: string, creator: string, year?: number): Promise<OLDoc | null> {
  try {
    const sp = new URLSearchParams({ title, limit: '10' })
    if (creator) sp.set('author', creator)
    const data = await (await fetch(`https://openlibrary.org/search.json?${sp}`)).json()
    const docs: OLDoc[] = data?.docs ?? []
    if (!docs.length) return null
    const t = norm(title)
    const c = creator ? norm(creator) : ''
    const authorOk = (d: OLDoc) => !c || (d.author_name ?? []).some(a => { const n = norm(a); return n.includes(c) || c.includes(n) })
    const pool = c ? docs.filter(authorOk) : docs
    const cands = pool.length ? pool : docs
    const exact = (d: OLDoc) => norm(d.title ?? '') === t
    return (
      cands.find(d => exact(d) && (!year || d.first_publish_year === year)) ??
      cands.find(d => exact(d)) ??
      (c ? pool[0] ?? null : cands[0] ?? null)
    )
  } catch { return null }
}

function appleBookMatches(trackName: string | undefined, artistName: string | undefined, title: string, creator: string): boolean {
  if (norm(trackName ?? '') !== norm(title)) return false
  if (!creator) return true
  const a = norm(artistName ?? ''), c = norm(creator)
  return a.includes(c) || c.includes(a)
}

async function openLibraryCover(title: string, creator: string, year?: number): Promise<string | null> {
  const doc = await searchBookDoc(title, creator, year)
  return doc?.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null
}

// Apple Books fallback (Goodreads has no public API since 2020; Google Books' keyless
// quota is unreliable). Verifies the result matches title + author. Covers only.
async function appleBookCover(title: string, creator: string): Promise<string | null> {
  try {
    const term = [title, creator].filter(Boolean).join(' ')
    const data = await (await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=ebook&limit=5`)).json()
    const results: { trackName?: string; artistName?: string; artworkUrl100?: string }[] = data?.results ?? []
    const m = results.find(r => appleBookMatches(r.trackName, r.artistName, title, creator))
    return m?.artworkUrl100 ? m.artworkUrl100.replace('100x100bb', '600x600bb') : null
  } catch { return null }
}

async function bookCover(title: string, creator: string, year?: number): Promise<string | null> {
  return (await openLibraryCover(title, creator, year)) ?? (await appleBookCover(title, creator))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!await requireAuth(req)) return res.status(401).end()
  const type = one(req.query.type)
  const title = one(req.query.title)
  const creator = one(req.query.creator)
  const year = one(req.query.year)
  if (!title) return res.status(200).json({ url: null })

  try {
    let url: string | null = null
    if (type === 'film') url = await tmdbPoster('movie', title, year)
    else if (type === 'tv') url = await tmdbPoster('tv', title, year)
    else if (type === 'music') url = await musicArt(title, creator)
    else if (type === 'book') url = await bookCover(title, creator, year ? Number(year) : undefined)
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')
    return res.status(200).json({ url })
  } catch (err) {
    console.error('[art] error for', JSON.stringify({ type, title }), ':', err instanceof Error ? err.message : err)
    return res.status(200).json({ url: null })
  }
}
