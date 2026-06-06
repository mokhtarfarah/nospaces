import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const _ce = (s: string | undefined) => (s ?? '').replace(/[^\x20-\x7E]/g, '').trim()
let _sba: ReturnType<typeof createClient> | null = null
const _ac = () => { if (!_sba) _sba = createClient(_ce(process.env.SUPABASE_URL), _ce(process.env.SUPABASE_SERVICE_ROLE_KEY)); return _sba }
async function requireAuth(req: VercelRequest): Promise<boolean> { const a = req.headers['authorization']; if (!a?.startsWith('Bearer ')) return false; try { const { error } = await _ac().auth.getUser(a.slice(7)); return !error } catch { return false } }

export const config = { maxDuration: 60 }

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Feed types (mirrors src/lib/feeds.ts — keep in sync) ──────────────────────
type FeedKind = 'substack' | 'reddit' | 'rss'
type FeedType = 'book' | 'music' | 'film' | 'tv' | 'cross'

interface FeedEntry {
  url: string
  name: string
  types: FeedType[]
  kind: FeedKind
}

interface DiscoveryResult {
  title: string
  creator: string | null
  type: 'film' | 'book' | 'music' | 'tv'
  year: number | null
  why: string
  source: string
}

const DEFAULT_FEEDS: FeedEntry[] = [
  { url: 'https://pandorasykes.substack.com/feed',         name: 'Pandora Sykes',          types: ['book', 'cross'], kind: 'substack' },
  { url: 'https://georgesaunders.substack.com/feed',       name: 'George Saunders',        types: ['book', 'cross'], kind: 'substack' },
  { url: 'https://jesswhitereadsbooks.substack.com/feed',  name: 'Jess White Reads Books', types: ['book'],          kind: 'substack' },
  { url: 'https://lithub.com/feed/',                       name: 'Literary Hub',           types: ['book'],          kind: 'rss'      },
  { url: 'https://www.themillions.com/feed',               name: 'The Millions',           types: ['book'],          kind: 'rss'      },
  { url: 'https://www.reddit.com/r/booksuggestions/top.rss?t=week', name: 'r/booksuggestions', types: ['book'], kind: 'reddit' },
  { url: 'https://www.reddit.com/r/literature/top.rss?t=week',      name: 'r/literature',      types: ['book'], kind: 'reddit' },
  { url: 'https://www.reddit.com/r/52books/top.rss?t=week',         name: 'r/52books',         types: ['book'], kind: 'reddit' },
  { url: 'https://recordstore.substack.com/feed',          name: 'Record Store',       types: ['music'],          kind: 'substack' },
  { url: 'https://www.honest-broker.com/feed',             name: 'Honest Broker',      types: ['music', 'cross'], kind: 'substack' },
  { url: 'https://daily.bandcamp.com/feed/',               name: 'Bandcamp Daily',     types: ['music'],          kind: 'rss'      },
  { url: 'https://aquariumdrunkard.com/feed/',             name: 'Aquarium Drunkard',  types: ['music'],          kind: 'rss'      },
  { url: 'https://pitchfork.com/rss/reviews/albums/',      name: 'Pitchfork',          types: ['music'],          kind: 'rss'      },
  { url: 'https://www.nme.com/feed',                       name: 'NME',                types: ['music'],          kind: 'rss'      },
  { url: 'https://www.reddit.com/r/ifyoulikeblank/top.rss?t=week', name: 'r/ifyoulikeblank', types: ['music'], kind: 'reddit' },
  { url: 'https://www.reddit.com/r/indieheads/top.rss?t=week',     name: 'r/indieheads',     types: ['music'], kind: 'reddit' },
  { url: 'https://www.reddit.com/r/vinyl/top.rss?t=week',          name: 'r/vinyl',          types: ['music'], kind: 'reddit' },
  { url: 'https://thereveal.substack.com/feed',            name: 'The Reveal',    types: ['film', 'cross'],      kind: 'substack' },
  { url: 'https://www.vulture.com/rss/all.xml',            name: 'Vulture',       types: ['film', 'tv', 'cross'],kind: 'rss'      },
  { url: 'https://www.rogerebert.com/feed',                name: 'Roger Ebert',   types: ['film'],               kind: 'rss'      },
  { url: 'https://www.filmcomment.com/feed/',              name: 'Film Comment',  types: ['film'],               kind: 'rss'      },
  { url: 'https://www.reddit.com/r/TrueFilm/top.rss?t=week',            name: 'r/TrueFilm',           types: ['film'], kind: 'reddit' },
  { url: 'https://www.reddit.com/r/Letterboxd/top.rss?t=week',          name: 'r/Letterboxd',         types: ['film'], kind: 'reddit' },
  { url: 'https://www.reddit.com/r/MovieSuggestions/top.rss?t=week',    name: 'r/MovieSuggestions',   types: ['film'], kind: 'reddit' },
  { url: 'https://www.reddit.com/r/televisionsuggestions/top.rss?t=week', name: 'r/televisionsuggestions', types: ['tv'], kind: 'reddit' },
  { url: 'https://mollyyoung.substack.com/feed',           name: 'Molly Young',     types: ['cross'], kind: 'substack' },
  { url: 'https://pattismith.substack.com/feed',           name: 'Patti Smith',     types: ['cross'], kind: 'substack' },
  { url: 'https://www.themarginalian.org/feed/',           name: 'The Marginalian', types: ['cross'], kind: 'rss'      },
  { url: 'https://www.theguardian.com/culture/rss',        name: 'The Guardian',    types: ['cross'], kind: 'rss'      },
  { url: 'https://www.theatlantic.com/feed/all/',          name: 'The Atlantic',    types: ['cross'], kind: 'rss'      },
  { url: 'https://www.newyorker.com/feed/everything',      name: 'The New Yorker',  types: ['cross'], kind: 'rss'      },
]

