/**
 * Hook super-admin — poste de triage des plans (`get_admin_plans_board()`).
 *
 * Une seule RPC pour toute la page Plans : MRR total calculé par la règle serveur
 * (`agency_mrr_rule`, jamais recalculée côté front — §4.3), portefeuille trié par
 * MRR décroissant, files Impayés / Essais déjà découpées, grille C2
 * (`app_config.plan_pricing`) et champs sans source NOMMÉS dans `unavailable`
 * (`seats_saturated` y restera tant que la décision PO n° 4 n'aura pas arbitré
 * le plafond de sièges — la file correspondante ne doit pas être fabriquée ici).
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Ligne du portefeuille. Re-typée à la main : la RPC rend `jsonb` (`Returns: Json`),
 *  que le générateur ne sait pas affiner — le NOM de la RPC reste vérifié par les
 *  types générés. `state` est dérivé côté serveur (essai / impayé / actif / aucun). */
export interface PlansBoardRow {
  id: string
  name: string
  agency_status: string | null
  plan: string | null
  billing_period: string | null
  sub_status: string | null
  current_period_end: string | null
  trial_end: string | null
  last_invoice_status: string | null
  seats_used: number
  state: 'trial' | 'unpaid' | 'active' | 'none'
  mrr: number | string
}

/** Prix mensuels/annuels d'un plan dans la grille C2 (`app_config.plan_pricing`). */
export interface PlanPricing {
  monthly?: number | string
  yearly?: number | string
}

export interface PlansBoard {
  mrr: number | string
  subscriptions: number
  arpu: number | string
  portfolio: PlansBoardRow[]
  queues: { unpaid: PlansBoardRow[]; trials: PlansBoardRow[] }
  plans: Array<{ plan: string; count: number; mrr: number | string }>
  pricing_source: Record<string, PlanPricing> | null
  unavailable: string[]
}

export function useAdminPlansBoard() {
  return useQuery({
    queryKey: ['admin-plans-board'],
    staleTime: 60_000,
    queryFn: async (): Promise<PlansBoard> => {
      const { data, error } = await supabase.rpc('get_admin_plans_board')
      if (error) throw error
      return data as unknown as PlansBoard
    },
  })
}
