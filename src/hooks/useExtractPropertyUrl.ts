import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ExtractedPropertyData } from './useExtractPropertyPdf'

export interface ExtractedUrlData extends ExtractedPropertyData {
  photos: string[]
  source_url: string
  source_portal: string | null
  reference_id: string | null
}

export function useExtractPropertyUrl() {
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function extractFromUrl(url: string): Promise<ExtractedUrlData | null> {
    setIsExtracting(true)
    setError(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('extract-property-url', {
        body: { url },
      })

      if (fnError) throw new Error(fnError.message)
      if (!data?.success) throw new Error(data?.error ?? data?.message ?? 'Extraction failed')

      return data.data as ExtractedUrlData
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'extraction'
      setError(msg)
      return null
    } finally {
      setIsExtracting(false)
    }
  }

  return { extractFromUrl, isExtracting, error }
}
