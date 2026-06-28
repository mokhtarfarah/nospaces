import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'
import { HUMANIZER_GUARDRAILS, VOICE } from './_humanizer.js'
import { scrapeProduct } from './_scrape.js'
import { sanitizeProfile, profilePromptBlock } from './_profile.js'

// Opt-in "compare these" for a plan-a-purchase: weighs the candidates a person is
// deliberating between and returns a short, honest take. Reads each option's own
// product page (description + any on-page rating) AND searches the web for what's
// actually said online (reviews, reputation, common complaints) for every option.
// Web search is capped (max_uses 10 — roughly one search per option, options are
// capped at 8) so a typical call stays ~$0.05–0.10. Never runs unless the user taps it.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Scraping product pages plus up to ~8 web searches in one model turn can run long;
// give generous headroom over the scraper's timeout.
export const config = { maxDuration: 60 }

// Tidy a model line for display: web search makes the model wrap cited phrases in
// `<cite index="…">…</cite>` markup, and it likes to prefix each note with the
// option's number/name/price (already shown on the card). Strip both so the note
// reads as a clean sentence. Pass the option's title to also drop a restated
// "Name (brand, $price): " identity prefix.
function cleanNote(s: unknown, title?: string | null): string {
  let t = String(s ?? '')
    .replace(/<\/?cite[^>]*>/gi, '')       // drop citation tags, keep the text inside
    .replace(/^\s*\d+[.)]\s*/, '')          // drop a leading "6. " / "6) " enumeration
    .trim()
  // If the model led with the item's identity (e.g. "Leather Clog (Common Projects,
  // $365): …"), cut up to that first colon — but only when the bit before it actually
  // names the item, so we never chop a real sentence that happens to have a colon.
  if (title && title.trim().length >= 4) {
    const colon = t.indexOf(': ')
    if (colon > 0 && colon < 120 && t.slice(0, colon).toLowerCase().includes(title.trim().toLowerCase().slice(0, 12))) {
      t = t.slice(colon + 2).trim()
    }
  }
  return t.replace(/\s{2,}/g, ' ').trim()
}

