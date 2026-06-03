import { createClient } from '@supabase/supabase-js'
import type { VercelRequest } from '@vercel/node'

const cleanEnv = (s: string | undefined) => (s ?? '').replace(/[^\x20-\x7E]/g, '').trim()

let _client: ReturnType<typeof createClient> | null = null
function client() {
  if (!_client) _client = createClient(cleanEnv(process.env.SUPABASE_URL), cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY))
  return _client
}

export async function requireAuth(req: VercelRequest): Promise<boolean> {
  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) return false
  try {
    const { error } = await client().auth.getUser(auth.slice(7))
    return !error
  } catch {
    return false
  }
}
