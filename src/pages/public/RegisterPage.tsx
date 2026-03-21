import { useState, useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Mail, Lock, User, Loader2, CheckCircle, Home, Briefcase, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth, type UserRole } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

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

// ─── PASSWORD STRENGTH ──────────────────────────────────────────────────

interface PasswordStrength {
  score: number // 0-4
  label: string
  color: string
}

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '', color: '' }

  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score: 1, label: 'Faible', color: 'bg-red-500' }
  if (score === 2) return { score: 2, label: 'Moyen', color: 'bg-amber-500' }
  if (score === 3) return { score: 3, label: 'Bon', color: 'bg-emerald-400' }
  return { score: 4, label: 'Fort', color: 'bg-emerald-600' }
}

// ─── ROLES ──────────────────────────────────────────────────────────────

const ROLES: { value: UserRole; label: string; description: string; icon: typeof Home }[] = [
  { value: 'particulier', label: 'Particulier', description: 'Je cherche ou vends un bien', icon: Home },
  { value: 'agent', label: 'Agent immobilier', description: 'Je suis professionnel', icon: Briefcase },
]

// ─── COMPONENT ──────────────────────────────────────────────────────────

export default function RegisterPage() {
  const { user, loading: authLoading, signUp, signInWithGoogle } = useAuth()
  const [role, setRole] = useState<UserRole>('particulier')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password])

  if (!authLoading && user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password || !firstName.trim() || !lastName.trim()) return

    if (!acceptedTerms) {
      setError('Veuillez accepter les conditions générales pour continuer.')
      return
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setLoading(true)
    setError(null)
    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const { error: err } = await signUp(email.trim(), password, fullName, role)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      setSuccess(true)
    }
  }

  async function handleGoogle() {
    if (!acceptedTerms) {
      setError('Veuillez accepter les conditions générales pour continuer.')
      return
    }
    setGoogleLoading(true)
    setError(null)
    // Pass the selected role so it's stored before OAuth redirect
    const { error: err } = await signInWithGoogle(role)
    if (err) {
      setError(err)
      setGoogleLoading(false)
    }
  }

  const canSubmit = email.trim() && password && firstName.trim() && lastName.trim() && acceptedTerms && password.length >= 6

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-10">
          <span className="text-3xl font-bold tracking-tight text-primary-900">MEGGA</span>
        </Link>

        <div className="bg-white rounded-xl border border-border p-8">
          <h1 className="text-2xl font-semibold text-primary-900 text-center mb-2">
            Créer un compte
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Rejoignez la plateforme immobilière suisse
          </p>

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {ROLES.map((r) => {
              const Icon = r.icon
              const selected = role === r.value
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all cursor-pointer',
                    selected
                      ? 'border-accent bg-accent/5 text-accent'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{r.label}</span>
                </button>
              )
            })}
          </div>

          {/* Google OAuth */}
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
            Continuer avec Google
          </Button>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">ou</span>
            <div className="flex-1 h-px bg-border" />
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-primary-700 mb-1.5">
                    Prénom
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jean"
                      required
                      className="w-full h-11 pl-10 pr-4 text-sm bg-input border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
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
                    className="w-full h-11 px-4 text-sm bg-input border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                  />
                </div>
              </div>

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
                <label htmlFor="password" className="block text-sm font-medium text-primary-700 mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    required
                    minLength={6}
                    className="w-full h-11 pl-10 pr-4 text-sm bg-input border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                  />
                </div>

                {/* Password strength indicator */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={cn(
                            'h-1 flex-1 rounded-full transition-colors duration-200',
                            level <= passwordStrength.score ? passwordStrength.color : 'bg-gray-200'
                          )}
                        />
                      ))}
                    </div>
                    <p className={cn(
                      'text-[11px] font-medium',
                      passwordStrength.score <= 1 ? 'text-red-500' :
                      passwordStrength.score === 2 ? 'text-amber-500' :
                      'text-emerald-600'
                    )}>
                      {passwordStrength.label}
                      {passwordStrength.score < 3 && (
                        <span className="text-gray-400 font-normal ml-1">
                          — ajoutez majuscules, chiffres ou symboles
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Terms & conditions checkbox */}
              <div className="flex items-start gap-2.5 pt-1">
                <div className="flex items-center h-5 mt-0.5">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent/20 cursor-pointer"
                  />
                </div>
                <label htmlFor="terms" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
                  J'accepte les{' '}
                  <Link to="/conditions" className="text-accent hover:underline">
                    Conditions générales
                  </Link>
                  {' '}et la{' '}
                  <Link to="/confidentialite" className="text-accent hover:underline">
                    Politique de confidentialité
                  </Link>
                  {' '}de MEGGA.
                </label>
              </div>

              {/* Data protection notice */}
              <div className="flex items-start gap-2 bg-gray-50 rounded-lg p-3">
                <ShieldCheck className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Vos données sont hébergées en Suisse/EU, conformes à la LPD. Elles ne sont jamais vendues à des tiers.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-button"
                disabled={loading || !canSubmit}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Créer mon compte'
                )}
              </Button>
            </form>
          )}

          {error && (
            <div className="mt-4 p-3 bg-danger-light rounded-lg">
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}
        </div>

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
