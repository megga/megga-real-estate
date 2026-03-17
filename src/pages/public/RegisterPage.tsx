import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Mail, Lock, User, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

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

export default function RegisterPage() {
  const { user, loading: authLoading, signUp, signInWithGoogle } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!authLoading && user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password || !firstName.trim() || !lastName.trim()) return

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setLoading(true)
    setError(null)
    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const { error: err } = await signUp(email.trim(), password, fullName)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      setSuccess(true)
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

  const inputClass = "w-full h-12 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200"

  return (
    <div className="min-h-screen bg-section flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="block text-center mb-10">
          <span className="text-3xl font-bold tracking-tight text-primary-900">MEGGA</span>
        </Link>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-semibold text-primary-900 text-center mb-2">
            Créer un compte
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Rejoignez la plateforme immobilière suisse
          </p>

          {/* Google OAuth */}
          <button
            type="button"
            className="w-full h-12 rounded-xl border border-gray-200 flex items-center justify-center gap-3 text-sm font-medium text-primary-700 hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon className="h-5 w-5" />
            )}
            Continuer avec Google
          </button>

          {/* Separator */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">ou</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {success ? (
            <div className="text-center py-4">
              <CheckCircle className="h-10 w-10 text-success mx-auto mb-3" />
              <p className="text-sm font-medium text-primary-900 mb-1">
                Compte créé !
              </p>
              <p className="text-xs text-muted-foreground">
                Un e-mail de confirmation a été envoyé à{' '}
                <span className="font-medium text-primary-700">{email}</span>.
                Cliquez sur le lien pour activer votre compte.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-primary-700 mb-1.5">
                    Prénom
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jean"
                      required
                      className={cn(inputClass, 'pl-10 pr-4')}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-primary-700 mb-1.5">
                    Nom
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dupont"
                    required
                    className={cn(inputClass, 'px-4')}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-primary-700 mb-1.5">
                  Adresse e-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.ch"
                    required
                    className={cn(inputClass, 'pl-10 pr-4')}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-primary-700 mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    required
                    minLength={6}
                    className={cn(inputClass, 'pl-10 pr-4')}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl font-medium"
                disabled={loading || !email.trim() || !password || !firstName.trim() || !lastName.trim()}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Créer mon compte'
                )}
              </Button>
            </form>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-danger-light rounded-xl">
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}
        </div>

        {/* Login link */}
        <p className="text-sm text-muted-foreground text-center mt-6">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-accent hover:underline font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
