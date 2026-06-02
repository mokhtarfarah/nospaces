import { useEffect, useState } from 'react'

// Build a Wikipedia search URL — used for types that reliably have pages (film, tv).
export function wikiSearchUrl(title: string, year: number | null, kind: 'film' | 'TV series') {
  const q = encodeURIComponent([title, year, kind].filter(Boolean).join(' '))
  return `https://en.wikipedia.org/w/index.php?search=${q}`
}

// For books, we only want a link when an actual article exists. Resolve it via the
// opensearch API (returns the article URL, or null if nothing matches). Cached per query.
const bookCache = new Map<string, string | null>()

export async function lookupBookWikipedia(title: string, creator?: string | null): Promise<string | null> {
  const key = `${title}|${creator ?? ''}`
  if (bookCache.has(key)) return bookCache.get(key)!
  const q = encodeURIComponent([title, creator].filter(Boolean).join(' '))
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=1&namespace=0&origin=*&search=${q}`,
    )
    const data = (await res.json()) as [string, string[], string[], string[]]
    const link = data?.[3]?.[0] ?? null
    bookCache.set(key, link)
    return link
  } catch {
    return null
  }
}

// Returns the book's Wikipedia URL if a page exists, else null. Only fetches when enabled.
export function useBookWikipedia(title: string, creator: string | null, enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) {
      setUrl(null)
      return
    }
    let cancelled = false
    lookupBookWikipedia(title, creator).then(u => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [title, creator, enabled])
  return url
}
