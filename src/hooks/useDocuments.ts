import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { SELLER_DOCUMENTS, type SellerDocument } from '@/pages/seller/sellerMockData'

const DEV_BYPASS = true

export interface Document {
  id: string
  agency_id: string | null
  property_id: string | null
  transaction_id: string | null
  kyc_case_id: string | null
  name: string
  type: string
  storage_path: string
  size_bytes: number
  status: 'pending' | 'available' | 'signed' | 'rejected'
  uploaded_by: string | null
  created_at: string
}

function mockToDocument(m: SellerDocument): Document {
  return {
    id: m.id,
    agency_id: null,
    property_id: 'mock-property',
    transaction_id: null,
    kyc_case_id: null,
    name: m.name,
    type: m.type,
    storage_path: `mock/${m.name}`,
    size_bytes: parseMockSize(m.size),
    status: m.status,
    uploaded_by: null,
    created_at: m.date,
  }
}

function parseMockSize(size: string): number {
  const num = parseFloat(size)
  if (size.includes('Mo')) return num * 1024 * 1024
  if (size.includes('Ko')) return num * 1024
  return num
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${bytes} o`
}

export function useDocuments(propertyId?: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const documentsQuery = useQuery({
    queryKey: ['documents', propertyId],
    queryFn: async () => {
      if (DEV_BYPASS) {
        return SELLER_DOCUMENTS.map(mockToDocument)
      }
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('property_id', propertyId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Document[]
    },
    enabled: !!propertyId || DEV_BYPASS,
  })

  const uploadMutation = useMutation({
    mutationFn: async ({ file, propertyId: pid }: { file: File; propertyId: string }) => {
      if (DEV_BYPASS) {
        // Simulate upload in dev mode
        return {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.name.split('.').pop() ?? 'unknown',
          storage_path: `mock/${file.name}`,
          size_bytes: file.size,
          status: 'pending' as const,
          created_at: new Date().toISOString(),
        }
      }

      const userId = user?.id ?? 'anonymous'
      const timestamp = Date.now()
      const path = `${userId}/${pid}/${timestamp}_${file.name}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, file)
      if (uploadError) throw uploadError

      const { data, error: insertError } = await supabase
        .from('documents')
        .insert({
          property_id: pid,
          name: file.name,
          type: file.name.split('.').pop() ?? 'unknown',
          storage_path: path,
          size_bytes: file.size,
          status: 'pending',
          uploaded_by: user?.id ?? null,
        })
        .select()
        .single()
      if (insertError) throw insertError
      return data as Document
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  async function downloadDocument(storagePath: string, fileName: string) {
    if (DEV_BYPASS) {
      alert(`[Dev] Téléchargement simulé : ${fileName}`)
      return
    }
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600)
    if (error) throw error
    window.open(data.signedUrl, '_blank')
  }

  return {
    documents: documentsQuery.data ?? [],
    isLoading: documentsQuery.isLoading,
    uploadDocument: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    downloadDocument,
  }
}
