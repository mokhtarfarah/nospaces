import { timingSafeEqual } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { genreBlock } from './_genres.js'
import { isSafePublicUrl } from './_ssrf.js'
import { scrapeProduct, type ScrapedFields } from './_scrape.js'
import { readImageAttributes, FACET_VOCAB, FACETS, type Attribute, type ShotType } from './_vision.js'

// Strip any non-ASCII chars that may have crept in via copy-paste
const cleanEnv = (s: string | undefined) => (s ?? '').replace(/[^\x20-\x7E]/g, '').trim()

const anthropic = new Anthropic({ apiKey: cleanEnv(process.env.ANTHROPIC_API_KEY) })
const supabase = createClient(
  cleanEnv(process.env.SUPABASE_URL),
  cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY),
)

if (!process.env.ALLOWED_EMAILS) {
  console.error('[email] ALLOWED_EMAILS env var is not set — all inbound email will be rejected')
}
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS ?? '')
  .split(',').map(e => e.trim()).filter(Boolean)

// Inbound webhook secret. Postmark authenticates the webhook by HTTP Basic Auth baked into
// the configured URL (https://user:SECRET@host/api/email), which arrives as an
// `Authorization: Basic base64(user:SECRET)` header. A `?token=SECRET` query param is also
// accepted as a fallback. This gate runs before the body is read or any paid API is called,
// closing the spoofable-`From` cost-DoS hole (a direct POST can forge `From`, but not the secret).
const WEBHOOK_SECRET = cleanEnv(process.env.EMAIL_WEBHOOK_SECRET)
if (!WEBHOOK_SECRET) {
  console.error('[email] EMAIL_WEBHOOK_SECRET not set — all inbound email will be rejected (fail closed)')
}

// Constant-time compare; returns false on any length mismatch (timingSafeEqual throws on
// unequal-length buffers) so an attacker can't learn the secret length via timing.
function secretMatches(provided: string): boolean {
  if (!WEBHOOK_SECRET || !provided) return false
  const a = new Uint8Array(Buffer.from(provided))
  const b = new Uint8Array(Buffer.from(WEBHOOK_SECRET))
  return a.length === b.length && timingSafeEqual(a, b)
}

function isAuthorized(req: VercelRequest): boolean {
  // ?token=SECRET fallback
  const token = (req.query?.token as string | undefined) ?? ''
  if (secretMatches(token)) return true
  // Authorization: Basic base64(user:SECRET) — compare the password half
  const auth = req.headers.authorization ?? ''
  if (auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8')
    const pass = decoded.slice(decoded.indexOf(':') + 1)
    if (secretMatches(pass)) return true
  }
  return false
}

// Talkback: reply to the sender with what happened (saved / nothing / error) so a silent
// failure can never go unnoticed again. No-ops safely until POSTMARK_SERVER_TOKEN is set,
// so deploying this never breaks capture even before the Postmark sending setup is done.
const POSTMARK_TOKEN = cleanEnv(process.env.POSTMARK_SERVER_TOKEN)
const REPLY_FROM_OVERRIDE = cleanEnv(process.env.POSTMARK_FROM)

async function sendReply(to: string, fromAddress: string, subject: string, text: string) {
  if (!POSTMARK_TOKEN) {
    console.log('[email] POSTMARK_SERVER_TOKEN not set — skipping reply')
    return
  }
  const from = REPLY_FROM_OVERRIDE || `Nospaces <${fromAddress}>`
  try {
    const r = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': POSTMARK_TOKEN,
      },
      body: JSON.stringify({ From: from, To: to, Subject: subject, TextBody: text, MessageStream: 'outbound' }),
    })
    if (!r.ok) console.error('[email] reply send failed:', r.status, await r.text())
    else console.log('[email] reply sent to', to)
  } catch (err) {
    console.error('[email] reply error:', err instanceof Error ? err.message : err)
  }
}

// Log an inbound email that produced NO new library items, so it surfaces in the
// in-app "email captures" feed instead of vanishing. Successful captures are NOT
// logged here — they already show up as items in the "for review" inbox. Best-effort:
// a logging failure must never break the (already-finished) capture flow.
async function logCapture(opts: {
  userId: string | null
  fromEmail: string
  subject: string
  outcome: 'nothing_found' | 'duplicates' | 'error'
  savedCount?: number
  detail?: string | null
  snippet?: string | null
}) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('email_captures').insert({
      user_id: opts.userId,
      from_email: opts.fromEmail,
      subject: opts.subject,
      outcome: opts.outcome,
      saved_count: opts.savedCount ?? 0,
      detail: opts.detail ?? null,
      snippet: opts.snippet ?? null,
    })
  } catch (err) {
    console.error('[email] failed to log capture:', err instanceof Error ? err.message : err)
  }
}

// Things-domain routing. An email sent to one of these address local-parts
// (e.g. things@nospaces.xyz) is a product link for the board, NOT media — it's
// handled by the free scraper, no Anthropic call. Everything else is media.
const THINGS_LOCALPARTS = (cleanEnv(process.env.THINGS_EMAIL_LOCALPARTS) || 'things,shop,want')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
function isThingsAddress(addr: string): boolean {
  const local = (addr.split('@')[0] ?? '').toLowerCase()
  return THINGS_LOCALPARTS.some(p => local.includes(p))
}

// "save@" is the ONE universal capture address — unlike things@ (products only,
// no AI), it takes anything: a clear shop link short-circuits to the board with
// no AI cost, and everything else goes through the full media reader (which also
// catches products it can't read as media). So you only have one address to
// remember. Exact-match the local-part so e.g. "saved-list@" doesn't qualify.
const CAPTURE_LOCALPARTS = (cleanEnv(process.env.CAPTURE_EMAIL_LOCALPARTS) || 'save')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
function isCaptureAll(addr: string): boolean {
  const local = (addr.split('@')[0] ?? '').toLowerCase()
  return CAPTURE_LOCALPARTS.includes(local)
}

// Anthropic only accepts these image media types.
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

type Attachment = { ContentType?: string; Content?: string; Name?: string; ContentID?: string }

