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
            <span style={{ color: isLead ? INK : GRAPHITE }}>{s.label}</span>
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

interface EraBucket { decade: number; label: string; rate: number; rep: Item }

const ERA_MIN_RATED = 4 // n-floor: ignore decades too thin to read anything into
const TILE_SIZE = 50   // all tiles square — works for music (natively square) and film/book (center-crop)

// Derives peak decade per medium and cross-medium buckets from the same pass.
function computeEraData(items: Item[]) {
  const byDecade = new Map<number, Item[]>()
  const byTypeDecade = new Map<string, Map<number, { rated: number; loved: number }>>()

  for (const i of items) {
    if (i.status !== 'done' || !i.reaction) continue
    if (!i.year || i.year < 1900) continue
    const decade = Math.floor(i.year / 10) * 10

    // Cross-medium buckets
    const arr = byDecade.get(decade) ?? []
    arr.push(i)
    byDecade.set(decade, arr)

    // Per-medium
    if (!byTypeDecade.has(i.type)) byTypeDecade.set(i.type, new Map())
    const td = byTypeDecade.get(i.type)!
    const e = td.get(decade) ?? { rated: 0, loved: 0 }
    e.rated++
    if (i.reaction === 'loved_it') e.loved++
    td.set(decade, e)
  }

  const hasCover = (i: Item) => !!(i.metadata?.coverUrl || i.metadata?.wikiThumb)
  const pickRep = (arr: Item[]) => [...arr]
    .filter(i => i.reaction === 'loved_it')
    .sort((a, b) => {
      if (hasCover(a) !== hasCover(b)) return hasCover(a) ? -1 : 1
      return (b.year ?? 0) - (a.year ?? 0)
    })[0]

  const buckets: EraBucket[] = Array.from(byDecade.entries())
    .map(([decade, arr]) => {
      const loved = arr.filter(i => i.reaction === 'loved_it').length
      return { decade, rated: arr.length, loved, rep: pickRep(arr) }
    })
    .filter(b => b.rated >= ERA_MIN_RATED && b.loved >= 1 && b.rep)
    .map(b => ({ decade: b.decade, label: `${b.decade}s`, rate: b.loved / b.rated, rep: b.rep! }))
    .sort((a, b) => a.decade - b.decade)

  // Per-medium peak: the decade where you loved the highest share of what you saw.
  const mediumPeaks: { type: string; typeLabel: string; decade: number }[] = []
  for (const type of ['film', 'book', 'music', 'tv']) {
    const td = byTypeDecade.get(type)
    if (!td) continue
    const qualified = Array.from(td.entries())
      .filter(([, v]) => v.rated >= ERA_MIN_RATED && v.loved >= 1)
      .map(([decade, v]) => ({ decade, rate: v.loved / v.rated }))
      .sort((a, b) => b.rate - a.rate)
    if (qualified.length) mediumPeaks.push({ type, typeLabel: TYPE_LABEL[type] ?? type, decade: qualified[0].decade })
  }

  return { buckets, mediumPeaks }
}

