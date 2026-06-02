import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
// heic-convert ships no types; esbuild bundles it for the Vercel function regardless.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import heicConvert from 'heic-convert'

// Strip any non-ASCII chars that may have crept in via copy-paste
const cleanEnv = (s: string | undefined) => (s ?? '').replace(/[^\x20-\x7E]/g, '').trim()

const anthropic = new Anthropic({ apiKey: cleanEnv(process.env.ANTHROPIC_API_KEY) })
const supabase = createClient(
  cleanEnv(process.env.SUPABASE_URL),
  cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY),
)

const ALLOWED_EMAILS = [
  'farahmokhtar94@gmail.com',
  'tom.effland@gmail.com',
]

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

const EMAIL_PROMPT = (subject: string, body: string) => `
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
      "summary": "One sentence about why this was recommended",
      "confidence": "high|medium|low",
      "metadata": {},
      "tags": []
    }
  ]
}
`

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // Postmark sends inbound emails as JSON
  const { From, Subject, TextBody, HtmlBody, Attachments } = req.body

  // Strip non-latin chars that break ByteString conversion
  const sanitize = (s: string) => (s ?? '').replace(/[^\x00-\xFF]/g, ' ')

  // Verify sender is an allowed user
  const fromEmail = sanitize((From ?? '').match(/<(.+)>/)?.[1] ?? From)
  const subject = sanitize(Subject ?? '')
  console.log('[email] from:', fromEmail, 'subject:', subject)
  if (!ALLOWED_EMAILS.some(e => fromEmail.toLowerCase().includes(e.toLowerCase()))) {
    console.log('[email] unauthorized sender:', fromEmail)
    return res.status(403).json({ error: 'Unauthorized sender' })
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
            { type: 'text', text: 'Identify the film, book, music album, or TV show shown in this image (e.g. a screenshot, poster, or cover). Use your own knowledge to give the exact canonical title, creator (director/author/artist/showrunner), and release year. Return JSON only: {"title":"...","creator":"...","type":"film|book|music|tv|other","year":1234,"confidence":"high|medium|low","metadata":{},"tags":[]}. If no media is identifiable, return {"title":null}.' },
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

  // Parse email body for recommendations. Big notes can list dozens of items, so allow
  // a large output and parse defensively (never 500 on a malformed/truncated reply).
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8192,
    messages: [{ role: 'user', content: EMAIL_PROMPT(subject, body) }],
  })

  const txt = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = safeParse(txt)

  const allItems = [
    ...imageResults,
    ...(parsed.items ?? []),
  ].filter((i: { title?: string }) => i?.title)

  console.log('[email] items found:', allItems.length, JSON.stringify(allItems.map((i: {title: string}) => i.title)))

  if (allItems.length === 0) {
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

  if (!matchedUser) return res.status(200).json({ saved: 0, error: 'User not found' })

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

  // Save items
  const rows = itemsToSave.map((item: {
    title: string
    creator?: string
    type?: string
    year?: number
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
    metadata: item.metadata ?? {},
    tags: item.tags ?? [],
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any).from('items').insert(rows)
  console.log('[email] insert error:', insertError, 'rows:', rows.length)

  return res.status(200).json({ saved: insertError ? 0 : rows.length, error: insertError?.message })
}
