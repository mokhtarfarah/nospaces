export type FeedKind = 'substack' | 'reddit' | 'rss'
export type FeedType = 'book' | 'music' | 'film' | 'tv' | 'cross'

export interface FeedEntry {
  url: string
  name: string
  types: FeedType[]
  kind: FeedKind
}

export interface DiscoveryResult {
  title: string
  creator: string | null
  type: 'film' | 'book' | 'music' | 'tv'
  year: number | null
  why: string
  source: string
}

export const DEFAULT_FEEDS: FeedEntry[] = [
  // Books
  { url: 'https://pandorasykes.substack.com/feed',         name: 'Pandora Sykes',         types: ['book', 'cross'], kind: 'substack' },
  { url: 'https://georgesaunders.substack.com/feed',       name: 'George Saunders',       types: ['book', 'cross'], kind: 'substack' },
  { url: 'https://jesswhitereadsbooks.substack.com/feed',  name: 'Jess White Reads Books',types: ['book'],          kind: 'substack' },
  { url: 'https://lithub.com/feed/',                       name: 'Literary Hub',          types: ['book'],          kind: 'rss'      },
  { url: 'https://www.themillions.com/feed',               name: 'The Millions',          types: ['book'],          kind: 'rss'      },
  { url: 'https://www.reddit.com/r/booksuggestions/top.rss?t=week', name: 'r/booksuggestions', types: ['book'], kind: 'reddit' },
  { url: 'https://www.reddit.com/r/literature/top.rss?t=week',      name: 'r/literature',      types: ['book'], kind: 'reddit' },
  { url: 'https://www.reddit.com/r/52books/top.rss?t=week',         name: 'r/52books',         types: ['book'], kind: 'reddit' },

  // Music
  { url: 'https://recordstore.substack.com/feed',          name: 'Record Store',      types: ['music'],          kind: 'substack' },
  { url: 'https://www.honest-broker.com/feed',             name: 'Honest Broker',     types: ['music', 'cross'], kind: 'substack' },
  { url: 'https://daily.bandcamp.com/feed/',               name: 'Bandcamp Daily',    types: ['music'],          kind: 'rss'      },
  { url: 'https://aquariumdrunkard.com/feed/',             name: 'Aquarium Drunkard', types: ['music'],          kind: 'rss'      },
  { url: 'https://pitchfork.com/rss/reviews/albums/',      name: 'Pitchfork',         types: ['music'],          kind: 'rss'      },
  { url: 'https://www.nme.com/feed',                       name: 'NME',               types: ['music'],          kind: 'rss'      },
  { url: 'https://www.reddit.com/r/ifyoulikeblank/top.rss?t=week', name: 'r/ifyoulikeblank', types: ['music'], kind: 'reddit' },
  { url: 'https://www.reddit.com/r/indieheads/top.rss?t=week',     name: 'r/indieheads',     types: ['music'], kind: 'reddit' },
  { url: 'https://www.reddit.com/r/vinyl/top.rss?t=week',          name: 'r/vinyl',          types: ['music'], kind: 'reddit' },

  // Film / TV
  { url: 'https://thereveal.substack.com/feed',            name: 'The Reveal',    types: ['film', 'cross'],     kind: 'substack' },
  { url: 'https://www.vulture.com/rss/all.xml',            name: 'Vulture',       types: ['film', 'tv', 'cross'],kind: 'rss'      },
  { url: 'https://www.rogerebert.com/feed',                name: 'Roger Ebert',   types: ['film'],              kind: 'rss'      },
  { url: 'https://www.filmcomment.com/feed/',              name: 'Film Comment',  types: ['film'],              kind: 'rss'      },
  { url: 'https://www.reddit.com/r/TrueFilm/top.rss?t=week',           name: 'r/TrueFilm',           types: ['film'], kind: 'reddit' },
  { url: 'https://www.reddit.com/r/Letterboxd/top.rss?t=week',         name: 'r/Letterboxd',         types: ['film'], kind: 'reddit' },
  { url: 'https://www.reddit.com/r/MovieSuggestions/top.rss?t=week',   name: 'r/MovieSuggestions',   types: ['film'], kind: 'reddit' },
  { url: 'https://www.reddit.com/r/televisionsuggestions/top.rss?t=week', name: 'r/televisionsuggestions', types: ['tv'], kind: 'reddit' },

  // Cross-type
  { url: 'https://mollyyoung.substack.com/feed',           name: 'Molly Young',      types: ['cross'], kind: 'substack' },
  { url: 'https://pattismith.substack.com/feed',           name: 'Patti Smith',      types: ['cross'], kind: 'substack' },
  { url: 'https://www.themarginalian.org/feed/',           name: 'The Marginalian',  types: ['cross'], kind: 'rss'      },
  { url: 'https://www.theguardian.com/culture/rss',        name: 'The Guardian',     types: ['cross'], kind: 'rss'      },
  { url: 'https://www.theatlantic.com/feed/all/',          name: 'The Atlantic',     types: ['cross'], kind: 'rss'      },
  { url: 'https://www.newyorker.com/feed/everything',      name: 'The New Yorker',   types: ['cross'], kind: 'rss'      },
]

// Returns feeds relevant to a given type. Cross feeds are always included.
// For 'all', returns the full list capped at 20 (prioritising Substacks for token quality).
export function feedsForType(type: FeedType | 'all', custom: FeedEntry[] = []): FeedEntry[] {
  const all = [...DEFAULT_FEEDS, ...custom]
  if (type === 'all') {
    const substacks = all.filter(f => f.kind === 'substack')
    const rest = all.filter(f => f.kind !== 'substack')
    return [...substacks, ...rest].slice(0, 20)
  }
  return all.filter(f => f.types.includes(type) || f.types.includes('cross'))
}

// Guess the kind from a URL so the add-feed UI can auto-label.
export function guessFeedKind(url: string): FeedKind {
  if (url.includes('reddit.com')) return 'reddit'
  if (url.includes('substack.com')) return 'substack'
  return 'rss'
}

// Normalise a user-pasted URL into a likely RSS endpoint.
export function normaliseFeedUrl(raw: string): string {
  const url = raw.trim().replace(/\/$/, '')
  if (url.includes('reddit.com') && !url.includes('.rss')) return `${url}.rss`
  if (url.includes('substack.com') && !url.endsWith('/feed')) return `${url}/feed`
  return url
}
