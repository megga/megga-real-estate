import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserProfile, UserRole } from '@/types/auth'
import { isAgentRole, isParticulierRole } from '@/types/auth'

export type { UserRole, UserProfile } from '@/types/auth'

// DEV_BYPASS: active uniquement en dev ET si VITE_DEV_BYPASS_AUTH=true dans .env.local
// Ne jamais activer en prod — même si la constante est forcée, ce check empêche l'app de démarrer.
const DEV_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

if (DEV_BYPASS_AUTH && import.meta.env.PROD) {
  throw new Error('[SECURITY] DEV_BYPASS_AUTH ne peut pas être actif en production.')
}

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isAgent: boolean
  isParticulier: boolean
  signInWithPassword: (email: string, password: string, captchaToken?: string) => Promise<{ error: string | null }>
  signInWithEmail: (email: string, captchaToken?: string) => Promise<{ error: string | null }>
  signInWithGoogle: (role?: UserRole) => Promise<{ error: string | null }>
  signInWithMicrosoft: (role?: UserRole) => Promise<{ error: string | null }>
  signInWithFacebook: (role?: UserRole) => Promise<{ error: string | null }>
  resetPassword: (email: string, captchaToken?: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string, role?: UserRole, captchaToken?: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Device detection — fire-and-forget, called once per sign-in.
// Sends the user's access_token + client-side fingerprint hints so the
// Edge Function can decide whether to alert the user by email.
async function reportDevice(accessToken: string) {
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-new-device`
    await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screen: `${window.screen.width}x${window.screen.height}`,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      // Don't block the login UX if the network is slow/offline
      signal: AbortSignal.timeout(8000),
    })
  } catch { /* silent — security telemetry must never break login */ }
}

// Rôle mock par défaut = 'agent' (le plus sûr). Pour tester super_admin en dev,
// set VITE_DEV_BYPASS_ROLE=super_admin dans .env.local
const MOCK_ROLE = (import.meta.env.VITE_DEV_BYPASS_ROLE as UserRole | undefined) ?? 'agent'

const MOCK_USER = {
  id: 'dev-mock-user',
  email: 'agent@megga.ch',
  user_metadata: { full_name: 'Gregory Lyonnet', role: MOCK_ROLE },
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
} as unknown as User

const MOCK_PROFILE: UserProfile = {
  id: 'dev-mock-user',
  email: 'agent@megga.ch',
  full_name: 'Gregory Lyonnet',
  role: MOCK_ROLE,
  avatar_url: null,
  phone: null,
  canton: 'GE',
  agency_id: 'dev-mock-agency',
  created_at: '2026-01-01T00:00:00Z',
  onboarding_completed: true,
  onboarding_step: 3,
  first_day_done: true,
}

async function fetchProfile(userId: string, user?: User | null, retry = true): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, agency_id, email, full_name, avatar_url, role, phone, canton, created_at, onboarding_completed, onboarding_step, first_day_done')
      .eq('id', userId)
      .single()
    if (error || !data) {
      // Profile may not exist yet (first login, trigger pending)
      // Retry once after 500ms to handle race condition
      if (retry) {
        await new Promise((r) => setTimeout(r, 500))
        return fetchProfile(userId, user, false)
      }
      // Fallback: build a minimal profile from user_metadata so routing works
      if (user) {
        const meta = user.user_metadata ?? {}
        return {
          id: userId,
          email: user.email ?? '',
          full_name: meta.full_name ?? meta.name ?? '',
          role: (meta.role as UserProfile['role']) ?? 'particulier',
          avatar_url: meta.avatar_url ?? null,
          phone: null,
          canton: null,
          agency_id: null,
          created_at: user.created_at ?? new Date().toISOString(),
          onboarding_completed: false,
          onboarding_step: 0,
          first_day_done: false,
        } as UserProfile
      }
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
    const p = await fetchProfile(user.id, user)
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
        const p = await fetchProfile(s.user.id, s.user)
        setProfile(p)
      }
      setLoading(false)
    }).catch(() => {
      clearTimeout(safetyTimeout)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      try {
        setSession(s)
        if (s?.user) {
          const p = await fetchProfile(s.user.id, s.user)
          setProfile(p)
          // Fire-and-forget device detection on sign-in (not on every token refresh)
          if (event === 'SIGNED_IN') {
            void reportDevice(s.access_token)
          }
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

  const signInWithPassword = useCallback(async (email: string, password: string, captchaToken?: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    })
    if (error) return { error: error.message }

    // Fix role mismatch: if user_metadata has a role but profile still has default
    const metaRole = data.user?.user_metadata?.role as UserRole | undefined
    if (data.user && metaRole && ['agent', 'manager', 'admin', 'assistant'].includes(metaRole)) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
      if (prof && (prof.role === 'buyer' || prof.role === 'particulier') && prof.role !== metaRole) {
        await supabase.from('profiles').update({ role: metaRole }).eq('id', data.user.id)
      }
    }

    return { error: null }
  }, [])

  const signInWithEmail = useCallback(async (email: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        ...(captchaToken ? { captchaToken } : {}),
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

  const signInWithFacebook = useCallback(async (role?: UserRole) => {
    if (role) {
      localStorage.setItem('megga_oauth_role', role)
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: error?.message ?? null }
  }, [])

  const signInWithMicrosoft = useCallback(async (role?: UserRole) => {
    // Store selected role before OAuth redirect — same pattern as Google.
    // Supabase refers to Microsoft/Outlook as the 'azure' provider internally.
    if (role) {
      localStorage.setItem('megga_oauth_role', role)
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        // openid + email + profile are the standard login scopes; we explicitly
        // skip offline_access here because we're not asking for Calendar access
        // at login time (that's handled separately in Settings → Applications).
        scopes: 'openid email profile',
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: error?.message ?? null }
  }, [])

  const resetPassword = useCallback(async (email: string, captchaToken?: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      ...(captchaToken ? { captchaToken } : {}),
    })
    return { error: error?.message ?? null }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    return { error: error?.message ?? null }
  }, [])

  const signUp = useCallback(async (email: string, password: string, fullName: string, role: UserRole = 'particulier', captchaToken?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        ...(captchaToken ? { captchaToken } : {}),
      },
    })
    if (error) return { error: error.message }

    // Ensure the profile has the correct role (trigger may default to 'particulier')
    if (data.user) {
      await supabase
        .from('profiles')
        .update({ role })
        .eq('id', data.user.id)
    }

    return { error: null }
  }, [])

  const handleSignOut = useCallback(async () => {
    // Clear local state immediately so UI updates even if Supabase hangs
    setSession(null)
    setProfile(null)
    try {
      await supabase.auth.signOut()
    } catch {
      // Force clear Supabase auth storage if signOut fails (lock conflict)
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
      keys.forEach((k) => localStorage.removeItem(k))
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user ?? null)
  }, [session, loadProfile])

  const isAgent = profile ? isAgentRole(profile.role) : false
  const isParticulier = profile ? isParticulierRole(profile.role) : false

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
        signInWithMicrosoft,
        signInWithFacebook,
        signUp,
        resetPassword,
        updatePassword,
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
