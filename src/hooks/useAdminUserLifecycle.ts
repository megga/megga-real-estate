// Cycle de vie des comptes (P4 admin) — mutations vers les edges
// admin-user-lifecycle / delete-account (branche admin). Chaque action est
// journalisée côté serveur ; les comptes allowlistés sont refusés par l'edge
// (anti-auto-lockout).

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type UserLifecycleAction = 'suspend' | 'reactivate' | 'force_password_reset'

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
    mutationFn: async ({ action, userId }: { action: UserLifecycleAction; userId: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-user-lifecycle', {
        body: { action, user_id: userId },
      })
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })

  const deleteAccount = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { target_user_id: userId },
      })
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })

  return { lifecycle, deleteAccount }
}
