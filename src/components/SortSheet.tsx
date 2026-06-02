export type SortOption = 'date_added' | 'alpha' | 'status' | 'reaction' | 'creator' | 'year'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date_added', label: 'Date added (newest first)' },
  { value: 'alpha',      label: 'Alphabetical (A → Z)' },
  { value: 'status',     label: 'Status (want to first)' },
  { value: 'reaction',   label: 'Reaction (loved it first)' },
  { value: 'creator',    label: 'Creator (A → Z)' },
  { value: 'year',       label: 'Year (newest first)' },
]

interface Props {
  current: SortOption
  onChange: (s: SortOption) => void
  onClose: () => void
}

export function SortSheet({ current, onChange, onClose }: Props) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        background: '#fff',
        borderRadius: '16px 16px 0 0',
        padding: '12px 20px 48px',
        zIndex: 201,
        maxWidth: 480,
        margin: '0 auto',
      }}>
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 20px' }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 12 }}>Sort by</p>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => { onChange(opt.value); onClose() }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '13px 0',
              border: 'none',
              borderBottom: '1px solid #F0F0F0',
              background: 'none',
              fontSize: 15,
              color: current === opt.value ? '#111111' : '#222',
              fontWeight: current === opt.value ? 600 : 400,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {opt.label}
            {current === opt.value && <span style={{ fontSize: 18 }}>✓</span>}
          </button>
        ))}
      </div>
    </>
  )
}
