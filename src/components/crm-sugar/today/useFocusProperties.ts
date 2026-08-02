// MEGGA CRM — Cockpit « Aujourd'hui » · Algo Focus · source BIENS (score de bien)
// ----------------------------------------------------------------------------
// Focus radar v4 : lit le SCORE DE BIEN backend (property_scores, peuplé par
// calculate_property_scores + cron nocturne 03:50) via la RLS d'agence DÉJÀ posée
// — aucune RPC, aucun grant. Rend les biens INTERNES les mieux placés pour être
// travaillés (overall_score DESC), joints à `properties` pour l'affichage.
// DÉTERMINISTE, 0 LLM. Le score est une ESTIMATION (HITL) ; le geste reste manuel.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

// Embed PostgREST to-one via la FK property_scores_property_id_fkey.
interface PropertyJoin {
  title: string | null
  city: string | null
  price: number | null
  photos: string[] | null
  status: string | null
}
interface PropertyScoreRow {
  property_id: string
  overall_score: number | null
  score_label: string | null
  completeness_score: number | null
  interest_score: number | null
  pipeline_score: number | null
  data_completeness: number | null
  // PostgREST renvoie un OBJET pour l'embed to-one ; on tolère le tableau (défensif).
  properties: PropertyJoin | PropertyJoin[] | null
}

export interface FocusProperty {
  propertyId: string
  overall: number
  label: string | null
  completeness: number | null
  interest: number | null
  pipeline: number | null
  dataCompleteness: number | null
  title: string | null
  city: string | null
  price: number | null
  photo: string | null
}

// Un bien VENDU / ARCHIVÉ ne « mérite plus l'attention » : le RPC ne le re-score
// plus mais sa dernière ligne survit dans property_scores → on l'écarte côté lecture.
const TERMINAL_STATUS = new Set(['sold', 'archived'])

export function useFocusProperties(limit = 12): { properties: FocusProperty[]; isLoading: boolean } {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  const query = useQuery({
    queryKey: ['focus-properties', agencyId, limit],
    queryFn: async (): Promise<FocusProperty[]> => {
      const { data, error } = await supabase
        .from('property_scores')
        .select(
          'property_id, overall_score, score_label, completeness_score, interest_score, pipeline_score, data_completeness, properties(title, city, price, photos, status)',
        )
        .eq('source', 'internal')
        .order('overall_score', { ascending: false })
        .limit(limit)
      if (error) throw error
      // L'embed to-one `properties(...)` n'est pas affiné par le générateur : la forme
      // de la LIGNE reste écrite à la main, mais la table et les colonnes du `.select()`
      // sont désormais vérifiées — une colonne renommée en SQL fait rougir ici.
      const rows = (data ?? []) as unknown as PropertyScoreRow[]
      return rows
        .map((r): FocusProperty | null => {
          // PostgREST renvoie l'embed to-one en OBJET, mais on normalise un
          // éventuel tableau (défensif) ; un bien supprimé est masqué par la RLS
          // (deleted_at) → join NULL → on l'écarte.
          const p = Array.isArray(r.properties) ? (r.properties[0] ?? null) : r.properties
          // `property_id` est nullable en base ; sans bien, la carte n'est pas navigable.
          if (r.property_id == null || p == null || TERMINAL_STATUS.has(p.status ?? '')) return null
          return {
            propertyId: r.property_id,
            overall: r.overall_score ?? 0,
            label: r.score_label,
            completeness: r.completeness_score,
            interest: r.interest_score,
            pipeline: r.pipeline_score,
            dataCompleteness: r.data_completeness,
            title: p.title ?? null,
            city: p.city ?? null,
            price: p.price ?? null,
            photo: p.photos?.[0] ?? null,
          }
        })
        .filter((r): r is FocusProperty => r !== null)
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const properties = useMemo(() => query.data ?? [], [query.data])
  return { properties, isLoading: query.isLoading }
}
