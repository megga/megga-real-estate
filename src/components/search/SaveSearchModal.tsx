import { useState, type ReactNode } from 'react'
import { X, Bookmark, Bell, Mail, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useSavedSearches } from '@/hooks/useSavedSearches'

// ─── Icons & UI pieces from the user's design ───

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
)

const GlassInput = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl border border-gray-200 bg-gray-50/50 backdrop-blur-sm transition-colors focus-within:border-accent/50 focus-within:bg-accent/5">
    {children}
  </div>
)

// ─── Types ───

interface SearchFilters {
  context: string
  q: string
  types: string[]
  minPrice: string
  maxPrice: string
  rooms: string
  minSurface: string
  bedrooms: string
  city: string
  canton: string
  lifestyleTags: string[]
}

interface SaveSearchModalProps {
  isOpen: boolean
  onClose: () => void
  filters: SearchFilters
  resultsCount: number
  defaultAlertEnabled?: boolean
}

type AuthMode = 'login' | 'register'

// ─── Helpers ───

function generateSearchName(filters: SearchFilters): string {
  const parts: string[] = []
  if (filters.context === 'rent') parts.push('Location')
  else parts.push('Achat')
  if (filters.types.length === 1) {
    const labels: Record<string, string> = {
      apartment: 'Appartement', house: 'Maison', villa: 'Villa',
      commercial: 'Commercial', land: 'Terrain',
    }
    parts.push(labels[filters.types[0]] || filters.types[0])
  }
  if (filters.rooms) parts.push(`${filters.rooms} pièces`)
  if (filters.city) parts.push(filters.city)
  if (filters.canton && !filters.city) parts.push(filters.canton)
  if (filters.maxPrice) {
    const price = Number(filters.maxPrice)
    if (price >= 1000000) parts.push(`max ${price / 1000000}M`)
    else if (price >= 1000) parts.push(`max ${Math.round(price / 1000)}K`)
  }
  return parts.length > 1 ? parts.join(' · ') : 'Ma recherche'
}

function getActiveFilterPills(filters: SearchFilters): string[] {
  const pills: string[] = []
  if (filters.context === 'rent') pills.push('Location')
  else pills.push('Achat')
  if (filters.types.length) {
    const labels: Record<string, string> = {
      apartment: 'Appartement', house: 'Maison', villa: 'Villa',
      commercial: 'Commercial', land: 'Terrain',
    }
    filters.types.forEach((t) => pills.push(labels[t] || t))
  }
  if (filters.rooms) pills.push(`${filters.rooms} pièces`)
  if (filters.bedrooms) pills.push(`${filters.bedrooms} ch.`)
  if (filters.minPrice) pills.push(`Dès CHF ${Number(filters.minPrice).toLocaleString('fr-CH')}`)
  if (filters.maxPrice) pills.push(`Max CHF ${Number(filters.maxPrice).toLocaleString('fr-CH')}`)
  if (filters.minSurface) pills.push(`Min ${filters.minSurface} m²`)
  if (filters.city) pills.push(filters.city)
  if (filters.canton && !filters.city) pills.push(filters.canton)
  if (filters.lifestyleTags.length) {
    const labels: Record<string, string> = {
      vue_lac: 'Vue lac', vue_montagne: 'Vue montagne', lumineux: 'Lumineux',
      quartier_calme: 'Calme', proche_transports: 'Transports', proche_ecoles: 'Écoles',
      terrasse: 'Terrasse', balcon: 'Balcon', jardin: 'Jardin', parking: 'Parking',
      piscine: 'Piscine', dernier_etage: 'Dernier étage', ascenseur: 'Ascenseur',
      meuble: 'Meublé', centre_ville: 'Centre-ville',
    }
    filters.lifestyleTags.forEach((t) => pills.push(labels[t] || t))
  }
  if (filters.q) pills.push(`"${filters.q}"`)
  return pills
}

// ─── Main Component ───

