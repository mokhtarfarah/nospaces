// The "Things" domain — shopping / wishlist as a taste mirror.
//
// Everything rides on the existing `Item` model (no migration): a thing is just an
// item with `type:'thing'`. The shape lives in `metadata.kind`:
//   - 'product' — a concrete thing you've saved (a specific coat, a specific lamp)
//   - 'intent'  — a need with no chosen product yet ("black clogs"), holding the
//                 candidates you're weighing in `metadata.candidates[]`
//
// Slice 0 (gut-check) is about whether the deliberation flow feels good, so the
// star here is the intent → candidates → leaning → "pick this one" loop. Attribute
// vocab + the live aesthetic masthead come in later slices, once real items exist.

import { authHeaders } from './supabase'
import type { Item } from './database.types'

// ---- Attributes (Slice 1): the composition engine ----
//
// A thing's taste signal isn't its brand or its category — it's the recurring
// *attributes* across the whole set. We store them as flat {facet, value} tags
// rather than a frozen enum, on purpose: the vocab should grow from what's
// actually saved, not a taxonomy invented in a vacuum. `value` is free text; the
// suggestions below are just starter chips, never a closed list.

// 'vibe' covers both silhouette/shape AND attitude (oversized, structured, bold,
// statement, chunky) — one facet for "how it carries itself". Renamed from the
// original 'form' (s66); legacy 'form' tags are mapped forward on read so nothing
// already saved is lost (see legacyFacet).
export type Facet = 'material' | 'palette' | 'vibe' | 'category' | 'priceTier'

/** A single taste tag, e.g. {facet:'palette', value:'muted'}. */
export type Attribute = { facet: Facet; value: string }

// Facets that feed the "thread" read, in display order. Category is deliberately
// EXCLUDED — it's a *what* (bag, coat), not a *vibe*, so "neutral · leather ·
// relaxed · bag" reads odd. The thread is the aesthetic, not the inventory.
export const READ_FACETS: Facet[] = ['palette', 'material', 'vibe']

// Facets exposed in the tag editor (priceTier is reserved for later, derived).
// Category leads — it's the most concrete thing to pin first (and the natural
// hook for auto-tagging later, via the Slice 4 vision read).
export const EDIT_FACETS: Facet[] = ['category', 'material', 'palette', 'vibe']

export const FACET_LABEL: Record<Facet, string> = {
  material: 'Material', palette: 'Palette', vibe: 'Vibe', category: 'Category', priceTier: 'Price',
}

// Light starter chips — tap-to-add convenience, not a closed vocabulary. Real
// saved items will pull the vocab in whatever direction Farah's taste runs.
export const SUGGESTED: Record<Facet, string[]> = {
  material: ['wool', 'leather', 'linen', 'cotton', 'silk', 'denim', 'knit', 'suede'],
  palette: ['muted', 'earth', 'monochrome', 'neutral', 'warm', 'bold', 'pastel'],
  vibe: ['structured', 'oversized', 'tailored', 'relaxed', 'minimal', 'statement', 'bold', 'chunky', 'sleek'],
  category: ['coat', 'knitwear', 'boots', 'bag', 'dress', 'trousers'],
  priceTier: ['steal', 'mid', 'splurge'],
}

// Map legacy facet keys forward so attributes saved before a rename still count
// and label correctly. Currently just 'form' → 'vibe' (s66).
const LEGACY_FACET: Record<string, Facet> = { form: 'vibe' }
function legacyFacet(a: Attribute): Attribute {
  const mapped = LEGACY_FACET[a.facet as string]
  return mapped ? { ...a, facet: mapped } : a
}
export function normAttributes(attrs: Attribute[] | undefined): Attribute[] {
  return (attrs ?? []).map(legacyFacet)
}

/** Canonical form of a tag value — trimmed, lowercased — for comparing/counting. */
export function normValue(v: string): string {
  return v.trim().toLowerCase()
}

