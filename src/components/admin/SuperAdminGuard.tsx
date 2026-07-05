import { Navigate } from 'react-router-dom'
import { useSuperAdminGate } from '@/hooks/useSuperAdminGate'
import AdminMfaRequired from '@/components/admin/AdminMfaRequired'

// Garde UX de la section super-admin : rôle + email allowlisté (miroir de la
// liste SQL, cf. src/lib/superAdmin.ts) + enrôlement TOTP forcé. L'enforcement
// réel est en DB (is_super_admin, migration 20260705160000) et sur les edges
// (_shared/require-super-admin.ts).
export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { checking, allowed, needsEnrollment, recheck } = useSuperAdminGate()

  if (checking) return null

  if (!allowed) {
    return <Navigate to="/dashboard" replace />
  }

  if (needsEnrollment) {
    return <AdminMfaRequired onEnrolled={recheck} />
  }

  return <>{children}</>
}
