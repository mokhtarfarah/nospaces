import type { DiscoveryResult } from './feeds'

// Cold-start fallback for Discover. When someone has no taste profile yet, the
// per-medium sections fill from this list instead of a "make a profile first"
// wall. Static + free (no AI call).
//
// IMPORTANT — these are NOT meant to reflect any one person's taste. The target
// band is the smart middle: broadly accessible AND genuinely well-reviewed.
// Not lowest-common-denominator crowd-pleasers, not niche critical darlings —
// the works that are both widely loved and critically respected, the kind you'd
// confidently hand a stranger. Keep ~6 per type so each section shows 3 + "more →".

const PICKS: Omit<DiscoveryResult, 'sources'>[] = [
  // ── Film ──────────────────────────────────────────────────────────────────
  { title: 'Parasite', creator: 'Bong Joon-ho', type: 'film', year: 2019, why: 'A struggling family schemes their way into a rich household. A sharp, twisty thriller that swept the Oscars.' },
  { title: 'Spirited Away', creator: 'Hayao Miyazaki', type: 'film', year: 2001, why: 'A young girl is trapped in a magical bathhouse for spirits. A dazzling, imaginative adventure and a modern classic.' },
  { title: 'Eternal Sunshine of the Spotless Mind', creator: 'Michel Gondry', type: 'film', year: 2004, why: 'A couple erase each other from their memories and regret it. Inventive, funny and quietly heartbreaking.' },
  { title: 'The Social Network', creator: 'David Fincher', type: 'film', year: 2010, why: 'The founding of Facebook told as a fast, biting drama about ambition and betrayal. Endlessly rewatchable.' },
  { title: 'Get Out', creator: 'Jordan Peele', type: 'film', year: 2017, why: 'A young man visits his girlfriend\'s family and senses something is very wrong. A smart, gripping horror-thriller with a lot on its mind.' },
  { title: 'The Grand Budapest Hotel', creator: 'Wes Anderson', type: 'film', year: 2014, why: 'A concierge and his protégé tangle over a stolen painting. Witty, beautifully designed, easy to fall for.' },

  // ── Music ─────────────────────────────────────────────────────────────────
  { title: 'Rumours', creator: 'Fleetwood Mac', type: 'music', year: 1977, why: 'Made while the band was falling apart, and you can hear it. Gorgeous, hook-filled songs that never went out of style.' },
  { title: 'Back to Black', creator: 'Amy Winehouse', type: 'music', year: 2006, why: 'Amy Winehouse\'s soulful, heartbroken classic. Vintage sound, modern feeling, not a wasted track.' },
  { title: 'good kid, m.A.A.d city', creator: 'Kendrick Lamar', type: 'music', year: 2012, why: 'A coming-of-age story set in Compton, told like a film. Acclaimed and surprisingly easy to get into.' },
  { title: 'Currents', creator: 'Tame Impala', type: 'music', year: 2015, why: 'A shimmering, synth-soaked break-up record. Dreamy and immediate at once.' },
  { title: 'Lemonade', creator: 'Beyoncé', type: 'music', year: 2016, why: 'A bold, genre-hopping song cycle about betrayal and resilience. Ambitious and widely adored.' },
  { title: 'Blonde', creator: 'Frank Ocean', type: 'music', year: 2016, why: 'A hazy, intimate masterpiece. Quiet and strange, and it grows on you fast.' },

  // ── Book ──────────────────────────────────────────────────────────────────
  { title: 'Normal People', creator: 'Sally Rooney', type: 'book', year: 2018, why: 'Two people who keep finding and losing each other through their twenties. Spare, exact, quietly addictive.' },
  { title: 'Never Let Me Go', creator: 'Kazuo Ishiguro', type: 'book', year: 2005, why: 'Three friends at a strange English boarding school slowly learn what their lives are for. Gentle, devastating, hard to forget.' },
  { title: 'The Kite Runner', creator: 'Khaled Hosseini', type: 'book', year: 2003, why: 'A friendship in Afghanistan and a betrayal that echoes for decades. An emotional, hugely popular page-turner.' },
  { title: 'Pachinko', creator: 'Min Jin Lee', type: 'book', year: 2017, why: 'Four generations of a Korean family making a life in Japan. A sweeping, deeply human saga.' },
  { title: 'The Road', creator: 'Cormac McCarthy', type: 'book', year: 2006, why: 'A father and son walk through a ruined world, keeping each other alive. Stark, tense, and unexpectedly tender.' },
  { title: 'Educated', creator: 'Tara Westover', type: 'book', year: 2018, why: 'A woman raised off-grid by survivalist parents fights her way to an education. A gripping, true-life story.' },

  // ── TV ────────────────────────────────────────────────────────────────────
  { title: 'Breaking Bad', creator: 'Vince Gilligan', type: 'tv', year: 2008, why: 'A mild-mannered teacher starts cooking meth and slowly transforms. Tense, addictive, widely called one of the best shows ever.' },
  { title: 'Succession', creator: 'Jesse Armstrong', type: 'tv', year: 2018, why: 'A media dynasty\'s grown children claw at each other for control. Vicious, funny, and impossible to stop watching.' },
  { title: 'Fleabag', creator: 'Phoebe Waller-Bridge', type: 'tv', year: 2016, why: 'Grief and bad decisions told straight to camera. Hilarious, then it quietly guts you.' },
  { title: 'The Bear', creator: 'Christopher Storer', type: 'tv', year: 2022, why: 'A fine-dining chef takes over his late brother\'s chaotic sandwich shop. Fast, anxious, and full of heart.' },
  { title: 'Chernobyl', creator: 'Craig Mazin', type: 'tv', year: 2019, why: 'A tense, meticulous retelling of the 1986 nuclear disaster and its cover-up. Bleak, gripping, superbly made.' },
  { title: 'Mad Men', creator: 'Matthew Weiner', type: 'tv', year: 2007, why: 'Ad men and women navigate ambition and reinvention in 1960s New York. Stylish, sharp, slow-burning.' },
]

const EDITORIAL_PICKS: DiscoveryResult[] = PICKS.map(p => ({ ...p, sources: ['editorial'] }))

export function editorialPicksFor(type: 'film' | 'book' | 'music' | 'tv'): DiscoveryResult[] {
  return EDITORIAL_PICKS.filter(p => p.type === type)
}
