// MEGGA — Calcul des temps de trajet entre les biens visibles et les POIs.
//
// La grid affiche 20 biens. L'utilisateur a max 3 POIs. Donc une matrice
// 20×3 = 60 cellules par page, large dans la limite Mapbox de 25 coordonnées
// totales (20 + 3 = 23 < 25, ça passe en 1 appel).
//
// Si l'utilisateur a > 5 POIs (futur) ou si on passe la page à 25+ biens, il
// faudra chunker. Pour MVP on assume 1 seul appel suffit.
//
// Cache : React Query mémorise par (POIs × listings × profile). Le partial
// key est stable tant que la composition des biens ou des POIs change pas.

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { travelMatrix, type TravelProfile } from '@/lib/mapboxClient'
import type { UserPoi } from './useUserPois'

export interface ListingTravelTimes {
  listingId: string
  /** Durée vers chaque POI dans l'ordre `pois[]`. null = inaccessible / erreur. */
  perPoi: Array<{ poiId: string; durationSec: number | null; distanceM: number | null }>
  /** Durée minimum parmi tous les POIs — utile pour highlighter "le plus proche". */
  minDurationSec: number | null
  /** Somme des durées — utile pour le ranking. */
  sumDurationSec: number | null
}

export type TravelTimesMap = Map<string, ListingTravelTimes>

export interface UseTravelTimesParams {
  pois: UserPoi[]
  listings: Array<{ id: string; lat?: number | null; lng?: number | null }>
  profile?: TravelProfile
}

/**
 * Fetch une matrice 1 fois par page de listings + jeu de POIs. La query est
 * `enabled` uniquement si l'user a au moins 1 POI ET au moins 1 listing avec
 * des coords valides.
 */
export function useTravelTimes({
  pois,
  listings,
  profile = 'driving',
}: UseTravelTimesParams) {
  // Garder uniquement les listings avec lat/lng valides — Mapbox n'accepte pas
  // les NaN. On ignore aussi les coords manifestement hors-CH (lat hors
  // 45.7-47.9 ou lng hors 5.8-10.6) pour éviter de payer pour des outliers
  // de données.
  const validListings = listings.filter(l => {
    if (typeof l.lat !== 'number' || typeof l.lng !== 'number') return false
    if (!Number.isFinite(l.lat) || !Number.isFinite(l.lng)) return false
    return l.lat >= 45.7 && l.lat <= 47.9 && l.lng >= 5.8 && l.lng <= 10.6
  })

  // Mapbox Matrix accepte max 25 coordonnées au TOTAL (sources + destinations).
  // Pour MVP on cap à 22 listings × 3 POIs = 25.
  const maxListings = Math.max(0, 25 - pois.length)
  const cappedListings = validListings.slice(0, maxListings)

  const queryKey = [
    'travel-times',
    profile,
    pois.map(p => `${p.id}:${p.lat.toFixed(4)}:${p.lng.toFixed(4)}`).join('|'),
    cappedListings.map(l => l.id).join('|'),
  ] as const

  return useQuery<TravelTimesMap>({
    queryKey,
    queryFn: async (): Promise<TravelTimesMap> => {
      const map: TravelTimesMap = new Map()
      if (pois.length === 0 || cappedListings.length === 0) return map

      const sources = cappedListings.map(l => ({ lng: l.lng!, lat: l.lat! }))
      const destinations = pois.map(p => ({ lng: p.lng, lat: p.lat }))

      const matrix = await travelMatrix(sources, destinations, profile)
      if (!matrix) return map

      for (let i = 0; i < cappedListings.length; i++) {
        const row = matrix[i] ?? []
        const perPoi = pois.map((p, j) => ({
          poiId: p.id,
          durationSec: row[j]?.duration ?? null,
          distanceM: row[j]?.distance ?? null,
        }))
        const validDurations = perPoi
          .map(p => p.durationSec)
          .filter((d): d is number => typeof d === 'number' && Number.isFinite(d))
        const minDurationSec = validDurations.length > 0 ? Math.min(...validDurations) : null
        const sumDurationSec =
          validDurations.length > 0 ? validDurations.reduce((a, b) => a + b, 0) : null
        map.set(cappedListings[i].id, {
          listingId: cappedListings[i].id,
          perPoi,
          minDurationSec,
          sumDurationSec,
        })
      }
      return map
    },
    enabled: pois.length > 0 && cappedListings.length > 0,
    staleTime: 30 * 60 * 1000, // 30 min — la matrice est stable
    gcTime: 60 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 1,
  })
}

/**
 * Helper pour récupérer une row depuis le map (fallback safe sur null).
 */
export function travelTimeFor(
  map: TravelTimesMap | undefined,
  listingId: string,
): ListingTravelTimes | null {
  if (!map) return null
  return map.get(listingId) ?? null
}
