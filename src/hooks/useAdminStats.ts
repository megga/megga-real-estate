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

export function useAdminStats() {
  const kpis = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async (): Promise<AdminKPIs> => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [agencies, users, properties, transactions, kyc, newAgencies, newUsers] = await Promise.all([
        supabase.from('agencies').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('kyc_cases').select('id', { count: 'exact', head: true }).eq('risk_level', 'high'),
        supabase.from('agencies').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
      ])

      return {
        activeAgencies: agencies.count ?? 0,
        totalUsers: users.count ?? 0,
        activeProperties: properties.count ?? 0,
        activeTransactions: transactions.count ?? 0,
        estimatedMRR: 0,
        highRiskKyc: kyc.count ?? 0,
        newAgenciesThisMonth: newAgencies.count ?? 0,
        newUsersThisMonth: newUsers.count ?? 0,
      }
    },
    staleTime: 30_000,
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
    staleTime: 30_000,
  })

  return {
    kpis: kpis.data,
    kpisLoading: kpis.isLoading,
    alerts: alerts.data ?? [],
    alertsLoading: alerts.isLoading,
  }
}
