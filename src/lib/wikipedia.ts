import { useEffect, useState } from 'react'

// Resolve the direct Wikipedia article URL for a query via the opensearch API.
// Returns null if no article matches. Cached per query.
const cache = new Map<string, string | null>()

export async function resolveWikipedia(query: string): Promise<string | null> {
  if (cache.has(query)) return cache.get(query)!
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=1&namespace=0&origin=*&search=${encodeURIComponent(query)}`,
    )
    const data = (await res.json()) as [string, string[], string[], string[]]
    const link = data?.[3]?.[0] ?? null
    cache.set(query, link)
    return link
  } catch {
    return null
  }
}

// Build the search query per media type. Returns null for types we don't link.
function wikiQuery(type: string, title: string, creator: string | null, year: number | null): string | null {
  switch (type) {
    case 'film': return [title, year, 'film'].filter(Boolean).join(' ')
    case 'tv':   return [title, 'TV series'].filter(Boolean).join(' ')
    case 'book': return [title, creator].filter(Boolean).join(' ')
    default:     return null
  }
}

// Resolves the direct Wikipedia article URL for an item, or null if no page exists
// (or the type isn't linked). Films/TV almost always resolve; books only when a page exists.
export function useWikipediaLink(type: string, title: string, creator: string | null, year: number | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  const query = wikiQuery(type, title, creator, year)
  useEffect(() => {
    if (!query) {
      setUrl(null)
      return
    }
    let cancelled = false
    resolveWikipedia(query).then(u => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [query])
  return url
}
