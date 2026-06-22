import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Item, ItemStatus, ItemReaction } from '../lib/database.types'
import { typeColor, TYPE_COLORS } from '../lib/colors'
import { useItems } from '../hooks/useItems'
import { MarkDoneSheet } from '../components/MarkDoneSheet'
import { ViewSheet, VIEW_CONFIG, type ViewMode, type SortOption, type SortDir, type ReactionFilter } from '../components/ViewSheet'
import { ItemActionSheet } from '../components/ItemActionSheet'
import { DuplicatesSheet } from '../components/DuplicatesSheet'
import { GapsSheet } from '../components/GapsSheet'
import { CapturesSheet } from '../components/CapturesSheet'
import { fetchCaptures, clearCaptures, clearCapture, isFailure, type EmailCapture } from '../lib/captures'
import { useWikipediaInfo, type WikiInfo } from '../lib/wikipedia'
import { useArtwork } from '../lib/artwork'
import { getSeasons } from '../lib/seasons'
import { VIBES, VERDICTS } from '../lib/moods'
import { isGenreTag } from '../lib/genres'
import { gapQueue, dismissGaps, itemGaps } from '../lib/gaps'
import { inReview, reviewCount } from '../lib/review'


type StatusFilter = 'all' | ItemStatus

// Persist the main library filters/view across reloads so a refresh doesn't reset
// everything back to "all / recent". Stored in localStorage (per device).
const PREFS_KEY = 'nospaces.libraryPrefs'
// Scroll position is stashed per-session so an iOS PWA reload (e.g. tapping
// through to Spotify and back kills + reloads the standalone app) returns you
// to where you were instead of the top of the list.
const SCROLL_KEY = 'nospaces.libraryScroll'
type LibraryPrefs = {
  categories: string[]; statusFilter: StatusFilter; reactionFilter: ReactionFilter
  view: ViewMode; dir: SortDir; layout: 'list' | 'grid'; gridCols: 3 | 4
}
function loadPrefs(): Partial<LibraryPrefs> {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } catch { return {} }
}

const REACTION_LABELS: Record<ItemReaction, string> = {
  loved_it:   'loved it',
  liked_it:   'liked it',
  eh:         'eh',
  not_for_me: 'not for me',
}

const REACTION_ORDER: ItemReaction[] = ['loved_it', 'liked_it', 'eh', 'not_for_me']

function formatMonthYear(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// Comparison in the *ascending* sense for each sort. Direction is applied on top
// by sortItems, so 'asc'/'desc' is consistent across every view.
function compareItems(a: Item, b: Item, sort: SortOption): number {
  switch (sort) {
    case 'date_added':
      return new Date(a.date_added).getTime() - new Date(b.date_added).getTime()
    case 'updated':
      return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    case 'alpha':
      return a.title.localeCompare(b.title)
    case 'status': {
      const order = { want_to: 0, in_progress: 1, done: 2 }
      return (order[a.status] ?? 0) - (order[b.status] ?? 0)
    }
    case 'reaction': {
      const ai = a.reaction ? REACTION_ORDER.indexOf(a.reaction) : 99
      const bi = b.reaction ? REACTION_ORDER.indexOf(b.reaction) : 99
      return ai - bi
    }
    case 'creator':
      return lastNameKey(a.creator).localeCompare(lastNameKey(b.creator))
    case 'year':
      return (a.year ?? 0) - (b.year ?? 0)
  }
}

function sortItems(items: Item[], sort: SortOption, dir: SortDir): Item[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) => sign * compareItems(a, b, sort))
}

