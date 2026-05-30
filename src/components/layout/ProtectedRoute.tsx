import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import SmartPageLoader from '@/components/skeletons/SmartPageLoader'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Skip the onboarding + premier-jour redirect (use on the onboarding /
   *  premier-jour pages themselves to avoid a redirect loop). */
  skipOnboardingCheck?: boolean
}

export default function ProtectedRoute({ children, skipOnboardingCheck }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()

  // 1. Session encore en cours de résolution → pas de flash de contenu protégé.
  if (loading) {
    return <SmartPageLoader />
  }

  // 2. Non authentifié → connexion. (En bypass dev, user = MOCK_USER, donc on
  //    n'est jamais redirigé à tort.)
  if (!user) {
    return <Navigate to="/auth/login" replace />
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
