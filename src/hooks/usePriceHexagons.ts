import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { FeatureCollection, Polygon } from 'geojson'
import { supabase } from '@/lib/supabase'

export interface PriceHexProps {
  hex_id: string
  median_price_m2: number
  listing_count: number
  p25_price_m2: number
  p75_price_m2: number
}

// Edge size in 3857 meters (≈ real ground meters × 1/0.68 at Swiss latitude).
// Smaller hexes at higher zoom = finer granularity.
export function hexSizeForZoom(zoom: number): number {
  if (zoom < 9) return 4000
  if (zoom < 11) return 1500
  if (zoom < 13) return 600
  return 250
}

export interface PriceHexagonsParams {
  bbox: [number, number, number, number] | null  // [minLng, minLat, maxLng, maxLat]
  zoom: number
  transactionType: 'rent' | 'buy'
  types?: string[] | null
  enabled?: boolean
}

export function usePriceHexagons({ bbox, zoom, transactionType, types, enabled = true }: PriceHexagonsParams) {
  const size = hexSizeForZoom(zoom)
  const key = bbox
    ? bbox.map(n => n.toFixed(2)).join(',')
    : 'no-bbox'

  return useQuery<FeatureCollection<Polygon, PriceHexProps>>({
    queryKey: ['price-hexagons', key, size, transactionType, types],
    enabled: enabled && !!bbox,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: async () => {
      if (!bbox) return { type: 'FeatureCollection', features: [] }
      const [minLng, minLat, maxLng, maxLat] = bbox
      // RPC expects 'rent' or 'sale'; our UI uses 'rent' or 'buy'.
      const txType = transactionType === 'buy' ? 'sale' : 'rent'
      const { data, error } = await supabase.rpc('get_price_hexagons', {
        p_min_lng: minLng,
        p_min_lat: minLat,
        p_max_lng: maxLng,
        p_max_lat: maxLat,
        p_hex_size_m: size,
        p_transaction_type: txType,
        p_types: types && types.length > 0 ? types : undefined,
        p_min_count: 3,
      })
      if (error) throw error
      const rows = (data ?? []) as unknown as Array<{
        hex_id: string
        geom: Polygon
        median_price_m2: number
        listing_count: number
        p25_price_m2: number
        p75_price_m2: number
      }>
      return {
        type: 'FeatureCollection',
        features: rows.map(r => ({
          type: 'Feature' as const,
          geometry: r.geom,
          properties: {
            hex_id: r.hex_id,
            median_price_m2: Number(r.median_price_m2),
            listing_count: Number(r.listing_count),
            p25_price_m2: Number(r.p25_price_m2),
            p75_price_m2: Number(r.p75_price_m2),
          },
        })),
      }
    },
  })
}
