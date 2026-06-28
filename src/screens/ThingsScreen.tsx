import { useMemo, useState, useRef, useEffect } from 'react'
import { DomainLinks } from '../components/DomainSwitcher'
import { CapturesSheet } from '../components/CapturesSheet'
import { Sheet } from '../components/Sheet'
import { fetchCaptures, clearCapture, isFailure, type EmailCapture } from '../lib/captures'
import { thingImageRaw } from '../lib/thingImage'
import { makeCutout, CUTOUT_VERSION } from '../lib/cutout'
import { NoteProse } from '../components/NoteProse'
import { useItems } from '../hooks/useItems'
import { useAuth } from '../hooks/useAuth'
import type { Item } from '../lib/database.types'
import {
  parseProductLink, compareCandidates, readImageAttributes, readProductFromImage, kindOf, intentMeta, productMeta, inspirationMeta, newCandidateId,
  promoteIntentToProduct, demoteProductToIntent, productPlan,
  EDIT_FACETS, FACET_LABEL, SUGGESTED, normValue, itemAttributes, THREAD_MIN_ITEMS, priceValue, formatPrice,
  boardTasteSummary, readTasteFit, readTasteSynthesis, recurringBrands,
  type Candidate, type ProductFields, type Comparison, type Attribute, type Facet, type PlanRecord, type BoardTasteSummary,
} from '../lib/things'
import { uploadMoodImage, moodSrc } from '../lib/mood'
import { inReview } from '../lib/review'
import { flipThingToMedia, MEDIA_TYPES, type MediaType } from '../lib/flip'
import { NAV_H, clearStack } from '../lib/layout'
import { sampleBoardColors } from '../lib/palette'
import { usePrefs } from '../hooks/usePrefs'

const INK = '#1C1B19'
const MUTED = '#ABA69C'
const LINE = '#E8E8E8'
// The one tile field every board image sits on — a light, cool-toned gray. Cutouts
// float on it; model/lifestyle photos are floated on it too (their cool studio
// backgrounds blend into it), so the whole board reads as one catalog rather than a
// mix of warm cutout tiles and full-bleed photos. Cool (not warm cream) to match the
// grey studio photography most shops use.
const TILE = '#ECEDEF'

// Filter-sheet chip — identical to the media Library's tagChipStyle so sort/show
// in Things read in the same chip language (not iOS ✓-list rows).
const chipStyle = (on: boolean) => ({
  padding: '6px 12px', borderRadius: 8, border: 'none',
  background: on ? '#1C1B19' : '#F1EEE9',
  color: on ? '#fff' : '#5F5E5A',
  fontSize: 12.5, fontWeight: on ? 600 : 400,
  cursor: 'pointer', whiteSpace: 'nowrap' as const,
})

type SortKey = 'recent' | 'price' | 'name'
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'recent' },
  { key: 'price', label: 'price' },
  { key: 'name', label: 'a–z' },
]

// Target px-per-column for the responsive grid — the wall auto-sizes its column
// count to the device width (no manual density toggle; keep it simple).
const COL_TARGET = 220

// Grid (visual wall) vs list (the plan-style row: square thumb + title + price).
// Persisted so the choice sticks.
type ViewMode = 'grid' | 'list'
const VIEW_KEY = 'nospaces.thingsView'
// How much text sits under each grid tile — mirrors the media library. 'none' is
// a clean wall (coverless tiles still show name+brand inside), 'title' is the
// name only, 'full' is name + price · brand + taste line.
type CardCaption = 'none' | 'title' | 'full'
const CAPTION_KEY = 'nospaces.thingsCaption'
function loadCaption(): CardCaption {
  try { const c = localStorage.getItem(CAPTION_KEY); return c === 'none' || c === 'title' ? c : 'full' } catch { return 'full' }
}
function loadView(): ViewMode {
  try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid' } catch { return 'grid' }
}

// Two main pages, mirroring the media domain (library / taste): the buyable
// WISHLIST (products + plans), and TASTE — the read-back mirror. Taste in turn has
// two sub-tabs (profile · moodboard), just as the media taste page splits into
// profile · desert island. The moodboard (pure-inspiration images) lives under
// taste because it feeds the same aesthetic read the profile reflects. Persisted.
type Tab = 'wishlist' | 'taste'
const TAB_KEY = 'nospaces.thingsTab'
const TABS: Tab[] = ['wishlist', 'taste']
function loadTab(): Tab {
  try { const t = localStorage.getItem(TAB_KEY); return TABS.includes(t as Tab) ? (t as Tab) : 'wishlist' } catch { return 'wishlist' }
}

// The taste page's two sub-tabs. Profile is the read (the headline); moodboard is
// the image wall you add inspiration to.
type TasteSub = 'profile' | 'moodboard'
const TASTE_SUB_KEY = 'nospaces.thingsTasteSub'
const TASTE_SUBS: TasteSub[] = ['profile', 'moodboard']
function loadTasteSub(): TasteSub {
  try { const s = localStorage.getItem(TASTE_SUB_KEY); return TASTE_SUBS.includes(s as TasteSub) ? (s as TasteSub) : 'profile' } catch { return 'profile' }
}

// Category values a thing carries (for the filter row). Products use their own
// tags; resolved intents use the winner's. Untagged things match nothing but
// still show under "all".
function categoriesOf(item: Item): string[] {
  return itemAttributes(item).filter(a => a.facet === 'category').map(a => normValue(a.value))
}

// Shrink a screenshot in the browser before upload — keeps Storage light, speeds up
// the vision read, and re-encodes to JPEG (which also normalizes iPhone HEIC, a
// format the vision API rejects). No resolution loss that matters for reading a
// product. Falls back to the raw file if the browser can't decode it.
async function downscaleImage(file: File): Promise<Blob> {
  const MAX_EDGE = 1600
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.85))
    return blob ?? file
  } catch {
    return file
  }
}

// Crop a screenshot down to just the product, using the vision-read box (normalized
// 0–1). This is what strips the browser bars / shop header / price text out of a
// full-page screenshot so the saved card is the product alone — like a link-saved
// one. A little padding guards against a slightly-tight box clipping the item.
// Returns null (keep the whole image) if the box is unusable or the crop fails.
async function cropBlobToBox(blob: Blob, box: { x: number; y: number; w: number; h: number }): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(blob)
    const PAD = 0.04
    const x0 = Math.max(0, box.x - PAD), y0 = Math.max(0, box.y - PAD)
    const x1 = Math.min(1, box.x + box.w + PAD), y1 = Math.min(1, box.y + box.h + PAD)
    const sx = Math.round(x0 * bitmap.width), sy = Math.round(y0 * bitmap.height)
    const sw = Math.round((x1 - x0) * bitmap.width), sh = Math.round((y1 - y0) * bitmap.height)
    if (sw < 8 || sh < 8) { bitmap.close?.(); return null }
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh)
    bitmap.close?.()
    return await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.9))
  } catch {
    return null
  }
}

// The "show" filter exposes the board's zones: everything (deciding + saved),
// just plans, just the wishlist, or owned things. The board renders deciding and
// saved as separate sections; this just picks which are visible (see ThingsScreen).
type StatusFilter = 'all' | 'saved' | 'deciding' | 'got'
const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'all' },
  { key: 'saved', label: 'saved' },
  { key: 'deciding', label: 'deciding' },
  { key: 'got', label: 'got it' },
]

// The price a thing sorts by: a product's own, or an intent's front-runner
// (winner → leaning → first candidate). Null when there's nothing to read.
function thingPrice(item: Item): number | null {
  if (kindOf(item) === 'product') return priceValue(productMeta(item).price)
  const m = intentMeta(item)
  const cover = m.candidates.find(c => c.id === m.winner) ?? m.candidates.find(c => c.id === m.leaning) ?? m.candidates[0]
  return priceValue(cover?.price ?? null)
}

// The candidate the board's deciding card shows (winner → leaning → first with a
// photo → first). Kept as one helper so the image we polish a cutout for is the
// same one the card renders.
function leadCandidate(item: Item): Candidate | null {
  const m = intentMeta(item)
  return m.candidates.find(c => c.id === m.winner)
    ?? m.candidates.find(c => c.id === m.leaning)
    ?? m.candidates.find(c => c.image)
    ?? m.candidates[0]
    ?? null
}

function sortThings(things: Item[], sort: SortKey): Item[] {
  const arr = [...things]
  if (sort === 'name') {
    return arr.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
  }
  if (sort === 'price') {
    // Cheapest first; things with no readable price sink to the bottom.
    return arr.sort((a, b) => {
      const pa = thingPrice(a), pb = thingPrice(b)
      if (pa == null && pb == null) return 0
      if (pa == null) return 1
      if (pb == null) return -1
      return pa - pb
    })
  }
  // recent: newest first by date_added (fallback to created_at).
  return arr.sort((a, b) => (b.date_added ?? b.created_at ?? '').localeCompare(a.date_added ?? a.created_at ?? ''))
}

