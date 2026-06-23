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

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 14px' }}>
      <div style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 999, background: '#F4F2EE', border: '1px solid #E8E8E8' }}>
        <Segment label="media" active={current === 'media'} onClick={() => go('media')} />
        <Segment label="things" active={current === 'things'} onClick={() => go('things')} />
      </div>
    </div>
  )
}

function Segment({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active} style={{
      border: 'none', cursor: active ? 'default' : 'pointer',
      padding: '6px 18px', borderRadius: 999,
      fontSize: 13, fontWeight: 600, letterSpacing: '0.01em',
      background: active ? '#fff' : 'transparent',
      color: active ? INK : MUTED,
      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
    }}>{label}</button>
  )
}
