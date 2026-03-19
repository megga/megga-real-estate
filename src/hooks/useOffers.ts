import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { SELLER_OFFERS, type SellerOffer } from '@/pages/seller/sellerMockData'

const DEV_BYPASS = true

export interface Offer {
  id: string
  property_id: string
  agency_id: string | null
  contact_buyer_id: string | null
  buyer_name: string
  amount: number
  conditions: string | null
  status: 'pending' | 'accepted' | 'refused' | 'counter' | 'expired'
  responded_at: string | null
  created_by: string | null
  created_at: string
}

function mockToOffer(m: SellerOffer): Offer {
  return {
    id: m.id,
    property_id: 'mock-property',
    agency_id: null,
    contact_buyer_id: null,
    buyer_name: m.buyer_name,
    amount: m.amount,
    conditions: m.conditions,
    status: m.status,
    responded_at: null,
    created_by: null,
    created_at: m.date,
  }
}

export function useOffers(propertyId?: string) {
  const queryClient = useQueryClient()

  const offersQuery = useQuery({
    queryKey: ['offers', propertyId],
    queryFn: async () => {
      if (DEV_BYPASS) {
        return SELLER_OFFERS.map(mockToOffer)
      }
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('property_id', propertyId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Offer[]
    },
    enabled: !!propertyId || DEV_BYPASS,
  })

  const respondMutation = useMutation({
    mutationFn: async ({ offerId, status }: { offerId: string; status: 'accepted' | 'refused' }) => {
      if (DEV_BYPASS) {
        return
      }
      const { error } = await supabase
        .from('offers')
        .update({ status, responded_at: new Date().toISOString() })
        .eq('id', offerId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] })
    },
  })

  return {
    offers: offersQuery.data ?? [],
    isLoading: offersQuery.isLoading,
    respondToOffer: respondMutation.mutateAsync,
    isResponding: respondMutation.isPending,
  }
}
