import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export interface SavedSearch {
  id: string
  user_id: string
  name: string
  filters: Record<string, unknown>
  alert_enabled: boolean
  alert_email: string | null
  alert_frequency: 'instant' | 'daily' | 'weekly'
  results_count: number
  created_at: string
  updated_at: string
}

interface CreateSavedSearchInput {
  name: string
  filters: Record<string, unknown>
  alert_enabled?: boolean
  alert_email?: string
  alert_frequency?: 'instant' | 'daily' | 'weekly'
  results_count?: number
}

export function useSavedSearches() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const savedSearchesQuery = useQuery({
    queryKey: ['saved-searches', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as SavedSearch[]
    },
    enabled: !!user,
  })

  const createMutation = useMutation({
    mutationFn: async (input: CreateSavedSearchInput) => {
      if (!user) throw new Error('Non connecté')
      const { data, error } = await supabase
        .from('saved_searches')
        .insert({
          user_id: user.id,
          name: input.name,
          filters: input.filters,
          alert_enabled: input.alert_enabled ?? false,
          alert_email: input.alert_email ?? user.email,
          alert_frequency: input.alert_frequency ?? 'daily',
          results_count: input.results_count ?? 0,
        })
        .select()
        .single()
      if (error) throw error
      return data as SavedSearch
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('saved_searches')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] })
    },
  })

  const toggleAlertMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('saved_searches')
        .update({ alert_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] })
    },
  })

  return {
    savedSearches: savedSearchesQuery.data ?? [],
    isLoading: savedSearchesQuery.isLoading,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    remove: deleteMutation.mutateAsync,
    toggleAlert: toggleAlertMutation.mutateAsync,
  }
}
