import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useItems } from '../hooks/useItems'
import { ConfirmSheet, type AiResult } from '../components/ConfirmSheet'
import { BulkConfirmSheet, type BulkItem } from '../components/BulkConfirmSheet'
import type { ItemReaction } from '../lib/database.types'
import { authHeaders } from '../lib/supabase'

interface Candidate {
  title: string
  creator: string
  type: string
  year: number | null
}

async function identifyText(input: string, typeHint?: string | null): Promise<AiResult> {
  const res = await fetch('/api/identify', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ input, typeHint: typeHint || undefined }),
  })
  if (!res.ok) throw new Error(res.status === 401 ? 'auth_error' : 'AI request failed')
  return res.json()
}

async function describeToSearch(input: string): Promise<{ searchQuery: string; type: string | null; sortByRecency?: boolean }> {
  const res = await fetch('/api/describe', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ input }),
  })
  if (!res.ok) { console.warn('[describe] HTTP', res.status, '— using raw input'); return { searchQuery: input, type: null } }
  const r = await res.json()
  console.log('[describe]', input, '→', r)
  return r
}

async function catalogLookup(q: string, recency = false): Promise<Candidate[]> {
  const url = `/api/lookup?q=${encodeURIComponent(q)}${recency ? '&recency=1' : ''}`
  const res = await fetch(url)
  if (!res.ok) { console.error('[lookup] HTTP', res.status, url); return [] }
  const data = await res.json()
  console.log('[lookup]', url, '→', data.results?.length ?? 0, 'results')
  const { results } = data
  return Array.isArray(results) ? results : []
}

function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Shrink large photos in the browser before upload. Keeps the request under the
// host's body-size limit AND speeds up identification, with no loss for recognition
// (the AI doesn't need full resolution to read a poster/cover). Re-encoding to JPEG
// also normalizes iPhone HEIC photos, the only types the AI accepts. Falls back to
// the raw file if the browser can't decode it.
async function prepareImage(file: File): Promise<{ base64: string; mimeType: string }> {
  const MAX_EDGE = 1600
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' }
  } catch {
    return { base64: await fileToBase64(file), mimeType: file.type || 'image/png' }
  }
}

async function identifyImage(file: File, typeHint?: string | null): Promise<AiResult> {
  const { base64, mimeType } = await prepareImage(file)
  const res = await fetch('/api/identify', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ imageBase64: base64, mimeType, typeHint: typeHint || undefined }),
  })
  if (!res.ok) throw new Error(res.status === 401 ? 'auth_error' : 'AI request failed')
  return res.json()
}

