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

// Skin gate (s118): on-model / lifestyle / mood-street shots leak a MODEL's skin tone into
// the ribbon — warm browns/tans that aren't the wardrobe's palette. We can't just filter
// flesh RGB: this user's signature palette (camel/tan/leather) sits right on top of skin in
// RGB, so a blunt gate would delete the exact colours she wants. Instead we build a
// "known-good" palette from the CLEAN packshot cutouts (a cutout is the bare garment on
// transparent — zero skin), then on the messy worn/mood shots we drop flesh-toned pixels
// ONLY when their colour isn't confirmed by a clean cutout. Skin (never in a cutout) goes;
// camel/leather (confirmed by a garment cutout) stays; a worn-only accessory keeps its
// colour minus the skin around it. Known gap: a tan item shot *only* on-model has no clean
// cutout to protect it, so it can get gated — rare, and the trigger to escalate.

export type Swatch = string // '#rrggbb'

// One board image to sample. `clean` marks a bare-garment cutout (transparent, no skin) —
// these anchor the known-good palette; everything else (worn/lifestyle/mood) is skin-gated.
export type BoardImage = { src: string; clean: boolean }

export type RGB = { r: number; g: number; b: number }
type Bucket = RGB & { n: number }

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

// Is this pixel a plausible flesh tone? The classic warm-skin rule (Kovac et al.):
// bright, red-dominant, and not too grey. Deliberately BROAD — it also catches
// camel/tan/leather, which is fine because the caller only drops a flesh hit when it
// ISN'T confirmed by a clean garment cutout (see the skin-gate note up top).
export function isSkin(r: number, g: number, b: number): boolean {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  return r > 95 && g > 40 && b > 20 && mx - mn > 15 && r - g > 15 && r > b
}

// Does this colour match one already confirmed by a clean cutout? Manhattan distance,
// same cheap metric the swatch merge uses.
export function nearKnownGood(r: number, g: number, b: number, palette: RGB[], thresh = 45): boolean {
  return palette.some(p => Math.abs(p.r - r) + Math.abs(p.g - g) + Math.abs(p.b - b) < thresh)
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
// taints the canvas. `skinGate` is the known-good palette from clean cutouts: when
// present (a worn/mood shot), flesh-toned pixels are dropped unless a clean cutout already
// confirmed that colour. Null (a clean cutout itself) → no gate, nothing to protect against.
async function imageColors(src: string, skinGate: RGB[] | null = null, top = 4): Promise<Bucket[]> {
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
      // Skin gate (worn/mood shots only): drop a flesh-toned pixel unless a clean cutout
      // already vouched for that colour (protects camel/tan/leather; sheds model skin).
      if (skinGate && isSkin(r, g, b) && !nearKnownGood(r, g, b, skinGate)) continue
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
 *
 * Two passes (see the skin-gate note up top): first the clean cutouts, whose colours
 * become the known-good palette; then the worn/mood shots, skin-gated against it.
 */
export async function sampleBoardColors(images: BoardImage[], max = 6): Promise<Swatch[]> {
  // De-dupe by src (a src is one image regardless of how it's tagged); if the same src
  // shows up both clean and worn, trust the clean flag. Cap the set so big boards stay snappy.
  const bySrc = new Map<string, boolean>()
  for (const im of images) {
    if (!im.src) continue
    bySrc.set(im.src, (bySrc.get(im.src) ?? false) || im.clean)
  }
  const uniq = [...bySrc.entries()].map(([src, clean]) => ({ src, clean })).slice(0, 16)
  if (uniq.length === 0) return []

  // Pass 1 — clean cutouts build the known-good palette (bare garment, zero skin).
  const cleanImages = uniq.filter(i => i.clean)
  const cleanColors = await Promise.all(cleanImages.map(i => imageColors(i.src)))
  const knownGood: RGB[] = cleanColors.flat().map(b => ({ r: b.r, g: b.g, b: b.b }))

  // Pass 2 — worn/mood shots, flesh-gated against that palette.
  const wornImages = uniq.filter(i => !i.clean)
  const wornColors = await Promise.all(wornImages.map(i => imageColors(i.src, knownGood)))

  const perImage = [...cleanColors, ...wornColors]

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