// An inline image (ContentID set, referenced by `cid:` in the HTML) is shop-email
// decoration — product thumbnails, swatches, tracking pixels, a sender's logo. It's
// never "your photo", so we skip it: reading it would burn a vision call on clutter
// and could misfire a swatch into the library. A real attachment a human chose to
// attach (a screenshot, a poster photo) has no ContentID, so it survives this filter.
function isInlineImage(att: Attachment): boolean {
  return !!(att.ContentID && att.ContentID.trim())
}

// Decoded byte size of an attachment (from its base64 Content). Used to tell a real
// photo/screenshot from shop-email decoration by weight.
function attachmentBytes(att: Attachment): number {
  const b64 = att.Content ?? ''
  if (!b64) return 0
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((b64.length * 3) / 4) - pad)
}

// The inline-image filter (ContentID) is not enough: FORWARDING a shop email strips
// the cid: relationship, so its decorative swatches/thumbnails/pixels arrive as plain
// attachments that look deliberate. Two more signals separate a human's photo from
// decoration, both checked BEFORE any paid vision call so clutter never becomes junk
// board cards and never costs anything:
//   • size — a real screenshot/photo is hundreds of KB; swatches, thumbnails and
//     tracking pixels are a few KB.
//   • count — a person attaches one or two photos; a shop newsletter carries dozens.
const MIN_DELIBERATE_IMAGE_BYTES = 50_000
const MAX_DELIBERATE_IMAGES = 5

// Figure out the real image type from the MIME type (params stripped) or the filename.
function imageType(att: Attachment): string {
  let t = (att.ContentType ?? '').split(';')[0].trim().toLowerCase()
  if (t === 'image/jpg') t = 'image/jpeg'
  const name = (att.Name ?? '').toLowerCase()
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : ''
  // octet-stream / missing type → fall back to the file extension
  if (!t.startsWith('image/') || t === 'image/octet-stream') {
    const byExt: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
    }
    if (byExt[ext]) t = byExt[ext]
  }
  return t
}

// Return base64 data + a media type Anthropic will accept, converting HEIC/HEIF (iPhone's
// default photo format, which Anthropic rejects) to JPEG. Returns null if unusable.
async function prepImage(att: Attachment): Promise<{ mediaType: string; data: string } | null> {
  if (!att.Content) return null
  let mediaType = imageType(att)
  let data = att.Content

  if (mediaType === 'image/heic' || mediaType === 'image/heif') {
    // Loaded lazily (not at module scope) so its WASM payload never runs at function
    // import time — a top-level import was crashing the whole endpoint on Vercel.
    // heic-convert ships no types.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const heicConvert = (await import('heic-convert')).default
    const input = Buffer.from(data, 'base64')
    // Anthropic rejects images over ~5MB (base64). Start at decent quality and step down
    // for very large photos (e.g. 48MP) until the raw JPEG is comfortably under the limit.
    let quality = 0.6
    let out: ArrayBuffer = await heicConvert({ buffer: input, format: 'JPEG', quality })
    while (out.byteLength > 3_600_000 && quality > 0.3) {
      quality -= 0.2
      out = await heicConvert({ buffer: input, format: 'JPEG', quality })
    }
    data = Buffer.from(out).toString('base64')
    mediaType = 'image/jpeg'
  }

  if (!SUPPORTED_IMAGE_TYPES.includes(mediaType)) return null
  return { mediaType, data }
}

