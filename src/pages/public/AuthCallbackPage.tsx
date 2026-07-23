/**
 * Page de callback d'authentification — route `/auth/callback`.
 * Aiguille après SIGNED_IN : sauvegarde des tokens Google/Outlook Calendar
 * (params `gcal` / `outlook`), sinon redirection selon le rôle en corrigeant au
 * passage le rôle du profil si l'inscription visait un rôle différent.
 * PASSWORD_RECOVERY → écran de reset ; timeout de secours après 5 s.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BootSplash from '@/components/layout/BootSplash'
import { supabase } from '@/lib/supabase'
import { isAgentRole } from '@/types/auth'
import type { UserRole } from '@/types/auth'

const VALID_ROLES: UserRole[] = ['buyer', 'seller', 'particulier', 'agent', 'manager', 'admin', 'assistant']

/** Destination post-login selon le rôle : agents vers le CRM, particuliers vers le portail. */
function getRedirectPath(role: UserRole): string {
  if (isAgentRole(role)) return '/dashboard'
  return '/portal'
}

/** Tient l'écran d'arrivée le temps de l'aiguillage, fait dans onAuthStateChange. */
export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    async function handleRedirect(userId: string, user: { user_metadata?: Record<string, string> }) {
      // ── Google Calendar OAuth callback ──
      const params = new URLSearchParams(window.location.search)
      if (params.get('gcal') === '1') {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.provider_token && session?.provider_refresh_token) {
          try {
            await supabase.functions.invoke('google-calendar-sync', {
              body: {
                action: 'save_tokens',
                access_token: session.provider_token,
                refresh_token: session.provider_refresh_token,
                expires_in: 3600,
                google_email: user.user_metadata?.email ?? null,
              },
            })
          } catch {
            // Token save failed — user can retry from Settings
          }
        }
        navigate('/dashboard/settings?tab=integrations&gcal=success', { replace: true })
        return
      }

      // ── Outlook Calendar OAuth callback ──
      if (params.get('outlook') === '1') {
        const { data: { session: outlookSession } } = await supabase.auth.getSession()
        if (outlookSession?.provider_token && outlookSession?.provider_refresh_token) {
          try {
            await supabase.functions.invoke('outlook-calendar-sync', {
              body: {
                action: 'save_tokens',
                access_token: outlookSession.provider_token,
                refresh_token: outlookSession.provider_refresh_token,
                expires_in: 3600,
                outlook_email: user.user_metadata?.email ?? null,
              },
            })
          } catch {
            // Token save failed — user can retry from Settings
          }
        }
        navigate('/dashboard/settings?tab=integrations&outlook=success', { replace: true })
        return
      }

      // ── Normal OAuth redirect ──
      // Check if there's a pending OAuth role from Google sign-in
      const pendingRole = localStorage.getItem('megga_oauth_role')
      localStorage.removeItem('megga_oauth_role')

      // Fetch existing profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      let role: UserRole = (profile?.role as UserRole) || 'particulier'

      // Determine the intended role from OAuth localStorage OR user_metadata (email signup)
      const intendedRole = pendingRole
        || (user.user_metadata?.role as string)
        || null

      // If profile has default role but user signed up with a different role, fix it
      if (intendedRole && VALID_ROLES.includes(intendedRole as UserRole)) {
        const selectedRole = intendedRole as UserRole

        if ((role === 'buyer' || role === 'particulier') && selectedRole !== role) {
          const { error } = await supabase
            .from('profiles')
            .update({ role: selectedRole })
            .eq('id', userId)

          if (!error) {
            role = selectedRole
          }
        }
      }

      navigate(getRedirectPath(role), { replace: true })
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          handleRedirect(session.user.id, session.user)
        } else {
          navigate('/', { replace: true })
        }
      }
      // Handle password recovery redirect → new bento auth screen
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/auth/forgot-password/reset', { replace: true })
      }
    })

    // Fallback after 5 seconds
    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        handleRedirect(session.user.id, session.user)
      } else {
        navigate('/auth/login', { replace: true })
      }
    }, 5000)

    return () => clearTimeout(timeout)
  }, [navigate])

  return <BootSplash />
}
