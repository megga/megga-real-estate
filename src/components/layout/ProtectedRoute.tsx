interface ProtectedRouteProps {
  children: React.ReactNode
  skipOnboardingCheck?: boolean
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  // Auth bypass active (demo mode) — re-enable loading/user/Navigate guards when Supabase auth is production-ready
  return <>{children}</>
}
