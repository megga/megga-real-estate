/**
 * Hook super-admin — métriques de facturation Stripe (MRR, churn, ARPU, plans).
 * Tente d'abord l'Edge Function `admin-stripe-metrics` (API Stripe live) ; si elle
 * est absente ou Stripe non configuré, retombe sur un calcul dérivé de la table
 * `subscriptions`. Le champ `source` indique laquelle a répondu.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PLANS } from '@/lib/plans'

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

/**
 * Récupère les métriques de facturation (MRR, abonnements, churn, plans) pour le
 * dashboard admin. staleTime 2 min car les appels Stripe sont coûteux.
 */
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

      // Fallback : table subscriptions (miroir stripe-webhook). Elle ne stocke
      // aucun montant — le prix mensuel est dérivé du catalogue PLANS selon
      // billing_period (price_yearly = prix mensuel en facturation annuelle).
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const { data: subs, error: subsError } = await supabase
        .from('subscriptions')
        .select('id, agency_id, plan, status, billing_period, created_at, updated_at')
        .order('created_at', { ascending: false })
      if (subsError) throw subsError

      const monthlyPrice = (plan: string | null, billingPeriod: string | null) => {
        const config = PLANS.find(p => p.id === plan)
        if (!config) return 0
        return billingPeriod === 'yearly' ? config.price_yearly : config.price_monthly
      }

      const allSubs = subs ?? []
      const activeSubs = allSubs.filter(s => s.status === 'active')

      const mrr = activeSubs.reduce((sum, s) => sum + monthlyPrice(s.plan, s.billing_period), 0)

      // Annulations du mois : updated_at porte la bascule de statut posée par
      // stripe-webhook (created_at = date de souscription, pas d'annulation).
      const churned = allSubs.filter(s => s.status === 'canceled' && (s.updated_at ?? '') >= monthStart).length
      const pastDue = allSubs.filter(s => s.status === 'past_due').length

      const planMap = new Map<string, { count: number; mrr: number }>()
      for (const sub of activeSubs) {
        const plan = sub.plan ?? 'unknown'
        const existing = planMap.get(plan) ?? { count: 0, mrr: 0 }
        planMap.set(plan, { count: existing.count + 1, mrr: existing.mrr + monthlyPrice(sub.plan, sub.billing_period) })
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
