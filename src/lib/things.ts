// The "Things" domain — shopping / wishlist as a taste mirror.
//
// Everything rides on the existing `Item` model (no migration): a thing is just an
// item with `type:'thing'`. The shape lives in `metadata.kind`:
//   - 'product'     — a concrete thing you've saved (a specific coat, a specific lamp)
//   - 'intent'      — a need with no chosen product yet ("black clogs"), holding the
//                     candidates you're weighing in `metadata.candidates[]`
//   - 'inspiration' — a pure-inspiration image on the mood board (s76): not buyable,
//                     no price/link, just a picture whose look feeds the taste read.
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

// How a product photo frames the item, read off the vision call. Drives the board
// cutout: a bare `product` packshot cuts cleanly onto a cream tile; `onModel` /
// `lifestyle` shots would shred, so they stay full-bleed. See `src/lib/cutout.ts`.
export type ShotType = 'product' | 'onModel' | 'lifestyle'
export const SHOT_TYPES: ShotType[] = ['product', 'onModel', 'lifestyle']

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

/**
 * Pretty-print a scraped price for display: thousands separators, and drop a
 * trailing ".00" so "$3600.00" reads "$3,600" (and "$295.0" → "$295"). Keeps any
 * real cents ("$12.99" stays). Preserves the leading currency symbol; falls back
 * to the raw string if there's no number to parse (or a trailing-symbol currency
 * we can't safely reformat).
 */
export function formatPrice(raw: string | null | undefined): string | null {
  if (!raw) return raw ?? null
  // Only confidently reformat the US/UK shape: optional leading symbol, an integer
  // (with or without thousands commas), optional ".dd" cents. Anything else (a
  // trailing-symbol EU locale, "price on request") is left exactly as scraped.
  const m = raw.trim().match(/^([^\d]*?)\s*(\d[\d,]*)(?:\.(\d+))?\s*$/)
  if (!m) return raw
  const [, symbol, intPart, decPart] = m
  const intNum = parseInt(intPart.replace(/,/g, ''), 10)
  if (!Number.isFinite(intNum)) return raw
  const grouped = intNum.toLocaleString('en-US')
  // Keep cents only when they're non-zero (so ".00"/".0" vanish); pad to 2 digits.
  const cents = decPart && /[1-9]/.test(decPart) ? '.' + decPart.padEnd(2, '0').slice(0, 2) : ''
  return `${symbol}${grouped}${cents}`
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
  /** Your own reason for saving it — "for the seattle trip", "wait for a sale". */
  note?: string | null
  /** How the photo frames the item (vision-read). Gates the cutout. */
  shotType?: ShotType | null
  /**
   * A transparent-PNG subject cutout (Supabase Storage public URL), generated
   * browser-side at save for `product` shots. The board floats it on a gray tile so
   * a mixed set of shops reads as one catalog. Null/absent → show the photo itself.
   */
  cutout?: string | null
  /** Pipeline version of the stored cutout (see CUTOUT_VERSION) — drives re-polish. */
  cutoutV?: number | null
  /**
   * User override: hide the cutout and show the original photo instead. For the rare
   * shot the AI mis-read as a plain product and cut out badly (e.g. a full-body model
   * shot). Set from the product sheet; the board then renders the photo full-bleed.
   */
  cutoutHidden?: boolean | null
}

/** A weighed option inside an intent. Flat object stored in metadata.candidates[]. */
export type Candidate = ProductFields & { id: string }

export type ProductMeta = ProductFields & { kind: 'product' }

/**
 * A mood-board image (s76): pure inspiration, not a purchasable product. No price,
 * no buy-link, no deliberation — just an image whose *look* feeds the taste read.
 * `image` is either a Supabase Storage URL (an upload) or a pasted web image URL;
 * `hosted` flags the former so the wall can show it directly (a pasted URL is shown
 * through the same proxy products use, in case the source hotlink-blocks). The
 * `attributes` are vision-read the same way a product photo is (palette/material/
 * vibe), so a mood image contributes to the board's thread like any tagged thing.
 */
export type InspirationMeta = {
  kind: 'inspiration'
  image: string | null
  /** Where the image came from, if pasted from a page — tappable on the detail. */
  sourceUrl?: string | null
  /** True when `image` is one of our Storage uploads (show it directly). */
  hosted?: boolean
  attributes?: Attribute[]
  note?: string | null
}
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

export type Kind = 'product' | 'intent' | 'inspiration'

