/**
 * Stats live d'un bien pour la fiche détail : vues + favoris (compteurs
 * portés par `properties`) et nombre de demandes de visite (count sur
 * `visits`). staleTime 60 s.
 */
// MEGGA CRM Sugar v2 — Stats live d'un bien (Vues / Favoris / Demandes de visite).
// Utilisé par BienDetailSugarV3Page pour remplacer les KPI hardcodés à 0.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface PropertyStats {
  views: number
  favorites: number
  visitRequests: number
}

/** Renvoie `{ stats, isLoading }` ; défauts à 0 tant que la requête n'a pas résolu ou si `propertyId` est absent. */
export function usePropertyStats(propertyId: string | undefined): {
  stats: PropertyStats
  isLoading: boolean
} {
  const { data, isLoading } = useQuery({
    queryKey: ['property-stats', propertyId],
    queryFn: async (): Promise<PropertyStats> => {
      if (!propertyId) return { views: 0, favorites: 0, visitRequests: 0 }

      // 1. properties : compteurs vues/favoris portés par le bien lui-même
      const { data: listing } = await supabase
        .from('properties')
        .select('views_count, favorites_count')
        .eq('id', propertyId)
        .maybeSingle()

      // 2. visits : count des demandes (publiques + agent)
      const { count: visitsCount } = await supabase
        .from('visits')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)

      return {
        views: listing?.views_count ?? 0,
        favorites: listing?.favorites_count ?? 0,
        visitRequests: visitsCount ?? 0,
      }
    },
    enabled: !!propertyId,
    staleTime: 60_000,
  })

  return {
    stats: data ?? { views: 0, favorites: 0, visitRequests: 0 },
    isLoading,
  }
}
