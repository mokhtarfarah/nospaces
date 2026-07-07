import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'
import { HUMANIZER_GUARDRAILS, VOICE, GROUNDING } from './_humanizer.js'
import { scrapeProduct } from './_scrape.js'
import { fetchImageBase64 } from './_vision.js'
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
  // The saved product photo — fetched server-side and shown to the model so it
  // judges the real look (silhouette, proportion, how chic it reads), not a guess.
  image?: string | null
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

  // In parallel: (a) read each option's product page for text context (description +
  // on-page rating; free, SSRF-guarded), and (b) fetch each option's saved photo so
  // the model can judge the real look. Both best-effort — a page or image that won't
  // load just drops that signal for that option; the rest of the read carries on.
  const [details, photos] = await Promise.all([
    Promise.all(list.map(async (c) => {
      if (!c.url) return null
      const r = await scrapeProduct(c.url)
      return r.ok ? { description: r.fields.description ?? null, rating: r.fields.rating ?? null } : null
    })),
    Promise.all(list.map(async (c) => {
      if (!c.image) return null
      const r = await fetchImageBase64(c.image, c.url ?? undefined)
      return r.ok ? { data: r.data, media: r.media } : null
    })),
  ])
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

You are their stylist: sharp, chic, body-aware, on their side, with zero stake in the sale. So flag what the brand won't — where it'll gap, ride up, crease, or miss their proportions${profile ? ' and body type' : ''}. Most options have their PHOTO attached below — actually look at it. Judge the real silhouette, proportion, colour, and how chic or casual it reads from the image, and weigh that TOGETHER with the name, price, their saved tags, the shop's description and anything you found online — decide from more information, not less. Only call something cute/elegant/chunky/sleek when the photo or the words genuinely show it; don't free-associate a look. What you canNOT do is feel the fabric or know the true in-person fit, so frame those as risks to check, not facts. If an option has no photo attached, judge it from its text and don't invent a look for it.

Keep every option separate. Each numbered option is a DIFFERENT product — never attribute one option's brand, sizing, fit, or reviews to another (e.g. don't pin "Common Projects runs long" onto a different maker's mule). Tie each fact to the exact option it came from; if you're not sure which option a detail belongs to, leave it out.

For each option, write ONE tight note — 1 to 2 short sentences, 20–35 words, no more. They can already see the photo, name, brand and price and have read the shop's blurb, so DO NOT describe the product back or echo marketing copy ("premium leather", "purpose-built", "made in Italy", "clean lines", "power mesh"). Skip the sales sheet. Go straight to your read: does it actually work for them and what they want, and what's the catch that matters most. Lead with the verdict, name the catch, stop. Don't enumerate every feature; pick the thing that decides it.

When you pick that catch, prioritise the concerns they named in "what matters" above your own observations — if they said it must not crease and it's a leather piece prone to creasing, creasing IS the catch, every time; never drop a concern they explicitly raised in favour of a more generic point. Be consistent: the same option judged twice should surface the same decisive issue.

Then a short overall verdict — 1 to 2 sentences, which you'd lean toward and why in plain words${context ? ', weighing what matters to them' : ''}. Don't invent specifics (a rating, a review quote) you don't have, but DO commit to a lean on fit + value even when reviews are thin. Call it a true toss-up only when the options are genuinely interchangeable, not just because info is missing.

Write the notes and verdict in SECOND PERSON — speak straight to them as "you"/"your", present tense. Never "she", "her", "the shopper", or by name. Plain and direct: no warm-up, no flourish, no editorializing.

${VOICE.decisive}

${GROUNDING}

${HUMANIZER_GUARDRAILS}

Format each note as a clean, plain sentence. Do NOT prefix it with the option number, name, brand, or price — those are already shown beside it; start straight with the substance. Do NOT include any citation markup, footnote markers, or \`<cite>\` tags — just write the sentence in plain words.

Return JSON only, no prose around it:
{ "notes": ["line for option 1", "line for option 2", ...same order, one per option...], "lean": <1-based option number you'd pick, or null if a toss-up>, "verdict": "1–2 sentences" }`

  // The prompt text first, then each option's photo (the ones we could fetch),
  // labelled so the model knows which image is which option.
  const content: Anthropic.ContentBlockParam[] = [{ type: 'text', text: prompt }]
  photos.forEach((p, i) => {
    if (!p) return
    content.push({ type: 'text', text: `Photo — option ${i + 1} (${list[i].title ?? 'Untitled'}):` })
    content.push({ type: 'image', source: { type: 'base64', media_type: p.media, data: p.data } })
  })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      // Run cool, not hot: the default (~1.0) made the same comparison emphasise
      // different things each run (creasing flagged once, gone the next). 0.3 keeps
      // the judgment steady run-to-run; some drift remains because web search pulls
      // fresh results each time, but that's the only intended source of variation.
      temperature: 0.3,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }],
      messages: [{ role: 'user', content }],
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
