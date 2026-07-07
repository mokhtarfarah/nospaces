import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'
import { HUMANIZER_GUARDRAILS, VOICE } from './_humanizer.js'
import { sanitizeProfile, profilePromptBlock } from './_profile.js'
import { fetchImageBase64 } from './_vision.js'

// The per-item "how this fits your taste" read: a short, two-part take on a single
// saved thing — how it sits with the rest of the board (aesthetic) AND, when the
// user's style profile bears on it, how it'll actually fit and flatter *them*
// (body/silhouette), the way the compare read does. The item-level sibling of the
// board's keyword thread. Reads the already-extracted taste tags + the saved photo
// (vision, so it can judge the real cut), so it's still cheap (Haiku, ~2–4¢ a call).
// Never auto-runs: the client calls it on an explicit tap and caches the line on
// metadata.tasteFit, so a given product costs a few cents once.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Fetching the photo then a vision call runs a touch longer than the old text-only
// read; give it headroom over Vercel's default.
export const config = { maxDuration: 30 }

type InAttr = { facet?: string; value?: string }
// Board context: the recurring keyword thread + the top recurring values per facet,
// each as [value, itemCount]. Lets the model place the item on the board precisely.
type InBoard = { thread?: string[]; facets?: Record<string, [string, number][]> }

const FACET_LABEL: Record<string, string> = {
  material: 'material', palette: 'palette', vibe: 'vibe', category: 'category', priceTier: 'price',
}

