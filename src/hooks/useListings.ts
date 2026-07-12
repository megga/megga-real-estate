import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface CreateListingInput {
  property_id: string
  agency_id: string
  title: string
  description_ai?: string
  price_display: string
  is_featured?: boolean
  is_hot?: boolean
}

export function useCreateListing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateListingInput) => {
      const { data, error } = await supabase
        .from('listings')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['agency-listings'] })
    },
  })
}
