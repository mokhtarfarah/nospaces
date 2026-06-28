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

// Verdicts answer a different question than the reaction. Reaction = "did it grab
// me?" (pull/feeling, backward-looking). Verdict = "what is this to me?" (place/role,
// forward-looking). They diverge on purpose: a film can be `loved it` you'll never
// replay, or `liked it` you'd happily revisit. Verdict is OPTIONAL — a highlighter
// for the special ones, not a slot to fill. `desert island` is its own elevated UI
// (the canon star), not a chip here.
//
// Tiered like vibes: `in rotation` + `hyperfixation` are music/TV-only (you don't
// put a film "in rotation"), so film/book verdict lists stay short.
export const VERDICTS_CORE: string[] = [
  'stuck with me',     // still in my head now (present-tense), not "was intense once"
  'would revisit',     // go back on its merits
  'comfort',           // return to feel safe
  'guilty pleasure',   // love it, know it's not "good"
  'wanted to love it', // hoped to, didn't click — the gap between aspiration & taste
  'my secret gem',     // underrated, want to press it on people
]

export const VERDICTS_MUSIC_TV: string[] = [
  'in rotation',
  'hyperfixation',
]

// Returns the verdict list for a given item type. music/TV get the two extra
// rotation verdicts; film/book stay on the core set.
export function verdictsForType(type: string): string[] {
  return type === 'music' || type === 'tv'
    ? [...VERDICTS_CORE, ...VERDICTS_MUSIC_TV]
    : VERDICTS_CORE
}

// The full flat verdict set — used for validation and membership checks.
export const VERDICTS: string[] = [...VERDICTS_CORE, ...VERDICTS_MUSIC_TV]

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
  'just really really good':      null,
  'they don\'t make \'em like this': null,
  // Verdict reshape (s93): folded, renamed, or demoted-to-status terms.
  'respect, not love':            'wanted to love it', // about you, not deferring to critics
  'so bad it\'s good':            'guilty pleasure',
  'overrated':                    null,                // dropped — NOT 'my secret gem' (opposite meaning)
  'overhyped':                    null,
  'delivers':                     null,                // that's just "liked it" (a reaction)
  'unfinished business':          null,                // that's a status, not a verdict
}
