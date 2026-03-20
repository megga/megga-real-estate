import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserProfile, UserRole } from '@/types/auth'
import { isAgentRole, isParticulierRole } from '@/types/auth'

export type { UserRole, UserProfile } from '@/types/auth'

// DEV_BYPASS: set to true to skip auth and use a mock user
const DEV_BYPASS_AUTH = false

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isAgent: boolean
  isParticulier: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithEmail: (email: string) => Promise<{ error: string | null }>
  signInWithGoogle: (role?: UserRole) => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string, role?: UserRole) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const MOCK_USER = {
  id: 'dev-mock-user',
  email: 'agent@megga.ch',
  user_metadata: { full_name: 'Gregory Lyonnet', role: 'agent' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
} as unknown as User

const MOCK_PROFILE: UserProfile = {
  id: 'dev-mock-user',
  email: 'agent@megga.ch',
  full_name: 'Gregory Lyonnet',
  role: 'agent',
  avatar_url: null,
  phone: null,
  agency_id: 'dev-mock-agency',
  created_at: '2026-01-01T00:00:00Z',
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      // Profile may not exist yet (first login, trigger pending)
      // or RLS may block — don't crash, just return null
      return null
    }
    return data as UserProfile
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(DEV_BYPASS_AUTH ? MOCK_PROFILE : null)
  const [loading, setLoading] = useState(DEV_BYPASS_AUTH ? false : true)

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null)
      return
    }
    const p = await fetchProfile(user.id)
    setProfile(p)
  }, [])

  useEffect(() => {
    if (DEV_BYPASS_AUTH) return

    // Safety timeout: if getSession hangs (lock conflicts), force loading to false
    const safetyTimeout = setTimeout(() => setLoading(false), 3000)

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      clearTimeout(safetyTimeout)
      setSession(s)
      if (s?.user) {
        const p = await fetchProfile(s.user.id)
        setProfile(p)
      }
      setLoading(false)
    }).catch(() => {
      clearTimeout(safetyTimeout)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      try {
        setSession(s)
        if (s?.user) {
          const p = await fetchProfile(s.user.id)
          setProfile(p)
        } else {
          setProfile(null)
        }
      } catch {
        // Ignore AbortError from lock conflicts between tabs
      } finally {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signInWithEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: error?.message ?? null }
  }, [])

  const signInWithGoogle = useCallback(async (role?: UserRole) => {
    // Store selected role before OAuth redirect — will be read by AuthCallbackPage
    if (role) {
      localStorage.setItem('megga_oauth_role', role)
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: error?.message ?? null }
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
    return { error: error?.message ?? null }
  }, [])

  const signUp = useCallback(async (email: string, password: string, fullName: string, role: UserRole = 'buyer') => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: error?.message ?? null }
  }, [])

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user ?? null)
  }, [session, loadProfile])

  const isAgent = profile ? isAgentRole(profile.role) : false
  const isParticulier = profile ? isParticulierRole(profile.role) : true

  return (
    <AuthContext.Provider
      value={{
        session,
        user: DEV_BYPASS_AUTH ? MOCK_USER : (session?.user ?? null),
        profile,
        loading,
        isAgent,
        isParticulier,
        signInWithPassword,
        signInWithEmail,
        signInWithGoogle,
        signUp,
        resetPassword,
        signOut: handleSignOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
