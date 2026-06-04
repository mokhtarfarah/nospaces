// Spotify integration helpers.
//
// Unlike Letterboxd (CSV only), Spotify has a real Web API. We use the
// Authorization Code flow with PKCE so the whole thing runs client-side —
// no Client Secret, no server function, no stored refresh token. The browser
// swaps the auth code for a short-lived access token, reads the user's Saved
// Albums, and saves them as `music` items.
//
// Mapping into Nospaces items:
//   first ever Spotify sync → status 'want_to'  (a backlog to triage)
//   later syncs (new saves) → status 'done'     (no reaction; user adds their own)
// Posters/blurbs resolve at display time via /api/art, so we only need
// title + artist + year here (the Spotify cover is stashed in metadata too).

export const SPOTIFY_SCOPE = 'user-library-read'
const VERIFIER_KEY = 'spotify_pkce_verifier'

export interface SpotifyAlbum {
  id: string
  title: string
  /** Primary artist(s), joined. */
  creator: string
  year: number | null
  coverUrl: string | null
  url: string | null
  /** ISO timestamp the album was saved on Spotify. */
  addedAt: string | null
}

/** A row ready to insert into the `items` table (minus user_id, filled in at save). */
export interface SpotifyInsert {
  title: string
  type: 'music'
  creator: string | null
  year: number | null
  status: 'want_to' | 'done'
  reaction: null
  source: 'manual'
  source_detail: 'spotify'
  date_added: string
  date_done: string | null
  metadata: Record<string, unknown>
}

// --- PKCE helpers (Web Crypto) ---

function base64url(bytes: Uint8Array): string {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomVerifier(): string {
  const bytes = new Uint8Array(64)
  crypto.getRandomValues(bytes)
  return base64url(bytes)
}

async function challengeFromVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

/**
 * Build the Spotify authorize URL and stash the PKCE verifier in sessionStorage
 * so it survives the redirect. The caller then sends the browser to the URL.
 */
export async function buildAuthUrl(clientId: string, redirectUri: string): Promise<string> {
  const verifier = randomVerifier()
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  const challenge = await challengeFromVerifier(verifier)
  const sp = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPE,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  return `https://accounts.spotify.com/authorize?${sp}`
}

/** Swap the returned auth code for an access token using the stored verifier. */
export async function exchangeCodeForToken(
  clientId: string,
  redirectUri: string,
  code: string,
): Promise<string> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!verifier) throw new Error('Missing PKCE verifier — start the connection again.')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    }),
  })
  sessionStorage.removeItem(VERIFIER_KEY)
  if (!res.ok) throw new Error('Spotify token exchange failed.')
  const data = await res.json()
  return data.access_token as string
}

// --- Saved albums ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAlbum(item: any): SpotifyAlbum {
  const album = item?.album ?? {}
  const release: string = album.release_date ?? ''
  const yearNum = parseInt(release.slice(0, 4), 10)
  return {
    id: album.id ?? '',
    title: album.name ?? '',
    creator: (album.artists ?? []).map((a: { name?: string }) => a.name).filter(Boolean).join(', '),
    year: isNaN(yearNum) ? null : yearNum,
    coverUrl: album.images?.[0]?.url ?? null,
    url: album.external_urls?.spotify ?? null,
    addedAt: item?.added_at ?? null,
  }
}

/** Fetch every saved album, following pagination. */
export async function fetchSavedAlbums(token: string): Promise<SpotifyAlbum[]> {
  const albums: SpotifyAlbum[] = []
  let url: string | null = 'https://api.spotify.com/v1/me/albums?limit=50'
  while (url) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error('Could not read your Spotify albums.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()
    for (const item of data.items ?? []) albums.push(toAlbum(item))
    url = (data.next as string | null) ?? null
  }
  return albums.filter(a => a.id && a.title)
}

// --- Build inserts ---

/** Stable dedupe key for an album: lowercased title + artist. */
export function albumKey(title: string, creator: string): string {
  // Fold accents to their base letters (é→e, í→i) before stripping, so
  // "Rosalía" and "Rosalia" produce the same key.
  const norm = (s: string) =>
    (s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${norm(title)}|${norm(creator)}`
}

export interface SpotifyBuildResult {
  inserts: SpotifyInsert[]
  /** Albums skipped because they already exist in the library. */
  skippedExisting: number
}

/**
 * Turn fetched albums into insert rows, deduped against the user's existing
 * music (by title+artist key) and against Spotify IDs already imported.
 *
 * `isFirstImport` decides the status for the whole batch: the very first sync
 * lands everything as 'want_to' (a backlog), every sync after that adds only
 * the new saves as 'done'.
 */
export function buildSpotifyInserts(
  albums: SpotifyAlbum[],
  existingKeys: Set<string>,
  existingSpotifyIds: Set<string>,
  isFirstImport: boolean,
): SpotifyBuildResult {
  const status = isFirstImport ? 'want_to' : 'done'
  const byKey = new Map<string, SpotifyInsert>()
  let skippedExisting = 0
  const now = new Date().toISOString()

  for (const a of albums) {
    const key = albumKey(a.title, a.creator)
    if (existingKeys.has(key) || existingSpotifyIds.has(a.id) || byKey.has(key)) {
      skippedExisting++
      continue
    }
    byKey.set(key, {
      title: a.title,
      type: 'music',
      creator: a.creator || null,
      year: a.year,
      status,
      reaction: null,
      source: 'manual',
      source_detail: 'spotify',
      date_added: a.addedAt ?? now,
      date_done: status === 'done' ? (a.addedAt ?? now) : null,
      metadata: {
        spotifyId: a.id,
        ...(a.url ? { spotifyUrl: a.url } : {}),
        ...(a.coverUrl ? { coverUrl: a.coverUrl } : {}),
      },
    })
  }

  return { inserts: [...byKey.values()], skippedExisting }
}
