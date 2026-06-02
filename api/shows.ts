import type { VercelRequest, VercelResponse } from '@vercel/node'

// Proxy for Bandsintown's public artist-events API. We go through Vercel so we
// can (a) attach the app_id without exposing it in the client, (b) normalise the
// response down to just the fields the UI needs, and (c) cache per artist.
//
// Bandsintown app_id is just an identifier string — register a real one for
// production reliability (https://artists.bandsintown.com/support/api-installation)
// and set BANDSINTOWN_APP_ID in Vercel. Falls back to a default so dev works.
const APP_ID = process.env.BANDSINTOWN_APP_ID || 'nospaces'

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export interface Show {
  id: string
  artist: string
  datetime: string // ISO, local to venue
  venue: string
  city: string // "City, Region" or "City, Country"
  lat: number | null
  lng: number | null
  url: string | null // ticket / event link
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const artist = one(req.query.artist).trim()
  if (!artist) return res.status(400).json({ shows: [] })

  // Bandsintown wants the artist name URL-encoded in the path; a literal "/" in
  // a name must be double-encoded as %252F per their docs.
  const enc = encodeURIComponent(artist.replace(/\//g, '%2F'))
  const url = `https://rest.bandsintown.com/artists/${enc}/events?app_id=${encodeURIComponent(APP_ID)}&date=upcoming`

  try {
    const data = await (await fetch(url, {
      headers: { 'User-Agent': 'Nospaces/1.0 (https://nospaces.vercel.app)' },
    })).json()

    // Not-found / no-events responses come back as an object with a message,
    // not an array. Treat anything non-array as "no shows".
    if (!Array.isArray(data)) {
      res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate')
      return res.json({ shows: [] })
    }

    const shows: Show[] = data.map((e: Record<string, any>) => {
      const v = e.venue ?? {}
      const lat = parseFloat(v.latitude)
      const lng = parseFloat(v.longitude)
      const offer = Array.isArray(e.offers) ? e.offers.find((o: any) => o?.url) : null
      return {
        id: String(e.id ?? `${artist}-${e.datetime}`),
        artist,
        datetime: e.datetime ?? '',
        venue: v.name ?? '',
        city: v.location || [v.city, v.region || v.country].filter(Boolean).join(', '),
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        url: offer?.url ?? e.url ?? null,
      }
    })

    // Cache 12h — tour dates don't change minute-to-minute, and this keeps us
    // well under Bandsintown's rate limits when many artists resolve at once.
    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate')
    return res.json({ shows })
  } catch {
    return res.json({ shows: [] })
  }
}
