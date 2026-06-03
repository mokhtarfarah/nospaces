import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Genre vocab — keep in sync with src/lib/genres.ts (server-side copy, Vercel
// functions can't import from src/).
const GENRE_VOCAB: Record<string, string[]> = {
  film:  ['action','animation','comedy','crime','documentary','drama','fantasy','horror','musical','romance','sci-fi','thriller','western'],
  tv:    ['animation','comedy','crime','documentary','drama','fantasy','horror','reality','sci-fi','thriller'],
  book:  ['biography','business','classics','crime','essay','fantasy','history','horror','literary fiction','mystery','philosophy','poetry','romance','sci-fi','self-help','short stories','thriller','travel'],
  music: ['afrobeats','ambient','classical','country','electronic','folk','hip-hop','indie','jazz','latin','metal','pop','punk','r&b','rock','soul'],
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an assistant that identifies films, books, music albums, and TV shows from text descriptions or titles. Return JSON only, no preamble, no markdown.`

const USER_PROMPT = (input: string, genreList: string) => `Given this input: "${input}"

Identify the item and return JSON only:
{
  "title": "exact title",
  "creator": "director / author / artist / showrunner",
  "type": "film|book|music|tv|other",
  "year": 1234,
  "confidence": "high|medium|low",
  "metadata": { "runtime": null, "pages": null },
  "tags": ["tag1", "tag2"],
  "blurb": null,
  "ambiguous": false,
  "alternatives": []
}

IMPORTANT — always fill in creator:
- film: the director's full name (e.g. "Sofia Coppola"). Never leave null.
- book: the author's full name.
- music: the primary artist / band name.
- tv: the creator or showrunner's full name.
Only leave creator null if the item is truly unknown (type "other") or you genuinely cannot identify the creator despite knowing the title.

GENRES — populate "tags" with 1–3 genres from this list only (no other values):
${genreList}
If type is "other" or you don't recognise the item, leave tags as [].

RUNTIME / PAGES — populate metadata fields if known:
- film / tv: set "runtime" to the runtime in minutes as a number (e.g. 112). Leave null if unknown.
- book: set "pages" to the page count as a number (e.g. 324). Leave null if unknown.
- music / other: leave both null.

BLURB — leave null for text input. Only populate if the input is an image and there is visible descriptive text about the item (e.g. back-cover copy, a review excerpt, a list annotation). Copy it verbatim or paraphrase closely. Do not invent a description.

If confidence is low, populate alternatives with up to 3 other possible matches with the same shape.
If the input is wrapped in quotation marks, treat the quoted text as an EXACT, literal title — do not substitute a more famous or differently-spelled work. Match that exact title even if it's obscure; if you can't, set type "other" and use the quoted text verbatim as the title.
If you cannot identify anything, return type "other" with the input as the title.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { input, imageBase64, mimeType, typeHint } = req.body as {
    input?: string
    imageBase64?: string
    mimeType?: string
    typeHint?: string
  }

  const hintLine = typeHint ? `\nThe user indicates this is a ${typeHint}. Strongly prefer that type.` : ''
  const knownType = typeHint && GENRE_VOCAB[typeHint] ? typeHint : null
  const genreList = knownType
    ? GENRE_VOCAB[knownType].join(', ')
    : Object.entries(GENRE_VOCAB).map(([t, g]) => `${t}: ${g.join(', ')}`).join('\n')

  try {
    const content: Anthropic.MessageParam['content'] = []

    if (imageBase64 && mimeType) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: imageBase64,
        },
      })
      content.push({
        type: 'text',
        text: `Identify the film, book, music album, or TV show in this image. Always fill in creator (director for films, author for books, artist for music, showrunner for TV). Populate "tags" with 1–3 genres from this list only:\n${genreList}\nFor metadata: film/tv → set "runtime" to minutes as a number; book → set "pages" to page count as a number; others leave null.\nFor "blurb": if the image contains visible descriptive text about the item (back-cover copy, a review excerpt, a list annotation), capture it here — copy verbatim or paraphrase closely. Otherwise null.\nReturn JSON only:\n{\n  "title": "...",\n  "creator": "...",\n  "type": "film|book|music|tv|other",\n  "year": 1234,\n  "confidence": "high|medium|low",\n  "metadata": { "runtime": null, "pages": null },\n  "tags": [],\n  "blurb": null,\n  "ambiguous": false,\n  "alternatives": []\n}` + hintLine,
      })
    } else {
      content.push({ type: 'text', text: USER_PROMPT(input ?? '', genreList) + hintLine })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const json = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())

    res.status(200).json(json)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to identify item' })
  }
}
