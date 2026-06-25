import type { ItemReaction } from '../lib/database.types'

// Ordering option used when sorting items within a view.
export type SortOption = 'date_added' | 'updated' | 'alpha' | 'status' | 'reaction' | 'creator' | 'year'

export type SortDir = 'asc' | 'desc'

export type ReactionFilter = 'all' | ItemReaction

// A "view" bundles ordering + grouping into one coherent choice, instead of two
// separate (and conflicting) sort/group controls.
export type ViewMode = 'recent' | 'year' | 'creator' | 'alpha'

// `defaultDir` is the order a view opens in. `directional` views can be reversed
// by tapping the already-selected row again (a → z becomes z → a, etc).
export const VIEW_CONFIG: Record<ViewMode, {
  sort: SortOption
  group: 'month' | 'creator' | 'none'
  label: string
  hint: string
  defaultDir: SortDir
  directional?: boolean
}> = {
  recent:  { sort: 'date_added', group: 'month',   label: 'recent',     hint: 'by date added, grouped by month',       defaultDir: 'desc', directional: true },
  year:    { sort: 'year',       group: 'none',    label: 'by year',    hint: 'release year',                          defaultDir: 'desc', directional: true },
  creator: { sort: 'creator',    group: 'creator', label: 'by creator', hint: 'grouped by director / author / artist', defaultDir: 'asc',  directional: true },
  alpha:   { sort: 'alpha',      group: 'none',    label: 'a → z',      hint: 'alphabetical',                          defaultDir: 'asc',  directional: true },
}

// The sort/view options, in display order. The combined view+sort+filter sheet
// (in LibraryScreen) renders these; this file stays the single source of the
// config + types.
export const ORDER: ViewMode[] = ['recent', 'year', 'creator', 'alpha']
