// Gate d'accès à la section super-admin (frontend, UX seulement — le mur réel
// est en DB : is_super_admin() + allowlist, et sur les edges : require-super-admin).
//
// Deux vérifications :
//   1. profiles.role === 'super_admin'
//   2. email allowlisté (src/lib/superAdmin.ts — miroir de la liste SQL)

import { useAuth } from '@/hooks/useAuth'
import { isSuperAdminEmail } from '@/lib/superAdmin'

export interface SuperAdminGateState {
  /** Résolution du profil en cours — ne rien rendre pendant ce temps. */
  checking: boolean
  /** Rôle super_admin ET email allowlisté. */
  allowed: boolean
}

/**
 * Résout l'accès super-admin côté UI : rôle + email allowlisté.
 * Enforcement réel = DB (is_super_admin) + edges (require-super-admin).
 */
export function useSuperAdminGate(): SuperAdminGateState {
  const { user, profile, loading } = useAuth()
  const roleOk = profile?.role === 'super_admin'
  const emailOk = isSuperAdminEmail(profile?.email || user?.email)
  return { checking: loading, allowed: !loading && roleOk && emailOk }
}
