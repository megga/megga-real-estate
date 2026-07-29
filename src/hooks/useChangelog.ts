// MEGGA CRM Sugar v2 — Changelog admin.
// Source de vérité : table `admin_changelog` (migration 20260518_001).
// Remplace le hack JSON dans `admin_notes` identifié dans l'audit red-team.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ChangelogEntry {
  id: string
  title: string
  content: string
  version: string | null
  published: boolean
  created_at: string
}

interface ChangelogRow {
  id: string
  title: string
  content: string
  version: string | null
  published: boolean
  created_at: string
}

/** Changelog admin (table `admin_changelog`) : liste triée par date + mutations create/delete, invalidées au succès. */
export function useChangelog() {
  const queryClient = useQueryClient()

  const entries = useQuery({
    queryKey: ['admin-changelog'],
    queryFn: async (): Promise<ChangelogEntry[]> => {
      const { data, error } = await supabase
        .from('admin_changelog')
        .select('id, title, content, version, published, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ChangelogRow[]
    },
    staleTime: 60_000,
  })

  const createEntry = useMutation({
    mutationFn: async (input: { title: string; content: string; version: string; published: boolean }) => {
      const { data: user } = await supabase.auth.getUser()
      const { error } = await supabase.from('admin_changelog').insert({
        title: input.title,
        content: input.content,
        version: input.version || null,
        published: input.published,
        author_id: user.user?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-changelog'] }),
  })

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('admin_changelog').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-changelog'] }),
  })

  return {
    entries: entries.data ?? [],
    isLoading: entries.isLoading,
    isError: entries.isError,
    refetch: entries.refetch,
    createEntry,
    deleteEntry,
  }
}
