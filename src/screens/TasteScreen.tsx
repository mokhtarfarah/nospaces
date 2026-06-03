import { useMemo, useState, type ReactNode } from 'react'
import { useItems } from '../hooks/useItems'
import { usePrefs } from '../hooks/usePrefs'
import type { Item, ItemReaction } from '../lib/database.types'
import { VIBES } from '../lib/moods'
import { isGenreTag } from '../lib/genres'
import { authHeaders } from '../lib/supabase'
import { useArtwork } from '../lib/artwork'

// Editorial palette — monochrome, warm ink on white. Low-contrast, print-like.
const INK = '#1C1B19'      // primary text / lead term
const GRAPHITE = '#6F6B64' // secondary text / non-lead terms
const MUTE = '#ABA69C'     // tertiary — captions, separators, counts
const HAIR = '#ECEAE6'     // hairline rules

const WEIGHTS: Record<ItemReaction, number> = {
  loved_it: 2, liked_it: 1, eh: 0, not_for_me: -1,
}

const TYPE_LABEL: Record<string, string> = {
  film: 'films', book: 'books', music: 'music', tv: 'tv',
}


interface Scored { label: string; score: number; count: number }

// Score tags/moods across all done+reacted items, optionally filtered to a type.
function scoreTags(items: Item[], field: 'tags' | 'moods', type?: string): Scored[] {
  const map = new Map<string, { score: number; count: number }>()
  for (const item of items) {
    if (item.status !== 'done' || !item.reaction) continue
    if (type && item.type !== type) continue
    const w = WEIGHTS[item.reaction]
    for (const tag of (item[field] ?? [])) {
      const e = map.get(tag) ?? { score: 0, count: 0 }
      map.set(tag, { score: e.score + w, count: e.count + 1 })
    }
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.count >= 1)
    .map(([label, v]) => ({ label, score: v.score, count: v.count }))
    .sort((a, b) => b.score - a.score)
}

// Renders inline *text* → <em> for media titles.
function inlineItalics(text: string) {
  const parts = text.split(/\*([^*]+)\*/)
  return parts.map((part, i) => i % 2 === 1 ? <em key={i}>{part}</em> : part)
}

// Consistent inline text link used throughout the taste page.
function TextLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{ background: 'none', border: 'none', fontSize: 11, color: MUTE, cursor: 'pointer', padding: '0 0 0 5px', textDecoration: 'underline', verticalAlign: 'baseline', fontFamily: 'inherit' }}
    >
      {children}
    </button>
  )
}


// Ranked tags as a flowing typographic line (editorial, no pills). The lead
// term is emphasized in ink; the rest are graphite, middot-separated. Order
// carries the ranking. `limit` drops the low-signal tail.
function RankedLine({ scored, limit }: { scored: Scored[]; limit?: number }) {
  if (!scored.length) return null
  const shown = limit ? scored.slice(0, limit) : scored
  return (
    <div style={{ fontSize: 14, lineHeight: 1.85, color: GRAPHITE, letterSpacing: '-0.1px' }}>
      {shown.map((s, i) => {
        const isLead = i === 0 && s.score > 0
        return (
          <span key={s.label}>
            {i > 0 && <span style={{ color: MUTE }}> · </span>}
            <span style={{ color: isLead ? INK : GRAPHITE, fontWeight: isLead ? 600 : 400 }}>{s.label}</span>
          </span>
        )
      })}
    </div>
  )
}




// One cover tile. Resolves art the same way the library does
// (useArtwork → stored wiki thumb → lowercase type-word placeholder, no emoji).
function CoverTile({ item, width, height }: { item: Item; width: number; height: number }) {
  const stored = (item.metadata?.coverUrl as string | null) ?? (item.metadata?.wikiThumb as string | null) ?? null
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, item.metadata?.coverUrl as string | null)
  const src = artwork ?? stored
  return (
    <div
      title={item.title}
      style={{
        width, height, borderRadius: 3, overflow: 'hidden',
        border: `1px solid ${HAIR}`, background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {src
        ? <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: 9, color: MUTE, textAlign: 'center', padding: '0 3px', lineHeight: 1.3 }}>{TYPE_LABEL[item.type] ?? item.type}</span>}
    </div>
  )
}

interface EraBucket { decade: number; label: string; count: number; rep: Item }

