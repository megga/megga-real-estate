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

// ─── Mapbox class/maki → our categories ─────────────────────────────────
//
// Tilequery returns poi_label features tagged with `class` (coarse) and
// `maki` (icon name / subtype). We map both to our 5 categories.

// Mapbox Streets v8 poi_label `class` values (the actual ones):
//   food_and_drink, food_and_drink_stores, store_like, park_like, medical,
//   education, commercial_services, general_service, arts_and_entertainment,
//   sport_and_leisure, lodging, place_of_worship, landmark, historic,
//   public_facilities, industrial, residential_building, visitor_amenities,
//   transportation, marine.
function mapToCategory(cls?: string, maki?: string): PoiCategory | null {
  // ─ Transport ─ rails, bus, metro, ferry
  if (cls === 'transportation' || cls === 'transit' || cls === 'marine') return 'transport'
  if (maki === 'rail' || maki === 'rail-light' || maki === 'rail-metro' ||
      maki === 'bus' || maki === 'ferry' || maki === 'airport' || maki === 'airfield') {
    return 'transport'
  }

  // ─ Santé ─ hospitals, clinics, pharmacies, dentists. Check BEFORE commerce
  //   because pharmacies may also sit in commercial categories.
  if (cls === 'medical') return 'sante'
  if (maki === 'hospital' || maki === 'doctor' || maki === 'dentist' ||
      maki === 'pharmacy' || maki === 'veterinary' || maki === 'emergency-phone') {
    return 'sante'
  }

  // ─ Écoles & éducation ─
  if (cls === 'education') return 'ecole'
  if (maki === 'school' || maki === 'college' || maki === 'library') return 'ecole'

  // ─ Commerce ─
  if (cls === 'food_and_drink_stores' || cls === 'store_like' ||
      cls === 'commercial_services' || cls === 'general_service') {
    return 'commerce'
  }
  if (maki === 'supermarket' || maki === 'grocery' || maki === 'bakery' ||
      maki === 'shop' || maki === 'clothing-store' || maki === 'alcohol-shop' ||
      maki === 'bank' || maki === 'post' || maki === 'atm' ||
      maki === 'fuel' || maki === 'laundry' || maki === 'hairdresser') {
    return 'commerce'
  }

  // ─ Loisirs ─ restaurants, cafés, parcs, sport, culture, landmarks
  if (cls === 'food_and_drink' || cls === 'park_like' || cls === 'sport_and_leisure' ||
      cls === 'arts_and_entertainment' || cls === 'historic' ||
      cls === 'visitor_amenities' || cls === 'landmark') {
    return 'loisir'
  }
  if (maki === 'restaurant' || maki === 'cafe' || maki === 'bar' ||
      maki === 'fast-food' || maki === 'ice-cream' ||
      maki === 'park' || maki === 'park-alt1' || maki === 'garden' ||
      maki === 'theatre' || maki === 'cinema' || maki === 'museum' ||
      maki === 'art-gallery' || maki === 'attraction' ||
      maki === 'fitness-centre' || maki === 'swimming' || maki === 'stadium' ||
      maki === 'playground' || maki === 'picnic-site' || maki === 'pitch') {
    return 'loisir'
  }

  return null
}

// ─── Fetch POIs from Mapbox Tilequery (proper POI discovery) ─────────────

interface TilequeryFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    name_fr?: string
    class?: string
    maki?: string
    type?: string
    tilequery?: { distance?: number }
  }
}

