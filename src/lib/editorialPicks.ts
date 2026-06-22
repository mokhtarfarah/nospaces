import type { DiscoveryResult } from './feeds'

// Cold-start fallback for Discover. When someone has no taste profile yet, the
// per-medium sections fill from this hand-picked list instead of a "make a
// profile first" wall. Static + free (no AI call) — these are durable, broadly
// loved works chosen to be a respectable first impression, not personalised.
// Source label is "editorial" so the feed reads honestly.
//
// Keep ~5–6 per type so each section can show 2–3 and still have a "more →".

const PICKS: Omit<DiscoveryResult, 'sources'>[] = [
  // ── Film ──────────────────────────────────────────────────────────────────
  { title: 'In the Mood for Love', creator: 'Wong Kar-wai', type: 'film', year: 2000, why: 'A near-silent love story told in glances and corridors. One of the most beautiful-looking films ever made.' },
  { title: 'Parasite', creator: 'Bong Joon-ho', type: 'film', year: 2019, why: 'A class thriller that keeps reinventing itself — funny, then tense, then devastating.' },
  { title: 'Portrait of a Lady on Fire', creator: 'Céline Sciamma', type: 'film', year: 2019, why: 'A painter and her subject fall in love over one quiet summer. All longing, no filler.' },
  { title: 'The Florida Project', creator: 'Sean Baker', type: 'film', year: 2017, why: 'Childhood at the edge of a motel, seen entirely at kid height. Tender without being soft.' },
  { title: 'Spirited Away', creator: 'Hayao Miyazaki', type: 'film', year: 2001, why: 'A girl lost in a spirit bathhouse. The gold standard for imagination on screen.' },
  { title: 'Lady Bird', creator: 'Greta Gerwig', type: 'film', year: 2017, why: 'A senior year, a mother and daughter, a town you can\'t wait to leave. Specific and warm.' },

  // ── Music ─────────────────────────────────────────────────────────────────
  { title: 'For Emma, Forever Ago', creator: 'Bon Iver', type: 'music', year: 2007, why: 'Recorded alone in a winter cabin. Hushed, layered, the sound of working something out.' },
  { title: 'Blue', creator: 'Joni Mitchell', type: 'music', year: 1971, why: 'The benchmark for confessional songwriting. Plain words that keep getting deeper.' },
  { title: 'To Pimp a Butterfly', creator: 'Kendrick Lamar', type: 'music', year: 2015, why: 'Jazz, funk and spoken word folded into one of the most ambitious rap records made.' },
  { title: 'In Rainbows', creator: 'Radiohead', type: 'music', year: 2007, why: 'Their warmest album — strange and human at once. A good doorway into the band.' },
  { title: 'Channel Orange', creator: 'Frank Ocean', type: 'music', year: 2012, why: 'Storytelling R&B that drifts and lingers. Sad, lush, full of small films.' },
  { title: 'A Seat at the Table', creator: 'Solange', type: 'music', year: 2016, why: 'Smooth on the surface, sharp underneath. A grower that rewards the whole sitting.' },

  // ── Book ──────────────────────────────────────────────────────────────────
  { title: 'A Little Life', creator: 'Hanya Yanagihara', type: 'book', year: 2015, why: 'A decades-long friendship and the weight one man carries. Brutal, and hard to put down.' },
  { title: 'Klara and the Sun', creator: 'Kazuo Ishiguro', type: 'book', year: 2021, why: 'An artificial friend watches a family with total devotion. Quietly heartbreaking.' },
  { title: 'Pachinko', creator: 'Min Jin Lee', type: 'book', year: 2017, why: 'Four generations of a Korean family in Japan. A sweeping, deeply human saga.' },
  { title: 'Normal People', creator: 'Sally Rooney', type: 'book', year: 2018, why: 'Two people who keep finding and losing each other. Spare, exact, quietly addictive.' },
  { title: 'The Remains of the Day', creator: 'Kazuo Ishiguro', type: 'book', year: 1989, why: 'A butler reckons, too late, with a life of dignified restraint. A masterclass in what\'s unsaid.' },
  { title: 'Bel Canto', creator: 'Ann Patchett', type: 'book', year: 2001, why: 'A hostage standoff that turns, improbably, into something tender. Beautifully strange.' },

  // ── TV ────────────────────────────────────────────────────────────────────
  { title: 'The Bear', creator: 'Christopher Storer', type: 'tv', year: 2022, why: 'A chef takes over his family\'s sandwich shop. Fast, anxious, and full of heart.' },
  { title: 'Fleabag', creator: 'Phoebe Waller-Bridge', type: 'tv', year: 2016, why: 'Grief and bad decisions told straight to camera. Hilarious, then it guts you.' },
  { title: 'The Leftovers', creator: 'Damon Lindelof', type: 'tv', year: 2014, why: 'Two percent of the world vanishes; this is about everyone left behind. Strange and profound.' },
  { title: 'Better Call Saul', creator: 'Vince Gilligan', type: 'tv', year: 2015, why: 'A slow-burn tragedy about a good-enough man becoming a worse one. Patient and exquisite.' },
  { title: 'Severance', creator: 'Dan Erickson', type: 'tv', year: 2022, why: 'Office workers split their memories in two. A creepy, precise puzzle box.' },
  { title: 'Atlanta', creator: 'Donald Glover', type: 'tv', year: 2016, why: 'A music-scene hangout show that keeps turning into something dreamlike and sharp.' },
]

const EDITORIAL_PICKS: DiscoveryResult[] = PICKS.map(p => ({ ...p, sources: ['editorial'] }))

export function editorialPicksFor(type: 'film' | 'book' | 'music' | 'tv'): DiscoveryResult[] {
  return EDITORIAL_PICKS.filter(p => p.type === type)
}
