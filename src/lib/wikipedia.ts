import { useEffect, useState } from 'react'

// Look up a media item on Wikipedia and return its canonical article URL plus a
// thumbnail image (poster / cover / album art). Uses full-text search (more forgiving
// than autocomplete) and pulls the page image in the same request. Cached per item.
export interface WikiInfo {
  url: string | null
  thumbnail: string | null
}

const EMPTY: WikiInfo = { url: null, thumbnail: null }
const cache = new Map<string, WikiInfo>()

// Build the search query per media type. Returns null for types we don't look up.
function wikiQuery(type: string, title: string, creator: string | null, year: number | null): string | null {
  switch (type) {
    case 'film':  return [title, year, 'film'].filter(Boolean).join(' ')
    case 'tv':    return [title, 'TV series'].filter(Boolean).join(' ')
    case 'book':  return [title, creator].filter(Boolean).join(' ')
    case 'music': return [title, creator, 'album'].filter(Boolean).join(' ')
    default:      return null
  }
}

// Strip disambiguation parens and lowercase, for loose title comparison.
const normalize = (s: string) => s.toLowerCase().replace(/\s*\([^)]*\)\s*/g, '').trim()

async function fetchInfo(query: string): Promise<{ title: string; url: string; thumbnail: string | null } | null> {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
    '&prop=pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=160&pilicense=any' +
    `&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(query)}`
  const data = await (await fetch(url)).json()
  const pages = data?.query?.pages
  if (!pages) return null
  const page = Object.values(pages)[0] as { title?: string; fullurl?: string; thumbnail?: { source?: string } } | undefined
  if (!page?.title) return null
  return {
    title: page.title,
    url: page.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    thumbnail: page.thumbnail?.source ?? null,
  }
}

async function resolve(type: string, title: string, creator: string | null, year: number | null): Promise<WikiInfo> {
  const key = `${type}|${title}|${creator ?? ''}|${year ?? ''}`
  if (cache.has(key)) return cache.get(key)!

  const query = wikiQuery(type, title, creator, year)
  let info: WikiInfo = EMPTY
  if (query) {
    try {
      const found = await fetchInfo(query)
      if (found) {
        // Books/albums are ambiguous — guard against an unrelated top hit (wrong page
        // and wrong cover). Films/TV reliably resolve, so accept their top result.
        const guarded = type === 'book' || type === 'music'
        const a = normalize(title)
        const b = normalize(found.title)
        const ok = !guarded || b.includes(a) || a.includes(b)
        if (ok) info = { url: found.url, thumbnail: found.thumbnail }
      }
    } catch {
      info = EMPTY
    }
  }
  cache.set(key, info)
  return info
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