type InCandidate = {
  title?: string; brand?: string | null; price?: string | null; wasPrice?: string | null; url?: string | null
  // The user's own saved data — taste tags (look/feel) + why they saved it. Always
  // present even when a live scrape or web search comes up empty, so we can still
  // give a real take on a bot-walled or obscure shop instead of bailing.
  attributes?: { facet?: string; value?: string }[]
  note?: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userId = await getAuthUserId(req.headers['authorization'])
  if (!userId) return res.status(401).end()
  if (!await checkRateLimit(userId, 'things-compare', 30)) return res.status(429).json({ error: 'That’s a lot of comparing — try again next hour.' })

  const { intent, brief, candidates, styleProfile } = req.body as { intent?: string; brief?: string; candidates?: InCandidate[]; styleProfile?: string }
  if (!intent || !Array.isArray(candidates) || candidates.length < 2) {
    return res.status(400).json({ error: 'Need a goal and at least two options.' })
  }
  const context = typeof brief === 'string' ? brief.trim().slice(0, 600) : ''
  const profile = sanitizeProfile(styleProfile)
  // Cap to keep the payload (and cost) tiny.
  const list = candidates.slice(0, 8)

  // Read each option's own product page for context (description + on-page rating).
  // Free (no AI), SSRF-guarded inside scrapeProduct, run in parallel. Best-effort —
  // a page that won't load just leaves that option with names + price only.
  const details = await Promise.all(list.map(async (c) => {
    if (!c.url) return null
    const r = await scrapeProduct(c.url)
    return r.ok ? { description: r.fields.description ?? null, rating: r.fields.rating ?? null } : null
  }))
  let anyDetail = false

  const lines = list.map((c, i) => {
    const sale = c.wasPrice && c.price ? `${c.price} (was ${c.wasPrice}, on sale)` : (c.price ?? 'price unknown')
    const extra: string[] = []
    const d = details[i]
    if (d?.rating?.value) extra.push(`on-page rating ${d.rating.value}${d.rating.count ? ` (${d.rating.count} reviews)` : ''}`)
    if (d?.description) extra.push(`details: ${d.description}`)
    // The user's own saved data — survives even when the live scrape/search fail.
    const tags = Array.isArray(c.attributes) ? c.attributes.map(a => a?.value).filter((v): v is string => !!v && !!v.trim()) : []
    if (tags.length) extra.push(`look/feel (her saved tags): ${tags.join(', ')}`)
    if (c.note && c.note.trim()) extra.push(`why she saved it: ${c.note.trim()}`)
    if (extra.length) anyDetail = true
    const extraStr = extra.length ? `\n   ${extra.join('\n   ')}` : ''
    return `${i + 1}. ${c.title ?? 'Untitled'}${c.brand ? ` — ${c.brand}` : ''} — ${sale}${extraStr}`
  }).join('\n')

  const prompt = `Someone is choosing between options they're weighing for: "${intent}".
${context ? `\nWhat matters to them: ${context}\n` : ''}${profilePromptBlock(profile)}
Options${anyDetail ? ' (with details and any rating pulled from each product page)' : ''}:
${lines}

Use web search to find what's actually said online about each option — real reviews, reputation, common praise and complaints, how the brand holds up. Search for every option. Lean on the product page's own rating only as a starting point — a store rating its own product is not independent. Online reviews are a BONUS, not a requirement: many real options (small labels, bot-walled luxury sites, sold-out pieces) have little or nothing findable online, and that is normal — it is NOT a reason to withhold a verdict.

You ALWAYS have enough to give a useful take, because you have what they saved: each option's name, brand, price, their own look/feel tags, and what they said matters. Never refuse to compare or tell them to go re-check the product themselves just because a page wouldn't load or reviews weren't findable — that's a non-answer. If you couldn't verify an option online, say so in one short clause and then still judge it on the look/feel, price, brand, and fit.

For each option, write ONE short, honest line on what stands out — lead with FIT and FEEL (how the silhouette, neckline, colour, sleeve etc. serve what they're after${profile ? ' and their body type/aesthetic' : ''}), then value/price and whether the sale is real${anyDetail ? ', what the product details suggest about quality' : ''}, and what people online report IF you found anything. Then a brief verdict: which you'd lean toward and why, in 1–2 sentences${context ? ', weighing what matters to them' : ''}. Don't invent specifics (a rating, a review quote) you don't have — but DO commit to a lean based on fit + value even when reviews are thin. Only call it a true toss-up when the options are genuinely interchangeable on fit and value, not merely because info is missing.

Write the notes and verdict in SECOND PERSON — speak directly to the reader as "you" / "your", present tense. Never refer to them as "she", "her", "the shopper", or by name.

${VOICE.decisive}

${HUMANIZER_GUARDRAILS}

Format each note as a clean, plain sentence. Do NOT prefix it with the option number, name, brand, or price — those are already shown beside it; start straight with the substance. Do NOT include any citation markup, footnote markers, or \`<cite>\` tags — just write the sentence in plain words.

Return JSON only, no prose around it:
{ "notes": ["line for option 1", "line for option 2", ...same order, one per option...], "lean": <1-based option number you'd pick, or null if a toss-up>, "verdict": "1–2 sentences" }`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }],
      messages: [{ role: 'user', content: prompt }],
    })
    // With web search the model emits tool-use/result blocks too; the JSON we want
    // is in the final text block(s), so join all text rather than reading [0].
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
    // Web search makes stray prose around the JSON more likely; grab the JSON object.
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const json = cleaned.startsWith('{') ? cleaned : cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1)
    const parsed = JSON.parse(json)
    const notes: string[] = Array.isArray(parsed.notes) ? parsed.notes.slice(0, list.length).map((n: unknown, i: number) => cleanNote(n, list[i]?.title)) : []
    const lean = Number.isInteger(parsed.lean) && parsed.lean >= 1 && parsed.lean <= list.length ? parsed.lean : null
    const verdict = cleanNote(parsed.verdict)
    return res.status(200).json({ notes, lean, verdict })
  } catch (err) {
    console.error('[things-compare] error:', err instanceof Error ? err.message : err)
    return res.status(500).json({ error: 'Could not compare those right now.' })
  }
}
