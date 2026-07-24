// Monochrome palette — types are distinguished by graded greys (still works in the
// legend and the row's left border) while keeping the overall look black & white.
export const TYPE_COLORS: Record<string, { border: string; bg: string; label: string }> = {
  film:  { border: '#1A1A1A', bg: '#ECECEC', label: 'film' },
  book:  { border: '#5C5C5C', bg: '#EFEFEF', label: 'book' },
  music: { border: '#8A8A8A', bg: '#F2F2F2', label: 'music' },
  tv:    { border: '#B4B4B4', bg: '#F4F4F4', label: 'tv' },
  article: { border: '#A8A29A', bg: '#F0EFEC', label: 'article' },
  podcast: { border: '#96908A', bg: '#EFEDEA', label: 'podcast' },
  other: { border: '#CFCFCF', bg: '#F6F6F6', label: 'other' },
}

export function typeColor(type: string) {
  return TYPE_COLORS[type.toLowerCase()] ?? TYPE_COLORS.other
}

// Link-saved "bookmark" types — articles and podcasts. They behave alike
// everywhere: an og:image cover, a source-name band, mark-done with no reaction,
// out of the taste surfaces, and their own quiet entry-point bar (not a tab).
// Grouping them behind one predicate keeps the two in lockstep.
export const BOOKMARK_TYPES = ['article', 'podcast']
export const isBookmark = (type: string) => BOOKMARK_TYPES.includes(type)
