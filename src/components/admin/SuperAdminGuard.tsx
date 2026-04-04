import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) return null

  if (!profile || profile.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
