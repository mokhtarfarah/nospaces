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
import { thingImageRaw } from './thingImage'

const BUCKET = 'thing-cutouts'

// Bump when the cutout pipeline changes so the board can spot stale stored cutouts
// and offer a (free, no-AI) re-polish. v1 = untrimmed (product floated tiny in the
// shop's original framing); v2 = trimmed to the subject so it fills the tile.
export const CUTOUT_VERSION = 2

// The board fetches the cutout's pixels through OUR proxy (raw=1), which re-encodes
// the shop's photo and adds a permissive CORS header — without it the browser can't
// read the bytes to feed the model (retail CDNs CORS-block a direct cross-origin
// fetch, the same wall that forced the server-side trim).
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

// Crop the transparent margins off a cutout so the product fills its frame. The
// model returns a PNG the same size as the shop's photo — so a bag shot small in a
// big white frame stays small, swimming in empty space on the tile. We find the
// bounding box of the opaque (product) pixels and crop to it (+ a thin margin), so
// every product fills its tile the same, no matter how the shop framed it.
async function trimTransparent(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob)
  const { width: W, height: H } = bmp
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return blob
  ctx.drawImage(bmp, 0, 0)
  const data = ctx.getImageData(0, 0, W, H).data

  const ALPHA = 12 // ignore near-transparent halo pixels
  let minX = W, minY = H, maxX = -1, maxY = -1
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > ALPHA) {
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX) return blob // fully transparent → nothing to crop

  // A small uniform margin so the crop never kisses the edge.
  const m = Math.round(Math.max(maxX - minX, maxY - minY) * 0.03)
  const x0 = Math.max(0, minX - m), y0 = Math.max(0, minY - m)
  const x1 = Math.min(W - 1, maxX + m), y1 = Math.min(H - 1, maxY + m)
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1
  if (cw >= W && ch >= H) return blob // already tight

  const out = document.createElement('canvas')
  out.width = cw; out.height = ch
  out.getContext('2d')?.drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch)
  return new Promise<Blob>(resolve => out.toBlob(b => resolve(b ?? blob), 'image/png'))
}

export type CutoutResult =
  | { ok: true; url: string; version: number }
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
    // 1. Pull the original pixels through our CORS-enabled proxy (raw=1, untrimmed).
    const proxy = thingImageRaw(image, referer)
    if (!proxy) return { ok: false, reason: 'no-image' }
    const resp = await fetch(proxy)
    if (!resp.ok) return { ok: false, reason: `proxy-${resp.status}` }
    const srcBlob = await resp.blob()

    // 2. Cut the subject out (the slow part — model download + inference), then crop
    //    the transparent margins so the product fills its frame.
    const png = await trimTransparent(await removeBg(srcBlob))

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
    return { ok: true, url: `${data.publicUrl}?v=${Date.now()}`, version: CUTOUT_VERSION }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'cutout-failed'
    // The engine is lazy-loaded; right after a deploy its chunk can 404 (old page,
    // renamed file). main.tsx auto-reloads on that — so surface a calm, human reason
    // here instead of leaking a raw "Failed to fetch dynamically imported module …js".
    if (/dynamically imported module|importing a module script failed|failed to fetch/i.test(msg)) {
      return { ok: false, reason: 'the app just updated — try again' }
    }
    return { ok: false, reason: msg }
  }
}
