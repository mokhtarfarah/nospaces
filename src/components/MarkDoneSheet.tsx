import { useState } from 'react'
import type { Item, ItemReaction } from '../lib/database.types'
import { typeColor } from '../lib/colors'
import { MOODS } from '../lib/moods'
import { NoteInput } from './NoteInput'

const REACTIONS: { value: ItemReaction; label: string }[] = [
  { value: 'loved_it',   label: 'loved it'   },
  { value: 'liked_it',   label: 'liked it'   },
  { value: 'eh',         label: 'eh'         },
  { value: 'not_for_me', label: 'not for me' },
]

interface Props {
  item: Item
  onConfirm: (reaction: ItemReaction, note: string, moods: string[]) => void
  onClose: () => void
}

export function MarkDoneSheet({ item, onConfirm, onClose }: Props) {
  const [reaction, setReaction] = useState<ItemReaction | null>(null)
  const [note, setNote] = useState('')
  const [selectedMoods, setSelectedMoods] = useState<string[]>([])
  const color = typeColor(item.type)

  function toggleMood(mood: string) {
    setSelectedMoods(prev =>
      prev.includes(mood) ? prev.filter(m => m !== mood) : [...prev, mood]
    )
  }

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

        <p style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 12 }}>what did you think?</p>

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

        {/* Moods */}
        <p style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 10 }}>vibe? <span style={{ fontWeight: 400, color: '#999' }}>(optional)</span></p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {MOODS.map(mood => {
            const active = selectedMoods.includes(mood)
            return (
              <button
                key={mood}
                onClick={() => toggleMood(mood)}
                style={{
                  padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 13,
                  border: active ? '1.5px solid #111' : '1.5px solid #E0E0E0',
                  background: active ? '#EDEDED' : '#fff',
                  color: active ? '#111' : '#666',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {mood}
              </button>
            )
          })}
        </div>

        <div style={{ marginBottom: 16 }}>
          <NoteInput value={note} onChange={setNote} />
        </div>

        <button
          disabled={!reaction}
          onClick={() => reaction && onConfirm(reaction, note, selectedMoods)}
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
          mark as done
        </button>
      </div>
    </>
  )
}
