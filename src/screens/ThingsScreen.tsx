import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { DomainSwitcher } from '../components/DomainSwitcher'
import { useItems } from '../hooks/useItems'
import type { Item } from '../lib/database.types'
import {
  parseProductLink, compareCandidates, kindOf, intentMeta, productMeta, newCandidateId,
  EDIT_FACETS, FACET_LABEL, SUGGESTED, normValue, readThread, itemAttributes, THREAD_MIN_ITEMS,
  type Candidate, type ProductFields, type Comparison, type Attribute, type Facet,
} from '../lib/things'

const INK = '#1C1B19'
const MUTED = '#ABA69C'
const LINE = '#E8E8E8'

export function ThingsScreen() {
  const { items, addItem, editItem, deleteItem } = useItems()
  const [composer, setComposer] = useState<null | 'product' | 'intent'>(null)
  const [openIntentId, setOpenIntentId] = useState<string | null>(null)
  const [editProductId, setEditProductId] = useState<string | null>(null)

  const things = useMemo(() => items.filter(i => kindOf(i) !== null), [items])
  const openIntent = things.find(i => i.id === openIntentId) ?? null
  const editProduct = things.find(i => i.id === editProductId) ?? null

  return (
    <div style={{ padding: '20px 16px 96px', maxWidth: 640, margin: '0 auto' }}>
      <DomainSwitcher current="things" />
      <PageHeader kicker="THINGS" title="your board" />
      <ThreadMasthead things={things} />

      {/* Two first-class capture paths: save a concrete product, or plan a purchase
          (an intent you'll weigh options against). */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <AddButton label="Save a product" onClick={() => setComposer('product')} />
        <AddButton label="Plan a purchase" onClick={() => setComposer('intent')} />
      </div>

      {things.length === 0 ? (
        <Empty />
      ) : (
        <div style={{
          display: 'grid',
          // minmax(0,1fr) — without the 0 floor, a card's no-wrap attribute line
          // forces its column wider and squashes the neighbour (the "one grew,
          // one shrank" bug). align-items:start so a taller card doesn't stretch
          // its row-mate.
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          alignItems: 'start',
          gap: 12,
        }}>
          {things.map(item => (
            kindOf(item) === 'intent'
              ? <IntentCard key={item.id} item={item} onOpen={() => setOpenIntentId(item.id)} />
              : <ProductCard key={item.id} item={item}
                  onGotIt={() => editItem(item.id, { status: item.status === 'done' ? 'want_to' : 'done' })}
                  onDelete={() => deleteItem(item.id)}
                  onEdit={() => setEditProductId(item.id)} />
          ))}
        </div>
      )}

      {composer === 'product' && (
        <ProductComposer
          onClose={() => setComposer(null)}
          onSave={async (f) => {
            await addItem(f.title || 'Untitled', 'thing', f.brand, null, { kind: 'product', ...f })
            setComposer(null)
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
            editItem(openIntent.id, { status: 'done', metadata: { ...meta, winner: winnerId } })}
          onDelete={async () => { await deleteItem(openIntent.id); setOpenIntentId(null) }}
        />
      )}

      {editProduct && (
        <Sheet onClose={() => setEditProductId(null)}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px', color: INK }}>Edit product</h2>
          <FieldsForm saveLabel="Save"
            initial={productMeta(editProduct)}
            onCancel={() => setEditProductId(null)}
            onSave={async (f) => {
              await editItem(editProduct.id, { title: f.title || 'Untitled', creator: f.brand, metadata: { kind: 'product', ...f } })
              setEditProductId(null)
            }} />
        </Sheet>
      )}
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
    return (
      <div style={{ margin: '0 0 22px', padding: '14px 16px', borderRadius: 14, background: '#F7F5F1', border: `1px solid ${LINE}` }}>
        <div style={{ fontSize: 10, color: MUTED, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>your thread</div>
        <div style={{ fontSize: 21, fontWeight: 600, color: INK, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
          {thread.tokens.join('  ·  ')}
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 7 }}>
          read from {thread.basis} tagged thing{thread.basis === 1 ? '' : 's'} — it shifts as you save and tag more
        </div>
      </div>
    )
  }

  // Below the threshold (or nothing recurs yet) — a gentle nudge, never a nag.
  return (
    <div style={{ margin: '0 0 22px', padding: '12px 14px', borderRadius: 14, border: `1px dashed ${LINE}`, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
      Tag your things — material, palette, form — and your aesthetic <em>thread</em> shows up here.
      {tagged > 0 && <span style={{ color: INK, fontWeight: 600 }}> {tagged}/{THREAD_MIN_ITEMS} tagged.</span>}
    </div>
  )
}

/* ---------- cards ---------- */

function ProductCard({ item, onGotIt, onDelete, onEdit }: { item: Item; onGotIt: () => void; onDelete: () => void; onEdit: () => void }) {
  const p = productMeta(item)
  const got = item.status === 'done'
  const [menu, setMenu] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <a href={p.url ?? undefined} target="_blank" rel="noreferrer"
        style={{ textDecoration: 'none', color: INK, display: 'block' }}>
        <Thumb src={p.image} />
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 12.5, lineHeight: 1.3, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {p.title}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2, display: 'flex', gap: 6, alignItems: 'baseline' }}>
            <PriceLine price={p.price} wasPrice={p.wasPrice} />
            {p.brand ? <span>{p.brand}</span> : p.siteName && <span>{p.siteName}</span>}
          </div>
          {p.attributes && p.attributes.length > 0 && (
            <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3, letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.attributes.map(a => a.value).join(' · ')}
            </div>
          )}
        </div>
      </a>
      {got && <Tag label="got it" filled />}
      <button onClick={() => setMenu(m => !m)} aria-label="more"
        style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, border: 'none', background: 'rgba(0,0,0,0.45)', color: '#fff', cursor: 'pointer', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⋯</button>
      {menu && (
        <div style={{ position: 'absolute', top: 34, right: 6, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, boxShadow: '0 4px 18px rgba(0,0,0,0.12)', zIndex: 5, overflow: 'hidden' }}>
          <MenuItem label="Edit" onClick={() => { onEdit(); setMenu(false) }} />
          <MenuItem label={got ? 'Mark as not owned' : 'Got it'} onClick={() => { onGotIt(); setMenu(false) }} />
          <MenuItem label="Remove" danger onClick={() => { onDelete(); setMenu(false) }} />
        </div>
      )}
    </div>
  )
}

function IntentCard({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const m = intentMeta(item)
  const resolved = item.status === 'done'
  const winner = resolved ? m.candidates.find(c => c.id === m.winner) : null
  const lean = !resolved && m.leaning ? m.candidates.find(c => c.id === m.leaning) : null
  const cover = winner ?? lean ?? m.candidates[0] ?? null
  return (
    <button onClick={onOpen}
      style={{ textAlign: 'left', border: 'none', background: 'none', padding: 0, cursor: 'pointer', position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Thumb src={cover?.image ?? null} dashed={!resolved} />
        <Tag label={resolved ? 'decided' : `deciding · ${m.candidates.length}`} filled={resolved} />
      </div>
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 12.5, lineHeight: 1.3, fontWeight: 600, color: INK, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.title}
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
          {resolved
            ? (winner ? `chose ${winner.title.slice(0, 24)}${winner.title.length > 24 ? '…' : ''}` : 'resolved')
            : lean ? `leaning: ${lean.title.slice(0, 22)}${lean.title.length > 22 ? '…' : ''}`
            : m.candidates.length ? 'weighing options' : 'tap to add options'}
        </div>
      </div>
    </button>
  )
}

/* ---------- intent sheet (the deliberation flow) ---------- */

function IntentSheet({ item, onClose, onPatch, onResolve, onDelete }: {
  item: Item
  onClose: () => void
  onPatch: (meta: ReturnType<typeof intentMeta>) => void | Promise<void>
  onResolve: (winnerId: string, meta: ReturnType<typeof intentMeta>) => void | Promise<void>
  onDelete: () => void
}) {
  const m = intentMeta(item)
  const resolved = item.status === 'done'
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
            placeholder="Budget, occasion, must-haves, dealbreakers…"
            rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => { setBriefDraft(m.brief ?? ''); setEditingBrief(false) }}
              style={{ border: 'none', background: 'none', color: MUTED, fontSize: 12.5, cursor: 'pointer' }}>cancel</button>
            <button onClick={async () => { await onPatch({ ...m, brief: briefDraft.trim() || null }); setEditingBrief(false) }}
              style={primaryBtn(false)}>Save context</button>
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
              <FieldsForm key={c.id} saveLabel="Save"
                initial={{ title: c.title, image: c.image, price: c.price, brand: c.brand, siteName: c.siteName, url: c.url }}
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
          <FieldsForm saveLabel="Add option"
            initial={{ title: '', image: null, price: null, brand: null, siteName: null, url: link.trim() || null }}
            onCancel={resetAdd}
            onSave={saveNewCandidate} />
        ) : adding ? (
          <div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                autoFocus value={link} onChange={e => setLink(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCandidate() }}
                placeholder="Paste a product link…"
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
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: INK }}>Save a product</h2>
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
        <FieldsForm saveLabel="Save to board"
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
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: INK }}>Plan a purchase</h2>
      <p style={{ fontSize: 12.5, color: MUTED, margin: '0 0 16px' }}>Name what you're after. You'll add options to weigh, then pick one when you're ready.</p>
      <input autoFocus value={need} onChange={e => setNeed(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && need.trim()) onCreate(need.trim(), brief.trim()) }}
        placeholder="e.g. black clogs" style={{ ...inputStyle, width: '100%' }} />
      <textarea value={brief} onChange={e => setBrief(e.target.value)}
        placeholder="What matters? Budget, occasion, must-haves, dealbreakers… (optional — helps Compare)"
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
          <input value={f.image ?? ''} onChange={e => set({ image: e.target.value })} placeholder="Image URL — paste to change the photo" style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={f.price ?? ''} onChange={e => set({ price: e.target.value })} placeholder="Price" style={inputStyle} />
        <input value={f.wasPrice ?? ''} onChange={e => set({ wasPrice: e.target.value })} placeholder="Was (if on sale)" style={inputStyle} />
      </div>
      <input value={f.brand ?? ''} onChange={e => set({ brand: e.target.value })} placeholder="Brand" style={inputStyle} />
      <input value={f.url ?? ''} onChange={e => set({ url: e.target.value })} placeholder="Buy link (kept even if it doesn't preview)" style={inputStyle} />
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

