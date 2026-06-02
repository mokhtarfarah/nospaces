import { useEffect, useState } from 'react'

// TV seasons are stored on an item's metadata as metadata.seasons.
export interface Season {
  n: number
  done: boolean
}

export function getSeasons(metadata: Record<string, unknown>): Season[] {
  const raw = (metadata as { seasons?: unknown }).seasons
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s): s is Season => !!s && typeof (s as Season).n === 'number')
    .map(s => ({ n: (s as Season).n, done: !!(s as Season).done }))
    .sort((a, b) => a.n - b.n)
}

// Look up how many seasons a show has via the free TVmaze API (no key, CORS-ok).
// Counts only seasons that have already premiered. Cached per title.
const countCache = new Map<string, number | null>()

export async function fetchSeasonCount(title: string): Promise<number | null> {
  const key = title.toLowerCase().trim()
  if (countCache.has(key)) return countCache.get(key)!
  try {
    const res = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}&embed=seasons`)
    if (!res.ok) { countCache.set(key, null); return null }
    const data = await res.json()
    const seasons: { premiereDate?: string | null }[] = data?._embedded?.seasons ?? []
    const now = Date.now()
    const aired = seasons.filter(s => s.premiereDate && new Date(s.premiereDate).getTime() <= now)
    const count = (aired.length || seasons.length) || null
    countCache.set(key, count)
    return count
  } catch {
    countCache.set(key, null)
    return null
  }
}

export function useSeasonCount(title: string, enabled: boolean): number | null {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled) { setCount(null); return }
    let cancelled = false
    fetchSeasonCount(title).then(c => { if (!cancelled) setCount(c) })
    return () => { cancelled = true }
  }, [title, enabled])
  return count
}
