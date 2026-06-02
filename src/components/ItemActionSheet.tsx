import { useState } from 'react'
import type { Item, ItemReaction } from '../lib/database.types'
import { typeColor, TYPE_COLORS } from '../lib/colors'
import { useWikipediaLink } from '../lib/wikipedia'

interface Props {
  item: Item
  onEdit: (fields: { title: string; creator: string | null; type: string; year: number | null }) => void
  onEditReaction: (reaction: ItemReaction, note: string) => void
  onDelete: () => void
  onClose: () => void
}

const TYPES = ['film', 'book', 'music', 'tv', 'other']

const REACTIONS: { value: ItemReaction; label: string }[] = [
  { value: 'loved_it',   label: 'Loved it'   },
  { value: 'liked_it',   label: 'Liked it'   },
  { value: 'eh',         label: 'Eh'         },
  { value: 'not_for_me', label: 'Not for me' },
]

const REACTION_LABELS: Record<ItemReaction, string> = {
  loved_it: 'Loved it', liked_it: 'Liked it', eh: 'Eh', not_for_me: 'Not for me',
}

type View = 'main' | 'edit' | 'reaction'

export function ItemActionSheet({ item, onEdit, onEditReaction, onDelete, onClose }: Props) {
  const [view, setView] = useState<View>('main')
  const [title, setTitle] = useState(item.title)
  const [creator, setCreator] = useState(item.creator ?? '')
  const [type, setType] = useState(item.type)
  const [year, setYear] = useState(item.year?.toString() ?? '')
  const [reaction, setReaction] = useState<ItemReaction | null>(item.reaction)
  const [note, setNote] = useState(item.note ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const color = typeColor(item.type)

  // Direct Wikipedia article link (null if no page exists / type not linked).
  const wikiUrl = useWikipediaLink(item.type, item.title, item.creator, item.year)

  function handleSaveDetails() {
    onEdit({
      title: title.trim() || item.title,
      creator: creator.trim() || null,
      type,
      year: year ? parseInt(year) : null,
    })
    onClose()
  }

  function handleSaveReaction() {
    if (!reaction) return
    onEditReaction(reaction, note)
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
        maxHeight: '85dvh', overflowY: 'auto',
      }}>
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 20px' }} />

        {view === 'main' && (
          <>
            {/* Item preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 4, height: 40, borderRadius: 2, background: color.border, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {[TYPE_COLORS[item.type]?.label ?? item.type, item.creator, item.year].filter(Boolean).join(' · ')}
                  {item.reaction && ` · ${REACTION_LABELS[item.reaction]}`}
                </div>
              </div>
            </div>

            {item.type === 'music' && (
              <button
                onClick={() => {
                  const q = encodeURIComponent([item.title, item.creator].filter(Boolean).join(' '))
                  window.open(`https://open.spotify.com/search/${q}`, '_blank')
                }}
                style={{ ...actionBtn('#fff'), background: '#1DB954', border: 'none', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <SpotifyIcon /> Open in Spotify
              </button>
            )}

            {wikiUrl && (
              <button
                onClick={() => window.open(wikiUrl, '_blank')}
                style={{ ...actionBtn('#fff'), background: '#202122', border: 'none', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <WikiIcon /> Open Wikipedia page
              </button>
            )}

            <button onClick={() => setView('edit')} style={actionBtn('#333')}>
              Edit details
            </button>

            {(item.status === 'done' || item.reaction != null) && (
              <button onClick={() => setView('reaction')} style={{ ...actionBtn('#333'), marginTop: 10 }}>
                Edit reaction
              </button>
            )}

            {confirmDelete ? (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 13, color: '#C0392B', textAlign: 'center', marginBottom: 10 }}>
                  Delete "{item.title}"? This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmDelete(false)} style={{ ...actionBtn('#333'), flex: 1 }}>Cancel</button>
                  <button onClick={onDelete} style={{ ...actionBtn('#fff'), flex: 1, background: '#C0392B', border: 'none' }}>Delete</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{ ...actionBtn('#C0392B'), marginTop: 10 }}>
                Delete
              </button>
            )}
          </>
        )}

        {view === 'edit' && (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 16 }}>Edit details</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={inputStyle} />
              <input value={creator} onChange={e => setCreator(e.target.value)} placeholder="Creator" style={inputStyle} />
              <input value={year} onChange={e => setYear(e.target.value)} placeholder="Year" type="number" style={inputStyle} />
            </div>
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
              <button onClick={() => setView('main')} style={{ ...actionBtn('#333'), flex: 1 }}>Cancel</button>
              <button onClick={handleSaveDetails} style={{ ...actionBtn('#fff'), flex: 1, background: '#002FA7', border: 'none' }}>Save</button>
            </div>
          </>
        )}

        {view === 'reaction' && (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 16 }}>Edit reaction</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {REACTIONS.map(r => (
                <button key={r.value} onClick={() => setReaction(r.value)} style={{
                  padding: '12px 8px',
                  border: reaction === r.value ? `2px solid ${color.border}` : '1.5px solid #E0E0E0',
                  borderRadius: 10,
                  background: reaction === r.value ? color.bg : '#fff',
                  fontSize: 14,
                  fontWeight: reaction === r.value ? 600 : 400,
                  color: reaction === r.value ? color.border : '#444',
                  cursor: 'pointer',
                }}>
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Any thoughts..."
              rows={2}
              style={{ ...inputStyle, resize: 'none', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setView('main')} style={{ ...actionBtn('#333'), flex: 1 }}>Cancel</button>
              <button onClick={handleSaveReaction} disabled={!reaction} style={{ ...actionBtn('#fff'), flex: 1, background: reaction ? '#002FA7' : '#ccc', border: 'none' }}>Save</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function SpotifyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.59 14.42a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.82-.87 7.09-.5 9.72 1.1a.62.62 0 0 1 .21.86zm1.23-2.74a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.56 11.23 1.33.37.22.49.7.26 1.07zm.11-2.85C14.81 8.98 9.5 8.8 6.44 9.73a.94.94 0 1 1-.54-1.8c3.52-1.07 9.38-.86 13.08 1.34a.94.94 0 0 1-.96 1.61z" />
    </svg>
  )
}

function WikiIcon() {
  return <span style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1 }}>W</span>
}

function actionBtn(color: string): React.CSSProperties {
  return {
    width: '100%', padding: '13px', border: '1.5px solid #E0E0E0',
    borderRadius: 12, background: '#fff', fontSize: 15,
    fontWeight: 500, color, cursor: 'pointer',
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', border: '1.5px solid #E0E0E0',
  borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none',
}
