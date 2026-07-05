import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface ImpersonatedUser {
  id: string
  full_name: string
  email: string
  role: string
  agency_id: string | null
  agency_name: string | null
}

const STORAGE_KEY = 'megga-impersonate'

// Vue « impersonation » super-admin (localStorage, lecture seule côté client).
// AUDIT-FIRST (migration 20260705160000) : l'événement activity_events est
// écrit côté serveur par la RPC admin_log_impersonation (SECURITY DEFINER,
// gardée is_super_admin) AVANT d'activer la vue — un échec d'audit annule
// l'impersonation. L'ancien insert client fire-and-forget était contournable.
export function useImpersonate() {
  const [impersonating, setImpersonating] = useState<ImpersonatedUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  /** Retourne false (et n'active RIEN) si l'audit serveur échoue. */
  const startImpersonate = useCallback(async (target: ImpersonatedUser): Promise<boolean> => {
    const { error } = await supabase.rpc('admin_log_impersonation', {
      p_action: 'impersonate_start',
      p_target_id: target.id,
      // email + rôle cible sont résolus et journalisés côté serveur.
      p_metadata: {
        target_name: target.full_name,
        target_agency: target.agency_name,
      },
    })
    if (error) {
      console.error('[useImpersonate] audit (start) refused — impersonation aborted:', error.message)
      return false
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(target))
    setImpersonating(target)
    return true
  }, [])

  const stopImpersonate = useCallback(() => {
    const prev = impersonating
    // Libérer d'abord — ne jamais piéger l'admin dans la vue impersonée si
    // l'audit de sortie échoue ; on logge alors l'échec et on retente une fois.
    localStorage.removeItem(STORAGE_KEY)
    setImpersonating(null)

    if (prev) {
      supabase.rpc('admin_log_impersonation', {
        p_action: 'impersonate_stop',
        p_target_id: prev.id,
        p_metadata: { target_name: prev.full_name },
      }).then(({ error }) => {
        if (error) {
          console.error('[useImpersonate] audit (stop) write failed, retrying once:', error.message)
          void supabase.rpc('admin_log_impersonation', {
            p_action: 'impersonate_stop',
            p_target_id: prev.id,
            p_metadata: { target_name: prev.full_name, retry: true },
          })
        }
      })
    }
  }, [impersonating])

  return { impersonating, startImpersonate, stopImpersonate }
}
