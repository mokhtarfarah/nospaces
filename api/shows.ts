import type { VercelRequest, VercelResponse } from '@vercel/node'

// Proxy for Ticketmaster's Discovery API. We go through Vercel so we can attach
// the API key (kept server-side), normalise the response to just what the UI
// needs, and cache per artist.
//
// Set TICKETMASTER_API_KEY in Vercel — get one instantly (no approval) at
// https://developer.ticketmaster.com (Discovery API). Coverage is Ticketmaster /
// Live Nation inventory only; indie + non-TM-ticketed shows won't appear.
//
// FUTURE: merge in Bandsintown (broader coverage) once/if their API access is
// approved — the normalised Show shape below already supports multiple sources;
// just fetch both, map to Show[], and dedupe by id before returning.
const API_KEY = process.env.TICKETMASTER_API_KEY

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export interface Show {
  id: string
  artist: string
  datetime: string // ISO
  venue: string
  city: string // "City, ST" or "City, Country"
  lat: number | null
  lng: number | null
  url: string | null // ticket / event link
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const artist = one(req.query.artist).trim()
  if (!artist) return res.status(400).json({ shows: [] })
  if (!API_KEY) return res.json({ shows: [], error: 'missing TICKETMASTER_API_KEY' })

  // Only future music events, soonest first.
  const startDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const url =
    'https://app.ticketmaster.com/discovery/v2/events.json' +
    `?apikey=${encodeURIComponent(API_KEY)}` +
    `&keyword=${encodeURIComponent(artist)}` +
    '&classificationName=music&sort=date,asc&size=60' +
    `&startDateTime=${encodeURIComponent(startDateTime)}`

  try {
    const data = await (await fetch(url)).json()
    const events: Record<string, any>[] = data?._embedded?.events ?? []
    const want = norm(artist)

    const shows: Show[] = events
      // Keyword search is fuzzy (tribute bands, partial matches). Keep only
      // events where a billed attraction actually matches the artist we asked
      // for; fall back to the event name when no attractions are listed.
      .filter(e => {
        const attractions: Record<string, any>[] = e?._embedded?.attractions ?? []
        if (attractions.length) {
          return attractions.some(a => {
            const n = norm(a?.name ?? '')
            return n === want || n.includes(want) || want.includes(n)
          })
        }
        const n = norm(e?.name ?? '')
        return n.includes(want) || want.includes(n)
      })
      .map(e => {
        const v = e?._embedded?.venues?.[0] ?? {}
        const lat = parseFloat(v?.location?.latitude)
        const lng = parseFloat(v?.location?.longitude)
        const region = v?.state?.stateCode || v?.country?.name || ''
        const start = e?.dates?.start ?? {}
        return {
          id: String(e.id),
          artist, // queried name → consistent grouping in the UI
          datetime: start.dateTime || start.localDate || '',
          venue: v?.name ?? '',
          city: [v?.city?.name, region].filter(Boolean).join(', '),
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
          url: e?.url ?? null,
        }
      })
      .filter(s => s.datetime)

    // Cache 12h — tour dates don't change minute-to-minute, and this keeps us
    // well under Ticketmaster's rate limits when many artists resolve at once.
    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate')
    return res.json({ shows })
  } catch {
    return res.json({ shows: [] })
  }
}
