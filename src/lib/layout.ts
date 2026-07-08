// Bottom-chrome geometry — ONE source of truth, so the many fixed/anchored
// elements that have to clear it (content padding, FABs, action bars, sheets, the
// sync banner) derive from these instead of re-hardcoding heights per screen.
//
// The bottom chrome is now a SINGLE editorial row: the domain on the left
// (media / things) and the section on the right (library / taste / discover, or
// the board's wishlist / taste), split by slashes. Was a two-row stack (a slim
// switcher caption over a fat icon tab bar) through s84.

export const NAV_H = 54            // single bottom-bar row height, px (above the safe-area inset) — taller since s86 to seat the bigger media/things masthead
export const BOTTOM_STACK = NAV_H  // the whole bottom panel is one row now

// A second, quieter row that sits directly above the main nav row — used only
// on the taste screens (media: profile/desert-island; things: profile/moodboard)
// so the sub-view switcher lives in the same physical zone as the rest of nav
// instead of splitting across the top and bottom of the screen (s108).
export const SUBNAV_H = 28
// Barely-there tint for the whole bottom-nav zone (main row + sub-row when
// present) — visually seals it as one "this strip is chrome" unit, distinct
// from the white page content above it. Deliberately subtle.
export const NAV_TINT = '#F7F5F0'

// `calc(<px> + safe-area)` for something sitting just above the bottom bar.
// `extra` adds breathing room (content gap, FAB gap, a tall sheet, …). clearStack
// and clearNav are equal now (one row) but both are kept so callers read clearly.
export const clearStack = (extra = 0) =>
  `calc(${BOTTOM_STACK + extra}px + env(safe-area-inset-bottom))`

export const clearNav = (extra = 0) =>
  `calc(${NAV_H + extra}px + env(safe-area-inset-bottom))`
