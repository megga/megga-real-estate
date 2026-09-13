/**
 * Hook d'impersonation super-admin (« voir en tant que »), stocké en
 * localStorage côté client ; le vrai contrôle d'accès reste porté par RLS.
 *
 * ⚠ La vue est rangée PAR COMPTE (`megga-impersonate:<uid de l'admin>`, audit S11) :
 * rangée sous une clé fixe, elle survivait à la déconnexion et s'affichait au
 * compte suivant du même navigateur — bandeau « vous voyez en tant que … » compris.
 * La purge de fin de session la retire (@/lib/stockageParCompte) ; l'audit de
 * sortie d'une déconnexion est écrit par useAuth.handleSignOut, avant signOut.
 *
 * `useSyncExternalStore` et non un `useState` par instance : le bandeau, le
 * copilote et le Messenger lisent la MÊME vue — un arrêt dans l'un doit se voir
 * dans les autres, et dans les autres onglets (événement `storage`).
 */
import { useCallback, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cleDuCompte } from '@/lib/stockageParCompte'

interface ImpersonatedUser {
  id: string
  full_name: string
  email: string
  role: string
  agency_id: string | null
  agency_name: string | null
}

const STORAGE_KEY = 'megga-impersonate'

const abonnes = new Set<() => void>()
const notifier = () => { for (const f of abonnes) f() }

function abonner(f: () => void): () => void {
  abonnes.add(f)
  const surStockage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(`${STORAGE_KEY}:`)) f()
  }
  window.addEventListener('storage', surStockage)
  return () => {
    abonnes.delete(f)
    window.removeEventListener('storage', surStockage)
  }
}

function lireBrut(cle: string): string | null {
  try {
    return localStorage.getItem(cle)
  } catch {
    return null
  }
}

// Le cliché est la chaîne BRUTE (stable d'un rendu à l'autre) ; son analyse est
// mémorisée, pour rendre le même objet tant que la valeur ne change pas.
let dernierBrut: string | null = null
let dernierLu: ImpersonatedUser | null = null
function analyser(brut: string | null): ImpersonatedUser | null {
  if (brut === dernierBrut) return dernierLu
  dernierBrut = brut
  try {
    dernierLu = brut ? (JSON.parse(brut) as ImpersonatedUser) : null
  } catch {
    dernierLu = null
  }
  return dernierLu
}

// Vue « impersonation » super-admin (localStorage, lecture seule côté client).
// AUDIT-FIRST (migration 20260705160000) : l'événement activity_events est
// écrit côté serveur par la RPC admin_log_impersonation (SECURITY DEFINER,
// gardée is_super_admin) AVANT d'activer la vue — un échec d'audit annule
// l'impersonation. L'ancien insert client fire-and-forget était contournable.
export function useImpersonate() {
  const { user } = useAuth()
  const cle = user?.id ? cleDuCompte(STORAGE_KEY, user.id) : null
  const brut = useSyncExternalStore(abonner, () => (cle ? lireBrut(cle) : null), () => null)
  const impersonating = analyser(brut)

  /** Retourne false (et n'active RIEN) si l'audit serveur échoue — ou sans compte. */
  const startImpersonate = useCallback(async (target: ImpersonatedUser): Promise<boolean> => {
    if (!cle) return false
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
    try {
      localStorage.setItem(cle, JSON.stringify(target))
    } catch {
      return false
    }
    notifier()
    return true
  }, [cle])

  const stopImpersonate = useCallback(() => {
    const prev = impersonating
    // Libérer d'abord — ne jamais piéger l'admin dans la vue impersonée si
    // l'audit de sortie échoue ; on logge alors l'échec et on retente une fois.
    if (cle) {
      try { localStorage.removeItem(cle) } catch { /* rien à retirer */ }
    }
    notifier()

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
  }, [impersonating, cle])

  return { impersonating, startImpersonate, stopImpersonate }
}
