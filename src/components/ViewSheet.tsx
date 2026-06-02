import type { ItemReaction } from '../lib/database.types'

// Ordering option used when sorting items within a view.
export type SortOption = 'date_added' | 'alpha' | 'status' | 'reaction' | 'creator' | 'year'

// Reaction filter lives here (in the view sheet) rather than as an always-on
// header row, to keep the library header calm.
export type ReactionFilter = 'all' | ItemReaction

const REACTION_FILTERS: { value: ReactionFilter; label: string }[] = [
  { value: 'all',        label: 'all'        },
  { value: 'loved_it',   label: 'loved it'   },
  { value: 'liked_it',   label: 'liked it'   },
  { value: 'eh',         label: 'eh'         },
  { value: 'not_for_me', label: 'not for me' },
]

// A "view" bundles ordering + grouping into one coherent choice, instead of two
// separate (and conflicting) sort/group controls.
export type ViewMode = 'recent' | 'status' | 'creator' | 'alpha' | 'year' | 'rating'

export const VIEW_CONFIG: Record<ViewMode, { sort: SortOption; group: 'month' | 'creator' | 'none' | 'status'; label: string; hint: string }> = {
  recent:  { sort: 'date_added', group: 'month',   label: 'recent',        hint: 'newest first, grouped by month' },
  status:  { sort: 'date_added', group: 'status',  label: 'want to / done', hint: 'your list split by status' },
  creator: { sort: 'creator',    group: 'creator', label: 'by creator',    hint: 'grouped by director / author / artist' },
  alpha:   { sort: 'alpha',      group: 'none',    label: 'a → z',         hint: 'alphabetical' },
  year:    { sort: 'year',       group: 'none',    label: 'by year',       hint: 'newest first' },
  rating:  { sort: 'reaction',   group: 'none',    label: 'by rating',     hint: 'loved it first' },
}

const ORDER: ViewMode[] = ['recent', 'status', 'creator', 'alpha', 'year', 'rating']

interface Props {
  current: ViewMode
  onChange: (v: ViewMode) => void
  reactionFilter: ReactionFilter
  onReactionChange: (r: ReactionFilter) => void
  // Reactions only apply to done items, so hide this filter when viewing "want to".
  showReactionFilter: boolean
  onClose: () => void
}

export function ViewSheet({ current, onChange, reactionFilter, onReactionChange, showReactionFilter, onClose }: Props) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '12px 20px calc(28px + env(safe-area-inset-bottom))', zIndex: 201, maxWidth: 480, margin: '0 auto',
        maxHeight: '90dvh', overflowY: 'auto',
      }}>
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 20px' }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 12 }}>view</p>
        {ORDER.map(v => {
          const cfg = VIEW_CONFIG[v]
          const active = current === v
          return (
            <button
              key={v}
              onClick={() => { onChange(v); onClose() }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '13px 0', border: 'none', borderBottom: '1px solid #F0F0F0',
                background: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span>
                <span style={{ fontSize: 15, color: active ? '#111111' : '#222', fontWeight: active ? 600 : 400 }}>{cfg.label}</span>
                <span style={{ display: 'block', fontSize: 11, color: '#999', marginTop: 2 }}>{cfg.hint}</span>
              </span>
              {active && <span style={{ fontSize: 18 }}>✓</span>}
            </button>
          )
        })}

        {showReactionFilter && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 12 }}>filter by reaction</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {REACTION_FILTERS.map(r => {
                const active = reactionFilter === r.value
                return (
                  <button
                    key={r.value}
                    onClick={() => onReactionChange(r.value)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                      border: active ? '1.5px solid #111111' : '1.5px solid #E0E0E0',
                      background: active ? '#EDEDED' : '#fff',
                      color: active ? '#111111' : '#555',
                      fontSize: 13, fontWeight: active ? 600 : 400,
                    }}
                  >
                    {r.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
