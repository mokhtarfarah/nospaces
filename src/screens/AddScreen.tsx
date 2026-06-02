import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useItems } from '../hooks/useItems'
import { ConfirmSheet, type AiResult } from '../components/ConfirmSheet'

async function identifyText(input: string, typeHint?: string | null): Promise<AiResult> {
  const res = await fetch('/api/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, typeHint: typeHint || undefined }),
  })
  if (!res.ok) throw new Error('AI request failed')
  return res.json()
}

async function identifyImage(file: File, typeHint?: string | null): Promise<AiResult> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const res = await fetch('/api/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/png', typeHint: typeHint || undefined }),
  })
  if (!res.ok) throw new Error('AI request failed')
  return res.json()
}

export function AddScreen() {
  const { items, addItem } = useItems()
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
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const recent = items.slice(0, 4)

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


  async function handleConfirm(item: AiResult) {
    await addItem(item.title, item.type, item.creator, item.year, item.metadata, item.tags)
    // Clear clipboard now that we've saved
    navigator.clipboard?.writeText('').catch(() => {})
    setAiResult(null)
    setTitle('')
    navigate('/library')
  }

  return (
    <div style={{ padding: '56px 16px 0', background: '#fff', minHeight: '100dvh' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 24px', letterSpacing: '-0.2px' }}>Add</h1>

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

        {/* Optional type hint — helps the AI pick the right category */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
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
                {t === 'tv' ? 'TV' : t.charAt(0).toUpperCase() + t.slice(1)}
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
          {loading ? 'Identifying…' : 'Identify & Save'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 4px' }}>
          <div style={{ flex: 1, height: 1, background: '#EEE' }} />
          <span style={{ fontSize: 11, color: '#BBB' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#EEE' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <CaptureButton label="Add from a photo" icon={<CameraIcon />} onClick={() => imageRef.current?.click()} />
        </div>

        {error && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error}</p>}
      </form>

      {/* Single image input — iOS shows camera + photo library options */}
      <input ref={imageRef} type="file" accept="image/*"
        onChange={e => { const f = e.target.files?.[0]; if (f) processImageFile(f, 'photo') }}
        style={{ display: 'none' }} />

      {recent.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#999', letterSpacing: '0.5px', marginBottom: 8, textTransform: 'uppercase' }}>
            Recently added
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {recent.map(item => (
              <span key={item.id} style={{ padding: '4px 10px', background: '#F2F2F2', borderRadius: 20, fontSize: 12, color: '#444' }}>
                {item.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {aiResult && (
        <ConfirmSheet
          result={aiResult}
          source={aiSource}
          query={aiQuery}
          onConfirm={handleConfirm}
          onClose={() => setAiResult(null)}
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

