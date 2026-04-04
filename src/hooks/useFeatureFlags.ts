import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface FeatureFlag {
  id: string
  key: string
  label: string
  description: string
  enabled_globally: boolean
  enabled_plans: string[] // ['pro', 'agency']
  enabled_agencies: string[] // specific agency IDs
  created_at: string
}

// Default feature flags — stored in admin_notes with entity_type = 'feature_flag'
const DEFAULT_FLAGS: Omit<FeatureFlag, 'id' | 'created_at'>[] = [
  { key: 'virtual_staging', label: 'Virtual Staging IA', description: 'Meubler virtuellement les photos de biens', enabled_globally: false, enabled_plans: ['pro', 'agency'], enabled_agencies: [] },
  { key: 'ai_copilot', label: 'MEGGA AI Copilot', description: 'Copilote IA pour les agents', enabled_globally: true, enabled_plans: [], enabled_agencies: [] },
  { key: 'floor_plan', label: 'Plan interactif', description: 'Floor plan cliquable avec hotspots', enabled_globally: false, enabled_plans: ['pro', 'agency'], enabled_agencies: [] },
  { key: 'kyc_screening', label: 'Screening PEP/Sanctions', description: 'Verification automatique PEP et sanctions', enabled_globally: true, enabled_plans: [], enabled_agencies: [] },
  { key: 'matching_engine', label: 'Matching acheteurs', description: 'Matching automatique acheteurs et biens', enabled_globally: true, enabled_plans: [], enabled_agencies: [] },
  { key: 'calendar_sync', label: 'Sync calendrier', description: 'Synchronisation Google/Outlook Calendar', enabled_globally: false, enabled_plans: ['pro', 'agency'], enabled_agencies: [] },
  { key: 'csv_import', label: 'Import CSV contacts', description: 'Import de contacts via CSV/vCard', enabled_globally: true, enabled_plans: [], enabled_agencies: [] },
  { key: 'seller_portal', label: 'Portail vendeur', description: 'Portail de suivi pour les vendeurs', enabled_globally: false, enabled_plans: ['agency'], enabled_agencies: [] },
]

export function useFeatureFlags() {
  const queryClient = useQueryClient()

  const flags = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: async (): Promise<FeatureFlag[]> => {
      const { data, error } = await supabase
        .from('admin_notes')
        .select('id, content, created_at')
        .eq('entity_type', 'feature_flag')
        .order('created_at', { ascending: true })
      if (error) throw error

      if (!data || data.length === 0) {
        // Initialize with defaults
        const profile = await supabase.auth.getUser()
        const inserts = DEFAULT_FLAGS.map(f => ({
          entity_type: 'feature_flag',
          entity_id: f.key,
          content: JSON.stringify(f),
          author_id: profile.data.user?.id,
        }))
        await supabase.from('admin_notes').insert(inserts)
        return DEFAULT_FLAGS.map((f, i) => ({ ...f, id: `init-${i}`, created_at: new Date().toISOString() }))
      }

      return data.map(n => {
        const parsed = JSON.parse(n.content)
        return { ...parsed, id: n.id, created_at: n.created_at }
      })
    },
    staleTime: 60_000,
  })

  const updateFlag = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FeatureFlag> }) => {
      // Read current, merge, save
      const { data } = await supabase.from('admin_notes').select('content').eq('id', id).single()
      if (!data) throw new Error('Flag not found')
      const current = JSON.parse(data.content)
      const merged = { ...current, ...updates }
      const { error } = await supabase.from('admin_notes').update({ content: JSON.stringify(merged) }).eq('id', id)
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