export function ThingsScreen() {
  const { items, addItem, editItem, deleteItem, patchMetadata } = useItems()
  const { user } = useAuth()
  const { thingsTaste, setThingsTaste, styleProfile, setStyleProfile } = usePrefs()
  const [composer, setComposer] = useState<null | 'product' | 'intent'>(null)
  // Mood capture: the FAB shoots straight to the file picker (the mobile-first
  // path); pasting a link is the soft, secondary path (mostly a desktop thing).
  const [moodLink, setMoodLink] = useState(false)
  const moodFileRef = useRef<HTMLInputElement>(null)
  const [openIntentId, setOpenIntentId] = useState<string | null>(null)
  const [openProductId, setOpenProductId] = useState<string | null>(null)
  const [openMoodId, setOpenMoodId] = useState<string | null>(null)
  // Wishlist vs taste — the two main pages of Things.
  const [tab, setTabRaw] = useState<Tab>(loadTab)
  const setTab = (t: Tab) => { setTabRaw(t); setAddMenu(false); try { localStorage.setItem(TAB_KEY, t) } catch { /* private mode */ } }
  // Taste's sub-tab (profile · moodboard), persisted so the page reopens where you left it.
  const [tasteSub, setTasteSubRaw] = useState<TasteSub>(loadTasteSub)
  const setTasteSub = (s: TasteSub) => { setTasteSubRaw(s); try { localStorage.setItem(TASTE_SUB_KEY, s) } catch { /* private mode */ } }
  // The moodboard now lives under taste — true only when both are selected. Used by
  // the paste handler, the FAB, and the content switch below.
  const onMoodboard = tab === 'taste' && tasteSub === 'moodboard'
  // Jump straight to the moodboard (e.g. right after adding an image).
  const goMoodboard = () => { setTab('taste'); setTasteSub('moodboard') }
  const goWishlist = () => setTab('wishlist')
  // Speed-dial for the floating +: open reveals the two capture paths.
  const [addMenu, setAddMenu] = useState(false)
  // Responsive grid: more columns as the board gets wider (≈2 on a phone, up to
  // ~5 on a desktop), so it fills the page like the rest of the app instead of a
  // fixed 2-up locked to a narrow column. Measured off the scroller's own width.
  const listRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(2)
  const [view, setView] = useState<ViewMode>(loadView)
  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view) } catch { /* private mode */ } }, [view])
  const [caption, setCaption] = useState<CardCaption>(loadCaption)
  useEffect(() => { try { localStorage.setItem(CAPTION_KEY, caption) } catch { /* private mode */ } }, [caption])
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const measure = () => setCols(Math.max(2, Math.floor(el.clientWidth / COL_TARGET)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const [sort, setSort] = useState<SortKey>('recent')
  const [cat, setCat] = useState<string | null>(null)
  // A taste-tag filter set by tapping a tag inside a product (e.g. 'monochrome') —
  // narrows the board to things that share it, so a card's tags become a way INTO
  // the rest of your taste, not just a label. Any facet/value; coexists with `cat`.
  const [tagFilter, setTagFilter] = useState<{ facet: Facet; value: string } | null>(null)
  const [statusF, setStatusF] = useState<StatusFilter>('all')
  // The board's "for review" inbox (mirrors the Library's). Low-confidence
  // screenshot captures land flagged; this chip is the ignorable filter that reveals
  // them — never a gate. Off by default so the clean board stays clean.
  const [reviewOnly, setReviewOnly] = useState(false)
  const [filterSheet, setFilterSheet] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [taggingMoods, setTaggingMoods] = useState(false)
  // Forwarded captures that didn't land (logged server-side by /api/email).
  // One shared inbox: the board shows EVERY failed forward, same as the Library —
  // a bounced link has no reliable domain, so there's one tray reached from either
  // side rather than a per-domain split that guesses (and guesses wrong).
  const [captures, setCaptures] = useState<EmailCapture[]>([])
  const [capturesOpen, setCapturesOpen] = useState(false)
  useEffect(() => { fetchCaptures().then(setCaptures) }, [])
  // Desktop nicety: paste a copied image anywhere on the mood tab to add it.
  useEffect(() => {
    if (!onMoodboard) return
    const onPaste = (e: ClipboardEvent) => {
      const list = e.clipboardData?.items
      if (!list) return
      const files = Array.from(list).filter(i => i.type.startsWith('image/')).map(i => i.getAsFile()).filter((f): f is File => !!f)
      if (files.length) { e.preventDefault(); void addMoodFiles(files) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMoodboard])
  const captureFailures = useMemo(() => captures.filter(isFailure).length, [captures])
  const [flash, setFlash] = useState<string | null>(null)
  // Toast for the vision auto-tag result. Success auto-fades; a failure stays put
  // (tap to dismiss) so the reason is readable — no silent no-ops.
  const showFlash = (msg: string, sticky = false) => {
    setFlash(msg)
    if (!sticky) window.setTimeout(() => setFlash(null), 3500)
  }

  // The wishlist board is products + plans only; mood-board images live apart in
  // their own list. The taste read (thread + per-item fit) reads across BOTH —
  // Farah's call: the mood board feeds the same aesthetic mirror as the wishlist.
  const things = useMemo(() => items.filter(i => { const k = kindOf(i); return k === 'product' || k === 'intent' }), [items])
  const moods = useMemo(() => items.filter(i => kindOf(i) === 'inspiration'), [items])
  // Newest first — most recent inspiration at the top of the wall.
  const sortedMoods = useMemo(() =>
    [...moods].sort((a, b) => (b.date_added ?? b.created_at ?? '').localeCompare(a.date_added ?? a.created_at ?? '')),
    [moods])
  const tasteItems = useMemo(() => [...things, ...moods], [things, moods])
  const sorted = useMemo(() => sortThings(things, sort), [things, sort])
  // Distinct categories present across the board, for the filter row.
  const categories = useMemo(() => {
    const set = new Set<string>()
    things.forEach(t => categoriesOf(t).forEach(c => set.add(c)))
    return [...set].sort()
  }, [things])
  // Two-section board: active plans up top (deciding), the wishlist below (saved),
  // owned things hidden by default. Category filters the saved/got grids; the
  // deciding strip always shows (a plan usually isn't categorised yet).
  // In-review things stay OUT of the clean sections until triaged (mirrors the
  // Library) — the "for review" chip below is the only place they surface.
  const decidingItems = useMemo(() => sorted.filter(t => kindOf(t) === 'intent' && !inReview(t)), [sorted])
  const savedItems = useMemo(() => {
    let r = sorted.filter(t => kindOf(t) === 'product' && t.status !== 'done' && !inReview(t))
    if (cat) r = r.filter(t => categoriesOf(t).includes(cat))
    if (tagFilter) r = r.filter(t => itemAttributes(t).some(a => a.facet === tagFilter.facet && normValue(a.value) === normValue(tagFilter.value)))
    return r
  }, [sorted, cat, tagFilter])
  const gotItems = useMemo(() => {
    let r = sorted.filter(t => kindOf(t) === 'product' && t.status === 'done' && !inReview(t))
    if (cat) r = r.filter(t => categoriesOf(t).includes(cat))
    if (tagFilter) r = r.filter(t => itemAttributes(t).some(a => a.facet === tagFilter.facet && normValue(a.value) === normValue(tagFilter.value)))
    return r
  }, [sorted, cat, tagFilter])
  // Everything awaiting review — products from low-confidence screenshot reads. The
  // chip badge counts these; the review view shows them as a flat grid.
  const reviewThings = useMemo(() => sorted.filter(t => kindOf(t) === 'product' && inReview(t)), [sorted])
  const reviewN = reviewThings.length
  // How many board things carry a given tag — powers the "N others" count on the
  // card's tappable tags (and gates a tag from being tappable when it's a one-off).
  const countWithTag = (facet: Facet, value: string) =>
    things.filter(t => itemAttributes(t).some(a => a.facet === facet && normValue(a.value) === normValue(value))).length
  // The board's recurring taste, summarised once for the per-item "how this fits"
  // read. Empty thread = not enough signal yet, which gates the read off entirely.
  const board = useMemo<BoardTasteSummary>(() => boardTasteSummary(tasteItems), [tasteItems])
  // Which sections the "show" filter exposes.
  const showDeciding = (statusF === 'all' || statusF === 'deciding') && decidingItems.length > 0
  const showSaved = statusF === 'all' || statusF === 'saved'
  const showGot = statusF === 'got'
  const anyShown = showGot ? gotItems.length > 0 : (showDeciding || (showSaved && savedItems.length > 0))
  // A grid (or list) of products — reused by the saved + got sections.
  const productGridOrList = (list: Item[]) => view === 'list' ? (
    // Flat hairline rows abut (gap 0) — the divider on each row is the separator,
    // matching the media Library's list.
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {list.map(item => <ProductRow key={item.id} item={item} onOpen={() => setOpenProductId(item.id)} />)}
    </div>
  ) : (
    // Cover-wall: tighten to a near-touching grid in 'none' caption mode (mirrors
    // the media Library); keep the looser gap when captions need room for text.
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, alignItems: 'start', gap: caption === 'none' ? 4 : 12 }}>
      {list.map(item => <ProductCard key={item.id} item={item} caption={caption} onOpen={() => setOpenProductId(item.id)} />)}
    </div>
  )
  const openIntent = things.find(i => i.id === openIntentId) ?? null
  const openProduct = things.find(i => i.id === openProductId) ?? null
  const openMood = moods.find(i => i.id === openMoodId) ?? null

  // Slice 4 — read taste tags off a freshly-saved product's image and patch them
  // in. Runs in the background so the save itself is instant; the board's masthead
  // picks them up on the next render. Merges, never clobbers manual tags. A brief
  // toast confirms it ran (and surfaces why, if the photo couldn't be read) — so
  // it's never a silent no-op.
  //
  // s74 — the same vision call also returns a shot type, which we store and use to
  // gate the cutout: a bare `product` packshot gets cut out onto a cream tile (see
  // polishImage), model/lifestyle shots stay full-bleed. patchMetadata merges, so
  // tags and shotType land without disturbing the rest of the item.
  async function autoTagFromImage(id: string, f: ProductFields) {
    if (!f.image) return
    setFlash('reading taste from the photo…')
    const r = await readImageAttributes(f.image, f.url)
    if (!r.ok) { showFlash(`couldn't read the photo — ${r.reason} (tap to dismiss)`, true); return }
    const existing = f.attributes ?? []
    const have = new Set(existing.map(a => a.facet))
    const fresh = r.attributes.filter(a => !have.has(a.facet))
    const patch: Record<string, unknown> = {}
    if (r.shotType) patch.shotType = r.shotType
    if (fresh.length) patch.attributes = [...existing, ...fresh]
    // If a re-read flips a shot to model/lifestyle, drop any cutout it shouldn't have
    // had (e.g. a full-body model the AI first mis-read as a product) → full-bleed photo.
    if (r.shotType && r.shotType !== 'product' && f.cutout) { patch.cutout = null; patch.cutoutV = null }
    if (Object.keys(patch).length) await patchMetadata(id, patch)

    // A bare product shot → cut it out onto the tile; the polish flash takes over from
    // here. Otherwise report the tag outcome.
    if (r.shotType === 'product') {
      void polishImage(id, f.image, f.url)
    } else if (r.attributes.length === 0) {
      showFlash('no clear taste tags from that photo')
    } else if (fresh.length === 0) {
      showFlash('no new taste tags to add')
    } else {
      showFlash(`added ${fresh.length} taste tag${fresh.length === 1 ? '' : 's'}: ${fresh.map(a => a.value).join(' · ')}`)
    }
  }

  // Upload one or more inspiration images (file pick / clipboard paste). Each goes to
  // Storage, then becomes an inspiration item; a cheap vision read (~1¢) tags it in
  // the background so it feeds the taste thread. Multi-select stays quiet per-image
  // (one summary toast) so the loop doesn't flicker through a dozen flashes.
  async function addMoodFiles(files: File[]) {
    if (!user || files.length === 0) return
    goMoodboard()
    const single = files.length === 1
    const saved: { id: string; url: string }[] = []
    for (let i = 0; i < files.length; i++) {
      setFlash(single ? 'uploading the image…' : `uploading ${i + 1}/${files.length}…`)
      const up = await uploadMoodImage(user.id, files[i])
      if (!up.ok) { showFlash(`couldn't upload — ${up.reason} (tap to dismiss)`, true); continue }
      const id = await addItem('inspiration', 'thing', null, null, { kind: 'inspiration', image: up.url, hosted: true, sourceUrl: null })
      if (id) saved.push({ id, url: up.url })
    }
    if (single && saved.length) {
      void autoTagMood(saved[0].id, saved[0].url)
    } else if (saved.length) {
      // Sequential, not fired all at once — a batch of reads in parallel trips the
      // vision rate-limit and the failures (silent here) leave images untagged.
      let tagged = 0
      for (let i = 0; i < saved.length; i++) {
        setFlash(`reading taste… ${i + 1}/${saved.length}`)
        if (await autoTagMood(saved[i].id, saved[i].url, { silent: true })) tagged++
      }
      showFlash(`added ${saved.length} image${saved.length === 1 ? '' : 's'}${tagged < saved.length ? ` — ${tagged} tagged` : ''}`)
    }
  }

  // "Screenshot a shop page" — the in-app twin of the email screenshot path, with no
  // Postmark in the loop. Reads ONE screenshot into prefilled product fields for the
  // composer: downscale (also normalizes iPhone HEIC) → host → ONE vision read (~1¢)
  // for name/brand/price + look-tags + a product crop box → crop to the product so the
  // card is the item alone (not the whole page) → host the crop. Returns fields the
  // composer shows for a tweak before saving (with an optional plan attachment).
  async function readScreenshotToFields(file: File): Promise<{ ok: true; fields: ProductFields } | { ok: false; reason: string }> {
    if (!user) return { ok: false, reason: 'not signed in' }
    const shot = await downscaleImage(file)
    const up = await uploadMoodImage(user.id, shot)
    if (!up.ok) return { ok: false, reason: up.reason }
    const r = await readProductFromImage(up.url)
    if (!r.ok) return { ok: false, reason: r.reason }
    // Isolate the product out of a full-page screenshot (browser bars, header, price
    // text). Fall back to the whole shot if there's no box / the crop fails.
    let image = up.url
    if (r.box) {
      const cropped = await cropBlobToBox(shot, r.box)
      if (cropped) { const c = await uploadMoodImage(user.id, cropped); if (c.ok) image = c.url }
    }
    return { ok: true, fields: { title: r.title ?? '', image, price: r.price, brand: r.brand, siteName: null, url: null, attributes: r.attributes, shotType: r.shotType, imageFromShot: true } }
  }

  // Save a product from the composer, into wherever the plan selector points: a
  // standalone board product, an option on an existing plan, or a new plan. A
  // deliberate in-app save lands live (no review gate — saving is the signal).
  async function saveComposedProduct(f: ProductFields, plan: PlanChoice) {
    if (plan.kind === 'existing') {
      const intent = items.find(i => i.id === plan.id)
      if (!intent) return
      const cand: Candidate = { id: newCandidateId(), ...f }
      await patchMetadata(plan.id, { candidates: [...intentMeta(intent).candidates, cand] })
      goWishlist(); setOpenIntentId(plan.id)
      return
    }
    if (plan.kind === 'new') {
      const name = (plan.name || f.title || 'new plan').trim()
      const cand: Candidate = { id: newCandidateId(), ...f }
      const id = await addItem(name, 'thing', null, null, { kind: 'intent', candidates: [cand], leaning: null, brief: null })
      goWishlist(); if (id) setOpenIntentId(id)
      return
    }
    // Standalone product.
    const id = await addItem(f.title || 'Untitled', 'thing', f.brand, null, { kind: 'product', ...f })
    goWishlist()
    if (!id) return
    // Auto-read taste off the image if the field set didn't already carry tags (a
    // link save); a screenshot save arrives pre-tagged so this no-ops.
    if (f.image && !(f.attributes && f.attributes.length)) void autoTagFromImage(id, f)
    // Cut a clean packshot onto the tile (model/lifestyle stay full-bleed).
    if (f.shotType === 'product' && f.image) void polishImage(id, f.image, f.url, { silent: true })
  }

  // Add a mood image from a pasted web link — kept as-is (proxied on display), not
  // re-hosted. The secondary, mostly-desktop path.
  async function addMoodUrl(url: string) {
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) { showFlash('paste a full image link (https://…)', true); return }
    const id = await addItem('inspiration', 'thing', null, null, { kind: 'inspiration', image: u, hosted: false, sourceUrl: u })
    setMoodLink(false)
    goMoodboard()
    if (id) void autoTagMood(id, u)
  }

  // Read taste tags off a mood image (palette/material/vibe) and store them, so the
  // image feeds the board's thread. Same ~1¢ vision path as a product photo, minus
  // the cutout (an inspiration image is shown whole). `silent` suppresses the toasts
  // for a multi-image upload (which shows its own summary line).
  async function autoTagMood(id: string, image: string, opts?: { silent?: boolean }): Promise<boolean> {
    if (!opts?.silent) setFlash('reading taste from the image…')
    const r = await readImageAttributes(image, null)
    if (!r.ok) { if (!opts?.silent) showFlash(`couldn't read the image — ${r.reason} (tap to dismiss)`, true); return false }
    if (r.attributes.length) {
      await patchMetadata(id, { attributes: r.attributes })
      if (!opts?.silent) showFlash(`added ${r.attributes.length} taste tag${r.attributes.length === 1 ? '' : 's'}: ${r.attributes.map(a => a.value).join(' · ')}`)
      return true
    }
    if (!opts?.silent) showFlash('no clear taste tags from that image')
    return false
  }

  // Mood images that never got their taste read (a silent failure in a past batch, or
  // saved before auto-tag). The backfill clears them in one tap so they join the
  // taste thread — no opening each image and clicking. Sequential, like polishAll.
  const untaggedMoods = useMemo(() => moods.filter(m => itemAttributes(m).length === 0 && inspirationMeta(m).image), [moods])
  async function tagAllMoods() {
    if (taggingMoods || untaggedMoods.length === 0) return
    setTaggingMoods(true)
    const todo = untaggedMoods.slice()
    let done = 0
    for (let i = 0; i < todo.length; i++) {
      setFlash(`reading taste… ${i + 1}/${todo.length}`)
      const img = inspirationMeta(todo[i]).image
      if (img && await autoTagMood(todo[i].id, img, { silent: true })) done++
    }
    showFlash(done > 0 ? `tagged ${done} image${done === 1 ? '' : 's'}` : 'no clear taste tags found')
    setTaggingMoods(false)
  }

  // Cut the product out of its photo and drop it on a cream tile (browser-side,
  // free — see src/lib/cutout.ts). Stores the resulting PNG URL on the item.
  // Best-effort: a failure leaves the original cover in place. `silent` suppresses
  // the toasts for the batch backfill, which runs its own progress line.
  async function polishImage(id: string, image: string, referer: string | null | undefined, opts?: { silent?: boolean }) {
    if (!user || !image) return false
    if (!opts?.silent) setFlash('cleaning up the photo…')
    const r = await makeCutout({ userId: user.id, itemId: id, image, referer })
    if (!r.ok) { if (!opts?.silent) showFlash(`couldn't clean up the photo — ${r.reason} (tap to dismiss)`, true); return false }
    await patchMetadata(id, { cutout: r.url, cutoutV: r.version, cutoutHidden: false })
    if (!opts?.silent) showFlash('cleaned up the photo')
    return true
  }

  // Same treatment for a deciding plan's LEAD candidate — the one photo the board's
  // deciding card shows. Candidates come from a link parse (no shot type), so we read
  // it once if unknown (~1¢, like a product), then cut the bare product shots out so
  // they float on the gray tile instead of carrying the shop's own background. The
  // cutout is stored on the candidate (unique storage key per item+candidate), so it
  // survives a leaning/winner change. Returns true if a cutout was made.
  async function polishLead(item: Item, opts?: { silent?: boolean }): Promise<boolean> {
    if (!user) return false
    const m = intentMeta(item)
    const lead = leadCandidate(item)
    if (!lead?.image) return false
    const patch: Partial<Candidate> = {}
    let shot = lead.shotType
    if (!shot) {
      const r = await readImageAttributes(lead.image, lead.url)
      if (r.ok) {
        shot = r.shotType
        if (r.shotType) patch.shotType = r.shotType
        const have = new Set((lead.attributes ?? []).map(a => a.facet))
        const fresh = r.attributes.filter(a => !have.has(a.facet))
        if (fresh.length) patch.attributes = [...(lead.attributes ?? []), ...fresh]
      }
    }
    if (shot === 'product') {
      // Composite key keeps a candidate cutout from colliding with the parent item's.
      const r = await makeCutout({ userId: user.id, itemId: `${item.id}-${lead.id}`, image: lead.image, referer: lead.url })
      if (r.ok) { patch.cutout = r.url; patch.cutoutV = r.version; patch.cutoutHidden = false }
      else if (!opts?.silent) showFlash(`couldn't clean up the photo — ${r.reason} (tap to dismiss)`, true)
    }
    if (Object.keys(patch).length === 0) return false
    const candidates = m.candidates.map(c => c.id === lead.id ? { ...c, ...patch } : c)
    await patchMetadata(item.id, { candidates })
    return patch.cutout != null
  }

  // Backfill — products with a photo whose cutout is missing OR stale (an older
  // pipeline version, e.g. the untrimmed too-small v1), skipping model/lifestyle
  // shots (those stay full-bleed) and any the user chose to show full-photo.
  // Re-polishing a stale cutout is FREE (no AI — shot type's already known).
  const polishable = useMemo(() => things.filter(i => {
    if (kindOf(i) !== 'product') return false
    const p = productMeta(i)
    if (!p.image || p.cutoutHidden || p.shotType === 'onModel' || p.shotType === 'lifestyle') return false
    return !p.cutout || p.cutoutV !== CUTOUT_VERSION
  }), [things])

  // Same backfill, for deciding plans: the lead candidate's photo needs cutting out
  // so the board's deciding card matches the saved cards. Skips model/lifestyle leads
  // and any the user flipped to full-photo.
  const polishableLeads = useMemo(() => things.filter(i => {
    if (kindOf(i) !== 'intent') return false
    const lead = leadCandidate(i)
    if (!lead?.image || lead.cutoutHidden || lead.shotType === 'onModel' || lead.shotType === 'lifestyle') return false
    return !lead.cutout || lead.cutoutV !== CUTOUT_VERSION
  }), [things])

  // One-tap "polish images": for each backfill item, learn the shot type if we don't
  // know it yet (one vision read, ~1¢ — only for legacy items), then cut out the bare
  // product shots. Sequential so the model loads once and the board isn't hammered.
  // Covers both saved products and deciding-plan leads.
  async function polishAllMissing() {
    if (polishing || (polishable.length === 0 && polishableLeads.length === 0)) return
    setPolishing(true)
    const todo = polishable.slice()
    const leads = polishableLeads.slice()
    const total = todo.length + leads.length
    let done = 0
    let step = 0
    for (let i = 0; i < todo.length; i++) {
      setFlash(`cleaning up photos… ${++step}/${total}`)
      const p = productMeta(todo[i])
      if (!p.image) continue
      let shot = p.shotType
      // Legacy item with no shot type read yet → read it once (also fills any missing
      // taste tags, merged). New saves already carry shotType, so this is skipped.
      if (!shot) {
        const r = await readImageAttributes(p.image, p.url)
        if (r.ok) {
          shot = r.shotType
          const patch: Record<string, unknown> = {}
          if (r.shotType) patch.shotType = r.shotType
          const existing = p.attributes ?? []
          const have = new Set(existing.map(a => a.facet))
          const fresh = r.attributes.filter(a => !have.has(a.facet))
          if (fresh.length) patch.attributes = [...existing, ...fresh]
          if (Object.keys(patch).length) await patchMetadata(todo[i].id, patch)
        }
      }
      if (shot === 'product' && await polishImage(todo[i].id, p.image, p.url, { silent: true })) done++
    }
    for (let i = 0; i < leads.length; i++) {
      setFlash(`cleaning up photos… ${++step}/${total}`)
      if (await polishLead(leads[i], { silent: true })) done++
    }
    setPolishing(false)
    showFlash(done > 0 ? `cleaned up ${done} photo${done === 1 ? '' : 's'}` : 'nothing new to clean up')
  }

  // The control row only earns its space once there's more than one thing.
  const statusRow = things.length > 1
  // Category is visible on the row now; status + sort live behind the filter icon,
  // so the dot flags when one of THOSE is set (a hidden filter shouldn't be a trap).
  const filtersActive = statusF !== 'all' || sort !== 'recent'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#fff' }}>
      {flash && (
        <div onClick={() => setFlash(null)} style={{
          position: 'fixed', left: '50%', bottom: clearStack(24), transform: 'translateX(-50%)',
          background: INK, color: '#fff', fontSize: 12.5, padding: '9px 14px', borderRadius: 999, cursor: 'pointer',
          maxWidth: '90vw', textAlign: 'center', zIndex: 300, boxShadow: '0 4px 18px rgba(0,0,0,0.2)',
        }}>{flash}</div>
      )}

      {/* One scroller. The switcher + title + thread masthead scroll away
          naturally (no JS height animation — that was the jumpy part); only the
          sort + category bar is position:sticky, so it pins smoothly on its own. */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '20px 16px 0' }}>
          {/* Magazine header — small kicker + label + rule (shared treatment with Library) */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: MUTED, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 5 }}>
                {tab === 'taste'
                  ? (tasteSub === 'moodboard'
                      ? (moods.length === 0 ? 'mood board' : `${moods.length} image${moods.length === 1 ? '' : 's'}`)
                      : 'taste')
                  : (things.length === 0 ? 'wishlist' : `${things.length} on your wishlist`)}
              </div>
              <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: INK }}>things</h1>
            </div>
          </div>
          <div style={{ borderBottom: `1.5px solid ${INK}` }} />
          {/* The wishlist/mood toggle lives in the bottom nav (mirrors the media
              nav). Keywords (the thread) show on the mood tab only — same as the
              media taste read living on the Taste tab, not the Library. */}
          {tab === 'wishlist' && captures.length > 0 && (
            <button onClick={() => setCapturesOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                border: `1px solid ${captureFailures > 0 ? INK : LINE}`, borderRadius: 10, background: captureFailures > 0 ? '#FBFAF8' : '#fff',
                padding: '9px 12px', margin: '0 0 18px', cursor: 'pointer', color: INK,
              }}>
              <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: 3, background: captureFailures > 0 ? INK : MUTED }} />
              <span style={{ fontSize: 12, fontWeight: 500, flex: 1, minWidth: 0 }}>
                {captureFailures > 0
                  ? `${captureFailures} forward${captureFailures === 1 ? '' : 's'} didn’t land`
                  : 'emailed forwards'}
              </span>
              <span style={{ fontSize: 11, color: MUTED }}>review ›</span>
            </button>
          )}
        </div>

        {/* Sticky control bar — one quiet row. Status filters scroll on the left;
            category + sort tuck behind the filter icon so they don't compete with
            the masthead. Full-bleed bg so content scrolls cleanly under it. */}
        {tab === 'wishlist' && (statusRow || reviewN > 0) && (
          <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: `1px solid ${LINE}`, padding: '6px 16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 8 }}>
              <div style={{ display: 'flex', gap: 16, overflowX: 'auto', scrollbarWidth: 'none', flex: 1, minWidth: 0 }}>
                {/* Category is the primary on-page filter; status/sort/layout live in
                    the view sheet. Only show chips once there's a category to filter. */}
                {categories.length > 0 && (
                  <>
                    <TabChip label="all" active={cat === null && !reviewOnly} onClick={() => { setCat(null); setReviewOnly(false) }} />
                    {categories.map(c => (
                      <TabChip key={c} label={c} active={cat === c && !reviewOnly} onClick={() => { setReviewOnly(false); setCat(cat === c ? null : c) }} />
                    ))}
                  </>
                )}
                {/* For-review inbox — the ignorable filter that reveals low-confidence
                    screenshot captures. Mirrors the Library's "for review · N" chip. */}
                {reviewN > 0 && (
                  <TabChip label={`for review · ${reviewN}`} active={reviewOnly}
                    onClick={() => { setReviewOnly(v => !v); setCat(null); setTagFilter(null) }} />
                )}
              </div>
              <button onClick={() => setFilterSheet(true)} aria-label="filter and sort"
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: filtersActive ? INK : MUTED, padding: '0 0 2px', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="8" x2="20" y2="8" /><circle cx="9" cy="8" r="2.3" fill="#fff" />
                  <line x1="4" y1="16" x2="20" y2="16" /><circle cx="15" cy="16" r="2.3" fill="#fff" />
                </svg>
                {filtersActive && <span style={{ width: 5, height: 5, borderRadius: '50%', background: INK }} />}
              </button>
            </div>
          </div>
        )}

        <div style={{ padding: '16px 16px 160px' }}>
          {tab === 'taste' ? (
            <>
              {/* Sub-tabs — profile · moodboard, mirroring the media taste page's
                  profile · desert island split. */}
              <div style={{ display: 'flex', gap: 18, borderBottom: `1px solid ${LINE}`, marginBottom: 18 }}>
                <TabChip label="profile" active={tasteSub === 'profile'} onClick={() => setTasteSub('profile')} underline={false} />
                <TabChip label="moodboard" active={tasteSub === 'moodboard'} onClick={() => setTasteSub('moodboard')} underline={false} />
              </div>
              {tasteSub === 'moodboard' ? (
                <>
                  {moods.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      {untaggedMoods.length > 0
                        ? <button onClick={tagAllMoods} disabled={taggingMoods} style={quietLink}>
                            {taggingMoods ? 'reading taste…' : `read taste for ${untaggedMoods.length} untagged`}
                          </button>
                        : <span />}
                      <button onClick={() => setMoodLink(true)} style={quietLink}>paste a link</button>
                    </div>
                  )}
                  <MoodWall moods={sortedMoods} cols={cols} onOpen={setOpenMoodId}
                    onAddUpload={() => moodFileRef.current?.click()} onAddLink={() => setMoodLink(true)} />
                </>
              ) : (
                <TasteTab
                  items={tasteItems}
                  board={board}
                  synthesis={thingsTaste ?? null}
                  onSave={setThingsTaste}
                  styleProfile={styleProfile ?? null}
                  onSaveProfile={setStyleProfile}
                />
              )}
            </>
          ) : (
          <>
          {/* Active taste-tag filter (set from a product's tags) — a removable pill so
              the narrowed board is never a hidden trap. */}
          {tagFilter && (
            <button onClick={() => setTagFilter(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14, padding: '5px 10px 5px 12px',
                borderRadius: 999, border: `1px solid ${INK}`, background: INK, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{FACET_LABEL[tagFilter.facet].toLowerCase()}</span>
              {tagFilter.value}
              <span style={{ fontSize: 14, lineHeight: 1, color: 'rgba(255,255,255,0.85)' }}>×</span>
            </button>
          )}
          {things.length === 0 ? (
            <Empty />
          ) : reviewOnly ? (
            // For-review view — a flat grid of the screenshot captures the read wasn't
            // sure about. Open one to confirm or fix it (or flip it to media).
            reviewThings.length > 0 ? (
              <section>
                <SectionLabel>for review · {reviewThings.length}</SectionLabel>
                {productGridOrList(reviewThings)}
              </section>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 20px', color: MUTED, fontSize: 13 }}>nothing to review.</div>
            )
          ) : !anyShown ? (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: MUTED, fontSize: 13 }}>
              {cat ? <>nothing tagged “{cat}” yet.</>
                : statusF === 'saved' ? 'nothing saved yet.'
                : statusF === 'deciding' ? 'nothing in the works.'
                : statusF === 'got' ? 'nothing marked got it yet.'
                : 'nothing here yet.'}
            </div>
          ) : (
            <>
              {/* DECIDING — active plans, up top. A swipeable strip in grid view (a
                  plan is a labelled box, not a product tile); plain rows in list. */}
              {showDeciding && (
                <section style={{ marginBottom: 26 }}>
                  <SectionLabel>deciding · {decidingItems.length}</SectionLabel>
                  {/* A plan is a *question* — always the portrait "deciding" card, in
                      both list and grid view (Farah, s75). It never degrades to a flat
                      row, so a plan reads the same however the saved items are laid out. */}
                  <div style={{ display: 'flex', gap: caption === 'none' ? 4 : 12, overflowX: 'auto', paddingBottom: 4, scrollSnapType: 'x proximity' }}>
                    {decidingItems.map(item => <DecidingCard key={item.id} item={item} view={view} onOpen={() => setOpenIntentId(item.id)} />)}
                  </div>
                </section>
              )}

              {/* SAVED — the wishlist grid (labelled only when it sits below deciding). */}
              {showSaved && savedItems.length > 0 && (
                <section>
                  {showDeciding && <SectionLabel>saved · {savedItems.length}</SectionLabel>}
                  {productGridOrList(savedItems)}
                </section>
              )}

              {/* GOT — only when explicitly filtered to "got it". */}
              {showGot && productGridOrList(gotItems)}
            </>
          )}
          </>
          )}
        </div>
      </div>

      {composer === 'product' && (
        <ProductComposer
          onClose={() => setComposer(null)}
          intents={decidingItems.map(i => ({ id: i.id, title: i.title }))}
          onReadScreenshot={readScreenshotToFields}
          onSave={async (f, plan) => { await saveComposedProduct(f, plan); setComposer(null) }}
        />
      )}

      {composer === 'intent' && (
        <IntentComposer
          onClose={() => setComposer(null)}
          onCreate={async (need, brief) => {
            const id = await addItem(need, 'thing', null, null, { kind: 'intent', candidates: [], leaning: null, brief: brief || null })
            setComposer(null)
            // Drop straight into the new intent so the user can weigh options right away.
            if (id) setOpenIntentId(id)
          }}
        />
      )}

      {/* Mood upload — the FAB and the empty/wall buttons all trigger this one hidden
          multi-file input, so adding an image is a single tap → picker on mobile. */}
      <input ref={moodFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) void addMoodFiles(fs) }} />


      {moodLink && (
        <MoodLinkComposer onClose={() => setMoodLink(false)} onAdd={addMoodUrl} />
      )}

      {openMood && (
        <MoodSheet
          item={openMood}
          onClose={() => setOpenMoodId(null)}
          onRunTaste={async () => { await autoTagMood(openMood.id, inspirationMeta(openMood).image ?? '') }}
          onDelete={async () => { await deleteItem(openMood.id); setOpenMoodId(null) }}
        />
      )}

      {openIntent && (
        <IntentSheet
          item={openIntent}
          onClose={() => setOpenIntentId(null)}
          onPatch={(meta) => editItem(openIntent.id, { metadata: meta })}
          onResolve={(winnerId, meta) =>
            editItem(openIntent.id, { metadata: { ...meta, winner: winnerId } })}
          onRename={(title) => editItem(openIntent.id, { title })}
          onSaveWinner={async () => {
            // Promote the chosen candidate into a real product card in place: the
            // plan *becomes* the product (deliberation history kept in metadata),
            // landing in "saved" so you can mark it "got it" once you own it.
            const meta = promoteIntentToProduct(openIntent)
            if (!meta) return
            const id = openIntent.id
            await editItem(id, { title: meta.title || 'Untitled', creator: meta.brand, status: 'want_to', metadata: meta })
            setOpenIntentId(null)
            // Moving from plan → saved always reads taste off the photo (when there
            // is one), even if the winner already carried a tag or two from the
            // deciding stage — autoTagFromImage merges and never clobbers, so it only
            // fills the facets that are missing. ~1¢ (Sonnet vision), background,
            // best-effort. It spreads the full meta back, so fromPlan history
            // survives the patch.
            if (meta.image) {
              void autoTagFromImage(id, meta)
            } else {
              // No photo on the winner → nothing to read taste from. Say so, so the
              // save isn't a silent no-op (you can add a photo + "run taste" later).
              showFlash('saved — add a photo to read taste from it')
            }
          }}
          onDelete={async () => { await deleteItem(openIntent.id); setOpenIntentId(null) }}
        />
      )}

      {openProduct && (
        <ProductSheet
          item={openProduct}
          onClose={() => setOpenProductId(null)}
          onSave={async (f) => {
            // Spread the existing metadata first so a promoted product keeps its
            // fromPlan deliberation history through a manual edit.
            await editItem(openProduct.id, { title: f.title || 'Untitled', creator: f.brand, metadata: { ...(openProduct.metadata as object), kind: 'product', ...f } })
          }}
          onToggleGot={() => editItem(openProduct.id, { status: openProduct.status === 'done' ? 'want_to' : 'done' })}
          onReopenPlan={async () => {
            // Reverse promoteIntentToProduct: rebuild the original plan from the
            // fromPlan history (winner still picked → reads "decided"), drop the
            // product wrapper, and reopen it so you can keep weighing. The whole
            // metadata is replaced — the fromPlan/product keys are gone, so it's a
            // clean intent again, as if "save" was never pressed.
            const back = demoteProductToIntent(openProduct)
            if (!back) return
            await editItem(openProduct.id, { title: back.title, creator: null, status: 'want_to', metadata: back.meta })
            setOpenProductId(null)
            setOpenIntentId(openProduct.id)
          }}
          // Retroactive taste-read for an untagged save. Same ~1¢ vision path as
          // auto-tag-on-save; spreads current meta so nothing else is lost.
          onRunTaste={() => autoTagFromImage(openProduct.id, productMeta(openProduct))}
          onToggleCutout={() => patchMetadata(openProduct.id, { cutoutHidden: !productMeta(openProduct).cutoutHidden })}
          onSaveNote={(note) => patchMetadata(openProduct.id, { note })}
          board={board}
          // Reads how this one thing fits the board (Haiku, ~$0.001), then caches the
          // line on metadata.tasteFit so it's a one-time cost. Returns the reason on
          // failure so the sheet can show it. Only ever fired by an explicit tap.
          onRunFit={async () => {
            const p = productMeta(openProduct)
            const r = await readTasteFit({ title: p.title, brand: p.brand, price: p.price, attributes: p.attributes ?? [] }, board, styleProfile)
            if (!r.ok) return r.reason
            await patchMetadata(openProduct.id, { tasteFit: r.fit })
            return null
          }}
          onToggleHideFit={() => patchMetadata(openProduct.id, { tasteFitHidden: !(openProduct.metadata as { tasteFitHidden?: boolean })?.tasteFitHidden })}
          countWithTag={countWithTag}
          onFilterTag={(facet, value) => { setTagFilter({ facet, value }); setOpenProductId(null) }}
          onDelete={async () => { await deleteItem(openProduct.id); setOpenProductId(null) }}
          // Misroute fix: move this thing into the media library as the chosen type.
          // Closes the sheet (it's no longer a thing) and flashes where it went.
          onFlipToMedia={async (t) => {
            await editItem(openProduct.id, flipThingToMedia(openProduct, t))
            setOpenProductId(null)
            showFlash(`moved to your library (${t})`)
          }}
          // "This read is right" — clear the review flag so it leaves the inbox.
          onClearReview={async () => { await patchMetadata(openProduct.id, { review: false }); setOpenProductId(null) }}
        />
      )}

      {filterSheet && (
        <FilterSheet
          view={view} onView={setView}
          caption={caption} onCaption={setCaption}
          sort={sort} onSort={setSort}
          status={statusF} onStatus={setStatusF}
          polishCount={polishable.length + polishableLeads.length} polishing={polishing}
          onPolishAll={() => { setFilterSheet(false); void polishAllMissing() }}
          onClose={() => setFilterSheet(false)}
        />
      )}

      {capturesOpen && (
        <CapturesSheet
          captures={captures}
          // Scoped clear: only the things-related rows shown here, so this never
          // nukes the Library's media captures (clearCaptures() wipes ALL of them).
          onClear={async () => {
            const ok = await Promise.all(captures.map(c => clearCapture(c.id)))
            if (ok.some(Boolean)) setCaptures([])
          }}
          onClearOne={async (id) => { if (await clearCapture(id)) setCaptures(cs => cs.filter(c => c.id !== id)) }}
          onClose={() => setCapturesOpen(false)}
        />
      )}

      {/* Floating + — the app's single add gesture (mirrors the media FAB). The
          board has no bottom nav, so it anchors to the bottom-right on its own. On
          the wishlist it reveals the two product paths; on the mood board it adds an
          image straight away (one path, no menu). Tapping the scrim or × closes. */}
      {addMenu && (
        <div onClick={() => setAddMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
      )}
      {/* The FAB shows on the wishlist (speed-dial: product / plan) and on the
          moodboard (one tap → image picker). The taste PROFILE is a read-only
          mirror — nothing to add there — so the FAB hides. */}
      {(tab === 'wishlist' || onMoodboard) && (
      <div style={{ position: 'fixed', right: 20, bottom: clearStack(18), zIndex: 99, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
        {tab === 'wishlist' && addMenu && (
          <>
            <FabAction label="save a product" onClick={() => { setAddMenu(false); setComposer('product') }} />
            <FabAction label="plan a purchase" onClick={() => { setAddMenu(false); setComposer('intent') }} />
          </>
        )}
        <button
          onClick={() => onMoodboard ? moodFileRef.current?.click() : setAddMenu(m => !m)}
          aria-label={onMoodboard ? 'add inspiration' : addMenu ? 'close add menu' : 'add'}
          style={{
            width: 50, height: 50, borderRadius: '50%', background: INK, color: '#fff', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 16px rgba(0,0,0,0.22)', transition: 'transform 0.18s ease',
            transform: tab === 'wishlist' && addMenu ? 'rotate(45deg)' : 'none', alignSelf: 'flex-end',
          }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
      )}

      {/* The Things bottom nav — two pages (wishlist / taste), mirroring the media
          domain's library / taste. The media BottomNav is hidden on /things
          (App.tsx), so this is the only bar here. */}
      <ThingsNav tab={tab} onTab={setTab} />
    </div>
  )
}

// Things bottom bar — same merged row as the media BottomNav: media / things on
// the left, the board's two sections (wishlist / taste) as slash-split text links
// on the right.
function ThingsNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const link = (on: boolean): React.CSSProperties => ({
    border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13,
    color: on ? '#1C1B19' : '#A8A39A', fontWeight: on ? 600 : 400,
  })
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: `calc(${NAV_H}px + env(safe-area-inset-bottom))`, paddingBottom: 'env(safe-area-inset-bottom)',
      background: '#fff', borderTop: '1px solid #E8E8E8',
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '14px 18px 0', boxSizing: 'border-box', zIndex: 100,
    }}>
      <DomainLinks current="things" />
      <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
        <button onClick={() => onTab('wishlist')} style={link(tab === 'wishlist')}>wishlist</button>
        <span style={{ color: '#D5D1C9', fontSize: 12 }}>/</span>
        <button onClick={() => onTab('taste')} style={link(tab === 'taste')}>taste</button>
      </div>
    </nav>
  )
}


