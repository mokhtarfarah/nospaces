// Monochrome palette — types are distinguished by graded greys (still works in the
// legend and the row's left border) while keeping the overall look black & white.
export const TYPE_COLORS: Record<string, { border: string; bg: string; label: string }> = {
  film:  { border: '#1A1A1A', bg: '#ECECEC', label: 'Film' },
  book:  { border: '#5C5C5C', bg: '#EFEFEF', label: 'Book' },
  music: { border: '#8A8A8A', bg: '#F2F2F2', label: 'Music' },
  tv:    { border: '#B4B4B4', bg: '#F4F4F4', label: 'TV' },
  other: { border: '#CFCFCF', bg: '#F6F6F6', label: 'Other' },
}

export function typeColor(type: string) {
  return TYPE_COLORS[type.toLowerCase()] ?? TYPE_COLORS.other
}
