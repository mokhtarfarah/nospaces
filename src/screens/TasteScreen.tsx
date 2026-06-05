import { useMemo, useState, type ReactNode } from 'react'
import { useItems } from '../hooks/useItems'
import { usePrefs } from '../hooks/usePrefs'
import type { Item, ItemReaction } from '../lib/database.types'
import { VIBES, VERDICTS } from '../lib/moods'
import { isGenreTag } from '../lib/genres'
import { authHeaders } from '../lib/supabase'
import { useArtwork } from '../lib/artwork'

const INK = '#1C1B19'
const GRAPHITE = '#6F6B64'
const MUTE = '#ABA69C'
const HAIR = '#ECEAE6'

const WEIGHTS: Record<ItemReaction, number> = {
  loved_it: 2, liked_it: 1, eh: 0, not_for_me: -1,
}

const TYPE_LABEL: Record<string, string> = {
  film: 'films', book: 'books', music: 'music', tv: 'tv',
}

const REACTION_LABEL: Record<string, string> = {
  loved_it: 'loved it',
  liked_it: 'liked it',
  eh: 'eh',
  not_for_me: 'not for me',
}

interface Scored { label: string; score: number; count: number }

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

function inlineItalics(text: string) {
  const parts = text.split(/\*([^*]+)\*/)
  return parts.map((part, i) => i % 2 === 1 ? <em key={i}>{part}</em> : part)
}

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

