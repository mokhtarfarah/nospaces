import type { ReactNode } from 'react'

// A personal note shown as a pull-quote: a large decorative quotation mark sits
// BEHIND the text, so the note reads as clearly set apart from the app's UI copy.
// One shared treatment for both the media Library ("thoughts") and the Things board
// ("your note") — non-italic, same font size in both, so they feel like one app.
export function NoteQuote({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 600, color: '#ABA69C', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ position: 'relative', paddingLeft: 24 }}>
        <span aria-hidden style={{
          position: 'absolute', top: -16, left: -6, fontSize: 58, lineHeight: 1,
          fontFamily: 'Georgia, "Times New Roman", serif', color: '#E6E1D7',
          zIndex: 0, pointerEvents: 'none', userSelect: 'none',
        }}>“</span>
        <div style={{ position: 'relative', zIndex: 1, fontSize: 13, lineHeight: 1.6, color: '#3A3A37' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