function Thumb({ src, size, dashed }: { src: string | null; size?: number; dashed?: boolean }) {
  const dim = size ? { width: size, height: size } : { width: '100%', aspectRatio: '1 / 1' }
  return (
    <div style={{
      ...dim, borderRadius: 12, background: '#F4F2EE', overflow: 'hidden',
      border: dashed ? `1px dashed ${MUTED}` : `1px solid ${LINE}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {src
        ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        : <span style={{ color: MUTED, fontSize: 11 }}>no image</span>}
    </div>
  )
}

function Tag({ label, filled }: { label: string; filled?: boolean }) {
  return (
    <span style={{
      position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
      padding: '3px 7px', borderRadius: 999,
      background: filled ? INK : 'rgba(255,255,255,0.92)', color: filled ? '#fff' : INK,
      border: filled ? 'none' : `1px solid ${LINE}`,
    }}>{label}</span>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '11px 8px', borderRadius: 12, border: `1px solid ${INK}`,
      background: '#fff', color: INK, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
    }}>{label}</button>
  )
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none',
      background: 'none', fontSize: 12.5, color: danger ? '#B4413C' : INK, cursor: 'pointer', whiteSpace: 'nowrap',
    }}>{label}</button>
  )
}

function Empty() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: MUTED }}>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        Your board is empty.<br />
        Save a product you love, or plan a purchase you're weighing.
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
