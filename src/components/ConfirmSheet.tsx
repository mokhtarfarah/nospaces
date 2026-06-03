import { useState } from 'react'
import type { ItemReaction } from '../lib/database.types'
import { typeColor, TYPE_COLORS } from '../lib/colors'
import { useArtwork } from '../lib/artwork'
import { authHeaders } from '../lib/supabase'

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
  const [candidates, setCandidates] = useState<AiResult[]>(result.alternatives ?? [])
  const [loadingMore, setLoadingMore] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [queryText, setQueryText] = useState(query || result.title)
  const [requerying, setRequerying] = useState(false)
  // Optional one-step "already done" logging. status='want_to' is the default;
  // switching to 'done' reveals the reaction grid + note, same as MarkDoneSheet.
  const [status, setStatus] = useState<'want_to' | 'done'>('want_to')
  const [reaction, setReaction] = useState<ItemReaction | null>(null)
  const [note, setNote] = useState('')
  const color = typeColor(item.type)
  const artwork = useArtwork(item.type, item.title, item.creator, item.year)

  const origQuery = queryText

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
      setCollapsed(false)
    } catch {
      /* ignore — keep current result */
    } finally {
      setRequerying(false)
    }
  }

  // Force the literal text the user typed, skipping the AI's substitution.
  function useTyped() {
    if (!query) return
    setItem({ title: query, creator: '', type: 'other', year: null, confidence: 'high', metadata: {}, tags: [], ambiguous: false, alternatives: [] })
    setEditing(true)
  }

  const normalizeAlt = (a: AiResult): AiResult => ({
    ...a,
    metadata: a.metadata ?? {},
    tags: a.tags ?? [],
    confidence: a.confidence ?? 'medium',
    ambiguous: false,
    alternatives: [],
  })

  async function loadMore() {
    setLoadingMore(true)
    try {
      // Search the real catalogs (iTunes / TMDB / Open Library) for actual matches.
      const res = await fetch(`/api/lookup?q=${encodeURIComponent(origQuery)}`, { headers: await authHeaders() })
      const data = await res.json()
      const more: AiResult[] = (data.results ?? []).map((r: Partial<AiResult>) => normalizeAlt(r as AiResult))
      setCandidates(prev => {
        const seen = new Set(prev.map(p => p.title.toLowerCase()))
        return [...prev, ...more.filter(m => m.title && !seen.has(m.title.toLowerCase()))]
      })
      setCollapsed(false)
    } catch {
      /* ignore — leave list as-is */
    } finally {
      setLoadingMore(false)
    }
  }

  const otherMatches = candidates.filter(c => c.title !== item.title)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '12px 20px 0', zIndex: 201,
        maxWidth: 480, margin: '0 auto',
        maxHeight: '90dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 16px' }} />
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: '#999', padding: 4 }}
        >
          ×
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#444', margin: 0 }}>save to library</p>
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
            style={{ flexShrink: 0, padding: '0 14px', borderRadius: 10, border: 'none', background: requerying ? '#ccc' : '#111111', color: '#fff', fontSize: 13, fontWeight: 600, cursor: requerying ? 'default' : 'pointer' }}
          >
            {requerying ? '…' : 're-run'}
          </button>
        </div>

        {/* Item preview / edit */}
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
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
              const box: React.CSSProperties = { width: w, height: h, borderRadius: 0, flexShrink: 0, objectFit: 'cover', border: '1px solid #EEE' }
              return artwork
                ? <img src={artwork} alt="" style={box} />
                : <div style={{ ...box, background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', color: color.border }}>{item.type === 'other' ? '' : item.type}</div>
            })()}
            <div style={{ minWidth: 0, paddingTop: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
                {[TYPE_COLORS[item.type]?.label ?? item.type, item.creator, item.year].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        )}

        {/* Type chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {TYPES.map(t => {
            const c = typeColor(t)
            const active = item.type === t
            return (
              <button key={t} onClick={() => setItem(v => ({ ...v, type: t }))} style={{
                padding: '5px 12px', border: active ? `1.5px solid ${c.border}` : '1.5px solid #E0E0E0',
                borderRadius: 20, background: active ? c.bg : '#fff',
                color: active ? c.border : '#555', fontSize: 13,
                fontWeight: active ? 600 : 400, cursor: 'pointer',
              }}>
                {TYPE_COLORS[t]?.label ?? t}
              </button>
            )
          })}
        </div>

        {/* Source — hidden for the default "quick add" (it's noise); shown for real sources. */}
        {source && source !== 'quick add' && (
          <p style={{ fontSize: 11, color: '#AAA', marginBottom: 4 }}>From: {source}</p>
        )}

        {/* Edit toggle */}
        <button onClick={() => setEditing(v => !v)} style={{
          background: 'none', border: 'none', color: '#111111',
          fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 16,
        }}>
          {editing ? 'done editing' : 'edit details'}
        </button>

        {/* Alternatives — "Did you mean?" with show more / show less */}
        <div style={{ marginBottom: 16 }}>
          {otherMatches.length > 0 && !collapsed && (
            <>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#999', marginBottom: 8 }}>did you mean?</p>
              {otherMatches.map((alt, i) => (
                <button key={i} onClick={() => setItem(normalizeAlt(alt))} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 12px', border: '1px solid #EEE', borderRadius: 8,
                  background: '#FAFAFA', marginBottom: 6, cursor: 'pointer', fontSize: 13,
                }}>
                  <strong>{alt.title}</strong>
                  {[alt.creator, alt.year].filter(Boolean).length > 0 && (
                    <span style={{ color: '#888', fontSize: 11 }}> · {[alt.creator, alt.year].filter(Boolean).join(' · ')}</span>
                  )}
                </button>
              ))}
            </>
          )}
          <div style={{ display: 'flex', gap: 16 }}>
            <button
              onClick={collapsed ? () => setCollapsed(false) : loadMore}
              disabled={loadingMore}
              style={{ background: 'none', border: 'none', color: '#111111', fontSize: 12, cursor: loadingMore ? 'default' : 'pointer', padding: 0 }}
            >
              {loadingMore ? 'searching…'
                : collapsed ? `show options (${otherMatches.length})`
                : otherMatches.length > 0 ? 'look it up online'
                : 'not the right one? look it up online'}
            </button>
            {otherMatches.length > 0 && !collapsed && (
              <button
                onClick={() => setCollapsed(true)}
                style={{ background: 'none', border: 'none', color: '#999', fontSize: 12, cursor: 'pointer', padding: 0 }}
              >
                show less
              </button>
            )}
          </div>
          {query && query !== item.title && (
            <button
              onClick={useTyped}
              style={{ display: 'block', marginTop: 10, background: 'none', border: 'none', color: '#111111', fontSize: 12, cursor: 'pointer', padding: 0, textAlign: 'left' }}
            >
              none of these — use exactly what I typed: “{query}”
            </button>
          )}
        </div>

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
                  border: active ? `1.5px solid ${color.border}` : '1.5px solid #E0E0E0',
                  background: active ? color.bg : '#fff',
                  color: active ? color.border : '#555',
                  fontSize: 14, fontWeight: active ? 600 : 400,
                }}
              >
                {s === 'want_to' ? 'Want to' : 'Already did'}
              </button>
            )
          })}
        </div>

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
                      border: active ? `2px solid ${color.border}` : '1.5px solid #E0E0E0',
                      background: active ? color.bg : '#fff',
                      color: active ? color.border : '#444',
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
            onClick={() => onConfirm(item, status === 'done' ? { reaction, note } : null)}
            style={{
              width: '100%', padding: 14, background: '#111111',
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
  padding: '10px 12px', border: '1.5px solid #E0E0E0',
  borderRadius: 10, fontSize: 16, fontFamily: 'inherit', outline: 'none',
}