export function kindOf(item: Item): Kind | null {
  if (item.type !== 'thing') return null
  const k = (item.metadata as { kind?: string })?.kind
  return k === 'product' || k === 'intent' || k === 'inspiration' ? k : null
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
    note: m.note ?? null,
    shotType: m.shotType ?? null,
    cutout: m.cutout ?? null,
    cutoutV: m.cutoutV ?? null,
    cutoutHidden: m.cutoutHidden ?? null,
  }
}

export function inspirationMeta(item: Item): InspirationMeta {
  const m = (item.metadata ?? {}) as Partial<InspirationMeta>
  return {
    kind: 'inspiration',
    image: m.image ?? null,
    sourceUrl: m.sourceUrl ?? null,
    hosted: m.hosted ?? false,
    attributes: normAttributes(m.attributes),
    note: m.note ?? null,
  }
}

/**
 * The taste tags a thing contributes to the board's thread.
 * - a product → its own attributes
 * - a *decided* intent → the winning candidate's attributes (the committed choice)
 * - an undecided intent → nothing (not yet a settled signal)
 * - an inspiration (mood-board image) → its vision-read attributes (Farah, s76:
 *   the mood board feeds the same taste read, alongside the saved wishlist)
 *
 * Gated on `winner`, not status: the moment you pick a winner the plan is
 * "decided" and its choice counts, even before you mark it owned. (A decided plan
 * can be promoted to a standalone product via promoteIntentToProduct — once it is,
 * it contributes as a product instead, so the choice is never counted twice.)
 */
export function itemAttributes(item: Item): Attribute[] {
  const k = kindOf(item)
  if (k === 'product') return productMeta(item).attributes ?? []
  if (k === 'inspiration') return inspirationMeta(item).attributes ?? []
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
): Promise<{ ok: true; attributes: Attribute[]; shotType: ShotType | null } | { ok: false; reason: string }> {
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
  const shotType = SHOT_TYPES.includes(data.shotType) ? (data.shotType as ShotType) : null
  return { ok: true, attributes, shotType }
}

/**
 * Read a product off a SCREENSHOT (in-app "add by screenshot"). Hits the
 * /api/screenshot-product endpoint, which pulls identity (name/brand/price) AND
 * look-tags + shot type in one vision read — so a walled shop a scraper can't reach
 * still lands by photographing it. `image` is a hosted URL (we upload the shot
 * first). Mirrors readImageAttributes' shape; never throws.
 */
export type CropBox = { x: number; y: number; w: number; h: number }
export async function readProductFromImage(
  image: string,
  referer?: string | null,
): Promise<
  | { ok: true; title: string | null; brand: string | null; price: string | null; attributes: Attribute[]; shotType: ShotType | null; confidence: 'high' | 'medium' | 'low'; box: CropBox | null }
  | { ok: false; reason: string }
> {
  let resp: Response
  try {
    resp = await fetch('/api/screenshot-product', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ image, referer: referer || undefined }),
    })
  } catch {
    return { ok: false, reason: "Couldn't reach the reader." }
  }
  if (!resp.ok) {
    let reason = 'Could not read that screenshot.'
    try { const e = await resp.json(); if (e?.reason) reason = `image: ${e.reason}` } catch { /* keep default */ }
    return { ok: false, reason }
  }
  const data = await resp.json()
  const attributes = normAttributes(Array.isArray(data.attributes) ? data.attributes : [])
  const shotType = SHOT_TYPES.includes(data.shotType) ? (data.shotType as ShotType) : null
  const conf = data.confidence === 'high' || data.confidence === 'low' ? data.confidence : 'medium'
  const b = data.box
  const box: CropBox | null = b && [b.x, b.y, b.w, b.h].every((n: unknown) => typeof n === 'number')
    ? { x: b.x, y: b.y, w: b.w, h: b.h } : null
  return { ok: true, title: data.title ?? null, brand: data.brand ?? null, price: data.price ?? null, attributes, shotType, confidence: conf, box }
}

/**
 * A compact summary of the board's recurring taste, for the per-item "how this
 * fits" read. For each aesthetic facet, the top recurring values with how many
 * items carry each ([value, itemCount], like the thread but kept per-facet so the
 * one-liner can name a specific streak). Counts items-per-value (one item can't
 * inflate a tag), mirrors readThread's accounting. `category` is included here
 * (the model can use "bag vs. your coats" as a real point of difference).
 */
export type BoardTasteSummary = { thread: string[]; facets: Partial<Record<Facet, [string, number][]>> }

