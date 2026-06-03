import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
const _ce = (s: string | undefined) => (s ?? '').replace(/[^\x20-\x7E]/g, '').trim()
let _sba: ReturnType<typeof createClient> | null = null
const _ac = () => { if (!_sba) _sba = createClient(_ce(process.env.SUPABASE_URL), _ce(process.env.SUPABASE_SERVICE_ROLE_KEY)); return _sba }
async function requireAuth(req: VercelRequest): Promise<boolean> { const a = req.headers['authorization']; if (!a?.startsWith('Bearer ')) return false; try { const { error } = await _ac().auth.getUser(a.slice(7)); return !error } catch { return false } }

// Turns a typed place ("barcelona", "berlin, de") into a clean label + lat/lng,
// so custom cities can be distance-filtered like the built-in ones. Uses
// OpenStreetMap's Nominatim — free, no API key. Proxied server-side so we can
// send the required User-Agent and cache results.
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!await requireAuth(req)) return res.status(401).end()
  const q = one(req.query.q).trim()
  if (!q) return res.status(400).json({ error: 'missing q' })

  const url =
    'https://nominatim.openstreetmap.org/search' +
    `?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`

  try {
    const data = await (await fetch(url, {
      headers: { 'User-Agent': 'Nospaces/1.0 (https://nospaces.vercel.app; farahmokhtar94@gmail.com)' },
    })).json()

    const hit = Array.isArray(data) ? data[0] : null
    if (!hit) return res.json({ result: null })

    const a = hit.address ?? {}
    const place = a.city || a.town || a.village || a.municipality || a.county || a.state || hit.name || q
    const label = [place, a.country].filter(Boolean).join(', ')
    const lat = parseFloat(hit.lat)
    const lng = parseFloat(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.json({ result: null })

    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate') // 7d
    return res.json({ result: { name: label, lat, lng } })
  } catch {
    return res.json({ result: null })
  }
}
