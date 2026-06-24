// Auto-trim a product photo out of its background and re-frame it to a target
// aspect, so a board of photos from many different shops reads at a CONSISTENT
// product size — the Bottega bag stops being a speck in a grey field, the hoops on
// white stop being a tiny pair in a big margin. Pure client-side canvas.
//
// Returns a cropped data URL, or null when it can't help: a CORS-tainted image
// (the shop's CDN won't let us read its pixels), or no clear product to trim (a
// busy model shot that already fills the frame). The caller falls back to showing
// the original, cover-cropped to the same aspect — still uniform, just not zoomed.

const cache = new Map<string, Promise<string | null>>()

export function trimToAspect(src: string, aspect: number): Promise<string | null> {
  const key = `${aspect}|${src}`
  const hit = cache.get(key)
  if (hit) return hit
  const p = load(src, aspect)
  cache.set(key, p)
  return p
}

function load(src: string, aspect: number): Promise<string | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = () => resolve(null)
    img.onload = () => {
      try { resolve(compute(img, aspect)) }
      catch { resolve(null) } // tainted canvas → can't read pixels
    }
    img.src = src
  })
}

function compute(img: HTMLImageElement, aspect: number): string | null {
  const NW = img.naturalWidth, NH = img.naturalHeight
  if (!NW || !NH) return null

  // Detect on a small proxy for speed (full-res only for the final crop).
  const SW = Math.min(220, NW)
  const SH = Math.max(1, Math.round(SW * NH / NW))
  const dc = document.createElement('canvas')
  dc.width = SW; dc.height = SH
  const dctx = dc.getContext('2d', { willReadFrequently: true })
  if (!dctx) return null
  dctx.drawImage(img, 0, 0, SW, SH)
  const data = dctx.getImageData(0, 0, SW, SH).data // throws if CORS-tainted

  // Sample the four corners → is the background transparent or a solid colour?
  const at = (x: number, y: number) => { const i = (y * SW + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]] as const }
  const corners = [at(0, 0), at(SW - 1, 0), at(0, SH - 1), at(SW - 1, SH - 1)]
  const cornerAlpha = corners.reduce((s, c) => s + c[3], 0) / corners.length
  const transparent = cornerAlpha < 200
  const bg = transparent ? [255, 255, 255] : [0, 1, 2].map(k => Math.round(corners.reduce((s, c) => s + c[k], 0) / corners.length))

  // Bounding box of "product" pixels (differ from background) AND their centroid.
  // We centre the crop on the centroid, not the bbox centre, so a thin strap or a
  // drop-shadow off to one side doesn't drag the framing off-centre.
  const TH = 38
  let minX = SW, minY = SH, maxX = 0, maxY = 0, hits = 0, sumX = 0, sumY = 0
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      const i = (y * SW + x) * 4
      const a = data[i + 3]
      const isProduct = transparent
        ? a > 40
        : a > 20 && Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > TH
      if (isProduct) { hits++; sumX += x; sumY += y; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
    }
  }

  // Nothing clear to trim, or the subject already fills the frame → let the caller
  // just cover-crop the original (no point re-encoding it).
  if (hits < SW * SH * 0.004) return null
  if (maxX - minX + 1 >= SW * 0.94 && maxY - minY + 1 >= SH * 0.94) return null

  // Centre on the centroid (in proxy px), and size the half-extents to still cover
  // the whole bounding box from that centre — so nothing gets clipped.
  const ctxX = sumX / hits, ctxY = sumY / hits
  const hx = Math.max(ctxX - minX, maxX - ctxX) * 1.08 // +8% breathing room
  const hy = Math.max(ctxY - minY, maxY - ctxY) * 1.08
  // To natural px.
  const cx = ctxX / SW * NW, cy = ctxY / SH * NH
  let cw = hx / SW * NW * 2, ch = hy / SH * NH * 2
  if (cw / ch > aspect) ch = cw / aspect; else cw = ch * aspect
  const rx = cx - cw / 2, ry = cy - ch / 2

  // Render padding-filled with the background. Don't upscale past the source crop's
  // own resolution (that's what made tight zooms look soft) — cap output to it.
  const OW = Math.max(160, Math.min(640, Math.round(cw)))
  const OH = Math.round(OW / aspect)
  const oc = document.createElement('canvas')
  oc.width = OW; oc.height = OH
  const octx = oc.getContext('2d')
  if (!octx) return null
  octx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`
  octx.fillRect(0, 0, OW, OH)

  // Clamp the source rect to the image, place it proportionally in the output.
  const scale = OW / cw
  const sx = Math.max(0, rx), sy = Math.max(0, ry)
  const sx2 = Math.min(NW, rx + cw), sy2 = Math.min(NH, ry + ch)
  const sw = sx2 - sx, sh = sy2 - sy
  if (sw <= 0 || sh <= 0) return null
  octx.drawImage(img, sx, sy, sw, sh, (sx - rx) * scale, (sy - ry) * scale, sw * scale, sh * scale)
  return oc.toDataURL('image/jpeg', 0.92)
}
