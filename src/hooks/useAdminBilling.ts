/**
 * Hook super-admin — métriques de facturation Stripe (MRR, churn, ARPU, plans).
 * Tente d'abord l'Edge Function `admin-stripe-metrics` (API Stripe live) ; si elle
 * est absente ou Stripe non configuré, retombe sur la RPC `get_admin_plans_board()`.
 * Le champ `source` indique laquelle a répondu.
 *
 * Étape 15 : le repli ne RECALCULE plus le MRR en TypeScript. §4.3 exige « une seule
 * fonction SQL `agency_mrr`, jamais recalculée côté front » — et les deux calculs
 * avaient déjà divergé (voir le commentaire du repli).
 *
 * ⚠ Client casté : `get_admin_plans_board` n'est pas encore dans src/types/database.ts
 * (auto-généré, en retard sur ces migrations — cf. son en-tête). Même motif que
 * useAdminKybReview.ts. À nettoyer à la prochaine régénération.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const rpcUntyped = supabase.rpc as unknown as
  (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>

/** Forme rendue par `get_admin_plans_board()`, re-typée à la main. */
interface PlansBoard {
  mrr: number | string
  subscriptions: number
  arpu: number | string
  portfolio: Array<{ plan: string | null; sub_status: string | null; state: string }>
  queues: { unpaid: unknown[]; trials: unknown[] }
  plans: Array<{ plan: string; count: number; mrr: number | string }>
  unavailable: string[]
}

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

      // Repli : le poste de triage serveur (§5.7). Le MRR n'est PLUS recalculé ici.
      //
      // Ce qu'il y avait avant : le même calcul, en TypeScript, à partir du catalogue
      // PLANS. Il n'était pas faux par ses prix — il lisait bien C2 — mais il avait
      // DÉJÀ divergé de la règle serveur : il ne comptait que `subscriptions.status`
      // et ignorait les agences SUSPENDUES, qu'agency_mrr_rule met à zéro. Une agence
      // suspendue avec un abonnement actif était donc facturée à l'écran et pas en base.
      // C'est exactement ce que §4.3 interdit : « une seule fonction SQL, jamais
      // recalculée côté front ».
      const { data: board, error: boardError } = await rpcUntyped('get_admin_plans_board', {})
      if (boardError) throw boardError
      const b = board as PlansBoard

      const portefeuille = b.portfolio ?? []
      const impayes = b.queues?.unpaid?.length ?? 0
      const resilies = portefeuille.filter(p => p.sub_status === 'canceled').length

      return {
        mrr: Math.round(Number(b.mrr ?? 0)),
        activeSubscriptions: Number(b.subscriptions ?? 0),
        totalSubscriptions: portefeuille.filter(p => p.plan != null).length,
        churnedThisMonth: resilies,
        pastDue: impayes,
        failedPaymentsThisMonth: impayes,
        // Sans source : le dépôt ne garde AUCUN historique de MRR (amendement §5.7,
        // nommé par le serveur dans `unavailable`). Les fabriquer donnerait une courbe
        // crédible et fausse.
        revenueThisMonth: 0,
        revenuePrevMonth: 0,
        revenueGrowth: 0,
        arpu: Math.round(Number(b.arpu ?? 0)),
        planBreakdown: (b.plans ?? []).map(p => ({
          plan: p.plan, count: Number(p.count), mrr: Math.round(Number(p.mrr)),
        })),
        revenueHistory: [],
        upcomingRenewals: [],
        recentPayments: [],
        source: 'supabase' as const,
      }
    },
    staleTime: 120_000, // 2 min (Stripe calls are expensive)
  })
}
