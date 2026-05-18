import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface AdminKPIs {
  activeAgencies: number
  totalUsers: number
  activeProperties: number
  activeTransactions: number
  estimatedMRR: number
  highRiskKyc: number
  newAgenciesThisMonth: number
  newUsersThisMonth: number
}

interface AlertEvent {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
}

interface AdminStatsRow {
  active_agencies: number
  total_users: number
  active_properties: number
  active_transactions: number
  high_risk_kyc: number
  new_agencies_this_month: number
  new_users_this_month: number
}

export function useAdminStats() {
  // Single RPC call replaces 7 parallel count:'exact' queries (red-team perf
  // fix — CLAUDE.md §7 violation, 7 full table scans → 1 SQL function).
  const kpis = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async (): Promise<AdminKPIs> => {
      const { data, error } = await supabase.rpc('get_admin_dashboard_stats')
      if (error) throw error
      const row = ((data as AdminStatsRow[] | null) ?? [])[0]
      return {
        activeAgencies: Number(row?.active_agencies ?? 0),
        totalUsers: Number(row?.total_users ?? 0),
        activeProperties: Number(row?.active_properties ?? 0),
        activeTransactions: Number(row?.active_transactions ?? 0),
        estimatedMRR: 0,
        highRiskKyc: Number(row?.high_risk_kyc ?? 0),
        newAgenciesThisMonth: Number(row?.new_agencies_this_month ?? 0),
        newUsersThisMonth: Number(row?.new_users_this_month ?? 0),
      }
    },
    staleTime: 60_000,
  })

  const alerts = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: async (): Promise<AlertEvent[]> => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, entity_id, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []) as AlertEvent[]
    },
    staleTime: 60_000,
  })

  return {
    kpis: kpis.data,
    kpisLoading: kpis.isLoading,
    alerts: alerts.data ?? [],
    alertsLoading: alerts.isLoading,
  }
}
