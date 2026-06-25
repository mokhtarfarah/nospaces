import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LibraryIcon, TasteIcon, DiscoverIcon } from './navIcons'
import { NAV_H, NAV_ICON, navButtonBase, clearStack } from '../lib/layout'

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  const base: React.CSSProperties = {
    ...navButtonBase,
    color: '#999',
    textDecoration: 'none',
    flex: 1,
  }

  const showFab = location.pathname !== '/add'

  return (
    <>
      {/* Floating add button — hidden on the add screen itself */}
      {showFab && (
        <button
          onClick={() => navigate('/add')}
          aria-label="add"
          style={{
            position: 'fixed',
            bottom: clearStack(18),
            right: 20,
            width: 50,
            height: 50,
            borderRadius: '50%',
            background: '#1C1B19',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99,
            boxShadow: '0 2px 16px rgba(0,0,0,0.22)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: `calc(${NAV_H}px + env(safe-area-inset-bottom))`,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: '#fff',
        borderTop: '1px solid #E8E8E8',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 100,
      }}>
        <NavLink to="/library" style={({ isActive }) => ({ ...base, color: isActive ? '#111111' : '#999' })}>
          <LibraryIcon size={NAV_ICON} />
          library
        </NavLink>
        <NavLink to="/taste" style={({ isActive }) => ({ ...base, color: isActive ? '#111111' : '#999' })}>
          <TasteIcon size={NAV_ICON} />
          taste
        </NavLink>
        <NavLink to="/discover" style={({ isActive }) => ({ ...base, color: isActive ? '#111111' : '#999' })}>
          <DiscoverIcon size={NAV_ICON} />
          discover
        </NavLink>
      </nav>
    </>
  )
}
