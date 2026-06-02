import { useState } from 'react'
import type { Item } from '../lib/database.types'
import { typeColor, TYPE_COLORS } from '../lib/colors'

interface Props {
  item: Item
  onEdit: (fields: { title: string; creator: string | null; type: string; year: number | null }) => void
  onDelete: () => void
  onClose: () => void
}

const TYPES = ['film', 'book', 'music', 'tv', 'other']

export function ItemActionSheet({ item, onEdit, onDelete, onClose }: Props) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [creator, setCreator] = useState(item.creator ?? '')
  const [type, setType] = useState(item.type)
  const [year, setYear] = useState(item.year?.toString() ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const color = typeColor(item.type)

  function handleSave() {
    onEdit({
      title: title.trim() || item.title,
      creator: creator.trim() || null,
      type,
      year: year ? parseInt(year) : null,
    })
    onClose()
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '12px 20px 48px', zIndex: 201,
        maxWidth: 480, margin: '0 auto',
      }}>
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 20px' }} />

        {!editing ? (
          <>
            {/* Item preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 4, height: 40, borderRadius: 2, background: color.border, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {[TYPE_COLORS[item.type]?.label ?? item.type, item.creator, item.year].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>

            {/* Actions */}
            <button onClick={() => setEditing(true)} style={actionBtn('#333')}>
              Edit details
            </button>

            {confirmDelete ? (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 13, color: '#C0392B', textAlign: 'center', marginBottom: 10 }}>
                  Delete "{item.title}"? This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmDelete(false)} style={{ ...actionBtn('#333'), flex: 1 }}>
                    Cancel
                  </button>
                  <button onClick={onDelete} style={{ ...actionBtn('#fff'), flex: 1, background: '#C0392B', border: 'none' }}>
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{ ...actionBtn('#C0392B'), marginTop: 10 }}>
                Delete
              </button>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 16 }}>Edit details</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={inputStyle} />
              <input value={creator} onChange={e => setCreator(e.target.value)} placeholder="Creator" style={inputStyle} />
              <input value={year} onChange={e => setYear(e.target.value)} placeholder="Year" type="number" style={inputStyle} />
            </div>

            {/* Type chips */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
              {TYPES.map(t => {
                const c = typeColor(t)
                const active = type === t
                return (
                  <button key={t} onClick={() => setType(t)} style={{
                    padding: '5px 12px',
                    border: active ? `1.5px solid ${c.border}` : '1.5px solid #E0E0E0',
                    borderRadius: 20,
                    background: active ? c.bg : '#fff',
                    color: active ? c.border : '#555',
                    fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer',
                  }}>
                    {TYPE_COLORS[t]?.label ?? t}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(false)} style={{ ...actionBtn('#333'), flex: 1 }}>Cancel</button>
              <button onClick={handleSave} style={{ ...actionBtn('#fff'), flex: 1, background: '#002FA7', border: 'none' }}>Save</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function actionBtn(color: string): React.CSSProperties {
  return {
    width: '100%', padding: '13px', border: `1.5px solid #E0E0E0`,
    borderRadius: 12, background: '#fff', fontSize: 15,
    fontWeight: 500, color, cursor: 'pointer',
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', border: '1.5px solid #E0E0E0',
  borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none',
}