// Era map — its own section below the prose. Shows the actual finding as a
// typographic insight line (per-medium peak decades), then the visual strip
// of emblematic covers with a love-rate bar for the shape. All tiles square
// so music (natively square) looks correct and film/book crops cleanly.
function EraMap({ items }: { items: Item[] }) {
  const { buckets, mediumPeaks } = useMemo(() => computeEraData(items), [items])

  if (buckets.length < 2) return null
  const maxRate = Math.max(...buckets.map(b => b.rate))

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: MUTE, marginBottom: 10 }}>
        by era
      </div>

      {/* Insight line — the actual finding, stated plainly */}
      {mediumPeaks.length > 0 && (
        <div style={{ fontSize: 13, lineHeight: 1.7, color: GRAPHITE, marginBottom: 14, letterSpacing: '-0.1px' }}>
          {mediumPeaks.map((p, i) => (
            <span key={p.type}>
              {i > 0 && <span style={{ color: MUTE }}> · </span>}
              <span>{p.typeLabel}: </span>
              <span style={{ color: INK, fontWeight: 600 }}>{p.decade}s</span>
            </span>
          ))}
        </div>
      )}

      {/* Visual strip — cover emblem per decade, love-rate bar for shape */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
        {buckets.map(b => {
          const isPeak = b.rate === maxRate
          return (
            <div key={b.decade} style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: TILE_SIZE }}>
              <CoverTile item={b.rep} width={TILE_SIZE} height={TILE_SIZE} />
              <div style={{ width: '100%', height: 3, background: HAIR, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round((b.rate / maxRate) * 100)}%`, height: '100%', background: isPeak ? INK : GRAPHITE }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: isPeak ? 700 : 400, color: isPeak ? INK : GRAPHITE, letterSpacing: '-0.1px' }}>{b.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const STAT_MIN_RATED = 5 // below this, a loved-% is just noise — show the count alone

// Per-medium section — title + stats, dissolved into hairline-ruled rows (no boxes).
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

    const canon = items.filter(i => i.type === type && !!i.metadata?.canon)

    return { genres, creators, ratedCount: rated.length, lovedPct, canon }
  }, [items, type])

  const { genres, creators, ratedCount, lovedPct, canon } = data
  if (ratedCount === 0 && canon.length === 0) return null

  return (
    <div style={{ borderTop: `1px solid ${HAIR}`, padding: '14px 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: INK }}>
          {TYPE_LABEL[type] ?? type}
        </span>
        <span style={{ fontSize: 11, color: MUTE }}>
          {ratedCount} rated{ratedCount >= STAT_MIN_RATED ? ` · ${lovedPct}% loved` : ''}
        </span>
      </div>
      {canon.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: MUTE, marginBottom: 8 }}>
            ◆ canon
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            {canon.map(item => {
              const tileH = type === 'music' ? TILE_SIZE : Math.round(TILE_SIZE * 1.5)
              return (
              <div key={item.id} style={{ flex: '0 0 auto', width: TILE_SIZE, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <CoverTile item={item} width={TILE_SIZE} height={tileH} />
                <div style={{ fontSize: 9, color: GRAPHITE, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                  {item.title}
                </div>
              </div>
            )})}

          </div>
        </div>
      )}
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
    <div style={{ padding: '20px 20px calc(80px + env(safe-area-inset-bottom))', background: '#fff', minHeight: '100dvh', color: INK }}>
      <h1 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 20px', color: INK }}>taste</h1>
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: INK, marginBottom: 6 }}>nothing to show yet</div>
        <div style={{ fontSize: 13, color: GRAPHITE, lineHeight: 1.6 }}>mark items as done and add reactions — your taste profile builds up here.</div>
      </div>
    </div>
  )


  return (
    <div style={{ padding: '20px 20px calc(80px + env(safe-area-inset-bottom))', background: '#fff', minHeight: '100dvh', color: INK }}>
      <h1 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 14px', color: INK }}>taste</h1>

      {/* Hero header — vibes chips + prose */}
      <div style={{ borderBottom: `1.5px solid ${INK}`, paddingBottom: 18, marginBottom: 16 }}>
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
                      <div key={i} style={{ display: 'flex', gap: 9, marginBottom: isLast ? 0 : 7 }}>
                        <span style={{ color: MUTE, flexShrink: 0, lineHeight: 1.6, fontWeight: 700 }}>·</span>
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

      {/* Era map — own section, below prose, above medium cards */}
      <div style={{ borderBottom: `1.5px solid ${INK}`, paddingBottom: 20, marginBottom: 16 }}>
        <EraMap items={items} />
      </div>

      {/* Section bridge */}
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: MUTE, marginBottom: 10 }}>
        by medium
      </div>

      {/* PER CATEGORY — hairline-ruled sections. tv last. */}
      {(['film', 'book', 'music', 'tv'] as const).map(type => (
        <CategoryCard key={type} items={items} type={type} />
      ))}

    </div>
  )
}
