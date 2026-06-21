// Edit these lists freely — the AI will pick 1–3 genres from the relevant
// list at identify time. Add, remove, or rename genres here and everything
// updates automatically (action card chips, filters, taste snapshot).
export const GENRES: Record<string, string[]> = {
  film: [
    'action', 'animation', 'classic', 'comedy', 'crime', 'documentary',
    'drama', 'fantasy', 'horror', 'musical', 'period piece',
    'romance', 'satire', 'sci-fi', 'thriller', 'western',
  ],
  tv: [
    'animation', 'classic', 'comedy', 'crime', 'documentary', 'drama',
    'fantasy', 'horror', 'period piece', 'reality', 'satire',
    'sci-fi', 'thriller',
  ],
  book: [
    'biography', 'business', 'classics', 'cookbook', 'crime', 'essay',
    'fantasy', 'historical fiction', 'history', 'horror', 'literary fiction', 'memoir', 'mystery',
    'period piece', 'philosophy', 'poetry', 'romance', 'satire',
    'sci-fi', 'self-help', 'short stories', 'thriller', 'travel',
  ],
  music: [
    'afrobeats', 'ambient', 'art pop', 'classical', 'country', 'electronic',
    'experimental', 'folk', 'funk', 'glam rock', 'hip-hop', 'indie', 'jazz',
    'latin', 'metal', 'new wave', 'pop', 'post-punk', 'punk', 'r&b', 'rock', 'soul',
  ],
  other: [],
}

// Returns the genre list for a given item type, falling back to empty.
export function genresForType(type: string): string[] {
  return GENRES[type] ?? []
}

// Union of every type's genre vocab, lowercased — used to tell a real genre
// from a free-text descriptor (e.g. "New York", "sitcom", "ensemble cast").
const ALL_GENRE_SET = new Set<string>(
  Object.values(GENRES).flat().map(g => g.toLowerCase()),
)

// True only if `tag` is a known genre (in vocab). Everything else is a
// descriptor — kept in tags[] and searchable, but hidden from genre surfaces.
export function isGenreTag(tag: string): boolean {
  return ALL_GENRE_SET.has(tag.toLowerCase())
}
