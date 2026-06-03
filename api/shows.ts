import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './_auth'

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
const BASE = 'https://app.ticketmaster.com/discovery/v2'

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

// Resolve an artist name to its exact Ticketmaster attraction id. We match on an
// exact normalised name so tribute/cover acts ("Ultimate Coldplay" for
// "Coldplay") are excluded — keyword search alone lets those through. Returns
// null when the real artist isn't in TM's catalogue (better no shows than wrong
// ones). When several exact matches exist, prefer the one with the most
// upcoming events.
async function resolveAttractionId(artist: string, key: string): Promise<string | null> {
  const url = `${BASE}/attractions.json?apikey=${encodeURIComponent(key)}` +
    `&keyword=${encodeURIComponent(artist)}&classificationName=music&size=10`
  const data = await (await fetch(url)).json()
  const attractions: Record<string, any>[] = data?._embedded?.attractions ?? []
  const want = norm(artist)
  const exact = attractions.filter(a => norm(a?.name ?? '') === want)
  if (!exact.length) return null
  exact.sort((a, b) => (b?.upcomingEvents?._total ?? 0) - (a?.upcomingEvents?._total ?? 0))
  return exact[0]?.id ?? null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!await requireAuth(req)) return res.status(401).end()
  const artist = one(req.query.artist).trim()
  if (!artist) return res.status(400).json({ shows: [] })
  if (!API_KEY) return res.json({ shows: [], error: 'missing TICKETMASTER_API_KEY' })

  try {
    const attractionId = await resolveAttractionId(artist, API_KEY)
    if (!attractionId) {
      res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate')
      return res.json({ shows: [] })
    }

    // Only this attraction's future music events, soonest first.
    const startDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    const url = `${BASE}/events.json?apikey=${encodeURIComponent(API_KEY)}` +
      `&attractionId=${encodeURIComponent(attractionId)}` +
      '&sort=date,asc&size=60' +
      `&startDateTime=${encodeURIComponent(startDateTime)}`
    const data = await (await fetch(url)).json()
    const events: Record<string, any>[] = data?._embedded?.events ?? []

    const shows: Show[] = events.map(e => {
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
    }).filter(s => s.datetime)

    // Cache 12h — tour dates don't change minute-to-minute, and this keeps us
    // well under Ticketmaster's rate limits when many artists resolve at once.
    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate')
    return res.json({ shows })
  } catch {
    return res.json({ shows: [] })
  }
}
