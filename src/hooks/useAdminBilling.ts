import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface PlanBreakdown {
  plan: string
  count: number
  mrr: number
}

interface RecentPayment {
  id: string
  amount: number
  currency: string
  status: string
  customer_email: string | null
  description: string | null
  created: string
}

interface UpcomingRenewal {
  customer: string
  amount: number
  date: number
}

export interface StripeBillingData {
  mrr: number
  activeSubscriptions: number
  totalSubscriptions: number
  churnedThisMonth: number
  pastDue: number
  failedPaymentsThisMonth: number
  revenueThisMonth: number
  revenuePrevMonth: number
  revenueGrowth: number
  arpu: number
  planBreakdown: PlanBreakdown[]
  revenueHistory: { month: string; amount: number }[]
  upcomingRenewals: UpcomingRenewal[]
  recentPayments: RecentPayment[]
  source: 'stripe' | 'supabase'
}

export function useAdminBilling() {
  return useQuery({
    queryKey: ['admin-billing-stripe'],
    queryFn: async (): Promise<StripeBillingData> => {
      // Try Edge Function (Stripe API) first
      try {
        const { data, error } = await supabase.functions.invoke('admin-stripe-metrics')
        if (!error && data && !data.error) {
          return { ...data, source: 'stripe' as const }
        }
      } catch {
        // Edge Function not deployed yet or Stripe not configured — fallback
      }

      // Fallback: read from subscriptions table
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('id, agency_id, plan, status, price, interval, created_at')
        .order('created_at', { ascending: false })

      const allSubs = subs ?? []
      const activeSubs = allSubs.filter(s => s.status === 'active')

      const mrr = activeSubs.reduce((sum, s) => {
        const monthly = s.interval === 'year' ? (s.price ?? 0) / 12 : (s.price ?? 0)
        return sum + monthly
      }, 0)

      const churned = allSubs.filter(s => s.status === 'canceled' && s.created_at >= monthStart).length
      const pastDue = allSubs.filter(s => s.status === 'past_due').length

      const planMap = new Map<string, { count: number; mrr: number }>()
      for (const sub of activeSubs) {
        const plan = sub.plan ?? 'unknown'
        const existing = planMap.get(plan) ?? { count: 0, mrr: 0 }
        const monthly = sub.interval === 'year' ? (sub.price ?? 0) / 12 : (sub.price ?? 0)
        planMap.set(plan, { count: existing.count + 1, mrr: existing.mrr + monthly })
      }

      return {
        mrr: Math.round(mrr),
        activeSubscriptions: activeSubs.length,
        totalSubscriptions: allSubs.length,
        churnedThisMonth: churned,
        pastDue,
        failedPaymentsThisMonth: 0,
        revenueThisMonth: 0,
        revenuePrevMonth: 0,
        revenueGrowth: 0,
        arpu: activeSubs.length > 0 ? Math.round(mrr / activeSubs.length) : 0,
        planBreakdown: Array.from(planMap.entries()).map(([plan, data]) => ({ plan, ...data, mrr: Math.round(data.mrr) })),
        revenueHistory: [],
        upcomingRenewals: [],
        recentPayments: [],
        source: 'supabase' as const,
      }
    },
    staleTime: 120_000, // 2 min (Stripe calls are expensive)
  })
}
