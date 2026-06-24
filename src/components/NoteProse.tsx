import type { ReactNode } from 'react'

// A personal note, in the app's house voice for reflection — the same warm-graphite
// italic prose + small uppercase label the taste page uses (TasteScreen). One shared
// treatment for the media Library ("thoughts") and the Things board ("your note"),
// so a note reads the same everywhere and feels native, not bolted on.
export function NoteProse({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 600, color: '#ABA69C', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ fontSize: 13, lineHeight: 1.65, color: '#4A453E', fontStyle: 'italic' }}>
        {children}
      </div>
    </div>
  )
}
