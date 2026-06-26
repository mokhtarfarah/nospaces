import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { NAV_H, clearStack } from '../lib/layout'
import { DomainLinks } from './DomainSwitcher'

// The media domain's bottom bar (s85): one editorial row — the domain switcher
// (media / things) anchored left, the sections (library / taste / discover) as
// slash-split text links on the right, smaller + quieter so the world outranks
// the section. Icons + the separate switcher strip are gone.
export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const showFab = location.pathname !== '/add'

  const link = (isActive: boolean): React.CSSProperties => ({
    textDecoration: 'none', fontSize: 13,
    color: isActive ? '#1C1B19' : '#A8A39A', fontWeight: isActive ? 600 : 400,
  })
  const slash = <span style={{ color: '#D5D1C9', fontSize: 12 }}>/</span>

  return (
    <>
      {/* Floating add button — hidden on the add screen itself */}
      {showFab && (
        <button
          onClick={() => navigate('/add')}
          aria-label="add"
          style={{
            position: 'fixed', bottom: clearStack(18), right: 20,
            width: 50, height: 50, borderRadius: '50%',
            background: '#1C1B19', color: '#fff', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99, boxShadow: '0 2px 16px rgba(0,0,0,0.22)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: `calc(${NAV_H}px + env(safe-area-inset-bottom))`,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: '#fff', borderTop: '1px solid #E8E8E8',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px', boxSizing: 'border-box', zIndex: 100,
      }}>
        <DomainLinks current="media" />
        <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
          <NavLink to="/library" style={({ isActive }) => link(isActive)}>library</NavLink>
          {slash}
          <NavLink to="/taste" style={({ isActive }) => link(isActive)}>taste</NavLink>
          {slash}
          <NavLink to="/discover" style={({ isActive }) => link(isActive)}>discover</NavLink>
        </div>
      </nav>
    </>
  )
}
