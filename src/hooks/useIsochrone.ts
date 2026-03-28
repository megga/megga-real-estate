import { useState, useCallback } from 'react'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

export interface IsochroneResult {
  geojson: {
    type: 'FeatureCollection'
    features: Array<{
      type: 'Feature'
      properties: Record<string, unknown>
      geometry: {
        type: 'Polygon' | 'MultiPolygon'
        coordinates: number[][][]
      }
    }>
  }
  center: [number, number]
  minutes: number
}

/**
 * Hook for Mapbox Isochrone API.
 * Returns a validated GeoJSON FeatureCollection for use with react-map-gl Source.
 */
export function useIsochrone() {
  const [isochrone, setIsochrone] = useState<IsochroneResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchIsochrone = useCallback(async (
    lng: number,
    lat: number,
    minutes: number = 30,
    profile: 'driving' | 'walking' | 'cycling' = 'driving'
  ) => {
    if (!MAPBOX_TOKEN) {
      setError('Token Mapbox manquant')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}?contours_minutes=${minutes}&polygons=true&access_token=${MAPBOX_TOKEN}`
      const res = await fetch(url)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`API ${res.status}: ${text.slice(0, 100)}`)
      }

      const data = await res.json()

      // Validate: must be a FeatureCollection with at least one Feature containing a Polygon
      if (
        !data ||
        data.type !== 'FeatureCollection' ||
        !Array.isArray(data.features) ||
        data.features.length === 0 ||
        !data.features[0].geometry ||
        !data.features[0].geometry.coordinates
      ) {
        throw new Error('Reponse isochrone invalide')
      }

      setIsochrone({
        geojson: data,
        center: [lng, lat],
        minutes,
      })
    } catch (err) {
      setIsochrone(null)
      setError(err instanceof Error ? err.message : 'Erreur isochrone')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearIsochrone = useCallback(() => {
    setIsochrone(null)
    setError(null)
  }, [])

  return { isochrone, isLoading, error, fetchIsochrone, clearIsochrone }
}
