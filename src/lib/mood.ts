// Mood board (s76) — pure-inspiration images, the non-buyable companion to the
// wishlist. An image is stored two ways:
//   - an UPLOAD (file pick / clipboard paste) → we put the bytes in Supabase
//     Storage and keep the public URL (hosted: true), shown directly on the wall.
//   - a PASTED URL → we keep the web URL as-is (hosted: false) and show it through
//     the same /api/thing-image proxy products use, so a hotlink-protected source
//     still renders.
//
// Both kinds get one cheap vision read (palette/material/vibe) at save so the mood
// board feeds the board's taste thread alongside the saved wishlist. No cutout, no
// scrape — an inspiration image is lighter than a product. Storage is free.

import { supabase } from './supabase'
import { thingImageRaw } from './thingImage'

const BUCKET = 'mood-images'

// Cap the upload so a giant phone photo doesn't blow the bucket or the vision call.
const MAX_BYTES = 12 * 1024 * 1024 // 12MB

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
}

export type MoodUpload = { ok: true; url: string } | { ok: false; reason: string }

/**
 * Upload one inspiration image to Storage and return its public URL. Never throws —
 * the caller decides what to do with a failure. Path is per-user so RLS can scope
 * it; a random filename keeps two saves of the same picture distinct.
 */
export async function uploadMoodImage(userId: string, file: Blob): Promise<MoodUpload> {
  try {
    if (!file.type || !file.type.startsWith('image/')) return { ok: false, reason: 'not an image' }
    if (file.size > MAX_BYTES) return { ok: false, reason: 'image is too large (max 12MB)' }
    const ext = EXT_BY_TYPE[file.type] ?? 'jpg'
    const rand = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
    const path = `${userId}/${rand}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: '31536000',
    })
    if (error) return { ok: false, reason: error.message }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return { ok: true, url: data.publicUrl }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'upload failed' }
  }
}

/**
 * The src to render for a mood image. Our own uploads load straight from Storage;
 * a pasted web URL goes through the proxy (server-fetched + re-encoded) so a
 * hotlink-protected source still shows.
 */
export function moodSrc(image: string | null, hosted: boolean | undefined): string | null {
  if (!image) return null
  return hosted ? image : (thingImageRaw(image) ?? image)
}