/* ---------- the taste tab (the board read back as a taste mirror) ---------- */

// The whole point of Things: the *set* speaks. The taste tab reads the WHOLE board
// (wishlist + mood) back as one aesthetic, editorial-spread style:
//   - keywords as a small-caps kicker
//   - the synthesis as the hero — a 1–2 sentence "what you're reflecting" pull-quote
//     (paid, on demand, cached; ~$0.001 a tap)
//   - a colour story: the real recurring hues sampled from the board's images
// Stays a gentle nudge until there's real signal, so it never guesses on a sparse board.
function TasteTab({ items, board, synthesis, onSave, styleProfile, onSaveProfile }: {
  items: Item[]
  board: BoardTasteSummary
  synthesis: string | null
  onSave: (s: string) => void
  styleProfile: string | null
  onSaveProfile: (s: string) => void
}) {
  const [generating, setGenerating] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [colors, setColors] = useState<string[]>([])
  const tagged = useMemo(() => items.filter(t => itemAttributes(t).length > 0).length, [items])
  // Brands you keep reaching for — the makers' echo of the keyword thread.
  const brands = useMemo(() => recurringBrands(items), [items])
  // The keyword thread is the signal gate — it only appears once enough items recur
  // (THREAD_MIN_ITEMS + RECUR_MIN), the same honest bar the old masthead used.
  const hasSignal = board.thread.length > 0

  // Every board image's loadable src — mood images from Storage/proxy, product photos
  // through the same-origin proxy — for the colour story sample.
  const imageSrcs = useMemo(() => items.map(it => {
    if (kindOf(it) === 'inspiration') { const m = inspirationMeta(it); return moodSrc(m.image, m.hosted) }
    const p = productMeta(it); return thingImageRaw(p.image, p.url)
  }).filter((s): s is string => !!s), [items])

  useEffect(() => {
    let cancelled = false
    if (imageSrcs.length === 0) { setColors([]); return }
    sampleBoardColors(imageSrcs).then(c => { if (!cancelled) setColors(c) })
    return () => { cancelled = true }
  }, [imageSrcs])

  async function generate() {
    if (generating) return
    setGenerating(true); setErr(null)
    const r = await readTasteSynthesis(board, tagged)
    if (r.ok) onSave(r.synthesis)
    else setErr(r.reason)
    setGenerating(false)
  }

  if (items.length === 0 || !hasSignal) {
    return (
      <>
        <div style={{ margin: '12px 0', fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
          save a few things and add some mood images — once a thread recurs across your board,
          your <em>taste read</em> surfaces here: your keywords, a line on what you’re reflecting, and your colour story.
          {tagged > 0 && <span style={{ color: INK, fontWeight: 600 }}> {tagged}/{THREAD_MIN_ITEMS} so far.</span>}
        </div>
        <StyleProfileBlock value={styleProfile} onSave={onSaveProfile} />
      </>
    )
  }

  return (
    <div>
      {/* Kicker — keywords in small caps, the quiet label above the read. */}
      <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, letterSpacing: '2px', textTransform: 'uppercase' }}>
        {board.thread.join('   ·   ')}
      </div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
        read across {tagged} tagged thing{tagged === 1 ? '' : 's'} — wishlist + mood
      </div>

      {/* Hero — the synthesis as a pull-quote, or the read CTA before it's generated. */}
      <div style={{ margin: '22px 0 4px' }}>
        {synthesis ? (
          <p style={{ fontSize: 25, lineHeight: 1.34, color: INK, letterSpacing: '-0.02em', fontWeight: 500, margin: 0 }}>
            {synthesis}
            {/* The refresh rides at the end of the quote, not as a paragraph below —
                same treatment as the product sheet's taste-fit re-read. */}
            <button onClick={generate} disabled={generating}
              style={{ ...quietLink, fontSize: 13, marginLeft: 12, whiteSpace: 'nowrap' }}>
              {generating ? 'reading…' : 'read again'}
            </button>
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
            padding: '16px 18px', border: `1px solid ${LINE}`, borderRadius: 12, background: '#FBFAF8' }}>
            <span style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.45 }}>
              read your board back as one taste — a line on what you’re reflecting.
            </span>
            <button onClick={generate} disabled={generating} style={primaryBtn(generating)}>
              {generating ? 'reading…' : 'read'}
            </button>
          </div>
        )}
        {err && <div style={{ fontSize: 12, color: '#B4413C', marginTop: 8 }}>{err}</div>}
      </div>

      {/* Always reaching for — brands that recur across the board (≥3 saves). The
          makers' counterpart to the keyword thread; mirrors the media taste read's
          "always loved" creators. */}
      {brands.length > 0 && (
        <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 30, paddingTop: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED, marginBottom: 10 }}>
            always reaching for
          </div>
          <div style={{ fontSize: 14, color: INK, lineHeight: 1.7 }}>
            {brands.map((b, i) => (
              <span key={b.brand}>
                {i > 0 && <span style={{ color: MUTED }}> · </span>}
                {b.brand}
                <span style={{ color: MUTED, fontSize: 11 }}> ×{b.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Colour story — the real recurring hues, sampled from the board's images. */}
      {colors.length >= 3 && (
        <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 30, paddingTop: 22 }}>
          <div style={{ display: 'flex', height: 56, borderRadius: 10, overflow: 'hidden' }}>
            {colors.map((c, i) => <div key={i} style={{ flex: 1, background: c }} />)}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 10, letterSpacing: '0.04em' }}>
            your colour story — drawn from the board
          </div>
        </div>
      )}

      <StyleProfileBlock value={styleProfile} onSave={onSaveProfile} />
    </div>
  )
}

