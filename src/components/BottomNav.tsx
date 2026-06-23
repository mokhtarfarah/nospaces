import { NavLink, useLocation, useNavigate } from 'react-router-dom'

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  const base: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '8px 24px',
    fontSize: 11,
    fontWeight: 500,
    color: '#999',
    textDecoration: 'none',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
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
            bottom: 'calc(56px + env(safe-area-inset-bottom) + 18px)',
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
        height: 'calc(56px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: '#fff',
        borderTop: '1px solid #E8E8E8',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 100,
      }}>
        <NavLink to="/library" style={({ isActive }) => ({ ...base, color: isActive ? '#111111' : '#999' })}>
          <LibraryIcon />
          library
        </NavLink>
        <NavLink to="/taste" style={({ isActive }) => ({ ...base, color: isActive ? '#111111' : '#999' })}>
          <TasteIcon />
          taste
        </NavLink>
        <NavLink to="/discover" style={({ isActive }) => ({ ...base, color: isActive ? '#111111' : '#999' })}>
          <DiscoverIcon />
          discover
        </NavLink>
        <NavLink to="/things" style={({ isActive }) => ({ ...base, color: isActive ? '#111111' : '#999' })}>
          <ThingsIcon />
          things
        </NavLink>
      </nav>
    </>
  )
}

function LibraryIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="4" height="16" rx="1" />
      <rect x="10" y="4" width="4" height="16" rx="1" />
      <rect x="17" y="4" width="4" height="16" rx="1" />
    </svg>
  )
}

function DiscoverIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 3 L14.5 9.5 L21 12 L14.5 14.5 L12 21 L9.5 14.5 L3 12 L9.5 9.5 Z" />
    </svg>
  )
}

function ThingsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 L18 2 L21 7 L12 22 L3 7 Z" />
      <path d="M3 7 L21 7" />
      <path d="M12 7 L12 22" />
    </svg>
  )
}

function TasteIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" />
      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" />
    </svg>
  )
}