// Extract http/https URLs from text, capped to avoid abuse. Email content is
// attacker-controllable, so drop any URL that fails the SSRF guard (loopback /
// private / link-local / cloud-metadata) before it can be fetched server-side.
function extractUrls(text: string): string[] {
  // eslint-disable-next-line no-control-regex -- intentionally exclude control chars from URLs
  return (text.match(/https?:\/\/[^\s<>"{}|\\^[\]`\x00-\x1F]*/g) ?? [])
    .filter(isSafePublicUrl)
    .slice(0, 3)
}

// Like extractUrls but also pulls links out of HTML href="..." attributes — many
// forwarded shop emails are HTML-only, with the product link only in the markup
// (the visible text is "Shop now"), so tag-stripped text alone misses it.
function extractEmailUrls(textBody: string, htmlBody: string): string[] {
  // eslint-disable-next-line no-control-regex -- intentionally exclude control chars from URLs
  const fromText = textBody.match(/https?:\/\/[^\s<>"{}|\\^[\]`\x00-\x1F]*/g) ?? []
  const fromHref = [...htmlBody.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)].map(m => m[1].replace(/&amp;/g, '&'))
  return [...new Set([...fromText, ...fromHref].map(u => u.trim()))]
    .filter(isSafePublicUrl)
    .slice(0, 10)
}

type ThingCapture =
  | { kind: 'saved'; title: string; price: string | null; tagCount: number }
  | { kind: 'duplicate'; title: string }
  | { kind: 'no-link' }
  | { kind: 'unreadable' }
  | { kind: 'error'; message: string }

// Reply line about taste tags: if vision read some, say it auto-tagged (and that
// the user can tweak); if it read none, nudge them to tag by hand to feed the thread.
function tagNote(tagCount: number): string {
  return tagCount > 0
    ? `I auto-tagged its look (${tagCount} taste tag${tagCount > 1 ? 's' : ''}) to feed your thread — tweak them in the app if they're off.`
    : `Tag it (material, palette, vibe) in the app to feed your thread.`
}

// Scrape the first usable product link and save it to the board as a thing.
// `strict` (used by the auto-fallback on the media address) only saves pages that
// look like shop pages, so a forwarded article doesn't become a board card.
async function captureThing(userId: string, urls: string[], strict: boolean): Promise<ThingCapture> {
  if (urls.length === 0) return { kind: 'no-link' }
  let fields: ScrapedFields | null = null
  for (const u of urls) {
    const r = await scrapeProduct(u)
    if (r.ok && (r.fields.title || r.fields.image) && (!strict || r.fields.productLike)) { fields = r.fields; break }
  }
  if (!fields) return { kind: 'unreadable' }
  // Dedup by URL against the things already on the board.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('items').select('metadata').eq('user_id', userId).eq('type', 'thing')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (((existing ?? []) as any[]).some(t => (t.metadata?.url ?? '') === fields!.url)) {
    return { kind: 'duplicate', title: fields.title ?? 'That item' }
  }
  const title = fields.title ?? 'Untitled'
  // Vision-on-email (s71): read taste tags off the product image so an emailed
  // thing auto-tags like a client-side save does — email is the settled mobile
  // capture path, and was the ONE path landing untagged. ~1¢/thing (Sonnet
  // vision), only when there's an image. Best-effort: a vision failure (403 /
  // avif / timeout) must never block the save — we just store no attributes.
  let attributes: { facet: string; value: string }[] = []
  // The shot type rides the same read; stored so the board's "polish images"
  // backfill can cut out a bare product shot without re-reading the photo. (The
  // cutout itself runs browser-side, so an email-captured item is polished on the
  // next board visit, not here.)
  let shotType: string | null = null
  if (fields.image) {
    const v = await readImageAttributes(fields.image, fields.url)
    if (v.ok) {
      attributes = v.attributes
      shotType = v.shotType
      console.log('[email] vision tagged thing:', attributes.map(a => `${a.facet}:${a.value}`).join(', ') || '(none)', '· shot:', shotType ?? '(none)')
    } else {
      console.warn('[email] vision read failed (saving untagged):', v.reason)
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('items').insert({
    user_id: userId, title, creator: fields.brand, type: 'thing', status: 'want_to', source: 'email',
    metadata: { kind: 'product', title, image: fields.image, price: fields.price, brand: fields.brand, siteName: fields.siteName, url: fields.url, attributes, shotType },
  })
  if (error) return { kind: 'error', message: error.message }
  return { kind: 'saved', title, price: fields.price ?? null, tagCount: attributes.length }
}

type Confidence = 'high' | 'medium' | 'low'
const asConfidence = (v: unknown): Confidence => (v === 'high' || v === 'low' ? v : 'medium')

// What ONE Sonnet vision read of an emailed image returns: either a product (for the
// board) or a piece of media (for the library), with the fields each side needs —
// product look-tags ride the SAME call (no second vision spend). `null` title = the
// image had nothing identifiable.
type ClassifiedImage =
  | { kind: 'product'; title: string; brand: string | null; price: string | null; attributes: Attribute[]; shotType: ShotType | null; confidence: Confidence }
  | { kind: 'media'; title: string; creator: string | null; type: string; year: number | null; blurb: string | null; tags: string[]; confidence: Confidence }
  | null

// Clean a raw vision attribute list down to one well-formed tag per known facet.
function cleanVisionAttributes(raw: unknown): Attribute[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  return raw
    .map(a => a as { facet?: string; value?: string })
    .filter(a => a && FACETS.includes(a.facet as (typeof FACETS)[number]) && typeof a.value === 'string' && a.value.trim())
    .map(a => ({ facet: a.facet as string, value: a.value!.trim().toLowerCase().slice(0, 24) }))
    .filter(a => !seen.has(a.facet) && seen.add(a.facet))
}

// The screenshot-capture brain. A deliberately-attached image (a walled-shop
// screenshot, a poster photo) gets ONE vision read that decides product vs media
// and extracts the fields for whichever it is — so a shop a scraper can't reach
// still lands by photographing it. Never throws: a failure returns null and the
// caller carries on. ~1¢ per image (Sonnet vision).
const FACET_HINT = FACETS.map(f => `${f} (e.g. ${FACET_VOCAB[f].slice(0, 4).join(', ')})`).join('; ')
async function classifyEmailImage(prepped: { mediaType: string; data: string }): Promise<ClassifiedImage> {
  try {
    const r = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: prepped.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: prepped.data } },
          { type: 'text', text: `This image was emailed to be saved. Decide what it is, then extract its fields.

If it shows something to BUY — clothing, an accessory, a bag, shoes, an object, or a screenshot of a shop / product page — it's a PRODUCT.
If it shows a film, book, music album, or TV show (a poster, cover, still, or shop/streaming page for one) — it's MEDIA.

Return JSON only.
- PRODUCT: {"kind":"product","title":"the product name, no marketing fluff","brand":"the label/maker or null","price":"display price with currency symbol e.g. £240, or null","confidence":"high|medium|low","attributes":[{"facet":"material|palette|vibe|category","value":"one or two words, lowercase"}]}. For attributes, read the LOOK only (never the brand/logo) on these facets — ${FACET_HINT}. Only tag a facet you can genuinely see; fewer honest tags beat padding.
- MEDIA: {"kind":"media","title":"exact canonical title","creator":"director/author/artist/showrunner or null","type":"film|book|music|tv|other","year":1234,"confidence":"high|medium|low","blurb":"any visible caption/note/review text about it, verbatim or close, else null"}
- NOTHING identifiable: {"kind":"none","title":null}

Set confidence to how sure you are of the identification. If the image is blurry, ambiguous, or you're guessing, say "low".` },
        ],
      }],
    })
    const txt = r.content[0].type === 'text' ? r.content[0].text : ''
    const p = JSON.parse(txt.replace(/```json\n?|\n?```/g, '').trim())
    if (!p?.title || p.kind === 'none') return null
    if (p.kind === 'product') {
      return { kind: 'product', title: String(p.title), brand: p.brand ?? null, price: p.price ?? null,
        attributes: cleanVisionAttributes(p.attributes), shotType: null, confidence: asConfidence(p.confidence) }
    }
    return { kind: 'media', title: String(p.title), creator: p.creator ?? null, type: p.type ?? 'other',
      year: typeof p.year === 'number' ? p.year : null, blurb: p.blurb?.trim() ? String(p.blurb).trim() : null,
      tags: Array.isArray(p.tags) ? p.tags : [], confidence: asConfidence(p.confidence) }
  } catch (err) {
    console.error('[email] image classify failed:', err instanceof Error ? err.message : err)
    return null
  }
}

