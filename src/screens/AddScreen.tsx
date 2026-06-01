import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useItems } from '../hooks/useItems'
import { ConfirmSheet, type AiResult } from '../components/ConfirmSheet'

async function identifyText(input: string): Promise<AiResult> {
  const res = await fetch('/api/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  })
  if (!res.ok) throw new Error('AI request failed')
  return res.json()
}

async function identifyImage(file: File): Promise<AiResult> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const res = await fetch('/api/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
  })
  if (!res.ok) throw new Error('AI request failed')
  return res.json()
}

export function AddScreen() {
  const { items, addItem } = useItems()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [aiResult, setAiResult] = useState<AiResult | null>(null)
  const [aiSource, setAiSource] = useState('quick add')
  const photoRef = useRef<HTMLInputElement>(null)

  const recent = items.slice(0, 4)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || loading) return
    setError('')
    setLoading(true)
    try {
      const result = await identifyText(title.trim())
      setAiSource('quick add')
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

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setLoading(true)
    try {
      const result = await identifyImage(file)
      setAiSource('photo')
      setAiResult(result)
    } catch {
      setError('Could not identify from photo.')
    } finally {
      setLoading(false)
      if (photoRef.current) photoRef.current.value = ''
    }
  }

  async function handleConfirm(item: AiResult) {
    await addItem(item.title, item.type, item.creator, item.year, item.metadata, item.tags)
    setAiResult(null)
    setTitle('')
    navigate('/library')
  }

  return (
    <div style={{ padding: '56px 16px 0', background: '#fff', minHeight: '100dvh' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 24px', letterSpacing: '-0.3px' }}>Add</h1>

      <form onSubmit={handleSubmit}>
        <textarea
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title, name, or description..."
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px', fontSize: 16,
            border: '1.5px solid #E0E0E0', borderRadius: 12,
            resize: 'none', fontFamily: 'inherit', outline: 'none', lineHeight: 1.5,
          }}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <CaptureButton label="Photo" icon="📷" onClick={() => photoRef.current?.click()} />
          <CaptureButton label="Screenshot" icon="✂️" onClick={() => photoRef.current?.click()} />
          <CaptureButton label="save@..." icon="✉️" onClick={() => {}} />
        </div>

        {/* Hidden file input */}
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhoto}
          style={{ display: 'none' }}
        />

        <button
          type="submit"
          disabled={!title.trim() || loading}
          style={{
            width: '100%', marginTop: 16, padding: '14px',
            background: title.trim() && !loading ? '#002FA7' : '#ccc',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 16, fontWeight: 600,
            cursor: title.trim() && !loading ? 'pointer' : 'default',
          }}
        >
          {loading ? 'Identifying...' : 'Identify & Save'}
        </button>

        {error && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error}</p>}
      </form>

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
          onConfirm={handleConfirm}
          onClose={() => setAiResult(null)}
        />
      )}
    </div>
  )
}

function CaptureButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 8px',
        border: '1.5px solid #E0E0E0', borderRadius: 10,
        background: '#fff', fontSize: 12, color: '#555', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      {label}
    </button>
  )
}
