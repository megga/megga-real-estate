/**
 * Garde de route de toute surface `/dashboard/*`. Enchaîne les gates dans
 * l'ordre : session en cours de résolution → non authentifié (redirige vers
 * megga.ch/login) → step-up 2FA (session AAL1 avec facteur TOTP) → onboarding /
 * agence / premier-jour (décision pure `resolveOnboardingGate`) → consentements
 * nLPD (`ConsentGate`), puis rend le contenu protégé.
 */
import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useMfaGate } from '@/hooks/useMfaGate'
import { resolveOnboardingGate } from '@/components/layout/onboardingGate'
import ConsentGate from '@/components/layout/ConsentGate'
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

/** Applique la chaîne de gates puis rend `children` (enveloppés du gate consentement). */
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

  // 3. Gate onboarding → agence → premier-jour → CRM (décision pure, testée :
  //    src/components/layout/onboardingGate.ts). Inclut le garde-fou agency_id :
  //    un agent sans agence est verrouillé par la RLS sur tout le CRM → renvoyé
  //    à l'onboarding (qui force l'étape Agence) au lieu d'un dashboard vide muet.
  if (!skipOnboardingCheck && profile) {
    const redirect = resolveOnboardingGate(profile)
    if (redirect) {
      return <Navigate to={redirect} replace />
    }
  }

  // 4. Gate consentements nLPD (modal bloquante si les versions courantes des
  //    CGU/confidentialité n'ont pas été acceptées — preuve en user_consents).
  return <ConsentGate>{children}</ConsentGate>
}