// Save a board thing read from a SCREENSHOT (no scrape, no link, no clean product
// image — the look-tags came from the screenshot itself). Linkless by design: the
// board card's "find online ↗" recovers the buy path. A low-confidence read lands
// flagged for review; a confident one lands live (saving is the signal).
async function saveScreenshotProduct(
  userId: string, p: Extract<ClassifiedImage, { kind: 'product' }>,
): Promise<{ kind: 'saved'; title: string; price: string | null; tagCount: number } | { kind: 'error'; message: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('items').insert({
    user_id: userId, title: p.title, creator: p.brand, type: 'thing', status: 'want_to', source: 'email',
    metadata: {
      kind: 'product', title: p.title, image: null, price: p.price, brand: p.brand, url: null,
      attributes: p.attributes, shotType: p.shotType,
      // Deliberate single capture lands live; only the machine's own uncertainty
      // (a low-confidence read) gets parked for review.
      ...(p.confidence === 'low' ? { review: true } : {}),
    },
  })
  if (error) return { kind: 'error', message: error.message }
  return { kind: 'saved', title: p.title, price: p.price, tagCount: p.attributes.length }
}

// Pull a usable product image URL out of a shop email's HTML — og:image first
// (the canonical product shot), then twitter:image. These are hosted CDN URLs
// (cdn.shop.com/…), which usually serve fine even when the product *page* itself
// 403s our scraper. Returns null if none / unsafe.
function productImageFromHtml(html: string): string | null {
  const get = (re: RegExp) => re.exec(html)?.[1]?.replace(/&amp;/g, '&').trim() ?? null
  const url =
    get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
    get(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
  return url && isSafePublicUrl(url) ? url : null
}

// Last-resort rescue when a shop LINK can't be scraped (Farfetch, Net-a-Porter and
// other luxury sites 403 any non-human visitor, so scrapeProduct returns nothing).
// The product details are sitting right there in the forwarded email body — read
// them with one cheap Sonnet call instead of re-fetching the walled page, and tag
// the look from an image in the email if there is one. Saves the thing to the board
// so a bot-walled shop still "just works". Returns null if it isn't a real product.
async function rescueProductFromEmail(
  userId: string, body: string, htmlBody: string, url: string | null,
): Promise<ThingCapture | null> {
  // Dedup up front so a re-forward of the same walled link doesn't double up.
  if (url) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('items').select('metadata').eq('user_id', userId).eq('type', 'thing')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (((existing ?? []) as any[]).some(t => (t.metadata?.url ?? '') === url)) {
      return { kind: 'duplicate', title: 'That item' }
    }
  }
  // (A) Read the product out of the email's own text — authoritative, no re-fetch.
  let fields: { title: string | null; brand: string | null; price: string | null }
  try {
    const r = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 256,
      messages: [{ role: 'user', content:
        `This is a shopping email whose product page we couldn't load. Read the single product it's about from the text below.\n\n${body.slice(0, 6000)}\n\nReturn JSON only: {"title": "the product name, no marketing or site fluff", "brand": "the label/maker or null", "price": "display price with its currency symbol, e.g. £632, or null"}. If this is NOT one purchasable product (e.g. a newsletter, an order receipt, an article), return {"title": null}.` }],
    })
    const txt = r.content[0].type === 'text' ? r.content[0].text : ''
    fields = JSON.parse(txt.replace(/```json\n?|\n?```/g, '').trim())
  } catch (err) {
    console.error('[email] product rescue read failed:', err instanceof Error ? err.message : err)
    return null
  }
  if (!fields?.title) return null

  // (B) Tag the look from a product image in the email (CDN URL usually serves even
  // when the page 403s). Best-effort — a vision miss never blocks the save.
  const image = productImageFromHtml(htmlBody)
  let attributes: { facet: string; value: string }[] = []
  let shotType: string | null = null
  if (image) {
    const v = await readImageAttributes(image, url ?? undefined)
    if (v.ok) { attributes = v.attributes; shotType = v.shotType }
    else console.warn('[email] rescue vision read failed (saving untagged):', v.reason)
  }

  const title = fields.title
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('items').insert({
    user_id: userId, title, creator: fields.brand, type: 'thing', status: 'want_to', source: 'email',
    metadata: { kind: 'product', title, image, price: fields.price, brand: fields.brand, url, attributes, shotType },
  })
  if (error) return { kind: 'error', message: error.message }
  return { kind: 'saved', title, price: fields.price ?? null, tagCount: attributes.length }
}

// Fetch a URL and return a compact summary of its OpenGraph / title metadata,
// or null if unreachable or metadata-free. Used to make bare-URL emails work.
async function fetchPageMeta(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Nospaces/1.0)' },
    })
    clearTimeout(t)
    if (!response.ok) return null
    const html = await response.text()
    const get = (pattern: RegExp) => pattern.exec(html)?.[1]?.trim() ?? null
    const siteName = get(/<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/i)
      ?? get(/<meta[^>]+content="([^"]+)"[^>]+property="og:site_name"/i)
    const ogTitle = get(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
      ?? get(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i)
    const pageTitle = get(/<title[^>]*>([^<]+)<\/title>/i)
    const ogDesc = get(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)
      ?? get(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i)
    const parts = [
      siteName && `Site: ${siteName}`,
      (ogTitle || pageTitle) && `Title: ${ogTitle ?? pageTitle}`,
      ogDesc && `Description: ${ogDesc.slice(0, 300)}`,
    ].filter(Boolean)
    return parts.length > 0 ? `URL: ${url}\n${parts.join('\n')}` : null
  } catch {
    return null
  }
}

