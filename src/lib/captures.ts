// The "email captures" feed.
//
// Forwarded emails that produced NO new library items are logged server-side by
// /api/email into the `email_captures` table (successful captures are not — they
// already appear as items in the "for review" inbox). This module reads that log
// so the in-app feed can show forwards that fell through instead of letting them
// vanish silently.

import { supabase } from './supabase'

export type CaptureOutcome = 'nothing_found' | 'duplicates' | 'error'

export type EmailCapture = {
  id: string
  from_email: string | null
  subject: string | null
  outcome: CaptureOutcome
  saved_count: number
  detail: string | null
  snippet: string | null
  created_at: string
}

/** A capture the user should actually look at (a genuine miss/failure). */
export function isFailure(c: EmailCapture): boolean {
  return c.outcome === 'nothing_found' || c.outcome === 'error'
}

/**
 * Whether a capture came from the Things (product) path rather than media, so the
 * board can surface its own failed forwards. We tag by the detail strings the
 * server writes for the things routes ("could not read product link", "no link in
 * things email", "thing already on board"). Media misses ("no media found…") don't
 * match, so they stay on the Library side.
 */
export function isThingsCapture(c: EmailCapture): boolean {
  return /product link|things? email|on (your )?board/i.test(c.detail ?? '')
}

/** Fetch recent capture log rows for the signed-in user, newest first. */
export async function fetchCaptures(limit = 30): Promise<EmailCapture[]> {
  // The table isn't in the generated Database types, so query loosely.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('email_captures')
    .select('id, from_email, subject, outcome, saved_count, detail, snippet, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[captures] fetch failed:', error.message)
    return []
  }
  return (data ?? []) as EmailCapture[]
}

/** Clear a single capture by id (RLS scopes the delete to the owner). */
export async function clearCapture(id: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('email_captures')
    .delete()
    .eq('id', id)
  if (error) {
    console.error('[captures] clear-one failed:', error.message)
    return false
  }
  return true
}

/** Clear the whole capture log for the signed-in user. Returns false on failure. */
export async function clearCaptures(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('email_captures')
    .delete()
    .eq('user_id', user.id)
  if (error) {
    console.error('[captures] clear failed:', error.message)
    return false
  }
  return true
}