// Era map — where your taste lives in time. One column per decade (chronological),
// each fronted by the cover of your most-loved item from that era, with a count
// + density bar so the clusters read at a glance. Covers carry meaning (the
// emblem of each decade), not decoration.
function EraMap({ items }: { items: Item[] }) {
  const buckets = useMemo<EraBucket[]>(() => {
    const byDecade = new Map<number, Item[]>()
    for (const i of items) {
      if (i.status !== 'done' || (i.reaction !== 'loved_it' && i.reaction !== 'liked_it')) continue
      if (!i.year || i.year < 1900) continue
      const decade = Math.floor(i.year / 10) * 10
      const arr = byDecade.get(decade) ?? []
      arr.push(i)
      byDecade.set(decade, arr)
    }
    const hasCover = (i: Item) => !!(i.metadata?.coverUrl || i.metadata?.wikiThumb)
    // Representative per decade: loved over liked, then a stored cover, then most recent.
    const pickRep = (arr: Item[]) => [...arr].sort((a, b) => {
      const ra = a.reaction === 'loved_it' ? 1 : 0, rb = b.reaction === 'loved_it' ? 1 : 0
      if (ra !== rb) return rb - ra
      if (hasCover(a) !== hasCover(b)) return hasCover(a) ? -1 : 1
      return (b.year ?? 0) - (a.year ?? 0)
    })[0]
    return Array.from(byDecade.entries())
      .map(([decade, arr]) => ({
        decade,
        label: `'${String(decade % 100).padStart(2, '0')}s`,
        count: arr.length,
        rep: pickRep(arr),
      }))
      .sort((a, b) => a.decade - b.decade)
  }, [items])

  if (buckets.length < 2) return null
  const maxCount = Math.max(...buckets.map(b => b.count))

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: MUTE, marginBottom: 8 }}>
        where your taste lives
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
        {buckets.map(b => {
          const isPeak = b.count === maxCount
          return (
            <div key={b.decade} style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 46 }}>
              <CoverTile item={b.rep} width={46} height={68} />
              {/* density bar — taller where more of your taste sits */}
              <div style={{ width: '100%', height: 3, background: HAIR, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round((b.count / maxCount) * 100)}%`, height: '100%', background: isPeak ? INK : GRAPHITE }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 11, fontWeight: isPeak ? 700 : 500, color: isPeak ? INK : GRAPHITE }}>{b.label}</span>
                <span style={{ fontSize: 9, color: MUTE }}>{b.count}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Compact bordered card per medium — title + stats on header line, no sublabels.
function CategoryCard({ items, type }: { items: Item[]; type: string }) {
  const data = useMemo(() => {
    const genresScored = scoreTags(items, 'tags', type).filter(s => isGenreTag(s.label))
    const genres = genresScored.filter(s => s.score >= 0).slice(0, 5)

    const creatorMap = new Map<string, { score: number; count: number }>()
    for (const i of items) {
      if (i.type !== type || i.status !== 'done' || !i.reaction || !i.creator) continue
      const w = WEIGHTS[i.reaction]
      const e = creatorMap.get(i.creator) ?? { score: 0, count: 0 }
      creatorMap.set(i.creator, { score: e.score + w, count: e.count + 1 })
    }
    const creators = Array.from(creatorMap.entries())
      .filter(([, v]) => v.count >= 2)
      .map(([label, v]) => ({ label, score: v.score, count: v.count }))
      .sort((a, b) => b.score - a.score || b.count - a.count)
      .slice(0, 5)

    const rated = items.filter(i => i.type === type && i.status === 'done' && i.reaction)
    const lovedPct = rated.length ? Math.round(rated.filter(i => i.reaction === 'loved_it').length / rated.length * 100) : 0
    return { genres, creators, ratedCount: rated.length, lovedPct }
  }, [items, type])

  const { genres, creators, ratedCount, lovedPct } = data
  if (ratedCount === 0) return null

  return (
    <div style={{ border: `1px solid ${HAIR}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: INK }}>
          {TYPE_LABEL[type] ?? type}
        </span>
        <span style={{ fontSize: 11, color: MUTE }}>
          {ratedCount} rated · {lovedPct}% loved
        </span>
      </div>
      {creators.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <RankedLine scored={creators} limit={5} />
        </div>
      )}
      {genres.length > 0 && (
        <RankedLine scored={genres} limit={5} />
      )}
    </div>
  )
}

