import { useEffect, useState } from 'react'

// Look up a media item on Wikipedia and return its canonical article URL plus a
// thumbnail image (poster / cover / album art). Uses full-text search (more forgiving
// than autocomplete) and pulls the page image in the same request. Cached per item.
export interface WikiInfo {
  url: string | null
  thumbnail: string | null
  summary: string | null
}

const EMPTY: WikiInfo = { url: null, thumbnail: null, summary: null }
const cache = new Map<string, WikiInfo>()


async function resolve(type: string, title: string, creator: string | null, year: number | null): Promise<WikiInfo> {
  const key = `${type}|${title}|${creator ?? ''}|${year ?? ''}`
  if (cache.has(key)) return cache.get(key)!

  const sp = new URLSearchParams({ type, title })
  if (creator) sp.set('creator', creator)
  if (year) sp.set('year', String(year))

  try {
    const data = await (await fetch(`/api/wiki?${sp}`)).json()
    const info: WikiInfo = { url: data.url ?? null, thumbnail: data.thumbnail ?? null, summary: data.summary ?? null }
    cache.set(key, info)
    return info
  } catch {
    return EMPTY
  }
}

export function clearWikiCache(type: string, title: string, creator: string | null, year: number | null) {
  const key = `${type}|${title}|${creator ?? ''}|${year ?? ''}`
  cache.delete(key)
}

// Resolves the Wikipedia article URL + thumbnail for an item. Both may be null when
// no suitable page exists (or the type isn't looked up).
export function useWikipediaInfo(type: string, title: string, creator: string | null, year: number | null): WikiInfo {
  const [info, setInfo] = useState<WikiInfo>(EMPTY)
  useEffect(() => {
    let cancelled = false
    resolve(type, title, creator, year).then(i => {
      if (!cancelled) setInfo(i)
    })
    return () => {
      cancelled = true
    }
  }, [type, title, creator, year])
  return info
}
