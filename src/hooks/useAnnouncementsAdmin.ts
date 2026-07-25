// P8a — CRUD des annonces in-app côté super-admin.
// La RLS (announcements_write) réserve l'écriture au super-admin ; la lecture
// admin voit tout (is_super_admin). La publication est auditée par trigger.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Announcement {
  id: string
  title: string
  body: string
  severity: 'info' | 'warning' | 'critical'
  audience_plans: string[]
  audience_agencies: string[]
  starts_at: string
  ends_at: string | null
  cta_label: string | null
  cta_href: string | null
  published: boolean
  created_at: string
}

export type AnnouncementInput = Omit<Announcement, 'id' | 'created_at'>

export function useAnnouncementsAdmin() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-announcements'] })

  const list = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from('platform_announcements')
        .select('id, title, body, severity, audience_plans, audience_agencies, starts_at, ends_at, cta_label, cta_href, published, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Announcement[]
    },
    staleTime: 30_000,
  })

  const create = useMutation({
    mutationFn: async (input: AnnouncementInput) => {
      const { error } = await supabase.from('platform_announcements').insert(input)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<AnnouncementInput> }) => {
      const { error } = await supabase.from('platform_announcements').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('platform_announcements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return {
    announcements: list.data ?? [],
    isLoading: list.isLoading,
    create,
    update,
    remove,
  }
}
