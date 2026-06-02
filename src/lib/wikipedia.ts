import { useEffect, useState } from 'react'

// Resolve the direct Wikipedia article URL for a media item. Uses full-text search
// (more forgiving than autocomplete, which only prefix-matches titles). Returns null
// when nothing suitable is found. Cached per item.
const cache = new Map<string, string | null>()

// Build the search query per media type. Returns null for types we don't link.
function wikiQuery(type: string, title: string, creator: string | null, year: number | null): string | null {
  switch (type) {
    case 'film': return [title, year, 'film'].filter(Boolean).join(' ')
    case 'tv':   return [title, 'TV series'].filter(Boolean).join(' ')
    case 'book': return [title, creator].filter(Boolean).join(' ')
    default:     return null
  }
}

async function searchTopTitle(query: string): Promise<string | null> {
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=${encodeURIComponent(query)}`,
  )
  const data = await res.json()
  return data?.query?.search?.[0]?.title ?? null
}

function articleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

// Strip disambiguation parens and lowercase, for loose title comparison.
const normalize = (s: string) => s.toLowerCase().replace(/\s*\([^)]*\)\s*/g, '').trim()

async function resolve(type: string, title: string, creator: string | null, year: number | null): Promise<string | null> {
  const key = `${type}|${title}|${creator ?? ''}|${year ?? ''}`
  if (cache.has(key)) return cache.get(key)!

  const query = wikiQuery(type, title, creator, year)
  let url: string | null = null
  if (query) {
    try {
      const found = await searchTopTitle(query)
      if (found) {
        // Books often have no article — guard against linking an unrelated top hit.
        // Films/TV reliably have pages, so accept the top result directly.
        const ok = type !== 'book' || (() => {
          const a = normalize(title)
          const b = normalize(found)
          return b.includes(a) || a.includes(b)
        })()
        if (ok) url = articleUrl(found)
      }
    } catch {
      url = null
    }
  }
  cache.set(key, url)
  return url
}

// Resolves the direct Wikipedia article URL for an item, or null if no page exists
// (or the type isn't linked).
export function useWikipediaLink(type: string, title: string, creator: string | null, year: number | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    resolve(type, title, creator, year).then(u => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [type, title, creator, year])
  return url
}
