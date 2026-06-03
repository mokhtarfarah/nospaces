import type { ItemReaction } from '../lib/database.types'

// Ordering option used when sorting items within a view.
export type SortOption = 'date_added' | 'updated' | 'alpha' | 'status' | 'reaction' | 'creator' | 'year'

export type SortDir = 'asc' | 'desc'

export type ReactionFilter = 'all' | ItemReaction

// A "view" bundles ordering + grouping into one coherent choice, instead of two
// separate (and conflicting) sort/group controls.
export type ViewMode = 'recent' | 'edited' | 'status' | 'creator' | 'alpha' | 'year' | 'rating'

// `defaultDir` is the order a view opens in. `directional` views can be reversed
// by tapping the already-selected row again (a → z becomes z → a, etc).
export const VIEW_CONFIG: Record<ViewMode, {
  sort: SortOption
  group: 'month' | 'creator' | 'none' | 'status'
  label: string
  hint: string
  defaultDir: SortDir
  directional?: boolean
}> = {
  recent:  { sort: 'date_added', group: 'month',   label: 'recent',         hint: 'by date added, grouped by month',      defaultDir: 'desc', directional: true },
  edited:  { sort: 'updated',    group: 'none',    label: 'recently edited', hint: 'by last change',                      defaultDir: 'desc', directional: true },
  status:  { sort: 'date_added', group: 'status',  label: 'want to / done', hint: 'your list split by status',            defaultDir: 'desc' },
  creator: { sort: 'creator',    group: 'creator', label: 'by creator',     hint: 'grouped by director / author / artist', defaultDir: 'asc', directional: true },
  alpha:   { sort: 'alpha',      group: 'none',    label: 'a → z',          hint: 'alphabetical',                         defaultDir: 'asc', directional: true },
  year:    { sort: 'year',       group: 'none',    label: 'by year',        hint: 'release year',                         defaultDir: 'desc', directional: true },
  rating:  { sort: 'reaction',   group: 'none',    label: 'by rating',      hint: 'loved it first',                       defaultDir: 'asc' },
}

const ORDER: ViewMode[] = ['recent', 'edited', 'status', 'creator', 'alpha', 'year', 'rating']

interface Props {
  current: ViewMode
  dir: SortDir
  // Tapping a different view switches to it; tapping the active directional view reverses it.
  onSelect: (v: ViewMode) => void
  onClose: () => void
  layout?: 'list' | 'grid'
  gridCols?: 3 | 4
  onGridCols?: (c: 3 | 4) => void
}

export function ViewSheet({ current, dir, onSelect, onClose, layout, gridCols, onGridCols }: Props) {
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
          const arrow = cfg.directional ? (dir === 'asc' ? '↑' : '↓') : null
          return (
            <button
              key={v}
              onClick={() => onSelect(v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '13px 0', border: 'none', borderBottom: '1px solid #F0F0F0',
                background: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span>
                <span style={{ fontSize: 15, color: active ? '#111111' : '#222', fontWeight: active ? 600 : 400 }}>{cfg.label}</span>
                <span style={{ display: 'block', fontSize: 11, color: '#999', marginTop: 2 }}>
                  {cfg.hint}{active && cfg.directional ? ' · tap to reverse' : ''}
                </span>
              </span>
              {active && (
                <span style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {arrow && <span style={{ color: '#111', fontWeight: 600 }}>{arrow}</span>}
                  <span style={{ fontSize: 18 }}>✓</span>
                </span>
              )}
            </button>
          )
        })}
        {layout === 'grid' && onGridCols && gridCols && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, marginTop: 4 }}>
            <span style={{ fontSize: 13, color: '#555' }}>grid columns</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {([3, 4] as const).map(n => (
                <button key={n} onClick={() => onGridCols(n)} style={{
                  padding: '4px 14px', borderRadius: 6, border: gridCols === n ? '1.5px solid #111' : '1.5px solid #E0E0E0',
                  background: gridCols === n ? '#111' : '#fff', color: gridCols === n ? '#fff' : '#888',
                  fontSize: 13, fontWeight: gridCols === n ? 600 : 400, cursor: 'pointer',
                }}>{n}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
