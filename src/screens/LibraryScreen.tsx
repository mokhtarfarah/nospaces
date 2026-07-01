import { useState, useMemo, useEffect, useCallback, useRef, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Item, ItemStatus, ItemReaction } from '../lib/database.types'
import { typeColor, TYPE_COLORS } from '../lib/colors'
import { useItems } from '../hooks/useItems'
import { MarkDoneSheet } from '../components/MarkDoneSheet'
import { VIEW_CONFIG, ORDER, type ViewMode, type SortOption, type SortDir, type ReactionFilter } from '../components/ViewSheet'
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
import { flipMediaToThing } from '../lib/flip'
import { clearStack, clearNav } from '../lib/layout'
import { pullRegions, itemsNeedingRegion } from '../lib/regions'
import { authHeaders } from '../lib/supabase'


// Editorial palette — matches taste / discover / add
const INK = '#1C1B19'
const GRAPHITE = '#6F6B64'
const MUTE = '#ABA69C'
const HAIR = '#ECEAE6'

type StatusFilter = 'all' | ItemStatus

// Persist the main library filters/view across reloads so a refresh doesn't reset
// everything back to "all / recent". Stored in localStorage (per device).
const PREFS_KEY = 'nospaces.libraryPrefs'
// Scroll position is stashed so an iOS PWA reload (e.g. tapping through to
// Spotify and back, or the OS killing the standalone app) returns you to where
// you were instead of the top of the list. Must be localStorage, NOT
// sessionStorage: when iOS terminates and relaunches an installed PWA it starts
// a fresh browsing session, which wipes sessionStorage — so the saved position
// would always read back empty exactly in the case we care about. A freshness
// window keeps us from restoring a stale position on a much-later cold open.
const SCROLL_KEY = 'nospaces.libraryScroll'
const SCROLL_MAX_AGE_MS = 6 * 60 * 60 * 1000 // 6h — long enough for a kill/reopen, short enough to feel intentional
// How much text sits under each grid cover: nothing (a clean wall — coverless
// tiles still show title+creator inside so they stay identifiable), the title
// only, or the full title · creator · details line.
type CardCaption = 'none' | 'title' | 'full'
type LibraryPrefs = {
  categories: string[]; statusFilter: StatusFilter; reactionFilter: ReactionFilter
  view: ViewMode; dir: SortDir; layout: 'list' | 'grid'; gridCols: 3 | 4; caption: CardCaption
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

// A filter tag plus how many items in the current base set carry it. count is
// optional for the odd non-counted option (the music "new music tuesday" toggle).
type TagCount = { value: string; count?: number }

// Soft selectable tag — used for both the sort row and the filter groups. Quiet
// grey fill instead of an outline (calmer than a wall of bordered pills); the
// selected one fills ink. Shared so sort + filters read as one language.
const tagChipStyle = (on: boolean): CSSProperties => ({
  padding: '6px 12px', borderRadius: 8, border: 'none',
  background: on ? '#1C1B19' : '#F1EEE9',
  color: on ? '#fff' : '#5F5E5A',
  fontSize: 12.5, fontWeight: on ? 600 : 400,
  cursor: 'pointer', whiteSpace: 'nowrap',
})

function formatMonthYear(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// The date that drives the "recent" view: when you finished it if done, else when
// you added it. Used by BOTH the sort and the month grouping so they always agree
// — finish a long-ago add today and it surfaces to the top AND files under this
// month's header, instead of staying buried at its add-date. (We avoid updated_at
// here on purpose: that bumps on silent background writes — cover/wiki/region
// backfills — which would reshuffle "recent" for things you never actually touched.)
// Exception: a hand-set date_added (dateAddedManual) is authoritative — it wins
// even for done items, so backdating a shelf book you've marked "read" actually
// sinks it (otherwise its finish-date would keep it at the top).
function recencyDate(item: Item): string {
  if (item.metadata?.dateAddedManual) return item.date_added
  return item.status === 'done' && item.date_done ? item.date_done : item.date_added
}

// Comparison in the *ascending* sense for each sort. Direction is applied on top
// by sortItems, so 'asc'/'desc' is consistent across every view.
function compareItems(a: Item, b: Item, sort: SortOption): number {
  switch (sort) {
    case 'date_added':
      return new Date(recencyDate(a)).getTime() - new Date(recencyDate(b)).getTime()
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
    // Year-precision backdates (month unknown) file under just the year, so the
    // header reads "2019" rather than a guessed month.
    const key = item.metadata?.dateAddedPrecision === 'year'
      ? String(new Date(recencyDate(item)).getFullYear())
      : formatMonthYear(recencyDate(item))
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
  const { items: allItems, loading, markDone, markWantTo, markInProgress, deleteItem, editItem, toggleOwned, toggleCanon, patchMetadata, duplicateCount, duplicateGroups, deleteMany } = useItems()
  // Things live in their own domain (the board), never in the media library — so
  // they don't leak in as broken cover-art cards or spawn a stray "Thing" tab.
  const items = useMemo(() => allItems.filter(i => i.type !== 'thing'), [allItems])
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
    setVibeFilter([]); setGenreFilter([]); setSeriesFilter([]); setCountryFilter([]); setFilterSheetOpen(false)
    setCategories(prev => (prev.length === 1 && prev[0] === t ? [] : [t]))
  }
  // "all" is the one cross-category view — so it opens on recency (what's alive
  // lately across every medium), not by-year. Only nudge the sort when *arriving*
  // at "all"; a deliberate re-sort while already there is left alone.
  const selectAll = () => {
    setReviewOnly(false)
    setVibeFilter([]); setGenreFilter([]); setVerdictFilter([]); setSeriesFilter([]); setCountryFilter([])
    if (categories.length > 0) { setView('recent'); setDir(VIEW_CONFIG.recent.defaultDir) }
    setCategories([])
  }
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => loadPrefs().statusFilter ?? 'all')
  const [reactionFilter, setReactionFilter] = useState<ReactionFilter>(() => loadPrefs().reactionFilter ?? 'all')
  const [newMusicOnly, setNewMusicOnly] = useState(false)
  // "on my shelf" — narrow to items flagged owned (metadata.owned). Useful when
  // you're out shopping and want to check you don't already have this DVD/record/book.
  const [ownedOnly, setOwnedOnly] = useState(false)
  // Filter-sheet selections are multi-select: OR within a group, AND across
  // groups (faceted filtering). Empty array = that group isn't narrowing.
  const [vibeFilter, setVibeFilter] = useState<string[]>([])
  const [verdictFilter, setVerdictFilter] = useState<string[]>([])
  const [genreFilter, setGenreFilter] = useState<string[]>([])
  const [seriesFilter, setSeriesFilter] = useState<string[]>([])
  const [countryFilter, setCountryFilter] = useState<string[]>([])
  const toggleFilter = (set: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    set(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]))
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  // Guard against a view persisted before some options were removed — fall back
  // to 'year' so an old localStorage value can't index into a missing config.
  const [view, setView] = useState<ViewMode>(() => {
    const p = loadPrefs()
    if (p.view && p.view in VIEW_CONFIG) return p.view
    // No saved view: "all" opens on recency, a single medium on by-year.
    return (p.categories?.length ?? 0) === 0 ? 'recent' : 'year'
  })
  const [dir, setDir] = useState<SortDir>(() => loadPrefs().dir ?? VIEW_CONFIG.year.defaultDir)
  const [layout, setLayout] = useState<'list' | 'grid'>(() => loadPrefs().layout ?? 'grid')
  // 3 vs 4 columns in grid view — 3 reads well on mobile, 4 is tighter for desktop.
  // Persisted per-device (localStorage), so each device keeps its own preference.
  const [gridCols, setGridCols] = useState<3 | 4>(() => loadPrefs().gridCols ?? 3)
  // Grid caption density — defaults to 'full' so nothing changes for an existing
  // library; toggle to 'title' or 'none' for a cleaner cover wall.
  const [caption, setCaption] = useState<CardCaption>(() => loadPrefs().caption ?? 'full')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [dupesOpen, setDupesOpen] = useState(false)
  const [gapsOpen, setGapsOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [regionBusy, setRegionBusy] = useState(false)
  // Email-capture feed: forwards that added nothing (failed/no-op) so they don't
  // vanish silently. Fetched once on mount; surfaced in the overflow menu only
  // when there's something to show.
  const [captures, setCaptures] = useState<EmailCapture[]>([])
  const [capturesOpen, setCapturesOpen] = useState(false)
  // One shared "didn't land" inbox: both Library and the board show every failed
  // forward (not a per-domain slice). A bounced link often has no knowable domain
  // — when a shop 403s us we can't tell a handbag from a documentary — so there's
  // one tray, reached from either side, rather than a guess-which-tab split.
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
      try { localStorage.setItem(SCROLL_KEY, JSON.stringify({ top: lastScrollRef.current, t: Date.now() })) } catch { /* ignore quota/private-mode */ }
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
    try {
      const raw = localStorage.getItem(SCROLL_KEY)
      if (raw) {
        const { top, t } = JSON.parse(raw)
        if (Date.now() - t <= SCROLL_MAX_AGE_MS) saved = Number(top) || 0
      }
    } catch { /* ignore parse/quota/private-mode */ }
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
    const prefs: LibraryPrefs = { categories, statusFilter, reactionFilter, view, dir, layout, gridCols, caption }
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* ignore quota/private-mode */ }
  }, [categories, statusFilter, reactionFilter, view, dir, layout, gridCols, caption])

  // "New Music Tuesday" toggle only applies while viewing the Music category alone.
  const musicOnly = categories.length === 1 && categories[0] === 'music'
  // Clear-all-filters — only offered when something is actually narrowing the list.
  const filtersActive = categories.length > 0 || statusFilter !== 'all' || reactionFilter !== 'all'
    || vibeFilter.length > 0 || verdictFilter.length > 0 || genreFilter.length > 0 || seriesFilter.length > 0
    || reviewOnly || newMusicOnly || ownedOnly || !!query.trim()
  // Badge counts every selected chip across groups, so "filter · 3" reflects how
  // many tags are narrowing the list (not just how many groups are touched).
  const filterCount = vibeFilter.length + verdictFilter.length + genreFilter.length + seriesFilter.length + countryFilter.length
    + (newMusicOnly && musicOnly ? 1 : 0) + (ownedOnly ? 1 : 0)
  function clearFilters() {
    setCategories([]); setStatusFilter('all'); setReactionFilter('all')
    setVibeFilter([]); setVerdictFilter([]); setGenreFilter([]); setSeriesFilter([]); setCountryFilter([])
    setReviewOnly(false); setNewMusicOnly(false); setOwnedOnly(false); setQuery('')
    // Note: deliberately does NOT close the filter card — clearing leaves you in
    // the card to re-filter, not bounced back to the list.
  }

  // Region backfill — one-shot Wikidata pull (free) for media items not yet
  // attempted. Updates rows in place via patchMetadata; progress shown as a toast.
  const regionPending = useMemo(() => itemsNeedingRegion(items).length, [items])
  async function handlePullRegions() {
    if (regionBusy) return
    setRegionBusy(true)
    setOverflowOpen(false)
    setToast('pulling regions…')
    try {
      const headers = await authHeaders()
      const result = await pullRegions(items, headers, patchMetadata, p => setToast(`pulling regions… ${p.done}/${p.total}`))
      const msg = result.filled > 0 ? `region added to ${result.filled} item${result.filled === 1 ? '' : 's'}` : 'no regions found'
      // Surface failures so a partial run is visible — they stay untagged and a
      // re-run retries them (e.g. Wikipedia throttled some at this scale).
      setToast(result.failed > 0 ? `${msg} · ${result.failed} failed, run again` : msg)
    } catch {
      setToast("couldn't pull regions — check your connection")
    } finally {
      setRegionBusy(false)
      setTimeout(() => setToast(null), 4000)
    }
  }

  const sort: SortOption = VIEW_CONFIG[view].sort
  const group = VIEW_CONFIG[view].group

  // Tapping a new view switches to it (in its default order); tapping the active
  // directional view reverses the order. The combined card stays open either way
  // (you may be adjusting sort + filters together).
  const selectView = (v: ViewMode) => {
    if (v === view) {
      if (VIEW_CONFIG[v].directional) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setView(v)
      setDir(VIEW_CONFIG[v].defaultDir)
    }
  }

  // Series only makes sense inside a single medium that actually has series
  // (film / book / tv) — never on "all" or music.
  const seriesRelevant = categories.length === 1 && ['film', 'book', 'tv'].includes(categories[0])

  // Kicker census — counts the medium you're actually looking at. "all" → the
  // whole collection; a single type → just that type ("12 films", "30 books").
  const kicker = useMemo(() => {
    if (categories.length === 1) {
      const type = categories[0]
      const n = items.filter(i => i.type === type).length
      return `${n} ${CATEGORY_LABEL[type] ?? type}`
    }
    return `${items.length} in the collection`
  }, [items, categories])

  // Base filter: everything except the tag/vibe filter. Used to compute which
  // vibe/genre chips should be shown so they don't vanish when one is selected.
  const baseFiltered = useMemo(() => {
    return items.filter(item => {
      if (reviewOnly) return inReview(item)
      if (inReview(item)) return false
      // Search is a "find this specific thing" intent, so an active query spans
      // the whole library — the category tab is ignored while searching (type is
      // labelled on every row, so cross-category hits aren't confusing). Status
      // and the other filters still apply.
      if (!query && categories.length > 0 && !categories.includes(item.type)) return false
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
    if (countryFilter.length > 0) result = result.filter(item =>
      Array.isArray(item.metadata?.countries) &&
      countryFilter.some(c => (item.metadata.countries as string[]).includes(c))
    )
    if (ownedOnly) result = result.filter(item => item.metadata?.owned)
    return sortItems(result, sort, dir)
  }, [baseFiltered, vibeFilter, verdictFilter, genreFilter, seriesFilter, countryFilter, ownedOnly, sort, dir])

  // Whether the current base set has anything owned — the shelf filter is only
  // worth offering when there's something on the shelf to narrow to. Computed off
  // baseFiltered (which excludes the owned narrowing) so it stays stable as the
  // toggle flips.
  const hasOwned = useMemo(() => baseFiltered.some(i => i.metadata?.owned), [baseFiltered])

  // Tags present in the current base-filtered set, each with how many items carry
  // it — ranked biggest-first so the filter lists lead with what's worth tapping
  // (and the long tail tucks behind "show all"). Counts reflect the base set
  // (category/status/search context), not the tag narrowing, so they stay stable
  // as you toggle tags.
  const availableTags = useMemo(() => {
    const vibe = new Map<string, number>()
    const verdict = new Map<string, number>()
    const genre = new Map<string, number>()
    const series = new Map<string, number>()
    const country = new Map<string, number>()
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)
    baseFiltered.forEach(i => {
      const vibesSeen = new Set<string>()
      i.moods?.forEach(m => {
        if (VIBES.includes(m)) { bump(vibe, m); vibesSeen.add(m) }
        else if (VERDICTS.includes(m)) bump(verdict, m)
      })
      // unconfirmed vibes also count toward the vibe filter — but don't double-count
      // a vibe already confirmed in moods.
      if (Array.isArray(i.metadata?.unconfirmedVibes)) {
        (i.metadata.unconfirmedVibes as string[]).forEach(v => { if (VIBES.includes(v) && !vibesSeen.has(v)) bump(vibe, v) })
      }
      i.tags?.forEach(t => { if (isGenreTag(t)) bump(genre, t) })
      const s = i.metadata?.series
      if (typeof s === 'string' && s.trim()) bump(series, s)
      if (Array.isArray(i.metadata?.countries)) {
        (i.metadata.countries as string[]).forEach(c => { if (c.trim()) bump(country, c) })
      }
    })
    const ranked = (m: Map<string, number>): TagCount[] =>
      [...m.entries()].map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    // On "all" the per-medium facets (genre/vibe/verdict/series) pool film-genres,
    // music-genres and book-vibes into one bloated, half-irrelevant list — tag
    // filtering is a per-medium activity. Hide them on "all" by returning empty
    // lists (the FilterSheet's `.length > 0` guards do the hiding, and the prune
    // effect drops any selection that's no longer offered). Region stays — it's the
    // one facet that reads the same across every medium. (Decided s85.)
    const catAll = categories.length === 0
    return {
      vibes: catAll ? [] : ranked(vibe),
      verdicts: catAll ? [] : ranked(verdict),
      genres: catAll ? [] : ranked(genre),
      series: catAll ? [] : ranked(series),
      countries: ranked(country),
    }
  }, [baseFiltered, categories])

  // When base filters change, keep the vibe/verdict/genre/series selections that
  // still apply and drop only the ones that don't exist in the new set ("smart
  // persist"). This matches how sticky filters behave in most apps — browse the
  // same vibe across want-to→done without re-tapping — while never leaving a
  // selection active that would silently hide everything (e.g. a vibe with no
  // matches after switching category). The FilterSheet only ever offers tags
  // present in the current set, so pruning keeps the active filters consistent
  // with what's offered. availableTags reflects the NEW base set by the time
  // this post-render effect runs, so it's safe to prune against it here.
  // Also scroll back to the top and expand the header — otherwise switching to a
  // short (non-scrollable) result set could leave the header stuck collapsed.
  useEffect(() => {
    const has = (list: TagCount[], v: string) => list.some(t => t.value === v)
    setVibeFilter(prev => prev.filter(v => has(availableTags.vibes, v)))
    setVerdictFilter(prev => prev.filter(v => has(availableTags.verdicts, v)))
    setGenreFilter(prev => prev.filter(v => has(availableTags.genres, v)))
    setSeriesFilter(prev => prev.filter(v => has(availableTags.series, v)))
    setCountryFilter(prev => prev.filter(v => has(availableTags.countries, v)))
    if (!hasOwned) setOwnedOnly(false)
    listRef.current?.scrollTo({ top: 0 })
    setCollapsed(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prune only on base-control change, not on every availableFilters recompute
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
          maxHeight: collapsed ? 0 : 110, opacity: collapsed ? 0 : 1, marginBottom: collapsed ? 0 : 12,
        }}>
          {/* Magazine header — title + search/overflow on top, then count + sort
              folded into one quiet subline (s84 collapse). The standalone uppercase
              kicker and the in-title sort button are gone: the title row now holds
              only the title and the two icons, so the top reads calmer. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#1C1B19' }}>library</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
              <HeaderControls
                onSearch={() => setSearchOpen(v => !v)}
                onMore={() => setOverflowOpen(true)}
              />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, color: '#ABA69C' }}>{kicker}</span>
          </div>
          <div style={{ borderBottom: '1.5px solid #1C1B19' }} />
        </div>

        {searchOpen && (
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="search titles, creators…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 34px 8px 12px', border: `1.5px solid ${HAIR}`,
                borderRadius: 8, fontSize: 16, outline: 'none', color: INK,
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

        {/* Nav row — category tabs + a status dropdown on the left, the view·sort·
            filter button (and, while collapsed, the search/overflow controls)
            pinned to the right. Was two rows before s85; merged into one so the
            header reads tighter. Status (and its done→reaction sub-filter) folds
            into the dropdown instead of taking a whole row of chips. */}
        <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 10 }}>
          {/* category tabs — scroll horizontally when they overflow */}
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', scrollbarWidth: 'none', flex: '0 1 auto', minWidth: 0 }}>
            {typeOrder.map(t => (
              <TabChip
                key={t}
                label={CATEGORY_LABEL[t] ?? TYPE_COLORS[t]?.label ?? (t.charAt(0).toUpperCase() + t.slice(1))}
                // An active search spans all categories (see baseFiltered), so the
                // tab row reflects "all" while searching — without mutating the
                // stored category, so clearing the search snaps back to this tab.
                active={categories.includes(t) && !reviewOnly && !query.trim()}
                onClick={() => selectCategory(t)}
              />
            ))}
            <TabChip label="all" active={(categories.length === 0 || !!query.trim()) && !reviewOnly} onClick={selectAll} />
            {hasReview && (
              <TabChip label={`for review · ${reviewN}`} active={reviewOnly} onClick={() => { setReviewOnly(v => !v); setCategories([]) }} />
            )}
          </div>
          {/* divider + status dropdown */}
          <div style={{ width: 1, height: 16, background: '#DDD', flexShrink: 0, margin: '0 12px' }} />
          <StatusDropdown
            statusFilter={statusFilter}
            reactionFilter={reactionFilter}
            onStatus={s => { setStatusFilter(s); if (s !== 'done') setReactionFilter('all') }}
            onReaction={setReactionFilter}
          />
          {/* spacer pushes the right-hand controls to the edge */}
          <div style={{ flex: '1 1 0' }} />
          {/* View · sort · filter live in one card opened from this button,
              mirroring the Things board. Always present (it always offers layout +
              sort), even before there are tag groups to filter on. */}
          <button
            onClick={() => setFilterSheetOpen(true)}
            aria-label={filterCount > 0 ? `view, sort, filter · ${filterCount} filters active` : 'view, sort and filter'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              padding: '4px 2px 8px', border: 'none', background: 'none',
              color: filterCount > 0 ? '#1C1B19' : '#888', cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="8" x2="20" y2="8" /><circle cx="9" cy="8" r="2.3" fill="#fff" />
              <line x1="4" y1="16" x2="20" y2="16" /><circle cx="15" cy="16" r="2.3" fill="#fff" />
            </svg>
            {filterCount > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, fontStyle: 'italic', lineHeight: 1, color: '#1C1B19',
              }}>{filterCount}</span>
            )}
          </button>
          {/* While scrolled, the line stays pure — just categories · status ·
              filter. Search + overflow live in the title row above; a small flick
              up un-collapses it to reach them (and clear now lives in the card). */}
        </div>
      </header>

      {/* List */}
      <div ref={listRef} onScroll={onListScroll} style={{ flex: 1, overflowY: 'auto', paddingBottom: selectMode ? clearStack(94) : clearStack(24) }}>
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
          <div style={{ padding: '48px 24px', textAlign: 'center', color: MUTE, fontSize: 14 }}>
            loading…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasItems={items.length > 0} onGuide={() => navigate('/guide')} />
        ) : (
          Array.from(grouped.entries()).map(([month, monthItems]) => (
            <div key={month || 'all'}>
              {month && (
                <div style={{ padding: '22px 16px 8px', fontSize: 11, fontWeight: 600, color: MUTE, letterSpacing: '0.9px', textTransform: 'uppercase' }}>
                  {/^\d{4}s$/.test(month) ? <>{month.slice(0, -1)}<span style={{ textTransform: 'lowercase' }}>s</span></> : month}
                </div>
              )}
              {layout === 'grid' ? (
                // Cover-wall: in 'none' caption mode the tiles tighten almost to a
                // grid of touching covers (more editorial); with captions the looser
                // 10px gap gives the text room to breathe.
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: caption === 'none' ? 4 : 10, padding: caption === 'none' ? '4px 12px 12px' : '4px 14px 12px' }}>
                  {monthItems.map(item => (
                    <GridCard
                      key={item.id}
                      item={item}
                      square={categories.length !== 1 || categories[0] === 'music'}
                      showType={categories.length !== 1}
                      caption={caption}
                      onTap={() => (selectMode ? toggleSelect(item.id) : (setActionEdit(false), setActionItem(item)))}
                      onSaveArt={handleSaveArt}
                      onSaveWiki={handleSaveWiki}
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
            position: 'fixed', left: 0, right: 0, bottom: clearNav(), zIndex: 101,
            background: '#fff', borderTop: '1px solid #E8E8E8', boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
            padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: n > 0 ? '#111' : MUTE }}>{n} selected</span>
            <button
              onClick={() => setSelectedIds(allSelected ? new Set() : new Set(visibleIds))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: GRAPHITE, textDecoration: 'underline', textUnderlineOffset: 2, padding: 0 }}
            >
              {allSelected ? 'clear' : 'select all'}
            </button>
            <div style={{ flex: 1 }} />
            {confirmBulkDelete ? (
              <>
                <button onClick={() => setConfirmBulkDelete(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: GRAPHITE, padding: '6px 8px' }}>cancel</button>
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
                style={{ background: 'none', border: `1.5px solid ${n === 0 ? HAIR : '#C0392B'}`, color: n === 0 ? MUTE : '#C0392B', borderRadius: 4, cursor: n === 0 ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, padding: '6px 16px' }}
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
            onFlipToThing={async () => {
              // Misroute fix: move this media item to the Things board as a product.
              await editItem(fresh.id, flipMediaToThing(fresh))
              inReview(fresh) ? goToReview(reviewIndex + 1) : setActionItem(null)
            }}
            countWithTag={(group, value) => items.filter(i => i.type === fresh.type && (
              group === 'genre' ? (i.tags ?? []).includes(value)
              : group === 'verdict' ? (i.moods ?? []).includes(value)
              : (i.moods ?? []).includes(value) || ((i.metadata?.unconfirmedVibes as string[] | undefined)?.includes(value) ?? false)
            )).length}
            onFilterTag={(group, value) => {
              // Narrow to this item's medium first — the genre/vibe/verdict facets are
              // per-medium (hidden on "all"), so the tag only bites once a category is set.
              setCategories([fresh.type])
              setGenreFilter(group === 'genre' ? [value] : [])
              setVibeFilter(group === 'vibe' ? [value] : [])
              setVerdictFilter(group === 'verdict' ? [value] : [])
              setSeriesFilter([]); setCountryFilter([])
              setActionItem(null); setActionEdit(false)
            }}
            onClose={() => { setActionItem(null); setActionEdit(false); setTidyQueue(null); setReviewQueue(null) }}
          />
        )
      })()}

      {/* View sheet */}
      {filterSheetOpen && (
        <FilterSheet
          availableTags={availableTags}
          seriesRelevant={seriesRelevant}
          vibeFilter={vibeFilter} onToggleVibe={toggleFilter(setVibeFilter)}
          verdictFilter={verdictFilter} onToggleVerdict={toggleFilter(setVerdictFilter)}
          genreFilter={genreFilter} onToggleGenre={toggleFilter(setGenreFilter)}
          seriesFilter={seriesFilter} onToggleSeries={toggleFilter(setSeriesFilter)}
          countryFilter={countryFilter} onToggleCountry={toggleFilter(setCountryFilter)}
          showNewMusic={musicOnly} newMusicOnly={newMusicOnly} onToggleNewMusic={() => setNewMusicOnly(v => !v)}
          showShelf={hasOwned} ownedOnly={ownedOnly} onToggleOwned={() => setOwnedOnly(v => !v)}
          view={view} dir={dir} onSelectView={selectView}
          layout={layout} onLayout={l => setLayout(l)}
          gridCols={gridCols} onGridCols={c => setGridCols(c)}
          caption={caption} onCaption={setCaption}
          filtersActive={filtersActive} onClearAll={clearFilters} matchCount={filtered.length}
          onClose={() => setFilterSheetOpen(false)}
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
          hasItems={items.length > 0}
          gapCount={gapCount}
          captureCount={captures.length}
          captureFailures={captureFailures}
          regionPending={regionPending}
          regionBusy={regionBusy}
          selectMode={selectMode}
          onClose={() => setOverflowOpen(false)}
          onDecide={() => { setOverflowOpen(false); navigate('/decide') }}
          onGuide={() => { setOverflowOpen(false); navigate('/guide') }}
          onTidy={() => { setOverflowOpen(false); setGapsOpen(true) }}
          onCaptures={() => { setOverflowOpen(false); setCapturesOpen(true) }}
          onPullRegions={handlePullRegions}
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

// One card for the three "how is this list shown" controls — layout, sort, and
// the tag filters — opened from the slider button next to the categories. Mirrors
// the Things board's single view sheet (was three separate triggers before s84).
function FilterSheet({
  availableTags, seriesRelevant,
  vibeFilter, onToggleVibe,
  verdictFilter, onToggleVerdict,
  genreFilter, onToggleGenre,
  seriesFilter, onToggleSeries,
  countryFilter, onToggleCountry,
  showNewMusic, newMusicOnly, onToggleNewMusic,
  showShelf, ownedOnly, onToggleOwned,
  view, dir, onSelectView,
  layout, onLayout, gridCols, onGridCols, caption, onCaption,
  filtersActive, onClearAll, matchCount, onClose,
}: {
  availableTags: { vibes: TagCount[]; verdicts: TagCount[]; genres: TagCount[]; series: TagCount[]; countries: TagCount[] }
  seriesRelevant: boolean
  vibeFilter: string[]; onToggleVibe: (v: string) => void
  verdictFilter: string[]; onToggleVerdict: (v: string) => void
  genreFilter: string[]; onToggleGenre: (v: string) => void
  seriesFilter: string[]; onToggleSeries: (v: string) => void
  countryFilter: string[]; onToggleCountry: (v: string) => void
  showNewMusic: boolean; newMusicOnly: boolean; onToggleNewMusic: () => void
  showShelf: boolean; ownedOnly: boolean; onToggleOwned: () => void
  view: ViewMode; dir: SortDir; onSelectView: (v: ViewMode) => void
  layout: 'list' | 'grid'; onLayout: (l: 'list' | 'grid') => void
  gridCols: 3 | 4; onGridCols: (c: 3 | 4) => void
  caption: CardCaption; onCaption: (c: CardCaption) => void
  filtersActive: boolean
  onClearAll: () => void
  matchCount: number
  onClose: () => void
}) {
  // Everything selected across all axes, flattened into one removable list — the
  // "active filters" tray. Selected tags live here, not duplicated in their group.
  const activeFilters: { value: string; remove: () => void }[] = [
    ...genreFilter.map(v => ({ value: v, remove: () => onToggleGenre(v) })),
    ...vibeFilter.map(v => ({ value: v, remove: () => onToggleVibe(v) })),
    ...verdictFilter.map(v => ({ value: v, remove: () => onToggleVerdict(v) })),
    ...seriesFilter.map(v => ({ value: v, remove: () => onToggleSeries(v) })),
    ...countryFilter.map(v => ({ value: v, remove: () => onToggleCountry(v) })),
    ...(showNewMusic && newMusicOnly ? [{ value: 'new music tuesday', remove: onToggleNewMusic }] : []),
    ...(showShelf && ownedOnly ? [{ value: 'on my shelf', remove: onToggleOwned }] : []),
  ]
  const hasGroups = showNewMusic || showShelf || availableTags.vibes.length > 0 || availableTags.verdicts.length > 0
    || availableTags.genres.length > 0 || (seriesRelevant && availableTags.series.length > 0) || availableTags.countries.length > 0
  const sectionLabel: CSSProperties = { fontSize: 12, fontWeight: 700, color: '#6F6B64', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px', paddingTop: 13, borderTop: '1px solid #F0F0F0' }
  // Soft segmented control: a quiet track with the selected segment lifted as a
  // white chip — gentler than the old hard black/white toggle.
  const segGroup: CSSProperties = { display: 'flex', gap: 3, background: '#F4F2EE', padding: 3, borderRadius: 9 }
  const segBtn = (on: boolean): CSSProperties => ({ padding: '5px 13px', borderRadius: 7, border: '1px solid ' + (on ? '#E2DED7' : 'transparent'), background: on ? '#fff' : 'transparent', color: on ? '#1C1B19' : '#999', fontSize: 13, fontWeight: on ? 600 : 400, cursor: 'pointer' })
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '12px 20px 0', zIndex: 201, maxWidth: 480, margin: '0 auto',
        maxHeight: '85dvh', overflowY: 'auto',
      }}>
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 12px' }} />

        {/* Layout — the most-toggled control, first. List + the two grid densities
            fold into one row (was layout + a separate "columns" row before s85). */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontSize: 14, color: '#3A3A3A' }}>layout</span>
          <div style={segGroup}>
            <button onClick={() => onLayout('list')} style={segBtn(layout === 'list')}>list</button>
            <button onClick={() => { onLayout('grid'); onGridCols(3) }} style={segBtn(layout === 'grid' && gridCols === 3)}>grid 3</button>
            <button onClick={() => { onLayout('grid'); onGridCols(4) }} style={segBtn(layout === 'grid' && gridCols === 4)}>grid 4</button>
          </div>
        </div>
        {layout === 'grid' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontSize: 14, color: '#3A3A3A' }}>captions</span>
            <div style={segGroup}>
              {(['none', 'title', 'full'] as const).map(c => (
                <button key={c} onClick={() => onCaption(c)} style={segBtn(caption === c)}>{c}</button>
              ))}
            </div>
          </div>
        )}

        {/* Sort — a label-left row matching the layout/captions controls, options
            right-aligned to the same edge. Kept as chips (not a segmented box): four
            longish options + a direction toggle don't fit a one-line box. Active
            fills ink; directional ones show ↑/↓ and reverse on re-tap. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 7 }}>
          <span style={{ fontSize: 14, color: '#3A3A3A', flexShrink: 0 }}>sort</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
            {ORDER.map(v => {
              const cfg = VIEW_CONFIG[v]
              const active = view === v
              const arrow = active && cfg.directional ? (dir === 'asc' ? ' ↑' : ' ↓') : ''
              return (
                <button key={v} onClick={() => onSelectView(v)} style={tagChipStyle(active)}>{cfg.label}{arrow}</button>
              )
            })}
          </div>
        </div>
        {/* Filter — the tag groups. The heading carries a live result count and a
            plain-text clear-all on the right; the row below is the "active filters"
            tray (everything selected across axes, each removable). */}
        {(hasGroups || filtersActive) && (
          <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>filter</span>
            {filtersActive && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, textTransform: 'none', letterSpacing: 'normal' }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: '#A8A39A' }}>{matchCount} match</span>
                <button
                  onClick={onClearAll}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#8A857C', fontSize: 12, fontWeight: 400, padding: 0, textDecoration: 'underline', textDecorationColor: '#D5D1C9', textUnderlineOffset: 3 }}
                >clear</button>
              </span>
            )}
          </div>
        )}
        {activeFilters.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '2px 0 12px' }}>
            {activeFilters.map(a => (
              <button
                key={a.value}
                onClick={a.remove}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1C1B19', color: '#fff', fontSize: 12.5, fontWeight: 500, padding: '6px 10px 6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
              >{a.value}<span style={{ fontSize: 14, opacity: 0.7, lineHeight: 1 }}>×</span></button>
            ))}
          </div>
        )}
        {/* Order: genre · vibe · verdict · series · region (Farah, s85) — what/how
            it feels/the take, then the structural facets. Music's niche "new music
            tuesday" toggle trails at the end. */}
        {availableTags.genres.length > 0 && (
          <FilterSection label="genre" options={availableTags.genres} selected={genreFilter} onSelect={onToggleGenre} />
        )}
        {availableTags.vibes.length > 0 && (
          <FilterSection label="vibe" options={availableTags.vibes} selected={vibeFilter} onSelect={onToggleVibe} />
        )}
        {availableTags.verdicts.length > 0 && (
          <FilterSection label="verdict" options={availableTags.verdicts} selected={verdictFilter} onSelect={onToggleVerdict} />
        )}
        {seriesRelevant && availableTags.series.length > 0 && (
          <FilterSection label="series" options={availableTags.series} selected={seriesFilter} onSelect={onToggleSeries} />
        )}
        {availableTags.countries.length > 0 && (
          <FilterSection label="region" options={availableTags.countries} selected={countryFilter} onSelect={onToggleCountry} />
        )}
        {showShelf && (
          <FilterSection
            label="shelf"
            options={[{ value: 'on my shelf' }]}
            selected={ownedOnly ? ['on my shelf'] : []}
            onSelect={onToggleOwned}
          />
        )}
        {showNewMusic && (
          <FilterSection
            label="music"
            options={[{ value: 'new music tuesday' }]}
            selected={newMusicOnly ? ['new music tuesday'] : []}
            onSelect={onToggleNewMusic}
          />
        )}
        {/* Trailing spacer instead of container padding-bottom: mobile WebKit
            omits a scroll container's own padding-bottom from the scrollable
            area, clipping the last row. A real element is always scrollable to.
            Height clears the fixed bottom tab bar + domain-switcher strip (~108px)
            so the last row isn't hidden behind them when the sheet is short. */}
        <div style={{ height: clearStack(32) }} />
      </div>
    </>
  )
}

