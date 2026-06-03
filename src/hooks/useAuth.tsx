import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// Read from VITE_ALLOWED_EMAILS env var (comma-separated). If not set, empty
// array = allow everyone (dev mode). Set in Vercel to lock down production.
const ALLOWED_EMAILS: string[] = (import.meta.env.VITE_ALLOWED_EMAILS ?? '')
  .split(',').map((e: string) => e.trim()).filter(Boolean)

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const user = session?.user ?? null

  // Block access if the signed-in email isn't in the allowlist.
  // During development, ALLOWED_EMAILS is empty so everyone can log in.
  const isAllowed =
    ALLOWED_EMAILS.length === 0 ||
    (user?.email != null && ALLOWED_EMAILS.includes(user.email))

  return (
    <AuthContext.Provider value={{ session: isAllowed ? session : null, user: isAllowed ? user : null, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
