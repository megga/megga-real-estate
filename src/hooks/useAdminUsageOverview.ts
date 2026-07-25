// P6a — Vue comparative usage par agence (super-admin).
// RPC get_admin_usage_overview : 1 ligne/agence (agrégats mois courant + caps),
// triée coût IA décroissant côté serveur.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface UsageOverviewRow {
  agency_id: string
  agency_name: string
  plan: string
  status: string
  active_properties: number
  contacts_count: number
  ai_cost_month_usd: number
  wa_messages_month: number
  storage_est_mb: number
  portals_active: number
  last_activity_at: string | null
  caps: {
    ai_monthly_cost_cap_usd?: number | null
    active_properties_cap?: number | null
    whatsapp_monthly_cap?: number | null
    storage_cap_mb?: number | null
    alert_threshold_pct?: number
  }
}

export function useAdminUsageOverview(enabled = true) {
  return useQuery({
    queryKey: ['admin-usage-overview'],
    queryFn: async (): Promise<UsageOverviewRow[]> => {
      const { data, error } = await supabase.rpc('get_admin_usage_overview')
      if (error) throw error
      return (data as UsageOverviewRow[] | null) ?? []
    },
    enabled,
    staleTime: 60_000,
  })
}
