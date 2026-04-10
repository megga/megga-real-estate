import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Documents NON-KYC (mandats, bons de visite, offres, contrats…)
// Les documents KYC sont gérés par useKyc.ts (useKycDocuments).

export interface GeneratedDocumentRow {
  id: string
  agency_id: string | null
  contact_id: string | null
  property_id: string | null
  transaction_id: string | null
  name: string
  type: string
  storage_path: string | null
  size_bytes: number | null
  status: string | null
  uploaded_by: string | null
  created_at: string
}

export function useGeneratedDocuments() {
  return useQuery({
    queryKey: ['generated-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, agency_id, contact_id, property_id, transaction_id, name, type, storage_path, size_bytes, status, uploaded_by, created_at')
        .is('kyc_case_id', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as GeneratedDocumentRow[]
    },
  })
}

export function useGeneratedDocument(id: string | null) {
  return useQuery({
    queryKey: ['generated-document', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('documents')
        .select('id, agency_id, contact_id, property_id, transaction_id, name, type, storage_path, size_bytes, status, uploaded_by, created_at')
        .eq('id', id)
        .is('kyc_case_id', null)
        .maybeSingle()
      if (error) throw error
      return data as GeneratedDocumentRow | null
    },
    enabled: !!id,
  })
}
