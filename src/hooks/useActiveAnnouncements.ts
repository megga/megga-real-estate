// P8a — Annonces actives pour l'agent courant.
// La RLS (announcements_select) ne renvoie que les annonces publiées, dans leur
// fenêtre et ciblées sur le plan/agence de l'agent. On retire ici celles déjà
// rejetées (platform_announcement_dismissals) et on expose un dismiss().

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface ActiveAnnouncement {
  id: string
  title: string
  body: string
  severity: 'info' | 'warning' | 'critical'
  cta_label: string | null
  cta_href: string | null
}

export function useActiveAnnouncements() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['active-announcements', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ActiveAnnouncement[]> => {
      const [{ data: rows, error }, { data: dismissed }] = await Promise.all([
        supabase
          .from('platform_announcements')
          .select('id, title, body, severity, cta_label, cta_href')
          .eq('published', true)
          .order('starts_at', { ascending: false }),
        supabase.from('platform_announcement_dismissals').select('announcement_id'),
      ])
      if (error) throw error
      const dismissedIds = new Set((dismissed ?? []).map(d => d.announcement_id))
      return ((rows ?? []) as ActiveAnnouncement[]).filter(a => !dismissedIds.has(a.id))
    },
  })

  const dismiss = useMutation({
    mutationFn: async (announcementId: string) => {
      if (!user?.id) return
      const { error } = await supabase
        .from('platform_announcement_dismissals')
        .insert({ announcement_id: announcementId, user_id: user.id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['active-announcements'] }),
  })

  return { announcements: query.data ?? [], dismiss }
}
