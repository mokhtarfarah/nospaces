import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useItems } from '../hooks/useItems'

interface RecItem {
  rank: number
  title: string
  creator: string | null
  type: string
  year: number | null
  tags: string[]
  blurb: string
}

interface Row extends RecItem {
  inLibrary: boolean
  checked: boolean
}

const norm = (s: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const typeLabel = (t: string) => (t === 'tv' ? 'tv' : t)

export function RecommendScreen() {
  const { items, importItems } = useItems()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  const libraryKeys = useMemo(
    () => new Set(items.map(i => `${i.type}|${norm(i.title)}`)),
    [items],
  )

  async function handlePdf(file: File) {
    if (loading) return
    if (file.size > 3 * 1024 * 1024) {
      setError(`PDF is too large (${(file.size / 1024 / 1024).toFixed(1)}MB — max 3MB). Try printing just the article page.`)
      return
    }
    setError(''); setRows(null); setDone(null); setLoading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64 }),
      })
      if (!res.ok) {
        if (res.status === 413) {
          setError('PDF is too large for the server. Try printing just the article page.')
        } else {
          const body = await res.json().catch(() => ({})) as { error?: string }
          setError(body.error ?? `Server error ${res.status} — try again.`)
        }
        return
      }
      const data = await res.json() as { source: string; sourceUrl: string; items: RecItem[]; error?: string }
      if (data.error) { setError(data.error); return }
      if (!data.items?.length) {
        setError("Couldn't find a list in that PDF. Make sure it contains a numbered or ranked list.")
        return
      }
      setSource(data.source || file.name)
      setSourceUrl(data.sourceUrl || '')
      setRows(data.items.map(it => {
        const inLibrary = libraryKeys.has(`${it.type}|${norm(it.title)}`)
        return { ...it, inLibrary, checked: !inLibrary }
      }))
    } catch {
      setError('Could not read the PDF. Try again or use a different file.')
    } finally {
      setLoading(false)
      if (pdfRef.current) pdfRef.current.value = ''
    }
  }

  function toggle(i: number) {
    setRows(prev => prev && prev.map((r, idx) => idx === i ? { ...r, checked: !r.checked } : r))
  }

  const selectableCount = rows?.filter(r => !r.inLibrary).length ?? 0
  const selected = rows?.filter(r => r.checked) ?? []
  const allChecked = selected.length === selectableCount && selectableCount > 0

  function toggleAll() {
    setRows(prev => prev && prev.map(r => r.inLibrary ? r : { ...r, checked: !allChecked }))
  }

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
        note: null,
        source: 'manual',
        source_detail: 'recommendation',
        recommended_by: source,
        metadata: {
          ...(sourceUrl ? { recommendationUrl: sourceUrl } : {}),
          ...(r.blurb ? { recommendationBlurb: r.blurb } : {}),
        },
        tags: r.tags,
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
      <p style={{ fontSize: 14, color: '#777', lineHeight: 1.5, margin: '0 0 24px' }}>
        Save any "best of" or ranked list as a PDF, upload it here, and pick what to add to your library.
        Works for paywalled sites — save while logged in.
      </p>

      {!rows && done == null && (
        <>
          <button
            onClick={() => !loading && pdfRef.current?.click()}
            disabled={loading}
            style={{
              width: '100%', padding: '20px 16px', border: '1.5px dashed #D8D8D8', borderRadius: 14,
              background: '#FAFAFA', color: loading ? '#CCC' : '#555', fontSize: 15,
              cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 10,
            }}
          >
            <PdfIcon />
            {loading ? 'reading pdf… (~30s)' : 'choose a PDF'}
          </button>
          <p style={{ fontSize: 12, color: '#AAA', margin: '8px 0 0', textAlign: 'center' }}>
            on iPhone: open the article, share → print → pinch out on the preview → share PDF
          </p>
          <input
            ref={pdfRef}
            type="file"
            accept="application/pdf"
            onChange={e => { const f = e.target.files?.[0]; if (f) handlePdf(f) }}
            style={{ display: 'none' }}
          />
        </>
      )}

      {error && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 14 }}>{error}</p>}

      {rows && (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            {source && (
              sourceUrl
                ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#999', textDecoration: 'underline', textUnderlineOffset: 2 }}>{source}</a>
                : <span style={{ fontSize: 13, color: '#999' }}>{source}</span>
            )}
            <button
              onClick={toggleAll}
              style={{ border: 'none', background: 'none', fontSize: 13, color: '#555', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, padding: 0, marginLeft: 'auto' }}
            >
              {allChecked ? 'deselect all' : 'select all'}
            </button>
          </div>
          <p style={{ fontSize: 13, color: '#777', margin: '0 0 14px' }}>
            {newCount} new{haveCount ? ` · ${haveCount} already in your library` : ''}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((r, i) => (
              <button
                key={i}
                onClick={() => !r.inLibrary && toggle(i)}
                disabled={r.inLibrary}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left',
                  padding: '12px 0', borderBottom: '1px solid #F0F0F0',
                  background: 'none', border: 'none', borderBottomWidth: 1,
                  borderBottomStyle: 'solid', borderBottomColor: '#F0F0F0',
                  cursor: r.inLibrary ? 'default' : 'pointer', width: '100%',
                  opacity: r.inLibrary ? 0.45 : 1,
                }}
              >
                <div style={{ flexShrink: 0, width: 22, textAlign: 'right', fontSize: 12, color: '#BBB', paddingTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                  {r.rank}
                </div>
                <div style={{
                  flexShrink: 0, marginTop: 2, width: 20, height: 20, borderRadius: 6,
                  border: r.checked ? '1.5px solid #111' : '1.5px solid #CCC',
                  background: r.checked ? '#111' : '#fff',
                  color: '#fff', fontSize: 13, lineHeight: '18px', textAlign: 'center',
                }}>
                  {!r.inLibrary && r.checked ? '✓' : ''}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#111', lineHeight: 1.3 }}>
                    {r.title}
                    {r.inLibrary && <span style={{ fontSize: 12, fontWeight: 400, color: '#999' }}> · in library</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#888', margin: '1px 0 0' }}>
                    {[typeLabel(r.type), r.creator, r.year].filter(Boolean).join(' · ')}
                  </div>
                  {r.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                      {r.tags.map(tag => (
                        <span key={tag} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#F2F2F2', color: '#666' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
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

          <button
            onClick={() => { setRows(null); setSource(''); setSourceUrl('') }}
            style={{ width: '100%', marginTop: 10, padding: '10px', background: 'none', border: 'none', color: '#999', fontSize: 13, cursor: 'pointer' }}
          >
            upload a different PDF
          </button>
        </div>
      )}

      {done != null && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: '#111', fontWeight: 600 }}>
            saved {done} to want to ✨
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
            <button
              onClick={() => { setDone(null) }}
              style={{ padding: '12px 20px', background: '#fff', border: '1px solid #E4E4E4', borderRadius: 12, fontSize: 14, cursor: 'pointer', color: '#555' }}
            >
              upload another
            </button>
            <button
              onClick={() => navigate('/library')}
              style={{ padding: '12px 20px', background: '#111111', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              go to library
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PdfIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="13" y2="17"/>
    </svg>
  )
}
