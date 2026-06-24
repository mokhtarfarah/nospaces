import Anthropic from '@anthropic-ai/sdk'
import { isSafePublicUrl } from './_ssrf.js'

// Shared taste-vision read (Slice 4). Reads taste attributes (material · palette ·
// vibe · category) off a product image — the LOOK, never the identity (no
// brand/logo/text recognition). Sonnet 4.6 vision, one image per call, ~$0.01 a call.
//
// Lives here (not in the HTTP endpoint) so two callers share ONE prompt + parser:
//   - api/things-vision.ts — the client-side auto-tag-on-save path
//   - api/email.ts         — the email-in capture path (vision-on-email, s71)

const client = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? '').replace(/[^\x20-\x7E]/g, '').trim() })

// The facets the masthead reads from, and the starter vocab (kept in sync with
// SUGGESTED in src/lib/things.ts — light guidance, not a closed list).
export const FACET_VOCAB = {
  material: ['wool', 'leather', 'linen', 'cotton', 'silk', 'denim', 'knit', 'suede'],
  palette: ['muted', 'earth', 'monochrome', 'neutral', 'warm', 'bold', 'pastel'],
  vibe: ['structured', 'oversized', 'tailored', 'relaxed', 'minimal', 'statement', 'bold', 'chunky', 'sleek'],
  category: ['coat', 'knitwear', 'boots', 'bag', 'dress', 'trousers'],
} as const
export const FACETS = Object.keys(FACET_VOCAB) as (keyof typeof FACET_VOCAB)[]

export type Attribute = { facet: string; value: string }

// How the product is shown. Drives the board's cutout: a bare `product` shot cuts
// cleanly onto a cream tile; an `onModel` or `lifestyle` (staged-scene) shot would
// shred if we tried — so those stay full-bleed. Read off the SAME vision call as
// the taste tags (no extra Anthropic spend).
export type ShotType = 'product' | 'onModel' | 'lifestyle'
const SHOT_TYPES: ShotType[] = ['product', 'onModel', 'lifestyle']

// Media types Anthropic vision accepts.
const OK_MEDIA = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type OkMedia = (typeof OK_MEDIA)[number]
const MAX_IMG_BYTES = 5 * 1024 * 1024 // Anthropic caps images ~5MB

// Fetch the product image ourselves as a browser would, then hand Anthropic the
// raw bytes (base64). This matters: retail CDNs routinely 403 non-browser
// fetchers, so passing the URL straight to the vision API failed silently on
// exactly the kind of links Farah saves. SSRF-guarded (the URL is user-influenced).
export async function fetchImageBuffer(
  url: string,
  referer?: string,
): Promise<{ ok: true; buf: Buffer; media: OkMedia } | { ok: false; reason: string }> {
  if (!isSafePublicUrl(url)) return { ok: false, reason: 'unsafe-url' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    // Present as a real browser loading the image FROM the product page — many
    // retail CDNs (Shopify hotlink protection) 403 anything without a matching
    // Referer / origin, even with a browser User-Agent.
    let origin: string | undefined
    try { origin = referer ? new URL(referer).origin : new URL(url).origin } catch { /* ignore */ }
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        // Deliberately NO image/avif — CDNs content-negotiate on this header and
        // would serve AVIF, which Anthropic vision rejects. Ask only for formats
        // the vision API accepts (webp/png/jpeg/gif).
        'Accept': 'image/webp,image/png,image/jpeg,image/gif,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        ...(referer ? { 'Referer': referer } : {}),
        ...(origin ? { 'Origin': origin } : {}),
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'same-origin',
      },
    })
    if (!resp.ok) return { ok: false, reason: `fetch-${resp.status}` }
    const ctype = (resp.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    const media = OK_MEDIA.find(m => m === ctype)
    if (!media) return { ok: false, reason: `bad-type-${ctype || 'none'}` }
    const buf = Buffer.from(await resp.arrayBuffer())
    if (buf.length === 0) return { ok: false, reason: 'empty' }
    if (buf.length > MAX_IMG_BYTES) return { ok: false, reason: 'too-big' }
    return { ok: true, buf, media }
  } catch (err) {
    return { ok: false, reason: err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'fetch-failed' }
  } finally {
    clearTimeout(timer)
  }
}

