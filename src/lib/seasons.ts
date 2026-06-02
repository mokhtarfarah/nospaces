// TV seasons are stored on an item's metadata as metadata.seasons.
export interface Season {
  n: number
  done: boolean
}

export function getSeasons(metadata: Record<string, unknown>): Season[] {
  const raw = (metadata as { seasons?: unknown }).seasons
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s): s is Season => !!s && typeof (s as Season).n === 'number')
    .map(s => ({ n: (s as Season).n, done: !!(s as Season).done }))
    .sort((a, b) => a.n - b.n)
}