function feedsForType(type: string, custom: FeedEntry[]): FeedEntry[] {
  const all = [...DEFAULT_FEEDS, ...custom]
  if (type === 'all') {
    const substacks = all.filter(f => f.kind === 'substack')
    const rest = all.filter(f => f.kind !== 'substack')
    return [...substacks, ...rest].slice(0, 20)
  }
  return all.filter(f => f.types.includes(type as FeedType) || f.types.includes('cross'))
}

// ── XML parsing ────────────────────────────────────────────────────────────────

function unCdata(s: string): string {
  const m = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  return m ? m[1] : s
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function getTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i')
  const m = xml.match(re)
  return m ? unCdata(m[1]).trim() : ''
}

function getAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, 'i')
  const m = xml.match(re)
  return m ? m[1] : ''
}

interface Post { title: string; content: string; source: string }

function parseFeed(xml: string, source: string): Post[] {
  const posts: Post[] = []

  // RSS <item> blocks
  const itemRe = /<item>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) !== null && posts.length < 6) {
    const chunk = m[1]
    const title = stripHtml(getTag(chunk, 'title'))
    const body = stripHtml(
      getTag(chunk, 'content:encoded') || getTag(chunk, 'description') || getTag(chunk, 'summary')
    ).slice(0, 400)
    if (title.length > 3) posts.push({ title, content: body, source })
  }

  // Atom <entry> blocks (Reddit uses Atom)
  if (posts.length === 0) {
    const entryRe = /<entry>([\s\S]*?)<\/entry>/gi
    while ((m = entryRe.exec(xml)) !== null && posts.length < 6) {
      const chunk = m[1]
      const title = stripHtml(getTag(chunk, 'title'))
      const body = stripHtml(
        getTag(chunk, 'content') || getTag(chunk, 'summary')
      ).slice(0, 400)
      const link = getAttr(chunk, 'link', 'href') || getTag(chunk, 'link')
      if (title.length > 3) posts.push({ title, content: body || link, source })
    }
  }

  return posts
}

