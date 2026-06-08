import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useMfaGate } from '@/hooks/useMfaGate'
import SmartPageLoader from '@/components/skeletons/SmartPageLoader'

// Carte de step-up 2FA : on réutilise l'écran de connexion existant (auth-bento),
// en lazy pour ne pas alourdir le bundle initial. Aucun composant nouveau.
const AuthBentoApp = lazy(() =>
  import('@/components/auth-bento/AuthBentoApp').then((m) => ({ default: m.AuthBentoApp })),
)

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Skip the onboarding + premier-jour redirect (use on the onboarding /
   *  premier-jour pages themselves to avoid a redirect loop). */
  skipOnboardingCheck?: boolean
}

export default function ProtectedRoute({ children, skipOnboardingCheck }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  // Gate 2FA — hook appelé inconditionnellement (règle des hooks). Ne touche pas
  // au modèle de connexion : c'est une étape APRÈS une session AAL1 valide.
  const { checking: mfaChecking, needsMfa, recheck } = useMfaGate(user?.id ?? null)

  // 1. Session encore en cours de résolution → pas de flash de contenu protégé.
  if (loading) {
    return <SmartPageLoader />
  }

  // 2. Non authentifié → connexion sur la VITRINE (megga.ch/login, câblé
  //    Supabase). Le modal de connexion interne (ancienne direction) a été
  //    retiré ; le retour se fait via /auth/callback. (En bypass dev,
  //    user = MOCK_USER, donc on n'est jamais redirigé à tort.)
  if (!user) {
    if (typeof window !== 'undefined') window.location.replace('https://megga.ch/login')
    return null
  }

  // 2b. Step-up 2FA : l'agent a un facteur TOTP vérifié mais la session est en
  //     AAL1 → il doit saisir son code (même écran que le login) avant le CRM.
  if (mfaChecking) {
    return <SmartPageLoader />
  }
  if (needsMfa) {
    return (
      <Suspense fallback={<SmartPageLoader />}>
        <AuthBentoApp route={{ portail: 'agent', etat: 'mfa' }} onVerified={recheck} />
      </Suspense>
    )
  }

  // 3. Gate onboarding → premier-jour → CRM.
  if (!skipOnboardingCheck && profile) {
    // 3a. Onboarding wizard pas terminé → /dashboard/onboarding
    if (profile.onboarding_completed === false) {
      return <Navigate to="/dashboard/onboarding" replace />
    }
    // 3b. Onboarding terminé mais Premier jour pas joué → /dashboard/premier-jour
    //     (one-shot après l'onboarding, avant la première vraie session CRM)
    if (profile.first_day_done === false) {
      return <Navigate to="/dashboard/premier-jour" replace />
    }
  }

  return <>{children}</>
}
