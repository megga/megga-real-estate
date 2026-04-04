import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface BillingStats {
  mrr: number
  totalSubscriptions: number
  activeSubscriptions: number
  churnedThisMonth: number
  planBreakdown: { plan: string; count: number; revenue: number }[]
  recentSubscriptions: {
    id: string
    agency_name: string | null
    plan: string
    price: number
    status: string
    created_at: string
  }[]
}

export function useAdminBilling() {
  return useQuery({
    queryKey: ['admin-billing'],
    queryFn: async (): Promise<BillingStats> => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      const { data: subs, error } = await supabase
        .from('subscriptions')
        .select('id, agency_id, plan, status, price, interval, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error

      const allSubs = subs ?? []
      const activeSubs = allSubs.filter(s => s.status === 'active')

      // MRR calculation: sum of monthly prices for active subs
      const mrr = activeSubs.reduce((sum, s) => {
        const monthlyPrice = s.interval === 'year' ? (s.price ?? 0) / 12 : (s.price ?? 0)
        return sum + monthlyPrice
      }, 0)

      // Churned this month
      const churned = allSubs.filter(s =>
        s.status === 'canceled' && s.created_at >= monthStart
      ).length

      // Plan breakdown
      const planMap = new Map<string, { count: number; revenue: number }>()
      for (const sub of activeSubs) {
        const plan = sub.plan ?? 'unknown'
        const existing = planMap.get(plan) ?? { count: 0, revenue: 0 }
        const monthlyPrice = sub.interval === 'year' ? (sub.price ?? 0) / 12 : (sub.price ?? 0)
        planMap.set(plan, { count: existing.count + 1, revenue: existing.revenue + monthlyPrice })
      }
      const planBreakdown = Array.from(planMap.entries()).map(([plan, data]) => ({
        plan,
        ...data,
      }))

      // Resolve agency names for recent subs
      const agencyIds = [...new Set(allSubs.slice(0, 10).map(s => s.agency_id).filter(Boolean))]
      let agencyMap: Record<string, string> = {}
      if (agencyIds.length > 0) {
        const { data: agencies } = await supabase.from('agencies').select('id, name').in('id', agencyIds as string[])
        agencyMap = Object.fromEntries((agencies ?? []).map(a => [a.id, a.name]))
      }

      const recentSubscriptions = allSubs.slice(0, 10).map(s => ({
        id: s.id,
        agency_name: s.agency_id ? agencyMap[s.agency_id] ?? null : null,
        plan: s.plan ?? 'unknown',
        price: s.price ?? 0,
        status: s.status ?? 'unknown',
        created_at: s.created_at,
      }))

      return {
        mrr: Math.round(mrr),
        totalSubscriptions: allSubs.length,
        activeSubscriptions: activeSubs.length,
        churnedThisMonth: churned,
        planBreakdown,
        recentSubscriptions,
      }
    },
    staleTime: 60_000,
  })
}
