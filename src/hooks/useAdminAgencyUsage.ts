// P6a — Usage consolidé + quotas d'une agence (super-admin).
//  Lecture : RPC get_admin_agency_usage (agrégats mois courant) + table
//  agency_usage_quotas (caps, RLS super_admin).
//  Écriture : RPC admin_set_agency_quotas (auditée quota_changed).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AgencyUsage {
  active_properties: number
  contacts_count: number
  ai_cost_month_usd: number
  ai_calls_month: number
  wa_messages_month: number
  storage_est_mb: number
  portals_active: number
  last_activity_at: string | null
}

export interface AgencyQuotas {
  ai_monthly_cost_cap_usd: number | null
  active_properties_cap: number | null
  whatsapp_monthly_cap: number | null
  storage_cap_mb: number | null
  alert_threshold_pct: number
}

export function useAdminAgencyUsage(agencyId: string) {
  const usage = useQuery({
    queryKey: ['admin-agency-usage', agencyId],
    queryFn: async (): Promise<AgencyUsage | null> => {
      const { data, error } = await supabase.rpc('get_admin_agency_usage', { p_agency_id: agencyId })
      if (error) throw error
      const row = ((data as AgencyUsage[] | null) ?? [])[0]
      return row ?? null
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const quotas = useQuery({
    queryKey: ['admin-agency-quotas', agencyId],
    queryFn: async (): Promise<AgencyQuotas | null> => {
      const { data, error } = await supabase
        .from('agency_usage_quotas')
        .select('ai_monthly_cost_cap_usd, active_properties_cap, whatsapp_monthly_cap, storage_cap_mb, alert_threshold_pct')
        .eq('agency_id', agencyId)
        .maybeSingle()
      if (error) throw error
      return (data as AgencyQuotas | null) ?? null
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  return {
    usage: usage.data ?? null,
    usageLoading: usage.isLoading,
    usageError: usage.isError,
    quotas: quotas.data ?? null,
    quotasLoading: quotas.isLoading,
  }
}

export function useSetAgencyQuotas(agencyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ quotas, note }: { quotas: Partial<AgencyQuotas>; note?: string }) => {
      const { error } = await supabase.rpc('admin_set_agency_quotas', {
        p_agency_id: agencyId,
        p_quotas: quotas,
        p_note: note || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-agency-quotas', agencyId] })
      void queryClient.invalidateQueries({ queryKey: ['admin-usage-overview'] })
    },
  })
}
