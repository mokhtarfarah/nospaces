import { VIBES, VERDICTS } from '../lib/moods'

// The two vibe axes, rendered as labelled chip groups.
// "feel" = what it's like (VIBES) · "how it landed" = your relationship (VERDICTS).
const GROUPS = [
  { label: 'feel', list: VIBES },
  { label: 'how it landed', list: VERDICTS },
] as const

export function MoodChips({ isActive, onToggle, size = 'md', layout = 'wrap', groups = 'all' }: {
  isActive: (mood: string) => boolean
  onToggle: (mood: string) => void
  size?: 'sm' | 'md'
  layout?: 'wrap' | 'scroll'
  groups?: 'all' | 'vibes-only'
}) {
  const sm = size === 'sm'
  const rowStyle: React.CSSProperties = layout === 'scroll'
    ? { display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 6, paddingBottom: 4, WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }
    : { display: 'flex', flexWrap: 'wrap', gap: 6 }
  const visibleGroups = groups === 'vibes-only' ? GROUPS.filter(g => g.label === 'feel') : GROUPS
  return (
    <>
      {visibleGroups.map(({ label, list }) => (
        <div key={label} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#BBB', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 6 }}>
            {label}
          </div>
          <div style={rowStyle}>
            {list.map(mood => {
              const active = isActive(mood)
              return (
                <button
                  key={mood}
                  onClick={() => onToggle(mood)}
                  style={{
                    padding: sm ? '3px 10px' : '5px 12px', borderRadius: 20, cursor: 'pointer', flexShrink: 0,
                    fontSize: sm ? 11 : 13,
                    border: active ? '1.5px solid #111' : '1.5px solid #E0E0E0',
                    background: active ? (sm ? '#111' : '#EDEDED') : '#fff',
                    color: active ? (sm ? '#fff' : '#111') : (sm ? '#AAA' : '#666'),
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {mood}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