export function boardTasteSummary(items: Item[], topPerFacet = 5): BoardTasteSummary {
  const sets = items.map(itemAttributes).filter(a => a.length > 0)
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
  const facets: Partial<Record<Facet, [string, number][]>> = {}
  for (const facet of Object.keys(counts) as Facet[]) {
    const top = [...counts[facet]!.entries()]
      .filter(([, n]) => n >= RECUR_MIN)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topPerFacet)
    if (top.length) facets[facet] = top
  }
  return { thread: readThread(items)?.tokens ?? [], facets }
}

/**
 * Brands you keep reaching for. The keyword thread reads the *aesthetic*; this
 * reads the *makers* — a brand that recurs across saved products is a taste signal
 * of its own. Only products carry a brand (mood images don't), and the default
 * threshold of 3 keeps it to genuine patterns rather than coincidence. Brand
 * names are matched case-insensitively but shown as first seen.
 */
export function recurringBrands(items: Item[], min = 3): { brand: string; count: number }[] {
  const map = new Map<string, { brand: string; count: number }>()
  for (const item of items) {
    if (kindOf(item) !== 'product') continue
    const b = productMeta(item).brand?.trim()
    if (!b) continue
    const key = b.toLowerCase()
    const e = map.get(key) ?? { brand: b, count: 0 }
    e.count++
    map.set(key, e)
  }
  return Array.from(map.values())
    .filter(e => e.count >= min)
    .sort((a, b) => b.count - a.count)
}

/**
 * The per-item "how this fits your taste" one-liner (Haiku, text-only, ~$0.001).
 * Reads the item's already-extracted taste tags against the board summary — never
 * an image. Never auto-runs: called on an explicit tap, the result cached on
 * metadata.tasteFit so a product costs ~1¢ once.
 */
export async function readTasteFit(
  item: { title: string; brand: string | null; price: string | null; attributes: Attribute[] },
  board: BoardTasteSummary,
  styleProfile?: string | null,
): Promise<{ ok: true; fit: string } | { ok: false; reason: string }> {
  let resp: Response
  try {
    resp = await fetch('/api/things-taste-fit', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        title: item.title,
        brand: item.brand,
        price: item.price,
        attributes: item.attributes,
        board,
        styleProfile: styleProfile || undefined,
      }),
    })
  } catch {
    return { ok: false, reason: "Couldn't reach the reader. Check your connection." }
  }
  if (resp.status === 429) return { ok: false, reason: 'That’s a lot of reads — try again next hour.' }
  if (!resp.ok) return { ok: false, reason: 'Could not read that right now.' }
  const data = await resp.json()
  const fit = typeof data.fit === 'string' ? data.fit.trim() : ''
  if (!fit) return { ok: false, reason: 'Could not read that right now.' }
  return { ok: true, fit }
}

/**
 * The board-level taste synthesis (Haiku, text-only, ~$0.001). A 1–2 sentence "what
 * you're reflecting" read across the whole board (wishlist + mood), seeded from the
 * board summary. Never auto-runs: called on an explicit tap, the result cached in
 * user_prefs so it only costs when you ask for a fresh read.
 */
export async function readTasteSynthesis(
  board: BoardTasteSummary,
  count: number,
): Promise<{ ok: true; synthesis: string } | { ok: false; reason: string }> {
  let resp: Response
  try {
    resp = await fetch('/api/things-taste', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ board, count }),
    })
  } catch {
    return { ok: false, reason: "Couldn't reach the reader. Check your connection." }
  }
  if (resp.status === 429) return { ok: false, reason: 'That’s a lot of reads — try again next hour.' }
  if (!resp.ok) return { ok: false, reason: 'Could not read that right now.' }
  const data = await resp.json()
  const synthesis = typeof data.synthesis === 'string' ? data.synthesis.trim() : ''
  if (!synthesis) return { ok: false, reason: 'Could not read that right now.' }
  return { ok: true, synthesis }
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
  styleProfile?: string | null,
): Promise<{ ok: true; result: Comparison } | { ok: false; reason: string }> {
  let resp: Response
  try {
    resp = await fetch('/api/things-compare', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        intent,
        brief: brief || undefined,
        candidates: candidates.map(c => ({ title: c.title, brand: c.brand, price: c.price, wasPrice: c.wasPrice, url: c.url, attributes: c.attributes, note: c.note })),
        styleProfile: styleProfile || undefined,
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
