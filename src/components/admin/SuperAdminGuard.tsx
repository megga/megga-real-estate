/**
 * Garde de route enveloppant la section super-admin : ne rend `children` que si
 * l'accès est autorisé (rôle + email allowlisté), sinon redirige vers `/dashboard`.
 */
import { Navigate } from 'react-router-dom'
import { useSuperAdminGate } from '@/hooks/useSuperAdminGate'

// Garde UX de la section super-admin : rôle + email allowlisté (miroir de la
// liste SQL, cf. src/lib/superAdmin.ts). L'enforcement réel est en DB
// (is_super_admin, migration 20260705160000) et sur les edges
// (_shared/require-super-admin.ts).
export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { checking, allowed } = useSuperAdminGate()

  if (checking) return null

  if (!allowed) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