// Collapsible group. Collapsed by default so the sheet is a short menu of headers,
// not a wall of chips — opens on tap, and starts open if it already has a
// selection. Options are ranked by count and the long tail hides behind "show
// all"; selected tags aren't repeated here (they sit in the active-filters tray).
const FILTER_TOP_N = 8
function FilterSection({ label, options, selected, onSelect }: {
  label: string; options: TagCount[]; selected: string[]; onSelect: (v: string) => void
}) {
  const [open, setOpen] = useState(selected.length > 0)
  const [showAll, setShowAll] = useState(false)
  const avail = options.filter(o => !selected.includes(o.value))
  const shown = showAll ? avail : avail.slice(0, FILTER_TOP_N)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          padding: '10px 0', border: 'none', background: 'none', cursor: 'pointer',
        }}
      >
        {/* Sentence-case regular ink — clearly content beneath the uppercase
            "filter" header, not competing with it. */}
        <span style={{ fontSize: 14, fontWeight: 400, color: '#3A3A3A' }}>
          {label}{selected.length > 0 && <span style={{ color: '#6F6B64', fontWeight: 600 }}> · {selected.length}</span>}
        </span>
        <span style={{ fontSize: 10, color: '#ABA69C', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: '2px 0 11px' }}>
          {shown.map(o => (
            <button key={o.value} onClick={() => onSelect(o.value)} style={tagChipStyle(false)}>
              {o.value}{o.count != null && <span style={{ color: '#A8A39A' }}> {o.count}</span>}
            </button>
          ))}
          {avail.length > FILTER_TOP_N && (
            <button
              onClick={() => setShowAll(s => !s)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#8A857C', fontSize: 12.5, padding: '6px 4px', textDecoration: 'underline', textDecorationColor: '#D5D1C9', textUnderlineOffset: 3 }}
            >{showAll ? 'show less' : `show all ${avail.length}`}</button>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({ hasItems, onGuide }: { hasItems: boolean; onGuide: () => void }) {
  return (
    <div style={{ padding: '64px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: INK, marginBottom: 6 }}>
        {hasItems ? 'nothing matches' : 'your library is empty'}
      </div>
      <div style={{ fontSize: 13, color: GRAPHITE, lineHeight: 1.5 }}>
        {hasItems ? 'try changing your filters' : <>tap <span style={{ fontWeight: 600, color: INK }}>+</span> to add the first thing you can’t shut up about.</>}
      </div>
      {!hasItems && (
        <button
          onClick={onGuide}
          style={{
            marginTop: 20, background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: MUTE, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4,
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

// Status filter as a single dropdown (was a row of chips). The done→reaction
// sub-filter folds in below a divider: picking a reaction implies "done", so the
// whole status+reaction choice lives in one short menu instead of two rows.
function StatusDropdown({ statusFilter, reactionFilter, onStatus, onReaction }: {
  statusFilter: StatusFilter
  reactionFilter: ReactionFilter
  onStatus: (s: StatusFilter) => void
  onReaction: (r: ReactionFilter) => void
}) {
  const [open, setOpen] = useState(false)
  const active = statusFilter !== 'all' || reactionFilter !== 'all'
  const label = reactionFilter !== 'all'
    ? REACTION_LABELS[reactionFilter as ItemReaction]
    : statusFilter === 'all' ? 'status'
    : statusFilter === 'want_to' ? 'want to'
    : statusFilter === 'in_progress' ? 'in progress' : 'done'
  const pick = (s: StatusFilter, r: ReactionFilter = 'all') => { onStatus(s); onReaction(r); setOpen(false) }
  const STATUS_ITEMS: [StatusFilter, string][] = [['all', 'all'], ['want_to', 'want to'], ['in_progress', 'in progress'], ['done', 'done']]
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 3, padding: '4px 2px 8px',
          border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
          color: active ? '#111' : '#888', fontSize: 13,
          fontWeight: active ? 600 : 400, fontStyle: active ? 'italic' : 'normal',
        }}
      >
        {label}
        <span style={{ fontSize: 9, color: active ? '#111' : '#ABA69C', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 2, zIndex: 61,
            background: '#fff', border: `1px solid ${HAIR}`, borderRadius: 8,
            boxShadow: '0 6px 24px rgba(0,0,0,0.12)', padding: '4px 0', minWidth: 150,
          }}>
            {STATUS_ITEMS.map(([s, lbl]) => (
              <MenuItem key={s} label={lbl} active={statusFilter === s && reactionFilter === 'all'} onClick={() => pick(s)} />
            ))}
            {/* Reactions only make sense on finished items — reveal them once
                "done" is the active status, not before. */}
            {statusFilter === 'done' && (
              <>
                <div style={{ height: 1, background: HAIR, margin: '4px 0' }} />
                {REACTION_ORDER.map(r => (
                  <MenuItem key={r} label={REACTION_LABELS[r]} active={reactionFilter === r} onClick={() => pick('done', r)} />
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        width: '100%', padding: '8px 14px', border: 'none', background: 'none',
        cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap',
        fontSize: 13, color: active ? '#111' : '#444', fontWeight: active ? 600 : 400,
      }}
    >
      {label}{active && <span style={{ fontSize: 12 }}>✓</span>}
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
      style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${HAIR}`, padding: '4px 16px', cursor: 'pointer', background: selected ? '#FAF9F7' : 'transparent' }}
    >
      {selectMode && (
        <div style={{
          width: 21, height: 21, borderRadius: '50%', flexShrink: 0, marginRight: 11,
          border: selected ? '1.5px solid #111' : `1.5px solid ${MUTE}`,
          background: selected ? '#111' : '#fff', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
        }}>{selected ? '✓' : ''}</div>
      )}
      <Thumb src={thumbnail} type={item.type} color={color} />
      <div style={{ flex: 1, minWidth: 0, alignSelf: 'center' }}>
        <div style={{ fontSize: 14, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.1px' }}>
          <span style={{ fontWeight: 500 }}>{item.title}</span>
          {item.creator && <span style={{ fontWeight: 400, color: MUTE }}>{'  ·  '}{item.creator}</span>}
          {!!item.metadata?.canon && <span title="Desert island" style={{ fontWeight: 400, color: MUTE, fontSize: 10 }}>{'  '}★</span>}
          {!!item.metadata?.owned && <span title="Owned" style={{ fontWeight: 400, color: MUTE, fontSize: 11 }}>{'  '}⌂</span>}
          {!!item.metadata?.scratch && <span title="Needs identifying" style={{ fontWeight: 500, color: MUTE, fontSize: 11 }}>{'  '}?</span>}
        </div>
        {(subtitle || item.note) && (
          <div style={{ fontSize: 11, color: MUTE, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
            border: `1px solid ${HAIR}`, background: '#FAF9F7', cursor: 'pointer',
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
            border: `1px solid ${HAIR}`, background: '#FAF9F7', cursor: 'pointer',
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
          color: item.status === 'done' ? color.border : MUTE,
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
    return <img src={src} alt="" loading="lazy" style={{ ...box, objectFit: 'cover', border: `1px solid ${HAIR}`, background: '#FAF9F7' }} />
  }
  return (
    <div style={{ ...box, background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, letterSpacing: '0.3px', color: color.border }}>
      {type === 'other' ? '' : type}
    </div>
  )
}

// Grid layout cover card. square=true for music (album covers are 1:1).
function GridCard({ item, square, showType, caption, onTap, onSaveArt, onSaveWiki, selectMode = false, selected = false }: { item: Item; square: boolean; showType: boolean; caption: CardCaption; onTap: () => void; onSaveArt?: (id: string, url: string) => void; onSaveWiki?: (id: string, wiki: WikiInfo) => void; selectMode?: boolean; selected?: boolean }) {
  const color = typeColor(item.type)
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, item.metadata?.coverUrl as string | null)
  const artSaved = useRef(false)
  useEffect(() => {
    if (artwork && !item.metadata?.coverUrl && !artSaved.current) {
      artSaved.current = true
      onSaveArt?.(item.id, artwork)
    }
  }, [artwork]) // eslint-disable-line react-hooks/exhaustive-deps
  // Mirror the list row: when /api/art finds nothing, fall back to the Wikipedia
  // thumbnail (books especially rely on this). Without it, grid covers go blank.
  const metaWiki: WikiInfo | null = item.metadata?.wikiUrl
    ? { url: item.metadata.wikiUrl as string, thumbnail: (item.metadata.wikiThumb as string) ?? null, summary: (item.metadata.wikiSummary as string) ?? null }
    : null
  const wikiSeed = metaWiki?.summary ? metaWiki : null
  const { url: wikiUrl, thumbnail: wikiThumb, summary: wikiSummary } = useWikipediaInfo(item.type, item.title, item.creator, item.year, wikiSeed)
  const wikiSaved = useRef(false)
  useEffect(() => {
    if (wikiUrl && !wikiSeed && !wikiSaved.current) {
      wikiSaved.current = true
      onSaveWiki?.(item.id, { url: wikiUrl, thumbnail: wikiThumb, summary: wikiSummary })
    }
  }, [wikiUrl]) // eslint-disable-line react-hooks/exhaustive-deps
  const thumbnail = artwork ?? wikiThumb
  const aspect = square ? '1 / 1' : '2 / 3'
  // Same subtitle fields as the list row: type · year · seasons · genre · reaction.
  const topGenre = (item.tags ?? []).find(isGenreTag) ?? null
  const tvSeasons = item.type === 'tv' ? getSeasons(item.metadata) : []
  const seasonsLabel = tvSeasons.length > 0 ? `${tvSeasons.filter(s => s.done).length}/${tvSeasons.length} seasons` : null
  const subtitle = [
    showType ? item.type : null, item.year, seasonsLabel, topGenre,
    item.status === 'done' && item.reaction ? REACTION_LABELS[item.reaction] : null,
  ].filter(Boolean).join(' · ')
  // Corner badge on the cover: the taste-tab smiley for the ones you loved (drawn
  // as an SVG so it fills the mark and never renders as a tiny emoji), a small
  // check for the rest you've finished. Replaces the old undecodable ink-vs-grey dot.
  const loved = item.status === 'done' && item.reaction === 'loved_it'
  const finished = item.status === 'done' && !loved
  return (
    <div onClick={onTap} style={{ cursor: 'pointer', minWidth: 0 }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: aspect, overflow: 'hidden', background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: selected ? '1.5px solid #111' : `1px solid ${HAIR}` }}>
        {thumbnail
          ? <img src={thumbnail} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: square && item.type !== 'music' ? 'top' : 'center', opacity: selectMode && !selected ? 0.55 : 1 }} />
          : (
            // No cover — write the title + creator into the tile so a coverless item
            // stays identifiable even with captions turned off (the clean-wall mode).
            <div style={{ padding: '10px 9px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box', overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: color.border, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</div>
              {item.creator && <div style={{ fontSize: 10, color: color.border, opacity: 0.7, marginTop: 3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.creator}</div>}
            </div>
          )}
        {selectMode && (
          <div style={{
            position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: '50%',
            border: selected ? '1.5px solid #111' : '1.5px solid rgba(255,255,255,0.9)',
            background: selected ? '#111' : 'rgba(0,0,0,0.25)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
          }}>{selected ? '✓' : ''}</div>
        )}
        {loved && (
          <div title="loved it" aria-label="loved it" style={{
            position: 'absolute', bottom: 4, right: 4, width: 22, height: 22, color: INK,
            filter: 'drop-shadow(0 0 1.5px #fff) drop-shadow(0 1px 1.5px rgba(0,0,0,0.25))',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" fill="#fff" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" />
              <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" />
            </svg>
          </div>
        )}
        {finished && (
          <div title={item.reaction ? REACTION_LABELS[item.reaction] : 'done'} aria-label="finished" style={{
            position: 'absolute', bottom: 4, right: 4, width: 22, height: 22, color: INK,
            filter: 'drop-shadow(0 0 1.5px #fff) drop-shadow(0 1px 1.5px rgba(0,0,0,0.25))',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" fill="#fff" />
              <path d="M8.5 12.5l2.5 2.5 4.5-5" />
            </svg>
          </div>
        )}
      </div>
      {/* Caption density (s84 setting): 'none' = clean wall, the cover speaks for
          itself; 'title' = just the title; 'full' = title + creator + details. */}
      {caption !== 'none' && (
        <div style={{ marginTop: 5 }}>
          <div style={{ fontSize: 12, color: '#111', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.1px' }}>
            {!!item.metadata?.canon && <span style={{ fontSize: 9, marginRight: 3, color: INK }}>★</span>}
            {item.title}
          </div>
          {caption === 'full' && item.creator && (
            <div style={{ fontSize: 10, color: MUTE, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.creator}</div>
          )}
          {caption === 'full' && (subtitle || item.note) && (
            <div style={{ fontSize: 10, color: MUTE, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}{item.note && <span style={{ fontStyle: 'italic' }}>{subtitle ? ' · ' : ''}noted</span>}</div>
          )}
        </div>
      )}
    </div>
  )
}

// Compact header control cluster — search · overflow. Lives in the title row;
// clear-filters moved into the view·sort·filter card (s85).
function HeaderControls({ onSearch, onMore }: {
  onSearch: () => void
  onMore: () => void
}) {
  return (
    <>
      <button onClick={onSearch} title="Search" style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK, padding: 0, display: 'flex', alignItems: 'center' }}>
        <SearchIcon />
      </button>
      <button onClick={onMore} title="More" style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK, padding: 0, display: 'flex', alignItems: 'center' }}>
        <MoreIcon />
      </button>
    </>
  )
}

// Overflow bottom sheet — holds the occasional actions pulled out of the header.
function OverflowSheet({ hasItems, gapCount, captureCount, captureFailures, regionPending, regionBusy, selectMode, onClose, onDecide, onGuide, onTidy, onCaptures, onPullRegions, onSelect }: {
  hasItems: boolean
  gapCount: number
  captureCount: number
  captureFailures: number
  regionPending: number
  regionBusy: boolean
  selectMode: boolean
  onClose: () => void
  onDecide: () => void
  onGuide: () => void
  onTidy: () => void
  onCaptures: () => void
  onPullRegions: () => void
  onSelect: () => void
}) {
  const Row = ({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) => (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', padding: '13px 0', border: 'none', borderBottom: `1px solid ${HAIR}`, background: 'none', cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ fontSize: 15, color: INK }}>{label}</span>
      <span style={{ fontSize: 11, color: MUTE, marginTop: 2 }}>{sub}</span>
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
        {hasItems && <Row label="help me decide" sub="can’t choose? we’ll pick from your library" onClick={onDecide} />}
        <Row label="how to use" sub="a quick tour of nospaces" onClick={onGuide} />
        {gapCount > 0 && <Row label={`tidy · ${gapCount}`} sub="fill in missing details" onClick={onTidy} />}
        {captureCount > 0 && <Row label={captureFailures > 0 ? `email captures · ${captureFailures}` : 'email captures'} sub="forwards that didn’t save" onClick={onCaptures} />}
        {regionPending > 0 && <Row label={regionBusy ? 'pulling regions…' : `pull regions · ${regionPending}`} sub="tag films, books & music by country" onClick={regionBusy ? () => {} : onPullRegions} />}
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill={GRAPHITE} aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.59 14.42a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.82-.87 7.09-.5 9.72 1.1a.62.62 0 0 1 .21.86zm1.23-2.74a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.56 11.23 1.33.37.22.49.7.26 1.07zm.11-2.85C14.81 8.98 9.5 8.8 6.44 9.73a.94.94 0 1 1-.54-1.8c3.52-1.07 9.38-.86 13.08 1.34a.94.94 0 0 1-.96 1.61z" />
    </svg>
  )
}

function WikiGlyph() {
  return <span style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 400, color: GRAPHITE, lineHeight: 1 }}>w</span>
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="22" y2="22" />
    </svg>
  )
}
