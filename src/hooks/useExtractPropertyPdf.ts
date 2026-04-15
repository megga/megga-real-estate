import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ExtractedPropertyData {
  title: string | null
  description: string | null
  type: 'apartment' | 'house' | 'villa' | 'commercial' | 'land' | null
  price: number | null
  charges_monthly: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  surface_m2: number | null
  floor: number | null
  total_floors: number | null
  year_built: number | null
  condition: 'new' | 'renovated' | 'good' | 'to_renovate' | null
  address: string | null
  city: string | null
  canton: string | null
  postal_code: string | null
  features: string[]
  mandate_type: 'simple' | 'exclusive' | null
  // Rental support (extracted by the URL/PDF parsers — null when not detected)
  transaction_type?: 'buy' | 'rent' | null
  is_furnished?: boolean | null
  deposit_months?: number | null
  availability_date?: string | null
  external_regie?: {
    name: string
    phone: string
    email: string
    website?: string | null
  } | null
  confidence: number
}

interface ExtractionResult {
  success: boolean
  data: ExtractedPropertyData
  filename: string
}

export function useExtractPropertyPdf() {
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExtractionResult | null>(null)

  async function extractFromPdf(file: File): Promise<ExtractedPropertyData | null> {
    setIsExtracting(true)
    setError(null)
    setResult(null)

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          // Remove the data:application/pdf;base64, prefix
          const base64Data = dataUrl.split(',')[1]
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const { data, error: fnError } = await supabase.functions.invoke('extract-property-pdf', {
        body: { pdf_base64: base64, filename: file.name },
      })

      if (fnError) throw new Error(fnError.message)
      if (!data?.success) throw new Error(data?.error ?? 'Extraction failed')

      setResult(data as ExtractionResult)
      return data.data as ExtractedPropertyData
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'extraction'
      setError(msg)
      return null
    } finally {
      setIsExtracting(false)
    }
  }

  return { extractFromPdf, isExtracting, error, result }
}
