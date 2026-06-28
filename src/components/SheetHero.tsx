import type { ReactNode } from 'react'
import { typeColor } from '../lib/colors'

// Shared editorial header for the bottom-sheet detail views (Discover pick +
// Library item). One language everywhere: a ghosted cover wash bleeding to the
// rounded top of the card, then a crisp borderless poster on the LEFT with the
// title beside it (tops aligned), and — Discover only — an oversized rank
// numeral as a faint watermark behind the title. No filled boxes. The ✕ keeps
// its own row up top, clear of the cover.
const INK = '#1C1B19'
const MUTE = '#ABA69C'
const NUMERAL = '#E4E1D9'

export function SheetHero({
  type,
  title,
  meta,
  cover,
  numeral,
  onClose,
  menuButton,
  children,
}: {
  type: string
  title: string
  meta: string
  cover: string | null
  numeral?: number
  onClose?: () => void
  // Optional control (e.g. a ⋯ admin menu trigger) that rides in the top row to the
  // LEFT of the ✕. Just the trigger — any dropdown must render OUTSIDE this hero,
  // which clips its children (overflow: hidden).
  menuButton?: ReactNode
  children?: ReactNode
}) {
  const tint = typeColor(type).bg
  const square = type === 'music'
  const posterW = 66
  const posterH = square ? 66 : 98

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      // Pull up over the sheet's 10px top padding + out over its 20px side
      // padding so the wash reaches the rounded top corners of the card.
      margin: '-10px -20px 4px', padding: '0 20px 16px',
      borderRadius: '16px 16px 0 0',
    }}>
      {/* Ghosted cover wash — blurred + faded, masked so it dissolves before the
          content below. Falls back to a flat type tint when there's no art. */}
      {cover ? (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'blur(7px)', opacity: 0.46, transform: 'scale(1.1)',
          WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 94%)',
          maskImage: 'linear-gradient(180deg, #000 0%, transparent 94%)',
        }} />
      ) : (
        <div style={{
          position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${tint}, transparent 85%)`, opacity: 0.5,
          WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 94%)',
          maskImage: 'linear-gradient(180deg, #000 0%, transparent 94%)',
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ✕ (and optional ⋯) in their own row, clear of the cover */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, paddingTop: 10, height: 24, boxSizing: 'content-box' }}>
          {menuButton}
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6F6B64', fontSize: 16, lineHeight: 1, padding: '0 0 4px' }}>✕</button>
          )}
        </div>

        {/* Cover on the left, title block beside it — tops aligned via flex-start */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          {cover && (
            <img src={cover} alt="" style={{
              width: posterW, height: posterH, flexShrink: 0,
              objectFit: 'cover', objectPosition: square ? 'center' : 'top', borderRadius: 2,
              boxShadow: '0 3px 12px rgba(0,0,0,0.22)',
            }} />
          )}
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            {/* Rank watermark — Discover only; faint, behind the title */}
            {numeral != null && (
              <span style={{
                position: 'absolute', left: -2, top: -10, zIndex: 0,
                fontSize: 116, fontWeight: 300, color: NUMERAL, lineHeight: 1, letterSpacing: '-7px',
                pointerEvents: 'none', userSelect: 'none',
              }}>{numeral}</span>
            )}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 23, fontWeight: 600, color: INK, lineHeight: 1.16, letterSpacing: '-0.4px' }}>{title}</div>
              <div style={{ fontSize: 11, color: MUTE, letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 7 }}>{meta}</div>
              {children && <div style={{ marginTop: 10 }}>{children}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
