import { useEffect, useState } from 'react'

export interface WikiInfo {
  url: string | null
  thumbnail: string | null
  summary: string | null
}

const EMPTY: WikiInfo = { url: null, thumbnail: null, summary: null }
const cache = new Map<string, WikiInfo>()

// Two lookup strategies:
//   title — direct page lookup by name, with redirects=1 (reliable for well-known articles)
//   search — full-text search (broader, but ranking can miss the right article)
type WikiQuery = { kind: 'title'; t: string } | { kind: 'search'; q: string }

function wikiQueries(type: string, title: string, creator: string | null, year: number | null): WikiQuery[] {
  const bare = title.replace(/^(the|a|an)\s+/i, '').trim()
  switch (type) {
    case 'film':
      return [
        // Direct title lookups first — Wikipedia follows redirects, so
        // "Ponyo (film)" → "Ponyo", "Almost Famous (film)" → "Almost Famous", etc.
        ...(year ? [{ kind: 'title' as const, t: `${title} (${year} film)` }] : []),
        { kind: 'title' as const, t: `${title} (film)` },
        ...(bare !== title ? [{ kind: 'title' as const, t: `${bare} (film)` }] : []),
        // Full-text search fallbacks
        ...(year ? [{ kind: 'search' as const, q: `${title} ${year} film` }] : []),
        { kind: 'search' as const, q: `${title} film` },
        ...(bare !== title ? [{ kind: 'search' as const, q: `${bare} film` }] : []),
        { kind: 'search' as const, q: title },
      ]
    case 'tv':
      return [
        { kind: 'title' as const, t: `${title} (TV series)` },
        { kind: 'title' as const, t: `${title} (television series)` },
        { kind: 'search' as const, q: `${title} TV series` },
        { kind: 'search' as const, q: `${title} television series` },
        { kind: 'search' as const, q: title },
      ]
    case 'book':
      return [
        { kind: 'search' as const, q: [title, creator].filter(Boolean).join(' ') },
        { kind: 'search' as const, q: title },
      ]
    case 'music':
      return [
        { kind: 'search' as const, q: [title, creator, 'album'].filter(Boolean).join(' ') },
        { kind: 'search' as const, q: `${title} album` },
        { kind: 'search' as const, q: title },
      ]
    default:
      return []
  }
}

const normalize = (s: string) => s.toLowerCase().replace(/\s*\([^)]*\)\s*/g, '').trim()

const PROPS =
  '&prop=pageimages|info|extracts&inprop=url&piprop=thumbnail&pithumbsize=160&pilicense=any' +
  '&exsentences=2&explaintext=1'

type PageResult = { title: string; url: string; thumbnail: string | null; summary: string | null }

async function fetchByTitle(titleParam: string): Promise<PageResult | null> {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
    PROPS + '&redirects=1' +
    `&titles=${encodeURIComponent(titleParam)}`
  const data = await (await fetch(url)).json()
  const pages = data?.query?.pages
  if (!pages) return null
  const page = Object.values(pages)[0] as Record<string, unknown> | undefined
  // Wikipedia returns { "missing": "" } on the page object for unknown titles.
  if (!page?.title || 'missing' in page) return null
  return {
    title: page.title as string,
    url: (page.fullurl as string | undefined) ?? `https://en.wikipedia.org/wiki/${encodeURIComponent((page.title as string).replace(/ /g, '_'))}`,
    thumbnail: (page.thumbnail as { source?: string } | undefined)?.source ?? null,
    summary: ((page.extract as string | undefined)?.trim()) || null,
  }
}

async function fetchBySearch(query: string): Promise<PageResult | null> {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
    PROPS +
    `&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(query)}`
  const data = await (await fetch(url)).json()
  const pages = data?.query?.pages
  if (!pages) return null
  const page = Object.values(pages)[0] as Record<string, unknown> | undefined
  if (!page?.title) return null
  return {
    title: page.title as string,
    url: (page.fullurl as string | undefined) ?? `https://en.wikipedia.org/wiki/${encodeURIComponent((page.title as string).replace(/ /g, '_'))}`,
    thumbnail: (page.thumbnail as { source?: string } | undefined)?.source ?? null,
    summary: ((page.extract as string | undefined)?.trim()) || null,
  }
}

async function resolve(type: string, title: string, creator: string | null, year: number | null): Promise<WikiInfo> {
  const key = `${type}|${title}|${creator ?? ''}|${year ?? ''}`
  if (cache.has(key)) return cache.get(key)!

  const queries = wikiQueries(type, title, creator, year)
  let info: WikiInfo = EMPTY

  // Books/music: guard against false positives by checking title similarity.
  // Films/TV: accept the result — title-based lookups are already precise.
  const guarded = type === 'book' || type === 'music'
  const a = normalize(title)

  for (const q of queries) {
    try {
      const found = q.kind === 'title' ? await fetchByTitle(q.t) : await fetchBySearch(q.q)
      if (!found) continue
      if (guarded) {
        const b = normalize(found.title)
        if (!b.includes(a) && !a.includes(b)) continue
      }
      info = { url: found.url, thumbnail: found.thumbnail, summary: found.summary }
      break
    } catch {
      // network error on this attempt — try next
    }
  }

  cache.set(key, info)
  return info
}

export function clearWikiCache(type: string, title: string, creator: string | null, year: number | null) {
  const key = `${type}|${title}|${creator ?? ''}|${year ?? ''}`
  cache.delete(key)
}

export function useWikipediaInfo(type: string, title: string, creator: string | null, year: number | null): WikiInfo {
  const [info, setInfo] = useState<WikiInfo>(EMPTY)
  useEffect(() => {
    let cancelled = false
    resolve(type, title, creator, year).then(i => {
      if (!cancelled) setInfo(i)
    })
    return () => { cancelled = true }
  }, [type, title, creator, year])
  return info
}
