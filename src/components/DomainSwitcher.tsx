import { useNavigate } from 'react-router-dom'

// The top-level mode toggle (the settled IA): nospaces is two domains over one
// shared library — Media (films/books/music/tv) and Things (the visual board).
// Each gets a display tuned to it; this is how you cross between them.
//
// Placement (s83): a slim hairline strip pinned just ABOVE the bottom tab bar, so
// the two nav systems read as one nested stack — domain (which world) over section
// (where in it) — both in the thumb zone, instead of split top/bottom.

const INK = '#1C1B19'

// Strip height, in px (above the safe-area inset). Every bottom-anchored element
// (content padding, FABs, action bars, the sync banner) clears the tab bar PLUS
// this, so the value is shared rather than re-derived.
export const SWITCHER_H = 40

type Domain = 'media' | 'things'

export function DomainSwitcher({ current }: { current: Domain }) {
  const navigate = useNavigate()
  const go = (d: Domain) => { if (d !== current) navigate(d === 'things' ? '/things' : '/library') }

  // Editorial, not a segmented pill: two lowercase words split by a hairline. The
  // active one reads ink + bold, the other muted + underlined ("tap to switch").
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0,
      bottom: 'calc(56px + env(safe-area-inset-bottom))',
      height: SWITCHER_H,
      background: '#fff', borderTop: '1px solid #EFEDE9',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 99,
    }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, fontSize: 14, letterSpacing: '0.01em' }}>
        <Segment label="media" active={current === 'media'} onClick={() => go('media')} />
        <span style={{ color: '#CFCBC3' }}>/</span>
        <Segment label="things" active={current === 'things'} onClick={() => go('things')} />
      </div>
    </div>
  )
}

// The inactive side gets an underline so it reads as "tap to switch", not just a
// dimmed word — the switch is the only bridge between the two domains, so it
// shouldn't be invisible.
function Segment({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active} style={{
      border: 'none', background: 'none', padding: 0, cursor: active ? 'default' : 'pointer',
      fontSize: 14, fontWeight: active ? 700 : 500,
      color: active ? INK : '#8A857C',
      textDecoration: active ? 'none' : 'underline',
      textDecorationColor: '#D5D1C9', textUnderlineOffset: 4,
    }}>{label}</button>
  )
}
