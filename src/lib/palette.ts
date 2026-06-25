// The taste page's colour story — sample the board's recurring hues for an editorial
// swatch ribbon. Pure browser: each image is drawn tiny on a canvas, its pixels
// quantised, and the dominant colours aggregated across the set into a short ribbon.
//
// Reading canvas pixels needs CORS for cross-origin images: our Supabase uploads send
// it and the product/pasted-image proxy is same-origin, so most images read fine. Any
// image that taints the canvas is simply skipped — graceful: a few less swatches,
// never a broken ribbon. The backdrop is found by sampling the image border (a product
// sits centred) and dropped by colour — so white, grey, AND cream/kraft backdrops all go,
// while a cream or grey *product* in the middle survives. Full-bleed shots with no clear
// border fall back to dropping chromatically neutral pixels.

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

// Estimate the backdrop colour by sampling the image's border. A product sits centred,
// so the frame's edge pixels are almost always background — whatever its colour (white,
// grey, cream, kraft). Returns the average edge colour only if the edge is *consistent*;
// if the edges disagree (a full-bleed shot where the product reaches the frame), returns
// null so the caller falls back to the neutral-colour drop rather than eating the product.
function borderColor(data: Uint8ClampedArray, S: number): { r: number; g: number; b: number } | null {
  const px: Array<[number, number, number]> = []
  const take = (x: number, y: number) => {
    const i = (y * S + x) * 4
    if (data[i + 3] >= 200) px.push([data[i], data[i + 1], data[i + 2]])
  }
  for (let x = 0; x < S; x++) { take(x, 0); take(x, S - 1) }
  for (let y = 1; y < S - 1; y++) { take(0, y); take(S - 1, y) }
  if (px.length < 8) return null
  let r = 0, g = 0, b = 0
  for (const [pr, pg, pb] of px) { r += pr; g += pg; b += pb }
  const n = px.length
  const mr = r / n, mg = g / n, mb = b / n
  let spread = 0
  for (const [pr, pg, pb] of px) spread += Math.abs(pr - mr) + Math.abs(pg - mg) + Math.abs(pb - mb)
  if (spread / n > 36) return null // edges disagree → not a clean backdrop
  return { r: mr, g: mg, b: mb }
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
    const bg = borderColor(data, S)
    const buckets = new Map<number, Bucket>()
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
      if (a < 200) continue // transparent (e.g. an AI cutout) — already background-free
      if (bg) {
        // Backdrop located at the border — drop pixels matching it, whatever its colour.
        // A cream *product* in the centre survives; a cream *backdrop* doesn't.
        if (Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b) < 50) continue
      } else {
        // No clean backdrop (full-bleed shot) — fall back to dropping chromatically
        // neutral pixels (grey/white/black, channels nearly equal); tilted tones survive.
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
        if (mx - mn < 10) continue
      }
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
