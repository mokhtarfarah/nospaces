import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useItems } from '../hooks/useItems'

export function AddScreen() {
  const { items, addItem } = useItems()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    await addItem(title.trim())
    setSaving(false)
    setTitle('')
    navigate('/library')
  }

  const recent = items.slice(0, 4)

  return (
    <div style={{ padding: '56px 16px 0', background: '#fff', minHeight: '100dvh' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 24px', letterSpacing: '-0.3px' }}>Add</h1>

      <form onSubmit={handleSave}>
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
          <CaptureButton label="Photo" icon="📷" />
          <CaptureButton label="Screenshot" icon="✂️" />
          <CaptureButton label="save@..." icon="✉️" />
        </div>

        <button
          type="submit"
          disabled={!title.trim() || saving}
          style={{
            width: '100%', marginTop: 16, padding: '14px',
            background: title.trim() && !saving ? '#002FA7' : '#ccc',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 16, fontWeight: 600,
            cursor: title.trim() && !saving ? 'pointer' : 'default',
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
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
    </div>
  )
}

function CaptureButton({ label, icon }: { label: string; icon: string }) {
  return (
    <button
      type="button"
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
