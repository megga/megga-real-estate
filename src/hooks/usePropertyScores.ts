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

/** Map property_id → BienHealth (lignes 'internal' de l'agence). Vide tant que non chargé. */
export function usePropertyScores(): { scores: Map<string, BienHealth>; isLoading: boolean } {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  const query = useQuery({
    queryKey: ['property-scores', agencyId],
    queryFn: async (): Promise<Map<string, BienHealth>> => {
      const { data, error } = await supabase
        .from('property_scores')
        .select('property_id, overall_score, score_label, data_completeness')
        .eq('source', 'internal')
      if (error) throw error
      const map = new Map<string, BienHealth>()
      for (const r of data ?? []) {
        // `property_id` est nullable en base : une ligne sans bien ne peut pas servir de
        // clé ici (la Map est lue PAR id), elle est donc écartée comme un score absent.
        if (r.property_id == null || r.overall_score == null) continue
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
