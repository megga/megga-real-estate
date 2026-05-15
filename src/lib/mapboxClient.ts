// MEGGA — Wrappers Mapbox API pour la Phase 3 "Mes lieux".
//
// 2 endpoints utilisés :
//   - Geocoding API (forward) : adresse texte → coords + suggestions auto-
//     complete pour l'ajout d'un POI.
//   - Matrix API : matrice N sources × M destinations → durée de trajet en
//     secondes. Max 25×25 = 625 cellules par appel.
//
// Pricing : free tier 100K requêtes/mois sur chacun des 2 endpoints, large-
// ment suffisant pour notre usage (1-2 Matrix par page × N users).

interface MapboxFeature {
  id: string
  place_name: string
  text: string
  center: [number, number] // [lng, lat]
  place_type?: string[]
  context?: Array<{ id: string; text: string; short_code?: string }>
}

interface MapboxGeocodingResponse {
  features?: MapboxFeature[]
}

export interface GeocodingSuggestion {
  id: string
  fullAddress: string
  label: string
  lng: number
  lat: number
  canton: string | null
}

function extractCanton(feature: MapboxFeature): string | null {
  for (const ctx of feature.context ?? []) {
    const code = (ctx.short_code ?? '').toUpperCase().match(/^CH-([A-Z]{2})$/)
    if (code) return code[1]
  }
  return null
}

/**
 * Geocoding forward — adresse → suggestions. Limité à la Suisse
 * (`country=ch`) pour éviter le bruit international.
 *
 * @param query texte tapé par l'user (min 3 chars pour fire)
 * @param signal AbortSignal pour annuler une requête obsolète (debounce)
 */
export async function geocodeSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodingSuggestion[]> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) return []
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json`,
  )
  url.searchParams.set('country', 'ch')
  url.searchParams.set('language', 'fr')
  url.searchParams.set('limit', '5')
  url.searchParams.set('types', 'address,poi,place,postcode,locality,neighborhood')
  url.searchParams.set('autocomplete', 'true')
  url.searchParams.set('access_token', token)

  try {
    const res = await fetch(url.toString(), { signal })
    if (!res.ok) return []
    const data = (await res.json()) as MapboxGeocodingResponse
    return (data.features ?? []).map(f => ({
      id: f.id,
      fullAddress: f.place_name,
      label: f.text,
      lng: f.center[0],
      lat: f.center[1],
      canton: extractCanton(f),
    }))
  } catch {
    // AbortError, network — silent fail, UI affiche juste 0 suggestions
    return []
  }
}

// ─── Matrix API ──────────────────────────────────────────────────────────────

export type TravelProfile = 'driving' | 'walking' | 'cycling'

export interface MatrixResult {
  /** Durée en secondes ; null si point inaccessible ou hors-réseau. */
  duration: number | null
  /** Distance en mètres ; null si pas calculable. */
  distance: number | null
}

interface MapboxMatrixResponse {
  code?: string
  // durations[src][dst] en secondes
  durations?: Array<Array<number | null>>
  // distances[src][dst] en mètres
  distances?: Array<Array<number | null>>
}

/**
 * Matrix API — matrice durée/distance entre N sources et M destinations.
 *
 * Limites Mapbox :
 *   - driving : max 25 coordonnées au TOTAL (sources + destinations)
 *   - walking/cycling : max 25 idem
 *   - driving-traffic : max 10 (non utilisé ici)
 *
 * Si on dépasse, il faut chunker côté appelant.
 *
 * @returns matrix[sourceIdx][destIdx] = { duration_sec, distance_m }
 */
export async function travelMatrix(
  sources: Array<{ lng: number; lat: number }>,
  destinations: Array<{ lng: number; lat: number }>,
  profile: TravelProfile = 'driving',
  signal?: AbortSignal,
): Promise<MatrixResult[][] | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) return null
  if (sources.length === 0 || destinations.length === 0) return null
  if (sources.length + destinations.length > 25) {
    // Au-delà de 25 coords, Mapbox refuse — caller doit chunker.
    return null
  }

  // Coordinates string : `lng1,lat1;lng2,lat2;...`
  const allCoords = [...sources, ...destinations]
  const coordStr = allCoords.map(c => `${c.lng},${c.lat}`).join(';')
  const sourcesIdx = sources.map((_, i) => i).join(';')
  const destsIdx = destinations.map((_, i) => sources.length + i).join(';')

  const url = new URL(
    `https://api.mapbox.com/directions-matrix/v1/mapbox/${profile}/${coordStr}`,
  )
  url.searchParams.set('sources', sourcesIdx)
  url.searchParams.set('destinations', destsIdx)
  url.searchParams.set('annotations', 'duration,distance')
  url.searchParams.set('access_token', token)

  try {
    const res = await fetch(url.toString(), { signal })
    if (!res.ok) return null
    const data = (await res.json()) as MapboxMatrixResponse
    if (data.code !== 'Ok' || !data.durations) return null

    const durations = data.durations
    const distances = data.distances ?? []

    const out: MatrixResult[][] = []
    for (let i = 0; i < sources.length; i++) {
      const row: MatrixResult[] = []
      for (let j = 0; j < destinations.length; j++) {
        row.push({
          duration: durations[i]?.[j] ?? null,
          distance: distances[i]?.[j] ?? null,
        })
      }
      out.push(row)
    }
    return out
  } catch {
    return null
  }
}

/**
 * Helper : formate une durée en secondes en `"12 min"` ou `"1 h 25"`.
 */
export function formatTravelDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '—'
  const totalMinutes = Math.round(seconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} min`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m.toString().padStart(2, '0')}`
}
