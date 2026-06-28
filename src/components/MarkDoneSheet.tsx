import { useState } from 'react'
import type { Item, ItemReaction } from '../lib/database.types'
import { typeColor } from '../lib/colors'
import { ReactionForm } from './ReactionForm'

interface Props {
  item: Item
  onConfirm: (reaction: ItemReaction, note: string, moods: string[]) => void
  onToggleCanon?: (canon: boolean) => void
  onClose: () => void
}

export function MarkDoneSheet({ item, onConfirm, onToggleCanon, onClose }: Props) {
  const [reaction, setReaction] = useState<ItemReaction | null>(null)
  const [note, setNote] = useState('')
  const unconfirmed = Array.isArray(item.metadata?.unconfirmedVibes) ? (item.metadata.unconfirmedVibes as string[]) : []
  const [selectedMoods, setSelectedMoods] = useState<string[]>(unconfirmed)
  // Held locally and applied on confirm (the row isn't persisted until "mark as done").
  const [canon, setCanon] = useState(!!item.metadata?.canon)
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

        <ReactionForm
          type={item.type}
          reaction={reaction}
          onReaction={setReaction}
          canon={canon}
          onToggleCanon={setCanon}
          note={note}
          onNote={setNote}
          selectedMoods={selectedMoods}
          onToggleMood={toggleMood}
          showUnconfirmedHint={unconfirmed.length > 0}
        />

        <button
          disabled={!reaction}
          onClick={() => {
            if (!reaction) return
            onConfirm(reaction, note, selectedMoods)
            if (onToggleCanon && canon !== !!item.metadata?.canon) onToggleCanon(canon)
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
