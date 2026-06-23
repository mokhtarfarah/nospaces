import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthUserId, checkRateLimit } from './_ratelimit.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const config = { maxDuration: 30 }

interface InputItem {
  title: string
  creator?: string | null
  type: string
  reaction: string
  note?: string | null
}

interface AspGap {
  adding: string
  finishing: string
}

const SYSTEM_PROMPT = `You are writing a short, sharp profile of one person's taste in film, books, music, and TV — the kind of read a perceptive friend who knows them well would write. Not a critic, not a brand.

Write exactly 2 paragraphs in second person. Each paragraph 2–4 sentences.

How to read the evidence — the RATING is the verdict and your primary signal:
- LOVED items are the core of their taste. Anchor your profile on these. The strongest patterns should come from what they loved.
- LIKED items are secondary positives — supporting evidence, not the center.
- EH and NOT FOR ME items are the boundary of their taste: what leaves them cold or actively turns them off. A clear pattern in what they reject is as revealing as what they love — name it if one exists.
- Private notes add specific color, but they NEVER override the rating. Do not let a heavily-annotated "liked" or "eh" item overshadow a "loved" item with no note. Weight by how they actually rated things, not by how much they wrote.

Substance rules:
- Name 2–3 specific titles total across both paragraphs — no more. Wrap titles in *asterisks*. Prefer loved titles unless a lower-rated one is essential to the point. Choose titles that actually illustrate the point; don't pile on examples.
- Make only observations that are clearly supported by the ratings. Do not speculate, invent patterns, or force a clever contrast that isn't genuinely there.
- If there is a real and interesting tension in the taste — name it plainly. If there isn't, don't manufacture one.
- If an aspiration gap is provided (what they keep adding vs. what they actually finish), weave it in naturally if it adds something true.
- The vibe words shown on the page are anchors — deepen them with something specific; do not restate or list them.
- Private notes are evidence for you to reason from, not for publication. Never quote or echo a note's wording.

Sound like a person, not an AI. These are tells of machine writing — avoid them:
- Puffery and inflated significance: "pivotal," "testament," "marks a turning point," "indelible mark," "deeply rooted," "rich tapestry," "speaks to something broader." Don't announce that something is meaningful — show the pattern and let it land.
- The connective filler AI leans on: "moreover," "furthermore," "additionally," "delve," "underscore," "highlight," "showcase," "boasts," "intricate," "landscape," "vibrant," "enduring," "interplay," "nuanced," "layered," "resonant," "compelling," "evocative," "cinematic," "complex," "thoughtful," "journey."
- The rule of three: stacking adjectives or clauses in threes ("bold, strange, and tender"). Vary the rhythm instead.
- Negative parallelism: "not just X, but Y" / "it's not X, it's Y." Use it at most once, and only if it's genuinely the sharpest way to say something.
- Trailing "-ing" clauses that bolt on fake analysis: "...creating a sense of," "...highlighting their range," "...reflecting a deeper." End sentences cleanly.
- Dressed-up copulas: prefer plain "is/are" over "serves as," "stands as," "represents."
- Vague attribution: no "critics say," "many would argue," "it's often noted."
- Synonym cycling: don't rename the same thing three different ways to dodge repetition ("the protagonist... the central figure... our hero"). Just repeat the plain word.
- False ranges: don't fake scope with sweeping "from X to Y" constructions ("from quiet heartbreak to grand spectacle").
- Manufactured punchlines and staccato drama: don't stack clipped fragments for fake weight ("No plot. No comfort. No apology."). A short sentence is fine; a drumroll of them is a tell.
- Aphorism formulas: don't land on a quotable-sounding maxim ("restraint is its own kind of risk"). Make the real point instead.
- Conversational rhetorical openers: don't start with fake-candid hooks ("Honestly?", "Here's the thing."). Just begin.
- Passive or subjectless constructions where a person would name who's doing what.

Write with contractions, plain words, and sentences of varied length. Em-dashes are fine where they read naturally; don't lean on them. No hedging, no preamble, no bullet points, no summary sentence at the end. Just the two paragraphs.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const userId = await getAuthUserId(req.headers['authorization'])
  if (!userId) return res.status(401).end()
  if (!await checkRateLimit(userId, 'taste-profile', 20)) return res.status(429).json({ error: 'Rate limit exceeded. Try again next hour.' })

  const { items, vibes, canon, aspirationGap } = req.body as {
    items: InputItem[]
    vibes?: string[]
    canon?: string[]
    aspirationGap?: AspGap | null
  }
  if (!items?.length) return res.status(400).json({ error: 'no items' })

  // Need at least one positive (loved/liked) reaction to anchor a profile.
  const hasPositive = items.some(i => i.reaction === 'loved_it' || i.reaction === 'liked_it')
  if (!hasPositive) return res.status(400).json({ error: 'no liked items' })

  // Build the list grouped by reaction, strongest signal first, so the model
  // reads the verdicts as a hierarchy. Per-bucket caps keep the token budget
  // sane while preserving the full rating spectrum (loved → not for me).
  const BUCKETS: { reaction: string; label: string; cap: number }[] = [
    { reaction: 'loved_it', label: 'LOVED', cap: 70 },
    { reaction: 'liked_it', label: 'liked', cap: 50 },
    { reaction: 'eh', label: 'eh (lukewarm)', cap: 25 },
    { reaction: 'not_for_me', label: 'not for me (rejected)', cap: 25 },
  ]

  const fmt = (i: InputItem, label: string) => {
    const creator = i.creator ? ` — ${i.creator}` : ''
    const note = i.note ? ` (private note: ${i.note})` : ''
    return `[${label}] ${i.title}${creator} (${i.type})${note}`
  }

  const list = BUCKETS
    .map(b => items.filter(i => i.reaction === b.reaction).slice(0, b.cap).map(i => fmt(i, b.label)))
    .filter(rows => rows.length)
    .map(rows => rows.join('\n'))
    .join('\n')

  const canonLine = canon?.length
    ? `\n\nCanon items (things they have explicitly marked as defining works): ${canon.join(', ')}.`
    : ''

  const gapLine = aspirationGap
    ? `\n\nAspiration gap: they keep adding ${aspirationGap.adding} to their list but mostly finish ${aspirationGap.finishing}. This is often revealing — work it in if it adds something true.`
    : ''

  const vibeLine = vibes?.length
    ? `\n\nVibe words already shown on the page (do not restate): ${vibes.join(', ')}.`
    : ''

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Here is the list:\n\n${list}${canonLine}${gapLine}${vibeLine}`,
      }],
    })
    const profile = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return res.status(200).json({ profile })
  } catch (err) {
    console.error('[taste-profile]', err)
    return res.status(500).json({ error: 'Failed to generate taste profile' })
  }
}
