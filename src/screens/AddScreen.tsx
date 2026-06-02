import { useState, useRef, useEffect } from 'react'
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
    await addItem(item.title, item.type, item.creator, item.year, item.metadata, item.tags, done ?? undefined)
    navigator.clipboard?.writeText('').catch(() => {})
    setAiResult(null)
    setTitle('')
    navigate('/library')
  }

  async function handleSaveAsScratch() {
    if (!title.trim()) return
    await addItem(title.trim(), 'other', null, null, { scratch: true }, [])
    setTitle('')
    navigate('/library')
  }

  return (
    <div style={{ padding: '56px 16px 0', background: '#fff', minHeight: '100dvh' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 24px', letterSpacing: '-0.2px' }}>Add</h1>

      <form onSubmit={handleSubmit}>
        {/* Optional type hint (above the box) — helps the AI pick the right category */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {(['film', 'book', 'music', 'tv'] as const).map(t => {
            const active = typeHint === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeHint(active ? null : t)}
                style={{
                  padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 13,
                  border: active ? '1.5px solid #111111' : '1.5px solid #E4E4E4',
                  background: active ? '#F0F0F0' : '#fff',
                  color: active ? '#111111' : '#777', fontWeight: active ? 600 : 400,
                }}
              >
                {t === 'tv' ? 'tv' : t}
              </button>
            )
          })}
        </div>

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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 4px' }}>
          <div style={{ flex: 1, height: 1, background: '#EEE' }} />
          <span style={{ fontSize: 11, color: '#BBB' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#EEE' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <CaptureButton
            label={bulkLoading ? 'identifying…' : 'add from photos'}
            icon={<CameraIcon />}
            onClick={() => !bulkLoading && imageRef.current?.click()}
          />
        </div>

        {title.trim() && !loading && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button
              type="button"
              onClick={handleSaveAsScratch}
              style={{ border: 'none', background: 'none', color: '#AAA', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
            >
              can't identify it? save description for later
            </button>
          </div>
        )}

        {error && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error.toLowerCase()}</p>}
      </form>

      <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', gap: 16, justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => navigate('/import')}
          style={{ border: 'none', background: 'none', color: '#999', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          import from Letterboxd
        </button>
        <button
          type="button"
          onClick={() => navigate('/spotify')}
          style={{ border: 'none', background: 'none', color: '#999', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          sync from Spotify
        </button>
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
    </div>
  )
}

function CaptureButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '9px 16px',
        border: '1px solid #E4E4E4', borderRadius: 20,
        background: '#fff', fontSize: 13, color: '#555', cursor: 'pointer',
        display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8,
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function CameraIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
}

