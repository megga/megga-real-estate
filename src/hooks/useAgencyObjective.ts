/**
 * Objectif commercial de la période — la SEULE des trois RPC du cockpit dont le
 * pied de la barre latérale a besoin.
 *
 * ⚠ Pourquoi un hook à part plutôt que `useAxDashboardData` : celui-ci tire
 * `analytics_cockpit` ET `analytics_funnel` en plus, dont l'encart n'affiche
 * rien. La barre est montée sur les ~20 surfaces agent — y brancher trois RPC
 * agrégées pour n'en lire qu'une serait payer deux appels par minute d'usage,
 * sur chaque écran, pour rien.
 *
 * ⚠ La clé de cache est VOLONTAIREMENT identique à celle de `useAxDashboardData`
 * (`['ax-objectif', period, scope]`, même queryFn) : quand les deux demandent la
 * MÊME période, React Query sert une seule entrée et l'encart ne déclenche aucun
 * appel. Ne pas renommer cette clé sans renommer l'autre.
 *
 * ⛔ MAIS LA DÉDUP N'EST PAS ACQUISE, et il faut le dire : le cockpit s'ouvre sur
 * `'year'` (AxDashboard) tandis que l'encart demande `'month'` — deux clés, deux
 * appels. C'est assumé : l'encart annonce l'objectif DU MOIS, et le passer à
 * l'année pour économiser une requête changerait ce qu'il dit. La dédup joue dès
 * que l'agent bascule le cockpit sur « Mois ».
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { ObjectifJson } from '@/components/crm/analytics/buildAxData'
import type { AxPeriodId } from '@/components/crm/analytics/tokens'
import type { AxScope } from './useAxDashboardData'

type PgFns = Database['public']['Functions']

/** Ce que l'encart lit — dérivé de `ObjectifJson`, jamais de valeurs devinées. */
export interface AgencyObjective {
  /** Objectif saisi par l'agence, en CHF. */
  target: number
  /** L'agence a-t-elle SAISI un objectif ? false ⇒ pas de jauge, un renvoi aux Réglages. */
  targetIsSet: boolean
  /** Commissions réalisées à ce jour, en CHF. */
  realized: number
  /** Projection de fin de période, en CHF. */
  projected: number
  /** Part de la période écoulée, 0→1 — le repère « où l'on devrait en être ». */
  paceFrac: number
  /** Part de l'objectif déjà réalisée, bornée à 0→1 (la jauge ne déborde pas). */
  realizedFrac: number
  /** Est-on en avance sur le rythme attendu ? */
  ahead: boolean
}

export function useAgencyObjective(
  period: AxPeriodId = 'month',
  scope: AxScope = 'me',
  opts?: { enabled?: boolean },
): { data: AgencyObjective | null; isLoading: boolean } {
  const enabled = opts?.enabled ?? true
  const q = useQuery({
    queryKey: ['ax-objectif', period, scope],
    queryFn: async () => {
      const args: PgFns['analytics_objectif']['Args'] = { p_period: period, p_scope: scope }
      const { data, error } = await supabase.rpc('analytics_objectif', args as never)
      if (error) throw error
      return data as unknown as ObjectifJson
    },
    staleTime: 60_000,
    enabled,
  })

  const o = q.data
  // ⛔ `!o.period` autant que `!o` : la RPC rend `{}` — pas une erreur — quand le
  // JWT ne porte aucune agence. Sans ce second test, un compte sans agence lit
  // `target: 0`, `target_is_set: false`, et l'encart l'invite à définir un
  // objectif qu'il ne peut pas avoir. Même garde que `useAxDashboardData`.
  if (!o || !o.period) return { data: null, isLoading: q.isLoading }

  const target = o.target ?? 0
  const realized = o.realized ?? 0
  // `paceFrac` reproduit le calcul de buildAxData : la position du dernier
  // point réel dans la série, pas une fraction de calendrier — les deux
  // divergent en fin de période et la jauge doit dire la même chose que le
  // cockpit.
  const paceFrac = o.buckets > 1 ? o.realIdx / (o.buckets - 1) : 0
  return {
    data: {
      target,
      targetIsSet: !!o.target_is_set,
      realized,
      projected: o.projected ?? 0,
      paceFrac,
      realizedFrac: target > 0 ? Math.min(1, Math.max(0, realized / target)) : 0,
      ahead: realized >= Math.round(target * paceFrac),
    },
    isLoading: false,
  }
}
