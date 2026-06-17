// MEGGA CRM — Score de bien (santé/chaleur) côté client.
// ----------------------------------------------------------------------------
// Lit la table property_scores (peuplée par calculate_property_scores + cron
// nocturne, cf migration 20260616190000) via la RLS d'agence DÉJÀ posée — aucune
// RPC. Renvoie une Map property_id → BienHealth pour que useBiensSugar attache le
// score à chaque CrmBien (galerie Mes biens). Le score est une ESTIMATION (HITL).
//
// Les colonnes v1 de property_scores ne sont pas (encore) dans les types générés
// `Database` → même esprit `*Untyped` que useFocusMatches (qui caste un RPC) : ici
// on caste la lecture de TABLE pour rester sans `any` au-delà du point de lecture.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { BienHealth } from '@/components/crm-sugar/mockData'

interface PropertyScoreRow {
  property_id: string
  overall_score: number | null
  score_label: string | null
  data_completeness: number | null
}

const fromUntyped = supabase.from as unknown as (table: string) => {
  select: (cols: string) => {
    eq: (col: string, val: string) => Promise<{ data: unknown; error: Error | null }>
  }
}

/** Map property_id → BienHealth (lignes 'internal' de l'agence). Vide tant que non chargé. */
export function usePropertyScores(): { scores: Map<string, BienHealth>; isLoading: boolean } {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  const query = useQuery({
    queryKey: ['property-scores', agencyId],
    queryFn: async (): Promise<Map<string, BienHealth>> => {
      const { data, error } = await fromUntyped('property_scores')
        .select('property_id, overall_score, score_label, data_completeness')
        .eq('source', 'internal')
      if (error) throw error
      const rows = (data ?? []) as PropertyScoreRow[]
      const map = new Map<string, BienHealth>()
      for (const r of rows) {
        if (r.overall_score == null) continue
        map.set(r.property_id, {
          overall: r.overall_score,
          label: r.score_label ?? '',
          dataCompleteness: r.data_completeness,
        })
      }
      return map
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const scores = useMemo(() => query.data ?? new Map<string, BienHealth>(), [query.data])
  return { scores, isLoading: query.isLoading }
}