// Your own words on your aesthetic + body type — a back-end input for the AI, not
// a taste-page feature. It feeds the compare + per-item "how this fits" reads
// (never the editorial board read), so a weigh-up can speak to fit and silhouette,
// not just price. Deliberately quiet: a small link on the taste page; the text
// itself lives behind a sheet so the page stays editorial. Private to you.
function StyleProfileBlock({ value, onSave }: { value: string | null; onSave: (s: string) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const openEditor = () => { setDraft(value ?? ''); setOpen(true) }
  const save = () => { onSave(draft.trim()); setOpen(false) }

  return (
    <div style={{ marginTop: 26 }}>
      <button onClick={openEditor} style={{ ...quietLink, fontSize: 12 }}>
        style profile{value ? ' · on' : ''} ›
      </button>

      {open && (
        <Sheet onClose={() => setOpen(false)} maxWidth={420}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: INK }}>style profile</h2>
          <p style={{ fontSize: 12.5, color: MUTED, margin: '0 0 14px', lineHeight: 1.55 }}>
            your own words on your aesthetic + body type. you won’t see this on your taste page — it quietly feeds <em>compare</em> and a thing’s <em>how it fits</em>, so those reads speak to silhouette and fit, not just price.
          </p>
          <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            placeholder="e.g. drawn to quiet, structured tailoring in earth tones. petite with a long torso — high-waisted cuts and cropped jackets flatter; oversized swamps me."
            rows={6}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', marginTop: 10 }}>
            <button onClick={() => setOpen(false)} style={quietLink}>cancel</button>
            <button onClick={save} style={primaryBtn(false)}>save</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

/* ---------- cards ---------- */

// Tapping the card opens an internal detail sheet (like the media Library) — the
// external buy link lives behind an explicit button inside, so a stray tap never
// bounces you off the site.
// A plain Google search link from what we know (brand + title) — the buy-back path
// for a screenshot-captured thing that has no stored URL. No scraping, no API, no
// cost: just a search URL the user taps to find the item online.
function findOnlineUrl(brand: string | null, title: string): string {
  const q = [brand, title].filter(Boolean).join(' ').trim()
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`
}

function ProductCard({ item, caption, onOpen }: { item: Item; caption: CardCaption; onOpen: () => void }) {
  const p = productMeta(item)
  const got = item.status === 'done'
  // The card's taste line shows material/palette/vibe only — category is already
  // the filter row above, so repeating it under the item reads redundant.
  const taste = (p.attributes ?? []).filter(a => a.facet !== 'category')
  // No image + clean-wall mode → write name + brand into the tile so it stays
  // identifiable (matches the media grid's coverless fallback).
  const coverless = !p.image && !p.cutout
  const tileFallback = caption === 'none' && coverless ? (
    <div style={{ padding: '10px 9px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: INK, lineHeight: 1.25, textTransform: 'lowercase', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.title}</div>
      {p.brand && <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>{p.brand}</div>}
    </div>
  ) : undefined
  return (
    <button onClick={onOpen}
      style={{ position: 'relative', textAlign: 'left', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: INK, display: 'block', width: '100%' }}>
      <Thumb src={p.image} referer={p.url} cutout={p.cutoutHidden ? null : p.cutout} fallback={tileFallback} />
      {caption !== 'none' && (
        <div style={{ marginTop: 6 }}>
          {/* Single line, ellipsis — consistent with the deciding card; open the item
              for the full title. */}
          <div style={{ fontSize: 12.5, lineHeight: 1.3, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'lowercase' }}>
            {p.title}
          </div>
          {caption === 'full' && (
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2, display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <PriceLine price={p.price} wasPrice={p.wasPrice} />
              {p.brand ? <span>{p.brand}</span> : p.siteName && <span>{p.siteName}</span>}
              {/* Status as a quiet caption mark, not a pill floating on the photo. */}
              {got && <span style={{ color: INK, fontWeight: 600 }}>· got it</span>}
            </div>
          )}
          {caption === 'full' && taste.length > 0 && (
            <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3, letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {taste.map(a => a.value).join(' · ')}
            </div>
          )}
        </div>
      )}
    </button>
  )
}

// Small uppercase kicker dividing the board's deciding / saved zones.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>{children}</div>
}

// The deciding-zone card. In LIST view a plan reads as a compact TEXT box (Farah
// s75) — a plan is a *question*, not a thing yet, so it stays word-driven. But in
// GRID view it reverts to a picture-cover card (Farah s78) so it sits in the same
// visual family as the photo tiles below it: the front-runner's image as the cover,
// the need as the title, and the status line beneath.
function DecidingCard({ item, view, onOpen }: { item: Item; view: ViewMode; onOpen: () => void }) {
  const m = intentMeta(item)
  const resolved = m.winner != null
  const n = m.candidates.length
  const winner = resolved ? m.candidates.find(c => c.id === m.winner) ?? null : null
  const lean = !resolved && m.leaning ? m.candidates.find(c => c.id === m.leaning) ?? null : null
  // The need leads (words, not a number — the "DECIDING · N" header already carries a
  // count, so a card that opened with "N options" stacked two numbers). One detail
  // line sits below: the count while deciding, or the front-runner once you're
  // leaning/decided.
  const detail = resolved
    ? (winner ? `✓ ${winner.title}` : 'decided')
    : lean ? `leaning · ${lean.title}`
    : n ? `${n} option${n === 1 ? '' : 's'}`
    : 'no options yet'
  const W = 168

  // GRID — picture-cover with the question OVERLAID on the photo (Farah). The cover
  // is the option the plan is "about" (winner → leaning → first with a photo); a
  // frosted band over its base carries the need, a count chip says how many you're
  // weighing, and a card peeking behind reads as "a pile you're choosing between".
  // Resolved settles: band goes solid + "decided", chip and stack drop away.
  if (view === 'grid') {
    const lead = leadCandidate(item)
    const hasImage = !!lead?.image
    return (
      <button onClick={onOpen} style={{
        position: 'relative', flexShrink: 0, width: W, scrollSnapAlign: 'start',
        textAlign: 'left', color: INK, border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'block',
      }}>
        {/* The "stack" — a faint card peeking out behind, only while still deciding. */}
        {!resolved && n > 1 && (
          <div aria-hidden style={{ position: 'absolute', top: -4, right: -4, width: W, height: '100%', background: '#E2E4E7', border: `1px solid ${LINE}`, zIndex: -1 }} />
        )}
        {hasImage ? (
          <div style={{ position: 'relative' }}>
            <Thumb src={lead?.image ?? null} referer={lead?.url ?? null} cutout={lead?.cutoutHidden ? null : lead?.cutout} />
            {/* Count chip — only while deciding (a settled card doesn't need it). */}
            {!resolved && n > 0 && (
              <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, color: INK, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)', padding: '3px 8px', borderRadius: 999 }}>
                {n} option{n === 1 ? '' : 's'}
              </div>
            )}
            {/* Title band — frosted over the photo while deciding, solid once decided. */}
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, padding: '9px 11px',
              background: resolved ? 'rgba(255,255,255,0.95)' : 'rgba(248,246,242,0.9)',
              backdropFilter: 'blur(6px)', borderTop: `1px solid ${resolved ? LINE : 'rgba(0,0,0,0.06)'}`,
            }}>
              {resolved && <div style={{ fontSize: 9.5, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>decided</div>}
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.25, textTransform: 'lowercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
              {resolved && winner && (
                <div style={{ fontSize: 11, color: MUTED, marginTop: 3, textTransform: 'lowercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{winner.title}</div>
              )}
            </div>
          </div>
        ) : (
          // No photo yet — a plan is a question, so show it as one: the need centered
          // on the tile with its state below, instead of a broken-looking "no image"
          // frame. A "+" hints that tapping is where you add options.
          <div style={{
            width: '100%', aspectRatio: '4 / 5', background: TILE, border: `1px solid ${LINE}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: '14px 12px', gap: 9, boxSizing: 'border-box',
          }}>
            {!resolved && (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
            <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, textTransform: 'lowercase', color: INK, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</div>
            <div style={{ fontSize: 11, color: MUTED, textTransform: 'lowercase' }}>{resolved ? 'decided' : n > 0 ? `${n} option${n === 1 ? '' : 's'}` : 'add options'}</div>
          </div>
        )}
      </button>
    )
  }

  // LIST — the compact text box.
  return (
    <button onClick={onOpen} style={{
      position: 'relative', flexShrink: 0, width: W, scrollSnapAlign: 'start',
      textAlign: 'left', color: INK, border: `1px solid ${LINE}`, borderRadius: 12,
      background: resolved ? '#fff' : TILE, padding: '12px 13px', cursor: 'pointer', display: 'block',
    }}>
      {/* The "stack" — a faint card peeking out behind, only while still deciding,
          to keep the "a pile you're choosing between" cue. */}
      {!resolved && n > 1 && (
        <div aria-hidden style={{ position: 'absolute', top: -4, right: -4, width: W, height: '100%', background: '#E2E4E7', border: `1px solid ${LINE}`, borderRadius: 12, zIndex: -1 }} />
      )}
      {/* Title first, single line always — long needs ellipsis; open the card for the full text. */}
      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, textTransform: 'lowercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 5, textTransform: 'lowercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detail}</div>
    </button>
  )
}

