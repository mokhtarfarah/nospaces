// Bottom-chrome geometry — ONE source of truth, so the many fixed/anchored
// elements that have to clear it (content padding, FABs, action bars, sheets, the
// sync banner) derive from these instead of re-hardcoding 56/84/108… per screen.
//
// The bottom chrome is a two-row panel: a slim domain-switcher row (which world —
// media/things) sitting directly above the tab bar (where in it — library/taste/
// discover). Tune either height here and everything that clears it re-flows.

// The two bottom rows are deliberately the SAME height so they read as matched
// halves of one panel rather than a caption stuck under a fat bar.
export const NAV_H = 36       // tab bar height, px (above the safe-area inset)
export const SWITCHER_H = 36  // domain-switcher row — equal to the tab row
export const BOTTOM_STACK = NAV_H + SWITCHER_H // full panel height, px

// `calc(<px> + safe-area)` for something sitting just above the WHOLE panel.
// `extra` adds breathing room (content gap, FAB gap, a tall sheet, …).
export const clearStack = (extra = 0) =>
  `calc(${BOTTOM_STACK + extra}px + env(safe-area-inset-bottom))`

// Same, but clearing only the tab bar — for the switcher itself, and the
// select-mode bar that overlays the switcher.
export const clearNav = (extra = 0) =>
  `calc(${NAV_H + extra}px + env(safe-area-inset-bottom))`

// Shared button chrome for both domains' tab bars (media BottomNav + ThingsNav),
// kept slim so the bar stays in proportion with the skinny switcher row above it.
export const NAV_ICON = 18
export const navButtonBase: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  border: 'none', background: 'none', cursor: 'pointer',
  fontSize: 10, fontWeight: 500, padding: '3px 24px',
}
