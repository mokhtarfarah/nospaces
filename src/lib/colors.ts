export const TYPE_COLORS: Record<string, { border: string; bg: string; label: string }> = {
  film:  { border: '#002FA7', bg: '#E6EBFA', label: 'Film' },
  book:  { border: '#5A7A5A', bg: '#EDF3ED', label: 'Book' },
  music: { border: '#C8612A', bg: '#FAF0EB', label: 'Music' },
  tv:    { border: '#A0525A', bg: '#F7EDEE', label: 'TV' },
  other: { border: '#888888', bg: '#F2F2F2', label: 'Other' },
}

export function typeColor(type: string) {
  return TYPE_COLORS[type.toLowerCase()] ?? TYPE_COLORS.other
}
