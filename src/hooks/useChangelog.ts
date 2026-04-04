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

export function useChangelog() {
  const queryClient = useQueryClient()

  const entries = useQuery({
    queryKey: ['admin-changelog'],
    queryFn: async (): Promise<ChangelogEntry[]> => {
      // Try to query — table may not exist yet, use admin_notes as storage
      const { data, error } = await supabase
        .from('admin_notes')
        .select('id, content, entity_id, entity_type, created_at')
        .eq('entity_type', 'changelog')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map(n => {
        let parsed = { title: '', body: '', version: '', published: false }
        try { parsed = JSON.parse(n.content) } catch { parsed = { title: n.content, body: '', version: '', published: true } }
        return {
          id: n.id,
          title: parsed.title || 'Sans titre',
          content: parsed.body || '',
          version: parsed.version || null,
          published: parsed.published ?? true,
          created_at: n.created_at,
        }
      })
    },
    staleTime: 60_000,
  })

  const createEntry = useMutation({
    mutationFn: async (input: { title: string; content: string; version: string; published: boolean }) => {
      const { data: profile } = await supabase.auth.getUser()
      const { error } = await supabase.from('admin_notes').insert({
        entity_type: 'changelog',
        entity_id: crypto.randomUUID(),
        content: JSON.stringify({ title: input.title, body: input.content, version: input.version, published: input.published }),
        author_id: profile.user?.id,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-changelog'] }),
  })

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('admin_notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-changelog'] }),
  })

  return {
    entries: entries.data ?? [],
    isLoading: entries.isLoading,
    createEntry,
    deleteEntry,
  }
}