export function TasteScreen() {
  const { items, loading } = useItems()
  const { tasteProfile, tasteProfileGeneratedAt, setTasteProfile } = usePrefs()
  const [generatingProfile, setGeneratingProfile] = useState(false)
  const [profileExpanded, setProfileExpanded] = useState(false)
  const [profileError, setProfileError] = useState('')

  async function generateProfile() {
    if (generatingProfile) return
    setGeneratingProfile(true)
    setProfileError('')
    try {
      const signal = items.filter(i => i.status === 'done' && (i.reaction === 'loved_it' || i.reaction === 'liked_it'))
      const res = await fetch('/api/taste-profile', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          items: signal.map(i => ({ title: i.title, creator: i.creator, type: i.type, reaction: i.reaction, note: i.note })),
          vibes: topVibes.slice(0, 8).map(v => v.label),
        }),
      })
      if (!res.ok) {
        console.error('[taste-profile] HTTP', res.status)
        setProfileError('couldn\'t regenerate — try again')
      } else {
        const { profile } = await res.json()
        if (profile) {
          await setTasteProfile(profile)
        } else {
          setProfileError('no profile returned — try again')
        }
      }
    } catch (err) {
      console.error('[taste-profile] error:', err instanceof Error ? err.message : err)
      setProfileError('couldn\'t regenerate — try again')
    }
    setGeneratingProfile(false)
  }

  const doneWithReaction = useMemo(() => items.filter(i => i.status === 'done' && i.reaction), [items])

  // Moods cross-type (moods are personal, not media-type-specific).
  const moodScores = useMemo(() => scoreTags(items, 'moods'), [items])
  const topVibes = moodScores.filter(s => VIBES.includes(s.label) && s.score >= 0)
  const lowVibes = moodScores.filter(s => VIBES.includes(s.label) && s.score < 0)

  // Cross-medium love rate — must be before early returns (Rules of Hooks).


  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
      <div style={{ width: 20, height: 20, border: '2px solid #111', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!doneWithReaction.length) return (
    <div style={{ padding: '56px 20px 100px', background: '#fff', minHeight: '100dvh', color: INK }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 28px', letterSpacing: '-0.2px', color: INK }}>taste</h1>
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: INK, marginBottom: 6 }}>nothing to show yet</div>
        <div style={{ fontSize: 13, color: GRAPHITE, lineHeight: 1.6 }}>mark items as done and add reactions — your taste profile builds up here.</div>
      </div>
    </div>
  )


  return (
    <div style={{ padding: '44px 20px 100px', background: '#fff', minHeight: '100dvh', color: INK }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 14px', letterSpacing: '-0.2px', color: INK }}>taste</h1>

      {/* Hero header — non-collapsible: era map + vibes chips + prose */}
      <div style={{ borderBottom: `1.5px solid ${INK}`, paddingBottom: 18, marginBottom: 16 }}>
        <EraMap items={items} />
        {topVibes.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <RankedLine scored={topVibes} limit={8} />
            {lowVibes.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 10, color: MUTE, marginRight: 4 }}>rarely lands</span>
                <RankedLine scored={lowVibes} limit={4} />
              </div>
            )}
          </div>
        )}

        {/* Prose */}
        {tasteProfile ? (() => {
          const lines = tasteProfile.split('\n').filter(l => l.trim())
          const opener = lines.find(l => !l.trimStart().startsWith('- ')) ?? ''
          const bullets = lines.filter(l => l.trimStart().startsWith('- '))
          return (
            <>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: GRAPHITE, marginBottom: 8, letterSpacing: '-0.1px' }}>
                {inlineItalics(opener)}
                {bullets.length > 0 && !profileExpanded && (
                  <TextLink onClick={() => setProfileExpanded(true)}>see more</TextLink>
                )}
              </div>
              {bullets.length > 0 && profileExpanded && (
                <div style={{ fontSize: 13, lineHeight: 1.6, color: GRAPHITE, marginBottom: 8, letterSpacing: '-0.1px' }}>
                  {bullets.map((line, i) => {
                    const isLast = i === bullets.length - 1
                    return (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: isLast ? 0 : 5 }}>
                        <span style={{ color: MUTE, flexShrink: 0, lineHeight: 1.6 }}>—</span>
                        <span>
                          {inlineItalics(line.replace(/^[\s-]+/, ''))}
                          {isLast && <TextLink onClick={() => setProfileExpanded(false)}>see less</TextLink>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                {tasteProfileGeneratedAt && (
                  <span style={{ fontSize: 11, color: MUTE }}>
                    {new Date(tasteProfileGeneratedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·
                  </span>
                )}
                <TextLink onClick={generateProfile}>
                  {generatingProfile ? 'generating…' : 'regenerate'}
                </TextLink>
              </div>
              {profileError && (
                <div style={{ fontSize: 11, color: '#C0392B', marginTop: 4 }}>{profileError}</div>
              )}
            </>
          )
        })() : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: GRAPHITE }}>ai taste profile</span>
              <button
                onClick={generateProfile}
                disabled={generatingProfile}
                style={{
                  padding: '7px 16px', borderRadius: 20, cursor: generatingProfile ? 'default' : 'pointer',
                  border: '1.5px solid #111', background: '#111',
                  color: '#fff', fontSize: 12, fontWeight: 600,
                  opacity: generatingProfile ? 0.5 : 1,
                }}
              >
                {generatingProfile ? 'generating…' : 'generate'}
              </button>
            </div>
            {profileError && (
              <div style={{ fontSize: 11, color: '#C0392B', marginTop: 6 }}>{profileError}</div>
            )}
          </>
        )}
      </div>

      {/* Section bridge */}
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: MUTE, marginBottom: 10 }}>
        by medium
      </div>

      {/* PER CATEGORY — compact bordered cards. tv last. */}
      {(['film', 'book', 'music', 'tv'] as const).map(type => (
        <CategoryCard key={type} items={items} type={type} />
      ))}

    </div>
  )
}
