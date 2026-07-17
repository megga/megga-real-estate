/**
 * Hook CRM — leads vendeurs (`seller_leads`), demandes d'estimation captées par
 * l'entonnoir public. Alimente le cockpit Focus et les vues admin. Renvoie le
 * bien saisi, l'estimation, le contact et le statut du dossier.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface SellerLeadRow {
  id: string
  property_data: {
    address: string
    city: string
    canton: string
    postalCode: string
    type: string
    rooms: string
    surface: number
    photos: string[]
  }
  estimation_min: number | null
  estimation_max: number | null
  estimation_median: number | null
  estimation_confidence: string | null
  contact_name: string
  contact_email: string
  contact_phone: string | null
  motivation: string
  status: 'new' | 'contacted' | 'mandate' | 'lost'
  contact_id: string | null
  property_id: string | null
  created_at: string
}

/**
 * Liste les leads vendeurs, filtrable par `status` et bornable par `limit`
 * (voir le garde-fou ci-dessous pour les vues « liste courte »).
 */
export function useSellerLeads(status?: string, limit?: number) {
  return useQuery({
    queryKey: ['seller-leads', status, limit],
    queryFn: async () => {
      let query = supabase
        .from('seller_leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (status) query = query.eq('status', status)
      // Garde-fou borné (optionnel) : l'entonnoir public (policy anon insert) peut
      // faire croître la table → un consommateur « liste courte » comme le cockpit
      // Focus passe une limite. Les vues admin restent non bornées (limit absent).
      if (limit) query = query.limit(limit)

      const { data, error } = await query
      if (error) throw error
      return data as unknown as SellerLeadRow[]
    },
    staleTime: 30_000,
  })
}
