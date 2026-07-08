import { useState, useEffect, useRef } from 'react'
import type { Item, ItemReaction } from '../lib/database.types'
import { typeColor, TYPE_COLORS } from '../lib/colors'
import { authHeaders } from '../lib/supabase'
import { NoteProse } from './NoteProse'
import { MoodChips } from './MoodChips'
import { ReactionForm } from './ReactionForm'
import { VIBES, VERDICTS, vibesForType } from '../lib/moods'
import { useWikipediaInfo, useWikiByUrl, isStaleSummary } from '../lib/wikipedia'
import { itemGaps } from '../lib/gaps'
import { useArtwork, clearArtworkCache } from '../lib/artwork'
import { useBookBlurb, clearBlurbCache } from '../lib/blurb'
import { getSeasons, useSeasonCount, type Season } from '../lib/seasons'
import { WhereToWatchSheet } from './WhereToWatchSheet'
import { SheetHero } from './SheetHero'
import { genresForType, isGenreTag } from '../lib/genres'
import { inReview } from '../lib/review'
import { REGION_VERSION } from '../lib/regions'

interface Props {
  item: Item
  onEdit: (fields: { title: string; creator: string | null; type: string; year: number | null; tags?: string[]; moods?: string[]; source_detail?: string | null; metadata?: Record<string, unknown>; date_added?: string }) => void
  onMarkInProgress?: () => void
  onMarkWantTo?: () => void
  onMarkDone: (reaction: ItemReaction, note: string, moods: string[]) => void
  onEditReaction: (reaction: ItemReaction | null, note: string, moods: string[]) => void
  onSetSeasons: (seasons: Season[]) => void
  onToggleOwned: (owned: boolean) => void
  onToggleCanon: (canon: boolean) => void
  onPatchMetadata: (patch: Record<string, unknown>) => void
  onPatchTags: (tags: string[]) => void
  onDelete: () => void
  onClose: () => void
  // Triage an item out of the "for review" inbox. No reaction = keep as want_to;
  // a reaction logs it as done. Either way the review flag is cleared.
  onKeep?: (reaction?: ItemReaction) => void
  // Misroute fix: this isn't media, it's a thing — move it to the board. The mirror
  // of the board's "actually media" flip.
  onFlipToThing?: () => void
  // Tap a genre/vibe/verdict on the read view to filter the library to that medium
  // + tag (mirrors the Things board's tappable taste tags). Only wired from the
  // Library; when absent the tags render as plain text.
  onFilterTag?: (group: 'genre' | 'vibe' | 'verdict', value: string) => void
  // How many items of THIS item's medium carry the tag — gates tappability so a
  // one-off tag (count 1) isn't a dead-end filter.
  countWithTag?: (group: 'genre' | 'vibe' | 'verdict', value: string) => number
  // Open straight into the edit view (e.g. deep-linked from the data-gaps list).
  initialEdit?: boolean
  // Tidy-queue walk-through: when present, the edit view shows "save & next" /
  // "skip" instead of plain "save", and a "n of total" position line.
  tidyPosition?: { index: number; total: number }
  onSaveNext?: () => void
  onSkipNext?: () => void
  onDismissNext?: () => void
  seriesOptions?: string[]
}

const TYPES = ['film', 'book', 'music', 'tv', 'other']


const REACTIONS: { value: ItemReaction; label: string }[] = [
  { value: 'loved_it',   label: 'loved it'   },
  { value: 'liked_it',   label: 'liked it'   },
  { value: 'eh',         label: 'eh'         },
  { value: 'not_for_me', label: 'not for me' },
]

const REACTION_LABELS: Record<ItemReaction, string> = {
  loved_it: 'loved it', liked_it: 'liked it', eh: 'eh', not_for_me: 'not for me',
}

// Label the reference link by its site (wikipedia ↗, goodreads ↗, …) so the
// card link makes sense whatever source you pasted, not just Wikipedia.
function refLinkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('wikipedia.org')) return 'wikipedia'
    return host.split('.')[0]
  } catch {
    return 'link'
  }
}

// Human-readable article name from a Wikipedia URL (last path segment, decoded).
function wikiArticleName(url: string): string {
  try {
    const seg = new URL(url).pathname.split('/').pop() ?? ''
    return decodeURIComponent(seg).replace(/_/g, ' ') || 'wikipedia'
  } catch {
    return 'wikipedia'
  }
}

type View = 'main' | 'edit' | 'reaction'

// A candidate match offered after identify (from the AI's alternatives or a catalog lookup).
type Candidate = { title: string; creator: string | null; year: number | null; metadata?: Record<string, unknown>; tags?: string[] }

// Summary shown after auto-fill runs: what it pulled + which article it came from.
type AutoFillInfo = { article: string; filled: string[]; viaWiki: boolean }

// Runtime (film/tv) or page count (book) for display on the card. Null if unknown.
function formatRuntime(item: Item): string | null {
  if (item.type === 'book') {
    const p = item.metadata?.pages
    return typeof p === 'number' && p > 0 ? `${p} pp` : null
  }
  if (item.type === 'film' || item.type === 'tv') {
    const r = item.metadata?.runtime
    return typeof r === 'number' && r > 0 ? `${r} min` : null
  }
  return null
}

