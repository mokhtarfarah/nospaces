import { useMemo, useState } from 'react'
import { useItems } from '../hooks/useItems'
import { usePrefs } from '../hooks/usePrefs'
import type { Item, ItemReaction } from '../lib/database.types'
import { VIBES, VERDICTS as _VERDICTS } from '../lib/moods'
import { isGenreTag } from '../lib/genres'
import { authHeaders } from '../lib/supabase'
import { useArtwork } from '../lib/artwork'
import { typeColor } from '../lib/colors'
import { PageHeader } from '../components/PageHeader'

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

interface Scored { label: string; score: number; count: number }

function scoreTags(items: Item[], field: 'tags' | 'moods'): Scored[] {
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
    .map(([label, v]) => ({ label, score: v.score, count: v.count }))
    .sort((a, b) => b.score - a.score)
}

function inlineItalics(text: string) {
  return text.split(/\*([^*]+)\*/).map((part, i) =>
    i % 2 === 1 ? <em key={i}>{part}</em> : part
  )
}

function topGenreForPool(pool: Item[]): string | null {
  const map = new Map<string, number>()
  for (const item of pool) {
    for (const tag of item.tags ?? []) {
      if (isGenreTag(tag)) map.set(tag, (map.get(tag) ?? 0) + 1)
    }
  }
  let top: string | null = null, max = 0
  for (const [g, c] of map) {
    if (c > max && c >= 2) { top = g; max = c }
  }
  return top
}

interface GapEntry { adding: string; finishing: string; medium?: string }

function computeAspirationGaps(items: Item[]): GapEntry[] {
  const gaps: GapEntry[] = []
  const seen = new Set<string>()

  function tryGap(pool: Item[], medium?: string) {
    const wantTo = pool.filter(i => i.status === 'want_to')
    const done = pool.filter(i => i.status === 'done')
    const adding = topGenreForPool(wantTo)
    const finishing = topGenreForPool(done)
    if (!adding || !finishing || adding === finishing) return
    const key = `${adding}>${finishing}`
    if (seen.has(key)) return
    seen.add(key)
    gaps.push({ adding, finishing, medium })
  }

  // Overall first, then per-medium
  tryGap(items)
  for (const type of ['film', 'book', 'music', 'tv'] as const) {
    tryGap(items.filter(i => i.type === type), TYPE_LABEL[type])
  }

  return gaps.slice(0, 3)
}

