import type { Item } from './database.types'
import type { Show } from '../../api/shows'
import { authHeaders } from './supabase'

export type { Show }

// Preset home-base cities for when GPS is declined/unavailable. Lat/lng let us
// still do distance filtering without a geocoding service. Add/edit freely.
export interface City {
  name: string
  lat: number
  lng: number
}
export const HOME_CITIES: City[] = [
  { name: 'New York', lat: 40.7128, lng: -74.006 },
  { name: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
]

// Distance radius options (miles). null = anywhere (no distance filter).
export const RADIUS_OPTIONS: Array<{ label: string; miles: number | null }> = [
  { label: '25 mi', miles: 25 },
  { label: '50 mi', miles: 50 },
  { label: '100 mi', miles: 100 },
  { label: '250 mi', miles: 250 },
  { label: 'anywhere', miles: null },
]

// Great-circle distance in miles between two lat/lng points.
export function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8 // earth radius, miles
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Unique artist names from the user's liked/loved music. We only chase tour
// dates for music they actually rated positively (the point is "go see things
// you love"), not the whole backlog.
export function likedArtists(items: Item[]): string[] {
  const positive = new Set(['loved_it', 'liked_it'])
  const names = new Map<string, string>() // lowercased key -> display name
  for (const it of items) {
    if (it.type !== 'music') continue
    if (!it.reaction || !positive.has(it.reaction)) continue
    const a = (it.creator ?? '').trim()
    if (!a || a.toLowerCase() === 'various artists') continue
    const key = a.toLowerCase()
    if (!names.has(key)) names.set(key, a)
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b))
}

// Resolve a typed place to a city with coordinates (via /api/geocode). Returns
// null if nothing matches.
export async function geocodeCity(q: string): Promise<City | null> {
  try {
    const h = await authHeaders()
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { headers: h })
    const data = await res.json()
    return data.result ?? null
  } catch {
    return null
  }
}

// Lowercased names of artists the user *loved* (not just liked). Used to float
// favourites to the top and power the "loved only" filter in the by-artist view.
export function lovedArtistKeys(items: Item[]): Set<string> {
  const s = new Set<string>()
  for (const it of items) {
    if (it.type !== 'music' || it.reaction !== 'loved_it') continue
    const a = (it.creator ?? '').trim()
    if (a) s.add(a.toLowerCase())
  }
  return s
}

// Fetch one artist's upcoming shows via our proxy.
async function fetchArtistShows(artist: string): Promise<Show[]> {
  try {
    const h = await authHeaders()
    const res = await fetch(`/api/shows?artist=${encodeURIComponent(artist)}`, { headers: h })
    const data = await res.json()
    return Array.isArray(data.shows) ? data.shows : []
  } catch {
    return []
  }
}

// Fetch shows for many artists with a concurrency cap, calling `onProgress`
// after each artist resolves so the UI can render results as they stream in.
export async function fetchAllShows(
  artists: string[],
  onProgress: (done: number, total: number, shows: Show[]) => void,
  concurrency = 5,
): Promise<void> {
  let done = 0
  let idx = 0
  const total = artists.length
  async function worker() {
    while (idx < artists.length) {
      const artist = artists[idx++]
      const shows = await fetchArtistShows(artist)
      done++
      onProgress(done, total, shows)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker))
}
