// MEGGA CRM — WhatsApp autonomy suggestions admin hook.
// Reads from RPC `get_whatsapp_autonomy_suggestions` (migration P3b Task 7).
// Read-only: MEGGA observes, the human decides. No autonomy mutation here.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AutonomyRow {
  profile_id: string
  agent_name: string | null
  agency_id: string | null
  autonomy: string | null
  tool: string
  yes_count: number
  no_count: number
  last_no_at: string | null
  suggest_resume: boolean
}

/** File les suggestions d'autonomie WhatsApp (RPC `get_whatsapp_autonomy_suggestions`), agrégées par agent × outil. */
export function useAdminAutonomy() {
  return useQuery({
    queryKey: ['admin', 'autonomy-suggestions'],
    queryFn: async (): Promise<AutonomyRow[]> => {
      const { data, error } = await (supabase.rpc as unknown as
        (fn: string) => Promise<{ data: unknown; error: Error | null }>)('get_whatsapp_autonomy_suggestions')
      if (error) throw error
      return (data ?? []) as AutonomyRow[]
    },
    staleTime: 60_000,
  })
}