/* ---------- list rows (the plan-style row, reused for the board's list view) ---------- */

// Horizontal counterparts to the grid cards: a square thumb + text, tapping opens
// the same detail sheet. Mirrors the deliberation candidate row so list view and
// the plan sheet read as one family.
function ProductRow({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const p = productMeta(item)
  const got = item.status === 'done'
  const taste = (p.attributes ?? []).filter(a => a.facet !== 'category')
  return (
    // Flat hairline row — the same family as the media Library's list rows (no boxed
    // card), so flipping domains reads as one app. The photo keeps a small rounded
    // thumb; the divider is the row's only border.
    <button onClick={onOpen}
      style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left', border: 'none', borderBottom: `1px solid ${LINE}`, borderRadius: 0, background: 'none', padding: '8px 2px', cursor: 'pointer', color: INK }}>
      <Thumb src={p.image} size={56} />
      <div style={{ minWidth: 0, flex: 1, alignSelf: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3, textTransform: 'lowercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 3, display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <PriceLine price={p.price} wasPrice={p.wasPrice} />
          {p.brand ? <span>{p.brand}</span> : p.siteName && <span>{p.siteName}</span>}
          {got && <span style={{ color: INK, fontWeight: 600 }}>· got it</span>}
        </div>
        {taste.length > 0 && (
          <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {taste.map(a => a.value).join(' · ')}
          </div>
        )}
      </div>
    </button>
  )
}

/* ---------- product sheet (tap a saved product → detail/edit, like Library) ---------- */

// The internal detail view for a saved product. Mirrors the media Library: tapping
// a card opens this in-app, and the only way *out* to the shop is the explicit
// "buy" button — so you never leave the board by accident. Edit/got-it/remove all
// live here too (they used to be a per-card ⋯ menu).
// "Why you saved it" — a personal note that turns the card into your memory of the
// item ("for the seattle trip", "wait for a sale"). Free-text, quiet until there's
// something to say. Saves on blur / done so it never needs a separate save button.
function NoteBlock({ note, onSave }: { note: string | null; onSave: (n: string | null) => void | Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note ?? '')

  function commit() {
    const t = text.trim()
    setEditing(false)
    if (t !== (note ?? '')) onSave(t || null)
  }

  if (editing) {
    return (
      <div style={{ marginTop: 16 }}>
        <textarea autoFocus value={text} onChange={e => setText(e.target.value)} onBlur={commit}
          placeholder="why you saved it — the occasion, the wait-for-a-sale, the one detail you loved…"
          rows={3}
          style={{ width: '100%', boxSizing: 'border-box', resize: 'none', fontSize: 13, lineHeight: 1.65,
            color: '#4A453E', fontStyle: 'italic', background: '#F7F8F9', border: `1px solid ${LINE}`, borderRadius: 10, padding: '10px 12px', outline: 'none', fontFamily: 'inherit' }} />
      </div>
    )
  }
  if (note) {
    return (
      <button onClick={() => { setText(note); setEditing(true) }}
        style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 16, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
        <NoteProse label="your note">{note}</NoteProse>
      </button>
    )
  }
  return (
    <button onClick={() => { setText(''); setEditing(true) }} style={{ ...quietLink, marginTop: 14 }}>
      + add a note
    </button>
  )
}

// One reflection zone, two voices: YOUR note (your words) and the app's read of how
// this fits your taste. They share a single line of tabs — only one shows at a time,
// you toggle between them. Defaults to your note when you've written one; otherwise
// it opens on the taste read (shown automatically once generated, dismissable). The
// read is a paid Haiku call cached on metadata.tasteFit, so the first time you open
// the "how it fits" tab it generates; after that toggling is free.
function ReflectionBlock({ note, onSaveNote, fit, fitHidden, onRunFit, onToggleHideFit }: {
  note: string | null
  onSaveNote: (n: string | null) => void | Promise<void>
  fit: string | null
  fitHidden: boolean
  onRunFit: () => Promise<string | null>
  onToggleHideFit: () => void
}) {
  const [tab, setTab] = useState<'note' | 'fit'>(note ? 'note' : (fitHidden ? 'note' : 'fit'))
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note ?? '')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function commit() {
    const t = text.trim()
    setEditing(false)
    if (t !== (note ?? '')) onSaveNote(t || null)
  }
  async function generate() {
    if (loading) return
    setErr(null); setLoading(true)
    const reason = await onRunFit()
    setLoading(false)
    if (reason) setErr(reason)
  }

  const tabBtn = (k: 'note' | 'fit', label: string) => (
    <button type="button" onClick={() => setTab(k)}
      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 0 7px', fontSize: 11,
        letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600,
        color: tab === k ? INK : '#C7C2B8', borderBottom: `1.5px solid ${tab === k ? INK : 'transparent'}`, marginBottom: -1 }}>
      {label}
    </button>
  )

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', gap: 18, borderBottom: `1px solid ${LINE}`, marginBottom: 13 }}>
        {tabBtn('note', 'your note')}
        {tabBtn('fit', 'how it fits')}
      </div>

      {/* Only this body scrolls when a note or the read runs long — the photo, title
          and tabs stay put, so the card itself never has to scroll. */}
      <div style={{ maxHeight: '30dvh', overflowY: 'auto', paddingRight: 2 }}>
      {tab === 'note' ? (
        editing ? (
          <textarea autoFocus value={text} onChange={e => setText(e.target.value)} onBlur={commit}
            placeholder="why you saved it — the occasion, the wait-for-a-sale, the one detail you loved…"
            rows={3}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'none', fontSize: 13, lineHeight: 1.65,
              color: '#4A453E', fontStyle: 'italic', background: '#F7F8F9', border: `1px solid ${LINE}`, borderRadius: 10, padding: '10px 12px', outline: 'none', fontFamily: 'inherit' }} />
        ) : note ? (
          <button onClick={() => { setText(note); setEditing(true) }}
            style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
            <NoteProse>{note}</NoteProse>
          </button>
        ) : (
          <button onClick={() => { setText(''); setEditing(true) }} style={quietLink}>+ add a note</button>
        )
      ) : (
        fit ? (
          <NoteProse trailing={
            <>
              <button onClick={generate} disabled={loading} style={quietLink}>{loading ? 'reading…' : 're-read'}</button>
              <span style={{ color: '#C9C4BB' }}>{' · '}</span>
              <button onClick={() => { onToggleHideFit(); setTab('note') }} style={quietLink}>dismiss</button>
            </>
          }>
            {fit}
          </NoteProse>
        ) : (
          <>
            <button onClick={generate} disabled={loading} style={quietLink}>
              {loading ? 'reading your board…' : 'read how this fits your taste ›'}
            </button>
            {err && <div style={{ marginTop: 6, fontSize: 11.5, color: '#B4413C' }}>{err}</div>}
          </>
        )
      )}
      </div>
    </div>
  )
}

