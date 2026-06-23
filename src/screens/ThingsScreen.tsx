import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useItems } from '../hooks/useItems'
import type { Item } from '../lib/database.types'
import {
  parseProductLink, kindOf, intentMeta, productMeta, newCandidateId,
  type Candidate, type ProductFields,
} from '../lib/things'

const INK = '#1C1B19'
const MUTED = '#ABA69C'
const LINE = '#E8E8E8'

export function ThingsScreen() {
  const { items, addItem, editItem, deleteItem } = useItems()
  const [composer, setComposer] = useState<null | 'product' | 'intent'>(null)
  const [openIntentId, setOpenIntentId] = useState<string | null>(null)

  const things = useMemo(() => items.filter(i => kindOf(i) !== null), [items])
  const openIntent = things.find(i => i.id === openIntentId) ?? null

  return (
    <div style={{ padding: '20px 16px 96px', maxWidth: 640, margin: '0 auto' }}>
      <PageHeader kicker="THINGS" title="your board" />

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
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
        }}>
          {things.map(item => (
            kindOf(item) === 'intent'
              ? <IntentCard key={item.id} item={item} onOpen={() => setOpenIntentId(item.id)} />
              : <ProductCard key={item.id} item={item}
                  onGotIt={() => editItem(item.id, { status: item.status === 'done' ? 'want_to' : 'done' })}
                  onDelete={() => deleteItem(item.id)} />
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
          onCreate={async (need) => {
            const id = await addItem(need, 'thing', null, null, { kind: 'intent', candidates: [], leaning: null })
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
    </div>
  )
}

/* ---------- cards ---------- */

function ProductCard({ item, onGotIt, onDelete }: { item: Item; onGotIt: () => void; onDelete: () => void }) {
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
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2, display: 'flex', gap: 6 }}>
            {p.price && <span style={{ color: INK }}>{p.price}</span>}
            {p.brand ? <span>{p.brand}</span> : p.siteName && <span>{p.siteName}</span>}
          </div>
        </div>
      </a>
      {got && <Tag label="got it" filled />}
      <button onClick={() => setMenu(m => !m)} aria-label="more"
        style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, border: 'none', background: 'rgba(0,0,0,0.45)', color: '#fff', cursor: 'pointer', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⋯</button>
      {menu && (
        <div style={{ position: 'absolute', top: 34, right: 6, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, boxShadow: '0 4px 18px rgba(0,0,0,0.12)', zIndex: 5, overflow: 'hidden' }}>
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

  async function addCandidate() {
    const url = link.trim()
    if (!url || busy) return
    setBusy(true); setError(null)
    const r = await parseProductLink(url)
    setBusy(false)
    if (!r.ok) { setError(r.reason); return }
    const cand: Candidate = { id: newCandidateId(), ...r.fields }
    await onPatch({ ...m, candidates: [...m.candidates, cand] })
    setLink(''); setAdding(false)
  }

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

      {!resolved && m.candidates.length > 0 && (
        <p style={{ fontSize: 12, color: MUTED, margin: '10px 0 0' }}>
          Star the one you're leaning toward. Pick when you're ready — the options you
          pass on stay as part of the decision.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '16px 0' }}>
        {m.candidates.map(c => {
          const isWinner = resolved && m.winner === c.id
          const isLean = !resolved && m.leaning === c.id
          const dim = resolved && !isWinner
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
                <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3, display: 'flex', gap: 6 }}>
                  {c.price && <span style={{ color: INK }}>{c.price}</span>}
                  {(c.brand || c.siteName) && <span>{c.brand || c.siteName}</span>}
                </div>
                {isWinner && <div style={{ fontSize: 11, color: INK, fontWeight: 600, marginTop: 4 }}>✓ chose this</div>}
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
                  <button onClick={() => removeCandidate(c.id)} aria-label="remove"
                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: MUTED }}>remove</button>
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

      {!resolved && (
        adding ? (
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
            {error && <div style={{ fontSize: 12, color: '#B4413C', marginTop: 8 }}>{error}</div>}
            <button onClick={() => { setAdding(false); setError(null); setLink('') }}
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

  async function read() {
    const url = link.trim()
    if (!url || busy) return
    setBusy(true); setError(null)
    const r = await parseProductLink(url)
    setBusy(false)
    if (!r.ok) { setError(r.reason); return }
    setFields(r.fields)
  }

  return (
    <Sheet onClose={onClose}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: INK }}>Save a product</h2>
      <p style={{ fontSize: 12.5, color: MUTED, margin: '0 0 16px' }}>Paste a link — we'll pull the image, name and price.</p>

      {!fields ? (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <input autoFocus value={link} onChange={e => setLink(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') read() }}
              placeholder="https://…" style={inputStyle} />
            <button onClick={read} disabled={busy || !link.trim()} style={primaryBtn(busy || !link.trim())}>
              {busy ? 'reading…' : 'read'}
            </button>
          </div>
          {error && <div style={{ fontSize: 12, color: '#B4413C', marginTop: 8 }}>{error}</div>}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <Thumb src={fields.image} size={88} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <input value={fields.title} onChange={e => setFields({ ...fields, title: e.target.value })}
                style={{ ...inputStyle, fontWeight: 500 }} />
              <div style={{ fontSize: 12, color: MUTED, marginTop: 6, display: 'flex', gap: 8 }}>
                {fields.price && <span style={{ color: INK }}>{fields.price}</span>}
                {(fields.brand || fields.siteName) && <span>{fields.brand || fields.siteName}</span>}
              </div>
            </div>
          </div>
          <button onClick={() => onSave(fields)} style={{ ...primaryBtn(false), width: '100%', padding: '12px' }}>Save to board</button>
          <button onClick={() => { setFields(null); setError(null) }}
            style={{ marginTop: 8, width: '100%', border: 'none', background: 'none', color: MUTED, fontSize: 12.5, cursor: 'pointer' }}>try a different link</button>
        </>
      )}
    </Sheet>
  )
}

function IntentComposer({ onClose, onCreate }: { onClose: () => void; onCreate: (need: string) => void | Promise<void> }) {
  const [need, setNeed] = useState('')
  return (
    <Sheet onClose={onClose}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: INK }}>Plan a purchase</h2>
      <p style={{ fontSize: 12.5, color: MUTED, margin: '0 0 16px' }}>Name what you're after. You'll add options to weigh, then pick one when you're ready.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input autoFocus value={need} onChange={e => setNeed(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && need.trim()) onCreate(need.trim()) }}
          placeholder="e.g. black clogs" style={inputStyle} />
        <button onClick={() => need.trim() && onCreate(need.trim())} disabled={!need.trim()} style={primaryBtn(!need.trim())}>start</button>
      </div>
    </Sheet>
  )
}

/* ---------- shared bits ---------- */

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
