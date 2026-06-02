// Shared book matching for cover + blurb lookups (underscore prefix => not a route).
// Verifies title/author/year so e.g. "Pride and Prejudice" doesn't match
// "Pride and Prejudice and Zombies".
export const norm = (s: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

export interface OLDoc {
  title?: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  key?: string
}

const authorMatches = (authors: string[] | undefined, creator: string) => {
  if (!creator) return true
  const c = norm(creator)
  return (authors ?? []).some(a => {
    const n = norm(a)
    return n.includes(c) || c.includes(n)
  })
}

// Pick the best Open Library doc: author must match (when known); prefer exact title,
// then a year match, before falling back to the first author match.
export async function searchBookDoc(title: string, creator: string, year?: number): Promise<OLDoc | null> {
  const sp = new URLSearchParams({ title, limit: '10' })
  if (creator) sp.set('author', creator)
  const data = await (await fetch(`https://openlibrary.org/search.json?${sp}`)).json()
  const docs: OLDoc[] = data?.docs ?? []
  if (!docs.length) return null

  const t = norm(title)
  const pool = creator ? docs.filter(d => authorMatches(d.author_name, creator)) : docs
  const cands = pool.length ? pool : docs
  const exact = (d: OLDoc) => norm(d.title ?? '') === t
  return (
    cands.find(d => exact(d) && (!year || d.first_publish_year === year)) ??
    cands.find(d => exact(d)) ??
    (creator ? pool[0] ?? null : cands[0] ?? null)
  )
}

// Verify an iTunes/Apple ebook result really matches (exact title + author).
export function appleBookMatches(trackName: string | undefined, artistName: string | undefined, title: string, creator: string): boolean {
  if (norm(trackName ?? '') !== norm(title)) return false
  if (!creator) return true
  const a = norm(artistName ?? '')
  const c = norm(creator)
  return a.includes(c) || c.includes(a)
}