// The prompt, factored out of the handler so it has exactly one home (and can be
// exercised in a test without standing up auth/rate-limit). Takes the already-prepped
// board + item strings; `profileBlock` is profilePromptBlock(profile) (or '') and
// `hasPhoto` says whether a photo is attached below the prompt.
export function buildFitPrompt(a: {
  thread: string[]; boardLines: string; title?: string; brand?: string | null; price?: string | null
  itemLine: string; profileBlock: string; hasPhoto: boolean
}): string {
  return `Someone keeps a personal "taste board" — things they've saved across clothes, bags, shoes, objects. The board has a recurring aesthetic; here's the gist:
${a.thread.length ? `\nIn a phrase, it reads as: ${a.thread.join(' · ')}.\n` : ''}
Recurring threads:
${a.boardLines || '(nothing strongly recurring yet)'}

They just saved:
- ${a.title ? a.title : 'an item'}${a.brand ? ` — ${a.brand}` : ''}${a.price ? ` (${a.price})` : ''}
- reads as: ${a.itemLine}
${a.profileBlock}${a.hasPhoto ? "\nTheir saved photo of it is attached below — actually look at it: judge the real silhouette, cut, proportion and how it would sit on the body, not a guess. You canNOT feel the fabric or know the true in-person fit, so frame those as risks to check, not facts.\n" : ''}
You're their stylist reading this one saved piece: warm, sharp, on their side, with zero stake in the sale. Write a TIGHT read — EXACTLY 2 sentences, 40 words MAX, second person ("you"/"your"), no trailing period, no hype. Sentence 1: how it sits with your board, AESTHETICALLY — the *feeling* (palette, mood, silhouette, relaxed/dressy, soft/sharp); is it squarely your aesthetic, or a genuine shift? Sentence 2: how it might actually FIT and FLATTER *you* — but ONLY where your body notes bear on this kind of item. MAKE A CALL: give your best-guess read of how it'll actually sit ("likely drops past your waist", "should hit right at the hip", "the cropped length probably reads short on your torso") — then, only if it matters, what would change it ("size down to bring it up"). NEVER just name the variable without answering it — "the key is whether it hits your waist or skims past" is a dodge, not a read; you're the stylist, so commit to a most-likely call. HEDGE the CERTAINTY, not the call — you're reading a photo, not seeing it on her, so "likely", "probably", "should", "might" — a confident best guess to check, never a flat verdict. Confident on the aesthetic, tentative on the body. Do NOT close with "try it on to confirm ___" — that exact formula is BANNED (it's on every read and reads as a tic); if there's real uncertainty fold it into the call itself, and if you're confident just say it and stop. If nothing about the body applies (a bag, jewellery, an object), skip fit entirely AND SILENTLY — make sentence 2 a second aesthetic beat, and NEVER invent a fit note NOR narrate its absence (no "as a bag, no body considerations", no "without any fit to weigh"). Just write two aesthetic beats, as if fit was never on the table.

Length/shape to match (NEVER reuse these words, and NEVER copy this opening): "Quiet, structured, earthy — dead centre of your board. That high rise should sit right at your natural waist, though the cropped leg likely reads short unless you size up." Note it makes a call and folds the caveat in — no "try it on to confirm" tail. That's the ceiling: two sentences, ~25 words. A third sentence is a failure.

Rules that matter here:
- VARY THE OPENING every single time. Do NOT start reads with the same words — and NEVER default to "Squarely your board" or any fixed opener. Sometimes lead with the feeling, sometimes the one adjective that nails it, sometimes the verdict. The first few words should feel written for THIS piece, not stamped from a template.
- LEAD WITH YOUR READ. Do NOT open by describing the item back — its colour, material or cut is already in front of them. First words are your verdict, not "earth-toned wool in a clean cut".
- On the aesthetic side, go by aesthetic, NOT category. The board mixes clothes, bags and objects, so a recurring material (e.g. leather) usually comes from accessories — never treat it as a wardrobe staple, and never frame a different category as a departure ("a bag, unlike your coats"). Bag-vs-trousers is not a taste observation.
- Don't force a contrast. If it simply IS your aesthetic, say so with warmth and confidence — that's a truer read than inventing a difference. Only name a tension when it's a genuine aesthetic shift.
- SENTENCE 1 MUST NOT RESTATE THE TAGS. The taste tags are already displayed right above this read (e.g. \`cotton · bold · oversized\`). If your first sentence is just those words in prose ("bold cotton in an oversized cut"), you've said nothing new — go past them to the *feeling* or the why.
- NAME THIS EXACT PIECE. Point at one concrete feature of the actual garment — the drawstring waist, the corset seaming, the sheer open knit, the cropped hem — never generic silhouette-speak that would fit any item. These stock phrases are BANNED (the model overuses them): "swallow your frame/proportions", "reads intentional rather than shapeless", "structurally confident", and any "the balance feels balanced"-style tautology.
- Be specific and human, never a checklist of the tags read back. No hype, no "this piece".

${VOICE.warm}

${HUMANIZER_GUARDRAILS}

Return JSON only, no prose around it:
{ "fit": "the read" }`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userId = await getAuthUserId(req.headers['authorization'])
  if (!userId) return res.status(401).end()
  if (!await checkRateLimit(userId, 'things-taste-fit', 40)) return res.status(429).json({ error: 'That’s a lot of reads — try again next hour.' })

  const { title, brand, price, attributes, board, styleProfile, image, url } = req.body as {
    title?: string; brand?: string | null; price?: string | null; attributes?: InAttr[]; board?: InBoard; styleProfile?: string
    // The saved product photo (+ its page url for referer) — fetched server-side so
    // the model can judge the real cut/silhouette against the body notes, like compare.
    image?: string | null; url?: string | null
  }
  const profile = sanitizeProfile(styleProfile)
  const attrs = (Array.isArray(attributes) ? attributes : [])
    .filter(a => a && typeof a.value === 'string' && a.value.trim())
    .map(a => ({ facet: String(a.facet ?? ''), value: String(a.value).trim() }))
  if (!attrs.length) return res.status(400).json({ error: 'Need the item’s taste tags to read it.' })

  const thread = Array.isArray(board?.thread) ? board!.thread.filter(t => typeof t === 'string') : []
  const facets = (board?.facets ?? {}) as Record<string, [string, number][]>
  if (thread.length === 0 && Object.keys(facets).length === 0) {
    return res.status(400).json({ error: 'Not enough on the board yet to compare against.' })
  }

  // Category is "what it is" (bag, trousers), not the aesthetic — leave it out of
  // the read entirely, both for the board context and the item, so the line goes by
  // feeling, not inventory (Farah: insights should be aesthetic, not categorical).
  const HIDE = new Set(['category'])
  const boardLines = Object.entries(facets)
    .filter(([facet, vals]) => !HIDE.has(facet) && Array.isArray(vals) && vals.length)
    .map(([facet, vals]) => `- ${FACET_LABEL[facet] ?? facet}: ${vals.map(([v]) => v).join(', ')}`)
    .join('\n')

  const itemAttrsShown = attrs.filter(a => !HIDE.has(a.facet))
  const itemLine = (itemAttrsShown.length ? itemAttrsShown : attrs).map(a => `${FACET_LABEL[a.facet] ?? a.facet}: ${a.value}`).join(', ')

  // Best-effort: fetch the saved photo so the model can judge the real cut against
  // the body notes. A photo that won't load just drops that signal — the read still
  // runs on the taste tags alone.
  const photo = image ? await fetchImageBase64(image, url ?? undefined) : null

  const prompt = buildFitPrompt({
    thread, boardLines, title, brand, price, itemLine,
    profileBlock: profilePromptBlock(profile), hasPhoto: !!photo?.ok,
  })

  // Prompt text first, then the photo (when we could fetch it) so the model can read
  // the real cut.
  const content: Anthropic.ContentBlockParam[] = [{ type: 'text', text: prompt }]
  if (photo?.ok) content.push({ type: 'image', source: { type: 'base64', media_type: photo.media, data: photo.data } })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 160,
      messages: [{ role: 'user', content }],
    })
    const text = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? ''
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    const fit = typeof parsed.fit === 'string' ? parsed.fit.trim() : ''
    if (!fit) return res.status(500).json({ error: 'Could not read that right now.' })
    return res.status(200).json({ fit })
  } catch (err) {
    console.error('[things-taste-fit] error:', err instanceof Error ? err.message : err)
    return res.status(500).json({ error: 'Could not read that right now.' })
  }
}
