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

// Ordered list of queries to try for each media type. First hit wins.
function wikiQueries(type: string, title: string, creator: string | null, year: number | null): string[] {
  // Drop a leading "The " / "A " for fallback attempts — Wikipedia often disambiguates
  // without the article (e.g. "Favourite" → "The Favourite (film)").
  const bare = title.replace(/^(the|a|an)\s+/i, '').trim()
  switch (type) {
    case 'film':
      return [
        ...(year ? [`${title} ${year} film`] : []),
        `${title} film`,
        ...(bare !== title ? [`${bare} film`] : []),
        title,
      ]
    case 'tv':
      return [`${title} TV series`, `${title} television series`, title]
    case 'book':
      return [[title, creator].filter(Boolean).join(' '), title]
    case 'music':
      return [[title, creator, 'album'].filter(Boolean).join(' '), `${title} album`, title]
    default:
      return []
  }
}

// Strip disambiguation parens and lowercase, for loose title comparison.
const normalize = (s: string) => s.toLowerCase().replace(/\s*\([^)]*\)\s*/g, '').trim()

async function fetchInfo(query: string): Promise<{ title: string; url: string; thumbnail: string | null; summary: string | null } | null> {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
    '&prop=pageimages|info|extracts&inprop=url&piprop=thumbnail&pithumbsize=160&pilicense=any' +
    '&exsentences=2&explaintext=1' +
    `&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(query)}`
  const data = await (await fetch(url)).json()
  const pages = data?.query?.pages
  if (!pages) return null
  const page = Object.values(pages)[0] as { title?: string; fullurl?: string; thumbnail?: { source?: string }; extract?: string } | undefined
  if (!page?.title) return null
  return {
    title: page.title,
    url: page.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    thumbnail: page.thumbnail?.source ?? null,
    summary: page.extract?.trim() || null,
  }
}

async function resolve(type: string, title: string, creator: string | null, year: number | null): Promise<WikiInfo> {
  const key = `${type}|${title}|${creator ?? ''}|${year ?? ''}`
  if (cache.has(key)) return cache.get(key)!

  const queries = wikiQueries(type, title, creator, year)
  let info: WikiInfo = EMPTY

  // Try each query in order, stopping at the first result whose title is a
  // plausible match. Books/music need a strict match (common words return junk);
  // films/tv use a loose check so "The Favourite (film)" still matches "The Favourite".
  const strict = type === 'book' || type === 'music'
  const a = normalize(title)

  for (const query of queries) {
    try {
      const found = await fetchInfo(query)
      if (!found) continue
      const b = normalize(found.title)
      const ok = strict ? (b.includes(a) || a.includes(b)) : (b.includes(a) || a.includes(b) || b.includes(a.replace(/^(the|a|an)\s+/i, '').trim()))
      if (ok) {
        info = { url: found.url, thumbnail: found.thumbnail, summary: found.summary }
        break
      }
    } catch {
      // network error on this attempt — try next query
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
