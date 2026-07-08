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
// SUGGESTED in src/lib/things.ts). material/palette/vibe are light guidance, not
// a closed list — `category` IS closed (s108), see CATEGORY_VALUES below.
export const FACET_VOCAB = {
  material: ['wool', 'leather', 'linen', 'cotton', 'silk', 'denim', 'knit', 'suede'],
  palette: ['muted', 'earth', 'monochrome', 'neutral', 'warm', 'bold', 'pastel'],
  vibe: ['structured', 'oversized', 'tailored', 'relaxed', 'minimal', 'statement', 'bold', 'chunky', 'sleek'],
  category: ['outerwear', 'dresses & jumpsuits', 'bottoms', 'tops', 'shoes', 'bags', 'jewelry', 'furniture', 'lighting', 'decor', 'kitchenware', 'appliances', 'skincare', 'makeup', 'fragrance', 'other'],
} as const
export const FACETS = Object.keys(FACET_VOCAB) as (keyof typeof FACET_VOCAB)[]
const CATEGORY_VALUES: string[] = [...FACET_VOCAB.category]

// Twin of the synonym map in src/lib/things.ts (Vercel functions can't import
// from src/ — same tradeoff as the genre vocab, see docs/REFERENCE.md). Server-
// side safety net in case the model still drifts off-list despite the prompt.
const CATEGORY_SYNONYMS: Record<string, string> = {
  coat: 'outerwear', jacket: 'outerwear', blazer: 'outerwear', parka: 'outerwear',
  dress: 'dresses & jumpsuits', dresses: 'dresses & jumpsuits', jumpsuit: 'dresses & jumpsuits', romper: 'dresses & jumpsuits',
  skirt: 'bottoms', shorts: 'bottoms', trousers: 'bottoms', pants: 'bottoms', jeans: 'bottoms', leggings: 'bottoms',
  top: 'tops', shirt: 'tops', blouse: 'tops', knitwear: 'tops', knit: 'tops', sweater: 'tops', cardigan: 'tops', tee: 'tops', 't-shirt': 'tops', tshirt: 'tops',
  boots: 'shoes', sneakers: 'shoes', sandals: 'shoes', heels: 'shoes', flats: 'shoes',
  bag: 'bags', purse: 'bags', tote: 'bags', clutch: 'bags', backpack: 'bags',
  jewellery: 'jewelry', necklace: 'jewelry', earrings: 'jewelry', ring: 'jewelry', bracelet: 'jewelry',
  chair: 'furniture', table: 'furniture', sofa: 'furniture', shelf: 'furniture', shelving: 'furniture',
  lamp: 'lighting', light: 'lighting', lights: 'lighting',
  vase: 'decor', art: 'decor', candle: 'decor', rug: 'decor', throw: 'decor', blanket: 'decor',
  fabric: 'decor', 'material sample': 'decor', 'surface material': 'decor', textile: 'decor', swatch: 'decor',
  cookware: 'kitchenware', kitchen: 'kitchenware',
  vacuum: 'appliances', tv: 'appliances', television: 'appliances', appliance: 'appliances',
  perfume: 'fragrance', cosmetics: 'makeup',
}
function normalizeCategory(raw: string): string {
  const v = raw.trim().toLowerCase()
  if (CATEGORY_VALUES.includes(v)) return v
  return CATEGORY_SYNONYMS[v] ?? 'other'
}

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

// material/palette/vibe are open-ended (examples, not a closed list); category is
// the one facet the model must pick verbatim from — no inventing new words (s108).
const OPEN_FACET_VOCAB = FACETS.filter(f => f !== 'category').map(f => `- ${f}: e.g. ${FACET_VOCAB[f].join(', ')}`).join('\n')
const CATEGORY_LINE = `- category: pick EXACTLY ONE of: ${FACET_VOCAB.category.join(', ')}. If nothing fits well, use "other" — do not invent a new word.`