/**
 * Best-effort numeric value of a price string ("$630.00", "416", "1.299,00 €",
 * "$1,250") for sorting. Returns null when there's no number to read. Handles the
 * US/EU separator ambiguity: a final separator followed by exactly 2 digits is a
 * decimal point; anything else (e.g. "1,250") is a thousands separator.
 */
export function priceValue(p: string | null | undefined): number | null {
  if (!p) return null
  const digits = p.replace(/[^0-9.,]/g, '')
  if (!digits) return null
  const lastSep = Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','))
  const decimal = lastSep !== -1 && digits.length - lastSep - 1 === 2
  const cleaned = decimal
    ? digits.slice(0, lastSep).replace(/[.,]/g, '') + '.' + digits.slice(lastSep + 1)
    : digits.replace(/[.,]/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

export type ProductFields = {
  title: string
  image: string | null
  price: string | null
  /** Original price, set only when the item is on sale (current price = `price`). */
  wasPrice?: string | null
  brand: string | null
  siteName: string | null
  /** The page we read this from — the buy link. */
  url: string | null
  /** Taste tags. Empty/undefined until the user (or, later, vision) adds them. */
  attributes?: Attribute[]
}

/** A weighed option inside an intent. Flat object stored in metadata.candidates[]. */
export type Candidate = ProductFields & { id: string }

export type ProductMeta = ProductFields & { kind: 'product' }
export type IntentMeta = {
  kind: 'intent'
  candidates: Candidate[]
  /** id of the candidate currently leaning toward (soft preference). */
  leaning?: string | null
  /** id of the candidate finally chosen — set when the intent is resolved. */
  winner?: string | null
  /** Free-text context: budget, occasion, must-haves, dealbreakers. Feeds compare. */
  brief?: string | null
}

export function kindOf(item: Item): 'product' | 'intent' | null {
  if (item.type !== 'thing') return null
  const k = (item.metadata as { kind?: string })?.kind
  return k === 'product' || k === 'intent' ? k : null
}

export function isThing(item: Item): boolean {
  return item.type === 'thing'
}

export function intentMeta(item: Item): IntentMeta {
  const m = (item.metadata ?? {}) as Partial<IntentMeta>
  return { kind: 'intent', candidates: m.candidates ?? [], leaning: m.leaning ?? null, winner: m.winner ?? null, brief: m.brief ?? null }
}

export function productMeta(item: Item): ProductMeta {
  const m = (item.metadata ?? {}) as Partial<ProductMeta>
  return {
    kind: 'product',
    title: m.title ?? item.title,
    image: m.image ?? null,
    price: m.price ?? null,
    wasPrice: m.wasPrice ?? null,
    brand: m.brand ?? null,
    siteName: m.siteName ?? null,
    url: m.url ?? null,
    attributes: normAttributes(m.attributes),
  }
}

/**
 * The taste tags a thing contributes to the board's thread.
 * - a product → its own attributes
 * - a *decided* intent → the winning candidate's attributes (the committed choice)
 * - an undecided intent → nothing (not yet a settled signal)
 *
 * Gated on `winner`, not status: the moment you pick a winner the plan is
 * "decided" and its choice counts, even before you mark it owned. (A decided plan
 * can be promoted to a standalone product via promoteIntentToProduct — once it is,
 * it contributes as a product instead, so the choice is never counted twice.)
 */
export function itemAttributes(item: Item): Attribute[] {
  const k = kindOf(item)
  if (k === 'product') return productMeta(item).attributes ?? []
  if (k === 'intent') {
    const m = intentMeta(item)
    if (m.winner) return normAttributes(m.candidates.find(c => c.id === m.winner)?.attributes)
  }
  return []
}

/** The deliberation record carried forward when a plan becomes a product. */
export type PlanRecord = {
  /** The original need, e.g. "black clogs" (the plan's title). */
  need: string
  candidates: Candidate[]
  brief: string | null
  winner: string | null
}

/** A product that was promoted from a plan keeps its deliberation under fromPlan. */
export type PromotedProductMeta = ProductMeta & { fromPlan: PlanRecord }

/**
 * The deliberation record on a product, if it was graduated from a plan — the
 * losing candidates, the brief, and the original need. Null for a product saved
 * directly. Lets the product sheet pull the passed-on options back up (otherwise
 * they're stored but invisible).
 */
export function productPlan(item: Item): PlanRecord | null {
  const m = (item.metadata ?? {}) as { fromPlan?: PlanRecord }
  return m.fromPlan ?? null
}

/**
 * Promote a *decided* plan into a standalone product. The winning candidate's
 * fields become the product; the whole deliberation (all candidates, the brief,
 * the original need) is preserved under `metadata.fromPlan` so nothing is lost —
 * productMeta simply ignores the extra key. Returns the new metadata to store, or
 * null when there's no resolvable winner to promote.
 */
export function promoteIntentToProduct(item: Item): PromotedProductMeta | null {
  const m = intentMeta(item)
  const win = m.candidates.find(c => c.id === m.winner)
  if (!win) return null
  return {
    kind: 'product',
    title: win.title,
    image: win.image ?? null,
    price: win.price ?? null,
    wasPrice: win.wasPrice ?? null,
    brand: win.brand ?? null,
    siteName: win.siteName ?? null,
    url: win.url ?? null,
    attributes: normAttributes(win.attributes),
    fromPlan: { need: item.title, candidates: m.candidates, brief: m.brief ?? null, winner: m.winner ?? null },
  }
}

/**
 * Reverse of promoteIntentToProduct: turn a promoted product back into the plan
 * it came from, exactly as it stood right before "save the winner" — same need,
 * same candidates, same brief, winner still picked (so it reads "decided"). Used
 * to undo a save you didn't mean to make, while the product is still un-owned.
 * Returns the title + IntentMeta to write back, or null for a product with no
 * plan history (nothing to revert to).
 */
export function demoteProductToIntent(item: Item): { title: string; meta: IntentMeta } | null {
  const plan = productPlan(item)
  if (!plan) return null
  return {
    title: plan.need,
    meta: { kind: 'intent', candidates: plan.candidates, leaning: null, winner: plan.winner ?? null, brief: plan.brief },
  }
}

export type Thread = {
  /** Recurring-attribute tokens, e.g. ['muted','natural','structured']. */
  tokens: string[]
  /** How many attributed items fed the read (its evidence base). */
  basis: number
}

/** Need at least this many tagged items before a read means anything. */
export const THREAD_MIN_ITEMS = 4
/** A value must show up in at least this many items to count as "recurring". */
const RECUR_MIN = 2

/**
 * The board's aesthetic read — pure function over the set. Finds the dominant
 * recurring value in each aesthetic facet and stitches them into a short thread
 * ("muted · natural · structured"). Returns null until there's enough signal, so
 * the masthead stays quiet on an empty/sparse board instead of guessing.
 */
export function readThread(items: Item[]): Thread | null {
  const sets = items.map(itemAttributes).filter(a => a.length > 0)
  if (sets.length < THREAD_MIN_ITEMS) return null

  // Count items-per-value (not occurrences) so one item can't inflate a tag.
  const counts: Partial<Record<Facet, Map<string, number>>> = {}
  for (const attrs of sets) {
    const seen = new Set<string>()
    for (const a of attrs) {
      const v = normValue(a.value)
      if (!v) continue
      const key = `${a.facet}:${v}`
      if (seen.has(key)) continue
      seen.add(key)
      const m = (counts[a.facet] ??= new Map())
      m.set(v, (m.get(v) ?? 0) + 1)
    }
  }

  const tokens: string[] = []
  for (const facet of READ_FACETS) {
    const m = counts[facet]
    if (!m) continue
    let best: string | null = null
    let bestN = 0
    for (const [val, n] of m) {
      if (n >= RECUR_MIN && n > bestN) { best = val; bestN = n }
    }
    if (best) tokens.push(best)
    if (tokens.length >= 4) break
  }

  return tokens.length ? { tokens, basis: sets.length } : null
}

export function newCandidateId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Read a pasted product link via the free /api/og-parse endpoint.
 * Returns the scraped fields, or an error reason to show the user.
 */
export async function parseProductLink(
  url: string,
): Promise<{ ok: true; fields: ProductFields } | { ok: false; reason: string }> {
  let resp: Response
  try {
    resp = await fetch('/api/og-parse', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ url }),
    })
  } catch {
    return { ok: false, reason: "Couldn't reach the link. Check your connection." }
  }
  if (resp.status === 401) return { ok: false, reason: 'Please sign in again.' }
  if (resp.status === 429) return { ok: false, reason: 'Slow down a moment, then try again.' }
  if (!resp.ok) return { ok: false, reason: "Couldn't read that link." }

  const data = await resp.json()
  if (!data.ok) return { ok: false, reason: data.reason ?? "Couldn't read that link." }
  return {
    ok: true,
    fields: {
      title: data.title ?? '',
      image: data.image ?? null,
      price: data.price ?? null,
      brand: data.brand ?? null,
      siteName: data.siteName ?? null,
      url: data.url ?? url,
    },
  }
}

