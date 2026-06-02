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
  try {
    const resp = await fetch(url)
    const data = await resp.json()
    const pages = data?.query?.pages
    if (!pages) {
      console.warn('[wiki] no pages for query:', query, '| response keys:', Object.keys(data ?? {}))
      return null
    }
    const page = Object.values(pages)[0] as { title?: string; fullurl?: string; thumbnail?: { source?: string }; extract?: string } | undefined
    if (!page?.title) {
      console.warn('[wiki] no title in page for query:', query)
      return null
    }
    return {
      title: page.title,
      url: page.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
      thumbnail: page.thumbnail?.source ?? null,
      summary: page.extract?.trim() || null,
    }
  } catch (err) {
    console.error('[wiki] fetch/parse error for query:', query, err)
    return null
  }
}

// Direct title lookup with redirect following — used as a last-resort fallback
// for films whose article doesn't rank #1 in full-text search (e.g. Ponyo).
async function fetchByTitle(title: string): Promise<{ title: string; url: string; thumbnail: string | null; summary: string | null } | null> {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
    '&prop=pageimages|info|extracts&inprop=url&piprop=thumbnail&pithumbsize=160&pilicense=any' +
    '&exsentences=2&explaintext=1&redirects=1' +
    `&titles=${encodeURIComponent(title)}`
  const data = await (await fetch(url)).json()
  const pages = data?.query?.pages
  if (!pages) return null
  const page = Object.values(pages)[0] as { title?: string; fullurl?: string; thumbnail?: { source?: string }; extract?: string; missing?: string } | undefined
  // Wikipedia returns a page with 'missing' property when the title doesn't exist.
  if (!page?.title || 'missing' in (page as object)) return null
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

  // Books/music: guard against common-word false positives by checking title similarity.
  // Films/TV: trust the search result — Wikipedia film searches are reliable enough,
  // and a strict title check breaks legitimate hits like "The Favourite (film)".
  const guarded = type === 'book' || type === 'music'
  const a = normalize(title)

  for (const query of queries) {
    try {
      const found = await fetchInfo(query)
      if (!found) continue
      if (guarded) {
        const b = normalize(found.title)
        if (!b.includes(a) && !a.includes(b)) continue
      }
      info = { url: found.url, thumbnail: found.thumbnail, summary: found.summary }
      break
    } catch {
      // network error on this attempt — try next query
    }
  }

  // If full-text search found nothing, try direct title lookups as a final fallback.
  // This catches films/TV whose article doesn't rank #1 in search (e.g. Ponyo).
  if (info === EMPTY && (type === 'film' || type === 'tv')) {
    const bare = title.replace(/^(the|a|an)\s+/i, '').trim()
    const directTitles = type === 'film'
      ? [
          ...(year ? [`${title} (${year} film)`] : []),
          `${title} (film)`,
          ...(bare !== title ? [`${bare} (film)`] : []),
        ]
      : [`${title} (TV series)`, `${title} (television series)`]
    for (const t of directTitles) {
      try {
        const found = await fetchByTitle(t)
        if (!found) continue
        info = { url: found.url, thumbnail: found.thumbnail, summary: found.summary }
        break
      } catch {
        // try next
      }
    }
  }

  cache.set(key, info)
  return info
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