async function fetchMapboxPOIs(lat: number, lng: number): Promise<POI[]> {
  if (!MAPBOX_TOKEN) return []
  const RADIUS = 1500 // meters
  const LIMIT = 50 // Tilequery hard cap
  const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json?radius=${RADIUS}&limit=${LIMIT}&layers=poi_label&dedupe=true&access_token=${MAPBOX_TOKEN}`

  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    const features: TilequeryFeature[] = data.features || []

    const pois: POI[] = []
    for (const f of features) {
      const props = f.properties
      const name = props.name_fr || props.name
      if (!name) continue
      const category = mapToCategory(props.class, props.maki)
      if (!category) continue
      const [poiLng, poiLat] = f.geometry.coordinates
      const distanceM = typeof props.tilequery?.distance === 'number'
        ? Math.round(props.tilequery.distance)
        : Math.round(haversineDistance(lat, lng, poiLat, poiLng))
      pois.push({ name, category, lat: poiLat, lng: poiLng, distanceM })
    }

    // Deduplicate by (name + category) — keep the nearest.
    const byKey = new Map<string, POI>()
    for (const p of pois) {
      const key = `${p.name}-${p.category}`
      const existing = byKey.get(key)
      if (!existing || p.distanceM < existing.distanceM) byKey.set(key, p)
    }
    return Array.from(byKey.values()).sort((a, b) => a.distanceM - b.distanceM)
  } catch {
    return []
  }
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

// ─── Walk Score calculation ──────────────────────────────────────────────

export interface WalkScore {
  /** Score global 0-100 */
  score: number
  /** Label humain */
  label: string
  /** Couleur CSS pour le badge */
  color: string
  /** Scores par catégorie (0-100 chacun) */
  breakdown: {
    transport: number
    commerce: number
    ecole: number
    sante: number
    loisir: number
  }
}

/**
 * Calcule un score de walkabilité 0-100 basé sur la proximité des POIs.
 *
 * Pondération :
 * - Transport (gare) : 30% — critère #1 en Suisse
 * - Commerces : 25% — supermarché, pharmacie, boulangerie
 * - Écoles : 20% — familles
 * - Santé : 15% — médecin, hôpital
 * - Loisirs : 10% — restaurants, parcs, sport
 *
 * Chaque sous-score est basé sur la distance du POI le plus proche :
 * - < 300m = 100, < 500m = 85, < 800m = 65, < 1200m = 40, < 2000m = 20, > 2000m = 5
 * - 0 POIs dans la catégorie = 0
 */
export function calculateWalkScore(
  categories: Record<PoiCategory, CategorySummary>,
  station: StationInfo | null
): WalkScore {
  function distanceToScore(distanceM: number): number {
    if (distanceM <= 300) return 100
    if (distanceM <= 500) return 85
    if (distanceM <= 800) return 65
    if (distanceM <= 1200) return 40
    if (distanceM <= 2000) return 20
    return 5
  }

  // Transport : basé sur la gare la plus proche
  const transportScore = station
    ? distanceToScore(station.distanceM)
    : (categories.transport.nearest ? distanceToScore(categories.transport.nearest.distanceM) : 0)

  // Autres catégories : basé sur le POI le plus proche
  const commerceScore = categories.commerce.nearest ? distanceToScore(categories.commerce.nearest.distanceM) : 0
  const ecoleScore = categories.ecole.nearest ? distanceToScore(categories.ecole.nearest.distanceM) : 0
  const santeScore = categories.sante.nearest ? distanceToScore(categories.sante.nearest.distanceM) : 0
  const loisirScore = categories.loisir.nearest ? distanceToScore(categories.loisir.nearest.distanceM) : 0

  // Bonus densité : +5 par catégorie ayant 3+ POIs (max +15)
  let densityBonus = 0
  for (const cat of Object.values(categories)) {
    if (cat.count >= 3) densityBonus += 5
  }

  const weightedScore = Math.round(
    transportScore * 0.30 +
    commerceScore * 0.25 +
    ecoleScore * 0.20 +
    santeScore * 0.15 +
    loisirScore * 0.10 +
    Math.min(densityBonus, 15) * 0.1 // Bonus densité plafonné
  )

  const score = Math.min(100, Math.max(0, weightedScore))

  let label: string
  let color: string
  if (score >= 90) { label = 'Tout à pied'; color = 'text-green-600' }
  else if (score >= 70) { label = 'Très pratique'; color = 'text-green-500' }
  else if (score >= 50) { label = 'Correct'; color = 'text-yellow-600' }
  else if (score >= 25) { label = 'Dépendant voiture'; color = 'text-orange-500' }
  else { label = 'Isolé'; color = 'text-red-500' }

  return {
    score,
    label,
    color,
    breakdown: {
      transport: transportScore,
      commerce: commerceScore,
      ecole: ecoleScore,
      sante: santeScore,
      loisir: loisirScore,
    },
  }
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
