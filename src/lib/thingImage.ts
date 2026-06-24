// Point a product photo at our server-side trim+proxy endpoint (api/thing-image).
// The server fetches a high-res original, crops it to the product, and re-frames it
// to `aspect` — so a board of photos from many shops reads at one consistent size,
// sharp at any zoom. Replaces the old client-canvas trim (src/lib/imageTrim), which
// CORS blocked on most shops.
//
// `referer` is the product page URL when we have it — some CDNs hotlink-protect and
// 403 unless the request looks like it came from their own page.
// The trimmed images are edge-cached immutable (keyed by this whole URL), so when
// the trim ALGORITHM changes the old crops would otherwise stick around forever.
// Bump this version on any change to api/_imageTrim.ts to mint fresh URLs that miss
// the stale cache and re-trim with the new code.
const TRIM_VERSION = '2'

export function thingImage(src: string | null | undefined, aspect = 4 / 5, referer?: string | null): string | null {
  if (!src) return null
  const q = new URLSearchParams({ u: src, a: aspect.toFixed(4), v: TRIM_VERSION })
  if (referer) q.set('r', referer)
  return `/api/thing-image?${q.toString()}`
}

// The UNTRIMMED proxy (raw=1): the original photo, server-fetched (no hotlink 403)
// and re-encoded, with NO crop/trim. Used to show model/lifestyle shots floated on
// the board's tile — the trim bakes a background colour into the image, which would
// re-box against the tile, so for "photo on a tile" we want the clean original.
export function thingImageRaw(src: string | null | undefined, referer?: string | null): string | null {
  if (!src) return null
  const q = new URLSearchParams({ u: src, raw: '1' })
  if (referer) q.set('r', referer)
  return `/api/thing-image?${q.toString()}`
}
