import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface EstimationParams {
  canton: string
  city?: string
  type?: string
  surface?: number
}

export interface ComparableProperty {
  id: string
  title: string
  city: string
  address: string
  type: string
  rooms: number
  surface_m2: number
  price: number
  price_per_m2: number
  photo_url: string | null
  days_on_market: number
}

export interface EstimationResult {
  median_price_m2: number | null
  estimation: number | null
  estimation_min: number | null
  estimation_max: number | null
  confidence: 'low' | 'medium' | 'high'
  comparable_count: number
  comparables: ComparableProperty[]
}

export function usePropertyEstimation(params: EstimationParams | null) {
  return useQuery({
    queryKey: ['property-estimation', params],
    queryFn: async (): Promise<EstimationResult> => {
      if (!params) throw new Error('No params')

      const { data, error } = await supabase.rpc('estimate_property_price', {
        p_canton: params.canton,
        p_city: params.city || null,
        p_type: params.type || null,
        p_surface: params.surface ? Math.round(params.surface) : null,
      })

      if (error) throw error
      return data as EstimationResult
    },
    enabled: !!params?.canton,
    staleTime: 5 * 60 * 1000, // 5 min cache
  })
}
