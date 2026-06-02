import { useMemo, useState } from 'react'
import { useItems } from '../hooks/useItems'
import type { Item, ItemReaction } from '../lib/database.types'

const WEIGHTS: Record<ItemReaction, number> = {
  loved_it: 2, liked_it: 1, eh: 0, not_for_me: -1,
}

const TYPE_LABEL: Record<string, string> = {
  film: 'films', book: 'books', music: 'music', tv: 'tv',
}

const REACTION_LABEL: Record<ItemReaction, string> = {
  loved_it: 'loved it', liked_it: 'liked it', eh: 'eh', not_for_me: 'not for me',
}

const REACTION_ORDER: ItemReaction[] = ['loved_it', 'liked_it', 'eh', 'not_for_me']

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

// Chips ranked by score. Positive = dark; top score = filled black.
function RankedChips({ scored }: { scored: Scored[] }) {
  if (!scored.length) return null
  const max = scored[0].score
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {scored.map((s, i) => {
        // Top item gets filled black. Rest scale from dark-outlined to light based on rank.
        const isTop = i === 0 && s.score > 0
        const strength = max > 0 ? s.score / max : 0
        const textColor = isTop ? '#fff' : strength > 0.5 ? '#222' : strength > 0 ? '#555' : '#AAA'
        const bg = isTop ? '#111' : '#fff'
        const border = isTop ? '#111' : strength > 0.5 ? '#555' : strength > 0 ? '#CCC' : '#E8E8E8'
        return (
          <span key={s.label} style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 12,
            background: bg, color: textColor,
            border: `1.5px solid ${border}`,
            fontWeight: isTop ? 600 : 400,
          }}>
            {s.label}
          </span>
        )
      })}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: '#F0F0F0', margin: '24px 0' }} />
}

function ReactionBar({ items, type }: { items: Item[]; type: string }) {
  const done = items.filter(i => i.type === type && i.status === 'done' && i.reaction)
  if (!done.length) return null
  const counts = Object.fromEntries(REACTION_ORDER.map(r => [r, done.filter(i => i.reaction === r).length]))
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#222' }}>{TYPE_LABEL[type] ?? type}</span>
        <span style={{ fontSize: 11, color: '#BBB' }}>{done.length} rated</span>
      </div>
      <div style={{ display: 'flex', gap: 2, borderRadius: 3, overflow: 'hidden', height: 5 }}>
        {REACTION_ORDER.map(r => {
          const pct = counts[r] / done.length * 100
          if (!pct) return null
          const bg = r === 'loved_it' ? '#111' : r === 'liked_it' ? '#777' : r === 'eh' ? '#DDD' : '#F0F0F0'
          return <div key={r} style={{ width: `${pct}%`, background: bg }} />
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
        {REACTION_ORDER.filter(r => counts[r]).map(r => (
          <span key={r} style={{ fontSize: 10, color: '#BBB' }}>{counts[r]} {REACTION_LABEL[r]}</span>
        ))}
      </div>
    </div>
  )
}

export function TasteScreen() {
  const { items, loading } = useItems()
  const [showNegative, setShowNegative] = useState(false)

  const doneWithReaction = useMemo(() => items.filter(i => i.status === 'done' && i.reaction), [items])

  // Genres per type
  const genresByType = useMemo(() => {
    return (['film', 'tv', 'book', 'music'] as const)
      .map(type => ({ type, scored: scoreTags(items, 'tags', type) }))
      .filter(({ scored }) => scored.length > 0)
  }, [items])

  // Moods cross-type (moods are personal, not media-type-specific)
  const moodScores = useMemo(() => scoreTags(items, 'moods'), [items])
  const topMoods = moodScores.filter(s => s.score >= 0)
  const lowMoods = moodScores.filter(s => s.score < 0)

  // "What doesn't land" — genres with negative scores, per type
  const lowGenresByType = useMemo(() => {
    return (['film', 'tv', 'book', 'music'] as const)
      .map(type => ({ type, scored: scoreTags(items, 'tags', type).filter(s => s.score < 0) }))
      .filter(({ scored }) => scored.length > 0)
  }, [items])

  const ratedTypes = useMemo(() =>
    ['film', 'tv', 'book', 'music'].filter(t => doneWithReaction.some(i => i.type === t)),
    [doneWithReaction],
  )

  const hasNegative = lowGenresByType.length > 0 || lowMoods.length > 0

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
      <div style={{ width: 20, height: 20, border: '2px solid #111', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!doneWithReaction.length) return (
    <div style={{ padding: '56px 20px 100px', background: '#fff', minHeight: '100dvh' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 28px', letterSpacing: '-0.2px' }}>taste</h1>
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#222', marginBottom: 6 }}>nothing to show yet</div>
        <div style={{ fontSize: 13, color: '#999', lineHeight: 1.6 }}>mark items as done and add reactions — your taste profile builds up here.</div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '56px 20px 100px', background: '#fff', minHeight: '100dvh' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 32px', letterSpacing: '-0.2px' }}>taste</h1>

      {/* Genres — split by type */}
      {genresByType.length > 0 ? (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEAE', letterSpacing: '0.9px', textTransform: 'uppercase', marginBottom: 18 }}>
            genres
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {genresByType.map(({ type, scored }) => (
              <div key={type}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#BBBBBB', marginBottom: 8 }}>{TYPE_LABEL[type]}</div>
                <RankedChips scored={scored.filter(s => s.score >= 0)} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEAE', letterSpacing: '0.9px', textTransform: 'uppercase', marginBottom: 10 }}>genres</div>
          <p style={{ fontSize: 13, color: '#CCC', margin: 0 }}>genres will appear here as you add and rate new items.</p>
        </div>
      )}

      <Divider />

      {/* Moods — cross-type is fine, vibes don't belong to a medium */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEAE', letterSpacing: '0.9px', textTransform: 'uppercase', marginBottom: 14 }}>vibes</div>
        {topMoods.length > 0
          ? <RankedChips scored={topMoods} />
          : <p style={{ fontSize: 13, color: '#CCC', margin: 0 }}>tag vibes when you mark things done.</p>}
      </div>

      <Divider />

      {/* How you rate — reaction bar per type */}
      {ratedTypes.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEAE', letterSpacing: '0.9px', textTransform: 'uppercase', marginBottom: 14 }}>how you rate</div>
          {ratedTypes.map(t => <ReactionBar key={t} items={items} type={t} />)}
        </div>
      )}

      {/* What doesn't land — collapsible */}
      {hasNegative && (
        <>
          <Divider />
          <div>
            <button
              onClick={() => setShowNegative(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#CCC', padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <span style={{ fontSize: 9 }}>{showNegative ? '▾' : '▸'}</span>
              what doesn't land
            </button>
            {showNegative && (
              <div style={{ marginTop: 16 }}>
                {lowGenresByType.map(({ type, scored }) => (
                  <div key={type} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#DDDDDD', marginBottom: 8 }}>{TYPE_LABEL[type]}</div>
                    <RankedChips scored={scored} />
                  </div>
                ))}
                {lowMoods.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#DDDDDD', marginBottom: 8 }}>vibes</div>
                    <RankedChips scored={lowMoods} />
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
