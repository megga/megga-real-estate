import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Skip the onboarding + premier-jour redirect (use on the onboarding /
   *  premier-jour pages themselves to avoid a redirect loop). */
  skipOnboardingCheck?: boolean
}

export default function ProtectedRoute({ children, skipOnboardingCheck }: ProtectedRouteProps) {
  const { profile } = useAuth()

  // Auth bypass active (demo mode) — re-enable loading/user/Navigate guards when Supabase auth is production-ready
  if (!skipOnboardingCheck && profile) {
    // 1. Onboarding wizard pas terminé → /dashboard/onboarding
    if (profile.onboarding_completed === false) {
      return <Navigate to="/dashboard/onboarding" replace />
    }
    // 2. Onboarding terminé mais Premier jour pas joué → /dashboard/premier-jour
    //    (one-shot après l'onboarding, avant la première vraie session CRM)
    if (profile.first_day_done === false) {
      return <Navigate to="/dashboard/premier-jour" replace />
    }
  }

  return <>{children}</>
}