export default function SaveSearchModal({
  isOpen,
  onClose,
  filters,
  resultsCount,
  defaultAlertEnabled = false,
}: SaveSearchModalProps) {
  const { user, signInWithEmail, signInWithGoogle, signUp } = useAuth()
  const { create, isCreating } = useSavedSearches()

  const [name, setName] = useState(() => generateSearchName(filters))
  const [alertEnabled, setAlertEnabled] = useState(defaultAlertEnabled)
  const [alertEmail, setAlertEmail] = useState(user?.email || '')
  const [alertFrequency, setAlertFrequency] = useState<'instant' | 'daily' | 'weekly'>('daily')
  const [success, setSuccess] = useState(false)

  // Auth form state
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  if (!isOpen) return null

  const pills = getActiveFilterPills(filters)

  async function handleSave() {
    try {
      await create({
        name,
        filters: filters as unknown as Record<string, unknown>,
        alert_enabled: alertEnabled,
        alert_email: alertEnabled ? alertEmail : undefined,
        alert_frequency: alertEnabled ? alertFrequency : undefined,
        results_count: resultsCount,
      })
      setSuccess(true)
      setTimeout(() => {
        onClose()
        setSuccess(false)
        setName(generateSearchName(filters))
      }, 1500)
    } catch {
      // Error handled by React Query
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    const { error } = await signInWithEmail(email)
    setAuthLoading(false)
    if (error) setAuthError(error)
    else setMagicLinkSent(true)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !email.trim() || !password.trim()) return
    setAuthLoading(true)
    setAuthError('')
    const { error } = await signUp(email, password, fullName)
    setAuthLoading(false)
    if (error) setAuthError(error)
    else setMagicLinkSent(true)
  }

  async function handleGoogleLogin() {
    setAuthLoading(true)
    setAuthError('')
    const { error } = await signInWithGoogle()
    if (error) { setAuthError(error); setAuthLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-modal w-full max-w-[440px] mx-4 overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer z-10"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        {!user ? (
          /* ─── Auth Form (inspired by user's SignInPage) ─── */
          <div className="px-8 py-8">
            {magicLinkSent ? (
              /* Magic link sent */
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <Mail className="h-7 w-7 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  {authMode === 'register' ? 'Compte créé !' : 'Lien envoyé !'}
                </h2>
                <p className="text-sm text-gray-500 mb-1">
                  Vérifiez votre boîte mail à
                </p>
                <p className="text-sm font-medium text-gray-900 mb-6">{email}</p>
                <button
                  onClick={() => { setMagicLinkSent(false); setEmail('') }}
                  className="text-sm text-accent hover:underline cursor-pointer"
                >
                  Utiliser une autre adresse
                </button>
              </div>
            ) : authMode === 'login' ? (
              /* ─── Login ─── */
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
                    Bienvenue
                  </h2>
                  <p className="text-sm text-gray-500 mt-2">
                    Connectez-vous pour sauvegarder votre recherche et recevoir des alertes
                  </p>
                </div>

                <form onSubmit={handleEmailLogin} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Adresse email</label>
                    <GlassInput>
                      <input
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Entrez votre adresse email"
                        required
                        className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none placeholder:text-gray-400"
                      />
                    </GlassInput>
                  </div>

                  {/* Error */}
                  {authError && (
                    <p className="text-xs text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">
                      {authError}
                    </p>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={authLoading || !email.trim()}
                    className="w-full rounded-2xl bg-gray-900 py-4 text-sm font-medium text-white hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {authLoading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Se connecter'
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative flex items-center justify-center">
                  <span className="w-full border-t border-gray-200" />
                  <span className="px-4 text-sm text-gray-400 bg-white absolute">
                    Ou continuer avec
                  </span>
                </div>

                {/* Google */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-2xl py-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <GoogleIcon />
                  Continuer avec Google
                </button>

                {/* Register link */}
                <p className="text-center text-sm text-gray-500">
                  Nouveau sur MEGGA ?{' '}
                  <button
                    onClick={() => { setAuthMode('register'); setAuthError('') }}
                    className="text-accent hover:underline cursor-pointer font-medium"
                  >
                    Créer un compte
                  </button>
                </p>
              </div>
            ) : (
              /* ─── Register ─── */
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
                    Créer un compte
                  </h2>
                  <p className="text-sm text-gray-500 mt-2">
                    Rejoignez MEGGA pour sauvegarder vos recherches
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  {/* Full name */}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Nom complet</label>
                    <GlassInput>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Entrez votre nom complet"
                        required
                        className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none placeholder:text-gray-400"
                      />
                    </GlassInput>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Adresse email</label>
                    <GlassInput>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Entrez votre adresse email"
                        required
                        className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none placeholder:text-gray-400"
                      />
                    </GlassInput>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Mot de passe</label>
                    <GlassInput>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimum 6 caractères"
                          required
                          minLength={6}
                          className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none placeholder:text-gray-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-3 flex items-center cursor-pointer"
                        >
                          {showPassword
                            ? <EyeOff className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors" />
                            : <Eye className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors" />
                          }
                        </button>
                      </div>
                    </GlassInput>
                  </div>

                  {/* Error */}
                  {authError && (
                    <p className="text-xs text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">
                      {authError}
                    </p>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full rounded-2xl bg-gray-900 py-4 text-sm font-medium text-white hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {authLoading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Créer mon compte'
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative flex items-center justify-center">
                  <span className="w-full border-t border-gray-200" />
                  <span className="px-4 text-sm text-gray-400 bg-white absolute">
                    Ou continuer avec
                  </span>
                </div>

                {/* Google */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-2xl py-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <GoogleIcon />
                  S'inscrire avec Google
                </button>

                {/* Login link */}
                <p className="text-center text-sm text-gray-500">
                  Déjà un compte ?{' '}
                  <button
                    onClick={() => { setAuthMode('login'); setAuthError('') }}
                    className="text-accent hover:underline cursor-pointer font-medium"
                  >
                    Se connecter
                  </button>
                </p>
              </div>
            )}
          </div>
        ) : success ? (
          /* ─── Success state ─── */
          <div className="px-8 py-10">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Recherche sauvegardée !
              </h2>
              {alertEnabled && (
                <p className="text-sm text-gray-500">
                  Vous recevrez des alertes à {alertEmail}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* ─── Save form (authenticated) ─── */
          <div className="px-8 py-8 space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                Sauvegarder la recherche
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Retrouvez cette recherche facilement
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="text-sm font-medium text-gray-500">Nom de la recherche</label>
              <GlassInput>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Appartement Genève 3 pièces"
                  className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none placeholder:text-gray-400"
                />
              </GlassInput>
            </div>

            {/* Filters summary */}
            <div>
              <label className="text-sm font-medium text-gray-500 mb-2 block">
                Critères ({resultsCount} résultat{resultsCount !== 1 ? 's' : ''})
              </label>
              <div className="flex flex-wrap gap-1.5">
                {pills.map((pill, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-gray-100" />

            {/* Alert toggle */}
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setAlertEnabled(!alertEnabled)}
                className={cn(
                  'mt-0.5 w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer shrink-0 relative',
                  alertEnabled ? 'bg-accent' : 'bg-gray-200'
                )}
              >
                <span className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                  alertEnabled ? 'translate-x-5' : 'translate-x-1'
                )} />
              </button>
              <div>
                <div className="flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900">Alertes email</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Recevez un email quand un nouveau bien correspond
                </p>
              </div>
            </div>

            {/* Alert settings */}
            {alertEnabled && (
              <div className="space-y-4 pl-14">
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <GlassInput>
                    <input
                      type="email"
                      value={alertEmail}
                      onChange={(e) => setAlertEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="w-full bg-transparent text-sm p-3.5 rounded-2xl focus:outline-none placeholder:text-gray-400"
                    />
                  </GlassInput>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">Fréquence</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'instant', label: 'Instantané' },
                      { value: 'daily', label: 'Quotidien' },
                      { value: 'weekly', label: 'Hebdo' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAlertFrequency(opt.value)}
                        className={cn(
                          'flex-1 py-2.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer',
                          alertFrequency === opt.value
                            ? 'bg-accent/10 border-accent/30 text-accent'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={isCreating || !name.trim()}
              className="w-full rounded-2xl bg-gray-900 py-4 text-sm font-medium text-white hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Bookmark className="h-4 w-4" />
                  Sauvegarder
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
