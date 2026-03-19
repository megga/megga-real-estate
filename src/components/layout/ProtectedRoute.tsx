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
    // En dev bypass, vérifier quand même les rôles si on a un profil mock
    if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
      return <Navigate to="/" replace />
    }
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

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
