import type { VercelRequest, VercelResponse } from '@vercel/node'

// Short book blurb for the action card when Wikipedia has no summary.
// Tries Open Library (cleanest plot summary), then Apple Books (jacket blurb).
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

function shorten(s: string, maxSentences = 2, maxChars = 320): string {
  const sentences = s.split(/(?<=[.!?])\s+/).slice(0, maxSentences).join(' ')
  const out = sentences || s
  return out.length > maxChars ? out.slice(0, maxChars).replace(/\s+\S*$/, '') + '…' : out
}

async function openLibraryBlurb(title: string, creator: string): Promise<string | null> {
  const sp = new URLSearchParams({ title, limit: '1' })
  if (creator) sp.set('author', creator)
  const search = await (await fetch(`https://openlibrary.org/search.json?${sp}`)).json()
  const key: string | undefined = search?.docs?.[0]?.key
  if (!key) return null
  const work = await (await fetch(`https://openlibrary.org${key}.json`)).json()
  const raw = work?.description
  const desc = typeof raw === 'object' ? raw?.value : raw
  return typeof desc === 'string' && desc.trim() ? stripHtml(desc) : null
}

async function appleBlurb(title: string, creator: string): Promise<string | null> {
  const term = [title, creator].filter(Boolean).join(' ')
  const data = await (await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=ebook&limit=1`)).json()
  const d: string | undefined = data?.results?.[0]?.description
  return d && d.trim() ? stripHtml(d) : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const title = one(req.query.title)
  const creator = one(req.query.creator)
  if (!title) return res.status(200).json({ summary: null, source: null })

  try {
    let summary = await openLibraryBlurb(title, creator).catch(() => null)
    let source: string | null = 'Open Library'
    if (!summary) {
      summary = await appleBlurb(title, creator).catch(() => null)
      source = 'Apple Books'
    }
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')
    return res.status(200).json(summary ? { summary: shorten(summary), source } : { summary: null, source: null })
  } catch {
    return res.status(200).json({ summary: null, source: null })
  }
}
