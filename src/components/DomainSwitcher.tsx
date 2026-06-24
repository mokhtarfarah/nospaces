import { useNavigate } from 'react-router-dom'

// The top-level mode toggle (the settled IA): nospaces is two domains over one
// shared library — Media (films/books/music/tv) and Things (the visual board).
// Each gets a display tuned to it; this is how you cross between them. Replaces
// the temp 4th bottom-nav tab.

const INK = '#1C1B19'
const MUTED = '#ABA69C'

type Domain = 'media' | 'things'

export function DomainSwitcher({ current }: { current: Domain }) {
  const navigate = useNavigate()
  const go = (d: Domain) => { if (d !== current) navigate(d === 'things' ? '/things' : '/library') }

  // Editorial, not a segmented pill: two lowercase words split by a hairline. The
  // active one reads ink + bold, the other muted — same language as the rest of
  // the app (no borrowed iOS chrome at the very top of the screen).
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 14px' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 11, fontSize: 14, letterSpacing: '0.01em' }}>
        <Segment label="media" active={current === 'media'} onClick={() => go('media')} />
        <span style={{ color: '#DAD7D0' }}>/</span>
        <Segment label="things" active={current === 'things'} onClick={() => go('things')} />
      </div>
    </div>
  )
}

function Segment({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active} style={{
      border: 'none', background: 'none', padding: 0, cursor: active ? 'default' : 'pointer',
      fontSize: 14, fontWeight: active ? 600 : 400,
      color: active ? INK : MUTED,
    }}>{label}</button>
  )
}
