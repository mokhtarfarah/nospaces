import { useEffect, useState } from 'react'

// Fetches a short book blurb (Open Library / Apple Books) for the action card when
// Wikipedia has no summary. Returns { summary, source }. Cached per book.
export interface Blurb {
  summary: string | null
  source: string | null
}

const EMPTY: Blurb = { summary: null, source: null }
const cache = new Map<string, Blurb>()

export function useBookBlurb(title: string, creator: string | null, year: number | null, enabled: boolean): Blurb {
  const [blurb, setBlurb] = useState<Blurb>(EMPTY)
  useEffect(() => {
    if (!enabled) { setBlurb(EMPTY); return }
    const key = `${title}|${creator ?? ''}|${year ?? ''}`
    if (cache.has(key)) { setBlurb(cache.get(key)!); return }
    let cancelled = false
    const sp = new URLSearchParams({ title })
    if (creator) sp.set('creator', creator)
    if (year) sp.set('year', String(year))
    fetch(`/api/blurb?${sp}`)
      .then(r => r.json())
      .then((d: Blurb) => {
        const val: Blurb = { summary: d.summary ?? null, source: d.source ?? null }
        cache.set(key, val)
        if (!cancelled) setBlurb(val)
      })
      .catch(() => { if (!cancelled) setBlurb(EMPTY) })
    return () => { cancelled = true }
  }, [title, creator, year, enabled])
  return blurb
}
