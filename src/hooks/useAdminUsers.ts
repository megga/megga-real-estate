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
}

export function useAdminUsers() {
  const queryClient = useQueryClient()

  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, role, phone, created_at, agency_id')
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
        agency_name: u.agency_id ? agencyMap[u.agency_id] ?? null : null,
      }))
    },
    staleTime: 30_000,
  })

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  return {
    users: users.data ?? [],
    isLoading: users.isLoading,
    updateRole,
  }
}

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
  })
}
