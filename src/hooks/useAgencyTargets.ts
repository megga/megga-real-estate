// MEGGA CRM — Lecture/écriture des objectifs commerciaux de l'agence.
// Source de vérité : agencies.{monthly,quarterly,yearly}_target.
//
// SAISIE ANNUELLE UNIQUE : l'écriture passe par le RPC analytics_set_target qui
// dérive /4 et /12 et journalise l'audit (activity_events) atomiquement. On ne
// recompose JAMAIS l'annuel depuis le mensuel (yearly_target = source de vérité
// de la période 'year').

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface AgencyTargets {
  monthly: number
  quarterly: number
  yearly: number
}

interface AgencyTargetsRow {
  monthly_target: number | string | null
  quarterly_target: number | string | null
  yearly_target: number | string | null
}

export function useAgencyTargets(options?: { enabled?: boolean }): {
  targets: AgencyTargets
  isLoading: boolean
  saveYearly: (yearly: number) => Promise<void>
  isSaving: boolean
} {
  const enabled = options?.enabled ?? true
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['agency-targets', agencyId],
    queryFn: async (): Promise<AgencyTargets> => {
      if (!agencyId) return { monthly: 0, quarterly: 0, yearly: 0 }
      const { data, error } = await supabase
        .from('agencies')
        .select('monthly_target, quarterly_target, yearly_target')
        .eq('id', agencyId)
        .maybeSingle<AgencyTargetsRow>()
      if (error) throw error
      return {
        monthly: Number(data?.monthly_target ?? 0),
        quarterly: Number(data?.quarterly_target ?? 0),
        yearly: Number(data?.yearly_target ?? 0),
      }
    },
    enabled: enabled && !!agencyId,
    staleTime: 5 * 60_000,
  })

  const mutation = useMutation({
    mutationFn: async (yearly: number): Promise<void> => {
      const p_yearly = Math.round(Math.max(0, yearly))
      // RPC pas encore dans les types générés `Database` → pattern repo (sans `any`).
      const rpcUntyped = supabase.rpc as unknown as
        (fn: string, args: Record<string, unknown>) => Promise<{ error: Error | null }>
      const { error } = await rpcUntyped('analytics_set_target', { p_yearly })
      if (error) throw error
    },
    onSuccess: () => {
      // Le Hero du dashboard reflète immédiatement le nouvel objectif (sans reload).
      queryClient.invalidateQueries({ queryKey: ['agency-targets'] })
      queryClient.invalidateQueries({ queryKey: ['ax-objectif'] })
      queryClient.invalidateQueries({ queryKey: ['ax-cockpit'] })
    },
  })

  return {
    targets: data ?? { monthly: 0, quarterly: 0, yearly: 0 },
    isLoading,
    saveYearly: (yearly: number) => mutation.mutateAsync(yearly),
    isSaving: mutation.isPending,
  }
}
