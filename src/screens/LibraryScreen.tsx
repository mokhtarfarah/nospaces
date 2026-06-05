import { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Item, ItemStatus, ItemReaction } from '../lib/database.types'
import { typeColor, TYPE_COLORS } from '../lib/colors'
import { useItems } from '../hooks/useItems'
import { MarkDoneSheet } from '../components/MarkDoneSheet'
import { ViewSheet, VIEW_CONFIG, type ViewMode, type SortOption, type SortDir, type ReactionFilter } from '../components/ViewSheet'
import { ItemActionSheet } from '../components/ItemActionSheet'
import { DuplicatesSheet } from '../components/DuplicatesSheet'
import { GapsSheet } from '../components/GapsSheet'
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

function groupByStatus(items: Item[]): Map<string, Item[]> {
  const wantTo     = items.filter(i => i.status === 'want_to')
  const inProgress = items.filter(i => i.status === 'in_progress')
  const done       = items.filter(i => i.status === 'done')
  const map = new Map<string, Item[]>()
  if (wantTo.length > 0)     map.set('Want to', wantTo)
  if (inProgress.length > 0) map.set('In progress', inProgress)
  if (done.length > 0)       map.set('Done', done)
  return map
}

function itemSource(item: Item): string {
  return item.source_detail?.trim() || item.source.replace(/_/g, ' ')
}

