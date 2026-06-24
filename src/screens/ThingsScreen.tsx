import { useMemo, useState, useRef, useEffect } from 'react'
import { DomainSwitcher } from '../components/DomainSwitcher'
import { CapturesSheet } from '../components/CapturesSheet'
import { fetchCaptures, clearCapture, isFailure, isThingsCapture, type EmailCapture } from '../lib/captures'
import { useItems } from '../hooks/useItems'
import type { Item } from '../lib/database.types'
import {
  parseProductLink, compareCandidates, readImageAttributes, kindOf, intentMeta, productMeta, newCandidateId,
  promoteIntentToProduct, demoteProductToIntent, productPlan,
  EDIT_FACETS, FACET_LABEL, SUGGESTED, normValue, readThread, itemAttributes, THREAD_MIN_ITEMS, priceValue,
  type Candidate, type ProductFields, type Comparison, type Attribute, type Facet, type PlanRecord,
} from '../lib/things'

const INK = '#1C1B19'
const MUTED = '#ABA69C'
const LINE = '#E8E8E8'

type SortKey = 'recent' | 'price' | 'name'
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'recent' },
  { key: 'price', label: 'price' },
  { key: 'name', label: 'a–z' },
]

// Grid density — a manual override on top of the responsive column count. "roomy"
// is the default (today's behaviour, bigger cards); "dense" packs more per row.
// The value is the px-per-column target fed to the responsive measure: a smaller
// target yields more columns. Persisted so the choice sticks across sessions.
type Density = 'roomy' | 'dense'
const DENSITY_TARGET: Record<Density, number> = { roomy: 240, dense: 168 }
const DENSITY_KEY = 'nospaces.thingsDensity'
function loadDensity(): Density {
  try { return localStorage.getItem(DENSITY_KEY) === 'dense' ? 'dense' : 'roomy' } catch { return 'roomy' }
}

// Grid (visual wall) vs list (the plan-style row: square thumb + title + price).
// Persisted like density so the choice sticks.
type ViewMode = 'grid' | 'list'
const VIEW_KEY = 'nospaces.thingsView'
function loadView(): ViewMode {
  try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid' } catch { return 'grid' }
}

// Category values a thing carries (for the filter row). Products use their own
// tags; resolved intents use the winner's. Untagged things match nothing but
// still show under "all".
function categoriesOf(item: Item): string[] {
  return itemAttributes(item).filter(a => a.facet === 'category').map(a => normValue(a.value))
}

// Lifecycle bucket for the status filter. Every thing lands in exactly one:
//   - a plan with no winner yet → "deciding"
//   - a plan you've picked a winner on (but not yet saved as a product) → "decided"
//   - a saved-but-unowned product → "saved"
//   - a product you own → "got"
// A plan is bucketed by its winner, not status — "decided" means chosen, not owned.
// Once you save a decided plan's winner it becomes a product (promoteIntentToProduct)
// and flows through saved → got like anything else.
type Bucket = 'saved' | 'deciding' | 'decided' | 'got'
function statusBucket(item: Item): Bucket {
  if (kindOf(item) === 'intent') return intentMeta(item).winner ? 'decided' : 'deciding'
  return item.status === 'done' ? 'got' : 'saved'
}
// One fewer chip on the phone: "deciding" covers the whole deliberation lifecycle
// (a plan still weighing *or* one you've decided but not yet saved as a product).
// The card still reads "decided · X", and the save-as-product CTA still lives in
// the plan sheet — so the distinction isn't lost, the filter row is just calmer.
type StatusFilter = 'all' | 'saved' | 'deciding' | 'got'
const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'all' },
  { key: 'saved', label: 'saved' },
  { key: 'deciding', label: 'deciding' },
  { key: 'got', label: 'got it' },
]
function matchesStatus(item: Item, f: StatusFilter): boolean {
  if (f === 'all') return true
  const b = statusBucket(item)
  if (f === 'deciding') return b === 'deciding' || b === 'decided'
  return b === f
}

