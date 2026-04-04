import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ActivityLogEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
  agency_id: string | null
  actor_id: string | null
}

interface ActivityLogFilters {
  agencyId?: string
  action?: string
  limit?: number
}

export function useActivityLog(filters?: ActivityLogFilters) {
  return useQuery({
    queryKey: ['admin-activity-log', filters],
    queryFn: async (): Promise<ActivityLogEntry[]> => {
      let query = supabase
        .from('activity_events')
        .select('id, action, entity_type, entity_id, metadata, created_at, agency_id, actor_id')
        .order('created_at', { ascending: false })
        .limit(filters?.limit ?? 100)

      if (filters?.agencyId) query = query.eq('agency_id', filters.agencyId)
      if (filters?.action) query = query.eq('action', filters.action)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as ActivityLogEntry[]
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