export function ItemActionSheet({ item, onEdit, onMarkInProgress, onMarkWantTo, onMarkDone, onEditReaction, onSetSeasons, onToggleOwned, onToggleCanon, onPatchMetadata, onPatchTags, onDelete, onClose, onKeep, onFlipToThing, onFilterTag, countWithTag, initialEdit, tidyPosition, onSaveNext, onSkipNext, onDismissNext, seriesOptions }: Props) {
  const [view, setView] = useState<View>(initialEdit ? 'edit' : 'main')
  const [title, setTitle] = useState(item.title)
  const [creator, setCreator] = useState(item.creator ?? '')
  const [type, setType] = useState(item.type)
  const [year, setYear] = useState(item.year?.toString() ?? '')
  const [reaction, setReaction] = useState<ItemReaction | null>(item.reaction)
  // Local canon mirror so the desert-island toggle flips instantly (the parent
  // persists, but item.metadata may not re-render the sheet in time).
  const [canon, setCanon] = useState(!!item.metadata?.canon)
  const [note, setNote] = useState(item.note ?? '')
  const [selectedMoods, setSelectedMoods] = useState<string[]>(() => {
    const unconfirmed = ((item.metadata?.unconfirmedVibes as string[] | undefined) ?? [])
      .filter(v => VIBES.includes(v) && !(item.moods ?? []).includes(v))
    return [...new Set([...(item.moods ?? []), ...unconfirmed])]
  })
  // unconfirmedVibes may arrive async — seed selectedMoods when they land (mirrors editMoods fix).
  const unconfirmedVibesKeyReaction = JSON.stringify(item.metadata?.unconfirmedVibes ?? [])
  useEffect(() => {
    const arrived = ((item.metadata?.unconfirmedVibes as string[] | undefined) ?? [])
      .filter(v => VIBES.includes(v) && !(item.moods ?? []).includes(v))
    if (arrived.length) setSelectedMoods(prev => [...new Set([...prev, ...arrived])])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unconfirmedVibesKeyReaction])

  function toggleMood(mood: string) {
    setSelectedMoods(prev =>
      prev.includes(mood) ? prev.filter(m => m !== mood) : [...prev, mood]
    )
  }
  const [coverUrl, setCoverUrl] = useState((item.metadata?.coverUrl as string | null) ?? '')
  const [series, setSeries] = useState((item.metadata?.series as string | null) ?? '')
  const [seriesNewMode, setSeriesNewMode] = useState(() => {
    const s = (item.metadata?.series as string | null) ?? ''
    return s !== '' && !(seriesOptions ?? []).includes(s)
  })
  const [sourceDetail, setSourceDetail] = useState(item.source_detail ?? '')
  // The blurb shown on the card that ISN'T the user's own — used to pre-fill the
  // edit box so an existing description is visible (and not accidentally lost),
  // while letting us tell an untouched echo from a real edit on save.
  const nonManualBlurb = ((item.metadata?.recommendationBlurb as string | undefined)
    ?? (item.metadata?.capturedBlurb as string | undefined)
    ?? (item.metadata?.wikiSummary as string | undefined)
    ?? '')
  const [blurbText, setBlurbText] = useState(((item.metadata?.manualBlurb as string | undefined) ?? nonManualBlurb) ?? '')

  // Provisional AI vibe guesses (set at add-time). Kept OUT of moods until the
  // user confirms by saving the edit view; shown muted on the read view.
  const unconfirmedVibes = ((item.metadata?.unconfirmedVibes as string[] | undefined) ?? [])
    .filter(v => VIBES.includes(v) && !(item.moods ?? []).includes(v))

  // Edit-view draft state — separate from the item so cancel discards cleanly.
  const [editTags, setEditTags] = useState<string[]>(item.tags ?? [])
  // Vibes + verdicts edited together in the edit view. Unconfirmed AI vibes seed
  // it as active chips; saving the edit confirms whatever's selected into moods.
  const [editMoods, setEditMoods] = useState<string[]>(() => [...new Set([...(item.moods ?? []), ...unconfirmedVibes])])
  // unconfirmedVibes may arrive async (fetched after mount) — seed editMoods when they land.
  const unconfirmedVibesKey = JSON.stringify(item.metadata?.unconfirmedVibes ?? [])
  useEffect(() => {
    const arrived = ((item.metadata?.unconfirmedVibes as string[] | undefined) ?? [])
      .filter(v => VIBES.includes(v) && !(item.moods ?? []).includes(v))
    if (arrived.length) setEditMoods(prev => [...new Set([...prev, ...arrived])])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unconfirmedVibesKey])
  const [runtimeEdit, setRuntimeEdit] = useState(String((item.metadata?.runtime as number | null) ?? ''))
  const [pagesEdit, setPagesEdit] = useState(String((item.metadata?.pages as number | null) ?? ''))
  const [wikiUrlEdit, setWikiUrlEdit] = useState(String((item.metadata?.wikiUrl as string | null) ?? ''))
  // Editable "added" date — lets a book read years ago be backdated out of the
  // top of "recent". Month is optional (some memories are only a year). Seeded
  // from the stored date_added; year-precision manual dates show a blank month.
  const addedDate = new Date(item.date_added)
  const yearOnly = item.metadata?.dateAddedPrecision === 'year'
  const [dateYear, setDateYear] = useState(
    isNaN(addedDate.getTime()) ? '' : String(addedDate.getFullYear())
  )
  const [dateMonth, setDateMonth] = useState(
    isNaN(addedDate.getTime()) || yearOnly ? '' : String(addedDate.getMonth() + 1)
  )
  // Remember the seed so we only rewrite date_added when the user actually changed it.
  const origDateYear = isNaN(addedDate.getTime()) ? '' : String(addedDate.getFullYear())
  const origDateMonth = isNaN(addedDate.getTime()) || yearOnly ? '' : String(addedDate.getMonth() + 1)
  // Region/country of origin — pulled from Wikidata on auto-fill, not hand-edited.
  // Held in state so a Save persists what the fill resolved.
  const [countriesEdit, setCountriesEdit] = useState<string[]>(
    Array.isArray(item.metadata?.countries) ? (item.metadata.countries as string[]) : []
  )
  const [genrePickerOpen, setGenrePickerOpen] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [autoFillInfo, setAutoFillInfo] = useState<AutoFillInfo | null>(null)
  // After identify, the AI's other candidates so the user can correct a wrong
  // match by populating the edit fields. null = panel hidden.
  const [picks, setPicks] = useState<Candidate[] | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Two-step confirm for the rare "actually a thing → board" misroute fix, which
  // now lives at the bottom of the edit view (mirrors the Things "actually media").
  const [flipConfirm, setFlipConfirm] = useState(false)
  // The ⋯ admin menu over the hero — holds edit / own / status / delete, so
  // the read view stays calm (mirrors the Things product card).
  const [menuOpen, setMenuOpen] = useState(false)
  const [inboxDoneMode, setInboxDoneMode] = useState(false)
  const [showBlurb, setShowBlurb] = useState(false)
  const [reactionTagsOpen, setReactionTagsOpen] = useState(true)
  const [editOpenGroups, setEditOpenGroups] = useState<Record<string, boolean>>({})
  const [seasons, setSeasons] = useState<Season[]>(() => getSeasons(item.metadata))
  const [watchOpen, setWatchOpen] = useState(false)
  // In tidy mode, which fields are genuinely missing (respects dismissedGaps)
  const tidyGaps = tidyPosition ? new Set(itemGaps(item)) : new Set<string>()
  const [moreOpen, setMoreOpen] = useState(() =>
    !!(tidyPosition && itemGaps(item).some(g => ['runtime', 'pages', 'wiki'].includes(g)))
  )
  const refLinkInputRef = useRef<HTMLInputElement>(null)
  const color = typeColor(item.type)
  // Row style for the ⋯ dropdown — same quiet menu language as the Things card.
  const menuItem = (c: string = '#1C1B19', weight: number = 400): React.CSSProperties => ({
    border: 'none', background: 'none', textAlign: 'left', width: '100%', padding: '9px 10px',
    borderRadius: 8, fontSize: 13, color: c, fontWeight: weight, cursor: 'pointer', fontFamily: 'inherit',
  })

  const hasWikiLink = wikiUrlEdit.includes('wikipedia.org')

  // Persist the season checklist (kept in local state for instant feedback).
  function updateSeasons(next: Season[]) {
    setSeasons(next)
    onSetSeasons(next)
  }
  const toggleSeason = (n: number) =>
    updateSeasons(seasons.map(s => (s.n === n ? { ...s, done: !s.done } : s)))
  const addSeason = () =>
    updateSeasons([...seasons, { n: (seasons[seasons.length - 1]?.n ?? 0) + 1, done: false }])
  const removeLastSeason = () => updateSeasons(seasons.slice(0, -1))

  // Auto-fill the season count from TVmaze when a TV show has none yet (display only;
  // it persists once a season is ticked).
  const autoCount = useSeasonCount(item.title, item.type === 'tv' && seasons.length === 0)
  useEffect(() => {
    if (item.type === 'tv' && seasons.length === 0 && autoCount && autoCount > 0) {
      setSeasons(Array.from({ length: autoCount }, (_, i) => ({ n: i + 1, done: false })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCount])

  // On card open, fill genres and/or vibes if the item is missing them.
  // Only fires when data is absent — once written to DB, subsequent opens skip.
  // Genres: item has no genre tags. Vibes: no confirmed moods + no unconfirmedVibes.
  useEffect(() => {
    if (item.metadata?.scratch) return
    const FILL_TYPES = ['film', 'tv', 'book', 'music']
    if (!FILL_TYPES.includes(item.type)) return
    let cancelled = false
    const missingGenres = !(item.tags ?? []).some(isGenreTag)
    const missingVibes = !(item.moods ?? []).length && !(item.metadata?.unconfirmedVibes as string[] | undefined)?.length
    if (!missingGenres && !missingVibes) return
    authHeaders().then(async h => {
      if (cancelled) return
      if (missingGenres) {
        try {
          const r = await window.fetch('/api/genres', {
            method: 'POST', headers: h,
            body: JSON.stringify({ title: item.title, creator: item.creator, type: item.type }),
          })
          if (r.ok && !cancelled) {
            const d = await r.json() as { tags?: string[] }
            const newGenres = Array.isArray(d.tags) ? d.tags : []
            if (newGenres.length) {
              const descriptors = (item.tags ?? []).filter(t => !isGenreTag(t))
              onPatchTags([...newGenres, ...descriptors])
            }
          }
        } catch { /* leave untagged */ }
      }
      if (missingVibes && !cancelled) {
        try {
          const r = await window.fetch('/api/vibes', {
            method: 'POST', headers: h,
            body: JSON.stringify({ title: item.title, creator: item.creator, type: item.type, year: item.year }),
          })
          if (r.ok && !cancelled) {
            const d = await r.json() as { suggestions?: string[] }
            const vibes = Array.isArray(d.suggestions) ? d.suggestions : []
            if (vibes.length) onPatchMetadata({ unconfirmedVibes: vibes })
          }
        } catch { /* leave without vibes */ }
      }
    }).catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  // Wikipedia article link (null if no page exists / type not linked).
  // Music resolves a page (for the cover) but keeps Spotify as its button.
  // A hand-set article URL is the source of truth — resolve its summary +
  // thumbnail from that exact page, NOT the title search (which is what linked
  // the wrong article in the first place, e.g. P&P → "P&P and Zombies"). A
  // cached summary in metadata skips the fetch; only when no article is pinned
  // do we fall back to searching by title/creator/year.
  const savedWikiUrl = (item.metadata?.wikiUrl as string | undefined) || null
  const savedWikiThumb = (item.metadata?.wikiThumb as string | undefined) ?? null
  const savedWikiSummary = (item.metadata?.wikiSummary as string | undefined) ?? null
  const byUrl = useWikiByUrl(
    savedWikiUrl,
    savedWikiUrl ? { url: savedWikiUrl, thumbnail: savedWikiThumb, summary: savedWikiSummary } : null,
  )
  // Title search — the fallback. A truthy seed url makes it a no-op (no wasted
  // request) whenever an article is already pinned.
  const searched = useWikipediaInfo(
    item.type, item.title, item.creator, item.year,
    savedWikiUrl ? { url: savedWikiUrl, thumbnail: null, summary: null } : null,
  )
  const resolved = savedWikiUrl ? byUrl : searched
  const summary = resolved?.summary ?? null
  const wikiThumb = resolved?.thumbnail ?? null
  const wikiUrl = item.type === 'music' ? null : (resolved?.url ?? savedWikiUrl)
  // Persist resolved wiki data so itemGaps() stops flagging wiki as missing and
  // future opens skip the fetch. Two cases: a search found an article we hadn't
  // saved, or a pinned URL just resolved the summary/thumb that metadata lacked.
  const wikiSavedRef = useRef(false)
  useEffect(() => {
    if (item.type === 'music' || wikiSavedRef.current) return
    if (!savedWikiUrl && resolved?.url) {
      wikiSavedRef.current = true
      onPatchMetadata?.({ wikiUrl: resolved.url, wikiThumb: resolved.thumbnail ?? null, wikiSummary: resolved.summary ?? null })
    } else if (savedWikiUrl && resolved?.summary && (!savedWikiSummary || isStaleSummary(savedWikiSummary))) {
      // Missing summary, or a stale pre-`exintro` blurb — persist the clean one.
      wikiSavedRef.current = true
      onPatchMetadata?.({ wikiThumb: resolved.thumbnail ?? null, wikiSummary: resolved.summary })
    }
  }, [resolved?.url, resolved?.summary]) // eslint-disable-line react-hooks/exhaustive-deps
  const artwork = useArtwork(item.type, item.title, item.creator, item.year, coverUrl || null)
  const cover = artwork ?? wikiThumb
  // For books with no Wikipedia summary, fall back to an Open Library / Apple Books blurb.
  const bookBlurb = useBookBlurb(item.title, item.creator, item.year, item.type === 'book' && !summary)
  // Priority: manual blurb (you wrote it) > recommendation blurb (from list) >
  // captured blurb (from photo) > wiki > book
  const manualBlurb = item.metadata?.manualBlurb as string | undefined
  const recBlurb = item.metadata?.recommendationBlurb as string | undefined
  const capturedBlurb = item.metadata?.capturedBlurb as string | undefined
  const blurb = manualBlurb ?? recBlurb ?? capturedBlurb ?? summary ?? bookBlurb.summary
  // For discover items, use discoverSource (e.g. "George Saunders") as the blurb
  // attribution rather than falling back to the generic "recommendation" label.
  const discoverSource = item.metadata?.discoverSource as string | undefined
  const blurbSource = manualBlurb
    ? null
    : recBlurb
    ? (discoverSource ?? item.recommended_by ?? 'recommendation')
    : capturedBlurb ? null
    : summary ? 'Wikipedia'
    : bookBlurb.source

  // Spotify URL for music items. Synced albums link directly; others fall back to search.
  const spotifyUrl = item.type === 'music'
    ? ((item.metadata?.spotifyUrl as string | undefined)
        ?? (item.metadata?.spotifyId ? `https://open.spotify.com/album/${item.metadata.spotifyId}` : null)
        ?? `https://open.spotify.com/search/${encodeURIComponent([item.title, item.creator].filter(Boolean).join(' '))}`)
    : null

  function persistEditFields() {
    const newTitle   = title.trim() || item.title
    const newCreator = creator.trim() || null
    const newYear    = year ? parseInt(year) : null
    clearArtworkCache(item.type, item.title, item.creator, item.year)
    clearArtworkCache(type, newTitle, newCreator, newYear)
    clearBlurbCache(item.title, item.creator, item.year)
    clearBlurbCache(newTitle, newCreator, newYear)
    const metadata: Record<string, unknown> = { ...item.metadata, coverUrl: coverUrl.trim() || null }
    delete metadata.scratch  // clear scratch flag when user confirms the identity
    if (series.trim()) metadata.series = series.trim()
    else delete metadata.series
    // Only store as a manual blurb if she actually wrote/edited it (or it was
    // already manual). If the box still holds the echoed recommendation/captured/
    // wiki blurb untouched, leave it alone so the original "via [source]"
    // attribution is preserved.
    const bt = blurbText.trim()
    const hadManual = typeof item.metadata?.manualBlurb === 'string'
    if (!bt) delete metadata.manualBlurb
    else if (hadManual || bt !== nonManualBlurb.trim()) metadata.manualBlurb = bt
    else delete metadata.manualBlurb
    // Wiki URL — save directly; display hook re-fetches thumb/summary on next render.
    if (wikiUrlEdit.trim()) metadata.wikiUrl = wikiUrlEdit.trim()
    else delete metadata.wikiUrl
    // Clear cached wiki data when URL changes so it re-fetches.
    if (wikiUrlEdit.trim() !== String((item.metadata?.wikiUrl as string | null) ?? '')) {
      delete metadata.wikiThumb
      delete metadata.wikiSummary
    }
    // Runtime / pages — save as numbers.
    const rt = parseInt(runtimeEdit)
    if (!isNaN(rt) && rt > 0) metadata.runtime = rt
    else if (!runtimeEdit.trim()) delete metadata.runtime
    const pg = parseInt(pagesEdit)
    if (!isNaN(pg) && pg > 0) metadata.pages = pg
    else if (!pagesEdit.trim()) delete metadata.pages
    // Region — store the resolved country list (stamped with the current
    // resolver version so the backfill treats it as up-to-date).
    if (countriesEdit.length) { metadata.countries = countriesEdit; metadata.regionV = REGION_VERSION }
    else { delete metadata.countries; delete metadata.regionV }
    // Saving the edit view CONFIRMS any provisional AI vibes — they move into
    // moods (below), so drop the unconfirmed list.
    delete metadata.unconfirmedVibes
    // Editable "added" date. Only rewrite when the user actually changed year or
    // month — a stamp on every save would freeze recency for normal items. A
    // manual date is mid-month (or mid-year when month is blank) so it sorts
    // cleanly, and flags dateAddedManual so recencyDate honours it even for done
    // items (which otherwise sort by their finish date).
    let newDateAdded: string | undefined
    const changedDate = dateYear !== origDateYear || dateMonth !== origDateMonth
    const y = parseInt(dateYear)
    if (changedDate && !isNaN(y) && y > 1000) {
      const m = dateMonth ? parseInt(dateMonth) : null
      newDateAdded = new Date(Date.UTC(y, m ? m - 1 : 5, 15, 12)).toISOString()
      metadata.dateAddedManual = true
      if (m) delete metadata.dateAddedPrecision
      else metadata.dateAddedPrecision = 'year'
    }
    // Type can change here (type chips are authoritative). Drop genres + vibes
    // that don't belong to the chosen type's vocab so a film→book switch doesn't
    // carry over film-only tags.
    const validVibes = vibesForType(type)
    const tags  = editTags.filter(t => !isGenreTag(t) || genresForType(type).includes(t))
    const moods = editMoods.filter(m => VERDICTS.includes(m) || validVibes.includes(m))
    onEdit({
      title: newTitle,
      creator: newCreator,
      type,
      year: newYear,
      tags,
      moods,
      source_detail: sourceDetail.trim() || null,
      metadata,
      ...(newDateAdded ? { date_added: newDateAdded } : {}),
    })
  }

  function handleSaveDetails() {
    persistEditFields()
    onClose()
  }

  // Tidy-queue: save the current item, then advance to the next gappy one.
  function handleSaveNext() {
    persistEditFields()
    onSaveNext?.()
  }

  // One merged "auto-fill" action. With a Wikipedia link → pull structured facts
  // from Wikidata (fills empty fields only). Without one → AI identify (replaces
  // fields). forceIdentify routes around a wrong stored article.
  async function handleAutoFill(forceIdentify = false) {
    if (autoFilling) return
    if (hasWikiLink && !forceIdentify) await fillFromWiki()
    else await identifyIntoEdit()
  }

  // Fetch + parse fields from the stored Wikipedia URL via Wikidata claims.
  // Only pre-fills fields that are currently empty (never overwrites).
  async function fillFromWiki() {
    if (!wikiUrlEdit.trim()) return
    setAutoFilling(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(
        `/api/wiki?url=${encodeURIComponent(wikiUrlEdit.trim())}&type=${encodeURIComponent(type)}&parse=1`,
        { headers }
      )
      if (!res.ok) return
      const data = await res.json() as { parsed?: { year?: number | null; creator?: string | null; runtime?: number | null; pages?: number | null; genres?: string[]; countries?: string[] } | null }
      const p = data.parsed
      if (!p) { setAutoFillInfo({ article: wikiArticleName(wikiUrlEdit), filled: [], viaWiki: true }); return }
      const filled: string[] = []
      if (p.year && !year) { setYear(String(p.year)); filled.push('year') }
      if (p.creator && !creator.trim()) { setCreator(p.creator); filled.push('creator') }
      if (p.runtime && !runtimeEdit) { setRuntimeEdit(String(p.runtime)); filled.push('runtime') }
      if (p.pages && !pagesEdit) { setPagesEdit(String(p.pages)); filled.push('pages') }
      if (p.countries?.length && !countriesEdit.length) { setCountriesEdit(p.countries); filled.push('region') }
      // Genre: only if none set yet. The wiki parse is unreliable for genre, so
      // ask /api/genres (infers from the model's knowledge); fall back to the
      // wiki-parse genres if that returns none.
      if (!editTags.some(isGenreTag)) {
        let genres = p.genres ?? []
        try {
          const gr = await fetch('/api/genres', {
            method: 'POST', headers,
            body: JSON.stringify({ title: title.trim() || item.title, creator: creator.trim() || item.creator, type }),
          })
          const gd = await gr.json() as { tags?: string[] }
          if (Array.isArray(gd.tags) && gd.tags.length) genres = gd.tags
        } catch { /* keep wiki-parse genres */ }
        if (genres.length) {
          const descriptors = editTags.filter(t => !isGenreTag(t))
          setEditTags([...genres, ...descriptors])
          filled.push('genre')
        }
      }
      setAutoFillInfo({ article: wikiArticleName(wikiUrlEdit), filled, viaWiki: true })
    } finally {
      setAutoFilling(false)
    }
  }

  // AI identify into the edit fields (replaces title/creator/type/year/runtime/
  // genre). Used when there's no wiki link, or to override a wrong article.
  async function identifyIntoEdit() {
    setAutoFilling(true)
    try {
      const currentTitle = title.trim() || item.title
      const currentYear  = year ? parseInt(year) : item.year
      const inputStr = currentYear ? `${currentTitle} (${currentYear})` : currentTitle
      const res = await fetch('/api/identify', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ input: inputStr, typeHint: type }),
      })
      const r = await res.json()
      const filled: string[] = []
      if (r.title) setTitle(r.title)
      if (r.creator) { setCreator(r.creator); filled.push('creator') }
      // Never downgrade a known type to "other" — "other" means Sonnet couldn't identify it,
      // not that the type actually changed. Only update if the new type is a real known type.
      if (r.type && r.type !== 'other') setType(r.type)
      if (r.year) { setYear(String(r.year)); filled.push('year') }
      if (r.metadata?.runtime) { setRuntimeEdit(String(r.metadata.runtime)); filled.push('runtime') }
      if (r.metadata?.pages) { setPagesEdit(String(r.metadata.pages)); filled.push('pages') }
      if (Array.isArray(r.tags) && r.tags.length && !editTags.some(isGenreTag)) {
        const descriptors = editTags.filter(t => !isGenreTag(t))
        setEditTags([...r.tags, ...descriptors])
        filled.push('genre')
      }
      setAutoFillInfo({ article: r.title || currentTitle, filled, viaWiki: false })
      const alts: Candidate[] = (Array.isArray(r.alternatives) ? r.alternatives : [])
        .filter((a: Candidate) => a?.title && a.title.toLowerCase() !== (r.title || '').toLowerCase())
        .map((a: Candidate) => ({ title: a.title, creator: a.creator ?? null, year: a.year ?? null, metadata: a.metadata, tags: a.tags }))
      setPicks(alts) // [] still opens the panel so "look it up online" is reachable
    } catch {
      // ignore — fields stay as-is
    } finally {
      setAutoFilling(false)
    }
  }

  // Populate the edit fields from a chosen alternative (no auto-save — the user
  // still reviews + saves). Type stays under the type chips' control.
  function populateFromCandidate(c: Candidate) {
    if (c.title) setTitle(c.title)
    if (c.creator) setCreator(c.creator)
    if (c.year != null) setYear(String(c.year))
    if (c.metadata?.runtime) setRuntimeEdit(String(c.metadata.runtime))
    if (c.metadata?.pages) setPagesEdit(String(c.metadata.pages))
    setPicks(null)
  }

  // Search real catalogs (iTunes / TMDB / Open Library) for more matches to choose from.
  async function lookUpOnline() {
    if (lookingUp) return
    setLookingUp(true)
    try {
      const q = year ? `${title.trim() || item.title} (${year})` : (title.trim() || item.title)
      const res = await fetch(`/api/lookup?q=${encodeURIComponent(q)}`, { headers: await authHeaders() })
      const data = await res.json()
      const more: Candidate[] = (data.results ?? [])
        .filter((r: Candidate) => r?.title)
        .map((r: Candidate) => ({ title: r.title, creator: r.creator ?? null, year: r.year ?? null, metadata: r.metadata, tags: r.tags }))
      setPicks(prev => {
        const base = prev ?? []
        const seen = new Set(base.map(p => p.title.toLowerCase()))
        return [...base, ...more.filter(m => !seen.has(m.title.toLowerCase()))]
      })
    } catch {
      /* ignore — leave list as-is */
    } finally {
      setLookingUp(false)
    }
  }

  function handleSaveReaction() {
    if (item.status === 'done') {
      // Already done: persist the verdict + note + tags as-is.
      onEditReaction(reaction, note, selectedMoods)
    } else if (reaction) {
      // Verdict picked on a not-yet-done item: mark it done.
      onMarkDone(reaction, note, selectedMoods)
    } else {
      // Note-only (no verdict): save the note/tags without flipping status to done.
      onEditReaction(null, note, selectedMoods)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '10px 20px 0', zIndex: 201,
        maxWidth: 480, margin: '0 auto',
        // overflowX must be explicit: a vertical `auto` promotes the unset
        // horizontal axis to `auto` too, so any slightly-wide child (a long vibe
        // row, an unbreakable word) made the whole sheet scroll sideways.
        maxHeight: '96dvh', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch',
      }}>
        {view === 'main' && (
          <>
            {/* Item preview — shared editorial hero (ghost wash + crisp poster). The ⋯
                in the corner holds all admin (edit / own / status / delete); the
                row below is outward links only, so nothing boring crowds the title. */}
            <SheetHero
              type={item.type}
              title={item.title}
              cover={cover}
              onClose={onClose}
              menuButton={!item.metadata?.scratch ? (
                <button onClick={() => setMenuOpen(o => !o)} aria-label="more"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6F6B64', fontSize: 20, fontWeight: 700, lineHeight: 1, padding: '0 0 4px', transform: 'translateY(1px)' }}>⋯</button>
              ) : undefined}
              meta={[
                // Identity only — type · creator · year · runtime (+ series). The
                // reaction lives on the footer button, so it's dropped here to keep
                // the meta line about what the thing IS, not its status.
                [TYPE_COLORS[item.type]?.label ?? item.type, item.creator, item.year, formatRuntime(item)].filter(Boolean).join(' · '),
                typeof item.metadata?.series === 'string' && item.metadata.series.trim() ? `↳ ${item.metadata.series}` : null,
              ].filter(Boolean).join(' · ')}
            >
              {/* Outward links only — about/via · spotify · wikipedia · watch. Admin
                  (edit / own) moved into the ⋯ menu. */}
              {!item.metadata?.scratch && (blurb || spotifyUrl || wikiUrl || item.type === 'film' || item.type === 'tv') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {blurb && (
                    <button onClick={() => setShowBlurb(v => !v)} className="tlink" style={{ flexShrink: 0 }}>
                      <span>{blurbSource && blurbSource !== 'Wikipedia' ? `via ${blurbSource.length > 20 ? blurbSource.slice(0, 19) + '…' : blurbSource}` : 'about this'}</span>
                      <span style={{ fontSize: 10 }}>{showBlurb ? '▴' : '▾'}</span>
                    </button>
                  )}
                  {spotifyUrl && (
                    <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" className="tlink" style={{ flexShrink: 0 }}>
                      <SpotifyIcon /> spotify
                    </a>
                  )}
                  {wikiUrl && (
                    <a href={wikiUrl} target="_blank" rel="noopener noreferrer" className="tlink" style={{ flexShrink: 0 }}>
                      {`${refLinkLabel(wikiUrl)} ↗︎`}
                    </a>
                  )}
                  {(item.type === 'film' || item.type === 'tv') && (
                    <button onClick={() => setWatchOpen(true)} className="tlink" style={{ flexShrink: 0 }}>▶︎ watch</button>
                  )}
                </div>
              )}
            </SheetHero>

            {/* ⋯ dropdown — rendered OUTSIDE the hero (which clips its children),
                anchored to the fixed sheet. Holds every admin action + delete. */}
            {menuOpen && !item.metadata?.scratch && (
              <>
                <div onClick={() => { setMenuOpen(false); setConfirmDelete(false) }} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                <div style={{ position: 'absolute', top: 46, right: 16, zIndex: 10, width: 220, background: '#fff',
                  borderRadius: 12, border: '1px solid #E8E8E8', boxShadow: '0 8px 28px rgba(0,0,0,0.16)', padding: 6, display: 'flex', flexDirection: 'column' }}>
                  {confirmDelete ? (
                    <>
                      <div style={{ fontSize: 12.5, color: '#ABA69C', padding: '8px 10px 6px', lineHeight: 1.4 }}>delete “{item.title}”? this can’t be undone.</div>
                      <button style={menuItem('#C0392B', 600)} onClick={onDelete}>delete</button>
                      <button style={menuItem()} onClick={() => setConfirmDelete(false)}>cancel</button>
                    </>
                  ) : (
                    <>
                      <button style={menuItem()} onClick={() => { setMenuOpen(false); setEditOpenGroups({}); setView('edit') }}>edit details</button>
                      <button style={menuItem()} onClick={() => { setMenuOpen(false); onToggleOwned(!item.metadata?.owned) }}>
                        {item.type === 'book'
                          ? (item.metadata?.owned ? 'on my shelf ✓' : 'mark on my shelf')
                          : (item.metadata?.owned ? 'own it ✓' : 'mark as owned')}
                      </button>
                      {item.status === 'want_to' && onMarkInProgress && (
                        <button style={menuItem()} onClick={onMarkInProgress}>mark as in progress</button>
                      )}
                      {item.status === 'in_progress' && onMarkWantTo && (
                        <button style={menuItem()} onClick={onMarkWantTo}>move back to want to</button>
                      )}
                      <div style={{ height: 1, background: '#E8E8E8', margin: '5px 8px' }} />
                      <button style={menuItem('#C0392B')} onClick={() => setConfirmDelete(true)}>delete</button>
                    </>
                  )}
                </div>
              </>
            )}
            <div style={{ height: 4 }} />

            {/* Blurb expansion — below the flat link row */}
            {showBlurb && blurb && (
              <div style={{ fontSize: 12, color: '#999', lineHeight: 1.5, marginBottom: 14, fontStyle: 'italic' }}>
                {blurb}{' '}
                {(item.metadata?.recommendationUrl as string | undefined) && (
                  <a
                    href={item.metadata?.recommendationUrl as string}
                    target="_blank"
                    rel="noreferrer"
                    className="tlink"
                    style={{ fontStyle: 'normal', whiteSpace: 'nowrap', display: 'inline' }}
                  >
                    {'see source ↗︎'}
                  </a>
                )}
              </div>
            )}

            {onKeep && inReview(item) && (
              <div style={{ marginBottom: 16, border: '1px solid #ECEAE6', borderRadius: 10, padding: '10px 12px', background: '#FAFAFA' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#777', marginBottom: 8 }}>in your review inbox — file it</div>
                {inboxDoneMode ? (
                  <div>
                    <div style={{ fontSize: 11, color: '#AAA', marginBottom: 6 }}>how was it?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {REACTIONS.map(r => (
                        <button
                          key={r.value}
                          onClick={() => onKeep(r.value)}
                          style={{ padding: '5px 11px', borderRadius: 6, border: '1px solid #DDD', background: '#fff', color: '#1C1B19', fontSize: 12, cursor: 'pointer' }}
                        >
                          {r.label}
                        </button>
                      ))}
                      <button
                        onClick={() => setInboxDoneMode(false)}
                        style={{ padding: '5px 11px', borderRadius: 6, border: 'none', background: 'none', color: '#AAA', fontSize: 12, cursor: 'pointer' }}
                      >
                        ← back
                      </button>
                    </div>
                  </div>
                ) : confirmDelete && !item.metadata?.scratch ? (
                  // Inline discard confirm. The ⋯-menu confirm (and the scratch
                  // footer confirm) don't render here, so the review inbox needs
                  // its own — otherwise "discard" flips a flag nothing is showing.
                  <div>
                    <div style={{ fontSize: 11.5, color: '#C0392B', marginBottom: 8, lineHeight: 1.4 }}>
                      discard “{item.title}”? this can’t be undone.
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        style={{ padding: '5px 11px', borderRadius: 6, border: '1px solid #DDD', background: '#fff', color: '#1C1B19', fontSize: 12, cursor: 'pointer' }}
                      >
                        cancel
                      </button>
                      <button
                        onClick={onDelete}
                        style={{ padding: '5px 11px', borderRadius: 6, border: 'none', background: '#C0392B', color: '#fff', fontSize: 12, cursor: 'pointer' }}
                      >
                        discard
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button
                      onClick={() => onKeep()}
                      style={{ padding: '5px 11px', borderRadius: 6, border: '1px solid #DDD', background: '#fff', color: '#1C1B19', fontSize: 12, cursor: 'pointer' }}
                    >
                      want to
                    </button>
                    <button
                      onClick={() => setInboxDoneMode(true)}
                      style={{ padding: '5px 11px', borderRadius: 6, border: '1px solid #DDD', background: '#fff', color: '#1C1B19', fontSize: 12, cursor: 'pointer' }}
                    >
                      mark as done
                    </button>
                    <button
                      onClick={() => setConfirmDelete(true)}
                      style={{ padding: '5px 11px', borderRadius: 6, border: '1px solid #EABCB8', background: '#fff', color: '#C0392B', fontSize: 12, cursor: 'pointer' }}
                    >
                      discard
                    </button>
                  </div>
                )}
              </div>
            )}

            {item.type === 'tv' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#444', marginBottom: 8 }}>
                  seasons
                  {seasons.length > 0 && (
                    <span style={{ fontWeight: 400, color: '#999' }}>
                      {`  ·  ${seasons.filter(s => s.done).length}/${seasons.length} watched`}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {seasons.map(s => (
                    <button
                      key={s.n}
                      onClick={() => toggleSeason(s.n)}
                      style={{
                        padding: '6px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                        minWidth: 44, textAlign: 'center',
                        border: s.done ? `1.5px solid ${color.border}` : '1.5px solid #E0E0E0',
                        background: s.done ? color.bg : '#fff',
                        color: s.done ? color.border : '#555',
                        fontWeight: s.done ? 600 : 400,
                      }}
                    >
                      {s.done ? '✓ ' : ''}S{s.n}
                    </button>
                  ))}
                  <button
                    onClick={addSeason}
                    style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1.5px dashed #CCC', background: '#fff', color: '#777', cursor: 'pointer' }}
                  >
                    + season
                  </button>
                  {seasons.length > 0 && (
                    <button
                      onClick={removeLastSeason}
                      title="Remove last season"
                      style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1.5px solid #EED', background: '#fff', color: '#C0392B', cursor: 'pointer' }}
                    >
                      −
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Scratch prompt — shown instead of normal content for unidentified items */}
            {item.metadata?.scratch && (
              <div style={{ background: '#F7F7F7', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#AAA', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 6 }}>description saved</div>
                <div style={{ fontSize: 13, color: '#444', lineHeight: 1.5, fontStyle: 'italic' }}>{item.title}</div>
              </div>
            )}

            {/* Labelled tag lines — genre / vibe / verdict, each with a small intro
                label. Read-only here; editing all lives in the edit view. */}
            {!item.metadata?.scratch && (() => {
              const activeGenres = [...new Set((item.tags ?? []).filter(isGenreTag))]
              const feel = (item.moods ?? []).filter(m => VIBES.includes(m))
              const verdicts = item.status === 'done' ? (item.moods ?? []).filter(m => VERDICTS.includes(m)) : []
              const isCanon = item.status === 'done' && canon
              if (!activeGenres.length && !feel.length && !verdicts.length && !unconfirmedVibes.length && !isCanon) return null

              // flexWrap so a long line (e.g. many vibes) wraps onto multiple
              // lines instead of overflowing. The terms are dot-separated with no
              // whitespace between them, so an inline layout has no break
              // opportunity and can't wrap — flex items can. The middot TRAILS each
              // term (bundled with the term before it) so the separator stays at the
              // end of a line and a wrapped line never begins with a dot.
              const tagLine = (group: 'genre' | 'vibe' | 'verdict', terms: string[], muted: string[] = []) => {
                const all = [...terms.map(t => ({ t, muted: false })), ...muted.map(t => ({ t, muted: true }))]
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', fontSize: 13, lineHeight: 1.7, color: '#1C1B19' }}>
                    {all.map((tag, i) => {
                      // Tappable only when the Library wired a filter handler AND more than
                      // one item of this medium shares the tag (else it's a dead-end of one).
                      const tappable = !!onFilterTag && (countWithTag?.(group, tag.t) ?? 0) > 1
                      return (
                        <span key={(tag.muted ? 'm' : '') + tag.t} style={{ display: 'inline-flex', alignItems: 'baseline' }}>
                          {tappable ? (
                            <button onClick={() => onFilterTag!(group, tag.t)} style={{
                              border: 'none', background: 'none', padding: 0, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
                              color: tag.muted ? '#ABA69C' : '#1C1B19',
                              textDecoration: 'underline', textDecorationColor: '#D7D3CC', textUnderlineOffset: 3,
                            }}>{tag.t}</button>
                          ) : (
                            <span style={{ color: tag.muted ? '#ABA69C' : undefined }}>{tag.t}</span>
                          )}
                          {i < all.length - 1 && <span style={{ color: '#ABA69C', margin: '0 7px' }}>·</span>}
                        </span>
                      )
                    })}
                  </div>
                )
              }
              const row = (label: string, content: React.ReactNode) => (
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={tagLabelStyle}>{label}</span>
                  <div style={{ minWidth: 0 }}>{content}</div>
                </div>
              )
              return (
                <div style={{ marginBottom: 14 }}>
                  {activeGenres.length > 0 && row('genre', tagLine('genre', activeGenres))}
                  {(feel.length > 0 || unconfirmedVibes.length > 0) && row('vibe', tagLine('vibe', feel, unconfirmedVibes))}
                  {/* Desert island is the top rung — elevated, not a soft-token chip.
                      Given the same label-column treatment as genre/vibe/verdict (s94 fix:
                      it used to sit flush-left with no label and broke the grid). */}
                  {isCanon && row('★', <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1B19', letterSpacing: '0.01em' }}>desert island</span>)}
                  {/* Verdict is optional now — a highlighter for the special ones, not
                      a slot to fill. Shown only when set; an empty verdict reads as
                      finished, not unfinished (s93 reshape). */}
                  {verdicts.length > 0 && row('verdict', tagLine('verdict', verdicts))}
                </div>
              )
            })()}

            {item.note && (
              <div style={{ marginBottom: 16 }}>
                {/* Its own "your voice" block — the note sits under a header (not in
                    the genre/vibe/verdict label column), so it still reads as your
                    reflection. But the header is quietened to match those tag labels
                    (10px muted, no full-width divider): the old bold header + hairline
                    outweighed a short note and cut the card heavier than the rows
                    above it. Deliberately diverges from the Things note block. */}
                <div style={{ fontSize: 10, fontWeight: 600, color: '#ABA69C', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 7 }}>
                  thoughts
                </div>
                <NoteProse>{renderNote(item.note)}</NoteProse>
              </div>
            )}

            {item.metadata?.scratch ? (
              // Un-identified capture: still a normal item — you can react / note it
              // now and identify it whenever. "identify now" is the primary nudge.
              // Scratch items have no ⋯ menu, so delete + its confirm stay inline here.
              confirmDelete ? (
                <div style={footer}>
                  <p style={{ fontSize: 13, color: '#C0392B', textAlign: 'center', marginBottom: 10 }}>
                    delete "{item.title}"? this cannot be undone.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setConfirmDelete(false)} style={{ ...actionBtn('#333'), flex: 1 }}>cancel</button>
                    <button onClick={onDelete} style={{ ...actionBtn('#fff'), flex: 1, background: '#C0392B', border: 'none' }}>delete</button>
                  </div>
                </div>
              ) : (
                <div style={{ ...footer, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    onClick={async () => { setEditOpenGroups({}); setView('edit'); await identifyIntoEdit() }}
                    disabled={autoFilling}
                    style={{ ...actionBtn('#fff'), width: '100%', background: autoFilling ? '#CCC' : '#111', border: 'none' }}
                  >
                    {autoFilling ? 'identifying…' : 'identify now'}
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setView('reaction')} style={{ ...actionBtn('#333'), flex: 1 }}>
                      {item.status === 'want_to' ? 'mark as done' : 'edit reaction'}
                    </button>
                    <button onClick={() => setConfirmDelete(true)} style={{ ...actionBtn('#C0392B'), flex: 1 }}>delete</button>
                  </div>
                </div>
              )
            ) : (
              // One quiet primary: log / revisit how it landed. Everything else
              // (delete, own, status, flip) lives in the ⋯ menu over the hero. Warm
              // bordered row — left-aligned, with a trailing affordance — so it reads
              // as state+edit when done and as a real CTA when not yet logged.
              <div style={{ ...footer }}>
                <button onClick={() => setView('reaction')} style={{
                  width: '100%', padding: '11px 14px', border: '1px solid #E8E8E8', borderRadius: 10,
                  background: '#FBFAF8', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {item.status === 'done' ? (
                    <>
                      <span style={{ fontSize: 13, color: '#333' }}>your reaction · <b style={{ fontWeight: 600, color: '#1C1B19' }}>{item.reaction ? REACTION_LABELS[item.reaction] : 'set'}</b></span>
                      <span style={{ fontSize: 13, color: '#ABA69C' }}>edit →</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1B19' }}>mark as done</span>
                      <span style={{ fontSize: 13, color: '#ABA69C' }}>→</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {view === 'edit' && (() => {
          const vocab = genresForType(type)
          const descriptors = editTags.filter(t => !isGenreTag(t))
          const activeGenres = editTags.filter(t => isGenreTag(t))
          const inactiveGenres = vocab.filter(g => !activeGenres.includes(g))
          function toggleGenreEdit(g: string) {
            const next = new Set(activeGenres)
            next.has(g) ? next.delete(g) : next.add(g)
            setEditTags([...next, ...descriptors])
          }
          function toggleEditMood(m: string) {
            setEditMoods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
          }
          // Soft-token genre chip — matches the vibe/verdict chips (MoodChips sm).
          const chip = (label: string, on: boolean, fn: () => void) => (
            <button key={label} onClick={fn} style={{
              padding: '4px 11px', borderRadius: 8, fontSize: 11, cursor: 'pointer', flexShrink: 0,
              border: 'none',
              background: on ? '#E6E1D7' : '#F4F2EE', color: on ? '#1C1B19' : '#8A857C', fontWeight: on ? 500 : 400,
            }}>{label}</button>
          )
          return (
            <>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ ...sectionHeading, margin: 0 }}>
                  edit
                  <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: '#888', textTransform: 'none', letterSpacing: 0 }}>{item.title}</span>
                  {tidyPosition && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: '#ABA69C', textTransform: 'none', letterSpacing: 0 }}>
                      tidying · {tidyPosition.index + 1} of {tidyPosition.total}
                    </span>
                  )}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <button onClick={() => { setEditOpenGroups({}); setView('main') }} className="tlink">cancel</button>
                  <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BBBBBB', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
                </div>
              </div>

              {/* The one merged action: auto-fill from wikipedia, or AI identify. */}
              <button
                onClick={() => handleAutoFill()}
                disabled={autoFilling}
                style={{
                  width: '100%', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start',
                  border: '1.5px solid #1C1B19', borderRadius: 10, background: '#fff',
                  padding: '10px 12px', cursor: autoFilling ? 'default' : 'pointer', marginBottom: 14, fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1B19' }}>
                  {autoFilling ? '⟳ working…' : hasWikiLink ? '⟳ auto-fill from wikipedia' : '⟳ identify with ai'}
                </span>
                <span style={{ fontSize: 11, color: '#6F6B64', lineHeight: 1.4, textAlign: 'left' }}>
                  {hasWikiLink
                    ? "fills blanks from wikipedia's structured data."
                    : "ai identifies it and fills in the details. add a wikipedia link under 'more details' for exact facts."}
                </span>
              </button>

              {/* What auto-fill pulled + escape hatch for a wrong article */}
              {autoFillInfo && (
                <div style={{ fontSize: 11, color: '#6F6B64', background: '#F4F2EE', borderRadius: 8, padding: '9px 11px', lineHeight: 1.5, marginBottom: 14 }}>
                  {autoFillInfo.filled.length
                    ? <>filled <b>{autoFillInfo.filled.join(' · ')}</b> {autoFillInfo.viaWiki ? <>from "{autoFillInfo.article}"</> : 'with ai'}.</>
                    : <>nothing new to fill{autoFillInfo.viaWiki ? <> from "{autoFillInfo.article}"</> : ''}.</>}
                  {autoFillInfo.viaWiki && (
                    <div style={{ marginTop: 6 }}>
                      wrong article?{' '}
                      <button
                        onClick={() => handleAutoFill(true)}
                        className="tlink"
                        style={{ fontSize: 11 }}
                      >identify with ai →</button>
                      {' '}or{' '}
                      <button
                        onClick={() => {
                          setMoreOpen(true)
                          // Focus the url field after the section opens
                          setTimeout(() => refLinkInputRef.current?.focus(), 50)
                        }}
                        className="tlink"
                        style={{ fontSize: 11 }}
                      >paste a different wikipedia link ↓</button>
                    </div>
                  )}
                </div>
              )}

              {/* Alternatives after identify — populate fields, don't auto-save */}
              {picks !== null && (
                <div style={{ marginBottom: 14, border: '1px solid #EEE', borderRadius: 10, padding: '10px 12px', background: '#FAFAFA' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#777' }}>not the right one? pick a match</span>
                    <button onClick={() => setPicks(null)} style={{ background: 'none', border: 'none', color: '#AAA', fontSize: 11, cursor: 'pointer', padding: 0 }}>dismiss</button>
                  </div>
                  {picks.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => populateFromCandidate(c)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 11px', border: '1px solid #EEE', borderRadius: 8, background: '#fff', marginBottom: 6, cursor: 'pointer', fontSize: 13 }}
                    >
                      <strong>{c.title}</strong>
                      {[c.creator, c.year].filter(Boolean).length > 0 && (
                        <span style={{ color: '#888', fontSize: 11 }}> · {[c.creator, c.year].filter(Boolean).join(' · ')}</span>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={lookUpOnline}
                    disabled={lookingUp}
                    style={{ background: 'none', border: 'none', color: '#111', fontSize: 12, cursor: lookingUp ? 'default' : 'pointer', padding: 0, marginTop: 2 }}
                  >
                    {lookingUp ? 'searching…' : picks.length > 0 ? 'look up more online' : 'look it up online'}
                  </button>
                </div>
              )}

              {/* type chips + identity fields */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
                  {TYPES.map(t => {
                    const c = typeColor(t)
                    const active = type === t
                    return (
                      <button key={t} onClick={() => setType(t)} style={{
                        padding: '4px 10px', border: active ? `1.5px solid ${c.border}` : '1.5px solid #E0E0E0',
                        borderRadius: 4, background: active ? c.bg : '#fff', color: active ? c.border : '#888',
                        fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer',
                      }}>
                        {TYPE_COLORS[t]?.label ?? t}
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={smInput} />
                  <input value={creator} onChange={e => setCreator(e.target.value)} placeholder="Creator" style={{ ...smInput, ...(tidyGaps.has('creator') ? { borderColor: '#C44' } : {}) }} />
                  <input value={year} onChange={e => setYear(e.target.value)} placeholder="Year" type="number" style={{ ...smInput, ...(tidyGaps.has('year') ? { borderColor: '#C44' } : {}) }} />
                </div>
              </div>

              {/* tags — genre + vibe + verdict */}
              <div style={{ marginBottom: 18 }}>
                {vocab.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ ...fieldLabel, ...(tidyGaps.has('genre') ? { color: '#C44' } : {}) }}>genre</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                      {activeGenres.map(g => chip(g, true, () => toggleGenreEdit(g)))}
                      {!genrePickerOpen && (
                        <button onClick={() => setGenrePickerOpen(true)} style={{ padding: '4px 11px', borderRadius: 8, fontSize: 11, cursor: 'pointer', border: 'none', background: 'none', color: '#BDB8AF', flexShrink: 0 }}>+ add</button>
                      )}
                      {genrePickerOpen && inactiveGenres.map(g => chip(g, false, () => toggleGenreEdit(g)))}
                      {genrePickerOpen && (
                        <button onClick={() => setGenrePickerOpen(false)} style={{ padding: '4px 11px', borderRadius: 8, fontSize: 11, cursor: 'pointer', border: 'none', background: 'none', color: '#BDB8AF', flexShrink: 0 }}>done</button>
                      )}
                    </div>
                  </div>
                )}
                {/* vibe + verdict (how it landed). MoodChips renders both groups. */}
                {unconfirmedVibes.length > 0 && (
                  <div style={{ fontSize: 10, color: '#C9C6C0', marginBottom: 8, textTransform: 'none', letterSpacing: 0 }}>
                    vibes below are ai guesses — keep the ones that fit, saving confirms them.
                  </div>
                )}
                <MoodChips
                  key={Object.keys(editOpenGroups).join(',')}
                  type={type}
                  size="sm"
                  groups={item.status === 'done' ? 'all' : 'vibes-only'}
                  collapsible
                  initialOpen={editOpenGroups}
                  isActive={m => editMoods.includes(m)}
                  onToggle={toggleEditMood}
                />
              </div>

              {/* MORE DETAILS — reference link, series, cover, source, your blurb */}
              <div style={{ marginBottom: 14 }}>
                <button
                  onClick={() => setMoreOpen(v => !v)}
                  style={{ background: 'none', border: 'none', fontSize: 12, color: '#6F6B64', cursor: 'pointer', padding: 0, marginBottom: moreOpen ? 8 : 0 }}
                >
                  more details {moreOpen ? '▴' : '▾'}
                </button>
                {moreOpen && (
                  <div style={{ marginTop: 4 }}>
                    {(type === 'film' || type === 'tv') && (
                      <>
                        <div style={{ ...fieldLabel, ...(tidyGaps.has('runtime') ? { color: '#C44' } : {}) }}>runtime (min)</div>
                        <input value={runtimeEdit} onChange={e => setRuntimeEdit(e.target.value)} placeholder="runtime (min)" type="number" style={{ ...smInput, marginBottom: 10, ...(tidyGaps.has('runtime') ? { borderColor: '#C44' } : {}) }} />
                      </>
                    )}
                    {type === 'book' && (
                      <>
                        <div style={{ ...fieldLabel, ...(tidyGaps.has('pages') ? { color: '#C44' } : {}) }}>pages</div>
                        <input value={pagesEdit} onChange={e => setPagesEdit(e.target.value)} placeholder="pages" type="number" style={{ ...smInput, marginBottom: 10, ...(tidyGaps.has('pages') ? { borderColor: '#C44' } : {}) }} />
                      </>
                    )}
                    <div style={{ ...fieldLabel, ...(tidyGaps.has('wiki') ? { color: '#C44' } : {}) }}>reference link</div>
                    <input
                      ref={refLinkInputRef}
                      value={wikiUrlEdit}
                      onChange={e => { setWikiUrlEdit(e.target.value); setAutoFillInfo(null) }}
                      placeholder="reference url (wikipedia, goodreads…)"
                      style={{ ...smInput, marginBottom: 10, ...(tidyGaps.has('wiki') ? { borderColor: '#C44' } : {}) }}
                    />
                    {(type === 'film' || type === 'book' || type === 'tv') && (
                      <>
                        <div style={fieldLabel}>series</div>
                        {(seriesOptions ?? []).length > 0 ? (
                          <>
                            <select
                              value={seriesNewMode ? '__new__' : series}
                              onChange={e => {
                                if (e.target.value === '__new__') { setSeriesNewMode(true); setSeries('') }
                                else { setSeriesNewMode(false); setSeries(e.target.value) }
                              }}
                              style={{ ...smInput, marginBottom: seriesNewMode ? 6 : 10 }}
                            >
                              <option value="">— none —</option>
                              {(seriesOptions ?? []).map(s => <option key={s} value={s}>{s}</option>)}
                              <option value="__new__">+ new series…</option>
                            </select>
                            {seriesNewMode && (
                              <input
                                autoFocus
                                value={series}
                                onChange={e => setSeries(e.target.value)}
                                placeholder="series name"
                                style={{ ...smInput, marginBottom: 10 }}
                              />
                            )}
                          </>
                        ) : (
                          <input
                            value={series}
                            onChange={e => setSeries(e.target.value)}
                            placeholder="series name"
                            style={{ ...smInput, marginBottom: 10 }}
                          />
                        )}
                      </>
                    )}
                    <div style={fieldLabel}>cover image url</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
                      <input value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="cover url" style={{ ...smInput, flex: 1 }} />
                      {coverUrl.trim() && (
                        <img src={coverUrl.trim()} alt="" onError={e => (e.currentTarget.style.display = 'none')}
                          style={{ width: 30, height: 30, objectFit: 'cover', border: '1px solid #EEE', flexShrink: 0 }} />
                      )}
                    </div>
                    <div style={fieldLabel}>where it came from</div>
                    <input value={sourceDetail} onChange={e => setSourceDetail(e.target.value)} placeholder="source (e.g. a friend, NYT)" style={{ ...smInput, marginBottom: 10 }} />
                    <div style={fieldLabel}>added</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <select
                        value={dateMonth}
                        onChange={e => setDateMonth(e.target.value)}
                        style={{ ...smInput, flex: 1, marginBottom: 0 }}
                      >
                        <option value="">month — optional</option>
                        {['January','February','March','April','May','June','July','August','September','October','November','December']
                          .map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                      </select>
                      <input
                        value={dateYear}
                        onChange={e => setDateYear(e.target.value)}
                        placeholder="year"
                        type="number"
                        style={{ ...smInput, width: 84, marginBottom: 0 }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: '#9A968E', marginBottom: 10 }}>
                      backdate something you read long ago so it doesn’t top “recent”.
                    </div>
                    <div style={fieldLabel}>your description</div>
                    <textarea value={blurbText} onChange={e => setBlurbText(e.target.value)}
                      placeholder="about this — your own words" rows={2}
                      style={{ ...smInput, resize: 'none', lineHeight: 1.5 }} />
                  </div>
                )}
              </div>

              {/* Misroute fix — a rare cleanup for a screenshot/quick-add we filed as
                  media but that's really a thing. Lives here (not the ⋯ menu) as a
                  quiet, two-step link so it never competes with the read view. */}
              {onFlipToThing && (
                <div style={{ marginBottom: 16, paddingTop: 14, borderTop: '1px solid #ECEAE6' }}>
                  {flipConfirm ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, color: '#8A857C' }}>move to the board?</span>
                      <button onClick={onFlipToThing} style={{ border: 'none', background: 'none', color: '#1C1B19', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>move to board</button>
                      <button onClick={() => setFlipConfirm(false)} className="tlink">cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setFlipConfirm(true)} className="tlink">this is actually a thing, not media →</button>
                  )}
                </div>
              )}

              {/* Footer */}
              <div style={{ ...footer, display: 'flex', gap: 8 }}>
                {onSaveNext ? (
                  <>
                    <button onClick={onSkipNext} style={{ ...actionBtn('#333'), flex: 1 }}>skip ›</button>
                    <button onClick={handleSaveNext} style={{ ...actionBtn('#fff'), flex: 2, background: '#111111', border: 'none' }}>{tidyPosition && tidyPosition.index + 1 === tidyPosition.total ? 'save & finish' : 'save & next ›'}</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditOpenGroups({}); setView('main') }} style={{ ...actionBtn('#333'), flex: 1 }}>cancel</button>
                    <button onClick={handleSaveDetails} style={{ ...actionBtn('#fff'), flex: 1, background: '#111111', border: 'none' }}>save</button>
                  </>
                )}
              </div>
              {onDismissNext && (
                <div style={{ textAlign: 'center', paddingBottom: 8 }}>
                  <button onClick={onDismissNext} style={{ background: 'none', border: 'none', fontSize: 11, color: '#CCC', cursor: 'pointer', padding: '4px 0' }}>
                    nothing to fill — dismiss
                  </button>
                </div>
              )}
            </>
          )
        })()}

        {view === 'reaction' && (() => {
          return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ ...sectionHeading, margin: 0 }}>
                {item.status === 'done' ? 'edit reaction' : 'mark as done'}
              </p>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BBBBBB', fontSize: 18, lineHeight: 1, padding: 4, flexShrink: 0 }}>✕</button>
            </div>
            <ReactionForm
              type={item.type}
              reaction={reaction}
              onReaction={setReaction}
              canon={canon}
              onToggleCanon={next => { setCanon(next); onToggleCanon(next) }}
              note={note}
              onNote={setNote}
              selectedMoods={selectedMoods}
              onToggleMood={toggleMood}
              showUnconfirmedHint={unconfirmedVibes.length > 0}
              collapse={item.status === 'done' ? { open: reactionTagsOpen, onToggle: () => setReactionTagsOpen(v => !v) } : undefined}
            />
            <div style={{ ...footer, display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={() => setView('main')} style={{ background: 'none', border: 'none', color: '#ABA69C', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', padding: '11px 4px' }}>cancel</button>
              {(() => {
                // Enable save when there's anything worth saving — a verdict, a note, or tags.
                // A note no longer requires a verdict (notes can stand alone).
                const canSave = !!reaction || note.trim().length > 0 || selectedMoods.length > 0
                return <button onClick={handleSaveReaction} disabled={!canSave} style={{ flex: 1, padding: 13, borderRadius: 11, border: 'none', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', color: '#fff', background: canSave ? '#1C1B19' : '#D8D5D0', cursor: canSave ? 'pointer' : 'default' }}>save</button>
              })()}
            </div>
          </>
          )
        })()}
      </div>
      {watchOpen && (
        <WhereToWatchSheet
          item={{ title: item.title, year: item.year, type: item.type }}
          onClose={() => setWatchOpen(false)}
        />
      )}
    </>
  )
}

// Render a note. Lines that start with "-", "*", or "•" become a bullet list;
// other non-empty lines render as paragraphs. Lets you jot a quick list in a note.
function renderNote(note: string) {
  const lines = note.split('\n')
  const blocks: React.ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (!bullets.length) return
    blocks.push(
      <ul key={`u${blocks.length}`} style={{ margin: '0 0 4px', paddingLeft: 18 }}>
        {bullets.map((b, i) => <li key={i} style={{ marginBottom: 2 }}>{b}</li>)}
      </ul>,
    )
    bullets = []
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (/^[-*•]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*•]\s+/, ''))
    } else {
      flush()
      if (line) blocks.push(<p key={`p${blocks.length}`} style={{ margin: '0 0 4px' }}>{line}</p>)
    }
  }
  flush()
  return blocks
}

function SpotifyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#1DB954" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.59 14.42a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.82-.87 7.09-.5 9.72 1.1a.62.62 0 0 1 .21.86zm1.23-2.74a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.56 11.23 1.33.37.22.49.7.26 1.07zm.11-2.85C14.81 8.98 9.5 8.8 6.44 9.73a.94.94 0 1 1-.54-1.8c3.52-1.07 9.38-.86 13.08 1.34a.94.94 0 0 1-.96 1.61z" />
    </svg>
  )
}


// Pinned footer so action buttons stay visible even when the sheet scrolls.
const footer: React.CSSProperties = {
  position: 'sticky', bottom: 0, background: '#fff', zIndex: 1,
  paddingTop: 10, paddingBottom: 'calc(14px + env(safe-area-inset-bottom))', marginTop: 6,
}

function actionBtn(color: string): React.CSSProperties {
  return {
    width: '100%', padding: '9px', border: '1.5px solid #E0E0E0',
    borderRadius: 10, background: '#fff', fontSize: 13,
    fontWeight: 500, color, cursor: 'pointer',
  }
}

// Tighter input for the edit view where vertical space matters.
const smInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '7px 10px', border: '1.5px solid #E0E0E0',
  borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none',
}

// Editorial heading + field-label styles, shared so the sub-views match the main card.
const sectionHeading: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#1C1B19', marginBottom: 14 }
const fieldLabel: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#ABA69C', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }
// Small intro label for the read-view tag lines (genre / vibe / verdict).
const tagLabelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#ABA69C', letterSpacing: '0.5px', textTransform: 'uppercase', width: 50, flexShrink: 0 }
