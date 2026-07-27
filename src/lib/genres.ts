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
    'action', 'adventure', 'animation', 'classic', 'comedy', 'crime', 'documentary', 'drama',
    'fantasy', 'horror', 'mystery', 'period piece', 'reality', 'romance', 'satire',
    'sci-fi', 'thriller',
  ],
  book: [
    'biography', 'business', 'classics', 'cookbook', 'crime', 'essay',
    'fantasy', 'historical fiction', 'history', 'horror', 'literary fiction', 'memoir', 'mystery',
    'period piece', 'philosophy', 'poetry', 'romance', 'satire',
    'sci-fi', 'self-help', 'short stories', 'thriller', 'travel',
  ],
  music: [
    'afrobeats', 'alt rock', 'ambient', 'art pop', 'classical', 'country', 'electronic',
    'experimental', 'folk', 'funk', 'glam rock', 'grunge', 'hip-hop', 'indie', 'jazz',
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

// The genre value for the derived "non-fiction" category. It's not in the flat
// vocab above and isn't stored on any item — it's synthesized in the filter so
// every non-fiction book reads as its specific genre (memoir) AND "non-fiction",
// clickable like any other genre. No re-tagging, always in sync with the tags.
export const NONFICTION_GENRE = 'non-fiction'

// Book genres that roll up into "non-fiction". A book carrying any of these is
// counted under the derived NONFICTION_GENRE chip and matched when it's filtered
// on. Deliberately conservative: 'classics'/'poetry' are left out (canon is
// mostly fiction; poetry isn't non-fiction prose), 'essay' is in (overwhelmingly
// non-fiction). If a genre isn't here, it reads as fiction.
const NONFICTION_GENRES = new Set<string>([
  'biography', 'business', 'cookbook', 'essay', 'history', 'memoir',
  'philosophy', 'self-help', 'travel',
])

export function isNonfictionGenre(tag: string): boolean {
  return NONFICTION_GENRES.has(tag.toLowerCase())
}

// True if any of an item's tags is a non-fiction genre — i.e. the item belongs
// under the derived "non-fiction" category.
export function hasNonfictionGenre(tags?: string[] | null): boolean {
  return (tags ?? []).some(isNonfictionGenre)
}