const PROMPT = (() => {
  return `Look at this product image and read its TASTE — the look, not the identity. Do NOT name the brand, read any logo or text, or try to identify the exact product. Just describe what the eye sees.

Tag it on these facets (one or two words each, lowercase). Use the examples as a guide for the vibe and granularity, but pick whatever word actually fits — you're not limited to the list:
${OPEN_FACET_VOCAB}
${CATEGORY_LINE}

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

// The mood-board twin of PROMPT above (s109, Farah). A mood image isn't
// necessarily a purchasable product — it can be an interior, a texture, a street
// photo, anything whose LOOK caught their eye — so forcing it through the
// product-shaped prompt (garment-cut vibe words, a closed clothing/home/beauty
// category, a packshot/onModel/lifestyle shotType call) either mistags it or
// leaves it under-tagged ("skip any facet you'd be guessing at" bites hard when
// the image isn't clothing at all). No category or shotType here — neither is
// used for an inspiration item (see InspirationMeta / things-taste.ts's HIDE set).
const INSPIRATION_FACETS = FACETS.filter(f => f !== 'category')
const INSPIRATION_OPEN_VOCAB = INSPIRATION_FACETS.map(f => `- ${f}: e.g. ${FACET_VOCAB[f].join(', ')}`).join('\n')

const INSPIRATION_PROMPT = (() => {
  return `Look at this image from someone's personal mood board — pure inspiration, not necessarily something they'd buy. It might be a product, but just as easily an interior, a texture, a scene, a street photo, or anything else whose LOOK caught their eye. Read its aesthetic register — the feeling the image gives off — not its identity. Do NOT name a brand, read any logo or text, or try to identify an exact product.

Tag it on these facets (one or two words each, lowercase). These are examples, not a checklist — reach for whatever word actually captures the image, including atmosphere/mood words (moody, warm, sun-bleached, worn, quiet, lived-in, soft-focus) alongside material/palette when that's genuinely what carries the feeling:
${INSPIRATION_OPEN_VOCAB}

Only tag a facet when you can genuinely see or feel it in the image — skip a facet entirely rather than force a garment-style word onto something that isn't clothing (a room, a landscape, a texture). One value per facet (the dominant one). Better to return fewer, honest tags than to pad.

Return JSON only, no prose:
{ "attributes": [ { "facet": "material|palette|vibe", "value": "<one or two words>" }, ... ] }`
})()

// Clean a raw model attribute list down to well-formed tags: one per known facet,
// value trimmed/lowercased/short.
function cleanAttributes(raw: unknown[]): Attribute[] {
  const seen = new Set<string>()
  return raw
    .map(a => a as { facet?: string; value?: string })
    .filter(a => a && FACETS.includes(a.facet as keyof typeof FACET_VOCAB) && typeof a.value === 'string' && a.value.trim())
    .map(a => ({ facet: a.facet as string, value: a.value!.trim().toLowerCase().slice(0, 24) }))
    .map(a => (a.facet === 'category' ? { ...a, value: normalizeCategory(a.value) } : a))
    .filter(a => !seen.has(a.facet) && seen.add(a.facet))
}

export type Confidence = 'high' | 'medium' | 'low'
const asConfidence = (v: unknown): Confidence => (v === 'high' || v === 'low' ? v : 'medium')

// A normalized crop rectangle (fractions of the image, 0–1). Used to isolate the
// product out of a full-page screenshot before we host + cut it out.
export type Box = { x: number; y: number; w: number; h: number }
// Validate + sanitize the model's box: 4 finite numbers, a real (non-tiny) area
// inside the frame. A near-full box (it returned the whole page) is treated as "no
// crop" since cropping to it does nothing useful. Returns null on anything off.
function cleanBox(raw: unknown): Box | null {
  const b = raw as Partial<Box> | null
  if (!b || ![b.x, b.y, b.w, b.h].every(n => typeof n === 'number' && isFinite(n))) return null
  const x = Math.min(Math.max(b.x!, 0), 1), y = Math.min(Math.max(b.y!, 0), 1)
  const w = Math.min(Math.max(b.w!, 0), 1 - x), h = Math.min(Math.max(b.h!, 0), 1 - y)
  if (w < 0.08 || h < 0.08) return null            // too small to be the product
  if (w > 0.94 && h > 0.94) return null            // basically the whole frame → no crop
  return { x, y, w, h }
}

// Read a PRODUCT off a screenshot — its identity (name/brand/price) AND its look
// (the same taste tags + shot type readImageAttributes reads), in one vision call.
// Unlike readImageAttributes (which deliberately ignores text/identity), this DOES
// read the visible product name, brand and price, because the whole point of a
// screenshot capture is to recover a product from a shop page a scraper can't reach.
// Powers the in-app "add by screenshot" path (api/screenshot-product.ts). One Sonnet
// vision call, ~1¢. Never throws — returns a reason so the caller can surface it.
const PRODUCT_PROMPT = (() => {
  return `This is a screenshot of a product — clothing, an accessory, a bag, shoes, or some object to buy. Read it two ways:

1) IDENTITY — the visible text: the product name (no marketing fluff), the brand/label, and the price (with its currency symbol, e.g. £240). Leave any you genuinely can't see as null.

2) LOOK — the taste, the same way you'd read any product photo. Tag these facets (one or two words each, lowercase), reading only what the eye sees, never inventing:
${OPEN_FACET_VOCAB}
${CATEGORY_LINE}
Only tag a facet you can genuinely see; skip the rest. Fewer honest tags beat padding.

