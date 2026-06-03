import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useItems } from '../hooks/useItems'

interface RecItem {
  title: string
  creator: string | null
  type: string
  year: number | null
  blurb: string
}

interface Row extends RecItem {
  inLibrary: boolean
  checked: boolean
}

const EXAMPLES = [
  'NYT 100 best books of the 21st century',
  "Pitchfork's best albums of 2025",
  'A24 films I should see',
  'best new sci-fi shows 2026',
]

const norm = (s: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const typeLabel = (t: string) => (t === 'tv' ? 'tv' : t)

export function RecommendScreen() {
  const { items, importItems } = useItems()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  // Library keys for dedupe: type + normalized title (creators often differ
  // slightly between a published list and what we stored).
  const libraryKeys = useMemo(
    () => new Set(items.map(i => `${i.type}|${norm(i.title)}`)),
    [items],
  )

  async function handlePull(q: string) {
    const text = q.trim()
    if (!text || loading) return
    setError(''); setRows(null); setDone(null); setLoading(true)
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      })
      if (!res.ok) throw new Error('request failed')
      const data = await res.json() as { source: string; items: RecItem[] }
      if (!data.items?.length) {
        setError("Couldn't find that list. Try naming the outlet and year, e.g. “Time best films 2025”.")
        return
      }
      setSource(data.source || text)
      setRows(data.items.map(it => {
        const inLibrary = libraryKeys.has(`${it.type}|${norm(it.title)}`)
        return { ...it, inLibrary, checked: !inLibrary }
      }))
    } catch {
      setError('Could not reach the recommender. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }

  function toggle(i: number) {
    setRows(prev => prev && prev.map((r, idx) => idx === i ? { ...r, checked: !r.checked } : r))
  }

  const selected = rows?.filter(r => r.checked) ?? []

  async function handleSave() {
    if (!selected.length) return
    setSaving(true)
    try {
      const inserts = selected.map(r => ({
        title: r.title,
        creator: r.creator,
        type: r.type,
        year: r.year,
        status: 'want_to',
        reaction: null,
        note: r.blurb || null,
        source: 'manual',
        source_detail: 'recommendation',
        recommended_by: source,
        metadata: {},
        tags: [],
        moods: [],
        date_done: null,
      }))
      const n = await importItems(inserts as unknown as Record<string, unknown>[])
      setDone(n)
      setRows(null)
    } catch {
      setError('Something went wrong saving. Nothing was lost — try again.')
    } finally {
      setSaving(false)
    }
  }

  const newCount = rows?.filter(r => !r.inLibrary).length ?? 0
  const haveCount = rows?.filter(r => r.inLibrary).length ?? 0

  return (
    <div style={{ padding: '56px 16px 96px', background: '#fff', minHeight: '100dvh' }}>
      <button
        onClick={() => navigate('/add')}
        style={{ border: 'none', background: 'none', color: '#999', fontSize: 13, padding: 0, marginBottom: 16, cursor: 'pointer' }}
      >
        ← back
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.2px' }}>
        recommendations
      </h1>
      <p style={{ fontSize: 14, color: '#777', lineHeight: 1.5, margin: '0 0 18px' }}>
        Name a list — a "best of", a critic's roundup, a publication's picks. I'll pull
        the real list, skip what you already have, and let you save the rest to <b>want to</b>.
      </p>

      <textarea
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePull(query) } }}
        placeholder="e.g. NYT best books of summer 2026"
        rows={2}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '14px', fontSize: 16,
          border: '1px solid #E4E4E4', borderRadius: 12, resize: 'none',
          fontFamily: 'inherit', outline: 'none', lineHeight: 1.5,
        }}
      />

      <button
        onClick={() => handlePull(query)}
        disabled={!query.trim() || loading}
        style={{
          width: '100%', marginTop: 12, padding: '14px',
          background: query.trim() && !loading ? '#111111' : '#E2E2E2',
          color: '#fff', border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 600, letterSpacing: '0.2px',
          cursor: query.trim() && !loading ? 'pointer' : 'default',
        }}
      >
        {loading ? 'pulling the list… (~30s)' : 'get recommendations'}
      </button>

      {!rows && done == null && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: '#AAA', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>try</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); handlePull(ex) }}
                disabled={loading}
                style={{
                  padding: '7px 12px', borderRadius: 20, border: '1px solid #E4E4E4',
                  background: '#fff', color: '#555', fontSize: 13, cursor: 'pointer',
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 14 }}>{error}</p>}

      {rows && (
        <div style={{ marginTop: 24 }}>
          {source && (
            <p style={{ fontSize: 13, color: '#999', margin: '0 0 4px' }}>from {source}</p>
          )}
          <p style={{ fontSize: 13, color: '#777', margin: '0 0 14px' }}>
            {newCount} new{haveCount ? ` · ${haveCount} already in your library` : ''}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {rows.map((r, i) => (
              <button
                key={i}
                onClick={() => !r.inLibrary && toggle(i)}
                disabled={r.inLibrary}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left',
                  padding: '12px 0', borderBottom: '1px solid #F0F0F0', background: 'none',
                  border: 'none', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: '#F0F0F0',
                  cursor: r.inLibrary ? 'default' : 'pointer', width: '100%',
                  opacity: r.inLibrary ? 0.45 : 1,
                }}
              >
                <div style={{
                  flexShrink: 0, marginTop: 2, width: 20, height: 20, borderRadius: 6,
                  border: r.checked ? '1.5px solid #111' : '1.5px solid #CCC',
                  background: r.checked ? '#111' : '#fff',
                  color: '#fff', fontSize: 13, lineHeight: '18px', textAlign: 'center',
                }}>
                  {r.inLibrary ? '' : r.checked ? '✓' : ''}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#111', lineHeight: 1.3 }}>
                    {r.title}
                    {r.inLibrary && <span style={{ fontSize: 12, fontWeight: 400, color: '#999' }}> · in library</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#888', margin: '1px 0 0' }}>
                    {[typeLabel(r.type), r.creator, r.year].filter(Boolean).join(' · ')}
                  </div>
                  {r.blurb && (
                    <div style={{ fontSize: 13, color: '#666', lineHeight: 1.45, marginTop: 5 }}>
                      {r.blurb}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={saving || selected.length === 0}
            style={{
              width: '100%', marginTop: 20, padding: '14px',
              background: saving || selected.length === 0 ? '#E2E2E2' : '#111111',
              color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 600, letterSpacing: '0.2px',
              cursor: saving || selected.length === 0 ? 'default' : 'pointer',
            }}
          >
            {saving ? 'saving…' : `save ${selected.length} to want to`}
          </button>
        </div>
      )}

      {done != null && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: '#111', fontWeight: 600 }}>
            saved {done} to want to ✨
          </p>
          <button
            onClick={() => navigate('/library')}
            style={{
              marginTop: 12, padding: '12px 24px', background: '#111111', color: '#fff',
              border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            go to library
          </button>
        </div>
      )}
    </div>
  )
}
