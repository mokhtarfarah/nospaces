import { useNavigate } from 'react-router-dom'

// The top-level mode toggle (the settled IA): nospaces is two domains over one
// shared library — Media (films/books/music/tv) and Things (the visual board).
//
// Placement (s85): the LEFT half of the single bottom bar, as the editorial
// anchor — two lowercase words split by a hairline slash, bigger than the section
// links on the right so the bar reads "which world" › "where in it". The active
// word is ink + bold; the other is muted + underlined ("tap to switch"). Embedded
// in BottomNav / ThingsNav now, not its own fixed strip.

const INK = '#1C1B19'

type Domain = 'media' | 'things'

export function DomainLinks({ current }: { current: Domain }) {
  const navigate = useNavigate()
  const go = (d: Domain) => { if (d !== current) navigate(d === 'things' ? '/things' : '/library') }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
      <Word label="media" active={current === 'media'} onClick={() => go('media')} />
      <span style={{ color: '#CFCBC3', fontSize: 15 }}>/</span>
      <Word label="things" active={current === 'things'} onClick={() => go('things')} />
    </div>
  )
}

// The inactive side gets an underline so it reads as "tap to switch", not just a
// dimmed word — the switch is the only bridge between the two domains.
function Word({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active} style={{
      border: 'none', background: 'none', padding: 0, cursor: active ? 'default' : 'pointer',
      fontSize: 16, fontWeight: active ? 700 : 500, letterSpacing: '0.01em',
      color: active ? INK : '#8A857C',
      textDecoration: active ? 'none' : 'underline',
      textDecorationColor: '#D5D1C9', textUnderlineOffset: 4,
    }}>{label}</button>
  )
}
