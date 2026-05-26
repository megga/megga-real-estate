import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Listing, ListingFilters } from '@/types/listing'

export function useListings(filters?: ListingFilters) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['listings', filters],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from('listings')
        .select('*, property:properties(id, title, type, status, price, rooms, bedrooms, surface_m2, address, city, canton, postal_code, photos, published_at, transaction_type, c2pa_verified), agency:agencies(name, logo_url)')

      if (filters?.type) query = query.eq('property.type', filters.type)
      if (filters?.minPrice) query = query.gte('property.price', filters.minPrice)
      if (filters?.maxPrice) query = query.lte('property.price', filters.maxPrice)
      if (filters?.minRooms) query = query.gte('property.rooms', filters.minRooms)
      if (filters?.city) query = query.eq('property.city', filters.city)
      if (filters?.canton) query = query.eq('property.canton', filters.canton)

      const { data, error } = await query.order('published_at', { ascending: false })
      if (error) throw error
      return data as Listing[]
    },
  })
}

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: ['listing', id],
    queryFn: async () => {
      if (!id) throw new Error('No listing ID')
      // Single listing : page détail consomme description, features,
      // floor_plan_hotspots, photo_tags. On garde properties(*) ici.
      const { data, error } = await supabase
        .from('listings')
        .select('*, property:properties(*), agency:agencies(name, logo_url)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as unknown as Listing
    },
    enabled: !!id,
  })
}

export function useAgencyListings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['agency-listings'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*, property:properties(id, title, type, status, price, rooms, bedrooms, surface_m2, address, city, canton, postal_code, photos, published_at, transaction_type, c2pa_verified)')
        .order('published_at', { ascending: false })
      if (error) throw error
      return data as Listing[]
    },
  })
}

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

export function useUpdateListing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CreateListingInput>) => {
      const { data, error } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['listing', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['agency-listings'] })
    },
  })
}

export function useDeleteListing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['agency-listings'] })
    },
  })
}
