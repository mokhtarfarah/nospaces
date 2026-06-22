import type { ReactNode } from 'react'

// Shared magazine-style page header: a small uppercase kicker, a small label,
// and a rule beneath. The label stays small on purpose so page content (e.g.
// the taste vibe-headline) can be the biggest thing — the editorial weight
// comes from the kicker + rule, not from an oversized title.
const INK = '#1C1B19'
const KICKER = '#ABA69C'

export function PageHeader({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          {kicker && (
            <div style={{ fontSize: 10, color: KICKER, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 5 }}>{kicker}</div>
          )}
          <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: INK }}>{title}</h1>
        </div>
        {right && <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, paddingBottom: 1 }}>{right}</div>}
      </div>
      <div style={{ borderBottom: `1.5px solid ${INK}` }} />
    </div>
  )
}
