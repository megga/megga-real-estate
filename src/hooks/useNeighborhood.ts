import { useQuery } from '@tanstack/react-query'
import { findNearestStation, haversineDistance, formatStationDistance } from '@/lib/stations'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

// ─── Types ──────────────────────────────────────────────────────────────

export type PoiCategory = 'transport' | 'commerce' | 'ecole' | 'sante' | 'loisir'

export interface POI {
  name: string
  category: PoiCategory
  lat: number
  lng: number
  distanceM: number
}

export interface CategorySummary {
  count: number
  nearest: POI | null
}

export interface StationInfo {
  name: string
  distanceM: number
  walkMin: number
  formatted: string
}

export interface NeighborhoodData {
  station: StationInfo | null
  pois: POI[]
  categories: Record<PoiCategory, CategorySummary>
  isLoading: boolean
}

// ─── POI queries config ─────────────────────────────────────────────────

const POI_QUERIES: Array<{ query: string; category: PoiCategory; limit: number }> = [
  { query: 'supermarket', category: 'commerce', limit: 3 },
  { query: 'pharmacy', category: 'commerce', limit: 2 },
  { query: 'bakery', category: 'commerce', limit: 2 },
  { query: 'school', category: 'ecole', limit: 3 },
  { query: 'hospital', category: 'sante', limit: 2 },
  { query: 'doctor', category: 'sante', limit: 2 },
  { query: 'restaurant', category: 'loisir', limit: 3 },
  { query: 'park', category: 'loisir', limit: 2 },
  { query: 'gym', category: 'loisir', limit: 2 },
]

// ─── Fetch POIs from Mapbox Geocoding ───────────────────────────────────

async function fetchMapboxPOIs(lat: number, lng: number): Promise<POI[]> {
  if (!MAPBOX_TOKEN) return []

  const results = await Promise.all(
    POI_QUERIES.map(async ({ query, category, limit }) => {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?proximity=${lng},${lat}&types=poi&limit=${limit}&access_token=${MAPBOX_TOKEN}`
        const res = await fetch(url)
        if (!res.ok) return []
        const data = await res.json()
        return (data.features || []).map((f: { place_name: string; center: [number, number] }) => ({
          name: f.place_name.split(',')[0],
          category,
          lat: f.center[1],
          lng: f.center[0],
          distanceM: Math.round(haversineDistance(lat, lng, f.center[1], f.center[0])),
        }))
      } catch {
        return []
      }
    })
  )

  // Flatten, deduplicate by name, sort by distance
  const all: POI[] = results.flat()
  const seen = new Set<string>()
  const unique: POI[] = []
  for (const poi of all) {
    const key = `${poi.name}-${poi.category}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(poi)
    }
  }
  return unique.sort((a, b) => a.distanceM - b.distanceM)
}

// ─── Aggregate into categories ──────────────────────────────────────────

function aggregateCategories(pois: POI[]): Record<PoiCategory, CategorySummary> {
  const cats: Record<PoiCategory, CategorySummary> = {
    transport: { count: 0, nearest: null },
    commerce: { count: 0, nearest: null },
    ecole: { count: 0, nearest: null },
    sante: { count: 0, nearest: null },
    loisir: { count: 0, nearest: null },
  }

  for (const poi of pois) {
    const cat = cats[poi.category]
    cat.count++
    if (!cat.nearest || poi.distanceM < cat.nearest.distanceM) {
      cat.nearest = poi
    }
  }

  return cats
}

// ─── Main hook ──────────────────────────────────────────────────────────

export function useNeighborhood(lat?: number, lng?: number) {
  const poiQuery = useQuery({
    queryKey: ['neighborhood-pois', lat, lng],
    queryFn: async (): Promise<{ pois: POI[]; station: StationInfo | null; categories: Record<PoiCategory, CategorySummary> }> => {
      if (!lat || !lng) return { pois: [], station: null, categories: aggregateCategories([]) }

      // Fetch POIs + station in parallel
      const [pois, stationResult] = await Promise.all([
        fetchMapboxPOIs(lat, lng),
        Promise.resolve(findNearestStation(lat, lng)),
      ])

      // Add station to transport category if found
      const allPois = [...pois]
      let station: StationInfo | null = null

      if (stationResult) {
        station = {
          name: stationResult.name,
          distanceM: stationResult.distanceM,
          walkMin: Math.round(stationResult.distanceM / 80), // ~80m/min walking
          formatted: formatStationDistance(stationResult.distanceM),
        }
        // Add station as a transport POI
        allPois.push({
          name: stationResult.name,
          category: 'transport',
          lat: stationResult.lat,
          lng: stationResult.lng,
          distanceM: stationResult.distanceM,
        })
      }

      const categories = aggregateCategories(allPois)

      return { pois: allPois, station, categories }
    },
    enabled: !!lat && !!lng,
    staleTime: 30 * 60 * 1000, // 30 minutes
  })

  return {
    station: poiQuery.data?.station ?? null,
    pois: poiQuery.data?.pois ?? [],
    categories: poiQuery.data?.categories ?? aggregateCategories([]),
    isLoading: poiQuery.isLoading,
  } satisfies NeighborhoodData
}

// ─── AI Summary hook (separate, depends on POI data) ────────────────────

export function useNeighborhoodSummary(
  lat?: number,
  lng?: number,
  canton?: string,
  city?: string,
  categories?: Record<PoiCategory, CategorySummary>,
  station?: StationInfo | null,
) {
  return useQuery({
    queryKey: ['neighborhood-summary', lat, lng],
    queryFn: async (): Promise<string> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

      if (!supabaseUrl || !supabaseKey || !categories) return ''

      const context = [
        `Ville: ${city || 'inconnue'}, Canton: ${canton || 'inconnu'}`,
        station ? `Gare la plus proche: ${station.name} (${station.formatted})` : 'Pas de gare à proximité',
        `Commerces à proximité: ${categories.commerce.count} (plus proche: ${categories.commerce.nearest ? `${categories.commerce.nearest.name} à ${categories.commerce.nearest.distanceM}m` : 'aucun'})`,
        `Écoles: ${categories.ecole.count}`,
        `Santé: ${categories.sante.count}`,
        `Restaurants/loisirs: ${categories.loisir.count}`,
      ].join('. ')

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/ai-copilot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            action: 'free_chat',
            message: `Décris ce quartier en 2-3 phrases courtes en français, ton informatif et positif. Données : ${context}. Ne mentionne pas les sources de données. Maximum 50 mots.`,
          }),
        })

        if (!res.ok) return ''
        const data = await res.json()
        return (data.response || data.message || '') as string
      } catch {
        return ''
      }
    },
    enabled: !!lat && !!lng && !!categories && Object.values(categories).some(c => c.count > 0),
    staleTime: 60 * 60 * 1000, // 1 hour (AI summaries don't change often)
  })
}
