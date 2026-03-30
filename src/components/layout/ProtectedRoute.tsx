import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
  skipOnboardingCheck?: boolean
}

export default function ProtectedRoute({ children, skipOnboardingCheck }: ProtectedRouteProps) {
  const { profile } = useAuth()

  // BYPASS: skip auth (demo mode) — keep onboarding redirect
  // TODO: re-enable full auth (loading, user, Navigate to /login) when Supabase auth is production-ready
  if (!skipOnboardingCheck && profile && profile.onboarding_completed === false) {
    return <Navigate to="/dashboard/onboarding" replace />
  }

  return <>{children}</>
}
