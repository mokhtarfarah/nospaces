// AI subject cutout for the Things board (s74).
//
// The board mixes photos from many shops, each staged its own way — a watch on a
// wood table, a coat on a grey sweep, a lamp in a styled room. The server-side trim
// (api/thing-image) re-frames them, but on staged/"lifestyle" shots it makes a
// box-in-box: the shop's own scenery shows through the tile and the set stops
// reading as one catalog. The fix is a real segmentation: cut the PRODUCT out and
// drop it, centred, on ONE warm-cream tile.
//
// Why this runs in the browser, not in api/: the cutout engine (@imgly) ships a
// ~40MB ONNX model and a WASM runtime — far past Vercel's 250MB serverless bundle
// limit. So it runs client-side at save, while the user is already waiting for the
// save to land (~2–4s), and we store only the finished PNG. The model is lazy-
// loaded (dynamic import) so it never touches first paint.
//
// Gating: only `product` (bare packshot) shots are cut — an `onModel` or
// `lifestyle` shot would shred (you'd cut the person out, or lose the context). The
// shot type comes free off the existing vision call (see api/_vision.ts), so there
// is no extra Anthropic spend. Cost: browser compute + Supabase Storage, both free.

import { supabase } from './supabase'

const BUCKET = 'thing-cutouts'

// The board fetches the cutout's pixels through OUR proxy (raw=1), which re-encodes
// the shop's photo and adds a permissive CORS header — without it the browser can't
// read the bytes to feed the model (retail CDNs CORS-block a direct cross-origin
// fetch, the same wall that forced the server-side trim).
function rawProxyUrl(src: string, referer?: string | null): string {
  const q = new URLSearchParams({ u: src, raw: '1' })
  if (referer) q.set('r', referer)
  return `/api/thing-image?${q.toString()}`
}

// Lazy-load the engine and cut the subject out → transparent PNG blob. The dynamic
// import keeps the 40MB model + WASM out of the main bundle; it downloads from
// imgly's CDN on first use only.
async function removeBg(input: Blob): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal')
  return removeBackground(input, {
    // fp16 is the ~40MB middle model — clean strap/edge detail without the full
    // isnet's heft. Quint8 is smaller but noticeably softer on fine edges.
    model: 'isnet_fp16',
    output: { format: 'image/png' },
  })
}

export type CutoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: string }

// Generate a cutout for one product photo and store it. Returns the public Storage
// URL (cache-busted) to save on the item, or a reason on failure. Never throws —
// the save still stands if the cutout can't be made.
export async function makeCutout(opts: {
  userId: string
  itemId: string
  image: string
  referer?: string | null
}): Promise<CutoutResult> {
  const { userId, itemId, image, referer } = opts
  try {
    // 1. Pull the original pixels through our CORS-enabled proxy.
    const resp = await fetch(rawProxyUrl(image, referer))
    if (!resp.ok) return { ok: false, reason: `proxy-${resp.status}` }
    const srcBlob = await resp.blob()

    // 2. Cut the subject out (the slow part — model download + inference).
    const png = await removeBg(srcBlob)

    // 3. Store it at a stable per-item path (upsert: re-polishing overwrites).
    const path = `${userId}/${itemId}.png`
    const { error } = await supabase.storage.from(BUCKET).upload(path, png, {
      contentType: 'image/png',
      upsert: true,
      cacheControl: '31536000',
    })
    if (error) return { ok: false, reason: `upload: ${error.message}` }

    // The public URL is path-stable, so a re-polish would otherwise be masked by the
    // browser/CDN cache — append a version stamp to bust it.
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'cutout-failed' }
  }
}
