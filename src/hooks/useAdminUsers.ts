/**
 * Hooks super-admin — annuaire des utilisateurs de la plateforme.
 *
 * `useAdminUsers` liste tous les profils (nom d'agence résolu) et expose la
 * mutation de rôle via RPC `admin_set_user_role`. `useUserActivity` charge les
 * 10 derniers événements d'audit d'un utilisateur ; `useDsarExport` télécharge
 * l'export DSAR (nLPD art. 25) journalisé côté serveur.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AdminUser {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  role: string
  phone: string | null
  created_at: string
  agency_id: string | null
  agency_name: string | null
  is_suspended: boolean
}

/** Liste des profils (récents d'abord) avec nom d'agence résolu, plus la mutation de rôle (RPC super-admin). */
export function useAdminUsers() {
  const queryClient = useQueryClient()

  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, role, phone, created_at, agency_id, is_suspended')
        .order('created_at', { ascending: false })
      if (error) throw error

      const agencyIds = [...new Set((data ?? []).map(u => u.agency_id).filter(Boolean))]
      let agencyMap: Record<string, string> = {}
      if (agencyIds.length > 0) {
        const { data: agencies } = await supabase
          .from('agencies')
          .select('id, name')
          .in('id', agencyIds as string[])
        agencyMap = Object.fromEntries((agencies ?? []).map(a => [a.id, a.name]))
      }

      return (data ?? []).map(u => ({
        ...u,
        created_at: u.created_at ?? '',
        agency_name: u.agency_id ? agencyMap[u.agency_id] ?? null : null,
      }))
    },
    staleTime: 30_000,
  })

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      // profiles.role is no longer writable by the client — goes through the
      // admin_set_user_role SECURITY DEFINER RPC (guarded by is_super_admin()).
      const { error } = await supabase.rpc('admin_set_user_role', { p_user_id: id, p_role: role })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  return {
    users: users.data ?? [],
    isLoading: users.isLoading,
    isError: users.isError,
    refetch: users.refetch,
    updateRole,
  }
}

/** 10 derniers événements d'audit (`activity_events`) émis par un utilisateur donné. */
export function useUserActivity(userId: string) {
  return useQuery({
    queryKey: ['admin-user-activity', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, metadata, created_at')
        .eq('actor_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data ?? []
    },
    enabled: !!userId,
    staleTime: 30_000,
  })
}

// Export DSAR (nLPD art. 25) — télécharge le JSON agrégé produit par l'edge
// admin-dsar-export (l'export est journalisé côté serveur AVANT le retour).
export function useDsarExport() {
  return useMutation({
    mutationFn: async ({ userId, email }: { userId: string; email: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-dsar-export', {
        body: { user_id: userId },
      })
      if (error) throw error
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toLocaleDateString('fr-CH').replace(/\//g, '.')
      a.href = url
      a.download = `dsar-${email.replace(/[^a-z0-9.@-]/gi, '_')}-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
    },
  })
}
