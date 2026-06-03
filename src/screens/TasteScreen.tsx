import { useMemo, useState, useRef, type ReactNode } from 'react'
import { useItems } from '../hooks/useItems'
import { usePrefs } from '../hooks/usePrefs'
import type { Item, ItemReaction } from '../lib/database.types'
import { VIBES, VERDICTS } from '../lib/moods'
import { isGenreTag } from '../lib/genres'

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

// Collapsible section with the uppercase label header + chevron.
function Section({ title, defaultOpen = false, count, children }: {
  title: string; defaultOpen?: boolean; count?: number; children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: `1px solid ${HAIR}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', padding: '18px 0',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: INK, letterSpacing: '1px', textTransform: 'uppercase' }}>
          {title}{count != null && <span style={{ color: MUTE, fontWeight: 500 }}>  {count}</span>}
        </span>
        <span style={{ fontSize: 10, color: MUTE }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div style={{ paddingBottom: 26 }}>{children}</div>}
    </div>
  )
}

// How you rate, as a quiet typographic line: "88 loved · 41 liked · 9 eh".
function ReactionBar({ items, type }: { items: Item[]; type: string }) {
  const done = items.filter(i => i.type === type && i.status === 'done' && i.reaction)
  if (!done.length) return null
  const parts = REACTION_ORDER
    .map(r => ({ r, n: done.filter(i => i.reaction === r).length }))
    .filter(p => p.n > 0)
  return (
    <div style={{ fontSize: 13, color: GRAPHITE, letterSpacing: '0.2px' }}>
      {parts.map((p, i) => (
        <span key={p.r}>
          {i > 0 && <span style={{ color: MUTE }}> · </span>}
          <span style={{ color: INK, fontWeight: 500 }}>{p.n}</span> {REACTION_LABEL[p.r]}
        </span>
      ))}
    </div>
  )
}

// Small uppercase sub-label inside a category card.
function SubLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 600, color: GRAPHITE, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  )
}

// One collapsible card per medium — its whole taste profile in one place.
// Replaces the old per-insight sections (which repeated the type labels 3+ times).
function CategoryCard({ items, type }: { items: Item[]; type: string }) {
  const data = useMemo(() => {
    const genresScored = scoreTags(items, 'tags', type).filter(s => isGenreTag(s.label))
    const genres = genresScored.filter(s => s.score >= 0).slice(0, 6)
    const lowGenres = genresScored.filter(s => s.score < 0).slice(0, 6)

    // Era — positively-rated decades from `year`.
    const eraMap = new Map<string, { score: number; count: number }>()
    for (const i of items) {
      if (i.type !== type || i.status !== 'done' || !i.reaction || !i.year) continue
      const decade = `${Math.floor(i.year / 10) * 10}s`
      const w = WEIGHTS[i.reaction]
      const e = eraMap.get(decade) ?? { score: 0, count: 0 }
      eraMap.set(decade, { score: e.score + w, count: e.count + 1 })
    }
    const era = Array.from(eraMap.entries())
      .map(([label, v]) => ({ label, score: v.score, count: v.count }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)

    // Backlog — most-saved genres in want_to.
    const bMap = new Map<string, number>()
    items.filter(i => i.status === 'want_to' && i.type === type).forEach(i =>
      i.tags?.forEach(t => { if (isGenreTag(t)) bMap.set(t, (bMap.get(t) ?? 0) + 1) }))
    const backlog = Array.from(bMap.entries())
      .map(([label, count]) => ({ label, score: count, count }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)

    const ratedCount = items.filter(i => i.type === type && i.status === 'done' && i.reaction).length
    return { genres, lowGenres, era, backlog, ratedCount }
  }, [items, type])

  const { genres, lowGenres, era, backlog, ratedCount } = data
  if (ratedCount === 0 && backlog.length === 0) return null

  return (
    <Section title={TYPE_LABEL[type] ?? type} count={ratedCount || undefined}>
      {ratedCount > 0 && (
        <div style={{ marginBottom: 18 }}>
          <ReactionBar items={items} type={type} />
        </div>
      )}
      {genres.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <SubLabel>genres you love</SubLabel>
          <RankedLine scored={genres} limit={6} />
        </div>
      )}
      {era.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <SubLabel>era</SubLabel>
          <RankedLine scored={era} limit={6} />
        </div>
      )}
      {backlog.length > 0 && (
        <div style={{ marginBottom: lowGenres.length > 0 ? 18 : 0 }}>
          <SubLabel>most in backlog</SubLabel>
          <RankedLine scored={backlog} limit={6} />
        </div>
      )}
      {lowGenres.length > 0 && (
        <div>
          <SubLabel>doesn't land</SubLabel>
          <RankedLine scored={lowGenres} limit={6} />
        </div>
      )}
    </Section>
  )
}

export function TasteScreen() {
  const { items, loading, editItem } = useItems()
  const { tasteProfile, tasteProfileGeneratedAt, setTasteProfile } = usePrefs()
  const [generatingProfile, setGeneratingProfile] = useState(false)

  async function generateProfile() {
    if (generatingProfile) return
    setGeneratingProfile(true)
    try {
      const signal = items.filter(i => i.status === 'done' && (i.reaction === 'loved_it' || i.reaction === 'liked_it'))
      const res = await fetch('/api/taste-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: signal.map(i => ({ title: i.title, creator: i.creator, type: i.type, reaction: i.reaction, note: i.note })),
        }),
      })
      const { profile } = await res.json()
      if (profile) await setTasteProfile(profile)
    } catch { /* silent fail */ }
    setGeneratingProfile(false)
  }

  const [backfilling, setBackfilling] = useState(false)
  const [backfillProgress, setBackfillProgress] = useState(0)
  const [backfillTotal, setBackfillTotal] = useState(0)
  const cancelRef = useRef(false)

  const [rtBackfilling, setRtBackfilling] = useState(false)
  const [rtProgress, setRtProgress] = useState(0)
  const [rtTotal, setRtTotal] = useState(0)
  const rtCancelRef = useRef(false)

  const [migrating, setMigrating] = useState(false)
  const [migrateProgress, setMigrateProgress] = useState(0)

  // Items still tagged with retired mood words. gripping→intense; project/easy dropped.
  const needsMoodMigration = useMemo(() =>
    items.filter(i => i.moods?.some(m => m === 'gripping' || m === 'project' || m === 'easy')),
    [items],
  )

  async function runMoodMigration() {
    if (migrating || needsMoodMigration.length === 0) return
    setMigrating(true)
    setMigrateProgress(0)
    for (const item of needsMoodMigration) {
      const next = (item.moods ?? [])
        .map(m => (m === 'gripping' ? 'intense' : m))
        .filter(m => m !== 'project' && m !== 'easy')
      try { await editItem(item.id, { moods: [...new Set(next)] }) } catch { /* skip on error */ }
      setMigrateProgress(p => p + 1)
    }
    setMigrating(false)
  }

  const untagged = useMemo(() =>
    items.filter(i => (!i.tags || i.tags.length === 0) && ['film','tv','book','music'].includes(i.type)),
    [items],
  )

  const needsRuntime = useMemo(() =>
    items.filter(i => {
      if (i.type === 'film' || i.type === 'tv') return !i.metadata?.runtime
      if (i.type === 'book') return !i.metadata?.pages
      return false
    }),
    [items],
  )

  async function runBackfill() {
    if (backfilling || untagged.length === 0) return
    cancelRef.current = false
    setBackfilling(true)
    setBackfillProgress(0)
    setBackfillTotal(untagged.length)

    const BATCH = 5
    for (let i = 0; i < untagged.length; i += BATCH) {
      if (cancelRef.current) break
      const batch = untagged.slice(i, i + BATCH)
      await Promise.all(batch.map(async item => {
        try {
          const res = await fetch('/api/genres', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: item.title, creator: item.creator, type: item.type }),
          })
          const { tags } = await res.json()
          if (tags?.length > 0) await editItem(item.id, { tags })
        } catch { /* skip on error */ }
      }))
      setBackfillProgress(Math.min(i + BATCH, untagged.length))
    }

    setBackfilling(false)
    cancelRef.current = false
  }

  async function runRtBackfill() {
    if (rtBackfilling || needsRuntime.length === 0) return
    rtCancelRef.current = false
    setRtBackfilling(true)
    setRtProgress(0)
    setRtTotal(needsRuntime.length)

    const BATCH = 5
    for (let i = 0; i < needsRuntime.length; i += BATCH) {
      if (rtCancelRef.current) break
      const batch = needsRuntime.slice(i, i + BATCH)
      await Promise.all(batch.map(async item => {
        try {
          const res = await fetch('/api/runtime', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: item.title, creator: item.creator, type: item.type, year: item.year }),
          })
          const data = await res.json()
          const patch: Record<string, unknown> = { ...item.metadata }
          if (item.type === 'book' && typeof data.pages === 'number') patch.pages = data.pages
          if ((item.type === 'film' || item.type === 'tv') && typeof data.runtime === 'number') patch.runtime = data.runtime
          if (patch.pages !== item.metadata?.pages || patch.runtime !== item.metadata?.runtime) {
            await editItem(item.id, { metadata: patch })
          }
        } catch { /* skip on error */ }
      }))
      setRtProgress(Math.min(i + BATCH, needsRuntime.length))
    }

    setRtBackfilling(false)
    rtCancelRef.current = false
  }

  const doneWithReaction = useMemo(() => items.filter(i => i.status === 'done' && i.reaction), [items])

  // Moods cross-type (moods are personal, not media-type-specific).
  // Two axes share the moods[] array: VIBES (feel) and VERDICTS (how it landed).
  const moodScores = useMemo(() => scoreTags(items, 'moods'), [items])
  // Vibes = taste fingerprint → ranked by reaction.
  const topVibes = moodScores.filter(s => VIBES.includes(s.label) && s.score >= 0)
  const lowVibes = moodScores.filter(s => VIBES.includes(s.label) && s.score < 0)
  // Verdicts = how things land → ranked by how often you reach for them (count),
  // NOT by reaction (that'd be circular: you only call something "overhyped" if you disliked it).
  const verdictTally = useMemo(() =>
    moodScores
      .filter(s => VERDICTS.includes(s.label))
      .map(s => ({ label: s.label, score: s.count, count: s.count }))
      .sort((a, b) => b.score - a.score),
    [moodScores],
  )

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
    <div style={{ padding: '56px 20px 100px', background: '#fff', minHeight: '100dvh', color: INK }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 10px', letterSpacing: '-0.2px', color: INK }}>taste</h1>

      {/* Taste profile prose — AI-generated editorial summary, cached in user_prefs */}
      <div style={{ marginBottom: 28 }}>
        {tasteProfile ? (
          <>
            <p style={{ fontSize: 15, lineHeight: 1.75, color: INK, margin: '0 0 10px', letterSpacing: '-0.1px' }}>
              {tasteProfile}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {tasteProfileGeneratedAt && (
                <span style={{ fontSize: 11, color: MUTE }}>
                  generated {new Date(tasteProfileGeneratedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
              <button
                onClick={generateProfile}
                disabled={generatingProfile}
                style={{ background: 'none', border: 'none', fontSize: 11, color: generatingProfile ? MUTE : GRAPHITE, cursor: generatingProfile ? 'default' : 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                {generatingProfile ? 'generating…' : 'refresh'}
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={generateProfile}
            disabled={generatingProfile}
            style={{
              padding: '8px 18px', borderRadius: 20, cursor: generatingProfile ? 'default' : 'pointer',
              border: `1.5px solid ${INK}`, background: generatingProfile ? HAIR : INK,
              color: generatingProfile ? GRAPHITE : '#fff', fontSize: 12, fontWeight: 600,
            }}
          >
            {generatingProfile ? 'generating…' : 'describe my taste'}
          </button>
        )}
      </div>

      {/* OVERALL — vibes + verdicts are cross-type (a vibe doesn't belong to a medium). */}
      {/* Vibes (feel) — your taste fingerprint. Top of the page, open by default. */}
      <Section title="vibes" defaultOpen>
        {topVibes.length > 0
          ? <RankedLine scored={topVibes} limit={8} />
          : <p style={{ fontSize: 13, color: MUTE, margin: 0 }}>tag a vibe when you mark things done.</p>}
        {lowVibes.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <SubLabel>rarely lands</SubLabel>
            <RankedLine scored={lowVibes} limit={6} />
          </div>
        )}
      </Section>

      {/* Verdicts (how it landed) — ranked by how often you reach for each, not by reaction. */}
      {verdictTally.length > 0 && (
        <Section title="your verdicts">
          <p style={{ fontSize: 11, color: MUTE, margin: '0 0 12px' }}>how often you reach for each</p>
          <RankedLine scored={verdictTally} />
        </Section>
      )}

      {/* PER CATEGORY — one card per medium holds its whole profile. tv last. */}
      {(['film', 'book', 'music', 'tv'] as const).map(type => (
        <CategoryCard key={type} items={items} type={type} />
      ))}

      {/* Maintenance chores — bundled + collapsed so they don't interrupt insights */}
      {(untagged.length > 0 || needsRuntime.length > 0 || needsMoodMigration.length > 0) && (
        <Section title="tidy up">

      {untagged.length > 0 && (
          <div style={{ paddingBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEAE', letterSpacing: '0.9px', textTransform: 'uppercase', marginBottom: 10 }}>
              genre tags
            </div>
            {backfilling ? (
              <div>
                <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
                  tagging {Math.min(backfillProgress + 5, backfillTotal)} of {backfillTotal}…
                </div>
                <div style={{ background: '#F0F0F0', borderRadius: 4, height: 4, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{
                    height: '100%', borderRadius: 4, background: '#111',
                    width: `${backfillTotal ? (backfillProgress / backfillTotal) * 100 : 0}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <button
                  onClick={() => { cancelRef.current = true }}
                  style={{ background: 'none', border: 'none', fontSize: 12, color: '#BBB', cursor: 'pointer', padding: 0 }}
                >
                  cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#888' }}>
                  {untagged.length} item{untagged.length !== 1 ? 's' : ''} without genre tags
                </span>
                <button
                  onClick={runBackfill}
                  style={{
                    padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
                    border: '1.5px solid #111', background: '#111',
                    color: '#fff', fontSize: 12, fontWeight: 600,
                  }}
                >
                  tag my library
                </button>
              </div>
            )}
          </div>
      )}

      {needsRuntime.length > 0 && (
          <div style={{ paddingBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEAE', letterSpacing: '0.9px', textTransform: 'uppercase', marginBottom: 10 }}>
              runtime &amp; pages
            </div>
            {rtBackfilling ? (
              <div>
                <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
                  filling in {Math.min(rtProgress + 5, rtTotal)} of {rtTotal}…
                </div>
                <div style={{ background: '#F0F0F0', borderRadius: 4, height: 4, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{
                    height: '100%', borderRadius: 4, background: '#111',
                    width: `${rtTotal ? (rtProgress / rtTotal) * 100 : 0}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <button
                  onClick={() => { rtCancelRef.current = true }}
                  style={{ background: 'none', border: 'none', fontSize: 12, color: '#BBB', cursor: 'pointer', padding: 0 }}
                >
                  cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#888' }}>
                  {needsRuntime.length} item{needsRuntime.length !== 1 ? 's' : ''} missing runtime or page count
                </span>
                <button
                  onClick={runRtBackfill}
                  style={{
                    padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
                    border: '1.5px solid #111', background: '#111',
                    color: '#fff', fontSize: 12, fontWeight: 600,
                  }}
                >
                  fill in
                </button>
              </div>
            )}
          </div>
      )}

      {needsMoodMigration.length > 0 && (
          <div style={{ paddingBottom: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEAE', letterSpacing: '0.9px', textTransform: 'uppercase', marginBottom: 10 }}>
              vibe cleanup
            </div>
            {migrating ? (
              <div style={{ fontSize: 13, color: '#555' }}>
                updating {migrateProgress} of {needsMoodMigration.length}…
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 13, color: '#888' }}>
                  {needsMoodMigration.length} item{needsMoodMigration.length !== 1 ? 's' : ''} use old vibe words
                </span>
                <button
                  onClick={runMoodMigration}
                  style={{
                    flexShrink: 0,
                    padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
                    border: '1.5px solid #111', background: '#111',
                    color: '#fff', fontSize: 12, fontWeight: 600,
                  }}
                >
                  clean up
                </button>
              </div>
            )}
          </div>
      )}
        </Section>
      )}
    </div>
  )
}