export function AddScreen() {
  const { addItem } = useItems()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [aiResult, setAiResult] = useState<AiResult | null>(null)
  const [aiSource, setAiSource] = useState('quick add')
  const [aiQuery, setAiQuery] = useState('') // the exact text the user typed (for "use as typed")
  const typeHint = null
  const imageRef = useRef<HTMLInputElement>(null)
  const [bulkItems, setBulkItems] = useState<BulkItem[] | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [pickerCandidates, setPickerCandidates] = useState<Candidate[] | null>(null)
  const [sonnetPrompt, setSonnetPrompt] = useState(false)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Handle results pre-filled from iOS Shortcut via URL params
  useEffect(() => {
    const t = searchParams.get('title')
    if (!t) return
    const result: AiResult = {
      title: t,
      creator: searchParams.get('creator') ?? '',
      type: searchParams.get('type') ?? 'other',
      year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : null,
      confidence: (searchParams.get('confidence') ?? 'high') as AiResult['confidence'],
      metadata: {},
      tags: [],
      ambiguous: false,
      alternatives: [],
    }
    setAiSource('photo')
    setAiResult(result)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Clipboard reading is handled by the "From Shortcut" button only — no auto-read on mount

  // Handle images shared via iOS share sheet (Web Share Target)
  useEffect(() => {
    if (searchParams.get('shared') !== 'true') return
    caches.open('nospaces-share-target').then(async cache => {
      const response = await cache.match('shared-image')
      if (!response) return
      const blob = await response.blob()
      const file = new File([blob], 'shared.png', { type: blob.type || 'image/png' })
      await cache.delete('shared-image')
      processImageFile(file, 'screenshot')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Desktop paste support (Ctrl+V / Cmd+V)
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (file) processImageFile(file, 'screenshot')
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function processImageFile(file: File, source: string) {
    setError('')
    setLoading(true)
    try {
      const result = await identifyImage(file, typeHint)
      setAiSource(source)
      setAiQuery('')
      setAiResult(result)
    } catch (err) {
      setError(err instanceof Error && err.message === 'auth_error'
        ? 'Session expired — reload the app and try again.'
        : 'Could not identify from image.')
    } finally {
      setLoading(false)
      if (imageRef.current) imageRef.current.value = ''
    }
  }

  async function processMultipleImages(files: File[]) {
    setBulkLoading(true)
    setError('')
    // Build skeleton rows immediately so the sheet can show progress
    const skeletons: BulkItem[] = files.map((file, i) => ({
      id: i,
      file,
      preview: URL.createObjectURL(file),
      result: null,
      error: false,
      checked: false,
    }))
    setBulkItems(skeletons)
    setBulkLoading(false)

    // Identify all in parallel, updating each row as it resolves
    await Promise.all(files.map(async (file, i) => {
      try {
        const result = await identifyImage(file, typeHint)
        setBulkItems(prev => prev
          ? prev.map(it => it.id === i ? { ...it, result, checked: result.confidence !== 'low' } : it)
          : prev)
      } catch {
        setBulkItems(prev => prev
          ? prev.map(it => it.id === i ? { ...it, error: true } : it)
          : prev)
      }
    }))
  }

  async function handleBulkConfirm(items: BulkItem[], status: 'want_to' | 'done') {
    const done = status === 'done' ? { reaction: null, note: '' } : undefined
    for (const item of items) {
      if (!item.result) continue
      await addItem(item.result.title, item.result.type, item.result.creator, item.result.year, item.result.metadata, item.result.tags, done)
    }
    // Revoke object URLs to free memory
    bulkItems?.forEach(i => URL.revokeObjectURL(i.preview))
    setBulkItems(null)
    navigate('/library')
  }

  async function handleSubmit(e: React.FormEvent | React.KeyboardEvent) {
    e.preventDefault()
    if (!title.trim() || loading) return
    setError('')
    setLoading(true)
    try {
      // Step 1: Haiku intent parse
      const { searchQuery, type: parsedType, sortByRecency } = await describeToSearch(title.trim())

      // Step 2: Catalog lookup
      if (searchQuery.trim()) {
        const all = await catalogLookup(searchQuery.trim(), sortByRecency)
        const typed = parsedType ? all.filter(r => r.type === parsedType) : all
        const candidates = typed.length > 0 ? typed : all
        if (candidates.length > 0) {
          setPickerCandidates(candidates)
          setLoading(false)
          return
        }
      }

      // Step 3: No catalog results — prompt before using Sonnet
      setSonnetPrompt(true)
    } catch (err) {
      if (err instanceof Error && err.message === 'auth_error') {
        setError('Session expired — reload the app and try again.')
      } else {
        setError('Could not reach AI — saved as typed.')
        await addItem(title.trim())
        setTitle('')
        navigate('/library')
      }
    } finally {
      setLoading(false)
    }
  }

  function handlePickCandidate(candidate: Candidate) {
    const result: AiResult = {
      title: candidate.title,
      creator: candidate.creator,
      type: candidate.type,
      year: candidate.year,
      confidence: 'high',
      metadata: {},
      tags: [],
      blurb: null,
      ambiguous: false,
      alternatives: [],
    }
    setPickerCandidates(null)
    setAiSource('quick add')
    setAiQuery(title.trim())
    setAiResult(result)
  }

  async function handleFallbackIdentify() {
    setPickerCandidates(null)
    setSonnetPrompt(false)
    setLoading(true)
    try {
      const result = await identifyText(title.trim(), typeHint)
      setAiSource('quick add')
      setAiQuery(title.trim())
      setAiResult(result)
    } catch (err) {
      if (err instanceof Error && err.message === 'auth_error') {
        setError('Session expired — reload the app and try again.')
      } else {
        setError('Could not reach AI — saved as typed.')
        await addItem(title.trim())
        setTitle('')
        navigate('/library')
      }
    } finally {
      setLoading(false)
    }
  }


  async function handleConfirm(item: AiResult, done: { reaction: ItemReaction | null; note: string } | null) {
    const metadata = item.blurb ? { ...item.metadata, capturedBlurb: item.blurb } : item.metadata
    await addItem(item.title, item.type, item.creator, item.year, metadata, item.tags, done ?? undefined)
    navigator.clipboard?.writeText('').catch(() => {})
    setAiResult(null)
    setTitle('')
    navigate('/library')
  }

  async function handleSaveAsScratch() {
    // Empty box → just guide them into typing the description (the scratch text IS the title).
    if (!title.trim()) { inputRef.current?.focus(); return }
    await addItem(title.trim(), 'other', null, null, { scratch: true, review: true }, [])
    setTitle('')
    navigate('/library')
  }


  return (
    <div style={{ padding: '16px 16px calc(80px + env(safe-area-inset-bottom))', background: '#fff', minHeight: '100dvh' }}>

      {/* Header row — close button only, no title */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ABA69C', padding: '4px', lineHeight: 1, fontSize: 20 }}
          aria-label="close"
        >
          ×︎
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) }
          }}
          placeholder="a film, book, album, or show — or describe it"
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px', fontSize: 15,
            border: '1px solid #E4E4E4', borderRadius: 8,
            resize: 'none', fontFamily: 'inherit', outline: 'none', lineHeight: 1.5,
          }}
        />

        <button
          type="submit"
          disabled={!title.trim() || loading}
          style={{
            width: '100%', marginTop: 10, padding: '12px',
            background: title.trim() && !loading ? '#1C1B19' : '#E2E2E2',
            color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 600, letterSpacing: '0.2px',
            cursor: title.trim() && !loading ? 'pointer' : 'default',
            transition: 'background 0.15s ease',
          }}
        >
          {loading ? 'identifying…' : 'identify & save'}
        </button>

        {error && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error.toLowerCase()}</p>}

        {sonnetPrompt && !loading && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: '#F7F7F7', borderRadius: 8, textAlign: 'center' }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#555' }}>
              nothing found in the catalog — identify with Sonnet instead?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={handleFallbackIdentify}
                style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                identify with Sonnet
              </button>
              <button
                onClick={() => setSonnetPrompt(false)}
                style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #DDD', background: 'none', color: '#888', fontSize: 13, cursor: 'pointer' }}
              >
                cancel
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Utility row — photo + note */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 18 }}>
        <button
          type="button"
          onClick={() => !bulkLoading && imageRef.current?.click()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6F6B64', padding: 0 }}
        >
          <CameraIcon />
          {bulkLoading ? 'identifying…' : 'add from photos'}
        </button>
        <span style={{ color: '#DEDAD6', fontSize: 12 }}>·</span>
        {!loading && (
          <button
            type="button"
            onClick={handleSaveAsScratch}
            style={{ border: 'none', background: 'none', color: '#6F6B64', fontSize: 13, cursor: 'pointer', padding: 0 }}
          >
            save as note
          </button>
        )}
      </div>

      {/* Other ways to add */}
      <div style={{ marginTop: 28, borderTop: '1px solid #ECEAE6', paddingTop: 18 }}>
        <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#ABA69C' }}>other ways to add</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={() => navigate('/recommend')} style={{ border: 'none', background: 'none', color: '#6F6B64', fontSize: 13, cursor: 'pointer', padding: 0, textAlign: 'left' }}>find recommendations</button>
          <button type="button" onClick={() => navigate('/import')} style={{ border: 'none', background: 'none', color: '#6F6B64', fontSize: 13, cursor: 'pointer', padding: 0, textAlign: 'left' }}>import from Letterboxd</button>
          <button type="button" onClick={() => navigate('/spotify')} style={{ border: 'none', background: 'none', color: '#6F6B64', fontSize: 13, cursor: 'pointer', padding: 0, textAlign: 'left' }}>sync from Spotify</button>
        </div>
      </div>


      {/* Image input — single pick → single confirm, multi-pick → bulk confirm */}
      <input ref={imageRef} type="file" accept="image/*" multiple
        onChange={e => {
          const files = Array.from(e.target.files ?? [])
          if (files.length === 0) return
          if (files.length === 1) processImageFile(files[0], 'photo')
          else processMultipleImages(files)
          if (imageRef.current) imageRef.current.value = ''
        }}
        style={{ display: 'none' }} />

      {aiResult && (
        <ConfirmSheet
          result={aiResult}
          source={aiSource}
          query={aiQuery}
          onConfirm={handleConfirm}
          onClose={() => setAiResult(null)}
        />
      )}

      {bulkItems && (
        <BulkConfirmSheet
          items={bulkItems}
          onConfirm={handleBulkConfirm}
          onClose={() => { bulkItems.forEach(i => URL.revokeObjectURL(i.preview)); setBulkItems(null) }}
        />
      )}

      {pickerCandidates && (
        <PickerSheet
          query={title.trim()}
          candidates={pickerCandidates}
          onPick={handlePickCandidate}
          onFallback={handleFallbackIdentify}
          onClose={() => setPickerCandidates(null)}
        />
      )}
    </div>
  )
}


function CameraIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
}


function PickerSheet({ query, candidates, onPick, onFallback, onClose }: {
  query: string
  candidates: Candidate[]
  onPick: (c: Candidate) => void
  onFallback: () => void
  onClose: () => void
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: '#fff', borderRadius: '20px 20px 0 0',
        padding: '20px 0 calc(env(safe-area-inset-bottom) + 24px)',
        maxHeight: '70dvh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid #ECEAE6', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 11, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            results for "{query}"
          </p>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {candidates.map((c, i) => (
            <button
              key={i}
              onClick={() => onPick(c)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%', padding: '14px 20px',
                background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer',
                borderBottom: i < candidates.length - 1 ? '1px solid #F4F4F4' : 'none',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.3px', color: '#AAA', flexShrink: 0, width: 30 }}>{c.type === 'other' ? '' : c.type}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 500, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.title}
                </span>
                <span style={{ display: 'block', fontSize: 13, color: '#888', marginTop: 1 }}>
                  {[c.creator, c.year].filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div style={{ padding: '16px 20px 0', borderTop: '1px solid #ECEAE6', flexShrink: 0, textAlign: 'center' }}>
          <button
            onClick={onFallback}
            style={{ background: 'none', border: 'none', fontSize: 13, color: '#999', cursor: 'pointer', padding: 0 }}
          >
            none of these — identify with Sonnet instead
          </button>
        </div>
      </div>
    </>
  )
}

