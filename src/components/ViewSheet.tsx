import type { SortOption } from './SortSheet'

// A "view" bundles ordering + grouping into one coherent choice, instead of two
// separate (and conflicting) sort/group controls.
export type ViewMode = 'recent' | 'creator' | 'alpha' | 'year' | 'rating'

export const VIEW_CONFIG: Record<ViewMode, { sort: SortOption; group: 'month' | 'creator' | 'none'; label: string; hint: string }> = {
  recent:  { sort: 'date_added', group: 'month',   label: 'Recent',     hint: 'Newest first, grouped by month' },
  creator: { sort: 'creator',    group: 'creator', label: 'By creator', hint: 'Grouped by director / author / artist' },
  alpha:   { sort: 'alpha',      group: 'none',    label: 'A → Z',      hint: 'Alphabetical' },
  year:    { sort: 'year',       group: 'none',    label: 'By year',    hint: 'Newest first' },
  rating:  { sort: 'reaction',   group: 'none',    label: 'By rating',  hint: 'Loved it first' },
}

const ORDER: ViewMode[] = ['recent', 'creator', 'alpha', 'year', 'rating']

interface Props {
  current: ViewMode
  onChange: (v: ViewMode) => void
  onClose: () => void
}

export function ViewSheet({ current, onChange, onClose }: Props) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '12px 20px 48px', zIndex: 201, maxWidth: 480, margin: '0 auto',
      }}>
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 20px' }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 12 }}>View</p>
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
      </div>
    </>
  )
}
