import { NavLink } from 'react-router-dom'

export function BottomNav() {
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

  return (
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
      <NavLink to="/add" style={({ isActive }) => ({ ...base, color: isActive ? '#111111' : '#999' })}>
        <AddIcon />
        add
      </NavLink>
      <NavLink to="/library" style={({ isActive }) => ({ ...base, color: isActive ? '#111111' : '#999' })}>
        <LibraryIcon />
        library
      </NavLink>
    </nav>
  )
}

function AddIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
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
