import type { ReactNode } from 'react'

// Shared magazine-style page header: a tight-tracked headline over a small,
// normal-spaced kicker + rule. The cramped headline against the loose kicker
// is the whole trick — a quiet nod to the app's own name (no spaces between
// the letters either).
const INK = '#1C1B19'
const KICKER = '#ABA69C'

export function PageHeader({ kicker, title, right }: { kicker?: ReactNode; title: string; right?: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.95, margin: '0 0 5px', color: INK }}>{title}</h1>
          {kicker && (
            <div style={{ fontSize: 10, color: KICKER, letterSpacing: '1.5px', textTransform: 'uppercase' }}>{kicker}</div>
          )}
        </div>
        {right && <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, paddingBottom: 1 }}>{right}</div>}
      </div>
      <div style={{ borderBottom: `1.5px solid ${INK}` }} />
    </div>
  )
}
