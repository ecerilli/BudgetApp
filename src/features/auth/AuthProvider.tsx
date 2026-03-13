import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'
import { AuthContext, type AuthContextType } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Auth subscription — only tracks session, no DB calls here
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (!session) {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Fetch profile whenever user id changes — separated from auth callback to avoid deadlock
  useEffect(() => {
    const userId = session?.user?.id
    const userDisplayName = session?.user?.user_metadata?.display_name
    const userEmail = session?.user?.email
    if (!userId) return

    let cancelled = false

    async function fetchProfile() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId!)
          .single()

        if (cancelled) return

        if (error) {
          if (error.code === 'PGRST116') {
            // Profile may not exist if trigger didn't fire
            const { data: newProfile } = await supabase
              .from('profiles')
              .upsert({
                id: userId!,
                display_name: userDisplayName ?? userEmail,
              })
              .select()
              .single()
            if (!cancelled) setProfile((newProfile as Profile) ?? null)
            return
          }
          if (!cancelled) setProfile(null)
        } else {
          if (!cancelled) setProfile((data as Profile) ?? null)
        }
      } catch {
        if (!cancelled) setProfile(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    setLoading(true)
    fetchProfile()
    return () => { cancelled = true }
  }, [session?.user?.id, session?.user?.user_metadata?.display_name, session?.user?.email])

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }

  const value: AuthContextType = {
    session,
    user: session?.user ?? null,
    profile,
    householdId: profile?.household_id ?? null,
    loading,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

