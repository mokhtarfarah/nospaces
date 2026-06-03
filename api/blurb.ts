import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './auth'

// Short book blurb for the action card when Wikipedia has no summary.
// Tries Open Library (cleanest plot summary), then Apple Books (jacket blurb).
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const norm = (s: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

interface OLDoc { title?: string; author_name?: string[]; first_publish_year?: number; cover_i?: number; key?: string }
async function searchBookDoc(title: string, creator: string, year?: number): Promise<OLDoc | null> {
  const sp = new URLSearchParams({ title, limit: '10' })
  if (creator) sp.set('author', creator)
  const data = await (await fetch(`https://openlibrary.org/search.json?${sp}`)).json()
  const docs: OLDoc[] = data?.docs ?? []
  if (!docs.length) return null
  const t = norm(title)
  const c = creator ? norm(creator) : ''
  const authorOk = (d: OLDoc) => !c || (d.author_name ?? []).some(a => { const n = norm(a); return n.includes(c) || c.includes(n) })
  const pool = c ? docs.filter(authorOk) : docs
  const cands = pool.length ? pool : docs
  const exact = (d: OLDoc) => norm(d.title ?? '') === t
  return (
    cands.find(d => exact(d) && (!year || d.first_publish_year === year)) ??
    cands.find(d => exact(d)) ??
    (c ? pool[0] ?? null : cands[0] ?? null)
  )
}

function appleBookMatches(trackName: string | undefined, artistName: string | undefined, title: string, creator: string): boolean {
  if (norm(trackName ?? '') !== norm(title)) return false
  if (!creator) return true
  const a = norm(artistName ?? ''), c = norm(creator)
  return a.includes(c) || c.includes(a)
}

function shorten(s: string, maxSentences = 2, maxChars = 320): string {
  const sentences = s.split(/(?<=[.!?])\s+/).slice(0, maxSentences).join(' ')
  const out = sentences || s
  return out.length > maxChars ? out.slice(0, maxChars).replace(/\s+\S*$/, '') + '…' : out
}

async function openLibraryBlurb(title: string, creator: string, year?: number): Promise<string | null> {
  const doc = await searchBookDoc(title, creator, year)
  if (!doc?.key) return null
  const work = await (await fetch(`https://openlibrary.org${doc.key}.json`)).json()
  const raw = work?.description
  const desc = typeof raw === 'object' ? raw?.value : raw
  return typeof desc === 'string' && desc.trim() ? stripHtml(desc) : null
}

async function appleBlurb(title: string, creator: string): Promise<string | null> {
  const term = [title, creator].filter(Boolean).join(' ')
  const data = await (await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=ebook&limit=5`)).json()
  const results: { trackName?: string; artistName?: string; description?: string }[] = data?.results ?? []
  const m = results.find(r => appleBookMatches(r.trackName, r.artistName, title, creator))
  return m?.description && m.description.trim() ? stripHtml(m.description) : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!await requireAuth(req)) return res.status(401).end()
  const title = one(req.query.title)
  const creator = one(req.query.creator)
  const yearStr = one(req.query.year)
  const year = yearStr ? Number(yearStr) : undefined
  if (!title) return res.status(200).json({ summary: null, source: null })

  try {
    let summary = await openLibraryBlurb(title, creator, year).catch(() => null)
    let source: string | null = 'Open Library'
    if (!summary) {
      summary = await appleBlurb(title, creator).catch(() => null)
      source = 'Apple Books'
    }
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')
    return res.status(200).json(summary ? { summary: shorten(summary), source } : { summary: null, source: null })
  } catch (err) {
    console.error('[blurb] error for', JSON.stringify({ title }), ':', err instanceof Error ? err.message : err)
    return res.status(200).json({ summary: null, source: null })
  }
}
