// Single source of truth for genre vocab across all Vercel serverless functions.
// Vercel functions can't import from src/, so this mirrors src/lib/genres.ts —
// the two are kept in sync by scripts/check-genres.mjs (runs on pre-commit).
// Every api/ endpoint that needs genres imports from here; do NOT redeclare a
// local copy.
export const GENRE_VOCAB: Record<string, string[]> = {
  film:  ['action','animation','classic','comedy','crime','documentary','drama','fantasy','horror','musical','period piece','romance','satire','sci-fi','thriller','western'],
  tv:    ['animation','classic','comedy','crime','documentary','drama','fantasy','horror','period piece','reality','satire','sci-fi','thriller'],
  book:  ['biography','business','classics','cookbook','crime','essay','fantasy','historical fiction','history','horror','literary fiction','memoir','mystery','period piece','philosophy','poetry','romance','satire','sci-fi','self-help','short stories','thriller','travel'],
  music: ['afrobeats','ambient','art pop','classical','country','electronic','experimental','folk','funk','glam rock','hip-hop','indie','jazz','latin','metal','new wave','pop','post-punk','punk','r&b','rock','soul'],
  other: [],
}

// Deduped union of every genre across all types — for endpoints (search) that
// validate against a single flat list rather than per-type.
export const GENRE_FLAT: string[] = [...new Set(Object.values(GENRE_VOCAB).flat())]

// Human-readable per-type block for AI prompts: "film: a, b, c\ntv: ...".
// Skips empty types (other).
export const genreBlock = (): string =>
  Object.entries(GENRE_VOCAB)
    .filter(([, g]) => g.length)
    .map(([t, g]) => `${t}: ${g.join(', ')}`)
    .join('\n')