function groupByMonth(items: Item[]): Map<string, Item[]> {
  const map = new Map<string, Item[]>()
  for (const item of items) {
    const dateStr = item.status === 'done' && item.date_done ? item.date_done : item.date_added
    const key = formatMonthYear(dateStr)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return map
}

// Sort key for creators: by last name (last word), so authors/directors order by
// surname (e.g. "Donna Tartt" -> "tartt"). "Unknown" sinks to the bottom.
function lastNameKey(creator: string | null | undefined): string {
  const name = creator?.trim()
  if (!name) return '￿'
  return (name.split(/\s+/).pop() ?? name).toLowerCase()
}

function groupByCreator(items: Item[]): Map<string, Item[]> {
  const map = new Map<string, Item[]>()
  for (const item of items) {
    const key = item.creator?.trim() || 'Unknown'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  // Alphabetical by last name, with "Unknown" last.
  return new Map(
    [...map.entries()].sort((a, b) =>
      a[0] === 'Unknown' ? 1 : b[0] === 'Unknown' ? -1 : lastNameKey(a[0]).localeCompare(lastNameKey(b[0])),
    ),
  )
}

function groupNone(items: Item[]): Map<string, Item[]> {
  return new Map([['', items]])
}

function groupByDecade(items: Item[]): Map<string, Item[]> {
  const map = new Map<string, Item[]>()
  for (const item of items) {
    const key = item.year ? `${Math.floor(item.year / 10) * 10}s` : 'unknown'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return map
}

function itemSource(item: Item): string {
  return item.source_detail?.trim() || item.source.replace(/_/g, ' ')
}

export function LibraryScreen() {
  const { items, loading, markDone, markWantTo, markInProgress, deleteItem, editItem, toggleOwned, toggleCanon, patchMetadata, duplicateCount, duplicateGroups, deleteMany } = useItems()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const handleSaveWiki = useCallback((id: string, wiki: WikiInfo) => {
    patchMetadata(id, { wikiUrl: wiki.url, wikiThumb: wiki.thumbnail, wikiSummary: wiki.summary })
  }, [patchMetadata])
  const handleSaveArt = useCallback((id: string, url: string) => {
    patchMetadata(id, { coverUrl: url })
  }, [patchMetadata])
  const dupes = duplicateCount()
  const gapCount = useMemo(() => items.filter(i => itemGaps(i).length > 0).length, [items])
  const seriesOptions = useMemo(() =>
    [...new Set(items.flatMap(i => {
      const s = i.metadata?.series
      return typeof s === 'string' && s.trim() ? [s.trim()] : []
    }))].sort(),
    [items]
  )

  // Empty array = all categories. Single-select: tapping a type switches to just that
  // one (tap it again to clear back to All). Array kept so multi-select can return later.
  const [categories, setCategories] = useState<string[]>(() => loadPrefs().categories ?? [])
  const [reviewOnly, setReviewOnly] = useState(false)
  const selectCategory = (t: string) => {
    setReviewOnly(false)
    setVibeFilter([]); setGenreFilter([]); setSeriesFilter([]); setFilterSheetOpen(false)
    setCategories(prev => (prev.length === 1 && prev[0] === t ? [] : [t]))
  }
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => loadPrefs().statusFilter ?? 'all')
  const [reactionFilter, setReactionFilter] = useState<ReactionFilter>(() => loadPrefs().reactionFilter ?? 'all')
  const [newMusicOnly, setNewMusicOnly] = useState(false)
  // Filter-sheet selections are multi-select: OR within a group, AND across
  // groups (faceted filtering). Empty array = that group isn't narrowing.
  const [vibeFilter, setVibeFilter] = useState<string[]>([])
  const [verdictFilter, setVerdictFilter] = useState<string[]>([])
  const [genreFilter, setGenreFilter] = useState<string[]>([])
  const [seriesFilter, setSeriesFilter] = useState<string[]>([])
  const toggleFilter = (set: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    set(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]))
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  // Guard against a view persisted before some options were removed — fall back
  // to 'year' so an old localStorage value can't index into a missing config.
  const [view, setView] = useState<ViewMode>(() => {
    const v = loadPrefs().view
    return v && v in VIEW_CONFIG ? v : 'year'
  })
  const [dir, setDir] = useState<SortDir>(() => loadPrefs().dir ?? VIEW_CONFIG.year.defaultDir)
  const [layout, setLayout] = useState<'list' | 'grid'>(() => loadPrefs().layout ?? 'grid')
  // 3 vs 4 columns in grid view — 3 reads well on mobile, 4 is tighter for desktop.
  // Persisted per-device (localStorage), so each device keeps its own preference.
  const [gridCols, setGridCols] = useState<3 | 4>(() => loadPrefs().gridCols ?? 3)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [viewSheetOpen, setViewSheetOpen] = useState(false)
  const [dupesOpen, setDupesOpen] = useState(false)
  const [gapsOpen, setGapsOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  // Email-capture feed: forwards that added nothing (failed/no-op) so they don't
  // vanish silently. Fetched once on mount; surfaced in the overflow menu only
  // when there's something to show.
  const [captures, setCaptures] = useState<EmailCapture[]>([])
  const [capturesOpen, setCapturesOpen] = useState(false)
  useEffect(() => { fetchCaptures().then(setCaptures) }, [])
  const captureFailures = useMemo(() => captures.filter(isFailure).length, [captures])
  // Header collapse-on-scroll: the title row + view control fold away once the
  // user scrolls into the collection, leaving the category + status tab rows
  // pinned. Hysteresis (collapse past 56px, expand under 16px) avoids flicker
  // from momentum/rubber-band scrolling near the threshold.
  const [collapsed, setCollapsed] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const lastScrollRef = useRef(0)
  const onListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const t = e.currentTarget.scrollTop
    lastScrollRef.current = t
    setCollapsed(prev => (prev ? t > 16 : t > 56))
  }, [])
  // Persist scroll on background/hide (the moment iOS may kill a standalone PWA),
  // and restore it once the list has loaded after the resulting reload.
  useEffect(() => {
    const save = () => {
      try { sessionStorage.setItem(SCROLL_KEY, String(lastScrollRef.current)) } catch { /* ignore quota/private-mode */ }
    }
    const onVisibility = () => { if (document.visibilityState === 'hidden') save() }
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  const scrollRestoredRef = useRef(false)
  useEffect(() => {
    if (loading || scrollRestoredRef.current) return
    scrollRestoredRef.current = true
    let saved = 0
    try { saved = Number(sessionStorage.getItem(SCROLL_KEY)) || 0 } catch { /* ignore */ }
    if (saved <= 0) return
    // The list keeps growing for a few frames after load (decade groups + cover
    // images mount), so a single scrollTo clamps to a too-short max and lands at
    // top. Retry until the content is tall enough for the offset to stick (or we
    // give up after ~1.5s of growing).
    let frame = 0
    const tryRestore = () => {
      const el = listRef.current
      if (!el) return
      el.scrollTo({ top: saved })
      const stuck = Math.abs(el.scrollTop - saved) <= 2
      if (!stuck && frame < 90) { frame++; requestAnimationFrame(tryRestore) }
    }
    requestAnimationFrame(tryRestore)
  }, [loading])

  const [doneItem, setDoneItem] = useState<Item | null>(null)
  const [actionItem, setActionItem] = useState<Item | null>(null)
  // When deep-linked from the data-gaps list with &edit=1, open straight into edit.
  const [actionEdit, setActionEdit] = useState(false)
  // Tidy queue: an ordered snapshot of gappy item ids + a cursor, so "save & next"
  // walks through them without bouncing back to the Add page. null = not tidying.
  const [tidyQueue, setTidyQueue] = useState<string[] | null>(null)
  const [tidyIndex, setTidyIndex] = useState(0)
  const [reviewQueue, setReviewQueue] = useState<string[] | null>(null)
  const [reviewIndex, setReviewIndex] = useState(0)
  // Deep-link: arriving with ?item=<id> (e.g. from the data-gaps list) opens that
  // item's action sheet so it can be filled in place, then clears the param.
  useEffect(() => {
    const id = searchParams.get('item')
    if (!id || loading) return
    const target = items.find(i => i.id === id)
    if (target) {
      setActionItem(target)
      setActionEdit(searchParams.get('edit') === '1')
      // tidy=1 → start a walk-through queue beginning at the tapped item.
      // gap=<type> scopes the queue to items missing that one field, matching
      // the gap-type filter the list was showing on the Add page.
      if (searchParams.get('tidy') === '1') {
        const gapType = searchParams.get('gap')
        const queue = gapQueue(items)
        const scoped = gapType ? queue.filter(x => x.gaps.includes(gapType)) : queue
        const q = scoped.map(x => x.item.id)
        const start = q.indexOf(id)
        setTidyQueue(q)
        setTidyIndex(start < 0 ? 0 : start)
      }
    }
    setSearchParams(prev => { prev.delete('item'); prev.delete('edit'); prev.delete('tidy'); prev.delete('gap'); return prev }, { replace: true })
  }, [searchParams, loading, items, setSearchParams])

  // Build a review queue when an inbox item is opened (if not already in one).
  // Reset it when the sheet is closed.
  useEffect(() => {
    if (actionItem && inReview(actionItem) && !reviewQueue) {
      const queue = sortItems(items.filter(inReview), sort, dir).map(i => i.id)
      const idx = queue.indexOf(actionItem.id)
      setReviewQueue(queue)
      setReviewIndex(idx >= 0 ? idx : 0)
    }
    if (!actionItem) {
      setReviewQueue(null)
      setReviewIndex(0)
    }
    // Intentionally keyed only on actionItem: this builds the queue once when a
    // sheet opens. Re-running on items/sort/dir changes would rebuild mid-review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionItem])

  // Advance the tidy queue to the next still-present item (skips deleted ones).
  // When the queue runs out, close the sheet and head back to the Add page.
  const goToTidy = useCallback((from: number) => {
    if (!tidyQueue) { setActionItem(null); setActionEdit(false); return }
    for (let i = from; i < tidyQueue.length; i++) {
      const next = items.find(it => it.id === tidyQueue[i])
      if (next) { setTidyIndex(i); setActionItem(next); setActionEdit(true); return }
    }
    setActionItem(null); setActionEdit(false); setTidyQueue(null)
  }, [tidyQueue, items])

  const goToReview = useCallback((from: number) => {
    if (!reviewQueue) { setActionItem(null); return }
    for (let i = from; i < reviewQueue.length; i++) {
      const next = items.find(it => it.id === reviewQueue[i] && inReview(it))
      if (next) { setReviewIndex(i); setActionItem(next); return }
    }
    setReviewQueue(null); setActionItem(null)
    setToast('🥂 inbox cleared')
    setTimeout(() => setToast(null), 3000)
  }, [reviewQueue, items])
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const exitSelect = () => { setSelectMode(false); setSelectedIds(new Set()); setConfirmBulkDelete(false) }

  // Persist filters/view so a refresh keeps the user where they were.
  useEffect(() => {
    const prefs: LibraryPrefs = { categories, statusFilter, reactionFilter, view, dir, layout, gridCols }
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* ignore quota/private-mode */ }
  }, [categories, statusFilter, reactionFilter, view, dir, layout, gridCols])

  // Clear-all-filters — only offered when something is actually narrowing the list.
  const filtersActive = categories.length > 0 || statusFilter !== 'all' || reactionFilter !== 'all'
    || vibeFilter.length > 0 || verdictFilter.length > 0 || genreFilter.length > 0 || seriesFilter.length > 0
    || reviewOnly || newMusicOnly || !!query.trim()
  // Badge counts every selected chip across groups, so "filter · 3" reflects how
  // many tags are narrowing the list (not just how many groups are touched).
  const filterCount = vibeFilter.length + verdictFilter.length + genreFilter.length + seriesFilter.length
  function clearFilters() {
    setCategories([]); setStatusFilter('all'); setReactionFilter('all')
    setVibeFilter([]); setVerdictFilter([]); setGenreFilter([]); setSeriesFilter([])
    setReviewOnly(false); setNewMusicOnly(false); setQuery(''); setFilterSheetOpen(false)
  }

  const sort: SortOption = VIEW_CONFIG[view].sort
  const group = VIEW_CONFIG[view].group

  // Tapping a new view switches to it (in its default order) and closes the sheet.
  // Tapping the already-active directional view just reverses the order, sheet stays open.
  const selectView = (v: ViewMode) => {
    if (v === view) {
      if (VIEW_CONFIG[v].directional) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
      else setViewSheetOpen(false)
    } else {
      setView(v)
      setDir(VIEW_CONFIG[v].defaultDir)
      setViewSheetOpen(false)
    }
  }

  // "New Music Tuesday" toggle only applies while viewing the Music category alone.
  const musicOnly = categories.length === 1 && categories[0] === 'music'
  // Series only makes sense inside a single medium that actually has series
  // (film / book / tv) — never on "all" or music.
  const seriesRelevant = categories.length === 1 && ['film', 'book', 'tv'].includes(categories[0])

  // Base filter: everything except the tag/vibe filter. Used to compute which
  // vibe/genre chips should be shown so they don't vanish when one is selected.
  const baseFiltered = useMemo(() => {
    return items.filter(item => {
      if (reviewOnly) return inReview(item)
      if (inReview(item)) return false
      if (categories.length > 0 && !categories.includes(item.type)) return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (reactionFilter !== 'all' && item.reaction !== reactionFilter) return false
      if (newMusicOnly && musicOnly && !itemSource(item).toLowerCase().includes('new music tuesday')) return false
      if (query) {
        const q = query.toLowerCase()
        const hit = item.title.toLowerCase().includes(q)
          || item.creator?.toLowerCase().includes(q)
          || item.tags?.some(t => t.toLowerCase().includes(q))  // incl. descriptor tags
        if (!hit) return false
      }
      return true
    })
  }, [items, categories, statusFilter, reactionFilter, newMusicOnly, musicOnly, query, reviewOnly])

  const filtered = useMemo(() => {
    let result = baseFiltered
    // OR within each group, AND across groups: an item must match at least one
    // selected tag in every active group.
    if (vibeFilter.length > 0) result = result.filter(item =>
      vibeFilter.some(v =>
        item.moods?.includes(v) ||
        (Array.isArray(item.metadata?.unconfirmedVibes) && (item.metadata.unconfirmedVibes as string[]).includes(v))
      )
    )
    if (verdictFilter.length > 0) result = result.filter(item => verdictFilter.some(v => item.moods?.includes(v)))
    if (genreFilter.length > 0) result = result.filter(item => genreFilter.some(g => item.tags?.includes(g)))
    if (seriesFilter.length > 0) result = result.filter(item => seriesFilter.some(s => item.metadata?.series === s))
    return sortItems(result, sort, dir)
  }, [baseFiltered, vibeFilter, verdictFilter, genreFilter, seriesFilter, sort, dir])

  // Vibes and genres present in the current base-filtered set, for filter chips.
  const availableTags = useMemo(() => {
    const vibeSet = new Set<string>()
    const verdictSet = new Set<string>()
    const genreSet = new Set<string>()
    const seriesSet = new Set<string>()
    baseFiltered.forEach(i => {
      i.moods?.forEach(m => {
        if (VIBES.includes(m)) vibeSet.add(m)
        else if (VERDICTS.includes(m)) verdictSet.add(m)
      })
      // unconfirmed vibes also show up in the vibe filter
      if (Array.isArray(i.metadata?.unconfirmedVibes)) {
        (i.metadata.unconfirmedVibes as string[]).forEach(v => { if (VIBES.includes(v)) vibeSet.add(v) })
      }
      i.tags?.forEach(t => genreSet.add(t))
      const s = i.metadata?.series
      if (typeof s === 'string' && s.trim()) seriesSet.add(s)
    })
    return {
      vibes:    VIBES.filter(v => vibeSet.has(v)),        // canonical order, vibes only
      verdicts: VERDICTS.filter(v => verdictSet.has(v)),  // canonical order, verdicts only
      genres:   [...genreSet].filter(isGenreTag).sort(),
      series:   [...seriesSet].sort(),
    }
  }, [baseFiltered])

  // Reset vibe/verdict/genre filters when base filters change so they don't silently hide results.
  // Also scroll back to the top and expand the header — otherwise switching to a
  // short (non-scrollable) result set could leave the header stuck collapsed.
  useEffect(() => {
    setVibeFilter([]); setVerdictFilter([]); setGenreFilter([]); setSeriesFilter([])
    listRef.current?.scrollTo({ top: 0 })
    setCollapsed(false)
  }, [categories, statusFilter, reactionFilter, reviewOnly])

  const grouped = useMemo(() => {
    if (view === 'year')     return groupByDecade(filtered)
    if (group === 'creator') return groupByCreator(filtered)
    if (group === 'none')    return groupNone(filtered)
    return groupByMonth(filtered)
  }, [filtered, group, view])

  // Types sorted by item count descending — library reflects the user's actual collection
  const typeOrder = useMemo(() => {
    const counts = new Map<string, number>()
    items.filter(i => !inReview(i)).forEach(i => {
      counts.set(i.type, (counts.get(i.type) ?? 0) + 1)
    })
    return Array.from(counts.keys()).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
  }, [items])


  const reviewN = useMemo(() => reviewCount(items), [items])
  const hasReview = reviewN > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#fff' }}>
      {/* Header */}
      <header style={{
        padding: '20px 16px 0',
        background: '#fff',
        borderBottom: '1px solid #E8E8E8',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        {/* Title row — folds away on scroll. Holds the view control, search and
            the overflow menu; the category + status rows below stay pinned. */}
        <div style={{
          overflow: 'hidden', transition: 'max-height 0.22s ease, opacity 0.22s ease, margin 0.22s ease',
          maxHeight: collapsed ? 0 : 64, opacity: collapsed ? 0 : 1, marginBottom: collapsed ? 0 : 12,
        }}>
          {/* Magazine header — small kicker + label + rule (shared treatment) */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: '#ABA69C', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 5 }}>{items.length} in the collection</div>
              <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#1C1B19' }}>library</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, paddingBottom: 1 }}>
              <button
                onClick={() => setViewSheetOpen(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#333', padding: 0, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500 }}
              >
                {VIEW_CONFIG[view].label}
                <span style={{ fontSize: 11, color: '#AAA' }}>▾</span>
              </button>
              <HeaderControls
                filtersActive={filtersActive}
                onClear={clearFilters}
                onSearch={() => setSearchOpen(v => !v)}
                onMore={() => setOverflowOpen(true)}
              />
            </div>
          </div>
          <div style={{ borderBottom: '1.5px solid #1C1B19' }} />
        </div>

        {searchOpen && (
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search titles, creators..."
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 34px 8px 12px', border: '1px solid #ddd',
                borderRadius: 4, fontSize: 16, outline: 'none',
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                title="Clear search"
                style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  width: 22, height: 22, borderRadius: '50%', border: 'none', background: '#ECEAE6',
                  color: '#6F6B64', fontSize: 13, lineHeight: 1, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Filter row 1 — category tabs ordered by how much of each type is in the
            library. While collapsed, the search + overflow controls pin to the
            right of this row (the title row that normally holds them is hidden). */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 0, flex: 1, minWidth: 0 }}>
            {typeOrder.map(t => (
              <TabChip
                key={t}
                label={CATEGORY_LABEL[t] ?? TYPE_COLORS[t]?.label ?? (t.charAt(0).toUpperCase() + t.slice(1))}
                active={categories.includes(t) && !reviewOnly}
                onClick={() => selectCategory(t)}
              />
            ))}
            <TabChip label="all" active={categories.length === 0 && !reviewOnly} onClick={() => { setCategories([]); setReviewOnly(false) }} />
            {hasReview && (
              <TabChip label={`for review · ${reviewN}`} active={reviewOnly} onClick={() => { setReviewOnly(v => !v); setCategories([]) }} />
            )}
          </div>
          {collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, paddingLeft: 12, paddingBottom: 8 }}>
              <HeaderControls
                filtersActive={filtersActive}
                onClear={clearFilters}
                onSearch={() => setSearchOpen(v => !v)}
                onMore={() => setOverflowOpen(true)}
              />
            </div>
          )}
        </div>

        {/* Filter row 2 — status + vibe/genre dropdowns (+ reaction chips when on "done") */}
        <div style={{ display: 'flex', gap: 6, paddingBottom: 10, alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none', marginTop: 2 }}>
          {(['all', 'want_to', 'in_progress', 'done'] as StatusFilter[]).map(s => (
            <TabChip
              key={s}
              label={s === 'all' ? 'all' : s === 'want_to' ? 'want to' : s === 'in_progress' ? 'in progress' : 'done'}
              active={statusFilter === s}
              onClick={() => { setStatusFilter(s); if (s !== 'done') setReactionFilter('all') }}
            />
          ))}
          {(availableTags.vibes.length > 0 || availableTags.verdicts.length > 0 || availableTags.genres.length > 0 || (seriesRelevant && availableTags.series.length > 0)) && (
            <>
              <div style={{ width: 1, height: 16, background: '#DDD', flexShrink: 0 }} />
              <button
                onClick={() => setFilterSheetOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  padding: '4px 2px 8px', border: 'none', background: 'none',
                  color: filterCount > 0 ? '#1C1B19' : '#888',
                  fontSize: 13, fontWeight: filterCount > 0 ? 600 : 400,
                  fontStyle: filterCount > 0 ? 'italic' : 'normal',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {filterCount > 0 ? `filter · ${filterCount}` : 'filter'}
                <span style={{ fontSize: 10, lineHeight: 1 }}>▾</span>
              </button>
              {filterSheetOpen && (
                <FilterSheet
                  availableTags={availableTags}
                  seriesRelevant={seriesRelevant}
                  vibeFilter={vibeFilter} onToggleVibe={toggleFilter(setVibeFilter)}
                  verdictFilter={verdictFilter} onToggleVerdict={toggleFilter(setVerdictFilter)}
                  genreFilter={genreFilter} onToggleGenre={toggleFilter(setGenreFilter)}
                  seriesFilter={seriesFilter} onToggleSeries={toggleFilter(setSeriesFilter)}
                  onClearGroups={() => { setVibeFilter([]); setVerdictFilter([]); setGenreFilter([]); setSeriesFilter([]) }}
                  onClose={() => setFilterSheetOpen(false)}
                />
              )}
            </>
          )}
          {statusFilter === 'done' && (
            <>
              <div style={{ width: 1, height: 16, background: '#DDD', flexShrink: 0 }} />
              {REACTION_ORDER.map(r => (
                <TabChip
                  key={r}
                  label={REACTION_LABELS[r]}
                  active={reactionFilter === r}
                  onClick={() => setReactionFilter(reactionFilter === r ? 'all' : r)}
                />
              ))}
            </>
          )}
          {/* New Music Tuesday toggle — only in the Music category */}
          {musicOnly && (
            <>
              <div style={{ width: 1, height: 16, background: '#DDD', flexShrink: 0 }} />
              <TabChip
                label="new music tuesday"
                active={newMusicOnly}
                onClick={() => setNewMusicOnly(v => !v)}
              />
            </>
          )}
          {/* Decide for me — promoted out of the overflow menu; all-media, picks from the backlog. */}
          {items.length > 0 && (
            <>
              <div style={{ width: 1, height: 16, background: '#DDD', flexShrink: 0 }} />
              <button
                onClick={() => navigate('/decide')}
                style={{
                  flexShrink: 0, padding: '4px 2px 8px', border: 'none', background: 'none',
                  color: '#1C1B19', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                decide for me
              </button>
            </>
          )}
        </div>
      </header>

      {/* List */}
      <div ref={listRef} onScroll={onListScroll} style={{ flex: 1, overflowY: 'auto', paddingBottom: selectMode ? 'calc(150px + env(safe-area-inset-bottom))' : 'calc(80px + env(safe-area-inset-bottom))' }}>
        {/* Shows near you — lives in the music view (it's intrinsically music). */}
        {musicOnly && !reviewOnly && (
          <button
            onClick={() => navigate('/shows')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              width: 'calc(100% - 32px)', boxSizing: 'border-box', margin: '12px 16px 0',
              padding: '10px 14px', background: '#1C1B19', border: 'none', borderRadius: 10,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>shows near you</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>browse →</span>
          </button>
        )}
        {dupes > 0 && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '10px 16px 0', padding: '8px 12px', border: '1px solid #ECEAE6', borderRadius: 4 }}>
            <span style={{ fontSize: 12, color: '#6F6B64' }}>{dupes} duplicate{dupes > 1 ? 's' : ''} found</span>
            <button
              onClick={() => setDupesOpen(true)}
              style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 4, border: '1px solid #1C1B19', background: '#1C1B19', color: '#fff', fontSize: 12, cursor: 'pointer' }}
            >
              review
            </button>
          </div>
        )}
        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#999', fontSize: 14 }}>
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasItems={items.length > 0} onGuide={() => navigate('/guide')} />
        ) : (
          Array.from(grouped.entries()).map(([month, monthItems]) => (
            <div key={month || 'all'}>
              {month && (
                <div style={{ padding: '22px 16px 8px', fontSize: 11, fontWeight: 600, color: '#AEAEAE', letterSpacing: '0.9px', textTransform: 'uppercase' }}>
                  {/^\d{4}s$/.test(month) ? <>{month.slice(0, -1)}<span style={{ textTransform: 'lowercase' }}>s</span></> : month}
                </div>
              )}
              {layout === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: 10, padding: '4px 14px 12px' }}>
                  {monthItems.map(item => (
                    <GridCard
                      key={item.id}
                      item={item}
                      square={categories.length !== 1 || categories[0] === 'music'}
                      showType={categories.length !== 1}
                      onTap={() => (selectMode ? toggleSelect(item.id) : (setActionEdit(false), setActionItem(item)))}
                      onSaveArt={handleSaveArt}
                      selectMode={selectMode}
                      selected={selectedIds.has(item.id)}
                    />
                  ))}
                </div>
              ) : (
                monthItems.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    showType={categories.length !== 1}
                    onTap={() => (selectMode ? toggleSelect(item.id) : (setActionEdit(false), setActionItem(item)))}
                    onMarkDone={() => setDoneItem(item)}
                    onMarkWantTo={() => markWantTo(item.id)}
                    onSaveWiki={handleSaveWiki}
                    onSaveArt={handleSaveArt}
                    selectMode={selectMode}
                    selected={selectedIds.has(item.id)}
                  />
                ))
              )}
            </div>
          ))
        )}
      </div>

      {/* Bulk-select action bar — floats above the bottom nav while in select mode */}
      {selectMode && (() => {
        const visibleIds = filtered.map(i => i.id)
        const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id))
        const n = selectedIds.size
        return (
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 'calc(56px + env(safe-area-inset-bottom))', zIndex: 101,
            background: '#fff', borderTop: '1px solid #E8E8E8', boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
            padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: n > 0 ? '#111' : '#999' }}>{n} selected</span>
            <button
              onClick={() => setSelectedIds(allSelected ? new Set() : new Set(visibleIds))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#555', textDecoration: 'underline', textUnderlineOffset: 2, padding: 0 }}
            >
              {allSelected ? 'clear' : 'select all'}
            </button>
            <div style={{ flex: 1 }} />
            {confirmBulkDelete ? (
              <>
                <button onClick={() => setConfirmBulkDelete(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#555', padding: '6px 8px' }}>cancel</button>
                <button
                  onClick={async () => { await deleteMany([...selectedIds]); exitSelect() }}
                  style={{ background: '#C0392B', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '7px 16px' }}
                >
                  delete {n}
                </button>
              </>
            ) : (
              <button
                disabled={n === 0}
                onClick={() => setConfirmBulkDelete(true)}
                style={{ background: 'none', border: `1.5px solid ${n === 0 ? '#EEE' : '#C0392B'}`, color: n === 0 ? '#CCC' : '#C0392B', borderRadius: 4, cursor: n === 0 ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, padding: '6px 16px' }}
              >
                delete
              </button>
            )}
          </div>
        )
      })()}

      {/* Mark as done sheet */}
      {doneItem && (
        <MarkDoneSheet
          item={doneItem}
          onConfirm={(reaction, note, moods) => {
            markDone(doneItem.id, reaction, note, moods)
            setDoneItem(null)
          }}
          onToggleCanon={canon => toggleCanon(doneItem.id, canon)}
          onClose={() => setDoneItem(null)}
        />
      )}

      {/* Item action sheet */}
      {actionItem && (() => {
        // Always read fresh item from state so status/reaction are current
        const fresh = items.find(i => i.id === actionItem.id) ?? actionItem
        return (
          <ItemActionSheet
            key={fresh.id}
            item={fresh}
            initialEdit={actionEdit}
            tidyPosition={tidyQueue ? { index: tidyIndex, total: tidyQueue.length } : undefined}
            onSaveNext={tidyQueue ? () => goToTidy(tidyIndex + 1) : undefined}
            onSkipNext={tidyQueue ? () => goToTidy(tidyIndex + 1) : undefined}
            onDismissNext={tidyQueue ? () => { editItem(fresh.id, { metadata: dismissGaps(fresh, itemGaps(fresh)) }); goToTidy(tidyIndex + 1) } : undefined}
            onEdit={fields => { editItem(fresh.id, fields) }}
            onToggleOwned={owned => toggleOwned(fresh.id, owned)}
            onToggleCanon={canon => toggleCanon(fresh.id, canon)}
            onPatchMetadata={patch => patchMetadata(fresh.id, patch)}
            onPatchTags={tags => editItem(fresh.id, { tags })}
            onMarkInProgress={() => { markInProgress(fresh.id); setActionItem(null) }}
            onMarkWantTo={() => { markWantTo(fresh.id); setActionItem(null) }}
            onMarkDone={async (reaction, note, moods) => {
              try { await markDone(fresh.id, reaction, note, moods); setActionItem(null) }
              catch { setToast("couldn't save — check your connection"); setTimeout(() => setToast(null), 3000) }
            }}
            onEditReaction={async (reaction, note, moods) => {
              // reaction may be null: a note-only save on a not-yet-done item — keep status as-is.
              try { await editItem(fresh.id, { reaction, note: note || null, moods }); setActionItem(null) }
              catch { setToast("couldn't save — check your connection"); setTimeout(() => setToast(null), 3000) }
            }}
            onSetSeasons={seasons => {
              // Persist the season checklist, and keep status honest: a TV show
              // isn't really "done" until every aired season is watched. Demote a
              // done show to in progress when seasons remain; nudge a want-to show
              // to in progress once the first season is ticked.
              const total = seasons.length
              const completed = seasons.filter(s => s.done).length
              const fields: Parameters<typeof editItem>[1] = { metadata: { ...fresh.metadata, seasons } }
              if (total > 0 && completed < total) {
                if (fresh.status === 'done') { fields.status = 'in_progress'; fields.date_done = null }
                else if (fresh.status === 'want_to' && completed > 0) fields.status = 'in_progress'
              }
              editItem(fresh.id, fields)
            }}
            onDelete={() => { deleteItem(fresh.id); inReview(fresh) ? goToReview(reviewIndex + 1) : setActionItem(null) }}
            seriesOptions={seriesOptions}
            onKeep={reaction => {
              if (reaction) markDone(fresh.id, reaction, fresh.note ?? '', fresh.moods ?? [])
              patchMetadata(fresh.id, { review: false })
              goToReview(reviewIndex + 1)
            }}
            onClose={() => { setActionItem(null); setActionEdit(false); setTidyQueue(null); setReviewQueue(null) }}
          />
        )
      })()}

      {/* View sheet */}
      {viewSheetOpen && (
        <ViewSheet
          current={view}
          dir={dir}
          onSelect={selectView}
          onClose={() => setViewSheetOpen(false)}
          layout={layout}
          onLayout={l => setLayout(l)}
          gridCols={gridCols}
          onGridCols={c => { setGridCols(c); setViewSheetOpen(false) }}
        />
      )}

      {/* Duplicates review sheet */}
      {dupesOpen && (
        <DuplicatesSheet
          groups={duplicateGroups()}
          onConfirm={async ids => {
            setDupesOpen(false)
            const n = await deleteMany(ids)
            if (n) {
              setToast(`removed ${n} duplicate${n > 1 ? 's' : ''}`)
              setTimeout(() => setToast(null), 3000)
            }
          }}
          onClose={() => setDupesOpen(false)}
        />
      )}

      {/* Data gaps sheet */}
      {gapsOpen && (
        <GapsSheet
          items={items}
          editItem={(id, fields) => editItem(id, fields)}
          onClose={() => setGapsOpen(false)}
        />
      )}

      {/* Overflow menu — occasional actions moved out of the header */}
      {overflowOpen && (
        <OverflowSheet
          gapCount={gapCount}
          captureCount={captures.length}
          captureFailures={captureFailures}
          selectMode={selectMode}
          onClose={() => setOverflowOpen(false)}
          onGuide={() => { setOverflowOpen(false); navigate('/guide') }}
          onTidy={() => { setOverflowOpen(false); setGapsOpen(true) }}
          onCaptures={() => { setOverflowOpen(false); setCapturesOpen(true) }}
          onSelect={() => { setOverflowOpen(false); selectMode ? exitSelect() : setSelectMode(true) }}
        />
      )}

      {/* Email-capture feed — forwards that added nothing */}
      {capturesOpen && (
        <CapturesSheet
          captures={captures}
          onClear={async () => { if (await clearCaptures()) { setCaptures([]); setCapturesOpen(false) } }}
          onClearOne={async (id) => { if (await clearCapture(id)) setCaptures(prev => prev.filter(c => c.id !== id)) }}
          onClose={() => setCapturesOpen(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#1C1B19', color: '#fff', fontSize: 13, padding: '8px 16px',
          borderRadius: 8, zIndex: 9999, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function FilterSheet({
  availableTags, seriesRelevant,
  vibeFilter, onToggleVibe,
  verdictFilter, onToggleVerdict,
  genreFilter, onToggleGenre,
  seriesFilter, onToggleSeries,
  onClearGroups, onClose,
}: {
  availableTags: { vibes: string[]; verdicts: string[]; genres: string[]; series: string[] }
  seriesRelevant: boolean
  vibeFilter: string[]; onToggleVibe: (v: string) => void
  verdictFilter: string[]; onToggleVerdict: (v: string) => void
  genreFilter: string[]; onToggleGenre: (v: string) => void
  seriesFilter: string[]; onToggleSeries: (v: string) => void
  onClearGroups: () => void
  onClose: () => void
}) {
  const activeCount = vibeFilter.length + verdictFilter.length + genreFilter.length + seriesFilter.length
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '12px 20px 0', zIndex: 201, maxWidth: 480, margin: '0 auto',
        maxHeight: '80dvh', overflowY: 'auto',
      }}>
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>filter</span>
          {activeCount > 0 && (
            <button
              onClick={onClearGroups}
              style={{ fontSize: 12, color: '#ABA69C', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            >clear all</button>
          )}
        </div>
        {availableTags.vibes.length > 0 && (
          <FilterSection label="vibe" options={availableTags.vibes} selected={vibeFilter} onSelect={onToggleVibe} />
        )}
        {availableTags.verdicts.length > 0 && (
          <FilterSection label="verdict" options={availableTags.verdicts} selected={verdictFilter} onSelect={onToggleVerdict} />
        )}
        {availableTags.genres.length > 0 && (
          <FilterSection label="genre" options={availableTags.genres} selected={genreFilter} onSelect={onToggleGenre} />
        )}
        {seriesRelevant && availableTags.series.length > 0 && (
          <FilterSection label="series" options={availableTags.series} selected={seriesFilter} onSelect={onToggleSeries} />
        )}
        {/* Trailing spacer instead of container padding-bottom: mobile WebKit
            omits a scroll container's own padding-bottom from the scrollable
            area, clipping the last row. A real element is always scrollable to.
            Height clears the fixed bottom tab bar (~80px) so the last row isn't
            hidden behind it when the sheet is short (few tags / search active). */}
        <div style={{ height: 'calc(88px + env(safe-area-inset-bottom))' }} />
      </div>
    </>
  )
}

function FilterSection({ label, options, selected, onSelect }: {
  label: string; options: string[]; selected: string[]; onSelect: (v: string) => void
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#ABA69C', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(opt => {
          const on = selected.includes(opt)
          return (
            <button
              key={opt}
              onClick={() => onSelect(opt)}
              style={{
                padding: '5px 12px', borderRadius: 20,
                border: on ? '1.5px solid #1C1B19' : '1.5px solid #ECEAE6',
                background: on ? '#1C1B19' : '#fff',
                color: on ? '#fff' : '#6F6B64',
                fontSize: 12, fontWeight: on ? 600 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >{opt}</button>
          )
        })}
      </div>
    </div>
  )
}

function EmptyState({ hasItems, onGuide }: { hasItems: boolean; onGuide: () => void }) {
  return (
    <div style={{ padding: '64px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#222', marginBottom: 6 }}>
        {hasItems ? 'nothing matches' : 'your library is empty'}
      </div>
      <div style={{ fontSize: 13, color: '#999', lineHeight: 1.5 }}>
        {hasItems ? 'try changing your filters' : 'go listen to some music you loser'}
      </div>
      {!hasItems && (
        <button
          onClick={onGuide}
          style={{
            marginTop: 20, background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: '#ABA69C', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          not sure where to start? how to use
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  )
}

// Tab-style: used for category row + status row. No pill — active is shown by
// ink colour + italics (trying italics instead of the underline).
function TabChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '4px 2px 8px',
        border: 'none',
        background: 'none',
        color: active ? '#111' : '#888',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        fontStyle: active ? 'italic' : 'normal',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function ItemRow({ item, showType, onTap, onMarkDone, onMarkWantTo, onSaveWiki, onSaveArt, selectMode = false, selected = false }: {
  item: Item
  showType: boolean
  onTap: () => void
  onMarkDone: () => void
  onMarkWantTo: () => void
  onSaveWiki?: (id: string, wiki: WikiInfo) => void
  onSaveArt?: (id: string, url: string) => void
  selectMode?: boolean
  selected?: boolean
}) {
  const color = typeColor(item.type)

  // Use cached wiki data from metadata when available — but only skip the fetch
  // when summary is also cached. Without summary the blurb can't render, so we
  // re-fetch to get it (one-time migration for items saved before summary caching).
  const metaWiki: WikiInfo | null = item.metadata?.wikiUrl
    ? { url: item.metadata.wikiUrl as string, thumbnail: (item.metadata.wikiThumb as string) ?? null, summary: (item.metadata.wikiSummary as string) ?? null }
    : null
  const wikiSeed = metaWiki?.summary ? metaWiki : null

  const { url: wikiUrl, thumbnail: wikiThumb, summary: wikiSummary } = useWikipediaInfo(item.type, item.title, item.creator, item.year, wikiSeed)

  // Persist newly-resolved wiki data (including summary) so future loads skip the fetch.
  const wikiSaved = useRef(false)
  useEffect(() => {
    if (wikiUrl && !wikiSeed && !wikiSaved.current) {
      wikiSaved.current = true
      onSaveWiki?.(item.id, { url: wikiUrl, thumbnail: wikiThumb, summary: wikiSummary })
    }
  }, [wikiUrl]) // eslint-disable-line react-hooks/exhaustive-deps
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, item.metadata?.coverUrl as string | null)
  const artSaved = useRef(false)
  useEffect(() => {
    if (artwork && !item.metadata?.coverUrl && !artSaved.current) {
      artSaved.current = true
      onSaveArt?.(item.id, artwork)
    }
  }, [artwork]) // eslint-disable-line react-hooks/exhaustive-deps
  const thumbnail = artwork ?? wikiThumb

  // Season progress for TV shows that have a checklist.
  const tvSeasons = item.type === 'tv' ? getSeasons(item.metadata) : []
  const seasonsLabel = tvSeasons.length > 0 ? `${tvSeasons.filter(s => s.done).length}/${tvSeasons.length} seasons` : null

  // Subtitle is kept lean: type · year · seasons · reaction. Vibe and runtime/pages
  // were removed here — runtime/pages now live in the action card instead.
  const topGenre = (item.tags ?? []).find(isGenreTag) ?? null
  const subtitle = item.status === 'done'
    ? [showType ? item.type : null, item.year, seasonsLabel, topGenre, item.reaction ? REACTION_LABELS[item.reaction] : null].filter(Boolean).join(' · ')
    : [showType ? item.type : null, item.year, seasonsLabel, topGenre].filter(Boolean).join(' · ')

  return (
    <div
      onClick={onTap}
      style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #F4F4F4', padding: '4px 16px', cursor: 'pointer', background: selected ? '#FAFAF8' : 'transparent' }}
    >
      {selectMode && (
        <div style={{
          width: 21, height: 21, borderRadius: '50%', flexShrink: 0, marginRight: 11,
          border: selected ? '1.5px solid #111' : '1.5px solid #CCC',
          background: selected ? '#111' : '#fff', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
        }}>{selected ? '✓' : ''}</div>
      )}
      <Thumb src={thumbnail} type={item.type} color={color} />
      <div style={{ flex: 1, minWidth: 0, alignSelf: 'center' }}>
        <div style={{ fontSize: 14, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.1px' }}>
          <span style={{ fontWeight: 500 }}>{item.title}</span>
          {item.creator && <span style={{ fontWeight: 400, color: '#A0A0A0' }}>{'  ·  '}{item.creator}</span>}
          {!!item.metadata?.canon && <span title="Canon" style={{ fontWeight: 400, color: '#ABA69C', fontSize: 10 }}>{'  '}◆</span>}
          {!!item.metadata?.owned && <span title="Owned" style={{ fontWeight: 400, color: '#999', fontSize: 11 }}>{'  '}⌂</span>}
          {!!item.metadata?.scratch && <span title="Needs identifying" style={{ fontWeight: 500, color: '#BBBBBB', fontSize: 11 }}>{'  '}?</span>}
        </div>
        {(subtitle || item.note) && (
          <div style={{ fontSize: 11, color: '#999', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
            {item.note && <span style={{ fontStyle: 'italic' }}>{subtitle ? ' · ' : ''}noted</span>}
          </div>
        )}
      </div>
      {/* Spotify quick-link — music only */}
      {!selectMode && item.type === 'music' && (
        <button
          onClick={e => {
            e.stopPropagation()
            const url = (item.metadata?.spotifyUrl as string | undefined)
              ?? (item.metadata?.spotifyId ? `https://open.spotify.com/album/${item.metadata.spotifyId}` : null)
              ?? `https://open.spotify.com/search/${encodeURIComponent([item.title, item.creator].filter(Boolean).join(' '))}`
            window.open(url, '_blank', 'noopener,noreferrer')
          }}
          title="Open in Spotify"
          style={{
            flexShrink: 0, marginLeft: 8, width: 28, height: 28, borderRadius: '50%',
            border: '1px solid #E6E6E6', background: '#F6F6F6', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
          }}
        >
          <SpotifyGlyph />
        </button>
      )}
      {/* Wikipedia quick-link — film/tv/book (music uses Spotify instead) */}
      {!selectMode && item.type !== 'music' && wikiUrl && (
        <button
          onClick={e => {
            e.stopPropagation()
            window.open(wikiUrl, '_blank', 'noopener,noreferrer')
          }}
          title="Open Wikipedia page"
          style={{
            flexShrink: 0, marginLeft: 8, width: 28, height: 28, borderRadius: '50%',
            border: '1px solid #E6E6E6', background: '#F6F6F6', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
          }}
        >
          <WikiGlyph />
        </button>
      )}
      {/* Action button */}
      {!selectMode && (
      <button
        onClick={e => { e.stopPropagation(); item.status === 'done' ? onMarkWantTo() : onMarkDone() }}
        title={item.status === 'done' ? 'Move back to want to' : 'Mark as done'}
        style={{
          flexShrink: 0,
          marginLeft: 8,
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: `1.5px solid ${item.status === 'done' ? color.border : '#DDD'}`,
          background: item.status === 'done' ? color.bg : '#fff',
          color: item.status === 'done' ? color.border : '#CCC',
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
        }}
      >
        ✓
      </button>
      )}
    </div>
  )
}


const CATEGORY_LABEL: Record<string, string> = { film: 'films', book: 'books', music: 'music', tv: 'tv', other: 'other' }

// Small cover/poster thumbnail. Falls back to a type-colored tile so rows stay aligned.
function Thumb({ src, type, color }: { src: string | null; type: string; color: { bg: string; border: string } }) {
  const box: React.CSSProperties = { width: 52, height: 52, borderRadius: 0, flexShrink: 0, marginRight: 14, alignSelf: 'center' }
  if (src) {
    return <img src={src} alt="" loading="lazy" style={{ ...box, objectFit: 'cover', border: '1px solid #EEE', background: '#F4F4F4' }} />
  }
  return (
    <div style={{ ...box, background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, letterSpacing: '0.3px', color: color.border }}>
      {type === 'other' ? '' : type}
    </div>
  )
}

// Grid layout cover card. square=true for music (album covers are 1:1).
function GridCard({ item, square, showType, onTap, onSaveArt, selectMode = false, selected = false }: { item: Item; square: boolean; showType: boolean; onTap: () => void; onSaveArt?: (id: string, url: string) => void; selectMode?: boolean; selected?: boolean }) {
  const color = typeColor(item.type)
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, item.metadata?.coverUrl as string | null)
  const artSaved = useRef(false)
  useEffect(() => {
    if (artwork && !item.metadata?.coverUrl && !artSaved.current) {
      artSaved.current = true
      onSaveArt?.(item.id, artwork)
    }
  }, [artwork]) // eslint-disable-line react-hooks/exhaustive-deps
  const aspect = square ? '1 / 1' : '2 / 3'
  // Same subtitle fields as the list row: type · year · seasons · genre · reaction.
  const topGenre = (item.tags ?? []).find(isGenreTag) ?? null
  const tvSeasons = item.type === 'tv' ? getSeasons(item.metadata) : []
  const seasonsLabel = tvSeasons.length > 0 ? `${tvSeasons.filter(s => s.done).length}/${tvSeasons.length} seasons` : null
  const subtitle = [
    showType ? item.type : null, item.year, seasonsLabel, topGenre,
    item.status === 'done' && item.reaction ? REACTION_LABELS[item.reaction] : null,
  ].filter(Boolean).join(' · ')
  const reactionDot = item.status === 'done' && item.reaction === 'loved_it'
    ? '#1A1A1A'
    : item.status === 'done'
    ? '#AAAAAA'
    : null
  return (
    <div onClick={onTap} style={{ cursor: 'pointer', minWidth: 0 }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: aspect, overflow: 'hidden', background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: selected ? '1.5px solid #111' : '1px solid #EBEBEB' }}>
        {artwork
          ? <img src={artwork} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: square && item.type !== 'music' ? 'top' : 'center', opacity: selectMode && !selected ? 0.55 : 1 }} />
          : <div style={{ fontSize: 18, color: color.border, opacity: 0.4 }}>✦</div>}
        {selectMode && (
          <div style={{
            position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: '50%',
            border: selected ? '1.5px solid #111' : '1.5px solid rgba(255,255,255,0.9)',
            background: selected ? '#111' : 'rgba(0,0,0,0.25)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
          }}>{selected ? '✓' : ''}</div>
        )}
        {reactionDot && (
          <div style={{
            position: 'absolute', bottom: 5, right: 5,
            width: 7, height: 7, borderRadius: '50%',
            background: reactionDot, border: '1px solid rgba(255,255,255,0.6)',
          }} />
        )}
      </div>
      <div style={{ marginTop: 5 }}>
        <div style={{ fontSize: 12, color: '#111', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.1px' }}>
          {!!item.metadata?.canon && <span style={{ fontSize: 9, marginRight: 3, color: '#1C1B19' }}>◆</span>}
          {item.title}
        </div>
        {item.creator && (
          <div style={{ fontSize: 10, color: '#AAA', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.creator}</div>
        )}
        {(subtitle || item.note) && (
          <div style={{ fontSize: 10, color: '#B0B0B0', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}{item.note && <span style={{ fontStyle: 'italic' }}>{subtitle ? ' · ' : ''}noted</span>}</div>
        )}
      </div>
    </div>
  )
}

// Compact header control cluster — clear-filters (when active) · search · overflow.
// Rendered in the title row, and again pinned to the category row while collapsed.
function HeaderControls({ filtersActive, onClear, onSearch, onMore }: {
  filtersActive: boolean
  onClear: () => void
  onSearch: () => void
  onMore: () => void
}) {
  return (
    <>
      {filtersActive && (
        <button onClick={onClear} title="Clear all filters" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#999', padding: 0, lineHeight: 1 }}>×</button>
      )}
      <button onClick={onSearch} title="Search" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: 0, display: 'flex', alignItems: 'center' }}>
        <SearchIcon />
      </button>
      <button onClick={onMore} title="More" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: 0, display: 'flex', alignItems: 'center' }}>
        <MoreIcon />
      </button>
    </>
  )
}

// Overflow bottom sheet — holds the occasional actions pulled out of the header.
function OverflowSheet({ gapCount, captureCount, captureFailures, selectMode, onClose, onGuide, onTidy, onCaptures, onSelect }: {
  gapCount: number
  captureCount: number
  captureFailures: number
  selectMode: boolean
  onClose: () => void
  onGuide: () => void
  onTidy: () => void
  onCaptures: () => void
  onSelect: () => void
}) {
  const Row = ({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) => (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', padding: '13px 0', border: 'none', borderBottom: '1px solid #F0F0F0', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ fontSize: 15, color: '#222' }}>{label}</span>
      <span style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{sub}</span>
    </button>
  )
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '12px 20px calc(28px + env(safe-area-inset-bottom))', zIndex: 201, maxWidth: 480, margin: '0 auto',
      }}>
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 12px' }} />
        <Row label="how to use" sub="a quick tour of nospaces" onClick={onGuide} />
        {gapCount > 0 && <Row label={`tidy · ${gapCount}`} sub="fill in missing details" onClick={onTidy} />}
        {captureCount > 0 && <Row label={captureFailures > 0 ? `email captures · ${captureFailures}` : 'email captures'} sub="forwards that didn’t save" onClick={onCaptures} />}
        <Row label={selectMode ? 'cancel select' : 'select items'} sub="multi-select to bulk delete" onClick={onSelect} />
      </div>
    </>
  )
}

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
    </svg>
  )
}

function SpotifyGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#666" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.59 14.42a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.82-.87 7.09-.5 9.72 1.1a.62.62 0 0 1 .21.86zm1.23-2.74a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.56 11.23 1.33.37.22.49.7.26 1.07zm.11-2.85C14.81 8.98 9.5 8.8 6.44 9.73a.94.94 0 1 1-.54-1.8c3.52-1.07 9.38-.86 13.08 1.34a.94.94 0 0 1-.96 1.61z" />
    </svg>
  )
}

function WikiGlyph() {
  return <span style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 400, color: '#888', lineHeight: 1 }}>w</span>
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="22" y2="22" />
    </svg>
  )
}
