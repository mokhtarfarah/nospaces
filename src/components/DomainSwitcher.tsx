import { useNavigate } from 'react-router-dom'

// The top-level mode toggle (the settled IA): nospaces is two domains over one
// shared library — Media (films/books/music/tv) and Things (the visual board).
// Each gets a display tuned to it; this is how you cross between them. Replaces
// the temp 4th bottom-nav tab.

const INK = '#1C1B19'

type Domain = 'media' | 'things'

export function DomainSwitcher({ current }: { current: Domain }) {
  const navigate = useNavigate()
  const go = (d: Domain) => { if (d !== current) navigate(d === 'things' ? '/things' : '/library') }

  // Editorial, not a segmented pill: two lowercase words split by a hairline. The
  // active one reads ink + bold, the other muted — same language as the rest of
  // the app (no borrowed iOS chrome at the very top of the screen).
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 14px' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 13, fontSize: 15, letterSpacing: '0.01em' }}>
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
      fontSize: 15, fontWeight: active ? 700 : 500,
      color: active ? INK : '#8A857C',
      textDecoration: active ? 'none' : 'underline',
      textDecorationColor: '#D5D1C9', textUnderlineOffset: 4,
    }}>{label}</button>
  )
}
