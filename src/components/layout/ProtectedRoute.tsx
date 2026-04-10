import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
  skipOnboardingCheck?: boolean
}

export default function ProtectedRoute({ children, skipOnboardingCheck }: ProtectedRouteProps) {
  const { profile } = useAuth()

  // Auth bypass active (demo mode) — re-enable loading/user/Navigate guards when Supabase auth is production-ready
  if (!skipOnboardingCheck && profile && profile.onboarding_completed === false) {
    return <Navigate to="/dashboard/onboarding" replace />
  }

  return <>{children}</>
}
