import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useItems } from '../hooks/useItems'
import { ConfirmSheet, type AiResult } from '../components/ConfirmSheet'
import { BulkConfirmSheet, type BulkItem } from '../components/BulkConfirmSheet'
import type { ItemReaction } from '../lib/database.types'

async function identifyText(input: string, typeHint?: string | null): Promise<AiResult> {
  const res = await fetch('/api/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, typeHint: typeHint || undefined }),
  })
  if (!res.ok) throw new Error('AI request failed')
  return res.json()
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mimeType, typeHint: typeHint || undefined }),
  })
  if (!res.ok) throw new Error('AI request failed')
  return res.json()
}

import type { Item } from '../lib/database.types'

function LibraryTools({ items, editItem }: {
  items: Item[]
  editItem: (id: string, fields: Record<string, unknown>) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
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

  const untagged = useMemo(() =>
    items.filter(i => (!i.tags || i.tags.length === 0) && ['film','tv','book','music'].includes(i.type)), [items])
  const needsRuntime = useMemo(() =>
    items.filter(i => {
      if (i.type === 'film' || i.type === 'tv') return !i.metadata?.runtime
      if (i.type === 'book') return !i.metadata?.pages
      return false
    }), [items])
  const needsMoodMigration = useMemo(() =>
    items.filter(i => i.moods?.some(m => m === 'gripping' || m === 'project' || m === 'easy')), [items])

  const total = untagged.length + needsRuntime.length + needsMoodMigration.length
  if (total === 0) return null

  async function runBackfill() {
    if (backfilling || untagged.length === 0) return
    cancelRef.current = false
    setBackfilling(true); setBackfillProgress(0); setBackfillTotal(untagged.length)
    const BATCH = 5
    for (let i = 0; i < untagged.length; i += BATCH) {
      if (cancelRef.current) break
      await Promise.all(untagged.slice(i, i + BATCH).map(async item => {
        try {
          const res = await fetch('/api/genres', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: item.title, creator: item.creator, type: item.type }) })
          const { tags } = await res.json()
          if (tags?.length > 0) await editItem(item.id, { tags })
        } catch { /* skip */ }
      }))
      setBackfillProgress(Math.min(i + BATCH, untagged.length))
    }
    setBackfilling(false); cancelRef.current = false
  }

  async function runRtBackfill() {
    if (rtBackfilling || needsRuntime.length === 0) return
    rtCancelRef.current = false
    setRtBackfilling(true); setRtProgress(0); setRtTotal(needsRuntime.length)
    const BATCH = 5
    for (let i = 0; i < needsRuntime.length; i += BATCH) {
      if (rtCancelRef.current) break
      await Promise.all(needsRuntime.slice(i, i + BATCH).map(async item => {
        try {
          const res = await fetch('/api/runtime', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: item.title, creator: item.creator, type: item.type, year: item.year }) })
          const data = await res.json()
          const patch: Record<string, unknown> = { ...item.metadata }
          if (item.type === 'book' && typeof data.pages === 'number') patch.pages = data.pages
          if ((item.type === 'film' || item.type === 'tv') && typeof data.runtime === 'number') patch.runtime = data.runtime
          if (patch.pages !== item.metadata?.pages || patch.runtime !== item.metadata?.runtime) await editItem(item.id, { metadata: patch })
        } catch { /* skip */ }
      }))
      setRtProgress(Math.min(i + BATCH, needsRuntime.length))
    }
    setRtBackfilling(false); rtCancelRef.current = false
  }

  async function runMoodMigration() {
    if (migrating || needsMoodMigration.length === 0) return
    setMigrating(true); setMigrateProgress(0)
    for (const item of needsMoodMigration) {
      const next = (item.moods ?? []).map(m => m === 'gripping' ? 'intense' : m).filter(m => m !== 'project' && m !== 'easy')
      try { await editItem(item.id, { moods: [...new Set(next)] }) } catch { /* skip */ }
      setMigrateProgress(p => p + 1)
    }
    setMigrating(false)
  }

  const btnStyle = { padding: '7px 16px', borderRadius: 20, border: '1.5px solid #111', background: '#111', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' } as const

  return (
    <div style={{ marginTop: 32, borderTop: '1px solid #ECEAE6', paddingTop: 16, textAlign: 'center' }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#AAA', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
        {open ? 'hide library tools' : 'library tools'}
      </button>
      {open && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {untagged.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#888' }}>{untagged.length} item{untagged.length !== 1 ? 's' : ''} without genre tags</span>
              {backfilling
                ? <span style={{ fontSize: 13, color: '#555' }}>tagging {Math.min(backfillProgress + 5, backfillTotal)} of {backfillTotal}… <button onClick={() => { cancelRef.current = true }} style={{ background: 'none', border: 'none', fontSize: 12, color: '#BBB', cursor: 'pointer' }}>cancel</button></span>
                : <button onClick={runBackfill} style={btnStyle}>tag my library</button>}
            </div>
          )}
          {needsRuntime.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#888' }}>{needsRuntime.length} item{needsRuntime.length !== 1 ? 's' : ''} missing runtime or pages</span>
              {rtBackfilling
                ? <span style={{ fontSize: 13, color: '#555' }}>filling {Math.min(rtProgress + 5, rtTotal)} of {rtTotal}… <button onClick={() => { rtCancelRef.current = true }} style={{ background: 'none', border: 'none', fontSize: 12, color: '#BBB', cursor: 'pointer' }}>cancel</button></span>
                : <button onClick={runRtBackfill} style={btnStyle}>fill in</button>}
            </div>
          )}
          {needsMoodMigration.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#888' }}>{needsMoodMigration.length} item{needsMoodMigration.length !== 1 ? 's' : ''} use old vibe words</span>
              {migrating
                ? <span style={{ fontSize: 13, color: '#555' }}>updating {migrateProgress} of {needsMoodMigration.length}…</span>
                : <button onClick={runMoodMigration} style={btnStyle}>clean up</button>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AddScreen() {
  const { addItem, items, editItem } = useItems()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [aiResult, setAiResult] = useState<AiResult | null>(null)
  const [aiSource, setAiSource] = useState('quick add')
  const [aiQuery, setAiQuery] = useState('') // the exact text the user typed (for "use as typed")
  const [typeHint, setTypeHint] = useState<string | null>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const [bulkItems, setBulkItems] = useState<BulkItem[] | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
    } catch {
      setError('Could not identify from image.')
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

  async function handleBulkConfirm(items: BulkItem[]) {
    for (const item of items) {
      if (!item.result) continue
      await addItem(item.result.title, item.result.type, item.result.creator, item.result.year, item.result.metadata, item.result.tags)
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
      const result = await identifyText(title.trim(), typeHint)
      setAiSource('quick add')
      setAiQuery(title.trim())
      setAiResult(result)
    } catch {
      setError('Could not reach AI — saved as typed.')
      await addItem(title.trim())
      setTitle('')
      navigate('/library')
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
    await addItem(title.trim(), 'other', null, null, { scratch: true }, [])
    setTitle('')
    navigate('/library')
  }

  const [moreWaysOpen, setMoreWaysOpen] = useState(false)

  return (
    <div style={{ padding: '56px 16px 0', background: '#fff', minHeight: '100dvh' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 32px', letterSpacing: '-0.2px' }}>add</h1>

      <form onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) }
          }}
          placeholder="A film, book, album, or show — or describe it"
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '14px', fontSize: 16,
            border: '1px solid #E4E4E4', borderRadius: 12,
            resize: 'none', fontFamily: 'inherit', outline: 'none', lineHeight: 1.5,
          }}
        />

        {/* Optional type hint — part of the input setup, between box and button */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {(['film', 'book', 'music', 'tv'] as const).map(t => {
            const active = typeHint === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeHint(active ? null : t)}
                style={{
                  padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12,
                  border: active ? '1.5px solid #111' : '1.5px solid #E4E4E4',
                  background: active ? '#111' : '#F7F7F7',
                  color: active ? '#fff' : '#999', fontWeight: active ? 600 : 400,
                }}
              >
                {t}
              </button>
            )
          })}
        </div>

        <button
          type="submit"
          disabled={!title.trim() || loading}
          style={{
            width: '100%', marginTop: 12, padding: '14px',
            background: title.trim() && !loading ? '#111111' : '#E2E2E2',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 600, letterSpacing: '0.2px',
            cursor: title.trim() && !loading ? 'pointer' : 'default',
          }}
        >
          {loading ? 'identifying…' : 'identify & save'}
        </button>

        {/* Photo — compact grey pill, clearly a different input mode */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            type="button"
            onClick={() => !bulkLoading && imageRef.current?.click()}
            style={{
              padding: '10px 22px', borderRadius: 24, border: 'none',
              background: '#F0F0F0', fontSize: 14, color: '#444', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            <CameraIcon />
            {bulkLoading ? 'identifying…' : 'add from photos'}
          </button>
        </div>

        {!loading && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              type="button"
              onClick={handleSaveAsScratch}
              style={{ border: 'none', background: 'none', color: '#BBB', fontSize: 13, cursor: 'pointer', padding: 0 }}
            >
              save as note
            </button>
          </div>
        )}

        {error && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error.toLowerCase()}</p>}
      </form>

      <div style={{ marginTop: 40, borderTop: '1px solid #ECEAE6', paddingTop: 16, textAlign: 'center' }}>
        <button
          onClick={() => setMoreWaysOpen(o => !o)}
          style={{ background: 'none', border: 'none', fontSize: 12, color: '#BBB', cursor: 'pointer', padding: 0 }}
        >
          {moreWaysOpen ? 'hide' : 'more ways to add'}
        </button>
        {moreWaysOpen && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/recommend')}
              style={{ border: 'none', background: 'none', color: '#999', fontSize: 13, cursor: 'pointer', padding: 0 }}
            >
              find recommendations
            </button>
            <button
              type="button"
              onClick={() => navigate('/import')}
              style={{ border: 'none', background: 'none', color: '#999', fontSize: 13, cursor: 'pointer', padding: 0 }}
            >
              import from Letterboxd
            </button>
            <button
              type="button"
              onClick={() => navigate('/spotify')}
              style={{ border: 'none', background: 'none', color: '#999', fontSize: 13, cursor: 'pointer', padding: 0 }}
            >
              sync from Spotify
            </button>
          </div>
        )}
      </div>

      {/* Library tools — backfill genre tags, runtime, and vibe cleanup */}
      <LibraryTools items={items} editItem={editItem} />

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
    </div>
  )
}


function CameraIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
}

