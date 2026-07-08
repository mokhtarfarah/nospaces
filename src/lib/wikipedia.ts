import { useEffect, useState } from 'react'
import { authHeaders } from './supabase'

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

// A blurb cached before the `exintro` fix (api/wiki.ts) can contain a leaked
// section heading ("== Plot =="), because the old extract ran past the article's
// lead. Treat any such saved summary as stale so we re-fetch the clean, lead-only
// blurb instead of trusting the seed — a one-time self-heal per item.
export const isStaleSummary = (s: string | null | undefined): boolean => !!s && s.includes('==')

// Limit concurrent Wikipedia lookups so we don't hammer the API when the
// library renders many items at once (each item fires a request immediately).
const MAX_CONCURRENT = 6
let active = 0
const queue: Array<() => void> = []

function next() {
  if (active >= MAX_CONCURRENT || queue.length === 0) return
  active++
  queue.shift()!()
}

function withQueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push(() => {
      fn().then(resolve, reject).finally(() => {
        active--
        next()
      })
    })
    next()
  })
}

async function resolve(type: string, title: string, creator: string | null, year: number | null): Promise<WikiInfo> {
  const key = `${type}|${title}|${creator ?? ''}|${year ?? ''}`
  if (cache.has(key)) return cache.get(key)!

  const sp = new URLSearchParams({ type, title })
  if (creator) sp.set('creator', creator)
  if (year) sp.set('year', String(year))

  return withQueue(async () => {
    // Re-check cache in case a parallel request already resolved this key
    if (cache.has(key)) return cache.get(key)!
    try {
      const data = await (await fetch(`/api/wiki?${sp}`, { headers: await authHeaders() })).json()
      const info: WikiInfo = { url: data.url ?? null, thumbnail: data.thumbnail ?? null, summary: data.summary ?? null }
      cache.set(key, info)
      return info
    } catch {
      return EMPTY
    }
  })
}

export function clearWikiCache(type: string, title: string, creator: string | null, year: number | null) {
  const key = `${type}|${title}|${creator ?? ''}|${year ?? ''}`
  cache.delete(key)
}

// Resolve a Wikipedia article from its exact URL (not a title search). Used when
// the user has pinned a specific article — the summary/thumbnail must come from
// that page, not from re-searching the title (which is what mislinked it).
const urlCache = new Map<string, WikiInfo>()
async function resolveByUrl(wikiUrl: string): Promise<WikiInfo> {
  if (urlCache.has(wikiUrl)) return urlCache.get(wikiUrl)!
  return withQueue(async () => {
    if (urlCache.has(wikiUrl)) return urlCache.get(wikiUrl)!
    try {
      const data = await (await fetch(`/api/wiki?url=${encodeURIComponent(wikiUrl)}`, { headers: await authHeaders() })).json()
      const info: WikiInfo = { url: data.url ?? wikiUrl, thumbnail: data.thumbnail ?? null, summary: data.summary ?? null }
      urlCache.set(wikiUrl, info)
      return info
    } catch {
      return { url: wikiUrl, thumbnail: null, summary: null }
    }
  })
}

// Resolves the Wikipedia article URL + thumbnail for an item. Both may be null when
// no suitable page exists (or the type isn't looked up).
// Pass `seed` (from item metadata) to skip the network call entirely when we
// already have a cached result from a previous session.
export function useWikipediaInfo(
  type: string,
  title: string,
  creator: string | null,
  year: number | null,
  seed?: WikiInfo | null,
): WikiInfo {
  const [info, setInfo] = useState<WikiInfo>(seed?.url ? seed : EMPTY)
  useEffect(() => {
    if (seed?.url) return // already cached in DB — no fetch needed
    let cancelled = false
    resolve(type, title, creator, year).then(i => {
      if (!cancelled) setInfo(i)
    })
    return () => { cancelled = true }
  }, [type, title, creator, year, seed?.url])
  return info
}

// Rotten Tomatoes score (0-100), read from Wikidata's structured review-score
// claim (see api/wiki.ts wikidataFields). film/tv only — RT doesn't score
// books/albums, so other types never fetch. Returns null while loading or when
// the work has no RT claim on Wikidata yet — never fabricate a score.
const rtCache = new Map<string, number | null>()
export function useRottenTomatoesScore(type: string, title: string, creator: string | null, year: number | null): number | null {
  const key = `${type}|${title}|${creator ?? ''}|${year ?? ''}`
  const [score, setScore] = useState<number | null>(rtCache.get(key) ?? null)
  useEffect(() => {
    if (type !== 'film' && type !== 'tv') return
    if (rtCache.has(key)) { setScore(rtCache.get(key)!); return }
    let cancelled = false
    const sp = new URLSearchParams({ type, title, parse: '1' })
    if (creator) sp.set('creator', creator)
    if (year) sp.set('year', String(year))
    withQueue(async () => {
      let rt: number | null = null
      try {
        const data = await (await fetch(`/api/wiki?${sp}`, { headers: await authHeaders() })).json()
        rt = typeof data.parsed?.rt === 'number' ? data.parsed.rt : null
      } catch { /* leave rt null */ }
      rtCache.set(key, rt)
      if (!cancelled) setScore(rt)
    })
    return () => { cancelled = true }
  }, [type, title, creator, year, key])
  return score
}

// Resolve a pinned Wikipedia article (by URL) into its summary + thumbnail.
// Returns null while there's no URL. Pass `seed` (from item metadata) to skip the
// fetch when the summary is already cached from a previous open.
export function useWikiByUrl(wikiUrl: string | null, seed?: WikiInfo | null): WikiInfo | null {
  // A stale (heading-leaked) cached summary is ignored so the fetch below can
  // replace it with the clean lead-only blurb.
  const usable = seed?.summary && !isStaleSummary(seed.summary) ? seed : null
  const [info, setInfo] = useState<WikiInfo | null>(wikiUrl ? usable : null)
  useEffect(() => {
    if (!wikiUrl) { setInfo(null); return }
    if (usable) { setInfo(usable); return }
    let cancelled = false
    resolveByUrl(wikiUrl).then(i => { if (!cancelled) setInfo(i) })
    return () => { cancelled = true }
  }, [wikiUrl, usable?.summary]) // eslint-disable-line react-hooks/exhaustive-deps
  return info
}
