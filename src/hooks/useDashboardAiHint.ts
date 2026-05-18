// MEGGA CRM Sugar v3 — AI hint live pour DBCockpit (Sprint C).
// Appelle l'Edge Function `dashboard-ai-hint` qui consulte Claude API et
// retourne UNE suggestion contextualisée. Caching agressif (staleTime 1h)
// pour ne pas spammer Claude — l'agent voit la même action prioritaire toute
// la session.
//
// Compliance-enabling : l'IA suggère, l'agent décide (CLAUDE.md règle).

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { CockpitDataset, PeriodKey, ScopeKey } from '@/components/crm-sugar-v3/dashboard/data'

export interface DashboardAiHint {
  label: string
  title: string
  desc: string
  cta: string
  ctaUrl?: string
}

interface SnapshotInput {
  period: PeriodKey
  scope: ScopeKey
  label: string
  periodWord: string
  projected: number
  target: number
  daysLeft: number
  deltaPct: number
  decomp: CockpitDataset['decomp']
  contributors: CockpitDataset['contributors']
  vitals: CockpitDataset['vitals']
}

export function useDashboardAiHint(
  data: CockpitDataset | null,
  period: PeriodKey,
  scope: ScopeKey,
): { hint: DashboardAiHint | null; isLoading: boolean } {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  // Cache key inclut le snapshot — on rafraîchit la suggestion uniquement
  // quand projected / decomp / vitals changent significativement (= refresh
  // explicite ou navigation). Si l'agent toggle period, on génère une
  // nouvelle suggestion.
  const cacheKey = data
    ? `${period}-${scope}-${Math.round(data.projected / 1000)}-${data.vitals.deals}-${data.vitals.kycRisk}`
    : null

  const { data: hint, isLoading } = useQuery({
    queryKey: ['dashboard-ai-hint', cacheKey],
    queryFn: async (): Promise<DashboardAiHint | null> => {
      if (!data || !cacheKey) return null
      const snapshot: SnapshotInput = {
        period,
        scope,
        label: data.label,
        periodWord: data.periodWord,
        projected: data.projected,
        target: data.target,
        daysLeft: data.daysLeft,
        deltaPct: data.deltaPct,
        decomp: data.decomp,
        contributors: data.contributors,
        vitals: data.vitals,
      }
      const { data: response, error } = await supabase.functions.invoke('dashboard-ai-hint', {
        body: { snapshot, agency_id: agencyId ?? null },
      })
      if (error || !response) return null
      return response as DashboardAiHint
    },
    enabled: !!data && !!cacheKey,
    staleTime: 60 * 60 * 1000,       // 1h — la suggestion reste stable
    gcTime: 24 * 60 * 60 * 1000,     // 24h en cache (changer de période + revenir = pas de re-fetch)
    retry: false,                    // si Edge Function plante, fallback côté composant
  })

  return { hint: hint ?? null, isLoading }
}