const EMAIL_PROMPT = (subject: string, body: string, urlContext?: string) => `
This is an email or newsletter that was forwarded to be saved into a media library.
Subject: ${subject}

Body:
${body.slice(0, 12000)}

YOUR MAIN JOB: list EVERY film, book, music album, or TV show mentioned anywhere in this
email into the "items" array. Always include everything you find, even if there are many and
even if the email contains no explicit request to add them — a forwarded newsletter with ten
albums means all ten go in "items". Never return an empty "items" list when media is mentioned.

For EACH item, IDENTIFY it using your own knowledge — do not just copy words from the email.
Fill in the correct creator (director / author / artist / showrunner), the release year, and
the type, even if the email does not state them. Use the exact, canonical title. Only leave a
field null if you genuinely cannot identify the item.

The "instruction" field is only for the rare case where the reader added their own note saying
WHICH items to save (e.g. "add the second one" or "save Brat"). If there is such a note, set
instruction to "specific" and list those in "specified_items". Otherwise set instruction to
"all". Either way, "items" must still contain every media item you found.

Return JSON only:
{
  "instruction": "all | specific",
  "specified_items": [],
  "newsletter_name": "name of newsletter or sender if detectable, else null",
  "items": [
    {
      "title": "exact canonical title",
      "creator": "director / author / artist / showrunner",
      "type": "film|book|music|tv|other",
      "year": 1234,
      "summary": "1-2 sentences describing the ITEM ITSELF — its sound/plot/themes and why it's worth attention — paraphrasing what the email says about it. Describe the work, not its role in the email: NEVER write meta sentences like 'this is the album reviewed in the article' or 'the main subject of this newsletter'. If the email says nothing substantive about it, write one sentence from your own knowledge. Null only if there is genuinely nothing to say.",
      "confidence": "high|medium|low",
      "metadata": {},
      "tags": []
    }
  ]
}

GENRES — for each item, populate "tags" with 1–3 genres from the list for that item's type
(use values from this list ONLY, no other words). Leave [] for type "other" or if unsure.
${genreBlock()}
${urlContext ? `
LINKED PAGES — metadata fetched from URLs found in this email. Use these to identify any
items that appear only as links, treating them the same as items mentioned by name.
${urlContext}
` : ''}`

// Parse the model's JSON defensively. If the reply is truncated/malformed, salvage every
// complete item object from the "items" array (string-aware brace matching) so a long
// note never crashes the whole request.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeParse(raw: string): any {
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch { /* fall through to salvage */ }

  const arrStart = cleaned.indexOf('[', cleaned.indexOf('"items"'))
  if (arrStart < 0) return { items: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const objs: any[] = []
  let depth = 0, objStart = -1, inStr = false, esc = false
  for (let i = arrStart + 1; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') { if (depth === 0) objStart = i; depth++ }
    else if (ch === '}') {
      depth--
      if (depth === 0 && objStart >= 0) {
        try { objs.push(JSON.parse(cleaned.slice(objStart, i + 1))) } catch { /* skip partial */ }
        objStart = -1
      }
    } else if (ch === ']' && depth === 0) break
  }
  return { instruction: 'all', items: objs }
}

