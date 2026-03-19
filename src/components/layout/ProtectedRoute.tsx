import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth, type UserRole } from '@/hooks/useAuth'

// DEV_BYPASS: set to true to skip auth check during development
const DEV_BYPASS_AUTH = true

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (DEV_BYPASS_AUTH) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && allowedRoles.length > 0 && profile) {
    if (!allowedRoles.includes(profile.role)) {
      const fallback = profile.role === 'buyer' || profile.role === 'seller' ? '/' : '/dashboard'
      return <Navigate to={fallback} replace />
    }
  }

  return <>{children}</>
}
