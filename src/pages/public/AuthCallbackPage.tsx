import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase handles the token exchange automatically from the URL hash
    // We just need to wait for the session to be set, then redirect
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate('/', { replace: true })
      } else if (event === 'TOKEN_REFRESHED') {
        navigate('/', { replace: true })
      }
    })

    // Fallback: if session already exists after a short delay, redirect
    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        navigate('/', { replace: true })
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
