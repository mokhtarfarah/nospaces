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
import { SheetHero } from '../components/SheetHero'
import { clearStack } from '../lib/layout'

const INK = '#1C1B19'
const GRAPHITE = '#6F6B64'
const MUTE = '#ABA69C'
const HAIR = '#ECEAE6'

// Empty-state for the taste page: instead of pointing the user off to another
// screen, show a blurred skeleton in the *shape* of the real profile (vibe-word
// headline + prose) under a veil, so the payoff is visible before it's earned.
// Deliberately abstract grey bars — never fake data masquerading as a real read.
function TasteLockedPreview() {
  const proseLines = ['100%', '94%', '97%', '88%', '100%', '62%']
  return (
    <div style={{ position: 'relative', marginTop: 4 }}>
      <div aria-hidden style={{ filter: 'blur(3px)', opacity: 0.7, pointerEvents: 'none', userSelect: 'none' }}>
        {/* vibe-word headline */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {[96, 124, 78].map((w, i) => (
            <div key={i} style={{ width: w, height: 26, borderRadius: 6, background: '#E7E4DF' }} />
          ))}
        </div>
        {/* prose */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {proseLines.map((w, i) => (
            <div key={i} style={{ width: w, height: 13, borderRadius: 7, background: HAIR }} />
          ))}
        </div>
      </div>
      {/* veil + the promise */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.15), rgba(255,255,255,0.9) 55%)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: INK, marginBottom: 6 }}>your taste, written back to you.</div>
        <div style={{ fontSize: 13, color: GRAPHITE, lineHeight: 1.6, maxWidth: 280 }}>
          this page fills in as you log reactions. mark a few things done — how it landed, the vibe, your take — and a profile builds here.
        </div>
      </div>
    </div>
  )
}

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

// Most you can have per medium. The point of a desert island is scarcity — a
// top-5 is a stronger statement than a long favourites shelf.
const CANON_CAP = 5

const coverFor = (item: Item) =>
  (item.metadata?.coverUrl as string | null) ?? (item.metadata?.wikiThumb as string | null) ?? null

// The island "why" is its own field (metadata.canonNote) — a deliberate love-note
// for this pick, separate from the working library note. Fall back to the library
// note so existing picks still show something until a dedicated why is written.
const islandWhy = (item: Item) =>
  ((item.metadata?.canonNote as string | undefined)?.trim()) || (item.note?.trim() ?? '')

