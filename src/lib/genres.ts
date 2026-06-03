// Edit these lists freely — the AI will pick 1–3 genres from the relevant
// list at identify time. Add, remove, or rename genres here and everything
// updates automatically (action card chips, filters, taste snapshot).
export const GENRES: Record<string, string[]> = {
  film: [
    'action', 'animation', 'comedy', 'crime', 'documentary',
    'drama', 'fantasy', 'horror', 'musical', 'romance',
    'satire', 'sci-fi', 'thriller', 'western',
  ],
  tv: [
    'animation', 'comedy', 'crime', 'documentary', 'drama',
    'fantasy', 'horror', 'reality', 'satire', 'sci-fi', 'thriller',
  ],
  book: [
    'biography', 'business', 'classics', 'crime', 'essay',
    'fantasy', 'history', 'horror', 'literary fiction', 'mystery',
    'philosophy', 'poetry', 'romance', 'satire', 'sci-fi', 'self-help',
    'short stories', 'thriller', 'travel',
  ],
  music: [
    'afrobeats', 'ambient', 'classical', 'country', 'electronic',
    'folk', 'hip-hop', 'indie', 'jazz', 'latin',
    'metal', 'pop', 'punk', 'r&b', 'rock', 'soul',
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
