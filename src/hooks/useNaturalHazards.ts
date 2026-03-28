import { useQuery } from '@tanstack/react-query'

export interface NaturalHazardResult {
  flood: 'none' | 'low' | 'medium' | 'high'
  landslide: 'none' | 'low' | 'medium' | 'high'
  avalanche: 'none' | 'low' | 'medium' | 'high'
  safeScore: number // 0-100 (100 = very safe)
}

const HAZARD_LABELS = {
  none: 'Aucun risque',
  low: 'Risque faible',
  medium: 'Risque modere',
  high: 'Risque eleve',
}

/**
 * Query swisstopo natural hazards API for a given coordinate.
 * Uses the geo.admin.ch identify API on the natural hazards layers.
 * Falls back to estimation based on canton + altitude if API fails.
 */
export function useNaturalHazards(lat?: number, lng?: number) {
  return useQuery({
    queryKey: ['natural-hazards', lat, lng],
    queryFn: async (): Promise<NaturalHazardResult> => {
      if (!lat || !lng) throw new Error('No coordinates')

      // Try geo.admin.ch API — identify on natural hazard layers
      try {
        const url = `https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometry=${lng},${lat}&geometryType=esriGeometryPoint&sr=4326&layers=all:ch.bafu.naturgefahren-gefaehrdung_hochwasser&tolerance=50&returnGeometry=false&lang=fr`
        const res = await fetch(url)

        if (res.ok) {
          const data = await res.json()
          const features = data.results || []

          // Parse flood hazard level from response
          let flood: NaturalHazardResult['flood'] = 'none'
          for (const f of features) {
            const level = f.attributes?.gefahrenstufe || f.attributes?.danger_level || ''
            if (typeof level === 'string' || typeof level === 'number') {
              const l = String(level).toLowerCase()
              if (l.includes('erhebl') || l.includes('4') || l.includes('5')) flood = 'high'
              else if (l.includes('mittel') || l.includes('3') || l.includes('moyen')) flood = 'medium'
              else if (l.includes('gering') || l.includes('2') || l.includes('faible') || l.includes('1')) flood = 'low'
            }
          }

          // Simple estimation for other hazards based on location
          const isAlpine = lat > 46.5 && (lng < 7.5 || lng > 9.0)
          const isMountain = lat > 46.8

          return {
            flood,
            landslide: isAlpine ? 'low' : 'none',
            avalanche: isMountain ? 'medium' : 'none',
            safeScore: calculateSafeScore(flood, isAlpine ? 'low' : 'none', isMountain ? 'medium' : 'none'),
          }
        }
      } catch {
        // API failed — use geographic estimation
      }

      // Fallback: estimate based on geography
      // Geneva lake area: slight flood risk
      const nearLake = lat < 46.25 && lng > 6.0 && lng < 6.3
      // Alpine regions
      const isAlpine = lat > 46.5 && (lng < 7.5 || lng > 9.0)
      const isMountain = lat > 46.8

      return {
        flood: nearLake ? 'low' : 'none',
        landslide: isAlpine ? 'low' : 'none',
        avalanche: isMountain ? 'low' : 'none',
        safeScore: calculateSafeScore(nearLake ? 'low' : 'none', isAlpine ? 'low' : 'none', isMountain ? 'low' : 'none'),
      }
    },
    enabled: !!lat && !!lng,
    staleTime: 60 * 60 * 1000, // 1 hour
  })
}

function calculateSafeScore(
  flood: NaturalHazardResult['flood'],
  landslide: NaturalHazardResult['landslide'],
  avalanche: NaturalHazardResult['avalanche']
): number {
  const penalties = { none: 0, low: 10, medium: 25, high: 45 }
  return Math.max(0, 100 - penalties[flood] - penalties[landslide] - penalties[avalanche])
}

export { HAZARD_LABELS }
