import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

interface Favorite {
  id: string
  user_id: string
  listing_id: string
  created_at: string
}

export function useFavorites() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('favorites')
        .select('*, listing:listings(*, property:properties(*))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Favorite[]
    },
    enabled: !!user,
  })
}

export function useFavoriteIds() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['favorite-ids', user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>()
      const { data, error } = await supabase
        .from('favorites')
        .select('listing_id')
        .eq('user_id', user.id)
      if (error) throw error
      return new Set(data.map((f: { listing_id: string }) => f.listing_id))
    },
    enabled: !!user,
  })
}

export function useToggleFavorite() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (listingId: string) => {
      if (!user) throw new Error('Not authenticated')

      // Check if already favorited
      const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('listing_id', listingId)
        .maybeSingle()

      if (existing) {
        // Remove favorite
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('id', existing.id)
        if (error) throw error
        return { action: 'removed' as const, listingId }
      } else {
        // Add favorite
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, listing_id: listingId })
        if (error) throw error
        return { action: 'added' as const, listingId }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
      queryClient.invalidateQueries({ queryKey: ['favorite-ids'] })
    },
  })
}
