import type { ReactNode } from 'react'

// A personal note, in the app's house voice for reflection — the same warm-graphite
// italic prose + small uppercase label the taste page uses (TasteScreen). One shared
// treatment for the media Library ("thoughts") and the Things board ("your note"),
// so a note reads the same everywhere and feels native, not bolted on.
// `trailing` is an inline action (e.g. a "re-read" link) that rides at the END of
// the prose on the same line — not as a separate paragraph below it — so an AI
// read and its refresh control read as one flowing thought.
export function NoteProse({ label, children, trailing }: { label?: string; children: ReactNode; trailing?: ReactNode }) {
  return (
    <div>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 600, color: '#ABA69C', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ fontSize: 13, lineHeight: 1.65, color: '#4A453E', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
        {children}
        {trailing != null && (
          <span style={{ fontStyle: 'normal', whiteSpace: 'nowrap' }}>
            <span style={{ color: '#C9C4BB' }}>{' · '}</span>
            {trailing}
          </span>
        )}
      </div>
    </div>
  )
}
