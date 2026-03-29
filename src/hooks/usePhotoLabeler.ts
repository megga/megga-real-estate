import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface PhotoLabelResult {
  url: string
  room: string
  confidence: number
  quality: {
    sharpness: number
    lighting: number
    composition: number
    overall: number
  }
  flags: string[]
  error?: string
}

export function usePhotoLabeler() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<PhotoLabelResult[]>([])

  const autoLabelPhotos = useCallback(async (photoUrls: string[], propertyId?: string) => {
    setLoading(true)
    setError(null)
    setResults([])

    try {
      const { data, error: fnError } = await supabase.functions.invoke('photo-labeler', {
        body: { photo_urls: photoUrls, property_id: propertyId },
      })

      if (fnError) throw new Error(fnError.message)
      if (data?.error) throw new Error(data.error)

      const labelResults = (data?.results || []) as PhotoLabelResult[]
      setResults(labelResults)
      return labelResults
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'analyse'
      setError(msg)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const getAverageQuality = useCallback(() => {
    if (!results.length) return 0
    return Math.round(results.reduce((acc, r) => acc + r.quality.overall, 0) / results.length)
  }, [results])

  return { autoLabelPhotos, loading, error, results, getAverageQuality }
}
