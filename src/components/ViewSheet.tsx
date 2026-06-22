import type { ItemReaction } from '../lib/database.types'

// Ordering option used when sorting items within a view.
export type SortOption = 'date_added' | 'updated' | 'alpha' | 'status' | 'reaction' | 'creator' | 'year'

export type SortDir = 'asc' | 'desc'

export type ReactionFilter = 'all' | ItemReaction

// A "view" bundles ordering + grouping into one coherent choice, instead of two
// separate (and conflicting) sort/group controls.
export type ViewMode = 'recent' | 'year' | 'creator' | 'alpha'

// `defaultDir` is the order a view opens in. `directional` views can be reversed
// by tapping the already-selected row again (a → z becomes z → a, etc).
export const VIEW_CONFIG: Record<ViewMode, {
  sort: SortOption
  group: 'month' | 'creator' | 'none'
  label: string
  hint: string
  defaultDir: SortDir
  directional?: boolean
}> = {
  recent:  { sort: 'date_added', group: 'month',   label: 'recent',     hint: 'by date added, grouped by month',       defaultDir: 'desc', directional: true },
  year:    { sort: 'year',       group: 'none',    label: 'by year',    hint: 'release year',                          defaultDir: 'desc', directional: true },
  creator: { sort: 'creator',    group: 'creator', label: 'by creator', hint: 'grouped by director / author / artist', defaultDir: 'asc',  directional: true },
  alpha:   { sort: 'alpha',      group: 'none',    label: 'a → z',      hint: 'alphabetical',                          defaultDir: 'asc',  directional: true },
}

const ORDER: ViewMode[] = ['recent', 'year', 'creator', 'alpha']

interface Props {
  current: ViewMode
  dir: SortDir
  // Tapping a different view switches to it; tapping the active directional view reverses it.
  onSelect: (v: ViewMode) => void
  onClose: () => void
  layout?: 'list' | 'grid'
  onLayout?: (l: 'list' | 'grid') => void
  gridCols?: 3 | 4
  onGridCols?: (c: 3 | 4) => void
}

export function ViewSheet({ current, dir, onSelect, onClose, layout, onLayout, gridCols, onGridCols }: Props) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '12px 20px calc(28px + env(safe-area-inset-bottom))', zIndex: 201, maxWidth: 480, margin: '0 auto',
        maxHeight: '90dvh', overflowY: 'auto',
      }}>
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 18px' }} />

        {/* Layout first — the most-toggled control sits at the top. */}
        {layout && onLayout && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: '#555' }}>layout</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['list', 'grid'] as const).map(l => (
                <button key={l} onClick={() => onLayout(l)} style={{
                  padding: '4px 14px', borderRadius: 6, border: layout === l ? '1.5px solid #111' : '1.5px solid #E0E0E0',
                  background: layout === l ? '#111' : '#fff', color: layout === l ? '#fff' : '#888',
                  fontSize: 13, fontWeight: layout === l ? 600 : 400, cursor: 'pointer',
                }}>{l}</button>
              ))}
            </div>
          </div>
        )}
        {layout === 'grid' && onGridCols && gridCols && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: '#555' }}>columns</span>
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

        {/* Sort — compact single-line rows (hints dropped; labels are self-explanatory). */}
        <p style={{ fontSize: 11, fontWeight: 600, color: '#ABA69C', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0 6px', paddingTop: 14, borderTop: '1px solid #F0F0F0' }}>sort</p>
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
                width: '100%', padding: '8px 0', border: 'none',
                background: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 14, color: active ? '#111' : '#444', fontWeight: active ? 600 : 400 }}>{cfg.label}</span>
              {active && (
                <span style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {arrow && <span style={{ color: '#111', fontWeight: 600 }}>{arrow}</span>}
                  <span style={{ fontSize: 15 }}>✓</span>
                </span>
              )}
            </button>
          )
        })}
        <p style={{ fontSize: 11, color: '#BBB', margin: '6px 0 0' }}>tap the selected sort again to reverse</p>
      </div>
    </>
  )
}
