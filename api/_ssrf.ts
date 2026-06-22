// SSRF guard for server-side fetches of URLs that originate from user/request input
// (custom feed URLs, links pulled from forwarded emails, etc.). Without this an authed
// user — or anyone who can get content into the inbox — could point a fetch at internal
// or cloud-metadata addresses. Require http(s) and reject hosts that are loopback /
// private / link-local / non-routable. Literal-host check only — does not resolve DNS
// (a 2-user app; DNS rebinding is out of scope).
export function isSafePublicUrl(raw: string): boolean {
  let u: URL
  try { u = new URL(raw) } catch { return false }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '') // strip IPv6 brackets
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false
  // IPv6 loopback / link-local (fe80::) / unique-local (fc00::/7 → fc, fd)
  if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return false
  // IPv4 literal ranges: loopback, private, link-local, "this host", multicast/reserved
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const a = +m[1], b = +m[2]
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 169 && b === 254) return false        // link-local (incl. cloud metadata 169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a >= 224) return false                        // multicast / reserved
  }
  return true
}
