// Monochrome palette — types are distinguished by graded greys (still works in the
// legend and the row's left border) while keeping the overall look black & white.
export const TYPE_COLORS: Record<string, { border: string; bg: string; label: string }> = {
  film:  { border: '#1A1A1A', bg: '#ECECEC', label: 'film' },
  book:  { border: '#5C5C5C', bg: '#EFEFEF', label: 'book' },
  music: { border: '#8A8A8A', bg: '#F2F2F2', label: 'music' },
  tv:    { border: '#B4B4B4', bg: '#F4F4F4', label: 'tv' },
  article: { border: '#A8A29A', bg: '#F0EFEC', label: 'article' },
  other: { border: '#CFCFCF', bg: '#F6F6F6', label: 'other' },
}

export function typeColor(type: string) {
  return TYPE_COLORS[type.toLowerCase()] ?? TYPE_COLORS.other
}
