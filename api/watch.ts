import type { VercelRequest, VercelResponse } from '@vercel/node'

// Lighter v1 of "where to watch": look up streaming availability (US) for a title via
// TMDB (data powered by JustWatch). Self-contained — safe to delete this file to remove
// the feature. Returns { configured:false } when no TMDB key is set so the UI degrades.
const KEY = process.env.TMDB_API_KEY

interface TmdbProvider {
  provider_name: string
  logo_path: string | null
}

const mapProviders = (arr: TmdbProvider[] | undefined) =>
  (arr ?? []).map(p => ({
    name: p.provider_name,
    logo: p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : null,
  }))

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!KEY) return res.status(200).json({ configured: false })

  const { title, year, type } = req.query as { title?: string; year?: string; type?: string }
  if (!title) return res.status(200).json({ configured: true, found: false })

  const media = type === 'tv' ? 'tv' : 'movie'
  try {
    const sp = new URLSearchParams({ api_key: KEY, query: title })
    if (year) sp.set(media === 'tv' ? 'first_air_date_year' : 'year', year)
    const search = await (await fetch(`https://api.themoviedb.org/3/search/${media}?${sp}`)).json()
    const hit = search?.results?.[0]
    if (!hit) return res.status(200).json({ configured: true, found: false })

    const prov = await (await fetch(`https://api.themoviedb.org/3/${media}/${hit.id}/watch/providers?api_key=${KEY}`)).json()
    const us = prov?.results?.US ?? {}
    return res.status(200).json({
      configured: true,
      found: true,
      link: us.link ?? null,
      stream: mapProviders([...(us.flatrate ?? []), ...(us.free ?? []), ...(us.ads ?? [])]),
      rent: mapProviders(us.rent),
      buy: mapProviders(us.buy),
    })
  } catch {
    return res.status(200).json({ configured: true, error: true })
  }
}
