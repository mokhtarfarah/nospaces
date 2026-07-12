import { useEffect, useState } from 'react'
import { authHeaders } from './supabase'

// Resolves the best cover/poster for an item via /api/art (TMDB / iTunes / Open Library).
// Returns null until loaded or when nothing is found. Cached per item.
const cache = new Map<string, string | null>()

export function clearArtworkCache(type: string, title: string, creator: string | null, year: number | null) {
  cache.delete(`${type}|${title}|${creator ?? ''}|${year ?? ''}`)
}

// Open Library serves mostly old scanned editions; Apple Books (now the primary
// book source in /api/art) carries the clean modern cover. A book cover already
// saved from Open Library is therefore treated as non-final: cards re-resolve it
// and overwrite the saved value on next view, so galleries self-heal to the nicer
// cover without a manual pass. (Non-book covers and Apple/TMDB URLs stay put.)
export function isStaleBookCover(type: string, coverUrl: string | null | undefined): boolean {
  return type === 'book' && !!coverUrl && /openlibrary\.org/.test(coverUrl)
}

export function useArtwork(type: string, title: string, creator: string | null, year: number | null, overrideUrl?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(overrideUrl ?? null)
  useEffect(() => {
    if (overrideUrl) { setUrl(overrideUrl); return }
    // Articles have no external art source (no TMDB/iTunes/Open Library
    // equivalent) — their only image is the og:image scraped at capture time,
    // passed in as overrideUrl. Skip the /api/art round trip entirely.
    if (type === 'article') { setUrl(null); return }
    const key = `${type}|${title}|${creator ?? ''}|${year ?? ''}`
    if (cache.has(key)) { setUrl(cache.get(key)!); return }
    let cancelled = false
    const sp = new URLSearchParams({ type, title })
    if (creator) sp.set('creator', creator)
    if (year) sp.set('year', String(year))
    ;(async () => {
      try {
        const h = await authHeaders()
        const r = await fetch(`/api/art?${sp}`, { headers: h })
        const d: { url?: string | null } = await r.json()
        const resolved = d.url ?? null
        cache.set(key, resolved)
        if (!cancelled) setUrl(resolved)
      } catch { if (!cancelled) setUrl(null) }
    })()
    return () => { cancelled = true }
  }, [type, title, creator, year, overrideUrl])
  return url
}
