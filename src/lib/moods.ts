// Vibes = what a work *feels* like (describes the work itself; AI can suggest these).
// Verdicts = how it *landed for you* (your relationship to it; always manual — the AI
//            cannot know your personal relationship to a work).
//
// Vibes are tiered by which media types they apply to:
//   VIBES_CORE      — all four media (film, tv, book, music)
//   VIBES_NARRATIVE — film, tv, book (story-based media)
//   VIBES_FILM_TV   — film and tv only
//   VIBES_MUSIC     — music only
//   VIBES_BOOK      — book only
//
// Each vibe has an axis (metadata for the recommender — not shown to the user).
// Axes let the recommender reason cross-medium: hype/intense/propulsive are all
// "high energy" even though they're different words per medium.
//
// Axis map:
//   energy   : hype · intense · propulsive (high) ↔ mellow · easy (low)
//   weight   : heavy (heavy)
//   warmth   : cozy · playful · romantic (warm) ↔ dark · melancholic (cool)
//   effort   : demanding · dense (high) ↔ easy (low)   ← the one explicit bipolar pair
//   texture  : lush · hazy · atmospheric-quality
//   aesthetic: arthouse · lyrical · literary · spare
//   oddness  : off-kilter
//   charge   : sexy
//   intellect: sharp
//   tone     : nostalgic · epic · earnest · funny · dark

export const VIBES_CORE: string[] = [
  'hazy',
  'dark',
  'melancholic',
  'nostalgic',
  'romantic',
  'off-kilter',
  'epic',
  'playful',
  'sexy',
  'sharp',
  'lush',
]

export const VIBES_NARRATIVE: string[] = [
  'intense',
  'heavy',
  'easy',
  'demanding',
  'funny',
  'cozy',
  'earnest',
]

export const VIBES_FILM_TV: string[] = [
  'arthouse',
  'fun',
]

export const VIBES_MUSIC: string[] = [
  'hype',
  'raw',
  'danceable',
  'groovy',
  'mellow',
  'hypnotic',
]

export const VIBES_BOOK: string[] = [
  'propulsive',
  'dense',
  'lyrical',
  'immersive',
  'literary',
  'spare',
]

// Returns the full vibe list for a given item type — core + applicable tiers.
export function vibesForType(type: string): string[] {
  switch (type) {
    case 'film':
    case 'tv':
      return [...VIBES_CORE, ...VIBES_NARRATIVE, ...VIBES_FILM_TV]
    case 'book':
      return [...VIBES_CORE, ...VIBES_NARRATIVE, ...VIBES_BOOK]
    case 'music':
      return [...VIBES_CORE, ...VIBES_MUSIC]
    default:
      return VIBES_CORE
  }
}

// The full flat vibe set — used for validation and filter membership checks.
export const VIBES: string[] = [
  ...new Set([...VIBES_CORE, ...VIBES_NARRATIVE, ...VIBES_FILM_TV, ...VIBES_MUSIC, ...VIBES_BOOK])
]

export const VERDICTS: string[] = [
  'comfort',
  'guilty pleasure',
  'hyperfixation',
  'in rotation',
  'unfinished business',
  'delivers',
  'respect, not love',
  'overrated',
  'so bad it\'s good',
]

// Combined — used anywhere that needs all mood tags flat (filters, validation).
export const MOODS: string[] = [...VIBES, ...VERDICTS]

export function moodAxis(mood: string): 'vibe' | 'verdict' | null {
  if (VIBES.includes(mood)) return 'vibe'
  if (VERDICTS.includes(mood)) return 'verdict'
  return null
}

// Old tags that need remapping during the cleanup migration.
// Key = old tag, value = new tag (or null = drop).
export const MOOD_REMAP: Record<string, string | null> = {
  'atmospheric':           'hazy',
  'artsy':                 'arthouse',
  'upbeat':                'fun',
  'relaxed':               'easy',
  'tearjerker':            null,
  'feel-good':             null,
  'dreamy':                null,
  'life-changing':         null,
  'just really, really good': null,
  'overhyped':                    'overrated',
  'would revisit':                'in rotation',
  'just really really good':      null,
  'they don\'t make \'em like this': null,
}
