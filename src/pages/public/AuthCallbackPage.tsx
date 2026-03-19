import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isAgentRole } from '@/types/auth'
import type { UserRole } from '@/types/auth'

function getRedirectPath(role: UserRole): string {
  if (isAgentRole(role)) return '/dashboard'
  if (role === 'seller') return '/seller'
  return '/mon-espace'
}

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    async function handleRedirect(userId: string) {
      // Fetch user profile to get role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      const role = (profile?.role as UserRole) || 'buyer'
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
    })

    // Fallback
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
