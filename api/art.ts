import type { VercelRequest, VercelResponse } from '@vercel/node'

// Best-source artwork resolver:
//   film/tv  -> TMDB poster (falls back to a season poster for shows with none)
//   music    -> iTunes album art
//   book     -> Open Library cover
// Returns { url: string | null }. All sources are free; only TMDB needs a key.
const TMDB = process.env.TMDB_API_KEY

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

async function tmdbPoster(media: 'movie' | 'tv', title: string, year: string): Promise<string | null> {
  if (!TMDB) return null
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
}

async function itunesArt(title: string, creator: string): Promise<string | null> {
  const term = [creator, title].filter(Boolean).join(' ')
  const data = await (await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=1`)).json()
  const art: string | undefined = data?.results?.[0]?.artworkUrl100
  return art ? art.replace('100x100bb', '300x300bb') : null
}

async function openLibraryCover(title: string, creator: string): Promise<string | null> {
  const sp = new URLSearchParams({ title, limit: '1' })
  if (creator) sp.set('author', creator)
  const data = await (await fetch(`https://openlibrary.org/search.json?${sp}`)).json()
  const cover: number | undefined = data?.docs?.[0]?.cover_i
  return cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const type = one(req.query.type)
  const title = one(req.query.title)
  const creator = one(req.query.creator)
  const year = one(req.query.year)
  if (!title) return res.status(200).json({ url: null })

  try {
    let url: string | null = null
    if (type === 'film') url = await tmdbPoster('movie', title, year)
    else if (type === 'tv') url = await tmdbPoster('tv', title, year)
    else if (type === 'music') url = await itunesArt(title, creator)
    else if (type === 'book') url = await openLibraryCover(title, creator)
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')
    return res.status(200).json({ url })
  } catch {
    return res.status(200).json({ url: null })
  }
}
