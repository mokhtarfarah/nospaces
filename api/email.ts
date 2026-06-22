import { timingSafeEqual } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { genreBlock } from './_genres.js'
import { isSafePublicUrl } from './_ssrf.js'

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

// Anthropic only accepts these image media types.
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

type Attachment = { ContentType?: string; Content?: string; Name?: string }

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

  // Identify media from any image attachments. Each image is normalized first (HEIC→JPEG,
  // media-type cleanup) so iPhone photos work. Errors are logged, never silently dropped.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageResults: any[] = []
  const imageAttachments: Attachment[] = (Attachments ?? []).filter((a: Attachment) =>
    imageType(a).startsWith('image/')
  )
  console.log('[email] image attachments:', imageAttachments.length,
    JSON.stringify(imageAttachments.map(a => ({ type: a.ContentType, name: a.Name }))))

  for (const att of imageAttachments) {
    try {
      const prepped = await prepImage(att)
      if (!prepped) { console.log('[email] image skipped (unusable):', att.ContentType, att.Name); continue }
      const imgRes = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: prepped.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: prepped.data } },
            { type: 'text', text: 'Identify the film, book, music album, or TV show shown in this image (e.g. a screenshot, poster, or cover). Use your own knowledge to give the exact canonical title, creator (director/author/artist/showrunner), and release year. If the image contains visible descriptive text about the item — a caption, a list annotation, back-cover copy, a review excerpt, a friend\'s note — capture it verbatim or closely paraphrased in "blurb"; otherwise null. Do not invent a description. Return JSON only: {"title":"...","creator":"...","type":"film|book|music|tv|other","year":1234,"confidence":"high|medium|low","blurb":null,"metadata":{},"tags":[]}. If no media is identifiable, return {"title":null}.' },
          ],
        }],
      })
      const txt = imgRes.content[0].type === 'text' ? imgRes.content[0].text : ''
      const result = JSON.parse(txt.replace(/```json\n?|\n?```/g, '').trim())
      if (result?.title) imageResults.push(result)
      else console.log('[email] image had no identifiable media')
    } catch (err) {
      console.error('[email] image identify failed:', err instanceof Error ? err.message : err)
    }
  }

  // Fetch any URLs found in the email body so bare-link emails (e.g. a forwarded
  // Letterboxd review URL) produce useful metadata for the Claude extraction step.
  const urls = extractUrls(body)
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
    const hadPhotos = imageAttachments.length > 0
    await sendReply(fromEmail, replyFrom, 'Nospaces: nothing saved',
      hadPhotos
        ? `I got your email but couldn't read any film/book/music/TV from the photo${imageAttachments.length > 1 ? 's' : ''} attached. Clear screenshots, posters, or covers work best — try sending it again.`
        : `I went through "${subject}" but didn't spot any films, books, music, or TV to save. If something's there, forward it again with the title in the note.`)
    return res.status(200).json({ saved: 0 })
  }

  // Get user_id for the sender
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
  console.log('[email] users error:', usersError, 'count:', users?.users?.length)
  const matchedUser = users?.users?.find(u =>
    ALLOWED_EMAILS.some(e => u.email?.toLowerCase() === e.toLowerCase() &&
      fromEmail.toLowerCase().includes(e.toLowerCase()))
  )
  console.log('[email] matched user:', matchedUser?.email ?? 'none')

  if (!matchedUser) {
    await sendReply(fromEmail, replyFrom, 'Nospaces: couldn\'t save',
      `I found ${allItems.length} item${allItems.length > 1 ? 's' : ''} but couldn't match your account, so nothing was saved. (Tech note: user not found.)`)
    return res.status(200).json({ saved: 0, error: 'User not found' })
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
      // Forwarded items land in the "for review" inbox to triage in-app, rather
      // than dropping silently into the library.
      review: true,
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

  if (dedupedRows.length === 0) {
    await sendReply(fromEmail, replyFrom, 'Nospaces: nothing new to save',
      `I found ${rows.length} item${rows.length > 1 ? 's' : ''} in "${subject}", but ${rows.length > 1 ? "they're" : "it's"} already in your library — nothing new to add.`)
    return res.status(200).json({ saved: 0, skipped })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any).from('items').insert(dedupedRows)
  console.log('[email] insert error:', insertError, 'rows:', dedupedRows.length)

  // Talk back with the result so failures are never silent.
  if (insertError) {
    await sendReply(fromEmail, replyFrom, 'Nospaces: couldn\'t save',
      `I found ${rows.length} item${rows.length > 1 ? 's' : ''} but hit an error saving them — nothing was added. (Tech note: ${insertError.message})`)
  } else {
    const list = dedupedRows.map(r => `• ${r.title}${r.year ? ` (${r.year})` : ''}`).join('\n')
    const skippedNote = skipped > 0 ? `\n\n(${skipped} already in your library, skipped.)` : ''
    await sendReply(fromEmail, replyFrom, `Nospaces: saved ${dedupedRows.length} for review`,
      `Added to your review inbox:\n\n${list}${skippedNote}`)
  }

  return res.status(200).json({ saved: insertError ? 0 : dedupedRows.length, skipped, error: insertError?.message })
}
