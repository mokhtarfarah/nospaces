import { useMemo, useState } from 'react'
import { useItems } from '../hooks/useItems'
import type { Item, ItemReaction } from '../lib/database.types'

// Scoring: loved_it=+2, liked_it=+1, eh=0, not_for_me=-1
const WEIGHTS: Record<ItemReaction, number> = {
  loved_it: 2,
  liked_it: 1,
  eh: 0,
  not_for_me: -1,
}

const TYPE_LABEL: Record<string, string> = {
  film: 'films', book: 'books', music: 'music', tv: 'tv shows',
}

const REACTION_LABEL: Record<ItemReaction, string> = {
  loved_it: 'loved it', liked_it: 'liked it', eh: 'eh', not_for_me: 'not for me',
}

const REACTION_ORDER: ItemReaction[] = ['loved_it', 'liked_it', 'eh', 'not_for_me']

interface Scored { label: string; score: number; count: number }

function scoreByTag(items: Item[], field: 'tags' | 'moods'): Scored[] {
  const map = new Map<string, { score: number; count: number }>()
  for (const item of items) {
    if (item.status !== 'done' || !item.reaction) continue
    const w = WEIGHTS[item.reaction]
    for (const tag of (item[field] ?? [])) {
      const e = map.get(tag) ?? { score: 0, count: 0 }
      map.set(tag, { score: e.score + w, count: e.count + 1 })
    }
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.count >= 2)  // need at least 2 data points
    .map(([label, v]) => ({ label, score: v.score, count: v.count }))
    .sort((a, b) => b.score - a.score)
}

function ScoreBar({ scored, max }: { scored: Scored[]; max: number }) {
  if (!scored.length) return <p style={{ fontSize: 13, color: '#BBB' }}>not enough data yet</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {scored.map(s => {
        const pct = Math.round(Math.abs(s.score) / max * 100)
        const positive = s.score >= 0
        return (
          <div key={s.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 13, color: '#222', fontWeight: 500 }}>{s.label}</span>
              <span style={{ fontSize: 11, color: '#AAA' }}>{s.count} items</span>
            </div>
            <div style={{ background: '#F0F0F0', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                width: `${Math.max(pct, 4)}%`,
                background: positive ? '#111' : '#D0D0D0',
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEAE', letterSpacing: '0.9px', textTransform: 'uppercase', marginBottom: 14 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function ReactionRow({ items, type }: { items: Item[]; type: string }) {
  const done = items.filter(i => i.type === type && i.status === 'done' && i.reaction)
  if (!done.length) return null
  const counts = Object.fromEntries(REACTION_ORDER.map(r => [r, done.filter(i => i.reaction === r).length]))
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#444', marginBottom: 5 }}>{TYPE_LABEL[type] ?? type}</div>
      <div style={{ display: 'flex', gap: 2, borderRadius: 4, overflow: 'hidden', height: 8 }}>
        {REACTION_ORDER.map(r => {
          const pct = counts[r] / done.length * 100
          if (!pct) return null
          const bg = r === 'loved_it' ? '#111' : r === 'liked_it' ? '#555' : r === 'eh' ? '#CCC' : '#E8E8E8'
          return <div key={r} style={{ width: `${pct}%`, background: bg }} title={`${REACTION_LABEL[r]}: ${counts[r]}`} />
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        {REACTION_ORDER.filter(r => counts[r]).map(r => (
          <span key={r} style={{ fontSize: 10, color: '#999' }}>{counts[r]} {REACTION_LABEL[r]}</span>
        ))}
      </div>
    </div>
  )
}

export function TasteScreen() {
  const { items, loading } = useItems()
  const [showNegative, setShowNegative] = useState(false)

  const doneWithReaction = useMemo(() => items.filter(i => i.status === 'done' && i.reaction), [items])

  const genreScores = useMemo(() => scoreByTag(items, 'tags'), [items])
  const moodScores  = useMemo(() => scoreByTag(items, 'moods'), [items])

  const topGenres = genreScores.filter(s => s.score > 0)
  const lowGenres = genreScores.filter(s => s.score < 0)
  const topMoods  = moodScores.filter(s => s.score > 0)
  const lowMoods  = moodScores.filter(s => s.score < 0)

  const maxGenre = Math.max(...genreScores.map(s => Math.abs(s.score)), 1)
  const maxMood  = Math.max(...moodScores.map(s => Math.abs(s.score)), 1)

  const types = useMemo(() => {
    const seen = new Set<string>()
    items.filter(i => i.status === 'done' && i.reaction).forEach(i => seen.add(i.type))
    return ['film', 'tv', 'book', 'music'].filter(t => seen.has(t))
  }, [items])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
      <div style={{ width: 20, height: 20, border: '2px solid #111', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  const hasData = doneWithReaction.length > 0

  return (
    <div style={{ padding: '56px 20px 100px', background: '#fff', minHeight: '100dvh' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 28px', letterSpacing: '-0.2px' }}>taste</h1>

      {!hasData ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#222', marginBottom: 6 }}>nothing to show yet</div>
          <div style={{ fontSize: 13, color: '#999', lineHeight: 1.6 }}>
            mark items as done and add reactions — your taste profile will build up here.
          </div>
        </div>
      ) : (
        <>
          {/* Genres you gravitate toward */}
          <Section title="genres you gravitate toward">
            {topGenres.length
              ? <ScoreBar scored={topGenres} max={maxGenre} />
              : <p style={{ fontSize: 13, color: '#BBB' }}>not enough genre data yet — new items will auto-tag as you add them.</p>}
          </Section>

          {/* Moods */}
          <Section title="vibes that resonate">
            {topMoods.length
              ? <ScoreBar scored={topMoods} max={maxMood} />
              : <p style={{ fontSize: 13, color: '#BBB' }}>tag vibes when you mark things done — they'll show up here.</p>}
          </Section>

          {/* Reaction breakdown by type */}
          {types.length > 0 && (
            <Section title="how you rate">
              {types.map(t => <ReactionRow key={t} items={items} type={t} />)}
            </Section>
          )}

          {/* What doesn't land — collapsible */}
          {(lowGenres.length > 0 || lowMoods.length > 0) && (
            <Section title="">
              <button
                onClick={() => setShowNegative(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#AAA', padding: 0, display: 'flex', alignItems: 'center', gap: 4, marginBottom: showNegative ? 16 : 0 }}
              >
                <span style={{ fontSize: 10 }}>{showNegative ? '▾' : '▸'}</span>
                what doesn't land
              </button>
              {showNegative && (
                <>
                  {lowGenres.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#DDDDDD', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 10 }}>genres</div>
                      <ScoreBar scored={lowGenres} max={maxGenre} />
                    </div>
                  )}
                  {lowMoods.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#DDDDDD', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 10 }}>vibes</div>
                      <ScoreBar scored={lowMoods} max={maxMood} />
                    </div>
                  )}
                </>
              )}
            </Section>
          )}

          {/* Backfill nudge — shown if items have no genre tags yet */}
          {doneWithReaction.filter(i => i.tags?.length > 0).length === 0 && (
            <div style={{ marginTop: 8, padding: '12px 14px', background: '#F7F7F7', borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>
                your existing items don't have genre tags yet — new items will auto-tag as you add them. genre data will build up naturally over time.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
