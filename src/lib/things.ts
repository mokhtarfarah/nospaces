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
  return { kind: 'intent', candidates: m.candidates ?? [], leaning: m.leaning ?? null, winner: m.winner ?? null }
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
  }
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
