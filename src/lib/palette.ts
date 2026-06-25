// The taste page's colour story — sample the board's recurring hues for an editorial
// swatch ribbon. Pure browser: each image is drawn tiny on a canvas, its pixels
// quantised, and the dominant colours aggregated across the set into a short ribbon.
//
// Reading canvas pixels needs CORS for cross-origin images: our Supabase uploads send
// it and the product/pasted-image proxy is same-origin, so most images read fine. Any
// image that taints the canvas is simply skipped — graceful: a few less swatches,
// never a broken ribbon. Near-white (product/tile backgrounds) and near-black pixels
// are dropped so the story is real colour, not packaging.

export type Swatch = string // '#rrggbb'

type Bucket = { r: number; g: number; b: number; n: number }

// Quantise an RGB triple into one of 6×6×6 coarse buckets so near-identical pixels
// collapse together before we count them.
function bucketKey(r: number, g: number, b: number): number {
  const q = (c: number) => Math.min(5, Math.floor(c / 43))
  return q(r) * 36 + q(g) * 6 + q(b)
}

function hex(r: number, g: number, b: number): string {
  const h = (c: number) => Math.round(c).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

// Manhattan distance in RGB — cheap enough for merging a handful of swatches.
function dist(a: Bucket, b: Bucket): number {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b)
}

// Hue angle (0–360) for ordering the ribbon like a designed palette, not a frequency list.
function hue(r: number, g: number, b: number): number {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  if (d === 0) return 0
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  return h < 0 ? h + 360 : h
}

// The dominant colours of one image (averaged per bucket), or [] if it won't load /
// taints the canvas.
async function imageColors(src: string, top = 4): Promise<Bucket[]> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.decoding = 'async'
  const loaded = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = src
  })
  if (!loaded) return []
  const S = 28
  const canvas = document.createElement('canvas')
  canvas.width = S; canvas.height = S
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []
  try {
    ctx.drawImage(img, 0, 0, S, S)
    const data = ctx.getImageData(0, 0, S, S).data
    const buckets = new Map<number, Bucket>()
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
      if (a < 200) continue
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
      if (mn > 232) continue // near-white background
      if (mx < 18) continue  // near-black
      const key = bucketKey(r, g, b)
      const e = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 }
      e.r += r; e.g += g; e.b += b; e.n++
      buckets.set(key, e)
    }
    return [...buckets.values()]
      .map(e => ({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n, n: e.n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, top)
  } catch {
    return [] // tainted canvas (no CORS) — skip this image
  }
}

/**
 * Sample up to `max` recurring colours across a board's images, ordered by hue.
 * Caps the number of images sampled so a big board stays snappy. Returns [] if
 * nothing readable — the caller hides the ribbon rather than show a stub.
 */
export async function sampleBoardColors(srcs: string[], max = 6): Promise<Swatch[]> {
  const uniq = [...new Set(srcs.filter(Boolean))].slice(0, 16)
  if (uniq.length === 0) return []
  const perImage = await Promise.all(uniq.map(s => imageColors(s)))

  // Aggregate across images, merging colours that are close enough to read as one.
  const agg: Bucket[] = []
  for (const colors of perImage) {
    for (const c of colors) {
      const hit = agg.find(a => dist(a, c) < 60)
      if (hit) {
        const tn = hit.n + c.n
        hit.r = (hit.r * hit.n + c.r * c.n) / tn
        hit.g = (hit.g * hit.n + c.g * c.n) / tn
        hit.b = (hit.b * hit.n + c.b * c.n) / tn
        hit.n = tn
      } else {
        agg.push({ ...c })
      }
    }
  }

  return agg
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map(c => ({ c, h: hue(c.r, c.g, c.b) }))
    .sort((a, b) => a.h - b.h)
    .map(({ c }) => hex(c.r, c.g, c.b))
}
