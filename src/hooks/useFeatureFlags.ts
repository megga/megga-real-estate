// MEGGA CRM Sugar v2 — Feature flags admin.
// Source de vérité : table `admin_feature_flags` (migration 20260518_001).
// Remplace les DEFAULT_FLAGS hardcodés + hack init lazy via admin_notes.
// Le seed initial des 8 flags est fait dans la migration SQL.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface FeatureFlag {
  id: string
  key: string
  label: string
  description: string
  enabled_globally: boolean
  enabled_plans: string[]
  enabled_agencies: string[]
  created_at: string
}

export function useFeatureFlags() {
  const queryClient = useQueryClient()

  const flags = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: async (): Promise<FeatureFlag[]> => {
      const { data, error } = await supabase
        .from('admin_feature_flags')
        .select('id, key, label, description, enabled_globally, enabled_plans, enabled_agencies, created_at')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as FeatureFlag[]
    },
    staleTime: 60_000,
  })

  const updateFlag = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FeatureFlag> }) => {
      const { error } = await supabase
        .from('admin_feature_flags')
        .update({
          ...(updates.label !== undefined && { label: updates.label }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.enabled_globally !== undefined && { enabled_globally: updates.enabled_globally }),
          ...(updates.enabled_plans !== undefined && { enabled_plans: updates.enabled_plans }),
          ...(updates.enabled_agencies !== undefined && { enabled_agencies: updates.enabled_agencies }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] }),
  })

  return {
    flags: flags.data ?? [],
    isLoading: flags.isLoading,
    updateFlag,
  }
}
