import { useState } from 'react'
import type { Item, ItemReaction } from '../lib/database.types'
import { typeColor } from '../lib/colors'

const REACTIONS: { value: ItemReaction; label: string }[] = [
  { value: 'loved_it',   label: 'Loved it'   },
  { value: 'liked_it',   label: 'Liked it'   },
  { value: 'eh',         label: 'Eh'         },
  { value: 'not_for_me', label: 'Not for me' },
]

interface Props {
  item: Item
  onConfirm: (reaction: ItemReaction, note: string) => void
  onClose: () => void
}

export function MarkDoneSheet({ item, onConfirm, onClose }: Props) {
  const [reaction, setReaction] = useState<ItemReaction | null>(null)
  const [note, setNote] = useState('')
  const color = typeColor(item.type)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 200,
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        background: '#fff',
        borderRadius: '16px 16px 0 0',
        padding: '12px 20px calc(28px + env(safe-area-inset-bottom))',
        zIndex: 201,
        maxWidth: 480,
        margin: '0 auto',
        maxHeight: '85dvh',
        overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 20px' }} />

        {/* Item preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 4, height: 36, borderRadius: 2, background: color.border, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{item.title}</div>
            {item.creator && <div style={{ fontSize: 12, color: '#888' }}>{item.creator}</div>}
          </div>
        </div>

        <p style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 12 }}>What did you think?</p>

        {/* 2×2 reaction grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {REACTIONS.map(r => (
            <button
              key={r.value}
              onClick={() => setReaction(r.value)}
              style={{
                padding: '12px 8px',
                border: reaction === r.value ? `2px solid ${color.border}` : '1.5px solid #E0E0E0',
                borderRadius: 10,
                background: reaction === r.value ? color.bg : '#fff',
                fontSize: 14,
                fontWeight: reaction === r.value ? 600 : 400,
                color: reaction === r.value ? color.border : '#444',
                cursor: 'pointer',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Note */}
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Any thoughts..."
          rows={2}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 12px',
            border: '1.5px solid #E0E0E0',
            borderRadius: 10,
            fontSize: 14,
            fontFamily: 'inherit',
            resize: 'none',
            outline: 'none',
            marginBottom: 16,
            color: '#333',
          }}
        />

        <button
          disabled={!reaction}
          onClick={() => reaction && onConfirm(reaction, note)}
          style={{
            width: '100%',
            padding: 14,
            background: reaction ? '#111111' : '#E0E0E0',
            color: reaction ? '#fff' : '#999',
            border: 'none',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            cursor: reaction ? 'pointer' : 'default',
          }}
        >
          Mark as done
        </button>
      </div>
    </>
  )
}
