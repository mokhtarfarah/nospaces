import sharp from 'sharp'

// Server-side port of src/lib/imageTrim.ts. Same idea — find the product in its
// field of whitespace, re-frame it to a target aspect, pad with the background —
// but run on OUR server, where (unlike the browser) CORS never blocks reading the
// pixels, so it works on every shop, not just the permissive ones. We also feed it
// a higher-res source (see upscaleUrl), which is what kills the soft-when-zoomed
// look. Pure pixel work, no AI.
//
// Returns null when there's nothing useful to do (no clear product, or it already
// fills the frame) so the caller can just serve the original.

// Ask a shop's CDN for a bigger original. Most retail images are Shopify-style,
// sized either by a `?width=` query or a `_<W>x<H>` filename suffix; bumping either
// gets us a crisp source to trim. Unknown patterns pass through untouched.
export function upscaleUrl(url: string, target = 1600): string {
  try {
    const u = new URL(url)
    if (u.searchParams.has('width')) {
      u.searchParams.set('width', String(target))
      u.searchParams.delete('height') // let it scale proportionally
      return u.toString()
    }
    // `_500x.jpg`, `_500x500.jpg`, `_500x500_crop_center.jpg` → `_1600x.jpg`
    const m = u.pathname.match(/_(\d+)x(\d*)(?=[._])/)
    if (m && Number(m[1]) < target) {
      u.pathname = u.pathname.replace(/_\d+x\d*(?=[._])/, `_${target}x`)
      return u.toString()
    }
    return url
  } catch {
    return url
  }
}

type RGB = [number, number, number]

// Find the product's bounding box + centroid on a small proxy of the image. Mirrors
// the client algorithm: sample the four corners to learn the background, then mark
// every pixel that differs from it as "product".
function detect(data: Buffer, SW: number, SH: number, channels: number) {
  const at = (x: number, y: number) => {
    const i = (y * SW + x) * channels
    return [data[i], data[i + 1], data[i + 2], channels === 4 ? data[i + 3] : 255] as const
  }
  const corners = [at(0, 0), at(SW - 1, 0), at(0, SH - 1), at(SW - 1, SH - 1)]
  const cornerAlpha = corners.reduce((s, c) => s + c[3], 0) / corners.length
  const transparent = cornerAlpha < 200
  const bg: RGB = transparent
    ? [255, 255, 255]
    : ([0, 1, 2].map(k => Math.round(corners.reduce((s, c) => s + c[k], 0) / corners.length)) as RGB)

  const TH = 38
  let minX = SW, minY = SH, maxX = 0, maxY = 0, hits = 0, sumX = 0, sumY = 0
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      const i = (y * SW + x) * channels
      const a = channels === 4 ? data[i + 3] : 255
      const isProduct = transparent
        ? a > 40
        : a > 20 && Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > TH
      if (isProduct) { hits++; sumX += x; sumY += y; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
    }
  }
  return { transparent, bg, minX, minY, maxX, maxY, hits, sumX, sumY }
}

// Trim `input` to `aspect`, padding with the detected background. Returns a JPEG
// buffer, or null when there's no clear product to crop to.
export async function trimToAspect(input: Buffer, aspect: number): Promise<Buffer | null> {
  const base = sharp(input, { failOn: 'none' }).rotate() // honour EXIF orientation
  const meta = await base.metadata()
  const NW = meta.width ?? 0, NH = meta.height ?? 0
  if (!NW || !NH) return null

  // Detect on a small proxy for speed (full-res only for the final crop).
  const SW = Math.min(220, NW)
  const SH = Math.max(1, Math.round(SW * NH / NW))
  const { data, info } = await base
    .clone()
    .resize(SW, SH, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const d = detect(data, info.width, info.height, info.channels)

  // Nothing clear to trim, or the subject already fills the frame → caller serves
  // the original (no point re-encoding it).
  if (d.hits < SW * SH * 0.004) return null
  if (d.maxX - d.minX + 1 >= SW * 0.94 && d.maxY - d.minY + 1 >= SH * 0.94) return null

  // Centre on the centroid (not the bbox centre) so a stray strap or shadow off to
  // one side doesn't drag the framing; size half-extents to still cover the whole
  // bbox from that centre, +8% breathing room.
  const ctxX = d.sumX / d.hits, ctxY = d.sumY / d.hits
  const hx = Math.max(ctxX - d.minX, d.maxX - ctxX) * 1.04
  const hy = Math.max(ctxY - d.minY, d.maxY - ctxY) * 1.04
  const cx = ctxX / SW * NW, cy = ctxY / SH * NH
  let cw = hx / SW * NW * 2, ch = hy / SH * NH * 2
  if (cw / ch > aspect) ch = cw / aspect; else cw = ch * aspect
  const rx = cx - cw / 2, ry = cy - ch / 2

  // The crop window can fall outside the image; extract the in-image part, then pad
  // the overhang with the background colour (extract→extend, all margins ≥ 0).
  const sx = Math.max(0, Math.round(rx)), sy = Math.max(0, Math.round(ry))
  const sx2 = Math.min(NW, Math.round(rx + cw)), sy2 = Math.min(NH, Math.round(ry + ch))
  const sw = sx2 - sx, sh = sy2 - sy
  if (sw <= 0 || sh <= 0) return null
  const left = Math.max(0, Math.round(sx - rx)), top = Math.max(0, Math.round(sy - ry))
  const right = Math.max(0, Math.round((rx + cw) - sx2)), bottom = Math.max(0, Math.round((ry + ch) - sy2))

  // Output res: cap at 1200w (retina-sharp for the card + hero, still cheap/fast).
  const OW = Math.max(320, Math.min(1200, Math.round(cw)))
  const [r, g, b] = d.bg
  return base
    .clone()
    .extract({ left: sx, top: sy, width: sw, height: sh })
    .extend({ top, bottom, left, right, background: { r, g, b } })
    // flatten BEFORE encoding: a transparent product PNG would otherwise have its
    // see-through pixels baked to black by JPEG — repaint them with the detected bg.
    .flatten({ background: { r, g, b } })
    // Scale by width only (no fit:'fill') so we never distort: the padded crop is
    // ~target aspect already, and the card's object-fit:cover absorbs any rounding
    // drift by cropping, not stretching.
    .resize({ width: OW })
    .jpeg({ quality: 88 })
    .toBuffer()
}
