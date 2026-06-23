import type { ReactNode } from 'react'
import { typeColor } from '../lib/colors'

// Shared editorial header for the bottom-sheet detail views (Discover pick +
// Library item). One language everywhere: a ghosted cover wash that bleeds up
// behind the close-button row to the rounded top of the card, an oversized
// rank watermark (Discover only), a crisp borderless poster, then a big title
// + uppercase meta. No filled boxes. The ✕ keeps its own row (it never sits on
// the art); the wash simply starts further up, behind it.
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

      {/* Oversized rank watermark — Discover only; sits behind the title, below ✕ */}
      {numeral != null && (
        <span style={{
          position: 'absolute', left: 8, top: 46,
          fontSize: 138, fontWeight: 300, color: NUMERAL, lineHeight: 1, letterSpacing: '-8px',
          zIndex: 0, pointerEvents: 'none', userSelect: 'none',
        }}>{numeral}</span>
      )}

      {/* Crisp poster — the one sharp look at the real art; sits below the ✕ row */}
      {cover && (
        <img src={cover} alt="" style={{
          position: 'absolute', top: 40, right: 20, width: posterW, height: posterH,
          objectFit: 'cover', objectPosition: square ? 'center' : 'top', borderRadius: 2,
          boxShadow: '0 3px 12px rgba(0,0,0,0.22)', zIndex: 2,
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ✕ in its own row, as before — never over the cover art */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, height: 24, boxSizing: 'content-box' }}>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6F6B64', fontSize: 16, lineHeight: 1, padding: '0 0 4px' }}>✕</button>
          )}
        </div>

        <div style={{ paddingTop: numeral != null ? 52 : 6, paddingRight: cover ? 88 : 32 }}>
          <div style={{ fontSize: 24, fontWeight: 600, color: INK, lineHeight: 1.18, letterSpacing: '-0.4px' }}>{title}</div>
          <div style={{ fontSize: 11, color: MUTE, letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 7 }}>{meta}</div>
          {children && <div style={{ marginTop: 10 }}>{children}</div>}
        </div>
      </div>
    </div>
  )
}
