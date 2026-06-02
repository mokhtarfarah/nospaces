import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ALLOWED_EMAILS = [
  'farahmokhtar94@gmail.com',
  'tom.effland@gmail.com',
]

const EMAIL_PROMPT = (subject: string, body: string) => `
Parse this email and extract any media recommendations (films, books, music, TV shows).
Subject: ${subject}

Body:
${body.slice(0, 4000)}

Return JSON only:
{
  "instruction": "all | specific | none",
  "specified_items": [],
  "newsletter_name": "name of newsletter or sender if detectable, else null",
  "items": [
    {
      "title": "...",
      "creator": "...",
      "type": "film|book|music|tv|other",
      "year": null,
      "summary": "One sentence about why this was recommended",
      "confidence": "high|medium|low",
      "metadata": {},
      "tags": []
    }
  ]
}
`

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

  // Check for image attachments
  let imageResult = null
  if (Attachments?.length > 0) {
    const imgAttachment = Attachments.find((a: { ContentType: string }) =>
      a.ContentType?.startsWith('image/')
    )
    if (imgAttachment) {
      try {
        const imgRes = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: imgAttachment.ContentType, data: imgAttachment.Content },
              },
              { type: 'text', text: 'Identify any film, book, music, or TV recommendation in this image. Return JSON: {"title":"...","creator":"...","type":"...","year":null,"confidence":"high|medium|low","metadata":{},"tags":[]}' },
            ],
          }],
        })
        const txt = imgRes.content[0].type === 'text' ? imgRes.content[0].text : ''
        imageResult = JSON.parse(txt.replace(/```json\n?|\n?```/g, '').trim())
      } catch { /* ignore failed image parse */ }
    }
  }

  // Parse email body for recommendations
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: EMAIL_PROMPT(subject, body) }],
  })

  const txt = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = JSON.parse(txt.replace(/```json\n?|\n?```/g, '').trim())

  const allItems = [
    ...(imageResult ? [imageResult] : []),
    ...(parsed.items ?? []),
  ]

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
  let itemsToSave = allItems
  if (parsed.instruction === 'specific' && parsed.specified_items?.length > 0) {
    itemsToSave = parsed.specified_items.map((i: number) => allItems[i - 1]).filter(Boolean)
  }

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

  await supabase.from('items').insert(rows)

  return res.status(200).json({ saved: rows.length })
}
