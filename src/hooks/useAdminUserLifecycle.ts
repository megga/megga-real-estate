// Cycle de vie des comptes (P4 admin) — mutations vers les edges
// admin-user-lifecycle / delete-account (branche admin). Chaque action est
// journalisée côté serveur ; les comptes allowlistés sont refusés par l'edge
// (anti-auto-lockout).

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type UserLifecycleAction = 'suspend' | 'reactivate' | 'force_password_reset'

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

export function useAdminAgencyLifecycle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ action, agencyId }: { action: 'suspend' | 'reactivate'; agencyId: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-agency-lifecycle', {
        body: { action, agency_id: agencyId },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-agencies'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}