// The price a thing sorts by: a product's own, or an intent's front-runner
// (winner → leaning → first candidate). Null when there's nothing to read.
function thingPrice(item: Item): number | null {
  if (kindOf(item) === 'product') return priceValue(productMeta(item).price)
  const m = intentMeta(item)
  const cover = m.candidates.find(c => c.id === m.winner) ?? m.candidates.find(c => c.id === m.leaning) ?? m.candidates[0]
  return priceValue(cover?.price ?? null)
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
  const { items, addItem, editItem, deleteItem } = useItems()
  const [composer, setComposer] = useState<null | 'product' | 'intent'>(null)
  const [openIntentId, setOpenIntentId] = useState<string | null>(null)
  const [openProductId, setOpenProductId] = useState<string | null>(null)
  // Speed-dial for the floating +: open reveals the two capture paths.
  const [addMenu, setAddMenu] = useState(false)
  // Responsive grid: more columns as the board gets wider (≈2 on a phone, up to
  // ~5 on a desktop), so it fills the page like the rest of the app instead of a
  // fixed 2-up locked to a narrow column. Measured off the scroller's own width.
  const listRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(2)
  const [density, setDensity] = useState<Density>(loadDensity)
  const [view, setView] = useState<ViewMode>(loadView)
  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view) } catch { /* private mode */ } }, [view])
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const measure = () => setCols(Math.max(2, Math.floor(el.clientWidth / DENSITY_TARGET[density])))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [density])
  useEffect(() => { try { localStorage.setItem(DENSITY_KEY, density) } catch { /* private mode */ } }, [density])
  const [sort, setSort] = useState<SortKey>('recent')
  const [cat, setCat] = useState<string | null>(null)
  const [statusF, setStatusF] = useState<StatusFilter>('all')
  const [filterSheet, setFilterSheet] = useState(false)
  // Forwarded product links that didn't land (logged server-side by /api/email).
  // Surfaced here so a failed email capture isn't invisible from the board — the
  // same "review failed forwards" feed the Library has, scoped to things.
  const [captures, setCaptures] = useState<EmailCapture[]>([])
  const [capturesOpen, setCapturesOpen] = useState(false)
  useEffect(() => { fetchCaptures().then(cs => setCaptures(cs.filter(isThingsCapture))) }, [])
  const captureFailures = useMemo(() => captures.filter(isFailure).length, [captures])
  const [flash, setFlash] = useState<string | null>(null)
  // Toast for the vision auto-tag result. Success auto-fades; a failure stays put
  // (tap to dismiss) so the reason is readable — no silent no-ops.
  const showFlash = (msg: string, sticky = false) => {
    setFlash(msg)
    if (!sticky) window.setTimeout(() => setFlash(null), 3500)
  }

  const things = useMemo(() => items.filter(i => kindOf(i) !== null), [items])
  const sorted = useMemo(() => sortThings(things, sort), [things, sort])
  // Distinct categories present across the board, for the filter row.
  const categories = useMemo(() => {
    const set = new Set<string>()
    things.forEach(t => categoriesOf(t).forEach(c => set.add(c)))
    return [...set].sort()
  }, [things])
  const visible = useMemo(() => {
    let r = sorted
    if (statusF !== 'all') r = r.filter(t => matchesStatus(t, statusF))
    if (cat) r = r.filter(t => categoriesOf(t).includes(cat))
    return r
  }, [sorted, cat, statusF])
  const openIntent = things.find(i => i.id === openIntentId) ?? null
  const openProduct = things.find(i => i.id === openProductId) ?? null

  // Slice 4 — read taste tags off a freshly-saved product's image and patch them
  // in. Runs in the background so the save itself is instant; the board's masthead
  // picks them up on the next render. Merges, never clobbers manual tags. A brief
  // toast confirms it ran (and surfaces why, if the photo couldn't be read) — so
  // it's never a silent no-op.
  async function autoTagFromImage(id: string, f: ProductFields) {
    if (!f.image) return
    setFlash('reading taste from the photo…')
    const r = await readImageAttributes(f.image, f.url)
    if (!r.ok) { showFlash(`couldn't read the photo — ${r.reason} (tap to dismiss)`, true); return }
    if (r.attributes.length === 0) { showFlash('no clear taste tags from that photo (tap to dismiss)', true); return }
    const existing = f.attributes ?? []
    const have = new Set(existing.map(a => a.facet))
    const fresh = r.attributes.filter(a => !have.has(a.facet))
    if (fresh.length === 0) { showFlash('no new taste tags to add'); return }
    await editItem(id, { metadata: { kind: 'product', ...f, attributes: [...existing, ...fresh] } })
    showFlash(`added ${fresh.length} taste tag${fresh.length === 1 ? '' : 's'}: ${fresh.map(a => a.value).join(' · ')}`)
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
          position: 'fixed', left: '50%', bottom: 'calc(80px + env(safe-area-inset-bottom))', transform: 'translateX(-50%)',
          background: INK, color: '#fff', fontSize: 12.5, padding: '9px 14px', borderRadius: 999, cursor: 'pointer',
          maxWidth: '90vw', textAlign: 'center', zIndex: 300, boxShadow: '0 4px 18px rgba(0,0,0,0.2)',
        }}>{flash}</div>
      )}

      {/* One scroller. The switcher + title + thread masthead scroll away
          naturally (no JS height animation — that was the jumpy part); only the
          sort + category bar is position:sticky, so it pins smoothly on its own. */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '20px 16px 0' }}>
          <DomainSwitcher current="things" />
          {/* Magazine header — small kicker + label + rule (shared treatment with Library) */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: MUTED, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 5 }}>
                {things.length === 0 ? 'the board' : `${things.length} on the board`}
              </div>
              <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: INK }}>things</h1>
            </div>
          </div>
          <div style={{ borderBottom: `1.5px solid ${INK}` }} />
          <ThreadMasthead things={things} />
          {captures.length > 0 && (
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
        {statusRow && (
          <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: `1px solid ${LINE}`, padding: '6px 16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 8 }}>
              <div style={{ display: 'flex', gap: 16, overflowX: 'auto', scrollbarWidth: 'none', flex: 1, minWidth: 0 }}>
                {/* Category is the primary on-page filter; status/sort/layout live in
                    the view sheet. Only show chips once there's a category to filter. */}
                {categories.length > 0 && (
                  <>
                    <TabChip label="all" active={cat === null} onClick={() => setCat(null)} />
                    {categories.map(c => (
                      <TabChip key={c} label={c} active={cat === c} onClick={() => setCat(cat === c ? null : c)} />
                    ))}
                  </>
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

        <div style={{ padding: '16px 16px 120px' }}>
          {things.length === 0 ? (
            <Empty />
          ) : visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: MUTED, fontSize: 13 }}>
              {cat ? <>nothing tagged “{cat}” yet.</>
                : statusF === 'saved' ? 'nothing saved yet.'
                : statusF === 'deciding' ? 'nothing in the works.'
                : statusF === 'got' ? 'nothing marked got it yet.'
                : 'nothing here yet.'}
            </div>
          ) : view === 'list' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visible.map(item => (
                kindOf(item) === 'intent'
                  ? <IntentRow key={item.id} item={item} onOpen={() => setOpenIntentId(item.id)} />
                  : <ProductRow key={item.id} item={item} onOpen={() => setOpenProductId(item.id)} />
              ))}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              // minmax(0,1fr) — without the 0 floor, a card's no-wrap attribute line
              // forces its column wider and squashes the neighbour (the "one grew,
              // one shrank" bug). align-items:start so a taller card doesn't stretch
              // its row-mate. Column count is responsive (see `cols`).
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              alignItems: 'start',
              gap: 12,
            }}>
              {visible.map(item => (
                kindOf(item) === 'intent'
                  ? <IntentCard key={item.id} item={item} onOpen={() => setOpenIntentId(item.id)} />
                  : <ProductCard key={item.id} item={item} onOpen={() => setOpenProductId(item.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {composer === 'product' && (
        <ProductComposer
          onClose={() => setComposer(null)}
          onSave={async (f) => {
            const id = await addItem(f.title || 'Untitled', 'thing', f.brand, null, { kind: 'product', ...f })
            setComposer(null)
            // Slice 4 — auto-read taste tags off the image in the background, so the
            // board mirrors you without manual tagging. Only when there's an image
            // and the user hasn't already tagged it. Best-effort: a failure just
            // leaves it untagged. ~$0.01 a call (Sonnet vision).
            if (id && f.image && !(f.attributes && f.attributes.length)) {
              void autoTagFromImage(id, f)
            }
          }}
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

      {openIntent && (
        <IntentSheet
          item={openIntent}
          onClose={() => setOpenIntentId(null)}
          onPatch={(meta) => editItem(openIntent.id, { metadata: meta })}
          onResolve={(winnerId, meta) =>
            editItem(openIntent.id, { metadata: { ...meta, winner: winnerId } })}
          onSaveWinner={async () => {
            // Promote the chosen candidate into a real product card in place: the
            // plan *becomes* the product (deliberation history kept in metadata),
            // landing in "saved" so you can mark it "got it" once you own it.
            const meta = promoteIntentToProduct(openIntent)
            if (!meta) return
            const id = openIntent.id
            await editItem(id, { title: meta.title || 'Untitled', creator: meta.brand, status: 'want_to', metadata: meta })
            setOpenIntentId(null)
            // A promoted winner is a saved product like any other — auto-read its
            // taste tags off the image so it feeds the keywords + filters too.
            // Only when it has an image and the winner wasn't already tagged.
            // ~1¢ (Sonnet vision), background, best-effort. autoTagFromImage spreads
            // the full meta back, so fromPlan history survives the patch.
            if (meta.image && !(meta.attributes && meta.attributes.length)) {
              void autoTagFromImage(id, meta)
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
          onDelete={async () => { await deleteItem(openProduct.id); setOpenProductId(null) }}
        />
      )}

      {filterSheet && (
        <FilterSheet
          view={view} onView={setView}
          density={density} onDensity={setDensity}
          sort={sort} onSort={setSort}
          status={statusF} onStatus={setStatusF}
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
          board has no bottom nav, so it anchors to the bottom-right on its own.
          Tapping reveals the two capture paths; tapping the scrim or × closes. */}
      {addMenu && (
        <div onClick={() => setAddMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
      )}
      <div style={{ position: 'fixed', right: 20, bottom: 'calc(24px + env(safe-area-inset-bottom))', zIndex: 99, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
        {addMenu && (
          <>
            <FabAction label="save a product" onClick={() => { setAddMenu(false); setComposer('product') }} />
            <FabAction label="plan a purchase" onClick={() => { setAddMenu(false); setComposer('intent') }} />
          </>
        )}
        <button onClick={() => setAddMenu(m => !m)} aria-label={addMenu ? 'close add menu' : 'add'}
          style={{
            width: 50, height: 50, borderRadius: '50%', background: INK, color: '#fff', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 16px rgba(0,0,0,0.22)', transition: 'transform 0.18s ease',
            transform: addMenu ? 'rotate(45deg)' : 'none', alignSelf: 'flex-end',
          }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ---------- the thread masthead (the board read back as a taste mirror) ---------- */

// The whole point of Things: the *set* speaks. Once enough items are tagged, the
// recurring attributes across the board become a short aesthetic read. Pure +
// free (just renders readThread). Stays quiet until there's real signal so it
// never guesses on a sparse board.
function ThreadMasthead({ things }: { things: Item[] }) {
  const thread = useMemo(() => readThread(things), [things])
  const tagged = useMemo(() => things.filter(t => itemAttributes(t).length > 0).length, [things])

  if (things.length === 0) return null

  if (thread) {
    // No second uppercase kicker here — the page already has one ("N on the board").
    // The keyword line leads; "your keywords" folds into the caption so the meaning
    // stays without stacking two kickers under the rule.
    return (
      <div style={{ margin: '14px 0 18px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: INK, lineHeight: 1.15, letterSpacing: '-0.01em' }}>
          {thread.tokens.join('  ·  ')}
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
          your keywords — read from {thread.basis} tagged thing{thread.basis === 1 ? '' : 's'}, shifts as you save and tag more
        </div>
      </div>
    )
  }

  // Below the threshold (or nothing recurs yet) — a gentle nudge, never a nag.
  return (
    <div style={{ margin: '16px 0 20px', fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
      Tag your things — material, palette, form — and your <em>keywords</em> show up here.
      {tagged > 0 && <span style={{ color: INK, fontWeight: 600 }}> {tagged}/{THREAD_MIN_ITEMS} tagged.</span>}
    </div>
  )
}

/* ---------- cards ---------- */

// Tapping the card opens an internal detail sheet (like the media Library) — the
// external buy link lives behind an explicit button inside, so a stray tap never
// bounces you off the site.
function ProductCard({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const p = productMeta(item)
  const got = item.status === 'done'
  // The card's taste line shows material/palette/vibe only — category is already
  // the filter row above, so repeating it under the item reads redundant.
  const taste = (p.attributes ?? []).filter(a => a.facet !== 'category')
  return (
    <button onClick={onOpen}
      style={{ position: 'relative', textAlign: 'left', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: INK, display: 'block', width: '100%' }}>
      <Thumb src={p.image} />
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 12.5, lineHeight: 1.3, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textTransform: 'lowercase' }}>
          {p.title}
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 2, display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <PriceLine price={p.price} wasPrice={p.wasPrice} />
          {p.brand ? <span>{p.brand}</span> : p.siteName && <span>{p.siteName}</span>}
          {/* Status as a quiet caption mark, not a pill floating on the photo. */}
          {got && <span style={{ color: INK, fontWeight: 600 }}>· got it</span>}
        </div>
        {taste.length > 0 && (
          <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3, letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {taste.map(a => a.value).join(' · ')}
          </div>
        )}
      </div>
    </button>
  )
}

function IntentCard({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const m = intentMeta(item)
  const resolved = m.winner != null
  const winner = resolved ? m.candidates.find(c => c.id === m.winner) : null
  const lean = !resolved && m.leaning ? m.candidates.find(c => c.id === m.leaning) : null
  const cover = winner ?? lean ?? m.candidates[0] ?? null
  const n = m.candidates.length
  // Status lives in the caption now (not a pill on the photo) — the count the pill
  // used to carry folds in here, so a deciding card still reads at a glance.
  const status = resolved
    ? (winner ? `decided · ${winner.title.slice(0, 22)}${winner.title.length > 22 ? '…' : ''}` : 'decided')
    : lean ? `leaning · ${lean.title.slice(0, 20)}${lean.title.length > 20 ? '…' : ''}`
    : n ? `deciding · ${n} option${n === 1 ? '' : 's'}`
    : 'tap to add options'
  return (
    <button onClick={onOpen}
      style={{ textAlign: 'left', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
      <Thumb src={cover?.image ?? null} />
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 12.5, lineHeight: 1.3, fontWeight: 600, color: INK, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textTransform: 'lowercase' }}>
          {item.title}
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{status}</div>
      </div>
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
    <button onClick={onOpen}
      style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left', border: `1px solid ${LINE}`, borderRadius: 12, background: '#fff', padding: 10, cursor: 'pointer', color: INK }}>
      <Thumb src={p.image} size={64} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, textTransform: 'lowercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
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

function IntentRow({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const m = intentMeta(item)
  const resolved = m.winner != null
  const winner = resolved ? m.candidates.find(c => c.id === m.winner) : null
  const lean = !resolved && m.leaning ? m.candidates.find(c => c.id === m.leaning) : null
  const cover = winner ?? lean ?? m.candidates[0] ?? null
  const n = m.candidates.length
  const status = resolved
    ? (winner ? `decided · ${winner.title.slice(0, 30)}${winner.title.length > 30 ? '…' : ''}` : 'decided')
    : lean ? `leaning · ${lean.title.slice(0, 28)}${lean.title.length > 28 ? '…' : ''}`
    : n ? `deciding · ${n} option${n === 1 ? '' : 's'}`
    : 'tap to add options'
  return (
    <button onClick={onOpen}
      style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left', border: `1px solid ${LINE}`, borderRadius: 12, background: '#fff', padding: 10, cursor: 'pointer' }}>
      <Thumb src={cover?.image ?? null} size={64} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.3, textTransform: 'lowercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{status}</div>
      </div>
    </button>
  )
}

/* ---------- product sheet (tap a saved product → detail/edit, like Library) ---------- */

// The internal detail view for a saved product. Mirrors the media Library: tapping
// a card opens this in-app, and the only way *out* to the shop is the explicit
// "buy" button — so you never leave the board by accident. Edit/got-it/remove all
// live here too (they used to be a per-card ⋯ menu).
function ProductSheet({ item, onClose, onSave, onToggleGot, onReopenPlan, onDelete }: {
  item: Item
  onClose: () => void
  onSave: (f: ProductFields) => void | Promise<void>
  onToggleGot: () => void
  onReopenPlan: () => void | Promise<void>
  onDelete: () => void
}) {
  const p = productMeta(item)
  const got = item.status === 'done'
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [showPlan, setShowPlan] = useState(false)
  const taste = p.attributes ?? []
  // If this product was graduated from a plan, its deliberation (the options you
  // passed on) lives here — otherwise it'd be stored but unreachable.
  const plan = productPlan(item)

  if (editing) {
    return (
      <Sheet onClose={onClose}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px', color: INK }}>edit product</h2>
        <FieldsForm saveLabel="save" initial={p}
          onCancel={() => setEditing(false)}
          onSave={async (f) => { await onSave(f); setEditing(false) }} />
      </Sheet>
    )
  }

  const buyLabel = p.brand ? `buy at ${p.brand}` : p.siteName ? `buy at ${p.siteName}` : 'buy'
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button onClick={onClose} aria-label="close" style={{ border: 'none', background: 'none', fontSize: 22, color: MUTED, cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>
      <Thumb src={p.image} />
      <div style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: INK, lineHeight: 1.25, textTransform: 'lowercase' }}>{p.title}</h2>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 6, display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <PriceLine price={p.price} wasPrice={p.wasPrice} />
          {p.brand ? <span>{p.brand}</span> : p.siteName && <span>{p.siteName}</span>}
        </div>
      </div>

      {taste.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {taste.map((a, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: INK, background: '#F4F2EE', borderRadius: 999, padding: '4px 9px' }}>
              <span style={{ color: MUTED }}>{FACET_LABEL[a.facet].toLowerCase()}</span>{a.value}
            </span>
          ))}
        </div>
      )}

      {p.url && (
        <a href={p.url} target="_blank" rel="noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 18, padding: '12px', borderRadius: 12, background: INK, color: '#fff', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
          {buyLabel} <span style={{ fontSize: 13 }}>↗</span>
        </a>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button onClick={onToggleGot} style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1px solid ${got ? INK : LINE}`, background: got ? INK : '#fff', color: got ? '#fff' : INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          {got ? '✓ got it' : 'mark as got it'}
        </button>
        <button onClick={() => setEditing(true)} style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1px solid ${LINE}`, background: '#fff', color: INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          edit
        </button>
      </div>

      {plan && <PlanReveal plan={plan} open={showPlan} onToggle={() => setShowPlan(o => !o)} />}

      {/* Undo the "save as product" step: a decided-but-not-owned product can go
          back to being the plan it came from, exactly as it stood before saving.
          Only while un-owned — once you've got it, it's a settled purchase. */}
      {plan && !got && (
        <button onClick={async () => { await onReopenPlan(); onClose() }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, border: 'none', background: 'none', color: MUTED, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
          <span style={{ fontSize: 13 }}>↩</span> put back in plan
        </button>
      )}

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: confirmDel ? 'flex-end' : 'flex-start', gap: 12, alignItems: 'center' }}>
        {confirmDel ? (
          <>
            <span style={{ fontSize: 12.5, color: MUTED, marginRight: 'auto' }}>remove from the board?</span>
            <button onClick={() => setConfirmDel(false)} style={{ border: 'none', background: 'none', color: MUTED, fontSize: 12.5, cursor: 'pointer' }}>cancel</button>
            <button onClick={onDelete} style={{ border: 'none', background: '#B4413C', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>remove</button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ border: 'none', background: 'none', color: '#B4413C', fontSize: 12.5, cursor: 'pointer', padding: 0 }}>remove</button>
        )}
      </div>
    </Sheet>
  )
}

/* ---------- view & sort sheet (tucked behind the control-row icon) ---------- */

// Layout, density, sort and status live here (category is the on-page row). Styled
// to match the media Library's ViewSheet exactly — same drag-handle sheet, the same
// label-left/segmented-buttons rows, and the same ✓ list rows — so flipping between
// media and things feels like one app, not two.
function FilterSheet({ sort, onSort, view, onView, density, onDensity, status, onStatus, onClose }: {
  sort: SortKey
  onSort: (s: SortKey) => void
  view: ViewMode
  onView: (v: ViewMode) => void
  density: Density
  onDensity: (d: Density) => void
  status: StatusFilter
  onStatus: (s: StatusFilter) => void
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
          <SegRow label="density" options={[{ k: 'roomy', l: 'roomy' }, { k: 'dense', l: 'dense' }]} value={density} onChange={onDensity} />
        )}

        <SheetList label="sort" options={SORTS.map(s => ({ k: s.key, l: s.label }))} value={sort} onChange={onSort} />
        <SheetList label="show" options={STATUSES.map(s => ({ k: s.key, l: s.label }))} value={status} onChange={onStatus} />
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <span style={{ fontSize: 13, color: '#555' }}>{label}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map(o => {
          const on = value === o.k
          return (
            <button key={o.k} onClick={() => onChange(o.k)} style={{
              padding: '4px 14px', borderRadius: 6, border: on ? '1.5px solid #111' : '1.5px solid #E0E0E0',
              background: on ? '#111' : '#fff', color: on ? '#fff' : '#888',
              fontSize: 13, fontWeight: on ? 600 : 400, cursor: 'pointer',
            }}>{o.l}</button>
          )
        })}
      </div>
    </div>
  )
}

// A titled list of full-width ✓ rows — the Library ViewSheet's "sort" section.
function SheetList<T extends string>({ label, options, value, onChange }: {
  label: string; options: { k: T; l: string }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#ABA69C', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0 6px', paddingTop: 14, borderTop: '1px solid #F0F0F0' }}>{label}</p>
      {options.map(o => {
        const on = value === o.k
        return (
          <button key={o.k} onClick={() => onChange(o.k)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '8px 0', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ fontSize: 14, color: on ? '#111' : '#444', fontWeight: on ? 600 : 400 }}>{o.l}</span>
            {on && <span style={{ fontSize: 15 }}>✓</span>}
          </button>
        )
      })}
    </>
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

function IntentSheet({ item, onClose, onPatch, onResolve, onSaveWinner, onDelete }: {
  item: Item
  onClose: () => void
  onPatch: (meta: ReturnType<typeof intentMeta>) => void | Promise<void>
  onResolve: (winnerId: string, meta: ReturnType<typeof intentMeta>) => void | Promise<void>
  onSaveWinner: () => void | Promise<void>
  onDelete: () => void
}) {
  const m = intentMeta(item)
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
  const [compare, setCompare] = useState<Comparison | null>(null)
  const [compareErr, setCompareErr] = useState<string | null>(null)
  const [editingBrief, setEditingBrief] = useState(false)
  const [briefDraft, setBriefDraft] = useState(m.brief ?? '')

  async function runCompare() {
    if (comparing) return
    setComparing(true); setCompareErr(null)
    const r = await compareCandidates(item.title, m.candidates, m.brief)
    setComparing(false)
    if (!r.ok) { setCompareErr(r.reason); return }
    setCompare(r.result)
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
    await onPatch({ ...m, candidates: [...m.candidates, cand] })
    resetAdd()
  }
  function resetAdd() { setLink(''); setAdding(false); setManual(false); setError(null) }

  const setLeaning = (id: string) =>
    onPatch({ ...m, leaning: m.leaning === id ? null : id })

  const removeCandidate = (id: string) =>
    onPatch({ ...m, candidates: m.candidates.filter(c => c.id !== id), leaning: m.leaning === id ? null : m.leaning })

  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: MUTED, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 4 }}>
            {resolved ? 'decided' : 'deciding on'}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: INK }}>{item.title}</h2>
        </div>
        <button onClick={onClose} aria-label="close" style={{ border: 'none', background: 'none', fontSize: 22, color: MUTED, cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>

      {/* The brief: what matters for this purchase. Feeds Compare. */}
      {editingBrief ? (
        <div style={{ marginTop: 12 }}>
          <textarea autoFocus value={briefDraft} onChange={e => setBriefDraft(e.target.value)}
            placeholder="budget, occasion, must-haves, dealbreakers…"
            rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => { setBriefDraft(m.brief ?? ''); setEditingBrief(false) }}
              style={{ border: 'none', background: 'none', color: MUTED, fontSize: 12.5, cursor: 'pointer' }}>cancel</button>
            <button onClick={async () => { await onPatch({ ...m, brief: briefDraft.trim() || null }); setEditingBrief(false) }}
              style={primaryBtn(false)}>save context</button>
          </div>
        </div>
      ) : m.brief ? (
        <div onClick={() => !resolved && setEditingBrief(true)}
          style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: '#F7F5F1', fontSize: 12.5, lineHeight: 1.5, color: INK, cursor: resolved ? 'default' : 'pointer' }}>
          <span style={{ fontSize: 10, color: MUTED, letterSpacing: '0.04em', textTransform: 'uppercase' }}>what matters{!resolved && ' · tap to edit'}</span>
          <div style={{ marginTop: 3, whiteSpace: 'pre-wrap' }}>{m.brief}</div>
        </div>
      ) : !resolved && (
        <button onClick={() => setEditingBrief(true)}
          style={{ marginTop: 10, border: 'none', background: 'none', color: INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
          + Add context (budget, occasion, must-haves)
        </button>
      )}

      {!resolved && m.candidates.length > 0 && (
        <p style={{ fontSize: 12, color: MUTED, margin: '10px 0 0' }}>
          Star the one you're leaning toward. Pick when you're ready — the options you
          pass on stay as part of the decision.
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
            No options yet. Paste a few product links to weigh them side by side.
          </p>
        )}
      </div>

      {/* Opt-in AI weigh-up — only fires on tap. */}
      {!resolved && m.candidates.length >= 2 && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={runCompare} disabled={comparing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#fff', color: INK, fontSize: 12.5, fontWeight: 600, cursor: comparing ? 'default' : 'pointer' }}>
            ✨ {comparing ? 'thinking…' : compare ? 'Compare again' : 'Compare these'}
          </button>
          {compare && (
            <button onClick={() => { setCompare(null); setCompareErr(null) }}
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
            + Add an option
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
        <button onClick={onDelete} style={{ border: 'none', background: 'none', color: '#B4413C', fontSize: 12.5, cursor: 'pointer' }}>Delete this plan</button>
        {resolved && <span style={{ fontSize: 11.5, color: MUTED }}>chosen from {m.candidates.length} option{m.candidates.length === 1 ? '' : 's'}</span>}
      </div>
    </Sheet>
  )
}

/* ---------- composers ---------- */

function ProductComposer({ onClose, onSave }: { onClose: () => void; onSave: (f: ProductFields) => void | Promise<void> }) {
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<ProductFields | null>(null)
  const [manual, setManual] = useState(false)

  async function read() {
    const url = link.trim()
    if (!url || busy) return
    setBusy(true); setError(null)
    const r = await parseProductLink(url)
    setBusy(false)
    if (!r.ok) { setError(r.reason); return }
    setFields(r.fields)
  }

  const editing = fields || manual
  return (
    <Sheet onClose={onClose}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: INK }}>save a product</h2>
      <p style={{ fontSize: 12.5, color: MUTED, margin: '0 0 16px' }}>Paste a link — we'll pull the image, name and price. You can tweak anything before saving.</p>

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
          {error && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 12, color: '#B4413C' }}>{error}</span>
              <button onClick={() => setManual(true)}
                style={{ marginLeft: 8, border: 'none', background: 'none', color: INK, fontSize: 12, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>add it manually</button>
            </div>
          )}
        </>
      ) : (
        <FieldsForm saveLabel="save to board"
          initial={fields ?? { title: '', image: null, price: null, brand: null, siteName: null, url: link.trim() || null }}
          onCancel={() => { setFields(null); setManual(false); setError(null) }}
          onSave={onSave} />
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
    })
    setSaving(false)
  }

  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Thumb src={f.image} size={72} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={f.title} onChange={e => set({ title: e.target.value })} placeholder="Name" style={{ ...inputStyle, fontWeight: 500 }} />
          <input value={f.image ?? ''} onChange={e => set({ image: e.target.value })} placeholder="image url — paste to change the photo" style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={f.price ?? ''} onChange={e => set({ price: e.target.value })} placeholder="Price" style={inputStyle} />
        <input value={f.wasPrice ?? ''} onChange={e => set({ wasPrice: e.target.value })} placeholder="was (if on sale)" style={inputStyle} />
      </div>
      <input value={f.brand ?? ''} onChange={e => set({ brand: e.target.value })} placeholder="Brand" style={inputStyle} />
      <input value={f.url ?? ''} onChange={e => set({ url: e.target.value })} placeholder="buy link (kept even if it doesn't preview)" style={inputStyle} />
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
        + Add taste tags
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

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {EDIT_FACETS.map(fc => (
          <button key={fc} type="button" onClick={() => setFacet(fc)}
            style={{ fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${facet === fc ? INK : LINE}`, background: facet === fc ? INK : '#fff', color: facet === fc ? '#fff' : INK }}>
            {FACET_LABEL[fc]}
          </button>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {suggestions.map(s => (
            <button key={s} type="button" onClick={() => add(facet, s)}
              style={{ fontSize: 11.5, padding: '4px 9px', borderRadius: 999, border: `1px dashed ${MUTED}`, background: 'none', color: INK, cursor: 'pointer' }}>
              + {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(facet, draft); setDraft('') } }}
          placeholder={`Add ${FACET_LABEL[facet].toLowerCase()}…`} style={inputStyle} />
        <button type="button" onClick={() => { add(facet, draft); setDraft('') }} disabled={!draft.trim()}
          style={primaryBtn(!draft.trim())}>add</button>
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
      {price && <span style={{ color: INK }}>{price}</span>}
      {wasPrice && <span style={{ textDecoration: 'line-through', color: MUTED, fontSize: '0.92em' }}>{wasPrice}</span>}
      {onSale && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', color: '#B4413C', border: '1px solid #E3C3C1', borderRadius: 4, padding: '0 4px', textTransform: 'uppercase' }}>sale</span>}
    </span>
  )
}

// Feather the contained image's outer edge to transparent on all four sides so its
// rectangular boundary dissolves into the ambient fill instead of leaving a faint
// seam where the tone shifts. Only the bg margin (outer ~6%) fades — the centered
// product is untouched. Two gradients intersected; degrades to a corner-only fade
// where mask-composite is unsupported (never worse than a hard edge).
const FEATHER_EDGE: React.CSSProperties = {
  WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 6%, #000 94%, transparent), linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)',
  WebkitMaskComposite: 'source-in',
  maskImage: 'linear-gradient(to bottom, transparent, #000 6%, #000 94%, transparent), linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)',
  maskComposite: 'intersect',
}

// Whether to paint the ambient blur fill behind a contained product image. Default
// ON — keeps the fill for the common case and for any CORS-blocked image we can't
// inspect. We flip it OFF only when we can positively read the pixels and see a
// TRANSPARENT background: there, blurring smears the product's own colour into the
// empty corners (the "halo" bug). Probed via one CORS image load; a tainted or
// failed read just keeps the fill.
function useAmbientFill(src: string | null): boolean {
  const [fill, setFill] = useState(true)
  useEffect(() => {
    setFill(true)
    if (!src) return
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = 24; c.height = 24
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (!ctx) return
        ctx.drawImage(img, 0, 0, 24, 24)
        const corners = [[0, 0], [23, 0], [0, 23], [23, 23]] as const
        const transparent = corners.some(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] < 200)
        if (!cancelled && transparent) setFill(false)
      } catch { /* CORS-tainted — can't tell, keep the fill */ }
    }
    img.src = src
    return () => { cancelled = true }
  }, [src])
  return fill
}

function Thumb({ src, size }: { src: string | null; size?: number }) {
  // Grid/hero thumbs: "catalog plate" treatment. Product photos arrive framed
  // differently per shop (a tight model shot vs an object floating on white with
  // baked-in whitespace), so `cover` filled the frame unevenly. Instead we
  // `contain` every image WHOLE on a shared white field at 4:5 — nothing cropped,
  // every tile reads as the same kind of plate (the SSENSE/NAP grid look). Inline
  // list thumbs (size set) stay square + cover — they're avatars beside text.
  const isGrid = !size
  const fill = useAmbientFill(isGrid ? src : null)
  const dim = isGrid ? { width: '100%', aspectRatio: '4 / 5' } : { width: size, height: size }
  return (
    <div style={{
      position: 'relative',
      ...dim, background: isGrid ? '#fff' : '#F4F2EE', overflow: 'hidden',
      border: `1px solid ${LINE}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {src ? (
        isGrid ? (
          <>
            {/* Ambient fill: a blurred copy of the SAME photo bleeds its own
                background to the edges, so a product floating on its shop's backdrop
                reads as edge-to-edge filled with no seam. object-fit:FILL (not cover)
                is deliberate — it maps every frame-row to the same image-row, so the
                top/bottom letterbox bands pull from the photo's actual top/bottom
                (the background), instead of cover cropping those edges out and
                sampling the product in the middle (which darkened the bands). The
                stretched product in the centre stays hidden behind the sharp image.
                Skipped entirely for transparent images (no background to bleed). */}
            {fill && (
              <img src={src} alt="" aria-hidden="true" loading="lazy"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', filter: 'blur(28px) saturate(0.9)', transform: 'scale(1.06)' }} />
            )}
            {/* The sharp product, whole + centered, on top of its own ambient field.
                Its edges are feathered into the fill (only when a fill is present)
                so the boundary doesn't read as a tonal seam. */}
            <img src={src} alt="" loading="lazy"
              style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain', filter: 'saturate(0.9)', ...(fill ? FEATHER_EDGE : {}) }} />
          </>
        ) : (
          <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.9)' }} />
        )
      ) : <span style={{ color: MUTED, fontSize: 11 }}>no image</span>}
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
function TabChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 1px 7px',
      whiteSpace: 'nowrap', fontSize: 13, color: active ? '#111' : '#888',
      fontWeight: active ? 600 : 400, fontStyle: active ? 'italic' : 'normal',
      borderBottom: active ? '1.5px solid #111' : '1.5px solid transparent',
    }}>{label}</button>
  )
}

function Empty() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: MUTED }}>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        Your board is empty.<br />
        Tap <span style={{ fontWeight: 600, color: INK }}>+</span> to save a product you love, or plan a purchase you're weighing.
      </div>
    </div>
  )
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(28,27,25,0.4)', zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', width: '100%', maxWidth: 640, borderRadius: '20px 20px 0 0',
        padding: '20px 18px calc(24px + env(safe-area-inset-bottom))',
        maxHeight: '88vh', overflowY: 'auto',
      }}>
        {children}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 10, border: `1px solid ${LINE}`,
  fontSize: 13, color: INK, outline: 'none', background: '#fff',
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 16px', borderRadius: 10, border: 'none',
    background: disabled ? '#D6D3CC' : INK, color: '#fff', fontSize: 13, fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap',
  }
}
