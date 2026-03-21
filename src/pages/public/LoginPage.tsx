import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Mail, Lock, Loader2, ArrowLeft, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { isAgentRole, type UserRole } from '@/types/auth'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335" />
    </svg>
  )
}

export default function LoginPage() {
  const { user, profile, loading: authLoading, signInWithPassword, signInWithGoogle, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  // Redirect by role if already logged in
  if (!authLoading && user && profile) {
    if (isAgentRole(profile.role)) return <Navigate to="/dashboard" replace />
    return <Navigate to="/portal" replace />
  }
  if (!authLoading && user && !profile) {
    // Fallback: check user_metadata for role
    const metaRole = user.user_metadata?.role as string | undefined
    if (metaRole && isAgentRole(metaRole as UserRole)) return <Navigate to="/dashboard" replace />
    return <Navigate to="/portal" replace />
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)
    const { error: err } = await signInWithPassword(email.trim(), password)
    setLoading(false)
    if (err) {
      setError(err)
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
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetEmail.trim()) return
    setResetLoading(true)
    setResetError(null)
    const { error: err } = await resetPassword(resetEmail.trim())
    setResetLoading(false)
    if (err) {
      setResetError(err)
    } else {
      setResetSent(true)
    }
  }

  // ─── FORGOT PASSWORD VIEW ────────────────────────────────────────────
  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Link to="/" className="block text-center mb-10">
            <span className="text-3xl font-bold tracking-tight text-primary-900">MEGGA</span>
          </Link>

          <div className="bg-white rounded-xl border border-border p-8">
            <button
              onClick={() => { setShowForgotPassword(false); setResetSent(false); setResetError(null) }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent mb-6 cursor-pointer transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à la connexion
            </button>

            <h1 className="text-2xl font-semibold text-primary-900 text-center mb-2">
              Mot de passe oublié
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-8">
              Entrez votre adresse e-mail pour recevoir un lien de réinitialisation.
            </p>

            {resetSent ? (
              <div className="text-center py-4">
                <CheckCircle className="h-10 w-10 text-success mx-auto mb-3" />
                <p className="text-sm font-medium text-primary-900 mb-1">
                  E-mail envoyé !
                </p>
                <p className="text-xs text-muted-foreground">
                  Vérifiez votre boîte de réception à{' '}
                  <span className="font-medium text-primary-700">{resetEmail}</span>.
                  Cliquez sur le lien pour réinitialiser votre mot de passe.
                </p>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label htmlFor="resetEmail" className="block text-sm font-medium text-primary-700 mb-1.5">
                    Adresse e-mail
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="resetEmail"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="vous@exemple.ch"
                      required
                      className="w-full h-11 pl-10 pr-4 text-sm bg-input border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-button"
                  disabled={resetLoading || !resetEmail.trim()}
                >
                  {resetLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Envoyer le lien'
                  )}
                </Button>
              </form>
            )}

            {resetError && (
              <div className="mt-4 p-3 bg-danger-light rounded-lg">
                <p className="text-xs text-danger">{resetError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── LOGIN VIEW ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-10">
          <span className="text-3xl font-bold tracking-tight text-primary-900">MEGGA</span>
        </Link>

        <div className="bg-white rounded-xl border border-border p-8">
          <h1 className="text-2xl font-semibold text-primary-900 text-center mb-2">
            Connexion
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Accédez à votre espace MEGGA
          </p>

          <Button
            type="button"
            variant="outline"
            className="w-full h-11 rounded-button gap-3 text-sm font-medium"
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon className="h-5 w-5" />
            )}
            Se connecter avec Google
          </Button>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-primary-700 mb-1.5">
                Adresse e-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.ch"
                  required
                  className="w-full h-11 pl-10 pr-4 text-sm bg-input border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-primary-700">
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(true); setResetEmail(email) }}
                  className="text-xs text-accent hover:underline cursor-pointer"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  required
                  className="w-full h-11 pl-10 pr-4 text-sm bg-input border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-button"
              disabled={loading || !email.trim() || !password}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-danger-light rounded-lg">
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}
        </div>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Pas encore de compte ?{' '}
          <Link to="/register" className="text-accent hover:underline font-medium">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}
