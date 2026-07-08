import { useState } from 'react'
import type { ItemReaction } from '../lib/database.types'
import { typeColor, TYPE_COLORS } from '../lib/colors'
import { useArtwork } from '../lib/artwork'
import { authHeaders } from '../lib/supabase'

// Editorial palette — matches taste / discover / library / MediaComposer (s109:
// this sheet still had its own raw hex grays, the one card left over from
// before the shared palette existed — brought in line, not restructured).
const INK = '#1C1B19'
const GRAPHITE = '#6F6B64'
const MUTE = '#ABA69C'
const HAIR = '#ECEAE6'

const REACTIONS: { value: ItemReaction; label: string }[] = [
  { value: 'loved_it',   label: 'loved it'   },
  { value: 'liked_it',   label: 'liked it'   },
  { value: 'eh',         label: 'eh'         },
  { value: 'not_for_me', label: 'not for me' },
]


export interface AiResult {
  title: string
  creator: string
  type: string
  year: number | null
  confidence: 'high' | 'medium' | 'low'
  metadata: Record<string, unknown>
  tags: string[]
  blurb?: string | null
  ambiguous: boolean
  alternatives: AiResult[]
}

interface Props {
  result: AiResult
  source: string
  query?: string
  onConfirm: (item: AiResult, done: { reaction: ItemReaction | null; note: string } | null) => void
  onClose: () => void
}

const TYPES = ['film', 'book', 'music', 'tv', 'other']

