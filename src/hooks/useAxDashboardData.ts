// MEGGA CRM — Source de données live du Dashboard Analytics « Cockpit Commission ».
// Remplace les 3 hooks v3 (useDashboardCockpit/Funnel/Objectif) pour la page routée :
// 3 RPC agrégés (analytics_cockpit/objectif/funnel) + 1 adaptateur pur buildAxData.
//
// Les RPC sont SECURITY DEFINER, l'agence vient du JWT (anti cross-tenant) ; le
// scope ('me'/'agency') est passé en paramètre et appliqué uniformément côté SQL.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { buildAxData, type CockpitJson, type ObjectifJson, type FunnelJson } from '@/components/crm-sugar/analytics/buildAxData'
import type { AxPeriodId, AxPeriodData } from '@/components/crm-sugar/analytics/tokens'

export type AxScope = 'me' | 'agency'

// Les RPC analytics_* ne sont pas (encore) dans les types générés `Database` ;
// on suit le pattern du repo (cf useAdminLearning.ts) pour rester sans `any`.
const rpcUntyped = supabase.rpc as unknown as
  (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpcUntyped(name, args)
  if (error) throw error
  return data as T
}

export function useAxDashboardData(period: AxPeriodId, scope: AxScope): {
  data: AxPeriodData | null
  isLoading: boolean
} {
  const cockpit = useQuery({
    queryKey: ['ax-cockpit', period, scope],
    queryFn: () => rpc<CockpitJson>('analytics_cockpit', { p_period: period, p_scope: scope }),
    staleTime: 60_000,
  })
  const objectif = useQuery({
    queryKey: ['ax-objectif', period, scope],
    queryFn: () => rpc<ObjectifJson>('analytics_objectif', { p_period: period, p_scope: scope }),
    staleTime: 60_000,
  })
  const funnel = useQuery({
    queryKey: ['ax-funnel', period, scope],
    queryFn: () => rpc<FunnelJson>('analytics_funnel', { p_period: period, p_scope: scope }),
    staleTime: 60_000,
  })

  const isLoading = cockpit.isLoading || objectif.isLoading || funnel.isLoading

  const data = useMemo<AxPeriodData | null>(() => {
    if (isLoading) return null
    if (!cockpit.data || !objectif.data || !funnel.data) return null
    // Un payload vide ('{}') signale une agence absente (JWT sans agence).
    if (!objectif.data.period) return null
    return buildAxData(period, cockpit.data, objectif.data, funnel.data)
  }, [period, isLoading, cockpit.data, objectif.data, funnel.data])

  return { data, isLoading }
}
