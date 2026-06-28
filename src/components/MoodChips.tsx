import { useState } from 'react'
import { verdictsForType, vibesForType } from '../lib/moods'

export function MoodChips({ type = 'other', isActive, onToggle, size = 'md', layout = 'wrap', groups = 'all', collapsible = false, initialOpen = {} }: {
  // Item type — determines which vibes to show (core + type-appropriate tier).
  type?: string
  isActive: (mood: string) => boolean
  onToggle: (mood: string) => void
  size?: 'sm' | 'md'
  layout?: 'wrap' | 'scroll'
  groups?: 'all' | 'vibes-only'
  collapsible?: boolean
  initialOpen?: Record<string, boolean>
}) {
  const sm = size === 'sm'
  const [open, setOpen] = useState<Record<string, boolean>>(initialOpen)

  const VIBES = vibesForType(type)
  const GROUPS = [
    { label: 'vibe', list: VIBES },
    { label: 'verdict', list: verdictsForType(type) },
  ] as const

  const rowStyle: React.CSSProperties = layout === 'scroll' && !collapsible
    ? { display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 6, paddingBottom: 4, WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }
    : { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }
  const visibleGroups = groups === 'vibes-only' ? GROUPS.filter(g => g.label === 'vibe') : GROUPS

  // Editorial chip language: every chip is a soft-filled token (so nothing floats);
  // selected just deepens to taupe ink. No outlined-box grid, no black bricks.
  const chip = (mood: string, active: boolean) => (
    <button
      key={mood}
      onClick={() => onToggle(mood)}
      style={{
        padding: sm ? '4px 11px' : '5px 12px', borderRadius: sm ? 8 : 4, cursor: 'pointer', flexShrink: 0,
        fontSize: sm ? 11 : 13,
        border: sm ? 'none' : (active ? '1.5px solid #111' : '1.5px solid #E0E0E0'),
        background: active ? (sm ? '#E6E1D7' : '#EDEDED') : (sm ? '#F4F2EE' : '#fff'),
        color: active ? (sm ? '#1C1B19' : '#111') : (sm ? '#8A857C' : '#666'),
        fontWeight: active ? (sm ? 500 : 600) : 400,
      }}
    >
      {collapsible && active ? `${mood} ×` : mood}
    </button>
  )

  const toggleBtn = (label: string, isOpen: boolean) => (
    <button
      onClick={() => setOpen(o => ({ ...o, [label]: !o[label] }))}
      style={{ padding: sm ? '4px 11px' : '5px 12px', borderRadius: sm ? 8 : 4, fontSize: sm ? 11 : 13, cursor: 'pointer', border: sm ? 'none' : '1.5px dashed #CCC', background: 'none', color: sm ? '#BDB8AF' : '#AAA', flexShrink: 0 }}
    >
      {isOpen ? 'done' : '+ add'}
    </button>
  )

  return (
    <>
      {visibleGroups.map(({ label, list }, groupIdx) => {
        const active = list.filter(m => isActive(m))
        const inactive = list.filter(m => !isActive(m))
        const isOpen = !!open[label]
        const isLast = groupIdx === visibleGroups.length - 1
        return (
          <div key={label} style={{ marginBottom: isLast ? 0 : 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#BBB', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 6 }}>
              {label}
            </div>
            {collapsible ? (
              <>
                <div style={rowStyle}>
                  {active.map(m => chip(m, true))}
                  {!isOpen && inactive.length > 0 && toggleBtn(label, false)}
                </div>
                {isOpen && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: active.length > 0 ? 8 : 0, alignItems: 'center' }}>
                    {inactive.map(m => chip(m, false))}
                    {toggleBtn(label, true)}
                  </div>
                )}
              </>
            ) : (
              <div style={rowStyle}>
                {list.map(m => chip(m, isActive(m)))}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
