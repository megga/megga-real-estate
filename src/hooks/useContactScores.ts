// MEGGA CRM — Score de contact (lead scoring) côté client.
// ----------------------------------------------------------------------------
// Lit la table contact_scores (peuplée par calculate_contact_scores + cron
// nocturne 03:00 UTC, cf migration 20260616170000) via la RLS d'agence DÉJÀ
// posée — aucune RPC. Renvoie une Map contact_id → ContactHealth pour surfacer
// le score (pastille) en liste + fiche contact. C'est une ESTIMATION (HITL),
// DISTINCTE du score déclaratif hot/warm/cold saisi par l'agent.
//
// Les colonnes de contact_scores ne sont pas dans les types générés `Database`
// → même esprit `*Untyped` que usePropertyScores : on caste la lecture de TABLE
// pour rester sans `any` au-delà du point de lecture.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface ContactHealth {
  overall: number                 // overall_score 0-100
  label: string                   // 'serieux' | 'a_qualifier' | 'froid'
  dataCompleteness: number | null // 0-1 — richesse des signaux
}

interface ContactScoreRow {
  contact_id: string
  overall_score: number | null
  score_label: string | null
  data_completeness: number | null
}

const fromUntyped = supabase.from as unknown as (table: string) => {
  select: (cols: string) => Promise<{ data: unknown; error: Error | null }>
}

/** Map contact_id → ContactHealth (lignes de l'agence via RLS). Vide tant que non chargé. */
export function useContactScores(): { scores: Map<string, ContactHealth>; isLoading: boolean } {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  const query = useQuery({
    queryKey: ['contact-scores', agencyId],
    queryFn: async (): Promise<Map<string, ContactHealth>> => {
      const { data, error } = await fromUntyped('contact_scores')
        .select('contact_id, overall_score, score_label, data_completeness')
      if (error) throw error
      const rows = (data ?? []) as ContactScoreRow[]
      const map = new Map<string, ContactHealth>()
      for (const r of rows) {
        if (r.overall_score == null) continue
        map.set(r.contact_id, {
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

  const scores = useMemo(() => query.data ?? new Map<string, ContactHealth>(), [query.data])
  return { scores, isLoading: query.isLoading }
}
