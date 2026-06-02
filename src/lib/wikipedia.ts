import { useEffect, useState } from 'react'

export interface WikiInfo {
  url: string | null
  thumbnail: string | null
  summary: string | null
}

const EMPTY: WikiInfo = { url: null, thumbnail: null, summary: null }
const cache = new Map<string, WikiInfo>()

// Two lookup strategies:
//   search — full-text search (broad, works for most well-known articles)
//   title  — direct page lookup by name, following redirects (precise fallback
//            for films that don't rank well in search, e.g. foreign-language titles)
type WikiQuery = { kind: 'search'; q: string } | { kind: 'title'; t: string }

function wikiQueries(type: string, title: string, creator: string | null, year: number | null): WikiQuery[] {
  const bare = title.replace(/^(the|a|an)\s+/i, '').trim()
  switch (type) {
    case 'film':
      return [
        // Full-text search first — reliable for the vast majority of films.
        ...(year ? [{ kind: 'search' as const, q: `${title} ${year} film` }] : []),
        { kind: 'search' as const, q: `${title} film` },
        ...(bare !== title ? [{ kind: 'search' as const, q: `${bare} film` }] : []),
        { kind: 'search' as const, q: title },
        // Direct title lookups as fallback — catches films whose Wikipedia article
        // doesn't rank #1 in search (e.g. Ponyo, foreign-language adaptations).
        ...(year ? [{ kind: 'title' as const, t: `${title} (${year} film)` }] : []),
        { kind: 'title' as const, t: `${title} (film)` },
        ...(bare !== title ? [{ kind: 'title' as const, t: `${bare} (film)` }] : []),
      ]
    case 'tv':
      return [
        { kind: 'search' as const, q: `${title} TV series` },
        { kind: 'search' as const, q: `${title} television series` },
        { kind: 'search' as const, q: title },
        { kind: 'title' as const, t: `${title} (TV series)` },
        { kind: 'title' as const, t: `${title} (television series)` },
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

const BASE =
  'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
  '&prop=pageimages|info|extracts&inprop=url&piprop=thumbnail&pithumbsize=160&pilicense=any' +
  '&exsentences=2&explaintext=1'

type PageResult = { title: string; url: string; thumbnail: string | null; summary: string | null }

async function fetchBySearch(q: string): Promise<PageResult | null> {
  const data = await (await fetch(`${BASE}&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(q)}`)).json()
  return parsePage(data?.query?.pages)
}

async function fetchByTitle(t: string): Promise<PageResult | null> {
  const data = await (await fetch(`${BASE}&redirects=1&titles=${encodeURIComponent(t)}`)).json()
  return parsePage(data?.query?.pages)
}

function parsePage(pages: unknown): PageResult | null {
  if (!pages || typeof pages !== 'object') return null
  const page = Object.values(pages as Record<string, unknown>)[0] as Record<string, unknown> | undefined
  if (!page) return null
  // Wikipedia marks missing/unknown titles with a "missing" property.
  if (!page.title || Object.prototype.hasOwnProperty.call(page, 'missing')) return null
  return {
    title: page.title as string,
    url: (page.fullurl as string | undefined) ??
      `https://en.wikipedia.org/wiki/${encodeURIComponent((page.title as string).replace(/ /g, '_'))}`,
    thumbnail: (page.thumbnail as { source?: string } | undefined)?.source ?? null,
    summary: ((page.extract as string | undefined)?.trim()) || null,
  }
}

async function resolve(type: string, title: string, creator: string | null, year: number | null): Promise<WikiInfo> {
  const key = `${type}|${title}|${creator ?? ''}|${year ?? ''}`
  if (cache.has(key)) return cache.get(key)!

  const queries = wikiQueries(type, title, creator, year)
  let info: WikiInfo = EMPTY

  // Books/music: guard against common-word false positives by checking title similarity.
  // Films/TV: trust the result — explicit search terms and year anchoring are precise enough.
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
      // network error — try next query
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