function ProductSheet({ item, onClose, onSave, onToggleGot, onReopenPlan, onRunTaste, onToggleCutout, onSaveNote, board, onRunFit, onToggleHideFit, countWithTag, onFilterTag, onDelete, onFlipToMedia, onClearReview }: {
  item: Item
  onClose: () => void
  onSave: (f: ProductFields) => void | Promise<void>
  onToggleGot: () => void
  onReopenPlan: () => void | Promise<void>
  onRunTaste: () => void | Promise<void>
  onToggleCutout: () => void | Promise<void>
  onSaveNote: (note: string | null) => void | Promise<void>
  board: BoardTasteSummary
  // Runs the per-item taste read and caches it; resolves to an error reason, or null on success.
  onRunFit: () => Promise<string | null>
  // Toggles metadata.tasteFitHidden so an uninterested user can dismiss the read on this card.
  onToggleHideFit: () => void
  countWithTag: (facet: Facet, value: string) => number
  onFilterTag: (facet: Facet, value: string) => void
  onDelete: () => void
  // Flip this thing into the media library as the chosen type (the misroute fix).
  onFlipToMedia: (t: MediaType) => void | Promise<void>
  // Clear the review flag — "this read is right", leave the for-review inbox.
  onClearReview: () => void | Promise<void>
}) {
  const p = productMeta(item)
  const got = item.status === 'done'
  const needsReview = inReview(item)
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [showPlan, setShowPlan] = useState(false)
  const [flipping, setFlipping] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // Hero photo — same treatment as the grid: a product cutout floats on the gray
  // tile; a model/lifestyle photo (or one the user flipped to full-photo) fills it.
  const showCutout = !p.cutoutHidden && !!p.cutout
  const hero = showCutout ? p.cutout : (thingImageRaw(p.image, p.url) ?? p.image)
  const taste = p.attributes ?? []
  // If this product was graduated from a plan, its deliberation (the options you
  // passed on) lives here — otherwise it'd be stored but unreachable.
  const plan = productPlan(item)

  if (editing) {
    return (
      <Sheet onClose={onClose} maxWidth={380}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px', color: INK }}>edit product</h2>
        <FieldsForm saveLabel="save" initial={p}
          onCancel={() => setEditing(false)}
          onSave={async (f) => { await onSave(f); setEditing(false) }} />
        {/* Tucked into edit (not the main sheet) — it's a cleanup tool, not a primary
            action. Reads taste off the photo; merges, never clobbers what's there. */}
        {p.image && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <button onClick={() => { onRunTaste(); setEditing(false) }}
              style={{ border: 'none', background: 'none', color: INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              {taste.length > 0 ? 're-run taste from photo' : 'run taste from photo'}
            </button>
            {/* Escape hatch for a shot the AI cut out badly (e.g. read a full-body model
                as a plain product) — flip back to the original photo, full-bleed. */}
            {p.cutout && (
              <button onClick={() => { onToggleCutout(); setEditing(false) }}
                style={{ border: 'none', background: 'none', color: INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                {p.cutoutHidden ? 'use the cutout' : 'show the full photo instead'}
              </button>
            )}
          </div>
        )}
        {/* The misroute fix lives here (not the main ⋯ menu) — it's a rare cleanup for a
            screenshot we filed as a product but that's really a film/book/album/show. */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
          {flipping ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: MUTED }}>move to library as…</span>
              {MEDIA_TYPES.map(t => (
                <button key={t} onClick={() => { setFlipping(false); onFlipToMedia(t) }}
                  style={{ border: 'none', background: 'none', color: INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>{t}</button>
              ))}
              <button onClick={() => setFlipping(false)} style={quietLink}>cancel</button>
            </div>
          ) : (
            <button onClick={() => setFlipping(true)} style={quietLink}>this is actually media, not a thing →</button>
          )}
        </div>
      </Sheet>
    )
  }

  const buyLabel = p.brand ? `view at ${p.brand}` : p.siteName ? `view at ${p.siteName}` : 'view at shop'
  // The title always links OUT: to the stored buy link, or — for a screenshot/flipped
  // item with no link — a Google search built from brand + title (free, no scrape).
  const outHref = p.url || findOnlineUrl(p.brand, p.title)
  const outTitle = p.url ? buyLabel : 'find online'
  const tagged = taste.some(a => a.facet !== 'category')
  const fitApplicable = board.thread.length > 0 && tagged

  // Float-over-photo controls (close + the ⋯ admin menu).
  const floatBtn: React.CSSProperties = {
    position: 'absolute', top: 12, width: 32, height: 32, borderRadius: 999, border: 'none',
    background: 'rgba(255,255,255,0.92)', color: INK, lineHeight: 1, cursor: 'pointer',
    boxShadow: '0 1px 6px rgba(0,0,0,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const menuItem = (color: string = INK, weight: number = 400): React.CSSProperties => ({
    border: 'none', background: 'none', textAlign: 'left', width: '100%', padding: '9px 10px',
    borderRadius: 8, fontSize: 13, color, fontWeight: weight, cursor: 'pointer', fontFamily: 'inherit',
  })

  return (
    <Sheet onClose={onClose} maxWidth={380} padBottom={12}>
     <div style={{ position: 'relative' }}>
      {/* Lookbook hero — bled to the sheet edges (negative margins cancel the sheet
          padding) so the photo is the whole top of the card. Every admin action lives
          in the ⋯ menu, so nothing competes with the image and title. */}
      <div style={{ position: 'relative', margin: '-20px -18px 0' }}>
        {hero
          ? <img src={hero} onError={imgFallback(p.image)} alt="" loading="lazy"
              style={{ display: 'block', width: '100%', aspectRatio: '4 / 5', maxHeight: 'min(480px, 52dvh)', objectFit: showCutout ? 'contain' : 'cover',
                padding: showCutout ? '8%' : 0, boxSizing: 'border-box', background: TILE, borderRadius: '20px 20px 0 0',
                filter: showCutout ? undefined : 'saturate(0.97)' }} />
          : <div style={{ width: '100%', aspectRatio: '4 / 5', maxHeight: 'min(480px, 52dvh)', background: TILE, borderRadius: '20px 20px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 12 }}>no image</div>}

        <button onClick={onClose} aria-label="close" style={{ ...floatBtn, left: 12, fontSize: 19 }}>×</button>
        <button onClick={() => setMenuOpen(o => !o)} aria-label="more" style={{ ...floatBtn, right: 12, fontSize: 21, fontWeight: 700 }}>⋯</button>

        {menuOpen && (
          <>
            <div onClick={() => { setMenuOpen(false); setConfirmDel(false); setFlipping(false) }}
              style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
            <div style={{ position: 'absolute', top: 50, right: 12, zIndex: 10, width: 210, background: '#fff',
              borderRadius: 12, border: `1px solid ${LINE}`, boxShadow: '0 8px 28px rgba(0,0,0,0.16)', padding: 6, display: 'flex', flexDirection: 'column' }}>
              {confirmDel ? (
                <>
                  <div style={{ fontSize: 12.5, color: MUTED, padding: '8px 10px 6px' }}>remove from the board?</div>
                  <button style={menuItem('#B4413C', 600)} onClick={onDelete}>remove</button>
                  <button style={menuItem()} onClick={() => setConfirmDel(false)}>cancel</button>
                </>
              ) : (
                <>
                  <button style={menuItem()} onClick={() => { setMenuOpen(false); onToggleGot() }}>{got ? 'undo got it' : 'mark as got it'}</button>
                  {/* "edit details" also holds the rare "actually media" flip — a misroute
                      cleanup, too rarely needed to earn a slot in this menu. */}
                  <button style={menuItem()} onClick={() => { setMenuOpen(false); setEditing(true) }}>edit details</button>
                  {plan && !got && (
                    <button style={menuItem()} onClick={async () => { setMenuOpen(false); await onReopenPlan(); onClose() }}>↩ put back in plan</button>
                  )}
                  <div style={{ height: 1, background: LINE, margin: '5px 8px' }} />
                  <button style={menuItem('#B4413C')} onClick={() => setConfirmDel(true)}>remove</button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        {/* Title is the editorial headline AND the link out to the shop (quiet ↗). */}
        <a href={outHref} target="_blank" rel="noreferrer" title={outTitle}
          style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, textDecoration: 'none', color: INK }}>
          <h2 style={{ fontSize: 25, fontWeight: 500, margin: 0, lineHeight: 1.14, letterSpacing: '-0.01em', textTransform: 'lowercase' }}>{p.title}</h2>
          <span aria-hidden style={{ fontSize: 14, fontWeight: 400, color: MUTED, flexShrink: 0 }}>↗</span>
        </a>

        {/* Credit line — price reads plainly, brand as a small letter-spaced credit. */}
        <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 9, fontSize: 13 }}>
          <PriceLine price={p.price} wasPrice={p.wasPrice} />
          {(p.brand || p.siteName) && <span style={{ fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED }}>{p.brand || p.siteName}</span>}
          {got && <span style={{ fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: INK, fontWeight: 600 }}>· got it</span>}
        </div>

        {/* Taste tags as a quiet, italic credit-style line — tap one to see what else on
            the board shares it (a tag on a one-off isn't tappable). Category is left off
            — it's the inventory, not the vibe. */}
        {tagged && (
          <div style={{ marginTop: 11, fontSize: 12, fontStyle: 'italic', color: '#9A958B', lineHeight: 1.5 }}>
            {taste.filter(a => a.facet !== 'category').map((a, i, arr) => {
              const count = countWithTag(a.facet, a.value)
              const tappable = count > 1
              return (
                <span key={i}>
                  <button disabled={!tappable} onClick={() => tappable && onFilterTag(a.facet, a.value)}
                    style={{ border: 'none', background: 'none', padding: 0, fontFamily: 'inherit', fontSize: 12, fontStyle: 'italic',
                      color: tappable ? '#6E6A60' : '#9A958B', cursor: tappable ? 'pointer' : 'default',
                      textDecoration: tappable ? 'underline' : 'none', textDecorationColor: '#D7D3CC', textUnderlineOffset: 3 }}>
                    {a.value}
                  </button>
                  {i < arr.length - 1 && <span style={{ color: '#CFC9BE' }}>{'  ·  '}</span>}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* For-review nudge — only when the read wasn't sure. An ignorable prompt, not a
          gate: confirm it's right or flip it to media (opens the ⋯ menu in flip mode). */}
      {needsReview && (
        <div style={{ marginTop: 16, padding: '11px 13px', border: `1px solid ${LINE}`, borderRadius: 10, background: '#FBFAF8' }}>
          {flipping ? (
            <>
              <div style={{ fontSize: 12.5, color: INK, marginBottom: 9 }}>move to library as…</div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                {MEDIA_TYPES.map(t => (
                  <button key={t} onClick={() => { setFlipping(false); onFlipToMedia(t) }} style={{ ...quietLink, color: INK, fontWeight: 600 }}>{t}</button>
                ))}
                <button onClick={() => setFlipping(false)} style={quietLink}>cancel</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: INK, marginBottom: 9 }}>Read off your screenshot — does this look right?</div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <button onClick={onClearReview} style={{ ...quietLink, color: INK, fontWeight: 600 }}>looks right</button>
                <button onClick={() => setFlipping(true)} style={quietLink}>it&rsquo;s actually media →</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* The reflection zone — your note and the app's "how it fits" read share one line
          of tabs, one shows at a time (see ReflectionBlock). Only offered once the board
          has a read AND this thing is tagged. Otherwise just your note (+ a one-tap photo
          re-read when an untagged item still has a photo to read). */}
      {fitApplicable ? (
        <ReflectionBlock
          note={p.note ?? null}
          onSaveNote={onSaveNote}
          fit={(item.metadata as { tasteFit?: string })?.tasteFit ?? null}
          fitHidden={(item.metadata as { tasteFitHidden?: boolean })?.tasteFitHidden ?? false}
          onRunFit={onRunFit}
          onToggleHideFit={onToggleHideFit} />
      ) : (
        <div>
          <NoteBlock note={p.note ?? null} onSave={onSaveNote} />
          {p.image && !tagged && (
            <button onClick={onRunTaste} style={{ ...quietLink, display: 'block', marginTop: 16 }}>read taste from photo</button>
          )}
        </div>
      )}

      {plan && <PlanReveal plan={plan} open={showPlan} onToggle={() => setShowPlan(o => !o)} />}
     </div>
    </Sheet>
  )
}

/* ---------- view & sort sheet (tucked behind the control-row icon) ---------- */

// Layout, density, sort and status live here (category is the on-page row). Styled
// to match the media Library's ViewSheet exactly — same drag-handle sheet, the same
// label-left segmented rows, and the same right-aligned chip rows for sort/show — so
// flipping between media and things feels like one app, not two.
function FilterSheet({ sort, onSort, view, onView, caption, onCaption, status, onStatus, polishCount, polishing, onPolishAll, onClose }: {
  sort: SortKey
  onSort: (s: SortKey) => void
  view: ViewMode
  onView: (v: ViewMode) => void
  caption: CardCaption
  onCaption: (c: CardCaption) => void
  status: StatusFilter
  onStatus: (s: StatusFilter) => void
  polishCount: number
  polishing: boolean
  onPolishAll: () => void
  onClose: () => void
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '12px 20px calc(28px + env(safe-area-inset-bottom))', zIndex: 201, maxWidth: 480, margin: '0 auto',
        maxHeight: '90dvh', overflowY: 'auto',
      }}>
        <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 18px' }} />

        <SegRow label="layout" options={[{ k: 'grid', l: 'grid' }, { k: 'list', l: 'list' }]} value={view} onChange={onView} />
        {view === 'grid' && (
          <SegRow label="captions" options={[{ k: 'none', l: 'none' }, { k: 'title', l: 'title' }, { k: 'full', l: 'full' }]} value={caption} onChange={onCaption} />
        )}

        <ChipRow label="sort" options={SORTS.map(s => ({ k: s.key, l: s.label }))} value={sort} onChange={onSort} />
        <ChipRow label="show" options={STATUSES.map(s => ({ k: s.key, l: s.label }))} value={status} onChange={onStatus} />

        {/* Tidy a mixed board: cut each bare product shot onto a cream tile so the
            set reads as one catalog. Only shows when there's something to do. */}
        {polishCount > 0 && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${LINE}` }}>
            <button onClick={onPolishAll} disabled={polishing}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                border: `1px solid ${LINE}`, borderRadius: 10, background: '#fff', padding: '11px 13px',
                cursor: polishing ? 'default' : 'pointer', color: INK, opacity: polishing ? 0.6 : 1,
              }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{polishing ? 'cleaning up…' : 'clean up photos'}</span>
              <span style={{ fontSize: 11.5, color: MUTED }}>{polishCount} to fix ›</span>
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// Label-left + segmented toggle buttons on the right — the Library ViewSheet's
// layout/columns control, generic over the option keys.
function SegRow<T extends string>({ label, options, value, onChange }: {
  label: string; options: { k: T; l: string }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontSize: 14, color: '#3A3A3A' }}>{label}</span>
      {/* Soft segmented control — mirrors the media library's filter card. */}
      <div style={{ display: 'flex', gap: 3, background: '#F4F2EE', padding: 3, borderRadius: 9 }}>
        {options.map(o => {
          const on = value === o.k
          return (
            <button key={o.k} onClick={() => onChange(o.k)} style={{
              padding: '5px 13px', borderRadius: 7, border: '1px solid ' + (on ? '#E2DED7' : 'transparent'),
              background: on ? '#fff' : 'transparent', color: on ? '#1C1B19' : '#999',
              fontSize: 13, fontWeight: on ? 600 : 400, cursor: 'pointer',
            }}>{o.l}</button>
          )
        })}
      </div>
    </div>
  )
}

// Label-left + right-aligned chips — the Library ViewSheet's "sort" row. Replaces
// the old ✓-list rows so sort/show match the media filter card's chip language
// (and drops the iOS-blue ✓ that leaked from the button's default text colour).
function ChipRow<T extends string>({ label, options, value, onChange }: {
  label: string; options: { k: T; l: string }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
      <span style={{ fontSize: 14, color: '#3A3A3A', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
        {options.map(o => (
          <button key={o.k} onClick={() => onChange(o.k)} style={chipStyle(value === o.k)}>{o.l}</button>
        ))}
      </div>
    </div>
  )
}

/* ---------- plan reveal (the deliberation behind a promoted product) ---------- */

// A product that graduated from a plan keeps every option it was weighed against
// (metadata.fromPlan). This pulls those passed-on cards back up — otherwise the
// history is stored but unreachable. Read-only: the thumbnail + title link out to
// each option's page, so you can still revisit (or buy) one you set aside.
function PlanReveal({ plan, open, onToggle }: { plan: PlanRecord; open: boolean; onToggle: () => void }) {
  const others = plan.candidates.filter(c => c.id !== plan.winner)
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
      <button onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', color: INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
        decided from {plan.candidates.length} option{plan.candidates.length === 1 ? '' : 's'}
        <span style={{ fontSize: 11, color: MUTED, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
      </button>

      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plan.brief && (
            <div style={{ padding: '8px 10px', borderRadius: 10, background: '#F7F5F1', fontSize: 11.5, lineHeight: 1.45, color: INK }}>
              <span style={{ fontSize: 10, color: MUTED, letterSpacing: '0.04em', textTransform: 'uppercase' }}>what mattered</span>
              <div style={{ marginTop: 3, whiteSpace: 'pre-wrap' }}>{plan.brief}</div>
            </div>
          )}
          {others.length === 0 ? (
            <div style={{ fontSize: 12, color: MUTED }}>no other options were weighed.</div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: MUTED }}>you passed on:</div>
              {others.map(c => (
                <a key={c.id} href={c.url ?? undefined} target={c.url ? '_blank' : undefined} rel="noreferrer"
                  style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: INK, opacity: 0.85 }}>
                  <Thumb src={c.image} size={48} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.3, textTransform: 'lowercase', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.title || 'untitled'}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2, display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      <PriceLine price={c.price} wasPrice={c.wasPrice} />
                      {(c.brand || c.siteName) && <span>{c.brand || c.siteName}</span>}
                    </div>
                  </div>
                  {c.url && <span style={{ fontSize: 12, color: MUTED, flexShrink: 0 }}>↗</span>}
                </a>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- intent sheet (the deliberation flow) ---------- */

function IntentSheet({ item, onClose, onPatch, onResolve, onSaveWinner, onRename, onDelete }: {
  item: Item
  onClose: () => void
  onPatch: (meta: ReturnType<typeof intentMeta>) => void | Promise<void>
  onResolve: (winnerId: string, meta: ReturnType<typeof intentMeta>) => void | Promise<void>
  onSaveWinner: () => void | Promise<void>
  onRename: (title: string) => void | Promise<void>
  onDelete: () => void
}) {
  const m = intentMeta(item)
  // Your self-described aesthetic + body type, fed into the compare so the weigh-up
  // can speak to fit/silhouette, not just price + reviews.
  const { styleProfile } = usePrefs()
  // The cached compare is only valid while the option set + order is unchanged
  // (notes are positional). If it still lines up, seed the view with it so it
  // survives closing/reopening the plan; otherwise start fresh.
  const candidateSig = m.candidates.map(c => c.id).join(',')
  const storedCompare = m.comparison && m.comparison.candidateIds.join(',') === candidateSig ? m.comparison.result : null
  // One editor for the plan's name + context together (opened from near the
  // context — a fiddly inline title tap read messy).
  const [editingDetails, setEditingDetails] = useState(false)
  const [titleDraft, setTitleDraft] = useState(item.title)
  // "Decided" = a winner is picked. That's distinct from owning it — once decided
  // you can save the winner as a product (onSaveWinner), then mark it got it there.
  const resolved = m.winner != null
  const winner = resolved ? m.candidates.find(c => c.id === m.winner) ?? null : null
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const [manual, setManual] = useState(false)        // fell back to manual entry for a new option
  const [editingId, setEditingId] = useState<string | null>(null) // candidate being edited
  const [comparing, setComparing] = useState(false)
  const [compare, setCompare] = useState<Comparison | null>(() => storedCompare)
  const [compareErr, setCompareErr] = useState<string | null>(null)
  const [briefDraft, setBriefDraft] = useState(m.brief ?? '')
  const openDetails = () => { setTitleDraft(item.title); setBriefDraft(m.brief ?? ''); setEditingDetails(true) }
  const saveDetails = async () => {
    const t = titleDraft.trim()
    if (t && t !== item.title) await onRename(t)
    await onPatch({ ...m, brief: briefDraft.trim() || null })
    setEditingDetails(false)
  }

  async function runCompare() {
    if (comparing) return
    setComparing(true); setCompareErr(null)
    const r = await compareCandidates(item.title, m.candidates, m.brief, styleProfile)
    setComparing(false)
    if (!r.ok) { setCompareErr(r.reason); return }
    setCompare(r.result)
    // Cache it (with the option order it was computed against) so it survives
    // closing/reopening the plan instead of costing another web search.
    void onPatch({ ...m, comparison: { result: r.result, candidateIds: m.candidates.map(c => c.id) } })
  }

  async function addCandidate() {
    const url = link.trim()
    if (!url || busy) return
    setBusy(true); setError(null)
    const r = await parseProductLink(url)
    setBusy(false)
    if (!r.ok) { setError(r.reason); return }
    await saveNewCandidate(r.fields)
  }

  async function saveNewCandidate(fields: ProductFields) {
    const cand: Candidate = { id: newCandidateId(), ...fields }
    // Adding an option changes the line-up, so the cached compare no longer fits.
    setCompare(null)
    await onPatch({ ...m, candidates: [...m.candidates, cand], comparison: null })
    resetAdd()
  }
  function resetAdd() { setLink(''); setAdding(false); setManual(false); setError(null) }

  const setLeaning = (id: string) =>
    onPatch({ ...m, leaning: m.leaning === id ? null : id })

  const removeCandidate = (id: string) => {
    // Removing an option shifts the positional notes, so drop the cached compare.
    setCompare(null)
    return onPatch({ ...m, candidates: m.candidates.filter(c => c.id !== id), leaning: m.leaning === id ? null : m.leaning, comparison: null })
  }

  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: MUTED, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 4 }}>
            {resolved ? 'decided' : 'deciding on'}
          </div>
          {!editingDetails && (
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: INK }}>{item.title}</h2>
          )}
        </div>
        <button onClick={onClose} aria-label="close" style={{ border: 'none', background: 'none', fontSize: 22, color: MUTED, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>×</button>
      </div>

      {/* Name + context, edited together. One "edit" by the context handles both —
          no fiddly inline-title tap. */}
      {editingDetails ? (
        <div style={{ marginTop: 12 }}>
          <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
            placeholder="what are you after? e.g. black clogs"
            style={{ ...inputStyle, width: '100%', fontWeight: 600 }} />
          <textarea value={briefDraft} onChange={e => setBriefDraft(e.target.value)}
            placeholder="what matters? budget, occasion, must-haves, dealbreakers…"
            rows={3} style={{ ...inputStyle, width: '100%', marginTop: 8, resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => { setTitleDraft(item.title); setBriefDraft(m.brief ?? ''); setEditingDetails(false) }}
              style={{ border: 'none', background: 'none', color: MUTED, fontSize: 12.5, cursor: 'pointer' }}>cancel</button>
            <button onClick={saveDetails} disabled={!titleDraft.trim()} style={primaryBtn(!titleDraft.trim())}>save</button>
          </div>
        </div>
      ) : m.brief ? (
        <div onClick={openDetails}
          style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: '#F7F5F1', fontSize: 12.5, lineHeight: 1.5, color: INK, cursor: 'pointer' }}>
          <span style={{ fontSize: 10, color: MUTED, letterSpacing: '0.04em', textTransform: 'uppercase' }}>what matters · tap to edit</span>
          <div style={{ marginTop: 3, whiteSpace: 'pre-wrap' }}>{m.brief}</div>
        </div>
      ) : (
        <button onClick={openDetails}
          style={{ marginTop: 10, border: 'none', background: 'none', color: INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
          + edit name & add context
        </button>
      )}

      {!resolved && m.candidates.length > 0 && (
        <p style={{ fontSize: 12, color: MUTED, margin: '10px 0 0' }}>
          star the one you're leaning toward. pick when you're ready — the options you
          pass on stay part of the decision.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '16px 0' }}>
        {m.candidates.map((c, idx) => {
          const isWinner = resolved && m.winner === c.id
          const isLean = !resolved && m.leaning === c.id
          const dim = resolved && !isWinner
          const aiNote = compare?.notes[idx]
          const aiLeans = compare?.lean === idx + 1
          if (editingId === c.id) {
            return (
              <FieldsForm key={c.id} saveLabel="save"
                initial={{ title: c.title, image: c.image, price: c.price, brand: c.brand, siteName: c.siteName, url: c.url, attributes: c.attributes }}
                onCancel={() => setEditingId(null)}
                onSave={async (f) => {
                  await onPatch({ ...m, candidates: m.candidates.map(x => x.id === c.id ? { ...x, ...f } : x) })
                  setEditingId(null)
                }} />
            )
          }
          return (
            <div key={c.id} style={{
              display: 'flex', gap: 12, padding: 10, borderRadius: 12,
              border: `1px solid ${isWinner ? INK : isLean ? '#C9A24B' : LINE}`,
              opacity: dim ? 0.55 : 1, alignItems: 'center',
            }}>
              <a href={c.url ?? undefined} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                <Thumb src={c.image} size={64} />
              </a>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: INK, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.title || 'Untitled'}</div>
                <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3, display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <PriceLine price={c.price} wasPrice={c.wasPrice} />
                  {(c.brand || c.siteName) && <span>{c.brand || c.siteName}</span>}
                </div>
                {isWinner && <div style={{ fontSize: 11, color: INK, fontWeight: 600, marginTop: 4 }}>✓ chose this</div>}
                {aiNote && (
                  <div style={{ fontSize: 11.5, color: aiLeans ? INK : MUTED, marginTop: 5, lineHeight: 1.4 }}>
                    {aiLeans && <span style={{ fontWeight: 600 }}>✨ leans here · </span>}{aiNote}
                  </div>
                )}
              </div>
              {!resolved && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <button onClick={() => setLeaning(c.id)} aria-label="leaning"
                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, color: isLean ? '#C9A24B' : '#D6D3CC' }}>
                    {isLean ? '★' : '☆'}
                  </button>
                  <button onClick={() => onResolve(c.id, m)}
                    style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: INK, border: 'none', borderRadius: 999, padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    pick this
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditingId(c.id)} aria-label="edit"
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: MUTED }}>edit</button>
                    <button onClick={() => removeCandidate(c.id)} aria-label="remove"
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: MUTED }}>remove</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {m.candidates.length === 0 && !adding && (
          <p style={{ fontSize: 13, color: MUTED, textAlign: 'center', padding: '12px 0' }}>
            no options yet. paste a few product links to weigh them side by side.
          </p>
        )}
      </div>

      {/* Opt-in AI weigh-up — only fires on tap. */}
      {!resolved && m.candidates.length >= 2 && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={runCompare} disabled={comparing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#fff', color: INK, fontSize: 12.5, fontWeight: 600, cursor: comparing ? 'default' : 'pointer' }}>
            ✨ {comparing ? 'thinking…' : compare ? 'compare again' : 'compare these'}
          </button>
          {compare && (
            <button onClick={() => { setCompare(null); setCompareErr(null); void onPatch({ ...m, comparison: null }) }}
              style={{ marginLeft: 10, border: 'none', background: 'none', color: MUTED, fontSize: 12, cursor: 'pointer' }}>
              dismiss
            </button>
          )}
          {compareErr && <div style={{ fontSize: 12, color: '#B4413C', marginTop: 8 }}>{compareErr}</div>}
          {compare?.verdict && (
            <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: '#F7F5F1', fontSize: 12.5, lineHeight: 1.5, color: INK }}>
              {compare.verdict}
              <div style={{ fontSize: 10, color: MUTED, marginTop: 8, letterSpacing: '0.03em' }}>a quick AI take — your call</div>
            </div>
          )}
        </div>
      )}

      {!resolved && (
        manual ? (
          <FieldsForm saveLabel="add option"
            initial={{ title: '', image: null, price: null, brand: null, siteName: null, url: link.trim() || null }}
            onCancel={resetAdd}
            onSave={saveNewCandidate} />
        ) : adding ? (
          <div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                autoFocus value={link} onChange={e => setLink(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCandidate() }}
                placeholder="paste a product link…"
                style={inputStyle}
              />
              <button onClick={addCandidate} disabled={busy || !link.trim()} style={primaryBtn(busy || !link.trim())}>
                {busy ? 'reading…' : 'add'}
              </button>
            </div>
            {error && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 12, color: '#B4413C' }}>{error}</span>
                <button onClick={() => setManual(true)}
                  style={{ marginLeft: 8, border: 'none', background: 'none', color: INK, fontSize: 12, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>add it manually</button>
              </div>
            )}
            <button onClick={resetAdd}
              style={{ marginTop: 8, border: 'none', background: 'none', color: MUTED, fontSize: 12, cursor: 'pointer' }}>cancel</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            style={{ width: '100%', padding: '12px', borderRadius: 12, border: `1px dashed ${MUTED}`, background: 'none', color: INK, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            + add an option
          </button>
        )
      )}

      {/* Decided → graduate the winner into a real product card. Explains itself so
          it isn't a mystery button: the plan becomes the product, history kept. */}
      {resolved && winner && (
        <div style={{ marginTop: 16, padding: '14px', borderRadius: 12, background: '#F7F5F1' }}>
          <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.45 }}>
            you chose <strong>{winner.title.slice(0, 40)}{winner.title.length > 40 ? '…' : ''}</strong>. save it to your things and it
            lives as its own product — ready to mark “got it” when you buy it.
          </div>
          <button onClick={onSaveWinner} style={{ ...primaryBtn(false), width: '100%', marginTop: 10 }}>
            save it to your things →
          </button>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 7 }}>this plan’s history stays with it.</div>
        </div>
      )}

      {/* Un-decide: clear the winner and drop back to weighing. Pairs with the
          product sheet's "put back in plan" — together they make a save fully
          reversible right up until you mark it owned. */}
      {resolved && (
        <button onClick={() => onPatch({ ...m, winner: null })}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, border: 'none', background: 'none', color: MUTED, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
          <span style={{ fontSize: 13 }}>↩</span> change my mind — keep deciding
        </button>
      )}

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onDelete} style={{ border: 'none', background: 'none', color: '#B4413C', fontSize: 12.5, cursor: 'pointer' }}>delete this plan</button>
        {resolved && <span style={{ fontSize: 11.5, color: MUTED }}>chosen from {m.candidates.length} option{m.candidates.length === 1 ? '' : 's'}</span>}
      </div>
    </Sheet>
  )
}

/* ---------- mood board (pure-inspiration images) ---------- */

// A wall of inspiration images: gapless masonry, newest first (Farah s80: wants both
// — a tight wall AND reading top-to-bottom newest-first across the row). CSS can't do
// both at once (columns pack gaplessly but run column-major; a row grid reads right
// but leaves gaps under short tiles), so we lay the columns out in JS: walk the items
// newest-first and drop each into whichever column is currently shortest. Newest tiles
// spread across the top, nothing leaves a gap. Heights aren't known until an image
// loads, so each tile reports its aspect ratio on load and the layout settles in.
// Images keep their natural aspect (never cropped — this is a mood board, not a
// catalog). Editorial: sharp corners, tight 4px gaps.
function MoodWall({ moods, cols, onOpen, onAddUpload, onAddLink }: {
  moods: Item[]; cols: number; onOpen: (id: string) => void; onAddUpload: () => void; onAddLink: () => void
}) {
  // ratio = rendered height / width per tile; all columns are equal width, so a tile's
  // ratio is a fair proxy for the height it adds to its column. Unmeasured tiles use a
  // 4:5 default (matches the "no image" placeholder) so the first paint is balanced.
  const [ratios, setRatios] = useState<Record<string, number>>({})
  const onMeasure = (id: string, r: number) =>
    setRatios(prev => (prev[id] === r ? prev : { ...prev, [id]: r }))

  if (moods.length === 0) return <MoodEmpty onAddUpload={onAddUpload} onAddLink={onAddLink} />

  const columns: Item[][] = Array.from({ length: cols }, () => [])
  const heights = new Array(cols).fill(0)
  for (const item of moods) {
    const shortest = heights.indexOf(Math.min(...heights))
    columns[shortest].push(item)
    heights[shortest] += ratios[item.id] ?? 1.25
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
      {columns.map((col, ci) => (
        <div key={ci} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {col.map(item => (
            <MoodTile key={item.id} item={item} onOpen={() => onOpen(item.id)} onMeasure={onMeasure} />
          ))}
        </div>
      ))}
    </div>
  )
}

function MoodTile({ item, onOpen, onMeasure }: { item: Item; onOpen: () => void; onMeasure: (id: string, ratio: number) => void }) {
  const m = inspirationMeta(item)
  const src = moodSrc(m.image, m.hosted)
  return (
    <button onClick={onOpen}
      style={{ display: 'block', width: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
      {src
        ? <img src={src} onError={imgFallback(m.image)} alt="" loading="lazy"
            onLoad={e => { const t = e.currentTarget; if (t.naturalWidth) onMeasure(item.id, t.naturalHeight / t.naturalWidth) }}
            style={{ width: '100%', display: 'block', background: TILE }} />
        : <div style={{ width: '100%', aspectRatio: '4 / 5', background: TILE, border: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 11 }}>no image</div>}
    </button>
  )
}

function MoodEmpty({ onAddUpload, onAddLink }: { onAddUpload: () => void; onAddLink: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: MUTED }}>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        your mood board is empty.<br />
        save images that capture the look you're after — they feed your taste, no price or link needed.
      </div>
      <button onClick={onAddUpload} style={{ ...primaryBtn(false), marginTop: 18 }}>upload images</button>
      <div style={{ marginTop: 12 }}>
        <button onClick={onAddLink} style={quietLink}>or paste a link</button>
      </div>
    </div>
  )
}

// Add a mood image from a web link — the soft, secondary path (mostly desktop; on a
// phone the FAB goes straight to the photo picker). Upload + clipboard-paste live on
// the FAB / wall, so this sheet is just the URL field.
function MoodLinkComposer({ onClose, onAdd }: { onClose: () => void; onAdd: (url: string) => void | Promise<void> }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  async function run() {
    if (busy || !url.trim()) return
    setBusy(true)
    await onAdd(url)
    setBusy(false)
  }

  return (
    <Sheet onClose={onClose} maxWidth={420}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: INK }}>paste an image link</h2>
      <p style={{ fontSize: 12.5, color: MUTED, margin: '0 0 16px' }}>Drop a link to an image on the web — we'll save the picture. (On your phone, just tap + to upload.)</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input autoFocus value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void run() }}
          placeholder="https://… image link" style={inputStyle} />
        <button onClick={run} disabled={busy || !url.trim()} style={primaryBtn(busy || !url.trim())}>{busy ? 'adding…' : 'add'}</button>
      </div>
    </Sheet>
  )
}

// Tap a mood image → its detail: the full picture, its taste tags, the source it
// came from, and remove. Lighter than the product sheet — an inspiration image has
// no price, buy link, "got it" state, or note (it's a pure visual reference).
function MoodSheet({ item, onClose, onRunTaste, onDelete }: {
  item: Item
  onClose: () => void
  onRunTaste: () => void | Promise<void>
  onDelete: () => void
}) {
  const m = inspirationMeta(item)
  const src = moodSrc(m.image, m.hosted)
  const taste = (m.attributes ?? []).filter(a => a.facet !== 'category')
  const [confirmDel, setConfirmDel] = useState(false)

  return (
    <Sheet onClose={onClose} maxWidth={380}>
     <div style={{ maxWidth: 340, margin: '0 auto' }}>
      <div style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden', background: TILE, border: `1px solid ${LINE}` }}>
        {src
          ? <img src={src} onError={imgFallback(m.image)} alt="" loading="lazy" style={{ width: '100%', display: 'block' }} />
          : <div style={{ width: '100%', aspectRatio: '4 / 5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 12 }}>no image</div>}
        <button onClick={onClose} aria-label="close" style={{
          position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 999,
          border: 'none', background: 'rgba(255,255,255,0.92)', color: INK, fontSize: 18, lineHeight: 1,
          cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      </div>

      {taste.length > 0 && (
        <div style={{ fontSize: 12.5, color: INK, marginTop: 14, letterSpacing: '0.01em' }}>
          {taste.map(a => a.value).join('  ·  ')}
        </div>
      )}

      {m.sourceUrl && (
        <div style={{ marginTop: 12 }}>
          <a href={m.sourceUrl} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: INK, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            source <span style={{ fontSize: 12 }}>↗</span>
          </a>
        </div>
      )}

      {/* Recovery: an image whose look couldn't be auto-read lands here untagged —
          offer a one-tap re-read so it can still feed the taste thread. */}
      {taste.length === 0 && m.image && (
        <button onClick={onRunTaste} style={{ ...quietLink, marginTop: 16 }}>read taste from this image</button>
      )}

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 16 }}>
        {confirmDel ? (
          <>
            <span style={{ fontSize: 12.5, color: MUTED, marginRight: 'auto' }}>remove from your mood board?</span>
            <button onClick={() => setConfirmDel(false)} style={quietLink}>cancel</button>
            <button onClick={onDelete} style={{ ...quietLink, color: '#B4413C', fontWeight: 600 }}>remove</button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ ...quietLink, color: '#B4413C', marginLeft: 'auto' }}>remove</button>
        )}
      </div>
     </div>
    </Sheet>
  )
}

/* ---------- composers ---------- */

// Where a composed product lands: a standalone board product, an option inside an
// existing plan, or the first option of a brand-new plan.
type PlanChoice = { kind: 'none' } | { kind: 'existing'; id: string } | { kind: 'new'; name?: string }

function ProductComposer({ onClose, onSave, onReadScreenshot, intents }: {
  onClose: () => void
  onSave: (f: ProductFields, plan: PlanChoice) => void | Promise<void>
  // Reads a product off a screenshot (upload + crop + vision) — provided by the
  // parent, which holds the auth/upload it needs. Returns prefilled fields.
  onReadScreenshot: (file: File) => Promise<{ ok: true; fields: ProductFields } | { ok: false; reason: string }>
  intents: { id: string; title: string }[]
}) {
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<ProductFields | null>(null)
  const [manual, setManual] = useState(false)
  const [plan, setPlan] = useState<PlanChoice>({ kind: 'none' })
  const [newPlanName, setNewPlanName] = useState('')
  const shotRef = useRef<HTMLInputElement>(null)

  async function read() {
    const url = link.trim()
    if (!url || busy) return
    setBusy(true); setError(null)
    const r = await parseProductLink(url)
    setBusy(false)
    if (!r.ok) { setError(r.reason); return }
    setFields(r.fields)
  }
  async function readShot(file: File) {
    setBusy(true); setError(null)
    const r = await onReadScreenshot(file)
    setBusy(false)
    if (!r.ok) { setError(r.reason); return }
    setFields(r.fields)
  }

  const chip = (label: string, on: boolean, fn: () => void) => (
    <button key={label} onClick={fn} style={{
      padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', flexShrink: 0,
      border: on ? `1px solid ${INK}` : `1px solid ${LINE}`, background: on ? INK : '#fff',
      color: on ? '#fff' : MUTED, textTransform: 'lowercase',
    }}>{label}</button>
  )

  const editing = fields || manual
  return (
    <Sheet onClose={onClose}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: INK }}>save a product</h2>
      <p style={{ fontSize: 12.5, color: MUTED, margin: '0 0 16px' }}>paste a link — or screenshot a shop page the link can't be read from. either way you can tweak it before saving.</p>

      {!editing ? (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <input autoFocus value={link} onChange={e => setLink(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') read() }}
              placeholder="https://…" style={inputStyle} />
            <button onClick={read} disabled={busy || !link.trim()} style={primaryBtn(busy || !link.trim())}>
              {busy ? 'reading…' : 'read'}
            </button>
          </div>
          {/* The screenshot path — folded in here (no longer a separate FAB button) so
              the bot-walled-shop rescue lives right beside the link it backstops. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
            <div style={{ flex: 1, height: 1, background: LINE }} />
            <span style={{ fontSize: 11, color: MUTED }}>or</span>
            <div style={{ flex: 1, height: 1, background: LINE }} />
          </div>
          <button onClick={() => shotRef.current?.click()} disabled={busy}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: INK, fontSize: 13, fontWeight: 500, cursor: busy ? 'default' : 'pointer' }}>
            {busy ? 'reading your screenshot…' : 'screenshot a shop page'}
          </button>
          <input ref={shotRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void readShot(f) }} />
          <button onClick={() => setManual(true)}
            style={{ display: 'block', margin: '12px auto 0', border: 'none', background: 'none', color: MUTED, fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>add it manually</button>
          {error && <div style={{ marginTop: 10, fontSize: 12, color: '#B4413C', textAlign: 'center' }}>{error}</div>}
        </>
      ) : (
        <>
          {/* Plan attachment — keep it standalone, slot it into a plan you're already
              weighing, or start a new plan with it as the first option. */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>add to a plan?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {chip('keep standalone', plan.kind === 'none', () => setPlan({ kind: 'none' }))}
              {intents.length > 0 && chip('existing plan', plan.kind === 'existing', () => setPlan({ kind: 'existing', id: intents[0].id }))}
              {chip('new plan', plan.kind === 'new', () => setPlan({ kind: 'new' }))}
            </div>
            {/* Only once you've chosen "existing" do you pick which one — keeps the top
                row to three clear choices instead of dumping every plan as a chip. */}
            {plan.kind === 'existing' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {intents.map(it => chip(it.title, plan.id === it.id, () => setPlan({ kind: 'existing', id: it.id })))}
              </div>
            )}
            {plan.kind === 'new' && (
              <input autoFocus value={newPlanName} onChange={e => setNewPlanName(e.target.value)}
                placeholder="what are you deciding? e.g. black clogs"
                style={{ ...inputStyle, marginTop: 8 }} />
            )}
          </div>
          <FieldsForm saveLabel={plan.kind === 'none' ? 'save to board' : 'add to plan'}
            initial={fields ?? { title: '', image: null, price: null, brand: null, siteName: null, url: link.trim() || null }}
            onCancel={() => { setFields(null); setManual(false); setError(null); setPlan({ kind: 'none' }) }}
            onSave={(f) => onSave({ ...f, shotType: fields?.shotType ?? null }, plan.kind === 'new' ? { kind: 'new', name: newPlanName.trim() || undefined } : plan)} />
        </>
      )}
    </Sheet>
  )
}

function IntentComposer({ onClose, onCreate }: { onClose: () => void; onCreate: (need: string, brief: string) => void | Promise<void> }) {
  const [need, setNeed] = useState('')
  const [brief, setBrief] = useState('')
  return (
    <Sheet onClose={onClose}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: INK }}>plan a purchase</h2>
      <p style={{ fontSize: 12.5, color: MUTED, margin: '0 0 16px' }}>Name what you're after. You'll add options to weigh, then pick one when you're ready.</p>
      <input autoFocus value={need} onChange={e => setNeed(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && need.trim()) onCreate(need.trim(), brief.trim()) }}
        placeholder="e.g. black clogs" style={{ ...inputStyle, width: '100%' }} />
      <textarea value={brief} onChange={e => setBrief(e.target.value)}
        placeholder="what matters? budget, occasion, must-haves, dealbreakers… (optional — helps compare)"
        rows={3} style={{ ...inputStyle, width: '100%', marginTop: 8, resize: 'vertical', fontFamily: 'inherit' }} />
      <button onClick={() => need.trim() && onCreate(need.trim(), brief.trim())} disabled={!need.trim()}
        style={{ ...primaryBtn(!need.trim()), width: '100%', padding: 12, marginTop: 10 }}>start</button>
    </Sheet>
  )
}

/* ---------- shared bits ---------- */

// Editable product fields — used to tweak a scraped result, fix a junky title,
// swap the photo (paste any image URL), or enter something by hand when a shop's
// link won't read (luxury sites behind bot protection, slow pages, etc.).
function FieldsForm({ initial, saveLabel, onSave, onCancel }: {
  initial: ProductFields
  saveLabel: string
  onSave: (f: ProductFields) => void | Promise<void>
  onCancel: () => void
}) {
  // Keep raw input in state (don't trim per keystroke — that ate spaces, so "Max
  // Mara" was untypable). Trim once on save instead.
  const [f, setF] = useState<ProductFields>(initial)
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<ProductFields>) => setF(prev => ({ ...prev, ...patch }))
  const norm = (s: string | null | undefined) => { const t = (s ?? '').trim(); return t || null }
  const empty = (s: string | null | undefined) => !(s ?? '').trim()

  // Gap-fill from the link — for a screenshot-saved product that had no link, then
  // got one. Reads the page and fills ONLY the fields that are still empty (usually
  // a clean catalog photo + current price), never overwriting anything you have or
  // typed. Populates the form so you review before saving; your taste tags are left
  // untouched. Offered only when there's a link and a real gap to fill.
  const [pulling, setPulling] = useState(false)
  const [pullMsg, setPullMsg] = useState<string | null>(null)
  // A screenshot photo counts as a gap: once there's a link, we'd rather have the
  // clean shop photo than the grainy crop. So offer the pull when the link can
  // plausibly add something — a missing photo/price, or a screenshot to upgrade.
  const canPull = !empty(f.url) && (empty(f.image) || empty(f.price) || !!f.imageFromShot)
  async function pullFromLink() {
    const url = (f.url ?? '').trim()
    if (!url || pulling) return
    setPulling(true); setPullMsg(null)
    const r = await parseProductLink(url)
    setPulling(false)
    if (!r.ok) { setPullMsg(r.reason || "couldn't read that link"); return }
    const g = r.fields
    const patch: Partial<ProductFields> = {}
    // Upgrade a screenshot crop to the real shop photo (not just fill an empty slot),
    // and clear the flag so it's treated as a clean catalog image from here on.
    if ((empty(f.image) || f.imageFromShot) && g.image) { patch.image = g.image; patch.imageFromShot = false }
    if (empty(f.price) && g.price) patch.price = g.price
    if (empty(f.wasPrice) && g.wasPrice) patch.wasPrice = g.wasPrice
    if (empty(f.brand) && g.brand) patch.brand = g.brand
    if (empty(f.title) && g.title) patch.title = g.title
    if (empty(f.siteName) && g.siteName) patch.siteName = g.siteName
    const n = Object.keys(patch).length
    if (n) { set(patch); setPullMsg(`updated ${n} field${n === 1 ? '' : 's'} — review and save`) }
    else setPullMsg('nothing new — your fields already have it')
  }

  async function save() {
    setSaving(true)
    await onSave({
      title: f.title.trim(),
      image: norm(f.image),
      price: norm(f.price),
      wasPrice: norm(f.wasPrice),
      brand: norm(f.brand),
      siteName: f.siteName ?? null,
      url: norm(f.url),
      attributes: f.attributes ?? [],
      imageFromShot: f.imageFromShot ?? null,
    })
    setSaving(false)
  }

  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Thumb src={f.image} size={72} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={f.title} onChange={e => set({ title: e.target.value })} placeholder="name" style={{ ...inputStyle, fontWeight: 500 }} />
          <input value={f.image ?? ''} onChange={e => set({ image: e.target.value })} placeholder="image url — paste to change the photo" style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={f.price ?? ''} onChange={e => set({ price: e.target.value })} placeholder="price" style={inputStyle} />
        <input value={f.wasPrice ?? ''} onChange={e => set({ wasPrice: e.target.value })} placeholder="was (if on sale)" style={inputStyle} />
      </div>
      <input value={f.brand ?? ''} onChange={e => set({ brand: e.target.value })} placeholder="brand" style={inputStyle} />
      <input value={f.url ?? ''} onChange={e => set({ url: e.target.value })} placeholder="buy link (kept even if it doesn't preview)" style={inputStyle} />
      {canPull && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginTop: -2 }}>
          <button type="button" onClick={pullFromLink} disabled={pulling}
            style={{ alignSelf: 'flex-start', border: 'none', background: 'none', color: INK, fontSize: 12.5, fontWeight: 600, cursor: pulling ? 'default' : 'pointer', padding: 0 }}>
            {pulling ? 'reading the link…' : 'pull photo & price from link'}
          </button>
          {pullMsg && <span style={{ fontSize: 11.5, color: MUTED }}>{pullMsg}</span>}
        </div>
      )}
      <AttributesEditor value={f.attributes ?? []} onChange={attributes => set({ attributes })} />
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', marginTop: 2 }}>
        <button onClick={onCancel} style={{ border: 'none', background: 'none', color: MUTED, fontSize: 12.5, cursor: 'pointer' }}>cancel</button>
        <button disabled={saving || !f.title.trim()} onClick={save}
          style={primaryBtn(saving || !f.title.trim())}>{saveLabel}</button>
      </div>
    </div>
  )
}

// Taste-tag editor — the data that feeds the board's "thread" read. Suggested
// chips are tap-to-add convenience; the text box accepts anything, so the vocab
// grows from real saves rather than a fixed list.
function AttributesEditor({ value, onChange }: { value: Attribute[]; onChange: (a: Attribute[]) => void }) {
  const [open, setOpen] = useState(value.length > 0)
  const [facet, setFacet] = useState<Facet>(EDIT_FACETS[0])
  const [draft, setDraft] = useState('')

  const has = (f: Facet, v: string) => value.some(a => a.facet === f && normValue(a.value) === normValue(v))
  const add = (f: Facet, raw: string) => {
    const v = raw.trim()
    if (!v || has(f, v)) return
    onChange([...value, { facet: f, value: v }])
  }
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        style={{ alignSelf: 'flex-start', border: 'none', background: 'none', color: INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
        + add taste tags
      </button>
    )
  }

  const suggestions = SUGGESTED[facet].filter(s => !has(facet, s))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
      <span style={{ fontSize: 10, color: MUTED, letterSpacing: '0.04em', textTransform: 'uppercase' }}>taste tags</span>

      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {value.map((a, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: INK, background: '#F4F2EE', borderRadius: 999, padding: '4px 8px' }}>
              <span style={{ color: MUTED }}>{FACET_LABEL[a.facet].toLowerCase()}</span>{a.value}
              <button type="button" onClick={() => remove(i)} aria-label="remove tag"
                style={{ border: 'none', background: 'none', color: MUTED, cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Quiet underline tabs — pick which facet you're adding. Lighter than filled
          pills so the section reads editorial, not like a button bar. */}
      <div style={{ display: 'flex', gap: 16, borderBottom: `1px solid ${LINE}`, marginBottom: 2 }}>
        {EDIT_FACETS.map(fc => (
          <button key={fc} type="button" onClick={() => setFacet(fc)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 0 7px', fontSize: 12,
              color: facet === fc ? INK : MUTED, borderBottom: `1.5px solid ${facet === fc ? INK : 'transparent'}`, marginBottom: -1 }}>
            {FACET_LABEL[fc].toLowerCase()}
          </button>
        ))}
      </div>

      {/* Suggestions share the saved-tag pill so the whole section is one material. */}
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {suggestions.map(s => (
            <button key={s} type="button" onClick={() => add(facet, s)}
              style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 999, border: 'none', background: '#F4F2EE', color: '#56564F', cursor: 'pointer' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${LINE}`, paddingBottom: 4 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(facet, draft); setDraft('') } }}
          placeholder={`add your own ${FACET_LABEL[facet].toLowerCase()}…`}
          style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: 12.5, color: INK, padding: '4px 0' }} />
        <button type="button" onClick={() => { add(facet, draft); setDraft('') }} disabled={!draft.trim()} aria-label="add tag"
          style={{ border: 'none', background: 'none', cursor: draft.trim() ? 'pointer' : 'default', fontSize: 18, color: draft.trim() ? INK : MUTED, lineHeight: 1, padding: 0 }}>+</button>
      </div>
    </div>
  )
}

// Price line that shows a struck-through original + a "sale" tag when on sale.
function PriceLine({ price, wasPrice }: { price: string | null; wasPrice?: string | null }) {
  if (!price && !wasPrice) return null
  const onSale = !!(wasPrice && price)
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'baseline', flexWrap: 'wrap' }}>
      {price && <span style={{ color: INK }}>{formatPrice(price)}</span>}
      {wasPrice && <span style={{ textDecoration: 'line-through', color: MUTED, fontSize: '0.92em' }}>{formatPrice(wasPrice)}</span>}
      {onSale && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', color: '#B4413C', border: '1px solid #E3C3C1', borderRadius: 4, padding: '0 4px', textTransform: 'uppercase' }}>sale</span>}
    </span>
  )
}

// If the server trim/proxy can't be reached (offline dev, a transient 5xx), drop
// back to the original photo URL so we never show a broken image. `data-fb` guards
// against a fallback loop.
function imgFallback(original: string | null | undefined) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (original && !img.dataset.fb) { img.dataset.fb = '1'; img.src = original }
  }
}

function Thumb({ src, size, referer, cutout, fallback }: { src: string | null; size?: number; referer?: string | null; cutout?: string | null; fallback?: React.ReactNode }) {
  // Grid/hero thumbs: every photo is auto-trimmed to its product and re-framed to a
  // shared 4:5 by the server (api/thing-image), so the board reads as one catalog
  // (no more specks-in-grey-fields or blurred halos), sharp at any zoom. The endpoint
  // 302s to the original if it can't improve on it, so this is just a plain <img>.
  // Inline list thumbs (size set) stay square + cover; they're small avatars beside
  // text, not worth a round-trip.
  const isGrid = !size
  // s74 — two clean treatments on one cool-gray tile, so the board reads as a catalog:
  //   - a product CUTOUT (transparent PNG) → floats on the gray with breathing room.
  //   - a model/lifestyle PHOTO → fills the tile edge-to-edge (cover). Never floated:
  //     a photo has its own background, so floating it just boxes a white/grey rectangle
  //     inside the tile — the exact "box-in-box" we're killing.
  // Inline list thumbs (size set) stay square + cover — small avatars beside text.
  if (isGrid) {
    return (
      <div style={{
        width: '100%', aspectRatio: '4 / 5', background: TILE, overflow: 'hidden',
        border: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {cutout
          ? <img src={cutout} onError={imgFallback(thingImageRaw(src, referer) ?? src)} alt="" loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '8%', boxSizing: 'border-box' }} />
          : (thingImageRaw(src, referer) ?? src)
          ? <img src={thingImageRaw(src, referer) ?? src!} onError={imgFallback(src)} alt="" loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.95)' }} />
          : (fallback ?? <span style={{ color: MUTED, fontSize: 11 }}>no image</span>)}
      </div>
    )
  }
  return (
    <div style={{
      width: size, height: size, background: TILE, overflow: 'hidden',
      border: `1px solid ${LINE}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {src
        ? <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.95)' }} />
        : <span style={{ color: MUTED, fontSize: 11 }}>no image</span>}
    </div>
  )
}

// A labelled action that pops above the floating + (speed-dial style).
function FabAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '9px 16px', borderRadius: 999, border: `1px solid ${LINE}`,
      background: '#fff', color: INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
      boxShadow: '0 2px 12px rgba(0,0,0,0.14)', whiteSpace: 'nowrap',
    }}>{label}</button>
  )
}

// Tab-chip for the status row: active reads ink + bold + italic AND carries a
// 1.5px underline rule — the italic alone was too subtle to scan on a phone, so
// the rule does the work the eye needs at a glance.
function TabChip({ label, active, onClick, underline = true }: { label: string; active: boolean; onClick: () => void; underline?: boolean }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 1px 7px',
      whiteSpace: 'nowrap', fontSize: 13, color: active ? '#111' : '#888',
      fontWeight: active ? 600 : 400, fontStyle: active ? 'italic' : 'normal',
      // Category chips keep the underline rule; the taste sub-tabs drop it to
      // match the media taste page (bold+italic active state, no underline).
      // Must be explicit 'none' — leaving it undefined lets the UA default
      // button border (2px outset) show through as a stray underline.
      borderBottom: underline ? (active ? '1.5px solid #111' : '1.5px solid transparent') : 'none',
    }}>{label}</button>
  )
}

function Empty() {
  return (
    <div style={{ textAlign: 'center', padding: '64px 32px' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: INK, marginBottom: 6 }}>
        your board is empty
      </div>
      <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
        tap <span style={{ fontWeight: 600, color: INK }}>+</span> to save a product you love, or plan a purchase you’re weighing.
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 10, border: `1px solid ${LINE}`,
  fontSize: 13, color: INK, outline: 'none', background: '#fff',
}

// One shared treatment for every quiet text-link action on the product sheet (edit,
// add a note, read taste, put back, remove…) so they read as a consistent set rather
// than a scatter of one-off button styles.
const quietLink: React.CSSProperties = {
  border: 'none', background: 'none', color: MUTED, fontSize: 12.5, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 16px', borderRadius: 10, border: 'none',
    background: disabled ? '#D6D3CC' : INK, color: '#fff', fontSize: 13, fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap',
  }
}