/**
 * Slice 4 — paid vision read (Sonnet 4.6, ~$0.01/call). Reads taste attributes
 * off a product image (material/palette/vibe/category) so the board mirrors you
 * without manual tagging. Reads the look, never the identity. Fires automatically
 * in the background after a save — best-effort, so any failure just means no
 * auto-tags (the user can still tag by hand). Sends only the image URL.
 */
export async function readImageAttributes(
  image: string,
  referer?: string | null,
): Promise<{ ok: true; attributes: Attribute[] } | { ok: false; reason: string }> {
  let resp: Response
  try {
    resp = await fetch('/api/things-vision', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ image, referer: referer || undefined }),
    })
  } catch {
    return { ok: false, reason: "Couldn't reach the reader." }
  }
  if (!resp.ok) {
    // Surface the server's specific reason (e.g. the image 403'd) so failures
    // aren't silent — the board shows a brief note and we can diagnose.
    let reason = 'Could not read that image.'
    try { const e = await resp.json(); if (e?.reason) reason = `image: ${e.reason}` } catch { /* keep default */ }
    return { ok: false, reason }
  }
  const data = await resp.json()
  const attributes = normAttributes(Array.isArray(data.attributes) ? data.attributes : [])
  return { ok: true, attributes }
}

export type Comparison = { notes: string[]; lean: number | null; verdict: string }

/**
 * Opt-in AI weigh-up of the candidates in a plan-a-purchase (Haiku, ~$0.001/call).
 * Sends text only — names, brands, prices — never images.
 */
export async function compareCandidates(
  intent: string,
  candidates: Candidate[],
  brief?: string | null,
): Promise<{ ok: true; result: Comparison } | { ok: false; reason: string }> {
  let resp: Response
  try {
    resp = await fetch('/api/things-compare', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        intent,
        brief: brief || undefined,
        candidates: candidates.map(c => ({ title: c.title, brand: c.brand, price: c.price, wasPrice: c.wasPrice, url: c.url })),
      }),
    })
  } catch {
    return { ok: false, reason: "Couldn't reach the comparison. Check your connection." }
  }
  if (resp.status === 429) return { ok: false, reason: 'That’s a lot of comparing — try again next hour.' }
  if (!resp.ok) return { ok: false, reason: 'Could not compare those right now.' }
  const data = await resp.json()
  return { ok: true, result: { notes: data.notes ?? [], lean: data.lean ?? null, verdict: data.verdict ?? '' } }
}