async function fetchFeed(entry: FeedEntry): Promise<Post[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(entry.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'nospaces/1.0 (taste library; contact: farahmokhtar94@gmail.com)' },
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseFeed(xml, entry.name)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!await requireAuth(req)) return res.status(401).end()

  const {
    mode = 'intaste',
    type = 'all',
    tasteProfile,
    libraryItems = [],
    customFeeds = [],
  } = req.body as {
    mode?: 'intaste' | 'divert'
    type?: string
    tasteProfile?: string
    libraryItems?: { title: string; type: string }[]
    customFeeds?: FeedEntry[]
  }

  if (!tasteProfile) return res.status(400).json({ error: 'no taste profile — generate one on the taste page first' })

  // Fetch all relevant feeds in parallel
  const feeds = feedsForType(type, customFeeds)
  const results = await Promise.allSettled(feeds.map(f => fetchFeed(f)))
  const posts: Post[] = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])

  if (posts.length === 0) {
    return res.status(200).json({ recommendations: [], warning: 'all feeds failed to load' })
  }

  // Build library exclusion list
  const libraryList = libraryItems
    .map(i => `${i.title} (${i.type})`)
    .join('\n') || '(none yet)'

  // Build feed content block
  const feedBlock = posts
    .map(p => `[${p.source}] ${p.title}${p.content ? ' — ' + p.content : ''}`)
    .join('\n')

  const prompt = mode === 'divert'
    ? `You are a taste-matched media recommendation engine in DIVERT mode.

The feeds below show what's currently being discussed in this person's trusted sources — use them as cultural context only. Your job is NOT to recommend the obvious picks from these feeds. Instead, draw primarily from your own knowledge of the broader cultural landscape to find works that are genuinely unexpected: different eras, geographies, forms, or corners of culture they probably haven't encountered through their usual reading.

TASTE PROFILE:
${tasteProfile}

ALREADY IN THEIR LIBRARY — do not recommend these:
${libraryList}

CULTURAL CONTEXT (for inspiration, not as the source of your picks):
${feedBlock}

Find 8–10 recommendations that push beyond this person's established patterns. Any type is fine. For each, write a "why" that does TWO things in 2–3 sentences:
1. Lead with what's DIFFERENT or unexpected — name the departure explicitly ("this is further from your usual territory because...", "unlike what you typically go for...", "this will feel stranger than your usual picks because...")
2. Then explain why they'd still connect with it despite the departure — the thread back to their sensibility

The "why" should make someone feel productively unsettled, not just confirmed. Don't write it like an in-taste pick with the departure mentioned as an afterthought.

In "sources" put ["Claude's knowledge"] unless the feeds also happen to mention it.

Return ONLY valid JSON (no markdown, no preamble):
{
  "recommendations": [
    {
      "title": "...",
      "creator": "...",
      "type": "film|book|music|tv",
      "year": 2024,
      "why": "...",
      "sources": ["..."]
    }
  ]
}`
    : `You are a taste-matched media recommendation engine in IN-TASTE mode.

The feeds below show what this person's trusted sources are currently discussing — use them as cultural context to calibrate your recommendations. You may recommend works mentioned in the feeds AND works from your own knowledge that fit the taste profile. Feeds are signal, not a constraint.

TASTE PROFILE:
${tasteProfile}

ALREADY IN THEIR LIBRARY — do not recommend these:
${libraryList}

RECENT CONTENT FROM THEIR TRUSTED SOURCES:
${feedBlock}

Find 8–12 recommendations that feel like an immediate yes for this person. Any type is fine. For each:
- Explain in 1–2 sentences why it fits THIS person's specific taste, grounded in the profile
- If the feeds mention it, list the relevant sources. If it comes from your knowledge alone, use ["Claude's knowledge"]. If multiple sources discuss it, list all of them — corroboration is meaningful signal.

Return ONLY valid JSON (no markdown, no preamble):
{
  "recommendations": [
    {
      "title": "...",
      "creator": "...",
      "type": "film|book|music|tv",
      "year": 2024,
      "why": "...",
      "sources": ["Pandora Sykes", "r/booksuggestions"]
    }
  ]
}`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    const recommendations: DiscoveryResult[] = (parsed.recommendations ?? [])
      .filter((r: Record<string, unknown>) => r?.title && r?.type && ['film','book','music','tv'].includes(r.type as string))
      .map((r: Record<string, unknown>) => ({
        ...r,
        // Normalise: model may return source (string) instead of sources (array)
        sources: Array.isArray(r['sources']) ? r['sources'] : r['source'] ? [r['source']] : ['Claude\'s knowledge'],
      })) as DiscoveryResult[]

    return res.status(200).json({ recommendations })
  } catch (err) {
    console.error('[recommend-feeds]', err instanceof Error ? err.message : err)
    return res.status(500).json({ error: 'failed to generate recommendations' })
  }
}
