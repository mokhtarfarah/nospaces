import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { verifyUndo } from './_undo.js'

const cleanEnv = (s: string | undefined) => (s ?? '').replace(/[^\x20-\x7E]/g, '').trim()
const supabase = createClient(
  cleanEnv(process.env.SUPABASE_URL),
  cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY),
)

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// A tiny self-contained page — inline styles only, no assets, works in any mail
// client's in-app browser.
function page(heading: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Nospaces</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#faf8f5;color:#1a1a1a">
<div style="max-width:420px;margin:15vh auto;padding:0 24px;text-align:center">
<div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#9a9a9a;margin-bottom:24px">Nospaces</div>
<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${heading}</h1>
${bodyHtml}
</div></body></html>`
}

// GET renders a confirmation page with a POST button; POST performs the delete.
// The two-step (GET shows, POST acts) is deliberate: mail clients and security
// scanners routinely PREFETCH links, and a destructive GET would let a scanner
// silently undo a save. Scanners don't POST, so the item is only removed on a
// real button click.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  const token = ((req.query?.t as string | undefined) ?? (req.body?.t as string | undefined) ?? '').trim()
  const p = verifyUndo(token, Date.now())
  if (!p) {
    return res.status(400).send(page('Link expired',
      `<p style="color:#666;line-height:1.5">This undo link is invalid or has expired. Nothing was changed — open the app to edit or remove the item yourself.</p>`))
  }

  const label = escapeHtml(p.l || 'that item')
  const moreN = (p.n ?? p.i.length) - 1
  const more = moreN > 0 ? ` <span style="color:#9a9a9a">+ ${moreN} more</span>` : ''

  if (req.method !== 'POST') {
    return res.status(200).send(page('Undo this save?', `
<p style="color:#333;line-height:1.5;margin-bottom:28px">Remove <strong>${label}</strong>${more} from Nospaces?</p>
<form method="POST" action="/api/undo?t=${encodeURIComponent(token)}" style="margin:0">
<button type="submit" style="appearance:none;border:0;border-radius:12px;background:#1a1a1a;color:#fff;font-size:16px;font-weight:600;padding:14px 32px;cursor:pointer">Remove ${moreN > 0 ? 'them' : 'it'}</button>
</form>
<p style="color:#9a9a9a;font-size:13px;margin-top:20px">You can always add ${moreN > 0 ? 'them' : 'it'} back later.</p>`))
  }

  // POST → delete, scoped to the signed user + the exact ids the token names.
  // Cap the id count defensively even though signUndo controls what's minted.
  const ids = p.i.slice(0, 25)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('items').delete().in('id', ids).eq('user_id', p.u).select('id')
  if (error) {
    console.error('[undo] delete failed:', error.message)
    return res.status(500).send(page('Something went wrong',
      `<p style="color:#666;line-height:1.5">Couldn't remove ${label} just now — please try again, or remove it in the app.</p>`))
  }
  const n = (data ?? []).length
  return res.status(200).send(page(n > 0 ? 'Removed' : 'Already gone',
    n > 0
      ? `<p style="color:#333;line-height:1.5">Removed ${n} item${n > 1 ? 's' : ''} from Nospaces. ↩</p>`
      : `<p style="color:#666;line-height:1.5">That ${moreN > 0 ? 'set was' : 'item was'} already removed — nothing left to undo.</p>`))
}
