import { useState } from 'react'
import type { Item, ItemReaction } from '../lib/database.types'
import { typeColor } from '../lib/colors'
import { VERDICTS } from '../lib/moods'
import { NoteInput } from './NoteInput'
import { MoodChips } from './MoodChips'

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
  const unconfirmed = Array.isArray(item.metadata?.unconfirmedVibes) ? (item.metadata.unconfirmedVibes as string[]) : []
  const [selectedMoods, setSelectedMoods] = useState<string[]>(unconfirmed)
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
        padding: '10px 20px calc(28px + env(safe-area-inset-bottom))',
        zIndex: 201,
        maxWidth: 480,
        margin: '0 auto',
        maxHeight: '85dvh',
        overflowY: 'auto',
      }}>
        {/* Item preview + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 4, height: 36, borderRadius: 2, background: color.border, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{item.title}</div>
            {item.creator && <div style={{ fontSize: 12, color: '#888' }}>{item.creator}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BBBBBB', fontSize: 18, lineHeight: 1, padding: 4, flexShrink: 0 }}>✕</button>
        </div>

        <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1B19', marginBottom: 14 }}>what did you think?</p>

        {/* 2×2 reaction grid — monochrome to match the editorial card */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
          {REACTIONS.slice(0, 2).map(r => {
            const active = reaction === r.value
            return (
              <button key={r.value} onClick={() => setReaction(r.value)} style={{
                padding: '12px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 14,
                border: active ? '2px solid #1C1B19' : '1.5px solid #E6E3DE',
                background: active ? '#F4F2EE' : '#fff',
                color: active ? '#1C1B19' : '#6F6B64',
                fontWeight: active ? 600 : 400,
              }}>{r.label}</button>
            )
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
          {REACTIONS.slice(2).map(r => {
            const active = reaction === r.value
            return (
              <button key={r.value} onClick={() => setReaction(r.value)} style={{
                padding: '12px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 14,
                border: active ? '2px solid #1C1B19' : '1.5px solid #E6E3DE',
                background: active ? '#F4F2EE' : '#fff',
                color: active ? '#1C1B19' : '#6F6B64',
                fontWeight: active ? 600 : 400,
              }}>{r.label}</button>
            )
          })}
        </div>

        <div style={{ marginBottom: 16 }}>
          <NoteInput value={note} onChange={setNote} />
        </div>
        <p style={{ fontSize: 10, fontWeight: 600, color: '#ABA69C', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: unconfirmed.length > 0 ? 4 : 8 }}>
          vibe <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: '#C9C6C0' }}>· optional</span>
        </p>
        {unconfirmed.length > 0 && (
          <p style={{ fontSize: 10, color: '#C9C6C0', marginBottom: 8 }}>
            vibes below are ai guesses — keep the ones that fit, saving confirms them.
          </p>
        )}
        <div style={{ marginBottom: 16 }}>
          <MoodChips
            type={item.type}
            size="sm"
            isActive={m => selectedMoods.includes(m)}
            onToggle={toggleMood}
            collapsible
            initialOpen={{ verdict: !VERDICTS.some(v => selectedMoods.includes(v)) }}
          />
        </div>

        <button
          disabled={!reaction}
          onClick={() => {
            if (!reaction) return
            onConfirm(reaction, note, selectedMoods)
          }}
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