// Top genre+vibe tags by frequency within a single reaction bucket.
function topTagsByFreq(items: Item[], limit: number): string[] {
  const map = new Map<string, number>()
  for (const item of items) {
    for (const tag of item.tags ?? []) {
      if (isGenreTag(tag)) map.set(tag, (map.get(tag) ?? 0) + 1)
    }
    for (const mood of item.moods ?? []) {
      if (VIBES.includes(mood)) map.set(mood, (map.get(mood) ?? 0) + 1)
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label)
}

// 0 = all easy, 1 = all demanding. null if < 3 tagged items.
function computeEffort(items: Item[]): number | null {
  let easy = 0, demanding = 0
  for (const item of items) {
    for (const mood of item.moods ?? []) {
      if (mood === 'easy') easy++
      if (mood === 'demanding' || mood === 'dense') demanding++
    }
  }
  if (easy + demanding < 3) return null
  return demanding / (easy + demanding)
}

type MediumFilter = 'all' | 'film' | 'book' | 'music' | 'tv'

const STAT_MIN_RATED = 5

function StatsSection({ items }: { items: Item[] }) {
  const [selected, setSelected] = useState<MediumFilter>('all')

  const filtered = useMemo(
    () => selected === 'all' ? items : items.filter(i => i.type === selected),
    [items, selected]
  )

  const lovedPct = filtered.length
    ? Math.round(filtered.filter(i => i.reaction === 'loved_it').length / filtered.length * 100)
    : 0

  const reactionBreakdown = useMemo(() =>
    (['loved_it', 'liked_it', 'eh', 'not_for_me'] as const)
      .map(reaction => ({
        reaction,
        count: filtered.filter(i => i.reaction === reaction).length,
        tags: topTagsByFreq(filtered.filter(i => i.reaction === reaction), 6),
      }))
      .filter(r => r.count >= 2 && r.tags.length > 0),
    [filtered]
  )

  const verdicts = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of filtered) {
      for (const mood of item.moods ?? []) {
        if (VERDICTS.includes(mood)) map.set(mood, (map.get(mood) ?? 0) + 1)
      }
    }
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, score: count, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [filtered])

  const effortScore = useMemo(() => {
    const signal = filtered.filter(i => i.reaction === 'loved_it' || i.reaction === 'liked_it')
    return computeEffort(signal)
  }, [filtered])

  const availableTypes = useMemo(() => {
    const types = new Set(items.map(i => i.type))
    return (['film', 'book', 'music', 'tv'] as const).filter(t => types.has(t))
  }, [items])

  return (
    <div style={{ borderBottom: `1.5px solid ${INK}`, paddingBottom: 20, marginBottom: 16 }}>
      {/* Medium filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['all', ...availableTypes] as MediumFilter[]).map(t => (
          <button
            key={t}
            onClick={() => setSelected(t)}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: 11, fontWeight: selected === t ? 700 : 400,
              color: selected === t ? INK : MUTE,
              fontFamily: 'inherit',
            }}
          >
            {t === 'all' ? 'all' : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Lede */}
      {filtered.length > 0 && (
        <div style={{ fontSize: 13, color: GRAPHITE, marginBottom: 16, letterSpacing: '-0.1px' }}>
          <span style={{ color: INK, fontWeight: 600 }}>{filtered.length}</span> things
          {filtered.length >= STAT_MIN_RATED && (
            <> · <span style={{ color: INK, fontWeight: 600 }}>{lovedPct}%</span> loved</>
          )}
        </div>
      )}

      {/* Reaction breakdown */}
      {reactionBreakdown.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: MUTE, marginBottom: 10 }}>
            what you reach for
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reactionBreakdown.map(({ reaction, tags }) => (
              <div key={reaction} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span style={{ fontSize: 11, color: MUTE, minWidth: 72, flexShrink: 0, lineHeight: 1.6 }}>
                  {REACTION_LABEL[reaction]}
                </span>
                <span style={{ fontSize: 13, color: GRAPHITE, lineHeight: 1.6, letterSpacing: '-0.1px' }}>
                  {tags.map((tag, i) => (
                    <span key={tag}>
                      {i > 0 && <span style={{ color: MUTE }}> · </span>}
                      {tag}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verdict tendencies */}
      {verdicts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: MUTE, marginBottom: 8 }}>
            verdicts
          </div>
          <div style={{ fontSize: 13, color: GRAPHITE, lineHeight: 1.6, letterSpacing: '-0.1px' }}>
            {verdicts.map((v, i) => (
              <span key={v.label}>
                {i > 0 && <span style={{ color: MUTE }}> · </span>}
                {v.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Effort axis */}
      {effortScore !== null && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: MUTE, marginBottom: 10 }}>
            effort
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: effortScore < 0.4 ? INK : MUTE, fontWeight: effortScore < 0.4 ? 600 : 400, flexShrink: 0 }}>easy</span>
            <div style={{ flex: 1, height: 3, background: HAIR, borderRadius: 2, position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: `${Math.round(effortScore * 100)}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 8, height: 8, borderRadius: '50%',
                background: INK,
              }} />
            </div>
            <span style={{ fontSize: 11, color: effortScore > 0.6 ? INK : MUTE, fontWeight: effortScore > 0.6 ? 600 : 400, flexShrink: 0 }}>demanding</span>
          </div>
        </div>
      )}
    </div>
  )
}

const TILE_SIZE = 50

function CategoryCard({ items, type }: { items: Item[]; type: string }) {
  const [expanded, setExpanded] = useState(false)

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
    const lovedPct = rated.length
      ? Math.round(rated.filter(i => i.reaction === 'loved_it').length / rated.length * 100)
      : 0
    const canon = items.filter(i => i.type === type && !!i.metadata?.canon)

    return { genres, creators, ratedCount: rated.length, lovedPct, canon }
  }, [items, type])

  const { genres, creators, ratedCount, lovedPct, canon } = data
  if (ratedCount === 0 && canon.length === 0) return null

  return (
    <div style={{ borderTop: `1px solid ${HAIR}` }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'baseline', gap: 8, width: '100%',
          padding: '13px 0 11px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: INK }}>
          {TYPE_LABEL[type] ?? type}
        </span>
        <span style={{ fontSize: 11, color: MUTE, flex: 1 }}>
          {ratedCount} rated
          {ratedCount >= STAT_MIN_RATED ? ` · ${lovedPct}% loved` : ''}
          {canon.length > 0 ? ` · ${canon.length} canon` : ''}
        </span>
        <span style={{ fontSize: 10, color: MUTE }}>{expanded ? '▴' : '▾'}</span>
      </button>

      {expanded && (
        <div style={{ paddingBottom: 16 }}>
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
                  )
                })}
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

  const doneWithReaction = useMemo(() => items.filter(i => i.status === 'done' && i.reaction), [items])

  const moodScores = useMemo(() => scoreTags(items, 'moods'), [items])
  const topVibes = moodScores.filter(s => VIBES.includes(s.label) && s.score >= 0)
  const lowVibes = moodScores.filter(s => VIBES.includes(s.label) && s.score < 0)

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

      {/* ① Identity — vibe ranked line + AI prose */}
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

      {/* ② Stats — lede · reaction breakdown · verdict tendencies · effort axis */}
      <StatsSection items={doneWithReaction} />

      {/* ③ By medium — collapsible */}
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: MUTE, margin: '4px 0 2px' }}>
        by medium
      </div>
      {(['film', 'book', 'music', 'tv'] as const).map(type => (
        <CategoryCard key={type} items={items} type={type} />
      ))}
    </div>
  )
}