export function LibraryScreen() {
  const { items, loading, markDone, markWantTo, markInProgress, deleteItem, editItem, toggleOwned, toggleCanon, patchMetadata, duplicateCount, duplicateGroups, deleteMany } = useItems()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // Anchors for the vibe/genre dropdown menus — the filter row scrolls
  // horizontally (overflow clips absolutely-positioned children), so the menus
  // position themselves `fixed` relative to these.
  const vibeBtnRef = useRef<HTMLDivElement>(null)
  const verdictBtnRef = useRef<HTMLDivElement>(null)
  const genreBtnRef = useRef<HTMLDivElement>(null)
  const seriesBtnRef = useRef<HTMLDivElement>(null)

  const handleSaveWiki = useCallback((id: string, wiki: WikiInfo) => {
    patchMetadata(id, { wikiUrl: wiki.url, wikiThumb: wiki.thumbnail, wikiSummary: wiki.summary })
  }, [patchMetadata])
  const handleSaveArt = useCallback((id: string, url: string) => {
    patchMetadata(id, { coverUrl: url })
  }, [patchMetadata])
  const dupes = duplicateCount()

  // Empty array = all categories. Single-select: tapping a type switches to just that
  // one (tap it again to clear back to All). Array kept so multi-select can return later.
  const [categories, setCategories] = useState<string[]>(() => loadPrefs().categories ?? [])
  const [reviewOnly, setReviewOnly] = useState(false)
  const selectCategory = (t: string) => {
    setReviewOnly(false)
    setVibeFilter(null); setGenreFilter(null); setSeriesFilter(null); setOpenDropdown(null)
    setCategories(prev => (prev.length === 1 && prev[0] === t ? [] : [t]))
  }
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => loadPrefs().statusFilter ?? 'all')
  const [reactionFilter, setReactionFilter] = useState<ReactionFilter>(() => loadPrefs().reactionFilter ?? 'all')
  const [newMusicOnly, setNewMusicOnly] = useState(false)
  const [vibeFilter, setVibeFilter] = useState<string | null>(null)
  const [verdictFilter, setVerdictFilter] = useState<string | null>(null)
  const [genreFilter, setGenreFilter] = useState<string | null>(null)
  const [seriesFilter, setSeriesFilter] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<'vibe' | 'verdict' | 'genre' | 'series' | null>(null)
  const [view, setView] = useState<ViewMode>(() => loadPrefs().view ?? 'recent')
  const [dir, setDir] = useState<SortDir>(() => loadPrefs().dir ?? VIEW_CONFIG.recent.defaultDir)
  const [layout, setLayout] = useState<'list' | 'grid'>(() => loadPrefs().layout ?? 'list')
  // 3 vs 4 columns in grid view — 3 reads well on mobile, 4 is tighter for desktop.
  // Persisted per-device (localStorage), so each device keeps its own preference.
  const [gridCols, setGridCols] = useState<3 | 4>(() => loadPrefs().gridCols ?? 3)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [viewSheetOpen, setViewSheetOpen] = useState(false)
  const [dupesOpen, setDupesOpen] = useState(false)
  const [gapsOpen, setGapsOpen] = useState(false)
  const [canonFilter, setCanonFilter] = useState(false)
  const [doneItem, setDoneItem] = useState<Item | null>(null)
  const [actionItem, setActionItem] = useState<Item | null>(null)
  // When deep-linked from the data-gaps list with &edit=1, open straight into edit.
  const [actionEdit, setActionEdit] = useState(false)
  // Tidy queue: an ordered snapshot of gappy item ids + a cursor, so "save & next"
  // walks through them without bouncing back to the Add page. null = not tidying.
  const [tidyQueue, setTidyQueue] = useState<string[] | null>(null)
  const [tidyIndex, setTidyIndex] = useState(0)
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

  // Advance the tidy queue to the next still-present item (skips deleted ones).
  // When the queue runs out, close the sheet and head back to the Add page.
  const goToTidy = useCallback((from: number) => {
    if (!tidyQueue) { setActionItem(null); setActionEdit(false); return }
    for (let i = from; i < tidyQueue.length; i++) {
      const next = items.find(it => it.id === tidyQueue[i])
      if (next) { setTidyIndex(i); setActionItem(next); setActionEdit(true); return }
    }
    setActionItem(null); setActionEdit(false); setTidyQueue(null)
    navigate('/add')
  }, [tidyQueue, items, navigate])
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
    || !!vibeFilter || !!verdictFilter || !!genreFilter || !!seriesFilter || reviewOnly || newMusicOnly || !!query.trim() || canonFilter
  function clearFilters() {
    setCategories([]); setStatusFilter('all'); setReactionFilter('all')
    setVibeFilter(null); setVerdictFilter(null); setGenreFilter(null); setSeriesFilter(null)
    setReviewOnly(false); setNewMusicOnly(false); setQuery(''); setOpenDropdown(null); setCanonFilter(false)
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
      if (canonFilter && !item.metadata?.canon) return false
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
  }, [items, categories, statusFilter, reactionFilter, newMusicOnly, musicOnly, query, reviewOnly, canonFilter])

  const filtered = useMemo(() => {
    let result = baseFiltered
    if (vibeFilter) result = result.filter(item =>
      item.moods?.includes(vibeFilter) ||
      (Array.isArray(item.metadata?.unconfirmedVibes) && (item.metadata.unconfirmedVibes as string[]).includes(vibeFilter))
    )
    if (verdictFilter) result = result.filter(item => item.moods?.includes(verdictFilter))
    if (genreFilter) result = result.filter(item => item.tags?.includes(genreFilter))
    if (seriesFilter) result = result.filter(item => item.metadata?.series === seriesFilter)
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
  useEffect(() => { setVibeFilter(null); setVerdictFilter(null); setGenreFilter(null); setSeriesFilter(null); setOpenDropdown(null) }, [categories, statusFilter, reactionFilter, reviewOnly])

  const grouped = useMemo(() => {
    if (group === 'creator') return groupByCreator(filtered)
    if (group === 'status')  return groupByStatus(filtered)
    if (group === 'none')    return groupNone(filtered)
    return groupByMonth(filtered)
  }, [filtered, group])

  // Unique types from real data for filter row (excluding in-review items)
  const types = useMemo(() => {
    const seen = new Set<string>()
    items.filter(i => !inReview(i)).forEach(i => seen.add(i.type))
    return Array.from(seen).sort()
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
        <h1 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px', color: '#1C1B19' }}>library</h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              onClick={() => setViewSheetOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#333', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500 }}
            >
              {VIEW_CONFIG[view].label}
              <span style={{ fontSize: 11, color: '#AAA' }}>▾</span>
            </button>
            {VIEW_CONFIG[view].directional && (
              <button
                onClick={() => setDir(d => (d === 'asc' ? 'desc' : 'asc'))}
                title="Reverse order"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#111', padding: '4px 4px', lineHeight: 1 }}
              >
                {dir === 'asc' ? '↑' : '↓'}
              </button>
            )}
            {filtersActive && (
              <button
                onClick={clearFilters}
                title="Clear all filters"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#999', padding: '4px 6px', marginLeft: 2, lineHeight: 1 }}
              >
                ×
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              onClick={() => setLayout(l => (l === 'list' ? 'grid' : 'list'))}
              title={layout === 'list' ? 'Grid view' : 'List view'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 4, display: 'flex', alignItems: 'center' }}
            >
              {layout === 'list' ? <GridIcon /> : <ListIcon />}
            </button>
            {layout === 'grid' && (
              <button
                onClick={() => setGridCols(c => (c === 3 ? 4 : 3))}
                title="Toggle columns"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#888', padding: '4px 2px', lineHeight: 1 }}
              >
                {gridCols}
              </button>
            )}
            <button
              onClick={() => setSearchOpen(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: 4 }}
            >
              <SearchIcon />
            </button>
            <button
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: selectMode ? '#111' : '#888', fontWeight: selectMode ? 600 : 400, padding: '4px 4px' }}
            >
              {selectMode ? 'cancel' : 'select'}
            </button>
          </div>
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

        {/* Filter row 1 — category (tab style: navigation, not selection) */}
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 0 }}>
          <TabChip label="all" active={categories.length === 0 && !reviewOnly} onClick={() => { setCategories([]); setReviewOnly(false) }} />
          {['film', 'book', 'music', 'tv', ...types.filter(t => !['film','book','music','tv'].includes(t))].map(t => (
            <TabChip
              key={t}
              label={CATEGORY_LABEL[t] ?? TYPE_COLORS[t]?.label ?? (t.charAt(0).toUpperCase() + t.slice(1))}
              active={categories.includes(t) && !reviewOnly}
              onClick={() => selectCategory(t)}
            />
          ))}
          {!types.includes('other') && (
            <TabChip label="other" active={categories.includes('other') && !reviewOnly} onClick={() => selectCategory('other')} />
          )}
          {hasReview && (
            <TabChip label={`for review · ${reviewN}`} active={reviewOnly} onClick={() => { setReviewOnly(v => !v); setCategories([]) }} />
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
              {availableTags.vibes.length > 0 && (
                <div ref={vibeBtnRef} style={{ position: 'relative', flexShrink: 0 }}>
                  <DropdownButton
                    label="vibe"
                    value={vibeFilter}
                    active={openDropdown === 'vibe'}
                    onToggle={() => setOpenDropdown(d => d === 'vibe' ? null : 'vibe')}
                    onClear={() => { setVibeFilter(null); setOpenDropdown(null) }}
                  />
                  {openDropdown === 'vibe' && (
                    <DropdownMenu
                      anchorRef={vibeBtnRef}
                      options={availableTags.vibes}
                      selected={vibeFilter}
                      onSelect={v => { setVibeFilter(f => f === v ? null : v); setOpenDropdown(null) }}
                    />
                  )}
                </div>
              )}
              {availableTags.verdicts.length > 0 && (
                <div ref={verdictBtnRef} style={{ position: 'relative', flexShrink: 0 }}>
                  <DropdownButton
                    label="verdict"
                    value={verdictFilter}
                    active={openDropdown === 'verdict'}
                    onToggle={() => setOpenDropdown(d => d === 'verdict' ? null : 'verdict')}
                    onClear={() => { setVerdictFilter(null); setOpenDropdown(null) }}
                  />
                  {openDropdown === 'verdict' && (
                    <DropdownMenu
                      anchorRef={verdictBtnRef}
                      options={availableTags.verdicts}
                      selected={verdictFilter}
                      onSelect={v => { setVerdictFilter(f => f === v ? null : v); setOpenDropdown(null) }}
                    />
                  )}
                </div>
              )}
              {availableTags.genres.length > 0 && (
                <div ref={genreBtnRef} style={{ position: 'relative', flexShrink: 0 }}>
                  <DropdownButton
                    label="genre"
                    value={genreFilter}
                    active={openDropdown === 'genre'}
                    onToggle={() => setOpenDropdown(d => d === 'genre' ? null : 'genre')}
                    onClear={() => { setGenreFilter(null); setOpenDropdown(null) }}
                  />
                  {openDropdown === 'genre' && (
                    <DropdownMenu
                      anchorRef={genreBtnRef}
                      options={availableTags.genres}
                      selected={genreFilter}
                      onSelect={g => { setGenreFilter(f => f === g ? null : g); setOpenDropdown(null) }}
                    />
                  )}
                </div>
              )}
              {seriesRelevant && availableTags.series.length > 0 && (
                <div ref={seriesBtnRef} style={{ position: 'relative', flexShrink: 0 }}>
                  <DropdownButton
                    label="series"
                    value={seriesFilter}
                    active={openDropdown === 'series'}
                    onToggle={() => setOpenDropdown(d => d === 'series' ? null : 'series')}
                    onClear={() => { setSeriesFilter(null); setOpenDropdown(null) }}
                  />
                  {openDropdown === 'series' && (
                    <DropdownMenu
                      anchorRef={seriesBtnRef}
                      options={availableTags.series}
                      selected={seriesFilter}
                      onSelect={s => { setSeriesFilter(f => f === s ? null : s); setOpenDropdown(null) }}
                    />
                  )}
                </div>
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
          {/* New Music Tuesday toggle + shows-near-you link — only in the Music category */}
          {musicOnly && (
            <>
              <div style={{ width: 1, height: 16, background: '#DDD', flexShrink: 0 }} />
              <TabChip
                label="new music tuesday"
                active={newMusicOnly}
                onClick={() => setNewMusicOnly(v => !v)}
              />
              <button
                onClick={() => navigate('/shows')}
                style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 4, border: '1px solid #111', background: '#111', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
              >
                shows near you
              </button>
            </>
          )}
          {/* Canon filter — always available */}
          {items.some(i => i.metadata?.canon) && (
            <>
              <div style={{ width: 1, height: 16, background: '#DDD', flexShrink: 0 }} />
              <TabChip label="◆ canon" active={canonFilter} onClick={() => setCanonFilter(v => !v)} />
            </>
          )}
        </div>
      </header>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: selectMode ? 'calc(150px + env(safe-area-inset-bottom))' : 'calc(80px + env(safe-area-inset-bottom))' }}>
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
        {(() => {
          const gapCount = items.filter(i => itemGaps(i).length > 0).length
          return gapCount > 0 && !loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '8px 16px 0', padding: '8px 12px', border: '1px solid #ECEAE6', borderRadius: 4 }}>
              <span style={{ fontSize: 12, color: '#6F6B64' }}>{gapCount} item{gapCount !== 1 ? 's' : ''} with data gaps</span>
              <button
                onClick={() => setGapsOpen(true)}
                style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 4, border: '1px solid #6F6B64', background: 'none', color: '#6F6B64', fontSize: 12, cursor: 'pointer' }}
              >
                tidy up
              </button>
            </div>
          ) : null
        })()}
        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#999', fontSize: 14 }}>
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasItems={items.length > 0} />
        ) : (
          Array.from(grouped.entries()).map(([month, monthItems]) => (
            <div key={month || 'all'}>
              {month && (
                <div style={{ padding: '22px 16px 8px', fontSize: 11, fontWeight: 600, color: '#AEAEAE', letterSpacing: '0.9px', textTransform: 'uppercase' }}>
                  {month}
                </div>
              )}
              {layout === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: 10, padding: '4px 14px 12px' }}>
                  {monthItems.map(item => (
                    <GridCard
                      key={item.id}
                      item={item}
                      square={musicOnly}
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
            onMarkDone={(reaction, note, moods) => { markDone(fresh.id, reaction, note, moods); setActionItem(null) }}
            onEditReaction={(reaction, note, moods) => { editItem(fresh.id, { reaction, note: note || null, moods }); setActionItem(null) }}
            onSetSeasons={seasons => editItem(fresh.id, { metadata: { ...fresh.metadata, seasons } })}
            onDelete={() => { deleteItem(fresh.id); setActionItem(null) }}
            onKeep={reaction => {
              // Triage out of the review inbox: a reaction logs it as done
              // (preserving any note/moods); no reaction keeps it as want_to.
              if (reaction) markDone(fresh.id, reaction, fresh.note ?? '', fresh.moods ?? [])
              patchMetadata(fresh.id, { review: false })
              setActionItem(null)
            }}
            onClose={() => { setActionItem(null); setActionEdit(false); setTidyQueue(null) }}
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
            if (n) alert(`Removed ${n} duplicate${n > 1 ? 's' : ''}`)
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
    </div>
  )
}

function DropdownButton({ label, value, active, onToggle, onClear }: {
  label: string; value: string | null; active: boolean
  onToggle: () => void; onClear: () => void
}) {
  // Matches TabChip — the whole filter row shares one flat language (no border
  // chips). A selected value or open menu shows as ink + italics.
  const on = !!value || active
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
        padding: '4px 2px 8px', border: 'none', background: 'none',
        color: on ? '#111' : '#888',
        fontSize: 13, fontWeight: value ? 600 : 400,
        fontStyle: on ? 'italic' : 'normal',
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      <span>{value ?? label}</span>
      {value ? (
        <span
          onClickCapture={e => { e.stopPropagation(); onClear() }}
          style={{ fontSize: 11, color: '#666', lineHeight: 1, marginLeft: 1 }}
        >✕</span>
      ) : (
        <span style={{ fontSize: 10, color: '#888', lineHeight: 1 }}>{active ? '▴' : '▾'}</span>
      )}
    </button>
  )
}

function DropdownMenu({ options, selected, onSelect, anchorRef }: {
  options: string[]; selected: string | null; onSelect: (v: string) => void
  anchorRef: React.RefObject<HTMLDivElement>
}) {
  // The filter row scrolls horizontally, which clips absolutely-positioned
  // children. Position the menu `fixed` to the button's on-screen rect instead.
  const [pos, setPos] = useState<{ left?: number; right?: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const el = anchorRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      const menuWidth = 160
      // If left-anchoring would overflow the right edge, right-anchor instead.
      if (r.left + menuWidth > window.innerWidth - 8) {
        setPos({ right: window.innerWidth - r.right, top: r.bottom - 4 })
      } else {
        setPos({ left: r.left, top: r.bottom - 4 })
      }
    }
  }, [anchorRef])
  if (!pos) return null
  return (
    <div style={{
      position: 'fixed', top: pos.top, left: pos.left, right: pos.right,
      background: '#fff', border: '1px solid #E8E8E8',
      borderRadius: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      zIndex: 200, minWidth: 160, maxHeight: 220, overflowY: 'auto',
      padding: '4px 0',
    }}>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '9px 14px', background: selected === opt ? '#F4F4F4' : 'none',
            border: 'none', fontSize: 13, cursor: 'pointer',
            fontWeight: selected === opt ? 600 : 400,
            color: selected === opt ? '#111' : '#444',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function EmptyState({ hasItems }: { hasItems: boolean }) {
  return (
    <div style={{ padding: '64px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#222', marginBottom: 6 }}>
        {hasItems ? 'nothing matches' : 'your library is empty'}
      </div>
      <div style={{ fontSize: 13, color: '#999', lineHeight: 1.5 }}>
        {hasItems ? 'try changing your filters' : 'tap add to save your first item'}
      </div>
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
          {!!item.metadata?.canon && <span title="Canon" style={{ fontWeight: 400, color: '#1C1B19', fontSize: 10 }}>{'  '}◆</span>}
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
            window.open(url, '_blank')
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
            window.open(wikiUrl, '_blank')
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
  const box: React.CSSProperties = { width: 42, height: 42, borderRadius: 0, flexShrink: 0, marginRight: 14, alignSelf: 'center' }
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
          ? <img src={artwork} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: selectMode && !selected ? 0.55 : 1 }} />
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

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
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
