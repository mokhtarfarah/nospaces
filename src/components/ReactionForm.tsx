import type { Item, ItemReaction } from '../lib/database.types'
import { VERDICTS } from '../lib/moods'
import { NoteInput } from './NoteInput'
import { MoodChips } from './MoodChips'

// Single source of truth for the "how did it land?" form body, shared by the
// quick MarkDoneSheet (row-level) and the ItemActionSheet reaction view. Both
// were near-identical and drifted; keeping the segmented scale + desert-island
// toggle + note + vibe/verdict chips here keeps them in lockstep.

export const REACTION_ORDER: ItemReaction[] = ['not_for_me', 'eh', 'liked_it', 'loved_it']
export const REACTION_LABELS: Record<ItemReaction, string> = {
  not_for_me: 'not for me',
  eh: 'eh',
  liked_it: 'liked it',
  loved_it: 'loved it',
}

interface Props {
  type: Item['type']
  reaction: ItemReaction | null
  onReaction: (r: ItemReaction) => void
  canon: boolean
  // Called with the next canon state. Parent decides whether to persist live
  // (ItemActionSheet) or hold it until confirm (MarkDoneSheet).
  onToggleCanon: (next: boolean) => void
  note: string
  onNote: (v: string) => void
  selectedMoods: string[]
  onToggleMood: (m: string) => void
  // Show the "these are ai guesses" hint above the vibe chips (first mark-done).
  showUnconfirmedHint?: boolean
  // Edit-reaction variant: hide the vibe chips behind an "edit tags" toggle.
  collapse?: { open: boolean; onToggle: () => void }
}

export function ReactionForm({
  type, reaction, onReaction, canon, onToggleCanon,
  note, onNote, selectedMoods, onToggleMood,
  showUnconfirmedHint = false, collapse,
}: Props) {
  // Desert island only surfaces once you land somewhere positive — you don't
  // crown something you felt "eh" about. Stays visible if already set.
  const canonVisible = reaction === 'liked_it' || reaction === 'loved_it' || canon

  const moodChips = (
    <MoodChips
      type={type}
      size="sm"
      isActive={m => selectedMoods.includes(m)}
      onToggle={onToggleMood}
      collapsible
      initialOpen={{ verdict: !VERDICTS.some(v => selectedMoods.includes(v)) }}
    />
  )

  return (
    <>
      {/* Reaction scale — one segmented control, so it reads as a single choice. */}
      <div style={{ display: 'flex', border: '1px solid #E2DED7', borderRadius: 11, overflow: 'hidden', marginBottom: canonVisible ? 10 : 18 }}>
        {REACTION_ORDER.map((r, i) => {
          const active = reaction === r
          return (
            <button key={r} onClick={() => onReaction(r)} style={{
              flex: 1, padding: '10px 4px', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
              border: 'none', borderRight: i < 3 ? '1px solid #ECEAE6' : 'none',
              background: active ? '#F4F2EE' : '#fff',
              color: active ? '#1C1B19' : '#8A857C', fontWeight: active ? 500 : 400,
            }}>
              {REACTION_LABELS[r]}
            </button>
          )
        })}
      </div>

      {canonVisible && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <button
            onClick={() => onToggleCanon(!canon)}
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
        <NoteInput value={note} onChange={onNote} rows={2} />
      </div>

      {/* First mark-done: chips shown directly (verdict open). Edit reaction: chips
          tucked behind an "edit tags" toggle so the read state stays calm. */}
      {collapse ? (
        <div style={{ marginBottom: 16 }}>
          <button onClick={collapse.onToggle} className="tlink">{collapse.open ? 'done ▴' : 'edit tags ▾'}</button>
          {collapse.open && <div style={{ marginTop: 10 }}>{moodChips}</div>}
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {showUnconfirmedHint && (
            <div style={{ fontSize: 10, color: '#C9C6C0', marginBottom: 10 }}>
              vibes below are ai guesses — keep the ones that fit, saving confirms them.
            </div>
          )}
          {moodChips}
        </div>
      )}
    </>
  )
}
