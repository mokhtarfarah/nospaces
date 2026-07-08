import { useState } from 'react'
import type { ItemReaction } from '../lib/database.types'
import { TYPE_COLORS } from '../lib/colors'
import { useArtwork } from '../lib/artwork'
import { authHeaders } from '../lib/supabase'
import { SheetHero } from './SheetHero'
import { REACTION_ORDER, REACTION_LABELS } from './ReactionForm'

// Editorial palette — matches taste / discover / library / MediaComposer
const INK = '#1C1B19'
const GRAPHITE = '#6F6B64'
const MUTE = '#ABA69C'
const HAIR = '#ECEAE6'

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
const STATUS = ['want_to', 'done'] as const
const STATUS_LABELS: Record<(typeof STATUS)[number], string> = { want_to: 'want to', done: 'already did' }

// One segmented-row language for every single-choice group in this sheet
// (type / want-to-or-done / reaction) — matches the reaction scale on the
// mark-as-done sheet (ReactionForm.tsx), not a grid of individually
// outlined chips.
function SegmentedRow<T extends string>({ options, value, onChange, labels }: {
  options: readonly T[]
  value: T | null
  onChange: (v: T) => void
  labels: Record<T, string>
}) {
  return (
    <div style={{ display: 'flex', border: '1px solid #E2DED7', borderRadius: 11, overflow: 'hidden' }}>
      {options.map((opt, i) => {
        const active = value === opt
        return (
          <button key={opt} onClick={() => onChange(opt)} style={{
            flex: 1, padding: '10px 4px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
            border: 'none', borderRight: i < options.length - 1 ? `1px solid ${HAIR}` : 'none',
            background: active ? '#F4F2EE' : '#fff',
            color: active ? INK : '#8A857C', fontWeight: active ? 500 : 400,
          }}>
            {labels[opt]}
          </button>
        )
      })}
    </div>
  )
}

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
  const [searchOpen, setSearchOpen] = useState(false)
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
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '10px 20px 0', zIndex: 201,
        maxWidth: 480, margin: '0 auto',
        maxHeight: '92dvh', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch',
      }}>
        {/* Item preview — the shared editorial hero (ghost cover wash + crisp
            poster), same language as the Discover pick / Library item sheets.
            The confidence badge is gone: "did you mean?" below only appears when
            the AI was genuinely unsure, which already signals it — a separate
            "double-check" pill was redundant system chatter. */}
        <SheetHero
          type={item.type}
          title={item.title || 'untitled'}
          cover={artwork}
          onClose={onClose}
          meta={[TYPE_COLORS[item.type]?.label ?? item.type, item.creator, item.year].filter(Boolean).join(' · ')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button onClick={() => setEditing(v => !v)} className="tlink">{editing ? 'done editing' : 'edit details'}</button>
            <button onClick={() => setSearchOpen(v => !v)} className="tlink">{searchOpen ? 'hide search' : 'search again'}</button>
          </div>
        </SheetHero>

        {/* Source — hidden for the default "quick add" (it's noise); shown for real sources. */}
        {source && source !== 'quick add' && (
          <p style={{ fontSize: 11, color: MUTE, margin: '2px 0 0' }}>From: {source}</p>
        )}

        {/* Edit the search text and re-run the AI — tucked behind "search again"
            since most saves are confirming a right guess, not fixing one. */}
        {searchOpen && (
          <div style={{ display: 'flex', gap: 8, margin: '14px 0 0' }}>
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
        )}

        {/* Edit fields — type / title / creator / year. Only the raw fields you're
            actually typing into use form-style inputs; every single-choice row
            elsewhere in this sheet is a segmented control instead. */}
        {editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '14px 0 0' }}>
            <SegmentedRow
              options={TYPES}
              value={item.type}
              onChange={t => setItem(v => ({ ...v, type: t }))}
              labels={Object.fromEntries(TYPES.map(t => [t, TYPE_COLORS[t]?.label ?? t]))}
            />
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
        )}

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
          <div style={{ margin: '16px 0 0' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: MUTE, marginBottom: 8 }}>did you mean?</p>
            {otherMatches.map((alt, i) => (
              <button key={i} onClick={() => setItem(normalizeAlt(alt))} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 12px', border: 'none', borderRadius: 8,
                background: '#F4F2EE', marginBottom: 6, cursor: 'pointer', fontSize: 13,
              }}>
                <strong>{alt.title}</strong>
                {[alt.creator, alt.year].filter(Boolean).length > 0 && (
                  <span style={{ color: GRAPHITE, fontSize: 11 }}> · {[alt.creator, alt.year].filter(Boolean).join(' · ')}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Want to / Already did, plus the owned flag riding the same line — it's a
            modifier on "want to" (own a copy but haven't gotten to it yet), not its
            own decision, so it shouldn't get its own standalone row. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 0' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SegmentedRow options={STATUS} value={status} onChange={setStatus} labels={STATUS_LABELS} />
          </div>
          <button
            onClick={() => setOwned(v => !v)}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', padding: '5px 10px',
              borderRadius: 8, cursor: 'pointer', border: 'none',
              background: owned ? '#E6E1D7' : '#F4F2EE',
              color: owned ? INK : '#8A857C',
              fontSize: 11, fontWeight: owned ? 500 : 400, whiteSpace: 'nowrap',
            }}
          >
            {item.type === 'book' ? 'own it' : 'already own it'}
          </button>
        </div>

        {status === 'done' && (
          <div style={{ margin: '16px 0 0' }}>
            <div style={{ marginBottom: 10 }}>
              <SegmentedRow
                options={REACTION_ORDER}
                value={reaction}
                onChange={r => setReaction(prev => prev === r ? null : r)}
                labels={REACTION_LABELS}
              />
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

        <div style={{ position: 'sticky', bottom: 0, background: '#fff', paddingTop: 20, paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}>
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