function computeFaithfulCreators(items: Item[]) {
  const map = new Map<string, { loved: number; total: number; type: string }>()
  for (const item of items) {
    if (item.status !== 'done' || !item.reaction || !item.creator) continue
    const e = map.get(item.creator) ?? { loved: 0, total: 0, type: item.type }
    map.set(item.creator, {
      loved: e.loved + (item.reaction === 'loved_it' ? 1 : 0),
      total: e.total + 1,
      type: item.type,
    })
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.total >= 2 && v.loved === v.total)
    .map(([name, v]) => ({ name, count: v.total, type: v.type }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

// A desert-island pick you wrote about: rendered in the Discover row language —
// the cover art ghosts in blurred from the right behind the text, the title sits
// big, an uppercase meta line, and — the whole point — your own note as the
// italic "why". No rank numeral: unlike Discover's countdown these aren't ordered.
// Note-less picks DON'T use this row (a big empty colour band reads as a loading
// placeholder); they collapse to CanonLine below instead. The annotation earns
// the spread.
function CanonRow({ item }: { item: Item }) {
  const stored = (item.metadata?.coverUrl as string | null) ?? (item.metadata?.wikiThumb as string | null) ?? null
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, item.metadata?.coverUrl as string | null)
  const cover = artwork ?? stored
  const fallbackTint = typeColor(item.type).bg
  const meta = [TYPE_LABEL[item.type] ?? item.type, item.year ?? undefined, item.creator ?? undefined].filter(Boolean).join(' · ')
  const note = item.note!.trim()

  return (
    <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
      {/* Ghosted cover art — blurred + faded in from the right, behind the text.
          Softer than Discover's (0.32 vs 0.42): these rows carry less content,
          so more colour shows — kept quiet so the page doesn't lurch into a
          pastel mood-board below the essay. */}
      {cover ? (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'blur(4px)', opacity: 0.32, transform: 'scale(1.08)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 38%, #000 100%)',
          maskImage: 'linear-gradient(90deg, transparent 38%, #000 100%)',
        }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent 42%, ${fallbackTint})`, opacity: 0.7 }} />
      )}

      <div style={{ position: 'relative', padding: '14px 14px 16px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: INK, lineHeight: 1.25 }}>{item.title}</div>
        <div style={{ fontSize: 11, color: MUTE, letterSpacing: '0.3px', textTransform: 'uppercase', margin: '3px 0 8px' }}>
          {meta}
        </div>
        <p style={{ fontSize: 13, color: '#4A453E', lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
          {inlineItalics(note)}
        </p>
      </div>
    </div>
  )
}

// A desert-island pick with no note: a quiet one-line entry instead of a full
// row, so it doesn't read as an empty colour band. Title leads, year · creator
// trails muted — the "also on the list" register.
function CanonLine({ item }: { item: Item }) {
  const meta = [item.year ?? undefined, item.creator ?? undefined].filter(Boolean).join(' · ')
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 0' }}>
      <span style={{ fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{item.title}</span>
      {meta && <span style={{ fontSize: 11, color: MUTE, letterSpacing: '0.3px', textTransform: 'uppercase' }}>{meta}</span>}
    </div>
  )
}

// The desert-island tab body. No own header/disclosure — the tab is the
// disclosure now. Just the grouped picks: noted ones as full editorial rows,
// the rest as quiet one-liners.
function CanonGallery({ items }: { items: Item[] }) {
  const byType = useMemo(() => {
    const order = ['film', 'tv', 'book', 'music']
    const groups = new Map<string, Item[]>()
    for (const item of items) {
      const g = groups.get(item.type) ?? []
      g.push(item)
      groups.set(item.type, g)
    }
    return order.filter(t => groups.has(t)).map(t => ({ type: t, items: groups.get(t)! }))
  }, [items])

  const multiType = byType.length > 1

  return (
    <div>
      {byType.map(({ type, items: typeItems }) => {
        // Picks you wrote about get the full editorial row; the rest collapse to
        // quiet one-liners underneath, so no row is ever an empty colour band.
        const noted = typeItems.filter(i => i.note?.trim())
        const bare = typeItems.filter(i => !i.note?.trim())
        return (
          <div key={type} style={{ marginBottom: multiType ? 20 : 0 }}>
            {multiType && (
              <div style={{ fontSize: 11, color: MUTE, marginBottom: 10, letterSpacing: '0.3px' }}>
                {TYPE_LABEL[type] ?? type}
              </div>
            )}
            {noted.map(item => <CanonRow key={item.id} item={item} />)}
            {bare.length > 0 && (
              <div style={{ padding: noted.length ? '4px 14px 0' : '0 14px' }}>
                {bare.map(item => <CanonLine key={item.id} item={item} />)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Tab chip — same language as Discover's stream chips (active: ink + italic),
// so taste reads as one app with the rest.
function TabChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, padding: '4px 2px 8px', border: 'none', background: 'none',
        color: active ? '#111' : '#888', fontSize: 13,
        fontWeight: active ? 600 : 400, fontStyle: active ? 'italic' : 'normal',
        cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

export function TasteScreen() {
  const { items, loading } = useItems()
  const { tasteProfile, setTasteProfile } = usePrefs()
  const [generating, setGenerating] = useState(false)
  const [tab, setTab] = useState<'profile' | 'island'>('profile')
  const [genError, setGenError] = useState('')

  const doneWithReaction = useMemo(() => items.filter(i => i.status === 'done' && i.reaction), [items])

  const topVibes = useMemo(() =>
    scoreTags(items, 'moods').filter(s => VIBES.includes(s.label) && s.score > 0).slice(0, 3),
    [items]
  )

  const aspirationGaps = useMemo(() => computeAspirationGaps(items), [items])

  const faithfulCreators = useMemo(() => computeFaithfulCreators(items), [items])

  const canonItems = useMemo(() =>
    items.filter(i => i.metadata?.canon && i.reaction === 'loved_it'),
    [items]
  )
  const hasIsland = canonItems.length > 0

  async function generate() {
    if (generating) return
    setGenerating(true)
    setGenError('')
    try {
      // Send every rated item — including eh / not-for-me. The reaction is the
      // primary signal; negatives tell the profiler what leaves this person cold.
      const signal = doneWithReaction
      const canonTitles = canonItems.map(i => `${i.title} (${i.type})`)
      const primaryGap = aspirationGaps[0] ?? null
      const res = await fetch('/api/taste-profile', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          items: signal.map(i => ({ title: i.title, creator: i.creator, type: i.type, reaction: i.reaction, note: i.note })),
          vibes: topVibes.map(v => v.label),
          canon: canonTitles.length ? canonTitles : undefined,
          aspirationGap: primaryGap,
        }),
      })
      if (!res.ok) {
        setGenError('couldn\'t generate — try again')
      } else {
        const { profile } = await res.json()
        if (profile) await setTasteProfile(profile)
        else setGenError('no profile returned — try again')
      }
    } catch {
      setGenError('couldn\'t generate — try again')
    }
    setGenerating(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
      <div style={{ width: 20, height: 20, border: '2px solid #111', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!doneWithReaction.length) return (
    <div style={{ padding: '20px 20px calc(80px + env(safe-area-inset-bottom))', background: '#fff', minHeight: '100dvh', color: INK }}>
      <PageHeader title="taste" />
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: INK, marginBottom: 6 }}>nothing to show yet</div>
        <div style={{ fontSize: 13, color: GRAPHITE, lineHeight: 1.6 }}>mark items as done and add reactions — your taste profile builds up here.</div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '20px 20px calc(80px + env(safe-area-inset-bottom))', background: '#fff', minHeight: '100dvh', color: INK }}>
      {/* "taste" as a small section label, vibe words as the headline */}
      <PageHeader kicker={`shaped by ${doneWithReaction.length} ${doneWithReaction.length === 1 ? 'rating' : 'ratings'}`} title="taste" />

      {/* Tabs — profile (the read) vs desert island (the picks). Sit directly
          under the header so they stay anchored when you switch; the vibe words
          live inside the profile tab (they describe the profile, not the picks).
          Only shown when there's a desert island; otherwise it's just the profile. */}
      {hasIsland && (
        <div style={{ display: 'flex', gap: 18, borderBottom: `1px solid ${HAIR}`, marginBottom: 18 }}>
          <TabChip label="profile" active={tab === 'profile'} onClick={() => setTab('profile')} />
          <TabChip label="desert island" active={tab === 'island'} onClick={() => setTab('island')} />
        </div>
      )}

      {/* ── Profile tab: vibe headline + prose + the gap + always loved ────── */}
      {(!hasIsland || tab === 'profile') && (
        <>
          {/* Vibe words — the profile's headline. Inline with middots so it reads
              as one identity, not a list; each word is non-breaking so it wraps
              only at a separator, never mid-word. */}
          {topVibes.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <h1 style={{ fontSize: 24, fontWeight: 600, color: INK, letterSpacing: '-0.5px', lineHeight: 1.25, margin: 0 }}>
                {topVibes.map((v, i) => (
                  <span key={v.label}>
                    <span style={{ whiteSpace: 'nowrap' }}>{v.label}</span>
                    {i < topVibes.length - 1 && <span style={{ color: MUTE, margin: '0 7px', fontWeight: 400 }}>·</span>}
                  </span>
                ))}
              </h1>
            </div>
          )}

          {/* AI prose */}
          <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 16, marginBottom: 16 }}>
            {tasteProfile ? (
              <div>
                {tasteProfile.split('\n\n').filter(p => p.trim()).map((para, i) => (
                  <p key={i} style={{
                    fontSize: 14, lineHeight: 1.75, color: GRAPHITE,
                    letterSpacing: '-0.1px', margin: i === 0 ? '0 0 12px' : '0',
                  }}>
                    {inlineItalics(para.replace(/^[-–]\s*/gm, '').trim())}
                  </p>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: MUTE }}>ai taste profile</span>
                <button
                  onClick={generate}
                  disabled={generating}
                  style={{
                    padding: '7px 16px', borderRadius: 20, cursor: generating ? 'default' : 'pointer',
                    border: `1.5px solid ${INK}`, background: INK,
                    color: '#fff', fontSize: 12, fontWeight: 600,
                    opacity: generating ? 0.5 : 1, fontFamily: 'inherit',
                  }}
                >
                  {generating ? 'generating…' : 'generate'}
                </button>
              </div>
            )}
            {genError && <div style={{ fontSize: 11, color: '#C0392B', marginTop: 6 }}>{genError}</div>}
          </div>

          {/* The gap — per-medium where meaningful */}
          {aspirationGaps.length > 0 && (
            <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: MUTE, marginBottom: 4 }}>
                the gap
              </div>
              <div style={{ fontSize: 12, color: MUTE, lineHeight: 1.5, marginBottom: 10 }}>
                what you're collecting vs. what you actually finish
              </div>
              {aspirationGaps.map((g, i) => (
                <div key={i} style={{ marginBottom: i < aspirationGaps.length - 1 ? 6 : 0 }}>
                  <span style={{ fontSize: 14, color: GRAPHITE, letterSpacing: '-0.1px', lineHeight: 1.55 }}>
                    {g.medium ? `In ${g.medium}, you keep adding ` : 'You keep adding '}
                    <span style={{ color: INK, fontWeight: 600 }}>{g.adding}</span>
                    {' but finish '}
                    <span style={{ color: INK, fontWeight: 600 }}>{g.finishing}</span>.
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Creator faithfulness */}
          {faithfulCreators.length > 0 && (
            <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: MUTE, marginBottom: 10 }}>
                always loved
              </div>
              <div style={{ fontSize: 14, color: GRAPHITE, lineHeight: 1.7, letterSpacing: '-0.1px' }}>
                {faithfulCreators.map((c, i) => (
                  <span key={c.name}>
                    {i > 0 && <span style={{ color: MUTE }}> · </span>}
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Refresh profile — available but unobtrusive */}
          {tasteProfile && (
            <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 14, marginTop: 4 }}>
              <button
                onClick={generate}
                disabled={generating}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: generating ? 'default' : 'pointer',
                  fontSize: 11, color: MUTE, fontFamily: 'inherit',
                  textDecoration: 'underline', textUnderlineOffset: 2,
                }}
              >
                {generating ? 'generating…' : 'refresh profile'}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Desert island tab ─────────────────────────────────────────────── */}
      {hasIsland && tab === 'island' && <CanonGallery items={canonItems} />}
    </div>
  )
}
