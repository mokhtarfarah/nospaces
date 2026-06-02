import type { VercelRequest, VercelResponse } from '@vercel/node'

// Real-catalog search for the "look it up online" action: queries iTunes (music),
// TMDB (film/TV), and Open Library (books) for the literal text and returns concrete
// matches — useful for obscure titles Claude doesn't know from memory.
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

async function openLibrary(q: string): Promise<Candidate[]> {
  const data = await (await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=3`)).json()
  return (data?.docs ?? []).slice(0, 3).map((d: { title?: string; author_name?: string[]; first_publish_year?: number }) => ({
    title: d.title ?? '', creator: d.author_name?.[0] ?? '', type: 'book', year: d.first_publish_year ?? null,
  }))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = String(req.query.q ?? '')
  if (!q) return res.status(200).json({ results: [] })
  const [music, screen, books] = await Promise.all([
    itunes(q).catch(() => []),
    tmdb(q).catch(() => []),
    openLibrary(q).catch(() => []),
  ])
  const results = [...music, ...screen, ...books].filter(r => r.title).slice(0, 10)
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  return res.status(200).json({ results })
}
