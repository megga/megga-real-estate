import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isAgentRole } from '@/types/auth'
import type { UserRole } from '@/types/auth'

const VALID_ROLES: UserRole[] = ['buyer', 'seller', 'particulier', 'agent', 'manager', 'admin', 'assistant']

function getRedirectPath(role: UserRole): string {
  if (isAgentRole(role)) return '/dashboard'
  return '/mon-espace'
}

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    async function handleRedirect(userId: string) {
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

      // If Google OAuth and the profile was just created with default role,
      // update it with the role the user selected before OAuth redirect
      if (pendingRole && VALID_ROLES.includes(pendingRole as UserRole)) {
        const selectedRole = pendingRole as UserRole

        // Only update if the profile role is still the default
        // (meaning it was just auto-created by the trigger)
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
          handleRedirect(session.user.id)
        } else {
          navigate('/', { replace: true })
        }
      }
      // Handle password recovery redirect
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true })
      }
    })

    // Fallback after 5 seconds
    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        handleRedirect(session.user.id)
      } else {
        navigate('/login', { replace: true })
      }
    }, 5000)

    return () => clearTimeout(timeout)
  }, [navigate])

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
      <p className="text-sm text-muted-foreground">Connexion en cours...</p>
    </div>
  )
}
