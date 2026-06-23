import type { ReactNode } from 'react'
import { typeColor } from '../lib/colors'

// Shared editorial header for the bottom-sheet detail views (Discover pick +
// Library item). One language everywhere: a ghosted cover wash that bleeds to
// the very top + edges of the card, an oversized rank watermark (Discover
// only), a crisp borderless poster floated top-right, then a big title +
// uppercase meta. No filled boxes. Owns the ✕ so the wash isn't cut off by a
// close-button row above it.
const INK = '#1C1B19'
const MUTE = '#ABA69C'
const NUMERAL = '#E0DDD5'

export function SheetHero({
  type,
  title,
  meta,
  cover,
  numeral,
  onClose,
  children,
}: {
  type: string
  title: string
  meta: string
  cover: string | null
  numeral?: number
  onClose?: () => void
  children?: ReactNode
}) {
  const tint = typeColor(type).bg
  const square = type === 'music'
  const posterW = 74
  const posterH = square ? 74 : 108

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', minHeight: 152,
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
          filter: 'blur(8px)', opacity: 0.26, transform: 'scale(1.1)',
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

      {onClose && (
        <button onClick={onClose} style={{
          position: 'absolute', top: 10, right: 16, zIndex: 3,
          background: 'none', border: 'none', cursor: 'pointer', color: '#9C9890', fontSize: 16, lineHeight: 1, padding: 4,
        }}>✕</button>
      )}

      {/* Oversized rank watermark — Discover only; sits behind the title */}
      {numeral != null && (
        <span style={{
          position: 'absolute', left: 8, top: 44,
          fontSize: 138, fontWeight: 300, color: NUMERAL, lineHeight: 1, letterSpacing: '-8px',
          zIndex: 0, pointerEvents: 'none', userSelect: 'none',
        }}>{numeral}</span>
      )}

      {/* Crisp poster — the one sharp look at the real art */}
      {cover && (
        <img src={cover} alt="" style={{
          position: 'absolute', top: 16, right: 20, width: posterW, height: posterH,
          objectFit: 'cover', objectPosition: square ? 'center' : 'top', borderRadius: 2,
          boxShadow: '0 3px 12px rgba(0,0,0,0.22)', zIndex: 2,
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 1, paddingTop: numeral != null ? 62 : 40, paddingRight: cover ? 88 : 32 }}>
        <div style={{ fontSize: 24, fontWeight: 600, color: INK, lineHeight: 1.18, letterSpacing: '-0.4px' }}>{title}</div>
        <div style={{ fontSize: 11, color: MUTE, letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 7 }}>{meta}</div>
        {children && <div style={{ marginTop: 10 }}>{children}</div>}
      </div>
    </div>
  )
}
