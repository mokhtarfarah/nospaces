import { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef, type CSSProperties } from 'react'
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
import { useArtwork, isStaleBookCover } from '../lib/artwork'
import { getSeasons } from '../lib/seasons'
import { VIBES, VERDICTS } from '../lib/moods'
import { isGenreTag } from '../lib/genres'
import { gapQueue, dismissGaps, itemGaps } from '../lib/gaps'
import { inReview, reviewCount } from '../lib/review'
import { flipMediaToThing } from '../lib/flip'
import { clearStack, clearNav, clearFab } from '../lib/layout'
import { pullFacts, itemsNeedingFacts } from '../lib/regions'


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
      return creatorSortKey(a).localeCompare(creatorSortKey(b))
    case 'year':
      return (a.year ?? 0) - (b.year ?? 0)
  }
}

function sortItems(items: Item[], sort: SortOption, dir: SortDir): Item[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) => sign * compareItems(a, b, sort))
}

// "Recent" headers: months only stay meaningful while the memory is fresh, so
// the CURRENT calendar year gets month headers ("March 2026") and every earlier
// year collapses to just the year ("2024") — where the month is noise you don't
// remember anyway. Year-precision backdates (month unknown) always file under
// just the year so we never invent a month.
function groupByYear(items: Item[]): Map<string, Item[]> {
  const thisYear = new Date().getFullYear()
  const map = new Map<string, Item[]>()
  for (const item of items) {
    const date = new Date(recencyDate(item))
    const key = date.getFullYear() === thisYear && item.metadata?.dateAddedPrecision !== 'year'
      ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : String(date.getFullYear())
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

// Music creators are band/artist names, not people — "Arctic Monkeys" or
// "Fleetwood Mac" isn't a first-name/last-name pair, so last-name sorting files
// them under the wrong letter (M, M). File by the full name instead, the way a
// record shop would, dropping a leading "The" so it doesn't dominate under T.
function creatorSortKey(item: Item): string {
  if (item.type === 'music') {
    const name = item.creator?.trim()
    if (!name) return '￿'
    return name.replace(/^the\s+/i, '').toLowerCase()
  }
  return lastNameKey(item.creator)
}

function groupByCreator(items: Item[]): Map<string, Item[]> {
  const map = new Map<string, Item[]>()
  for (const item of items) {
    const key = item.creator?.trim() || 'Unknown'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  // Alphabetical by last name (full band/artist name for music), with "Unknown" last.
  return new Map(
    [...map.entries()].sort((a, b) =>
      a[0] === 'Unknown' ? 1 : b[0] === 'Unknown' ? -1
        : creatorSortKey(map.get(a[0])![0]).localeCompare(creatorSortKey(map.get(b[0])![0])),
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
  const { items: allItems, loading, markDone, markWantTo, markInProgress, deleteItem, editItem, toggleOwned, toggleCanon, toggleClassic, patchMetadata, patchItem, duplicateCount, duplicateGroups, deleteMany } = useItems()
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
  // "shelf" — three-state narrow on the owned flag (metadata.owned):
  //   'owned'   = on my shelf   (out shopping: don't re-buy what you already have)
  //   'unowned' = not on my shelf (bookstore: your want-to list minus the unread
  //               copies already at home, so you don't buy a dupe)
  //   'all'     = don't narrow (default)
  const [shelfFilter, setShelfFilter] = useState<'all' | 'owned' | 'unowned'>('all')
  // Music-only "classic" filter (s119): all · classic (canon you're studying) · new
  // (everything else). Not persisted — a transient lens, like shelf/new-music.
  const [classicFilter, setClassicFilter] = useState<'all' | 'classic' | 'new'>('all')
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
  const [factsBusy, setFactsBusy] = useState(false)
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
  // The title row used to fold away via a JS scroll listener toggling
  // max-height/opacity (collapse past 56px, expand under 16px) — it was jumpy
  // on mobile because it fires a React re-render + animates a layout property
  // on every scroll event, fighting the browser's own scroll compositing.
  // Things hit the identical problem and fixed it by dropping the JS height
  // animation entirely and letting the title scroll away naturally, keeping
  // only the actually-useful control row sticky (see ThingsScreen.tsx) — same
  // fix here (s108): the title block below is now in normal scroll flow
  // inside the list, and only the category/status/filter row is sticky.
  const listRef = useRef<HTMLDivElement>(null)
  const lastScrollRef = useRef(0)
  // Jump-to-top: only worth showing once you're a few screens deep. React bails
  // the re-render itself when the boolean doesn't flip, so no extra throttling needed.
  const [showJumpTop, setShowJumpTop] = useState(false)
  const onListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop
    lastScrollRef.current = top
    setShowJumpTop(top > 700)
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
  // The "to read" bar shows in the reading views — books alone, or the all view
  // (which already interleaves articles) — not on films/music/tv.
  const readingView = categories.length === 0 || (categories.length === 1 && categories[0] === 'book')
  function clearFilters() {
    setCategories([]); setStatusFilter('all'); setReactionFilter('all')
    setVibeFilter([]); setVerdictFilter([]); setGenreFilter([]); setSeriesFilter([]); setCountryFilter([])
    setReviewOnly(false); setNewMusicOnly(false); setShelfFilter('all'); setClassicFilter('all'); setQuery('')
    // Note: deliberately does NOT close the filter card — clearing leaves you in
    // the card to re-filter, not bounced back to the list.
  }

  // Fill-from-wikipedia backfill — one-shot Wikidata pull (free) that fills blank
  // creator / year / runtime / pages / region across the library, so you don't
  // have to open each item and auto-fill by hand. Updates rows in place via
  // patchItem; progress shown as a toast.
  const factsPending = useMemo(() => itemsNeedingFacts(items).length, [items])
  async function handlePullFacts() {
    if (factsBusy) return
    setFactsBusy(true)
    setOverflowOpen(false)
    setToast('filling from wikipedia…')
    try {
      const result = await pullFacts(items, patchItem, p => setToast(`filling from wikipedia… ${p.done}/${p.total}`))
      const msg = result.filled > 0 ? `filled ${result.filled} item${result.filled === 1 ? '' : 's'}` : 'nothing new to fill'
      // Surface failures so a partial run is visible — those items are left
      // untouched and a re-run retries them (e.g. Wikipedia throttled some).
      setToast(result.failed > 0 ? `${msg} · ${result.failed} failed, run again` : msg)
    } catch {
      setToast("couldn't reach wikipedia — check your connection")
    } finally {
      setFactsBusy(false)
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
    if (shelfFilter === 'owned')   result = result.filter(item => item.metadata?.owned)
    if (shelfFilter === 'unowned') result = result.filter(item => !item.metadata?.owned)
    // Classic lens — music only; 'new' = everything that isn't flagged a classic.
    if (musicOnly && classicFilter === 'classic') result = result.filter(item => !!item.metadata?.classic)
    if (musicOnly && classicFilter === 'new')     result = result.filter(item => !item.metadata?.classic)
    return sortItems(result, sort, dir)
  }, [baseFiltered, vibeFilter, verdictFilter, genreFilter, seriesFilter, countryFilter, shelfFilter, musicOnly, classicFilter, sort, dir])

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
  // Also scroll back to the top — a short (non-scrollable) result set should
  // open at the top, not wherever the previous set left off.
  useEffect(() => {
    const has = (list: TagCount[], v: string) => list.some(t => t.value === v)
    setVibeFilter(prev => prev.filter(v => has(availableTags.vibes, v)))
    setVerdictFilter(prev => prev.filter(v => has(availableTags.verdicts, v)))
    setGenreFilter(prev => prev.filter(v => has(availableTags.genres, v)))
    setSeriesFilter(prev => prev.filter(v => has(availableTags.series, v)))
    setCountryFilter(prev => prev.filter(v => has(availableTags.countries, v)))
    if (!hasOwned) setShelfFilter('all')
    if (!musicOnly) setClassicFilter('all') // the classic lens is music-only
    listRef.current?.scrollTo({ top: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prune only on base-control change, not on every availableFilters recompute
  }, [categories, statusFilter, reactionFilter, reviewOnly])

  const grouped = useMemo(() => {
    if (view === 'year')     return groupByDecade(filtered)
    if (group === 'creator') return groupByCreator(filtered)
    if (group === 'none')    return groupNone(filtered)
    return groupByYear(filtered)
  }, [filtered, group, view])

  // Types sorted by item count descending — library reflects the user's actual
  // collection. Articles are deliberately left out: this row already scrolls
  // sideways once it overflows on a phone, and articles have their own visible
  // entry point (the unread badge in the masthead) — so they'd only ever add to
  // that crowding without needing a chip of their own. Still reachable via "all".
  const typeOrder = useMemo(() => {
    const counts = new Map<string, number>()
    items.filter(i => !inReview(i) && i.type !== 'article').forEach(i => {
      counts.set(i.type, (counts.get(i.type) ?? 0) + 1)
    })
    return Array.from(counts.keys()).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
  }, [items])


  const reviewN = useMemo(() => reviewCount(items), [items])
  const hasReview = reviewN > 0
  // Articles have no reaction/verdict to surface, so "for review" never counts
  // them. The unread count is a quiet top-of-list bar (below the header) in the
  // reading views — books + all — not header real estate above films/music/tv,
  // which over-elevated a lightweight type. Tapping filters to the unread queue.
  const unreadArticles = useMemo(() => items.filter(i => i.type === 'article' && i.status !== 'done').length, [items])

  // Horizontal inset of the cover grid — the entry-point bars (shows / articles)
  // reuse it so their outer edge lines up with the outer edge of the gallery
  // images, not a few px short. Tightens with the cover-wall ('none') caption.
  const galleryPadX = caption === 'none' ? 12 : 14

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#fff' }}>
      {/* One scroller — title + search live in normal flow and scroll away for
          free (real native scrolling, no JS height animation); only the
          category/status/filter row below is sticky. Matches ThingsScreen's
          header, which already solved the same mobile jumpiness this way. */}
      <div ref={listRef} onScroll={onListScroll} style={{ flex: 1, overflowY: 'auto', paddingBottom: selectMode ? clearStack(94) : clearFab() }}>
        <div style={{ padding: '20px 16px 0' }}>
          {/* Magazine header — title + search/overflow on top, then count
              folded into one quiet subline. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.95, margin: 0, color: '#1C1B19' }}>library</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
              <HeaderControls
                onSearch={() => setSearchOpen(v => !v)}
                onMore={() => setOverflowOpen(true)}
              />
            </div>
          </div>
          <div style={{ borderBottom: '1.5px solid #1C1B19', marginBottom: 12, marginTop: 10 }} />

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
        </div>

        {/* Nav row — category tabs + a status dropdown on the left, the
            view·sort·filter button pinned to the right. Sticky on its own
            (not wrapped with the title) so it pins smoothly without any JS
            driving it. Was two rows before s85; merged into one so the header
            reads tighter. Status (and its done→reaction sub-filter) folds
            into the dropdown instead of taking a whole row of chips. */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #E8E8E8', padding: '0 16px' }}>
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
            {/* divider + the one filters menu (status + every tag facet) */}
            <div style={{ width: 1, height: 16, background: '#DDD', flexShrink: 0, margin: '0 12px' }} />
            <FilterMenu
              statusFilter={statusFilter}
              reactionFilter={reactionFilter}
              onStatus={s => { setStatusFilter(s); if (s !== 'done') setReactionFilter('all') }}
              onReaction={setReactionFilter}
              showShelf={hasOwned}
              shelfFilter={shelfFilter}
              onShelf={v => setShelfFilter(prev => prev === v ? 'all' : v)}
              availableTags={availableTags}
              singleMedium={categories.length === 1}
              seriesRelevant={seriesRelevant}
              vibeFilter={vibeFilter} onToggleVibe={toggleFilter(setVibeFilter)}
              verdictFilter={verdictFilter} onToggleVerdict={toggleFilter(setVerdictFilter)}
              genreFilter={genreFilter} onToggleGenre={toggleFilter(setGenreFilter)}
              seriesFilter={seriesFilter} onToggleSeries={toggleFilter(setSeriesFilter)}
              countryFilter={countryFilter} onToggleCountry={toggleFilter(setCountryFilter)}
              showNewMusic={musicOnly} newMusicOnly={newMusicOnly} onToggleNewMusic={() => setNewMusicOnly(v => !v)}
              matchCount={filtered.length}
              onClearAll={clearFilters}
            />
            {/* spacer pushes the right-hand controls to the edge */}
            <div style={{ flex: '1 1 0' }} />
            {/* Count of what's on screen — tracks the active tab + every filter, so
                the number answers "how many of what I'm viewing". Was a whole
                subtitle row under the title (s116); folded onto this row. */}
            <span style={{ fontSize: 13, fontWeight: 500, color: '#1C1B19', flexShrink: 0, marginRight: 14, padding: '4px 0 8px', fontVariantNumeric: 'tabular-nums' }}>{filtered.length}</span>
            {/* View + sort live in one card opened from this button, mirroring the
                Things board. Filtering moved out to the filters menu (left); this
                sheet is layout · captions · sort only. */}
            <button
              onClick={() => setFilterSheetOpen(true)}
              aria-label="view and sort"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                padding: '4px 2px 8px', border: 'none', background: 'none',
                color: '#888', cursor: 'pointer',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="8" x2="20" y2="8" /><circle cx="9" cy="8" r="2.3" fill="#fff" />
                <line x1="4" y1="16" x2="20" y2="16" /><circle cx="15" cy="16" r="2.3" fill="#fff" />
              </svg>
            </button>
          </div>
        </div>
        {/* Classic lens (s119) — music only: split the classics you're studying
            (canon / music history) from newer listening. A quiet text segment, not a
            bar, so it sits under the header without competing with the shows/grid. */}
        {musicOnly && !reviewOnly && !query.trim() && (
          <div style={{ display: 'flex', gap: 16, padding: `12px ${galleryPadX}px 0`, alignItems: 'baseline' }}>
            {(['all', 'classic', 'new'] as const).map(v => (
              <button
                key={v}
                onClick={() => setClassicFilter(v)}
                style={{
                  border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, letterSpacing: '0.01em',
                  color: classicFilter === v ? '#1C1B19' : '#A8A39A',
                  fontWeight: classicFilter === v ? 600 : 400,
                }}
              >{v}</button>
            ))}
          </div>
        )}
        {/* Shows near you — lives in the music view (it's intrinsically music). */}
        {musicOnly && !reviewOnly && (
          <button
            onClick={() => navigate('/shows')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              width: `calc(100% - ${galleryPadX * 2}px)`, boxSizing: 'border-box', margin: `12px ${galleryPadX}px 0`,
              padding: '10px 14px', background: '#F4F2EE', border: 'none', borderRadius: 4,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1B19' }}>shows near you</span>
            <span style={{ fontSize: 12, color: '#9A958B' }}>browse →</span>
          </button>
        )}
        {/* Read-later queue — a quiet door into the unread articles, only in the
            reading views. Shares the shows-near-you bar's soft-fill + squared
            corners so the two entry-point bars read as one calm family. */}
        {unreadArticles > 0 && readingView && !reviewOnly && !query.trim() && (
          <button
            onClick={() => selectCategory('article')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              width: `calc(100% - ${galleryPadX * 2}px)`, boxSizing: 'border-box', margin: `12px ${galleryPadX}px 0`,
              padding: '10px 14px', background: '#F4F2EE', border: 'none', borderRadius: 4,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1B19' }}>{unreadArticles} article{unreadArticles === 1 ? '' : 's'}</span>
            <span style={{ fontSize: 12, color: '#9A958B' }}>open →</span>
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
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: caption === 'none' ? 4 : 10, padding: `4px ${galleryPadX}px 12px` }}>
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
                    onMarkDone={() => (item.type === 'article'
                      ? editItem(item.id, { status: 'done', date_done: new Date().toISOString() })
                      : setDoneItem(item))}
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

      {/* Jump to top — only once you've scrolled a few screens deep. Left side
          so it never collides with the add FAB (right); hidden in select mode,
          where the bulk action bar already occupies that strip. */}
      {showJumpTop && !selectMode && (
        <button
          onClick={() => listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="jump to top"
          style={{
            position: 'fixed', bottom: clearStack(18), left: 20,
            width: 44, height: 44, borderRadius: '50%',
            background: '#fff', color: '#1C1B19', border: '1px solid #E2DED7', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99, boxShadow: '0 2px 12px rgba(0,0,0,0.14)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="6" />
            <polyline points="6 12 12 6 18 12" />
          </svg>
        </button>
      )}

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
            onToggleClassic={classic => toggleClassic(fresh.id, classic)}
            onPatchMetadata={patch => patchMetadata(fresh.id, patch)}
            onPatchTags={tags => editItem(fresh.id, { tags })}
            onMarkInProgress={() => { markInProgress(fresh.id); setActionItem(null) }}
            onMarkWantTo={() => { markWantTo(fresh.id); setActionItem(null) }}
            onMarkRead={() => { editItem(fresh.id, { status: 'done', date_done: new Date().toISOString() }); setActionItem(null) }}
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
          view={view} dir={dir} onSelectView={selectView}
          layout={layout} onLayout={l => setLayout(l)}
          gridCols={gridCols} onGridCols={c => setGridCols(c)}
          caption={caption} onCaption={setCaption}
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
          factsPending={factsPending}
          factsBusy={factsBusy}
          selectMode={selectMode}
          onClose={() => setOverflowOpen(false)}
          onDecide={() => { setOverflowOpen(false); navigate('/decide') }}
          onGuide={() => { setOverflowOpen(false); navigate('/guide') }}
          onTidy={() => { setOverflowOpen(false); setGapsOpen(true) }}
          onCaptures={() => { setOverflowOpen(false); setCapturesOpen(true) }}
          onPullFacts={handlePullFacts}
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

// One card for "how is this list shown" — layout, captions, sort — opened from
// the slider button next to the categories. Mirrors the Things board's view sheet.
// Filtering used to live here too; it moved to the filters menu (left of the
// categories), so this sheet is view + sort only now.
function FilterSheet({
  view, dir, onSelectView,
  layout, onLayout, gridCols, onGridCols, caption, onCaption,
  onClose,
}: {
  view: ViewMode; dir: SortDir; onSelectView: (v: ViewMode) => void
  layout: 'list' | 'grid'; onLayout: (l: 'list' | 'grid') => void
  gridCols: 3 | 4; onGridCols: (c: 3 | 4) => void
  caption: CardCaption; onCaption: (c: CardCaption) => void
  onClose: () => void
}) {
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
            fold into one row (was layout + a separate "columns" row before s85).
            "roomy"/"compact" (s107) — same terminology as the Things board's density
            row, so the language matches across both even though the underlying grid
            here is a fixed 3/4-column choice rather than Things' responsive one. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontSize: 14, color: '#3A3A3A' }}>layout</span>
          <div style={segGroup}>
            <button onClick={() => onLayout('list')} style={segBtn(layout === 'list')}>list</button>
            <button onClick={() => { onLayout('grid'); onGridCols(3) }} style={segBtn(layout === 'grid' && gridCols === 3)}>roomy</button>
            <button onClick={() => { onLayout('grid'); onGridCols(4) }} style={segBtn(layout === 'grid' && gridCols === 4)}>compact</button>
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

// Tab-style: the category row. Active is ink + italic AND a 1.5px underline —
// ported from the Things board's category chips (Farah likes the underline; it's
// easier to scan at a glance than italics alone). Keep the two in sync.
function TabChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '4px 2px 7px',
        border: 'none',
        background: 'none',
        color: active ? '#111' : '#888',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        fontStyle: active ? 'italic' : 'normal',
        // Explicit 'transparent' when inactive so the line reserves its space and
        // the row doesn't jump 1.5px when you switch tabs.
        borderBottom: active ? '1.5px solid #111' : '1.5px solid transparent',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// The single "filters" menu (replaced the old "status" dropdown + the tag-filter
// half of the view sheet — everything that narrows the list now lives here; the
// sheet keeps only view + sort). A two-tier popover: tier 1 is a short list of
// filter axes, tapping one drills into tier 2 with that axis's options, and a
// back header returns to tier 1. Status keeps its done→verdict and want-to→shelf
// refinements inline in its own panel, as before.
type FilterPanel = 'status' | 'shelf' | 'genre' | 'vibe' | 'verdict' | 'series' | 'region'
function FilterMenu({
  statusFilter, reactionFilter, onStatus, onReaction,
  showShelf, shelfFilter, onShelf,
  availableTags, singleMedium, seriesRelevant,
  vibeFilter, onToggleVibe,
  verdictFilter, onToggleVerdict,
  genreFilter, onToggleGenre,
  seriesFilter, onToggleSeries,
  countryFilter, onToggleCountry,
  showNewMusic, newMusicOnly, onToggleNewMusic,
  matchCount, onClearAll,
}: {
  statusFilter: StatusFilter
  reactionFilter: ReactionFilter
  onStatus: (s: StatusFilter) => void
  onReaction: (r: ReactionFilter) => void
  showShelf: boolean
  shelfFilter: 'all' | 'owned' | 'unowned'
  onShelf: (v: 'owned' | 'unowned') => void
  availableTags: { vibes: TagCount[]; verdicts: TagCount[]; genres: TagCount[]; series: TagCount[]; countries: TagCount[] }
  singleMedium: boolean
  seriesRelevant: boolean
  vibeFilter: string[]; onToggleVibe: (v: string) => void
  verdictFilter: string[]; onToggleVerdict: (v: string) => void
  genreFilter: string[]; onToggleGenre: (v: string) => void
  seriesFilter: string[]; onToggleSeries: (v: string) => void
  countryFilter: string[]; onToggleCountry: (v: string) => void
  showNewMusic: boolean; newMusicOnly: boolean; onToggleNewMusic: () => void
  matchCount: number
  onClearAll: () => void
}) {
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<FilterPanel | null>(null)
  const close = () => { setOpen(false); setPanel(null) }

  // The "filters" button can sit anywhere along the horizontally-scrolling nav
  // row (far right when every category tab shows, far left on an empty library),
  // so a fixed left/right anchor either spills past the viewport (widening the
  // page → the whole app scrolls sideways) or clips off the near edge. Instead we
  // left-align the panel to the button, then nudge it horizontally by just enough
  // to keep both edges on-screen. Re-runs on open + panel change (panels differ in
  // width). Direct DOM write (no state) so there's no measure→render loop.
  const popRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = popRef.current
    if (!open || !el) return
    el.style.transform = 'translateX(0px)'
    const r = el.getBoundingClientRect()
    const m = 8 // min gap from either viewport edge
    let shift = 0
    if (r.right > window.innerWidth - m) shift = window.innerWidth - m - r.right // pull left to fit
    if (r.left + shift < m) shift = m - r.left // but never past the left edge
    el.style.transform = `translateX(${shift}px)`
  }, [open, panel])

  const statusActive = statusFilter !== 'all' || reactionFilter !== 'all'
  const tagCount = genreFilter.length + vibeFilter.length + verdictFilter.length + seriesFilter.length + countryFilter.length
  const activeCount = tagCount + (statusActive ? 1 : 0) + (shelfFilter !== 'all' ? 1 : 0) + (showNewMusic && newMusicOnly ? 1 : 0)
  const active = activeCount > 0

  const statusSummary = reactionFilter !== 'all' ? REACTION_LABELS[reactionFilter as ItemReaction]
    : statusFilter === 'want_to' ? 'want to'
    : statusFilter === 'in_progress' ? 'in progress'
    : statusFilter === 'done' ? 'done' : ''
  const shelfSummary = shelfFilter === 'owned' ? 'on my shelf' : shelfFilter === 'unowned' ? 'not on my shelf' : ''
  const countSummary = (n: number) => (n > 0 ? String(n) : '')

  // Tier-1 rows, in the same order the old sheet used: status, shelf, then the
  // per-medium facets (genre · vibe · verdict · series · region). Only axes that
  // apply to the current view are listed.
  const rows: { key: FilterPanel; label: string; summary: string }[] = [
    { key: 'status', label: 'status', summary: statusSummary },
  ]
  if (showShelf) rows.push({ key: 'shelf', label: 'shelf', summary: shelfSummary })
  if (singleMedium && availableTags.genres.length > 0) rows.push({ key: 'genre', label: 'genre', summary: countSummary(genreFilter.length) })
  if (singleMedium && availableTags.vibes.length > 0) rows.push({ key: 'vibe', label: 'vibe', summary: countSummary(vibeFilter.length) })
  if (singleMedium && availableTags.verdicts.length > 0) rows.push({ key: 'verdict', label: 'verdict', summary: countSummary(verdictFilter.length) })
  if (seriesRelevant && availableTags.series.length > 0) rows.push({ key: 'series', label: 'series', summary: countSummary(seriesFilter.length) })
  if (availableTags.countries.length > 0) rows.push({ key: 'region', label: 'region', summary: countSummary(countryFilter.length) })

  const STATUS_ITEMS: [StatusFilter, string][] = [['all', 'all'], ['want_to', 'want to'], ['in_progress', 'in progress'], ['done', 'done']]
  const panelTitle = panel === 'region' ? 'region' : panel
  const tagPanel = (options: TagCount[], selected: string[], onToggle: (v: string) => void) =>
    options.map(o => (
      <MenuItem key={o.value} label={o.value} count={o.count} active={selected.includes(o.value)} onClick={() => onToggle(o.value)} />
    ))

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 2px 8px',
          border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
          color: active ? '#111' : '#888', fontSize: 13,
          fontWeight: active ? 600 : 400, fontStyle: active ? 'italic' : 'normal',
        }}
      >
        filters
        {active && (
          <span style={{ fontSize: 11, fontWeight: 600, fontStyle: 'normal', color: '#fff', background: '#1C1B19', borderRadius: 8, minWidth: 15, height: 15, lineHeight: '15px', textAlign: 'center', padding: '0 4px' }}>{activeCount}</span>
        )}
        <span style={{ fontSize: 9, color: active ? '#111' : '#ABA69C', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          {/* Left-aligned to the button, then nudged on-screen by the layout effect
              above (the button roams along the scrolling nav row). maxWidth caps it
              to the viewport so wide content can't push the page wider than the
              screen — that's what made the whole app scroll sideways. */}
          <div ref={popRef} style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 2, zIndex: 61,
            background: '#fff', border: `1px solid ${HAIR}`, borderRadius: 8,
            boxShadow: '0 6px 24px rgba(0,0,0,0.12)', padding: '4px 0', minWidth: 190,
            maxWidth: 'calc(100vw - 24px)', maxHeight: '60vh', overflowY: 'auto',
          }}>
            {panel === null ? (
              <>
                {rows.map(r => (
                  <FilterRow key={r.key} label={r.label} summary={r.summary} onClick={() => setPanel(r.key)} />
                ))}
                {/* "new music tuesday" is a single on/off, so it toggles straight
                    from the top level rather than drilling into a one-item panel. */}
                {showNewMusic && (
                  <MenuItem label="new music tuesday" active={newMusicOnly} onClick={onToggleNewMusic} />
                )}
                {active && (
                  <>
                    <div style={{ height: 1, background: HAIR, margin: '4px 0' }} />
                    <button
                      onClick={onClearAll}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                        width: '100%', padding: '8px 14px', border: 'none', background: 'none',
                        cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap', fontSize: 13, color: '#8A857C',
                      }}
                    >
                      clear all<span style={{ color: '#A8A39A', fontSize: 12 }}>{matchCount} left</span>
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => setPanel(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                    padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer',
                    textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#111',
                  }}
                >
                  <span style={{ fontSize: 14 }}>‹</span>{panelTitle}
                </button>
                <div style={{ height: 1, background: HAIR, margin: '0 0 4px' }} />
                {panel === 'status' && (
                  <>
                    {STATUS_ITEMS.map(([s, lbl]) => (
                      <MenuItem key={s} label={lbl} active={statusFilter === s && reactionFilter === 'all'} onClick={() => { onStatus(s); if (s !== 'done') onReaction('all') }} />
                    ))}
                    {/* Reactions only make sense on finished items — reveal them
                        once "done" is the active status, not before. */}
                    {statusFilter === 'done' && (
                      <>
                        <div style={{ height: 1, background: HAIR, margin: '4px 0' }} />
                        {REACTION_ORDER.map(r => (
                          <MenuItem key={r} label={REACTION_LABELS[r]} active={reactionFilter === r} onClick={() => { onStatus('done'); onReaction(r) }} />
                        ))}
                      </>
                    )}
                    {/* Shelf refines "want to" — the bookstore case. Optional. */}
                    {statusFilter === 'want_to' && showShelf && (
                      <>
                        <div style={{ height: 1, background: HAIR, margin: '4px 0' }} />
                        <MenuItem label="on my shelf" active={shelfFilter === 'owned'} onClick={() => onShelf('owned')} />
                        <MenuItem label="not on my shelf" active={shelfFilter === 'unowned'} onClick={() => onShelf('unowned')} />
                      </>
                    )}
                  </>
                )}
                {panel === 'shelf' && (
                  <>
                    <MenuItem label="on my shelf" active={shelfFilter === 'owned'} onClick={() => onShelf('owned')} />
                    <MenuItem label="not on my shelf" active={shelfFilter === 'unowned'} onClick={() => onShelf('unowned')} />
                  </>
                )}
                {panel === 'genre' && tagPanel(availableTags.genres, genreFilter, onToggleGenre)}
                {panel === 'vibe' && tagPanel(availableTags.vibes, vibeFilter, onToggleVibe)}
                {panel === 'verdict' && tagPanel(availableTags.verdicts, verdictFilter, onToggleVerdict)}
                {panel === 'series' && tagPanel(availableTags.series, seriesFilter, onToggleSeries)}
                {panel === 'region' && tagPanel(availableTags.countries, countryFilter, onToggleCountry)}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Tier-1 row of the filters menu: axis name on the left, its current selection
// (a value or a count) plus a chevron on the right. Summary reads ink when the
// axis is narrowing, so active axes stand out at a glance.
function FilterRow({ label, summary, onClick }: { label: string; summary: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        width: '100%', padding: '8px 14px', border: 'none', background: 'none',
        cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap',
        fontSize: 13, color: '#444', fontWeight: summary ? 600 : 400,
      }}
    >
      {label}
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {summary && <span style={{ fontSize: 12.5, color: '#111' }}>{summary}</span>}
        <span style={{ fontSize: 13, color: '#ABA69C' }}>›</span>
      </span>
    </button>
  )
}

function MenuItem({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
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
      <span>{label}{count != null && <span style={{ color: '#A8A39A' }}> {count}</span>}</span>
      {active && <span style={{ fontSize: 12 }}>✓</span>}
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
  // Articles have no coverUrl until edited — their only image is the og:image
  // scraped at capture time (metadata.image).
  const savedCover = (item.metadata?.coverUrl as string | null)
    ?? (item.type === 'article' ? (item.metadata?.image as string | null) : null)
  const staleCover = isStaleBookCover(item.type, savedCover)
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, staleCover ? null : savedCover)
  const artSaved = useRef(false)
  useEffect(() => {
    // Save a freshly-resolved cover when there's none saved, or overwrite a stale
    // Open Library book cover with the newly-resolved (Apple) one.
    if (artwork && artwork !== savedCover && (!savedCover || staleCover) && !artSaved.current) {
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


const CATEGORY_LABEL: Record<string, string> = { film: 'films', book: 'books', music: 'music', tv: 'tv', article: 'articles', other: 'other' }

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

// First letter of a publication for the article avatar — skips a leading "The"
// so "The New Yorker" → N and "The Atlantic" → A instead of both reading "T".
function sourceInitial(source: string): string {
  const name = source.replace(/^the\s+/i, '').trim() || source
  return name.charAt(0).toUpperCase()
}

// Grid layout cover card. square=true for music (album covers are 1:1).
function GridCard({ item, square, showType, caption, onTap, onSaveArt, onSaveWiki, selectMode = false, selected = false }: { item: Item; square: boolean; showType: boolean; caption: CardCaption; onTap: () => void; onSaveArt?: (id: string, url: string) => void; onSaveWiki?: (id: string, wiki: WikiInfo) => void; selectMode?: boolean; selected?: boolean }) {
  const color = typeColor(item.type)
  // Articles have no coverUrl until edited — their only image is the og:image
  // scraped at capture time (metadata.image).
  const savedCover = (item.metadata?.coverUrl as string | null)
    ?? (item.type === 'article' ? (item.metadata?.image as string | null) : null)
  const staleCover = isStaleBookCover(item.type, savedCover)
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, staleCover ? null : savedCover)
  const artSaved = useRef(false)
  useEffect(() => {
    // Save a freshly-resolved cover when there's none saved, or overwrite a stale
    // Open Library book cover with the newly-resolved (Apple) one.
    if (artwork && artwork !== savedCover && (!savedCover || staleCover) && !artSaved.current) {
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
  // Article hero images are landscape (og:image), not portrait covers — square
  // crops them sanely where the default 2:3 book/poster ratio would butcher them.
  const aspect = (square || item.type === 'article') ? '1 / 1' : '2 / 3'
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
  // A bare og:image gives no clue what the piece is or where it's from — unlike a
  // poster/album cover, it isn't self-identifying — so articles get a source name
  // (site_name, falling back to the URL's hostname) baked into an overlay band.
  const articleSource = item.type === 'article'
    ? ((item.metadata?.siteName as string | undefined)?.trim()
        || (() => { try { return new URL((item.metadata?.url as string) ?? '').hostname.replace(/^www\./, '').split('.')[0] } catch { return null } })())
    : null
  return (
    <div onClick={onTap} style={{ cursor: 'pointer', minWidth: 0 }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: aspect, overflow: 'hidden', background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: selected ? '1.5px solid #111' : `1px solid ${HAIR}` }}>
        {thumbnail
          ? <img src={thumbnail} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: square && item.type !== 'music' && item.type !== 'article' ? 'top' : 'center', opacity: selectMode && !selected ? 0.55 : 1 }} />
          : (
            // No cover — write the title + creator into the tile so a coverless item
            // stays identifiable even with captions turned off (the clean-wall mode).
            <div style={{ padding: '10px 9px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box', overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: color.border, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</div>
              {item.creator && <div style={{ fontSize: 10, color: color.border, opacity: 0.7, marginTop: 3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.creator}</div>}
            </div>
          )}
        {item.type === 'article' && thumbnail && (
          // Opaque band anchored to the photo, not a gradient scrim — reads as part
          // of the tile rather than floating text over the image.
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#F0EFEC', borderTop: `1px solid ${HAIR}`, padding: '7px 8px 8px', opacity: selectMode && !selected ? 0.55 : 1 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: INK, lineHeight: 1.25, marginBottom: articleSource ? 4 : 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</div>
            {articleSource && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: color.border, color: color.bg, fontSize: 7, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{sourceInitial(articleSource)}</div>
                <div style={{ fontSize: 9, color: MUTE, letterSpacing: '0.2px' }}>{articleSource}</div>
              </div>
            )}
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
          // Articles own the bottom-right corner with the source band — reaction
          // badge moves up top so the two don't collide.
          <div title="loved it" aria-label="loved it" style={{
            position: 'absolute', ...(item.type === 'article' ? { top: 4 } : { bottom: 4 }), right: 4, width: 22, height: 22, color: INK,
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
            position: 'absolute', ...(item.type === 'article' ? { top: 4 } : { bottom: 4 }), right: 4, width: 22, height: 22, color: INK,
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
          itself; 'title' = just the title; 'full' = title + creator + details.
          Articles with a photo skip this — the overlay band already carries the
          title, and doubling it up here would just repeat the same text. */}
      {caption !== 'none' && !(item.type === 'article' && thumbnail) && (
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
function OverflowSheet({ hasItems, gapCount, captureCount, captureFailures, factsPending, factsBusy, selectMode, onClose, onDecide, onGuide, onTidy, onCaptures, onPullFacts, onSelect }: {
  hasItems: boolean
  gapCount: number
  captureCount: number
  captureFailures: number
  factsPending: number
  factsBusy: boolean
  selectMode: boolean
  onClose: () => void
  onDecide: () => void
  onGuide: () => void
  onTidy: () => void
  onCaptures: () => void
  onPullFacts: () => void
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
        {gapCount > 0 && <Row label="tidy" sub="fill in missing details" onClick={onTidy} />}
        {captureCount > 0 && <Row label={captureFailures > 0 ? `email captures · ${captureFailures}` : 'email captures'} sub="forwards that didn’t save" onClick={onCaptures} />}
        {factsPending > 0 && <Row label={factsBusy ? 'filling from wikipedia…' : 'fill from wikipedia'} sub="creator, year, runtime & wiki link — no tidying needed" onClick={factsBusy ? () => {} : onPullFacts} />}
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
