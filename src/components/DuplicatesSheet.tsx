import { useState } from 'react'
import type { Item, ItemReaction } from '../lib/database.types'
import { typeColor } from '../lib/colors'
import { useArtwork } from '../lib/artwork'

const REACTION_LABELS: Record<ItemReaction, string> = {
  loved_it: 'loved it',
  liked_it: 'liked it',
  eh: 'eh',
  not_for_me: 'not for me',
}

// Review duplicate groups before deleting. Each group pre-selects a "keep" item
// (the best one, per the order the groups arrive in); everything else in the group
// is marked for deletion. Tap any item to make it the one you keep.
export function DuplicatesSheet({ groups, onConfirm, onClose }: {
  groups: Item[][]
  onConfirm: (idsToDelete: string[]) => void
  onClose: () => void
}) {
  // keep[groupIndex] = id of the item to keep in that group (defaults to first/best).
  const [keep, setKeep] = useState<Record<number, string>>(
    () => Object.fromEntries(groups.map((g, i) => [i, g[0].id])),
  )

  const toDelete = groups.flatMap((g, i) => g.filter(it => it.id !== keep[i]).map(it => it.id))

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '12px 20px calc(20px + env(safe-area-inset-bottom))', zIndex: 201, maxWidth: 480, margin: '0 auto',
        maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 16px', flexShrink: 0 }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1B19', margin: '0 0 4px' }}>review duplicates</p>
        <p style={{ fontSize: 12, color: '#ABA69C', margin: '0 0 14px' }}>
          {groups.length} group{groups.length > 1 ? 's' : ''} — tap the one to keep in each
        </p>

        <div style={{ flex: 1, overflowY: 'auto', marginRight: -20, paddingRight: 20 }}>
          {groups.map((g, i) => {
            const earliestId = [...g].sort((a, b) => new Date(a.date_added).getTime() - new Date(b.date_added).getTime())[0].id
            return (
              <div key={i} style={{ marginBottom: 18 }}>
                {g.map(item => (
                  <DupRow
                    key={item.id}
                    item={item}
                    kept={keep[i] === item.id}
                    isOriginal={item.id === earliestId}
                    onPick={() => setKeep(prev => ({ ...prev, [i]: item.id }))}
                  />
                ))}
              </div>
            )
          })}
        </div>

        <button
          onClick={() => onConfirm(toDelete)}
          disabled={toDelete.length === 0}
          style={{
            flexShrink: 0, marginTop: 8, width: '100%', padding: '13px 0', borderRadius: 12,
            border: 'none', background: toDelete.length ? '#111' : '#DDD', color: '#fff',
            fontSize: 15, fontWeight: 600, cursor: toDelete.length ? 'pointer' : 'default',
          }}
        >
          {toDelete.length ? `delete ${toDelete.length} duplicate${toDelete.length > 1 ? 's' : ''}` : 'nothing to delete'}
        </button>
      </div>
    </>
  )
}

function formatAdded(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function DupRow({ item, kept, isOriginal, onPick }: { item: Item; kept: boolean; isOriginal: boolean; onPick: () => void }) {
  const color = typeColor(item.type)
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, item.metadata?.coverUrl as string | null)

  const meta = [
    item.year,
    item.status === 'done' ? (item.reaction ? REACTION_LABELS[item.reaction] : 'done') : 'want to',
    isOriginal ? `added first (${formatAdded(item.date_added)})` : `added ${formatAdded(item.date_added)}`,
  ].filter(Boolean).join(' · ')

  return (
    <div
      onClick={onPick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', cursor: 'pointer',
        borderRadius: 10, border: kept ? '1.5px solid #1C1B19' : '1.5px solid #ECEAE6',
        background: kept ? '#FAFAF8' : '#fff', marginBottom: 6,
      }}
    >
      {artwork
        ? <img src={artwork} alt="" loading="lazy" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0, opacity: kept ? 1 : 0.6 }} />
        : <div style={{ width: 36, height: 36, borderRadius: 4, flexShrink: 0, background: color.bg, opacity: kept ? 1 : 0.6 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: kept ? '#1C1B19' : '#ABA69C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: kept ? 'none' : 'line-through' }}>
          {item.title}
        </div>
        {meta && <div style={{ fontSize: 11, color: '#ABA69C', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</div>}
      </div>
      <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: kept ? '#1C1B19' : '#C00' }}>
        {kept ? 'keep' : 'delete'}
      </span>
    </div>
  )
}
