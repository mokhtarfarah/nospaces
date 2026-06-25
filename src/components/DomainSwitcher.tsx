import { useNavigate } from 'react-router-dom'
import { SWITCHER_H, clearNav } from '../lib/layout'

// The top-level mode toggle (the settled IA): nospaces is two domains over one
// shared library — Media (films/books/music/tv) and Things (the visual board).
// Each gets a display tuned to it; this is how you cross between them.
//
// Placement (s83): a slim hairline strip pinned just ABOVE the bottom tab bar, so
// the two nav systems read as one nested stack — domain (which world) over section
// (where in it) — both in the thumb zone, instead of split top/bottom.

const INK = '#1C1B19'

// SWITCHER_H + all the bottom-clearing math now live in lib/layout.ts (one source
// of truth). Kept slim (s84) so the switcher reads as the top row of ONE bottom
// panel, not a second stacked slab — its top border is the panel's outer edge,
// the tab bar's top border the divider.

type Domain = 'media' | 'things'

export function DomainSwitcher({ current }: { current: Domain }) {
  const navigate = useNavigate()
  const go = (d: Domain) => { if (d !== current) navigate(d === 'things' ? '/things' : '/library') }

  // Editorial, not a segmented pill: two lowercase words split by a hairline. The
  // active one reads ink + bold, the other muted + underlined ("tap to switch").
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0,
      bottom: clearNav(),
      height: SWITCHER_H,
      background: '#fff', borderTop: '1px solid #EFEDE9',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 99,
    }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 11.5, letterSpacing: '0.01em' }}>
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
      fontSize: 11.5, fontWeight: active ? 700 : 500,
      color: active ? INK : '#8A857C',
      textDecoration: active ? 'none' : 'underline',
      textDecorationColor: '#D5D1C9', textUnderlineOffset: 4,
    }}>{label}</button>
  )
}