3) CROP BOX — this is a screenshot of a whole page (browser bars, site header, price text, other clutter), but we only want THE PRODUCT IN ITS PHOTO. Return "box": the bounding box of just the product's image, as normalized coordinates {"x":0-1,"y":0-1,"w":0-1,"h":0-1} where x,y is the top-left corner and w,h are width/height as fractions of the full image. Tight to the product photo, excluding the browser chrome, site header, navigation, price/description text, and any "you may also like" thumbnails. If the screenshot is ALREADY just the product (no page around it), return null.

Also classify how the product is SHOWN as "shotType" — judging the PRODUCT'S PHOTO inside the box, not the page around it (this gates a clean cutout, so be strict):
- "onModel": ANY person visible (worn, held, even a hand or legs). If you see a person at all, it's "onModel".
- "lifestyle": no person, but staged in a scene / among objects / on a real surface.
- "product": ONLY the item, alone on a plain studio background (a clean packshot).
When in doubt, do NOT say "product".

Return JSON only:
{ "title": "product name or null", "brand": "label or null", "price": "display price or null", "confidence": "high|medium|low", "shotType": "product|onModel|lifestyle", "box": {"x":0,"y":0,"w":1,"h":1} or null, "attributes": [ { "facet": "material|palette|vibe|category", "value": "<one or two words>" } ] }

Set confidence to how sure you are of the IDENTITY (the name). If the screenshot is blurry, cropped, or you're guessing the product, say "low".`
})()

export async function readProductFromImage(
  imageUrl: string,
  referer?: string,
): Promise<
  | { ok: true; title: string | null; brand: string | null; price: string | null; attributes: Attribute[]; shotType: ShotType | null; confidence: Confidence; box: Box | null }
  | { ok: false; reason: string }
> {
  const img = await fetchImageBase64(imageUrl, referer)
  if (!img.ok) return { ok: false, reason: img.reason }
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 320,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: img.media, data: img.data } },
          { type: 'text', text: PRODUCT_PROMPT },
        ],
      }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    const attributes = cleanAttributes(Array.isArray(parsed.attributes) ? parsed.attributes : [])
    const shotType = SHOT_TYPES.includes(parsed.shotType) ? (parsed.shotType as ShotType) : null
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    return { ok: true, title: str(parsed.title), brand: str(parsed.brand), price: str(parsed.price), attributes, shotType, confidence: asConfidence(parsed.confidence), box: cleanBox(parsed.box) }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'vision-error' }
  }
}

// Read taste attributes off a product OR mood-board image URL. Fetches the image
// (browser UA + Referer), runs Sonnet vision, returns cleaned tags. Never throws —
// returns a reason on failure so callers can log + carry on (the save still
// stands). `kind` picks which prompt fits what's actually being read — a wishlist
// save is a product photo, a mood-board save is 'inspiration' and may not be a
// product at all (see INSPIRATION_PROMPT above).
export async function readImageAttributes(
  imageUrl: string,
  referer?: string,
  kind: 'product' | 'inspiration' = 'product',
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
          { type: 'text', text: kind === 'inspiration' ? INSPIRATION_PROMPT : PROMPT },
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
