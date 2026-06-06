import { createClient } from '@supabase/supabase-js'

const _ce = (s: string | undefined) => (s ?? '').replace(/[^\x20-\x7E]/g, '').trim()
let _sba: ReturnType<typeof createClient> | null = null
const _ac = () => {
  if (!_sba) _sba = createClient(_ce(process.env.SUPABASE_URL), _ce(process.env.SUPABASE_SERVICE_ROLE_KEY))
  return _sba
}

/** Returns the authenticated user's ID, or null if unauthenticated. */
export async function getAuthUserId(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const { data, error } = await _ac().auth.getUser(authHeader.slice(7))
    if (error || !data.user) return null
    return data.user.id
  } catch {
    return null
  }
}

/**
 * Increments the call count for this user+endpoint in the current UTC hour,
 * then returns whether the call is allowed (count <= limitPerHour).
 * Fails open on DB errors so a Supabase hiccup doesn't block legitimate use.
 */
export async function checkRateLimit(userId: string, endpoint: string, limitPerHour: number): Promise<boolean> {
  const window = new Date().toISOString().slice(0, 13) // "2026-06-05T14"
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (_ac().rpc as any)('check_rate_limit', {
      p_user_id: userId,
      p_endpoint: endpoint,
      p_window: window,
      p_limit: limitPerHour,
    })
    if (error) return true // fail open
    return (data as number) <= limitPerHour
  } catch {
    return true // fail open
  }
}
