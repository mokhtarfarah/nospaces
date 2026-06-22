import { useMemo, useState } from 'react'
import { useItems } from '../hooks/useItems'
import { usePrefs } from '../hooks/usePrefs'
import type { Item, ItemReaction } from '../lib/database.types'
import { VIBES, VERDICTS as _VERDICTS } from '../lib/moods'
import { isGenreTag } from '../lib/genres'
import { authHeaders } from '../lib/supabase'
import { useArtwork } from '../lib/artwork'
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

// Inner image layer — used inside a sized container so the grid handles dimensions.
// objectPosition top keeps faces/titles in frame when a portrait cover is cropped
// into a uniform square tile.
function CoverTileInner({ item }: { item: Item }) {
  const stored = (item.metadata?.coverUrl as string | null) ?? (item.metadata?.wikiThumb as string | null) ?? null
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, item.metadata?.coverUrl as string | null)
  const src = artwork ?? stored
  if (src) return <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: item.type === 'music' ? 'center' : 'top' }} />
  return <span style={{ fontSize: 10, color: MUTE, textAlign: 'center', padding: '0 4px', lineHeight: 1.3 }}>{TYPE_LABEL[item.type] ?? item.type}</span>
}

function CanonGallery({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(true)

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
    <div style={{ marginBottom: open ? 32 : 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, width: '100%',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
          marginBottom: open ? 14 : 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: MUTE }}>
          desert island
        </span>
        <span style={{ fontSize: 11, color: MUTE }}>{items.length}</span>
        <span style={{ fontSize: 10, color: MUTE, marginLeft: 'auto', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▸</span>
      </button>
      {open && byType.map(({ type, items: typeItems }) => {
        // Each medium keeps its natural shape so a row of covers reads like a
        // shelf: posters (film/book/tv) are portrait 2:3, music is square. The
        // old uniform square hard-cropped portraits to their top third.
        const aspect = type === 'music' ? '1' : '2 / 3'
        return (
        <div key={type} style={{ marginBottom: multiType ? 22 : 0 }}>
          {multiType && (
            <div style={{ fontSize: 11, color: MUTE, marginBottom: 10, letterSpacing: '0.3px' }}>
              {TYPE_LABEL[type] ?? type}
            </div>
          )}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}>
            {typeItems.map(item => (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{
                  width: '100%',
                  aspectRatio: aspect,
                  borderRadius: 3, overflow: 'hidden',
                  border: `1px solid ${HAIR}`, background: '#f5f4f2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CoverTileInner item={item} />
                </div>
                <div style={{
                  fontSize: 11, color: GRAPHITE, lineHeight: 1.3,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {item.title}
                </div>
                {item.creator && (
                  <div style={{ fontSize: 10, color: MUTE, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.creator}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        )
      })}
    </div>
  )
}

export function TasteScreen() {
  const { items, loading } = useItems()
  const { tasteProfile, setTasteProfile } = usePrefs()
  const [generating, setGenerating] = useState(false)
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

      {/* Vibe words — the actual headline */}
      {topVibes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: INK, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
            {topVibes.map((v, i) => (
              <span key={v.label}>
                {i > 0 && <span style={{ color: MUTE, margin: '0 7px', fontWeight: 400 }}>·</span>}
                {v.label}
              </span>
            ))}
          </div>
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
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: i < aspirationGaps.length - 1 ? 5 : 0 }}>
              <span style={{ fontSize: 14, color: GRAPHITE, letterSpacing: '-0.1px' }}>
                adding {g.adding} · finishing {g.finishing}
              </span>
              {g.medium && (
                <span style={{ fontSize: 11, color: MUTE }}>{g.medium}</span>
              )}
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

      {/* Desert island gallery */}
      {canonItems.length > 0 && (
        <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 16 }}>
          <CanonGallery items={canonItems} />
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
    </div>
  )
}
