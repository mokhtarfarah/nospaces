import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { NAV_H, NAV_TINT, SUBNAV_H, clearStack } from '../lib/layout'
import { DomainLinks } from './DomainSwitcher'

// The media domain's bottom bar (s85): one editorial row — the domain switcher
// (media / things) anchored left, the sections (library · taste · discover) as
// text links on the right, smaller + quieter so the world outranks the section.
// Only the domain toggle keeps its slash (s118); the section links are spaced,
// not slash-split, so the divider marks the one real crossing (which world) and
// the sibling sections just sit as quiet options. Icons + switcher strip are gone.
// The floating + opens the add sheet (s88) — adding is a card over the page now,
// not a navigation, so the FAB calls onAdd rather than routing to /add.
//
// `subNav` (s108): an optional quiet second row above the main one — the taste
// screen's profile/desert-island switcher, handed up via context since this
// component renders outside the route tree. Keeps that sub-view switch in the
// same physical zone as the rest of nav instead of splitting top vs. bottom.
export function BottomNav({ onAdd, subNav }: { onAdd: () => void; subNav?: ReactNode }) {
  const link = (isActive: boolean): React.CSSProperties => ({
    textDecoration: 'none', fontSize: 13,
    color: isActive ? '#1C1B19' : '#A8A39A', fontWeight: isActive ? 600 : 400,
  })
  return (
    <>
      {/* Floating add button — opens the add sheet over the current page */}
      <button
        onClick={onAdd}
        aria-label="add"
          style={{
            position: 'fixed', bottom: clearStack(subNav ? 18 + SUBNAV_H : 18), right: 20,
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

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100 }}>
        {subNav && (
          <div style={{
            background: NAV_TINT, borderTop: '1px solid #ECE9E2',
            height: SUBNAV_H, boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16,
            padding: '0 18px',
          }}>
            {subNav}
          </div>
        )}
        <nav style={{
          height: `calc(${NAV_H}px + env(safe-area-inset-bottom))`,
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: NAV_TINT, borderTop: '1px solid #ECE9E2',
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          padding: '14px 18px 0', boxSizing: 'border-box',
        }}>
          <DomainLinks current="media" />
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 14 }}>
            <NavLink to="/library" style={({ isActive }) => link(isActive)}>library</NavLink>
            <NavLink to="/taste" style={({ isActive }) => link(isActive)}>taste</NavLink>
            <NavLink to="/discover" style={({ isActive }) => link(isActive)}>discover</NavLink>
          </div>
        </nav>
      </div>
    </>
  )
}
