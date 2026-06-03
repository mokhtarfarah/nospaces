// Two axes of "vibe", both stored in the single item `moods[]` array.
// Edit these lists freely — add, remove, or rename and the whole app updates
// automatically (mark-done chips, action card display, filters, taste page).
//
// VIBES   = what it *feels* like (describes the work; you can love or hate it).
//           This is the real taste fingerprint — ranked by reaction on taste page.
// VERDICTS = how it *landed* for you (your relationship to it). A richer rating
//           layer, NOT ranked by reaction (that'd be circular).

export const VIBES: string[] = [
  'atmospheric',
  'dark',
  'melancholic',
  'intense',
  'epic',
  'off-kilter',
  'earnest',
  'tearjerker',
  'romantic',
  'artsy',
  'nostalgic',
  'cozy',
  'relaxed',
  'upbeat',
  'funny',
]

export const VERDICTS: string[] = [
  'life-changing',
  'just really, really good',
  'comfort',
  'guilty pleasure',
  'so bad it\'s good',
  'overhyped',
]

// Combined list — used anywhere that just needs "all mood tags" (e.g. the
// mark-done sheet renders VIBES and VERDICTS as two labelled groups, but
// filters and validation can use the flat list).
export const MOODS: string[] = [...VIBES, ...VERDICTS]

// Which axis a given mood belongs to (for partitioning tagged items).
export function moodAxis(mood: string): 'vibe' | 'verdict' | null {
  if (VIBES.includes(mood)) return 'vibe'
  if (VERDICTS.includes(mood)) return 'verdict'
  return null
}
