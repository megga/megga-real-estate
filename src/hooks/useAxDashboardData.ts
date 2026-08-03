// MEGGA CRM — Source de données live du Dashboard Analytics « Cockpit Commission ».
// Remplace les 3 hooks v3 (useDashboardCockpit/Funnel/Objectif) pour la page routée :
// 3 RPC agrégés (analytics_cockpit/objectif/funnel) + 1 adaptateur pur buildAxData.
//
// Les RPC sont SECURITY DEFINER, l'agence vient du JWT (anti cross-tenant) ; le
// scope ('me'/'agency') est passé en paramètre et appliqué uniformément côté SQL.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { buildAxData, type CockpitJson, type ObjectifJson, type FunnelJson } from '@/components/crm-sugar/analytics/buildAxData'
import type { AxPeriodId, AxPeriodData } from '@/components/crm-sugar/analytics/tokens'

export type AxScope = 'me' | 'agency'

type PgFns = Database['public']['Functions']

/** Appel d'une RPC agrégée du cockpit ; remonte l'erreur.
 *
 *  `name` prend l'union des noms connus de `database.ts`, pas `string` : un dispatcher
 *  typé `string` éteint la vérification pour TOUS ses appelants d'un coup. `args` est
 *  indexé PAR ce nom — un `Record<string, unknown>` acceptait `{ p_period_TYPO: … }` en
 *  silence, pour finir en PGRST202 à l'exécution.
 *
 *  La sortie reste à affiner par l'appelant : les trois RPC rendent `Json`, que le
 *  générateur ne sait pas préciser. On ne peut pas garder un `T` explicite ici — TS
 *  n'infère pas partiellement les paramètres de type, et fixer `T` figerait aussi `N`,
 *  ce qui ré-éteindrait la vérification des arguments qu'on vient de gagner. */
async function rpc<N extends keyof PgFns>(name: N, args: PgFns[N]['Args']): Promise<unknown> {
  const { data, error } = await supabase.rpc(name, args as never)
  if (error) throw error
  return data
}

/**
 * Données live du cockpit Analytics : 3 RPC agrégés (cockpit / objectif / funnel)
 * pour une période et un scope (moi / agence), assemblés par buildAxData.
 * `enabled: false` garde les surfaces démo inertes (aucun appel RPC).
 */
export function useAxDashboardData(period: AxPeriodId, scope: AxScope, opts?: { enabled?: boolean }): {
  data: AxPeriodData | null
  isLoading: boolean
  isError: boolean
  refetch: () => void
} {
  const { t, i18n } = useTranslation('dashboard')
  // Rétro-compatible : `enabled` vaut true par défaut (appelants existants
  // inchangés). Permet aux surfaces démo de rester inertes (aucun appel RPC).
  const enabled = opts?.enabled ?? true
  const cockpit = useQuery({
    queryKey: ['ax-cockpit', period, scope],
    queryFn: () => rpc('analytics_cockpit', { p_period: period, p_scope: scope }) as Promise<CockpitJson>,
    staleTime: 60_000,
    enabled,
  })
  const objectif = useQuery({
    queryKey: ['ax-objectif', period, scope],
    queryFn: () => rpc('analytics_objectif', { p_period: period, p_scope: scope }) as Promise<ObjectifJson>,
    staleTime: 60_000,
    enabled,
  })
  const funnel = useQuery({
    queryKey: ['ax-funnel', period, scope],
    queryFn: () => rpc('analytics_funnel', { p_period: period, p_scope: scope }) as Promise<FunnelJson>,
    staleTime: 60_000,
    enabled,
  })

  const isLoading = cockpit.isLoading || objectif.isLoading || funnel.isLoading
  const isError = cockpit.isError || objectif.isError || funnel.isError
  const refetch = () => {
    void cockpit.refetch()
    void objectif.refetch()
    void funnel.refetch()
  }

  const data = useMemo<AxPeriodData | null>(() => {
    if (isLoading) return null
    if (!cockpit.data || !objectif.data || !funnel.data) return null
    // Un payload vide ('{}') signale une agence absente (JWT sans agence).
    if (!objectif.data.period) return null
    return buildAxData(period, cockpit.data, objectif.data, funnel.data, t)
    // i18n.language dans les deps : recalcule les libellés au changement de langue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, isLoading, cockpit.data, objectif.data, funnel.data, i18n.language])

  return { data, isLoading, isError, refetch }
}
