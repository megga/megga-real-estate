import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Mail, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
        fill="#EA4335"
      />
    </svg>
  )
}

export default function LoginPage() {
  const { user, loading: authLoading, signInWithEmail, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect if already logged in
  if (!authLoading && user) {
    return <Navigate to="/" replace />
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const { error: err } = await signInWithEmail(email.trim())
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      setSent(true)
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    setError(null)
    const { error: err } = await signInWithGoogle()
    if (err) {
      setError(err)
      setGoogleLoading(false)
    }
    // If successful, Supabase redirects — no need to setGoogleLoading(false)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <main id="main-content" className="w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="block text-center mb-10" aria-label="MEGGA — Accueil">
          <span className="text-3xl font-bold tracking-tight text-primary-900">MEGGA</span>
        </Link>

        {/* Card */}
        <div className="bg-white rounded-card border border-border p-8">
          <h1 className="text-2xl font-semibold text-primary-900 text-center mb-2">
            Connexion
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Accédez à votre espace MEGGA
          </p>

          {/* Google OAuth */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 rounded-button gap-3 text-sm font-medium"
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <GoogleIcon className="h-5 w-5" />
            )}
            Se connecter avec Google
          </Button>

          {/* Separator */}
          <div className="flex items-center gap-4 my-6" role="separator">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Magic link form */}
          {sent ? (
            <div className="text-center py-4" role="status">
              <CheckCircle className="h-10 w-10 text-success mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm font-medium text-primary-900 mb-1">
                Lien envoyé !
              </p>
              <p className="text-xs text-muted-foreground">
                Vérifiez votre boîte mail <span className="font-medium text-primary-700">{email}</span> et cliquez sur le lien pour vous connecter.
              </p>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-primary-700 mb-1.5">
                  Adresse e-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.ch"
                    required
                    autoComplete="email"
                    aria-describedby={error ? 'login-error' : undefined}
                    className="w-full h-11 pl-10 pr-4 text-sm bg-input border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-11 rounded-button"
                disabled={loading || !email.trim()}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  'Envoyer le lien de connexion'
                )}
              </Button>
            </form>
          )}

          {/* Error */}
          {error && (
            <div id="login-error" className="mt-4 p-3 bg-danger-light rounded-button" role="alert">
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}
        </div>

        {/* Register link */}
        <p className="text-sm text-muted-foreground text-center mt-6">
          Pas encore de compte ?{' '}
          <Link to="/register" className="text-accent hover:underline font-medium">
            Créer un compte
          </Link>
        </p>
      </main>
    </div>
  )
}