// A numbered desert-island pick. Discover's countdown language — oversized rank
// watermark, ghosted cover wash, title + meta — but the note is NOT in the row;
// it's revealed on tap (a uniform row keeps the list clean, the reveal makes the
// note feel like a reward). In edit mode the row swaps its tap target for
// reorder arrows + remove instead of opening the sheet.
function CanonRow({ item, index, editing, isFirst, isLast, onUp, onDown, onRemove, onOpen }: {
  item: Item; index: number; editing: boolean
  isFirst: boolean; isLast: boolean
  onUp: () => void; onDown: () => void; onRemove: () => void; onOpen: () => void
}) {
  const stored = coverFor(item)
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, item.metadata?.coverUrl as string | null)
  const cover = artwork ?? stored
  const fallbackTint = typeColor(item.type).bg
  const meta = [item.year ?? undefined, item.creator ?? undefined].filter(Boolean).join(' · ')
  // One line of the "why" in the row — the editorial line that makes the list
  // read like Discover instead of a bare index. Hidden in edit mode (reorder is
  // the job there) to keep rows compact.
  const why = !editing ? islandWhy(item) : ''
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      onClick={editing ? undefined : onOpen}
      style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', marginBottom: 8, cursor: editing ? 'default' : 'pointer' }}
    >
      {cover ? (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'blur(4px)', opacity: 0.42, transform: 'scale(1.08)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 30%, #000 100%)',
          maskImage: 'linear-gradient(90deg, transparent 30%, #000 100%)',
        }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent 35%, ${fallbackTint})`, opacity: 0.8 }} />
      )}

      <div style={{ position: 'relative', padding: '16px 14px' }}>
        {/* Oversized rank numeral — faint watermark, text runs across it */}
        <span style={{
          position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
          fontFamily: 'inherit', fontSize: 96, fontWeight: 300,
          color: '#E0DDD5', lineHeight: 1, letterSpacing: '-5px', zIndex: 0,
          pointerEvents: 'none', userSelect: 'none',
        }}>{index}</span>

        <div style={{ position: 'relative', zIndex: 1, paddingLeft: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: INK, lineHeight: 1.25 }}>{item.title}</div>
            <div style={{ fontSize: 11, color: MUTE, letterSpacing: '0.3px', textTransform: 'uppercase', marginTop: 3 }}>{meta}</div>
            {why && (
              <p style={{
                fontSize: 13, color: '#4A453E', lineHeight: 1.6, margin: '6px 0 0', fontStyle: 'italic',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {inlineItalics(why)}
              </p>
            )}
          </div>

          {editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              <ArrowBtn dir="up" disabled={isFirst} onClick={e => { stop(e); onUp() }} />
              <ArrowBtn dir="down" disabled={isLast} onClick={e => { stop(e); onDown() }} />
              <button onClick={e => { stop(e); onRemove() }} aria-label="remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTE, fontSize: 16, padding: '4px 4px 4px 8px', lineHeight: 1 }}>✕</button>
            </div>
          ) : (
            <span style={{ flexShrink: 0, fontSize: 15, color: MUTE }}>›</span>
          )}
        </div>
      </div>
    </div>
  )
}

function ArrowBtn({ dir, disabled, onClick }: { dir: 'up' | 'down'; disabled: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      aria-label={dir === 'up' ? 'move up' : 'move down'}
      style={{
        background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#DBD8D1' : GRAPHITE, fontSize: 13, padding: '4px 5px', lineHeight: 1,
      }}
    >
      {dir === 'up' ? '▲' : '▼'}
    </button>
  )
}

// Tap a pick → detail sheet (same language as Discover): SheetHero with the rank
// watermark + crisp poster, then the "why it's on your island" — its own love-note.
// Reads as prose by default (like the library note); an `edit` link swaps in the
// editor. The library note only surfaces here as a fallback when no why is written
// yet — once a why exists, it's the statement for this surface.
function CanonDetailSheet({ item, index, onSaveWhy, onClose }: {
  item: Item; index: number; onSaveWhy: (text: string) => void; onClose: () => void
}) {
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, item.metadata?.coverUrl as string | null)
  const cover = artwork ?? coverFor(item)
  const meta = [typeColor(item.type).label, item.creator ?? undefined, item.year ?? undefined].filter(Boolean).join(' · ')
  const initialWhy = ((item.metadata?.canonNote as string | undefined) ?? '').trim()
  // `why` is the committed/displayed value; `draft` is the edit buffer (so cancel
  // can revert). Tracking locally also survives the stale snapshot prop after save.
  const [why, setWhy] = useState(initialWhy)
  const [draft, setDraft] = useState(initialWhy)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const libNote = item.note?.trim()

  const label = { fontSize: 10, fontWeight: 600, color: MUTE, letterSpacing: '1.2px', textTransform: 'uppercase' as const }
  const link = { background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', cursor: 'pointer', fontSize: 12, lineHeight: 1.4 }

  function startEdit() { setDraft(why); setEditing(true) }
  function cancel() { setDraft(why); setEditing(false) }
  function save() {
    const next = draft.trim()
    setWhy(next)
    onSaveWhy(next)
    setEditing(false)
    if (next) { setSaved(true); setTimeout(() => setSaved(false), 1600) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '10px 20px 28px', zIndex: 201, maxWidth: 480, margin: '0 auto',
        maxHeight: '92dvh', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch',
      }}>
        <SheetHero type={item.type} title={item.title} meta={meta} cover={cover} numeral={index} onClose={onClose} />

        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={label}>why it's on your island</span>
            {!editing && (saved ? <span style={{ fontSize: 11, color: MUTE }}>saved ✓</span>
              : why ? <button onClick={startEdit} style={{ ...link, color: GRAPHITE }}>edit</button> : null)}
          </div>

          {editing ? (
            <>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="what makes this one a keeper, out of everything?"
                rows={3}
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '12px 14px',
                  border: `1.5px solid ${HAIR}`, borderRadius: 10, fontSize: 15, fontFamily: 'inherit',
                  lineHeight: 1.7, color: '#3A352E', fontStyle: 'italic', resize: 'none', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 8 }}>
                <button onClick={cancel} style={{ ...link, color: MUTE }}>cancel</button>
                <button onClick={save} style={{ ...link, color: INK, borderBottom: `1px solid ${INK}` }}>save</button>
              </div>
            </>
          ) : why ? (
            <div style={{ borderTop: `1.5px solid ${INK}`, paddingTop: 14 }}>
              <p style={{ fontSize: 15, color: '#3A352E', lineHeight: 1.75, margin: 0, fontStyle: 'italic' }}>{inlineItalics(why)}</p>
            </div>
          ) : (
            <button onClick={startEdit} style={{ ...link, color: GRAPHITE, borderBottom: `1px solid ${HAIR}` }}>+ add why it's on your island</button>
          )}
        </div>

        {/* Library note — only as a fallback when there's no why yet, so you've got
            something to draw from. Hidden once the why is the statement here. */}
        {!why && libNote && (
          <div style={{ marginTop: 18, borderTop: `1px solid ${HAIR}`, paddingTop: 12 }}>
            <div style={{ ...label, marginBottom: 6 }}>library note</div>
            <p style={{ fontSize: 13, color: MUTE, lineHeight: 1.6, margin: 0 }}>{inlineItalics(libNote)}</p>
          </div>
        )}
      </div>
    </>
  )
}

// Add picker — your loved items not already on the island. Tapping adds; a medium
// at the cap is shown full and can't take more until you remove one.
function CanonAddSheet({ candidates, fullTypes, onAdd, onClose }: {
  candidates: Item[]; fullTypes: Set<string>; onAdd: (item: Item) => void; onClose: () => void
}) {
  const [q, setQ] = useState('')
  // Snapshot the candidates when the sheet opens so a just-added item stays in
  // place showing "added ✓" instead of silently vanishing (the parent's live
  // candidate list drops it the moment it becomes canon).
  const [snapshot] = useState(() => candidates)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const query = q.trim().toLowerCase()
  const list = query
    ? snapshot.filter(i => i.title.toLowerCase().includes(query) || (i.creator ?? '').toLowerCase().includes(query))
    : snapshot
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '18px 20px 28px', zIndex: 201, maxWidth: 480, margin: '0 auto',
        height: '72dvh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>add to desert island</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6F6B64', fontSize: 16, padding: 0 }}>✕</button>
        </div>
        <input
          value={q} onChange={e => setQ(e.target.value)} placeholder="search your loved items…" autoFocus
          style={{ boxSizing: 'border-box', width: '100%', padding: '9px 12px', border: `1.5px solid ${HAIR}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: INK, marginBottom: 12 }}
        />
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {list.length === 0 ? (
            <p style={{ fontSize: 13, color: MUTE, textAlign: 'center', marginTop: 24 }}>
              {snapshot.length === 0 ? 'no loved items left to add' : 'nothing matched'}
            </p>
          ) : list.map(item => {
            const isAdded = added.has(item.id)
            const full = !isAdded && fullTypes.has(item.type)
            const meta = [TYPE_LABEL[item.type] ?? item.type, item.year ?? undefined, item.creator ?? undefined].filter(Boolean).join(' · ')
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${HAIR}`, opacity: isAdded ? 0.55 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: INK, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: MUTE, letterSpacing: '0.3px', textTransform: 'uppercase', marginTop: 2 }}>{meta}</div>
                </div>
                {isAdded ? (
                  <span style={{ fontSize: 12, color: GRAPHITE, flexShrink: 0 }}>added ✓</span>
                ) : full ? (
                  <span style={{ fontSize: 11, color: MUTE, flexShrink: 0 }}>{TYPE_LABEL[item.type] ?? item.type} full</span>
                ) : (
                  <button onClick={() => { onAdd(item); setAdded(prev => new Set(prev).add(item.id)) }} style={{ flexShrink: 0, background: 'none', border: 'none', padding: 0, fontSize: 12, color: INK, cursor: 'pointer', fontFamily: 'inherit', borderBottom: `1px solid ${INK}`, lineHeight: 1.4 }}>add</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// The desert-island tab body: numbered picks grouped by medium, an edit mode for
// reorder/remove, and an add picker.
function DesertIsland({ byType, total, candidates, fullTypes, onMove, onRemove, onAdd, onSaveWhy }: {
  byType: { type: string; items: Item[] }[]
  total: number
  candidates: Item[]
  fullTypes: Set<string>
  onMove: (type: string, idx: number, dir: -1 | 1) => void
  onRemove: (item: Item) => void
  onAdd: (item: Item) => void
  onSaveWhy: (item: Item, text: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [detail, setDetail] = useState<{ item: Item; index: number } | null>(null)
  const [adding, setAdding] = useState(false)
  const multiType = byType.length > 1
  const linkBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', cursor: 'pointer', fontSize: 12, color: GRAPHITE }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: MUTE }}>{total} {total === 1 ? 'pick' : 'picks'}</span>
        <button onClick={() => setAdding(true)} style={linkBtn}>+ add</button>
        <button onClick={() => setEditing(e => !e)} style={{ ...linkBtn, marginLeft: 'auto', color: editing ? INK : GRAPHITE, fontWeight: editing ? 600 : 400 }}>
          {editing ? 'done' : 'edit'}
        </button>
      </div>

      {byType.map(({ type, items }) => (
        <div key={type} style={{ marginBottom: multiType ? 22 : 0 }}>
          {multiType && (
            <div style={{ fontSize: 11, color: MUTE, marginBottom: 10, letterSpacing: '0.3px' }}>{TYPE_LABEL[type] ?? type}</div>
          )}
          {items.map((it, i) => (
            <CanonRow
              key={it.id} item={it} index={i + 1} editing={editing}
              isFirst={i === 0} isLast={i === items.length - 1}
              onUp={() => onMove(type, i, -1)} onDown={() => onMove(type, i, 1)}
              onRemove={() => onRemove(it)} onOpen={() => setDetail({ item: it, index: i + 1 })}
            />
          ))}
        </div>
      ))}

      {detail && <CanonDetailSheet item={detail.item} index={detail.index} onSaveWhy={text => onSaveWhy(detail.item, text)} onClose={() => setDetail(null)} />}
      {adding && <CanonAddSheet candidates={candidates} fullTypes={fullTypes} onAdd={onAdd} onClose={() => setAdding(false)} />}
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
  const { items: allItems, loading, patchMetadata, toggleCanon } = useItems()
  // The taste profile reads media; things have their own (composition-based) read.
  const items = useMemo(() => allItems.filter(i => i.type !== 'thing'), [allItems])
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

  // Desert island grouped by medium and ordered by the stored rank. Picks with no
  // rank yet (everything, until first reorder) fall back to add-date so the order
  // is at least stable; reordering then writes real ranks.
  const islandByType = useMemo(() => {
    const order = ['film', 'tv', 'book', 'music']
    const rank = (i: Item) => (i.metadata?.canonRank as number | undefined) ?? Number.POSITIVE_INFINITY
    const groups = new Map<string, Item[]>()
    for (const item of canonItems) {
      const g = groups.get(item.type) ?? []
      g.push(item)
      groups.set(item.type, g)
    }
    return order.filter(t => groups.has(t)).map(t => ({
      type: t,
      items: groups.get(t)!.sort((a, b) => rank(a) - rank(b) || new Date(a.date_added).getTime() - new Date(b.date_added).getTime()),
    }))
  }, [canonItems])

  const fullTypes = useMemo(
    () => new Set(islandByType.filter(g => g.items.length >= CANON_CAP).map(g => g.type)),
    [islandByType]
  )

  // Loved items not yet on the island — the add picker's candidates.
  const canonCandidates = useMemo(
    () => items.filter(i => i.reaction === 'loved_it' && !i.metadata?.canon),
    [items]
  )

  // Reorder within a medium: swap two adjacent picks, then write every pick's
  // position as its rank so the numbers are concrete from here on.
  function moveCanon(type: string, idx: number, dir: -1 | 1) {
    const group = islandByType.find(g => g.type === type)?.items
    if (!group) return
    const j = idx + dir
    if (j < 0 || j >= group.length) return
    const arr = [...group]
    ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
    arr.forEach((it, i) => { void patchMetadata(it.id, { canonRank: i }) })
  }

  function removeCanon(item: Item) {
    void toggleCanon(item.id, false)
  }

  // The island "why" — its own field, separate from the library note.
  function saveCanonWhy(item: Item, text: string) {
    void patchMetadata(item.id, { canonNote: text })
  }

  // Add → append to the bottom of its medium (rank = current count). One metadata
  // write sets both the canon flag and the rank.
  function addCanon(item: Item) {
    if (fullTypes.has(item.type)) return
    const count = islandByType.find(g => g.type === item.type)?.items.length ?? 0
    void patchMetadata(item.id, { canon: true, canonRank: count })
  }

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
    <div style={{ padding: `20px 20px ${clearStack(24)}`, background: '#fff', minHeight: '100dvh', color: INK }}>
      <PageHeader title="taste" />
      <TasteLockedPreview />
    </div>
  )

  return (
    <div style={{ padding: `20px 20px ${clearStack(24)}`, background: '#fff', minHeight: '100dvh', color: INK }}>
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

          {/* AI prose — no rule above; the vibe words read as its headline */}
          <div style={{ marginBottom: 16 }}>
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
      {hasIsland && tab === 'island' && (
        <DesertIsland
          byType={islandByType}
          total={canonItems.length}
          candidates={canonCandidates}
          fullTypes={fullTypes}
          onMove={moveCanon}
          onRemove={removeCanon}
          onAdd={addCanon}
          onSaveWhy={saveCanonWhy}
        />
      )}
    </div>
  )
}
