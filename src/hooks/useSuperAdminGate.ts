// Gate d'accès à la section super-admin (frontend, UX seulement — le mur réel
// est en DB : is_super_admin() + allowlist, et sur les edges : require-super-admin).
//
// Trois vérifications :
//   1. profiles.role === 'super_admin'
//   2. email allowlisté (src/lib/superAdmin.ts — miroir de la liste SQL)
//   3. un facteur TOTP « verified » existe (sinon → écran d'enrôlement forcé).
//      Le step-up AAL2 lui-même est déjà géré en amont par ProtectedRoute
//      (useMfaGate) dès qu'un facteur vérifié existe.
//
// Le check listFactors est mémoïsé par user.id (même philosophie que
// useMfaGate.satisfiedFor) et invalidé au SIGNED_OUT ; recheck() après un
// enrôlement réussi re-évalue.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { isSuperAdminEmail } from '@/lib/superAdmin'

let totpVerifiedFor: string | null = null

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') totpVerifiedFor = null
})

export interface SuperAdminGateState {
  /** Résolution en cours (profil ou facteurs MFA) — ne rien rendre pendant ce temps. */
  checking: boolean
  /** Rôle super_admin ET email allowlisté. */
  allowed: boolean
  /** Autorisé mais sans facteur TOTP vérifié → forcer l'enrôlement. */
  needsEnrollment: boolean
  /** Re-évalue (à appeler après un enrôlement réussi). */
  recheck: () => void
}

export function useSuperAdminGate(): SuperAdminGateState {
  const { user, profile, loading } = useAuth()

  const roleOk = profile?.role === 'super_admin'
  const emailOk = isSuperAdminEmail(profile?.email || user?.email)
  const allowed = !loading && roleOk && emailOk

  const cached = !!user?.id && totpVerifiedFor === user.id
  const [checking, setChecking] = useState(!cached)
  const [needsEnrollment, setNeedsEnrollment] = useState(false)

  const run = useCallback(async () => {
    if (loading) return
    if (!allowed || !user?.id) {
      setChecking(false)
      setNeedsEnrollment(false)
      return
    }
    if (totpVerifiedFor === user.id) {
      setChecking(false)
      setNeedsEnrollment(false)
      return
    }
    setChecking(true)
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      const hasVerifiedTotp = (data?.all ?? []).some(
        (f) => f.factor_type === 'totp' && f.status === 'verified',
      )
      if (hasVerifiedTotp) {
        totpVerifiedFor = user.id
        setNeedsEnrollment(false)
      } else {
        setNeedsEnrollment(true)
      }
    } catch {
      // Session mock/dev ou MFA indisponible : on ne bloque pas côté UI —
      // le backend (RLS allowlist + AAL2 sur les edges) reste l'enforcement.
      totpVerifiedFor = user.id
      setNeedsEnrollment(false)
    } finally {
      setChecking(false)
    }
  }, [allowed, loading, user?.id])

  useEffect(() => {
    void run()
  }, [run])

  return { checking: loading || checking, allowed, needsEnrollment, recheck: run }
}
