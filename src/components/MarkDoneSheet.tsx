import { useState } from 'react'
import type { Item, ItemReaction } from '../lib/database.types'
import { typeColor } from '../lib/colors'
import { VERDICTS } from '../lib/moods'
import { NoteInput } from './NoteInput'
import { MoodChips } from './MoodChips'

// Reaction chip — selected = the shared cream pill; unselected = a quiet,
// borderless word, so the cluster reads as one scale (mirrors ItemActionSheet).
function reactionBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 13px', borderRadius: 9, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
    border: 'none',
    background: active ? '#F4F2EE' : 'none',
    boxShadow: active ? 'inset 0 0 0 1px #1C1B19' : 'none',
    color: active ? '#1C1B19' : '#8A857C',
    fontWeight: active ? 500 : 400,
  }
}

const REACTIONS: { value: ItemReaction; label: string }[] = [
  { value: 'loved_it',   label: 'loved it'   },
  { value: 'liked_it',   label: 'liked it'   },
  { value: 'eh',         label: 'eh'         },
  { value: 'not_for_me', label: 'not for me' },
]

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
  const [canon, setCanon] = useState(!!item.metadata?.canon)
  const color = typeColor(item.type)
  // Desert island only shows once you've landed somewhere positive (or it's set).
  const canonVisible = reaction === 'liked_it' || reaction === 'loved_it' || canon

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

        {/* Reaction scale — centered cluster (matches the in-sheet reaction view). */}
        <div style={{ display: 'flex', gap: 4, marginBottom: canonVisible ? 10 : 18, justifyContent: 'center' }}>
          {(['not_for_me', 'eh', 'liked_it', 'loved_it'] as ItemReaction[]).map(v => (
            <button key={v} onClick={() => setReaction(v)} style={reactionBtnStyle(reaction === v)}>
              {REACTIONS.find(r => r.value === v)!.label}
            </button>
          ))}
        </div>
        {/* Desert island — only surfaces once you land somewhere positive (or it's
            already set). You don't crown something you felt "eh" about. */}
        {canonVisible && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <button
              onClick={() => setCanon(c => !c)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                border: 'none', background: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 9,
                fontSize: 13, fontFamily: 'inherit',
                color: canon ? '#1C1B19' : '#9A958C', fontWeight: canon ? 600 : 400,
              }}
            >
              <span style={{ fontSize: 14 }}>{canon ? '★' : '☆'}</span>
              {canon ? 'desert island' : 'one for the desert island?'}
            </button>
          </div>
        )}

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