export const config = { maxDuration: 60 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // Reject any caller that can't present the shared webhook secret BEFORE reading the body
  // or calling Anthropic. Without this, a direct POST can forge an allowed `From` address
  // and trigger paid Sonnet calls (cost-DoS) + inject items into a real user's library.
  if (!isAuthorized(req)) {
    console.warn('[email] rejected: missing or invalid webhook secret')
    return res.status(401).json({ error: 'unauthorized' })
  }

  // Postmark sends inbound emails as JSON
  const { From, Subject, TextBody, HtmlBody, Attachments, OriginalRecipient, ToFull } = req.body
  // Reply from the exact @nospaces.xyz address they wrote to (it's on our verified domain).
  const replyFrom = ((OriginalRecipient ?? ToFull?.[0]?.Email ?? 'inbox@nospaces.xyz') as string).trim()

  // Strip non-latin chars that break ByteString conversion
  // eslint-disable-next-line no-control-regex -- intentionally strips non-Latin/control chars
  const sanitize = (s: string) => (s ?? '').replace(/[^\x00-\xFF]/g, ' ')

  // Verify sender is an allowed user
  const fromEmail = sanitize((From ?? '').match(/<(.+)>/)?.[1] ?? From)
  const subject = sanitize(Subject ?? '')
  console.log('[email] from:', fromEmail, 'subject:', subject)
  if (!ALLOWED_EMAILS.some(e => fromEmail.toLowerCase().includes(e.toLowerCase()))) {
    // Return 200 (not 403) so Postmark treats it as handled and doesn't retry the
    // webhook 40+ times. Postmark's own notification emails hit this address too.
    console.log('[email] ignoring unauthorized sender:', fromEmail)
    return res.status(200).json({ ignored: true, reason: 'Unauthorized sender' })
  }

  // Sanitize body — strip non-latin characters that break ByteString conversion
  const body = sanitize(TextBody ?? HtmlBody?.replace(/<[^>]+>/g, ' ') ?? '')
  // Short body excerpt stored on a failed-capture log row so the feed can show
  // "what did I send" without keeping the whole email.
  const snippet = body.slice(0, 400).trim() || null

  // A quick-capture Shortcut (iOS "Send Email") often puts the link in the
  // SUBJECT and leaves the body empty, so scan subject + body together for links.
  // Subject is already sanitized above; URLs are SSRF-filtered + capped downstream.
  const linkText = subject ? `${subject}\n${body}` : body

  // Resolve the sender's account up front — both so a failed capture can be logged
  // against the right user, and so an allowlisted-but-unmatched sender fails BEFORE
  // any paid Anthropic call rather than after it.
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
  console.log('[email] users error:', usersError, 'count:', users?.users?.length)
  const matchedUser = users?.users?.find(u =>
    ALLOWED_EMAILS.some(e => u.email?.toLowerCase() === e.toLowerCase() &&
      fromEmail.toLowerCase().includes(e.toLowerCase()))
  )
  console.log('[email] matched user:', matchedUser?.email ?? 'none')
  if (!matchedUser) {
    await logCapture({ userId: null, fromEmail, subject, outcome: 'error', detail: 'account not found', snippet })
    await sendReply(fromEmail, replyFrom, 'Nospaces: couldn\'t save',
      `I got your email but couldn't match it to your account, so nothing was saved. (Tech note: user not found.)`)
    return res.status(200).json({ saved: 0, error: 'User not found' })
  }

  // ---- Things domain: forward a product link → save it to your board ----
  // Routed by the recipient address (things@ / shop@ / want@). Free — uses the
  // shared scraper, no Anthropic call. Lenient (any readable link), since the
  // address signals clear intent. Returns before the paid media pipeline.
  if (isThingsAddress(replyFrom)) {
    const r = await captureThing(matchedUser.id, extractEmailUrls(linkText, HtmlBody ?? ''), false)
    if (r.kind === 'saved') {
      await sendReply(fromEmail, replyFrom, 'Nospaces: saved to your board',
        `Added to your board:\n\n• ${r.title}${r.price ? ` — ${r.price}` : ''}\n\n${tagNote(r.tagCount)}`)
      return res.status(200).json({ saved: 1, domain: 'thing' })
    }
    if (r.kind === 'duplicate') {
      await logCapture({ userId: matchedUser.id, fromEmail, subject, outcome: 'duplicates', detail: 'thing already on board', snippet })
      await sendReply(fromEmail, replyFrom, 'Nospaces: already on your board', `"${r.title}" is already on your board — nothing new to add.`)
      return res.status(200).json({ saved: 0 })
    }
    const detail = r.kind === 'no-link' ? 'no link in things email' : r.kind === 'error' ? r.message : 'could not read product link'
    await logCapture({ userId: matchedUser.id, fromEmail, subject, outcome: r.kind === 'error' ? 'error' : 'nothing_found', detail, snippet })
    await sendReply(fromEmail, replyFrom, 'Nospaces: couldn\'t add that',
      r.kind === 'no-link'
        ? `I didn't find a product link in that email. Forward one with the shop link in it and I'll add it to your board.`
        : `I found a link but the shop blocks me from reading it. Easiest fix: open the page, screenshot it, and email the screenshot here — I'll read the product right off the picture.`)
    return res.status(200).json({ saved: 0, error: r.kind })
  }

  // For the universal "save@" address, a LINK is the capture — try it first. Shop
  // emails (and iOS Mail's rich-link expansion) arrive stuffed with decorative
  // product thumbnails, swatches and tracking pixels, but those are INLINE images
  // (filtered out below by ContentID), so the link still wins over them. The link
  // wins outright ONLY if it yields a product; if the shop 403s the scraper, we fall
  // through and a deliberately-attached screenshot gets its turn (the rescue path).
  const universal = isCaptureAll(replyFrom)
  const links = extractEmailUrls(linkText, HtmlBody ?? '')
  const linkCapture = universal && links.length > 0

  // Universal save@ fast path: a CLEAR product link (strict productLike) saves
  // straight to the board with no AI cost. A media link (a film/book page isn't
  // productLike) falls through to the media reader; the non-strict fallback at the
  // end still catches anything readable for save@.
  if (linkCapture) {
    const t = await captureThing(matchedUser.id, links, true)
    if (t.kind === 'saved') {
      await sendReply(fromEmail, replyFrom, 'Nospaces: saved to your board',
        `Added to your board:\n\n• ${t.title}${t.price ? ` — ${t.price}` : ''}\n\n${tagNote(t.tagCount)}`)
      return res.status(200).json({ saved: 1, domain: 'thing' })
    }
    if (t.kind === 'duplicate') {
      await logCapture({ userId: matchedUser.id, fromEmail, subject, outcome: 'duplicates', detail: 'thing already on board', snippet })
      await sendReply(fromEmail, replyFrom, 'Nospaces: already on your board', `"${t.title}" is already on your board — nothing new to add.`)
      return res.status(200).json({ saved: 0 })
    }
    // not a clear product (or unreadable) → fall through to the media reader
  }

  // Read any deliberately-attached images. NON-INLINE only (inline = shop decoration,
  // see isInlineImage): a photo or screenshot a human chose to attach. Each gets ONE
  // vision read (classifyEmailImage) that decides product-vs-media and pulls fields —
  // so a screenshot of a bot-walled shop lands on the board, and a poster photo lands
  // in the library, from the same gesture. This runs even when a link is present (the
  // link's first crack already happened above) so a screenshot survives a 403'd link.
  // Each image is normalized first (HEIC→JPEG) so iPhone photos work.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageResults: any[] = []
  // Products read off screenshots, saved to the board as we go (reported in the reply).
  const screenshotThings: { title: string; price: string | null; tagCount: number }[] = []
  // Non-inline, real-photo-sized images only (see MIN_DELIBERATE_IMAGE_BYTES): this
  // already drops swatches, thumbnails and tracking pixels.
  const candidateImages: Attachment[] = (Attachments ?? []).filter((a: Attachment) =>
    imageType(a).startsWith('image/') && !isInlineImage(a) && attachmentBytes(a) >= MIN_DELIBERATE_IMAGE_BYTES
  )
  // A pile of big images is a forwarded newsletter's hero shots, not a human attaching
  // photos — skip the whole image→item path so decoration can't become junk board
  // cards (and so we don't burn a vision call per image). The link/media readers below
  // still run, so a genuine forward with a product link is unaffected.
  const tooManyImages = candidateImages.length > MAX_DELIBERATE_IMAGES
  const imageAttachments: Attachment[] = tooManyImages ? [] : candidateImages
  if (tooManyImages) console.log('[email] skipping', candidateImages.length,
    'image attachments — looks like newsletter decoration, not deliberate photos')
  console.log('[email] deliberate image attachments:', imageAttachments.length,
    JSON.stringify(imageAttachments.map(a => ({ type: a.ContentType, name: a.Name, bytes: attachmentBytes(a) }))))

  for (const att of imageAttachments) {
    try {
      const prepped = await prepImage(att)
      if (!prepped) { console.log('[email] image skipped (unusable):', att.ContentType, att.Name); continue }
      const c = await classifyEmailImage(prepped)
      if (!c) { console.log('[email] image had nothing identifiable'); continue }
      if (c.kind === 'product') {
        const s = await saveScreenshotProduct(matchedUser.id, c)
        if (s.kind === 'saved') {
          screenshotThings.push({ title: s.title, price: s.price, tagCount: s.tagCount })
          console.log('[email] screenshot → board:', s.title, '· conf:', c.confidence)
        } else console.error('[email] screenshot product save failed:', s.message)
      } else {
        // Media from a screenshot — single deliberate capture, so it lands live unless
        // the read itself was shaky (low confidence → review). `blurb` shows on the card.
        imageResults.push({ title: c.title, creator: c.creator, type: c.type, year: c.year,
          blurb: c.blurb, tags: c.tags, confidence: c.confidence })
        console.log('[email] screenshot → library:', c.title, '· conf:', c.confidence)
      }
    } catch (err) {
      // A single bad image (e.g. HEIC decode failure) must never sink the whole
      // email — log it and move on so the rest of the capture still runs.
      console.error('[email] image processing failed:', err instanceof Error ? err.message : err)
    }
  }

  // Fetch any URLs found in the email body so bare-link emails (e.g. a forwarded
  // Letterboxd review URL) produce useful metadata for the Claude extraction step.
  const urls = extractUrls(linkText)
  const urlMetas = (await Promise.all(urls.map(fetchPageMeta))).filter(Boolean)
  const urlContext = urlMetas.length > 0 ? urlMetas.join('\n\n') : undefined
  if (urlContext) console.log('[email] url context fetched for', urls.length, 'url(s)')

  // Parse email body for recommendations. Big notes can list dozens of items, so allow
  // a large output and parse defensively (never 500 on a malformed/truncated reply).
  let parsed: ReturnType<typeof safeParse>
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8192,
      messages: [{ role: 'user', content: EMAIL_PROMPT(subject, body, urlContext) }],
    })
    const txt = message.content[0].type === 'text' ? message.content[0].text : ''
    parsed = safeParse(txt)
  } catch (err) {
    console.error('[email] anthropic error:', err instanceof Error ? err.message : err)
    await logCapture({ userId: matchedUser.id, fromEmail, subject, outcome: 'error',
      detail: err instanceof Error ? err.message : 'ai read error', snippet })
    await sendReply(fromEmail, replyFrom, 'Nospaces: couldn\'t save',
      `I got your email but hit an error reading it — nothing was saved. Please try forwarding it again.`)
    // Return 200 so Postmark doesn't retry the webhook
    return res.status(200).json({ saved: 0, error: 'anthropic_error' })
  }

  const allItems = [
    ...imageResults,
    ...(parsed.items ?? []),
  ].filter((i: { title?: string }) => i?.title)

  console.log('[email] items found:', allItems.length, JSON.stringify(allItems.map((i: {title: string}) => i.title)))

  if (allItems.length === 0) {
    // A screenshot already landed on the board — report that and stop (the photo WAS
    // the capture, so don't fall through to "nothing saved").
    if (screenshotThings.length > 0) {
      const list = screenshotThings.map(s => `• ${s.title}${s.price ? ` — ${s.price}` : ''}`).join('\n')
      await sendReply(fromEmail, replyFrom, 'Nospaces: saved to your board',
        `${screenshotThings.length > 1 ? 'Read those off your screenshots' : 'Read that off your screenshot'} and added to your board:\n\n${list}\n\n${tagNote(screenshotThings.reduce((n, s) => n + s.tagCount, 0))}`)
      return res.status(200).json({ saved: screenshotThings.length, domain: 'thing' })
    }
    // Only count NON-product photos toward "couldn't read a photo" — a screenshot we
    // routed to the board isn't a failed read.
    const hadPhotos = imageAttachments.length > 0
    // No media found — but if there's a clear *shop* link, this was probably a
    // product, not a newsletter. Save it to the board so the regular inbox "just
    // works" for things too. Strict (productLike only) so an article doesn't slip in.
    if (!hadPhotos) {
      // save@ is high-intent (you deliberately sent it here), so its fallback is
      // lenient — any readable link lands. The regular media inbox stays strict so
      // a forwarded newsletter's links don't turn into board cards.
      const fallbackLinks = extractEmailUrls(linkText, HtmlBody ?? '')
      const t = await captureThing(matchedUser.id, fallbackLinks, !universal)
      if (t.kind === 'saved') {
        await sendReply(fromEmail, replyFrom, 'Nospaces: saved to your board',
          `That looked like a product, so I added it to your board:\n\n• ${t.title}${t.price ? ` — ${t.price}` : ''}\n\n${tagNote(t.tagCount)}`)
        return res.status(200).json({ saved: 1, domain: 'thing' })
      }
      if (t.kind === 'duplicate') {
        await sendReply(fromEmail, replyFrom, 'Nospaces: already on your board', `"${t.title}" is already on your board — nothing new to add.`)
        return res.status(200).json({ saved: 0 })
      }
      // Scrape struck out, but a save@ link is a deliberate "save this" — the shop
      // probably just 403'd us (Farfetch, Net-a-Porter…). Read the product from the
      // email body itself + tag from an in-email image, so a bot-walled shop lands.
      if (universal && fallbackLinks.length > 0) {
        const r = await rescueProductFromEmail(matchedUser.id, body, HtmlBody ?? '', fallbackLinks[0])
        if (r?.kind === 'saved') {
          await sendReply(fromEmail, replyFrom, 'Nospaces: saved to your board',
            `That shop blocks link-reading, so I pulled it from your email instead:\n\n• ${r.title}${r.price ? ` — ${r.price}` : ''}\n\n${tagNote(r.tagCount)}`)
          return res.status(200).json({ saved: 1, domain: 'thing' })
        }
        if (r?.kind === 'duplicate') {
          await sendReply(fromEmail, replyFrom, 'Nospaces: already on your board', `That item is already on your board — nothing new to add.`)
          return res.status(200).json({ saved: 0 })
        }
        // r null (not a product) / error → fall through to the nothing_found log.
      }
    }
    await logCapture({ userId: matchedUser.id, fromEmail, subject, outcome: 'nothing_found',
      detail: hadPhotos ? 'no media read from photo(s)' : 'no media found in text', snippet })
    // A save@ email that carried a link we couldn't turn into anything was most
    // likely a bot-walled shop — point at the screenshot rescue, the one fix that
    // always works (we read the product right off the picture).
    const hadFailedLink = universal && links.length > 0
    await sendReply(fromEmail, replyFrom, 'Nospaces: nothing saved',
      hadPhotos
        ? `I got your email but couldn't read any film/book/music/TV from the photo${imageAttachments.length > 1 ? 's' : ''} attached. Clear screenshots, posters, or covers work best — try sending it again.`
        : hadFailedLink
        ? `That link points somewhere I can't read — a lot of shops block me. Easiest fix: open the page, screenshot it, and email the screenshot here. I'll read the product straight off the picture.`
        : `I went through "${subject}" but didn't spot any films, books, music, or TV to save. If something's there, forward it again with the title in the note.`)
    return res.status(200).json({ saved: 0 })
  }

  // Determine which items to save
  console.log('[email] instruction:', parsed.instruction, 'specified:', parsed.specified_items)
  let itemsToSave = allItems
  if (parsed.instruction === 'specific' && parsed.specified_items?.length > 0) {
    const specs = parsed.specified_items
    if (typeof specs[0] === 'number') {
      // Claude returned indices like [1, 2]
      itemsToSave = specs.map((i: number) => allItems[i - 1]).filter(Boolean)
    } else {
      // Claude returned titles like ["Basic Instinct"] — match by title
      itemsToSave = allItems.filter((item: { title: string }) =>
        specs.some((s: string) => item.title?.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(item.title?.toLowerCase()))
      )
    }
  }
  console.log('[email] itemsToSave:', itemsToSave.length, JSON.stringify(itemsToSave))

  // Review is for the MACHINE's uncertainty, not yours. A bulk extraction (a
  // newsletter listing several items) or a shaky single read (low confidence) lands
  // in the "for review" inbox to triage. A single confident capture — one forwarded
  // article, one screenshot we read cleanly — lands live, because saving is the
  // signal and a deliberate save shouldn't be taxed with a gate.
  const bulk = itemsToSave.length > 1
  // Save items. The model's per-item `summary` (e.g. the newsletter's blurb on that album)
  // is stored as a recommendation-style blurb attributed to the newsletter, so the action
  // card shows it under a "via [newsletter]" toggle — same as recommendation-list items.
  const rows = itemsToSave.map((item: {
    title: string
    creator?: string
    type?: string
    year?: number
    summary?: string
    blurb?: string
    confidence?: string
    metadata?: Record<string, unknown>
    tags?: string[]
  }) => ({
    user_id: matchedUser.id,
    title: item.title,
    creator: item.creator ?? null,
    type: item.type ?? 'other',
    year: item.year ?? null,
    status: 'want_to',
    source: 'email',
    source_detail: parsed.newsletter_name ?? null,
    recommended_by: parsed.newsletter_name ?? null,
    metadata: {
      ...(item.metadata ?? {}),
      // Flag for review only on the machine's own uncertainty — bulk batches, or a
      // low-confidence read. Confident single captures skip the inbox and land live.
      review: bulk || item.confidence === 'low',
      ...(item.summary?.trim() ? { recommendationBlurb: item.summary.trim() } : {}),
      // Visible blurb text read off an emailed screenshot/photo — stored like the
      // in-app photo path so the action card shows it (beats the Wikipedia fallback).
      ...(item.blurb?.trim() ? { capturedBlurb: item.blurb.trim() } : {}),
    },
    tags: item.tags ?? [],
  }))

  // Dedup against the existing library (and within this batch) so re-forwarding
  // an email to recover a missed item doesn't create duplicates of the ones that
  // already came through. Key = type + accent-folded title + creator.
  const norm = (s: string) =>
    (s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const keyOf = (title: string, creator: string | null, type: string) =>
    `${type}|${norm(title)}|${norm(creator ?? '')}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('items').select('title, creator, type').eq('user_id', matchedUser.id)
  const existingKeys = new Set<string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((existing ?? []) as any[]).map(e => keyOf(e.title, e.creator, e.type)),
  )
  const seen = new Set<string>()
  const dedupedRows = rows.filter(r => {
    const k = keyOf(r.title, r.creator, r.type)
    if (existingKeys.has(k) || seen.has(k)) return false
    seen.add(k)
    return true
  })
  const skipped = rows.length - dedupedRows.length
  console.log('[email] dedup: saving', dedupedRows.length, 'skipped (already in library):', skipped)

  // A note appended to the reply when screenshots ALSO landed products on the board
  // in the same email (so a mixed forward reports both halves).
  const boardNote = screenshotThings.length > 0
    ? `\n\nAlso added to your board:\n${screenshotThings.map(s => `• ${s.title}${s.price ? ` — ${s.price}` : ''}`).join('\n')}`
    : ''

  if (dedupedRows.length === 0) {
    await logCapture({ userId: matchedUser.id, fromEmail, subject, outcome: 'duplicates',
      detail: `${rows.length} item${rows.length > 1 ? 's' : ''} already in library`, snippet })
    await sendReply(fromEmail, replyFrom, 'Nospaces: nothing new to save',
      `I found ${rows.length} item${rows.length > 1 ? 's' : ''} in "${subject}", but ${rows.length > 1 ? "they're" : "it's"} already in your library — nothing new to add.${boardNote}`)
    return res.status(200).json({ saved: screenshotThings.length, skipped })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any).from('items').insert(dedupedRows)
  console.log('[email] insert error:', insertError, 'rows:', dedupedRows.length)

  // Talk back with the result so failures are never silent.
  if (insertError) {
    await logCapture({ userId: matchedUser.id, fromEmail, subject, outcome: 'error',
      detail: insertError.message, snippet })
    await sendReply(fromEmail, replyFrom, 'Nospaces: couldn\'t save',
      `I found ${rows.length} item${rows.length > 1 ? 's' : ''} but hit an error saving them — nothing was added. (Tech note: ${insertError.message})`)
  } else {
    // Copy follows where things actually landed: confident captures go live to the
    // library; only the ones flagged for review mention the inbox.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviewN = dedupedRows.filter(r => (r.metadata as any).review).length
    const list = dedupedRows.map(r => `• ${r.title}${r.year ? ` (${r.year})` : ''}`).join('\n')
    const skippedNote = skipped > 0 ? `\n\n(${skipped} already in your library, skipped.)` : ''
    const where = reviewN === dedupedRows.length ? 'Added to your review inbox'
      : reviewN === 0 ? 'Saved to your library'
      : `Saved to your library (${reviewN} flagged for review)`
    await sendReply(fromEmail, replyFrom, `Nospaces: saved ${dedupedRows.length}`,
      `${where}:\n\n${list}${skippedNote}${boardNote}`)
  }

  return res.status(200).json({ saved: insertError ? 0 : dedupedRows.length + screenshotThings.length, skipped, error: insertError?.message })
}