// Base64 wrapper for the vision callers (Anthropic wants base64). Thin shim over
// fetchImageBuffer so the browser-spoofing fetch lives in exactly one place.
export async function fetchImageBase64(
  url: string,
  referer?: string,
): Promise<{ ok: true; data: string; media: OkMedia } | { ok: false; reason: string }> {
  const r = await fetchImageBuffer(url, referer)
  if (!r.ok) return r
  return { ok: true, data: r.buf.toString('base64'), media: r.media }
}

const PROMPT = (() => {
  const vocab = FACETS.map(f => `- ${f}: e.g. ${FACET_VOCAB[f].join(', ')}`).join('\n')
  return `Look at this product image and read its TASTE — the look, not the identity. Do NOT name the brand, read any logo or text, or try to identify the exact product. Just describe what the eye sees.

Tag it on these facets (one or two words each, lowercase). Use the examples as a guide for the vibe and granularity, but pick whatever word actually fits — you're not limited to the list:
${vocab}

Only tag a facet when you can genuinely see it. Skip material if you can't tell the fabric; skip any facet you'd be guessing at. One value per facet (the dominant one). Better to return fewer, honest tags than to pad.

Also classify how the product is SHOWN, as "shotType". This decides whether we can
cut the item out cleanly, so be strict:
- "onModel": ANY person is visible — worn, held, or even partly in frame (a hand, legs, a body). If you see a person at all, it is "onModel", never "product".
- "lifestyle": no person, but staged in a scene or among other objects — propped on furniture, on a real surface, in a room, outdoors.
- "product": ONLY the item itself, alone, floating on a plain seamless studio background (a clean packshot), no person and no scenery.
When in doubt, do NOT say "product" — prefer "onModel" (if any person) or "lifestyle". "product" is reserved for a clean isolated packshot.

Return JSON only, no prose:
{ "shotType": "product|onModel|lifestyle", "attributes": [ { "facet": "material|palette|vibe|category", "value": "<one or two words>" }, ... ] }`
})()

// Clean a raw model attribute list down to well-formed tags: one per known facet,
// value trimmed/lowercased/short.
function cleanAttributes(raw: unknown[]): Attribute[] {
  const seen = new Set<string>()
  return raw
    .map(a => a as { facet?: string; value?: string })
    .filter(a => a && FACETS.includes(a.facet as keyof typeof FACET_VOCAB) && typeof a.value === 'string' && a.value.trim())
    .map(a => ({ facet: a.facet as string, value: a.value!.trim().toLowerCase().slice(0, 24) }))
    .filter(a => !seen.has(a.facet) && seen.add(a.facet))
}

// Read taste attributes off a product image URL. Fetches the image (browser UA +
// Referer), runs Sonnet vision, returns cleaned tags. Never throws — returns a
// reason on failure so callers can log + carry on (the save still stands).
export async function readImageAttributes(
  imageUrl: string,
  referer?: string,
): Promise<{ ok: true; attributes: Attribute[]; shotType: ShotType | null } | { ok: false; reason: string }> {
  const img = await fetchImageBase64(imageUrl, referer)
  if (!img.ok) return { ok: false, reason: img.reason }
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 220,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: img.media, data: img.data } },
          { type: 'text', text: PROMPT },
        ],
      }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    const attributes = cleanAttributes(Array.isArray(parsed.attributes) ? parsed.attributes : [])
    const shotType = SHOT_TYPES.includes(parsed.shotType) ? (parsed.shotType as ShotType) : null
    return { ok: true, attributes, shotType }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'vision-error' }
  }
}
