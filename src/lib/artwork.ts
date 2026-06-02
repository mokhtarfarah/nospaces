import { useEffect, useState } from 'react'

// Resolves the best cover/poster for an item via /api/art (TMDB / iTunes / Open Library).
// Returns null until loaded or when nothing is found. Cached per item.
const cache = new Map<string, string | null>()

export function useArtwork(type: string, title: string, creator: string | null, year: number | null, overrideUrl?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(overrideUrl ?? null)
  useEffect(() => {
    // User-supplied cover takes precedence — skip the API entirely.
    if (overrideUrl) { setUrl(overrideUrl); return }
    const key = `${type}|${title}|${creator ?? ''}|${year ?? ''}`
    if (cache.has(key)) {
      setUrl(cache.get(key)!)
      return
    }
    let cancelled = false
    const sp = new URLSearchParams({ type, title })
    if (creator) sp.set('creator', creator)
    if (year) sp.set('year', String(year))
    fetch(`/api/art?${sp}`)
      .then(r => r.json())
      .then((d: { url?: string | null }) => {
        const resolved = d.url ?? null
        cache.set(key, resolved)
        if (!cancelled) setUrl(resolved)
      })
      .catch(() => { if (!cancelled) setUrl(null) })
    return () => { cancelled = true }
  }, [type, title, creator, year, overrideUrl])
  return url
}
