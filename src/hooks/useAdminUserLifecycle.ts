// Cycle de vie des comptes (P4 admin) — mutations vers les edges
// admin-user-lifecycle / delete-account (branche admin). Chaque action est
// journalisée côté serveur ; les comptes allowlistés sont refusés par l'edge
// (anti-auto-lockout).

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ErreurEdge, lireRefusEdge } from '@/lib/refusEdge'

export type UserLifecycleAction = 'suspend' | 'reactivate' | 'force_password_reset'

/**
 * Appelle une edge de cycle de vie ; un refus lève une `ErreurEdge` qui PORTE le motif du
 * serveur. ⛔ `functions.invoke` ne rend qu'un « non-2xx » générique : jeté tel quel, le
 * tiroir ne pouvait afficher qu'une cause unique, fausse la plupart du temps.
 */
async function appeler(nom: 'admin-user-lifecycle' | 'delete-account', body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(nom, { body })
  if (error) throw new ErreurEdge(await lireRefusEdge(error))
  return data
}

/**
 * Mutations de cycle de vie compte (suspend / reactivate / force_password_reset
 * + suppression) déléguées aux edges admin. Invalide `admin-users` au succès.
 */
export function useAdminUserLifecycle() {
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  }

  const lifecycle = useMutation({
    mutationFn: ({ action, userId }: { action: UserLifecycleAction; userId: string }) =>
      appeler('admin-user-lifecycle', { action, user_id: userId }),
    onSuccess: invalidate,
  })

  const deleteAccount = useMutation({
    mutationFn: ({ userId }: { userId: string }) => appeler('delete-account', { target_user_id: userId }),
    onSuccess: invalidate,
  })

  return { lifecycle, deleteAccount }
}