export function ConfirmSheet({ result, source, query, onConfirm, onClose }: Props) {
  const [item, setItem] = useState<AiResult>(result)
  const [editing, setEditing] = useState(result.confidence !== 'high')
  // The AI's own "did you mean" guesses when it wasn't sure (identify.ts populates
  // this on low confidence) — refreshed by re-run below. Not a live catalog search;
  // that was a separate "look it up online" escape hatch that got merged away
  // (s109 — it was surfacing garbage like Panic! At the Disco albums for a book
  // search, and duplicated the re-run box above for no real benefit).
  const [candidates, setCandidates] = useState<AiResult[]>(result.alternatives ?? [])
  const [queryText, setQueryText] = useState(query || result.title)
  const [requerying, setRequerying] = useState(false)
  // Optional one-step "already done" logging. status='want_to' is the default;
  // switching to 'done' reveals the reaction grid + note, same as MarkDoneSheet.
  const [status, setStatus] = useState<'want_to' | 'done'>('want_to')
  const [reaction, setReaction] = useState<ItemReaction | null>(null)
  const [note, setNote] = useState('')
  // Same metadata.owned flag the item's ⋯ menu sets after the fact (ItemActionSheet)
  // — offered here too so a "want to" you already have a copy of (the bookstore
  // case: don't re-buy a dupe) doesn't need a second trip to set it.
  const [owned, setOwned] = useState(false)
  const color = typeColor(item.type)
  const artwork = useArtwork(item.type, item.title, item.creator, item.year)

  // Edit the search text and re-run the AI without leaving the sheet.
  async function rerun() {
    if (!queryText.trim() || requerying) return
    setRequerying(true)
    try {
      const res = await fetch('/api/identify', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ input: queryText.trim() }),
      })
      const r = (await res.json()) as AiResult
      setItem({ ...r, metadata: r.metadata ?? {}, tags: r.tags ?? [], alternatives: [] })
      setCandidates(r.alternatives ?? [])
      setEditing(r.confidence !== 'high')
    } catch {
      /* ignore — keep current result */
    } finally {
      setRequerying(false)
    }
  }

  const normalizeAlt = (a: AiResult): AiResult => ({
    ...a,
    metadata: a.metadata ?? {},
    tags: a.tags ?? [],
    confidence: a.confidence ?? 'medium',
    ambiguous: false,
    alternatives: [],
  })

  const otherMatches = candidates.filter(c => c.title !== item.title)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '20px 20px 0 0',
        padding: '12px 20px 0', zIndex: 201,
        maxWidth: 480, margin: '0 auto',
        maxHeight: '90dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ width: 36, height: 4, background: HAIR, borderRadius: 2, margin: '0 auto 16px' }} />
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: MUTE, padding: 4 }}
        >
          ×
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: GRAPHITE, margin: 0 }}>save to library</p>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 20,
            background: item.confidence === 'high' ? '#EDF3ED' : item.confidence === 'medium' ? '#FFF8E6' : '#FFF0EE',
            color: item.confidence === 'high' ? '#5A7A5A' : item.confidence === 'medium' ? '#A07000' : '#C0392B',
            fontWeight: 600,
          }}>
            {item.confidence === 'high' ? 'high confidence' : item.confidence === 'medium' ? 'double-check' : 'low confidence'}
          </span>
        </div>

        {/* Edit the search and re-run the AI without leaving the sheet */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={queryText}
            onChange={e => setQueryText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); rerun() } }}
            placeholder="Edit search…"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={rerun}
            disabled={requerying || !queryText.trim()}
            style={{ flexShrink: 0, padding: '0 14px', borderRadius: 10, border: 'none', background: requerying ? MUTE : INK, color: '#fff', fontSize: 13, fontWeight: 600, cursor: requerying ? 'default' : 'pointer' }}
          >
            {requerying ? '…' : 're-run'}
          </button>
        </div>

        {/* Item preview / edit — the type chips only show while editing (s109):
            it's an editable field like title/creator/year, not a permanent
            control, and it was duplicating the type/creator/year meta line
            shown just below it in preview. */}
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TYPES.map(t => {
                const c = typeColor(t)
                const active = item.type === t
                return (
                  <button key={t} onClick={() => setItem(v => ({ ...v, type: t }))} style={{
                    padding: '5px 12px', border: active ? `1.5px solid ${c.border}` : `1.5px solid ${HAIR}`,
                    borderRadius: 8, background: active ? c.bg : '#fff',
                    color: active ? c.border : GRAPHITE, fontSize: 13,
                    fontWeight: active ? 600 : 400, cursor: 'pointer',
                  }}>
                    {TYPE_COLORS[t]?.label ?? t}
                  </button>
                )
              })}
            </div>
            <input
              value={item.title}
              onChange={e => setItem(v => ({ ...v, title: e.target.value }))}
              placeholder="Title"
              style={inputStyle}
            />
            <input
              value={item.creator}
              onChange={e => setItem(v => ({ ...v, creator: e.target.value }))}
              placeholder="Creator (director / author / artist)"
              style={inputStyle}
            />
            <input
              value={item.year ?? ''}
              onChange={e => setItem(v => ({ ...v, year: e.target.value ? parseInt(e.target.value) : null }))}
              placeholder="Year"
              type="number"
              style={inputStyle}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
            {(() => {
              const w = item.type === 'music' ? 64 : 52
              const h = item.type === 'music' ? 64 : 78
              const box: React.CSSProperties = { width: w, height: h, borderRadius: 0, flexShrink: 0, objectFit: 'cover', border: `1px solid ${HAIR}` }
              return artwork
                ? <img src={artwork} alt="" style={box} />
                : <div style={{ ...box, background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', color: color.border }}>{item.type === 'other' ? '' : item.type}</div>
            })()}
            <div style={{ minWidth: 0, paddingTop: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: GRAPHITE, marginTop: 3 }}>
                {[TYPE_COLORS[item.type]?.label ?? item.type, item.creator, item.year].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        )}

        {/* Source — hidden for the default "quick add" (it's noise); shown for real sources. */}
        {source && source !== 'quick add' && (
          <p style={{ fontSize: 11, color: MUTE, marginBottom: 4 }}>From: {source}</p>
        )}

        {/* Edit toggle */}
        <button onClick={() => setEditing(v => !v)} style={{
          background: 'none', border: 'none', color: INK,
          fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 16,
        }}>
          {editing ? 'done editing' : 'edit details'}
        </button>

        {/* Alternatives — the AI's own "did you mean" guesses (only appears when it
            was genuinely unsure). The old "look it up online" catalog search and
            "use exactly what I typed" reset are gone (s109): both were dead ends —
            the catalog search surfaced unrelated junk (a "the memory police"
            search returned Panic! At the Disco albums, since "The Police" shares
            the word "the" — fixed at the root in api/lookup.ts too), and "use
            exactly what I typed" wiped the type/creator/year fields the AI had
            already gotten right. The "edit details" toggle above already covers
            "let me fix it by hand" without either problem — re-running the search
            covers "try again". Nothing new needed here, just less. */}
        {otherMatches.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: MUTE, marginBottom: 8 }}>did you mean?</p>
            {otherMatches.map((alt, i) => (
              <button key={i} onClick={() => setItem(normalizeAlt(alt))} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 12px', border: `1px solid ${HAIR}`, borderRadius: 8,
                background: '#FAF9F7', marginBottom: 6, cursor: 'pointer', fontSize: 13,
              }}>
                <strong>{alt.title}</strong>
                {[alt.creator, alt.year].filter(Boolean).length > 0 && (
                  <span style={{ color: GRAPHITE, fontSize: 11 }}> · {[alt.creator, alt.year].filter(Boolean).join(' · ')}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Want to / Done — log it as already-done in one step */}
        <div style={{ display: 'flex', gap: 8, marginBottom: status === 'done' ? 12 : 16 }}>
          {(['want_to', 'done'] as const).map(s => {
            const active = status === s
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                  border: active ? `1.5px solid ${color.border}` : `1.5px solid ${HAIR}`,
                  background: active ? color.bg : '#fff',
                  color: active ? color.border : GRAPHITE,
                  fontSize: 14, fontWeight: active ? 600 : 400,
                }}
              >
                {s === 'want_to' ? 'Want to' : 'Already did'}
              </button>
            )
          })}
        </div>

        {/* A pill toggle, not a native checkbox (s109) — matches the chip language
            used everywhere else in this sheet instead of a bare form control. */}
        <button
          onClick={() => setOwned(v => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', padding: '7px 14px',
            borderRadius: 20, cursor: 'pointer', marginBottom: 16,
            border: owned ? `1.5px solid ${color.border}` : `1.5px solid ${HAIR}`,
            background: owned ? color.bg : '#fff',
            color: owned ? color.border : GRAPHITE,
            fontSize: 13, fontWeight: owned ? 600 : 400,
          }}
        >
          {item.type === 'book' ? 'already on my shelf' : 'already own it'}
        </button>

        {status === 'done' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {REACTIONS.map(r => {
                const active = reaction === r.value
                return (
                  <button
                    key={r.value}
                    onClick={() => setReaction(active ? null : r.value)}
                    style={{
                      padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                      border: active ? `2px solid ${color.border}` : `1.5px solid ${HAIR}`,
                      background: active ? color.bg : '#fff',
                      color: active ? color.border : GRAPHITE,
                      fontSize: 14, fontWeight: active ? 600 : 400,
                    }}
                  >
                    {r.label}
                  </button>
                )
              })}
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="any thoughts… (optional)"
              rows={2}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>
        )}

        <div style={{ position: 'sticky', bottom: 0, background: '#fff', paddingTop: 10, paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => onConfirm(
              owned ? { ...item, metadata: { ...item.metadata, owned: true } } : item,
              status === 'done' ? { reaction, note } : null,
            )}
            style={{
              width: '100%', padding: 14, background: INK,
              color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 16, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {status === 'done' ? 'save as done' : 'save'}
          </button>
        </div>
      </div>
    </>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', border: `1.5px solid ${HAIR}`,
  borderRadius: 10, fontSize: 16, fontFamily: 'inherit', outline: 'none',
}
