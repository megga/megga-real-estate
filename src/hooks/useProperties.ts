import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Property } from '@/types/listing'
import type { PropertyStatus } from '@/lib/constants'

// ── Query single property (for edit mode) ──

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      if (!id) throw new Error('No property ID')
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Property
    },
    enabled: !!id,
  })
}

// ── Query all agency properties (including drafts without listings) ──

export function useAgencyProperties() {
  return useQuery({
    queryKey: ['agency-properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, title, type, status, price, rooms, bedrooms, surface_m2, address, city, canton, postal_code, photos, created_at, updated_at, listing:listings(id, views_count, favorites_count, published_at)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as (Property & { listing: Array<{ id: string; views_count: number; favorites_count: number; published_at: string }> })[]
    },
  })
}

// ── Create property ──

interface CreatePropertyInput {
  title: string
  description?: string
  type: string
  status: PropertyStatus
  price: number
  rooms: number
  bedrooms: number
  bathrooms: number
  surface_m2: number
  floor?: number
  total_floors?: number
  year_built?: number
  charges_monthly?: number
  mandate_type?: string
  address: string
  city: string
  canton: string
  postal_code: string
  photos?: string[]
  features?: string[]
  published_at?: string
}

export function useCreateProperty() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreatePropertyInput) => {
      const { data, error } = await supabase
        .from('properties')
        .insert({
          ...input,
          agency_id: profile?.agency_id,
          created_by: user?.id,
          features: input.features ?? [],
          photos: input.photos ?? [],
        })
        .select('id')
        .single()
      if (error) throw error
      return data as { id: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-properties'] })
      queryClient.invalidateQueries({ queryKey: ['agency-listings'] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
    },
  })
}

// ── Update property ──

export function useUpdateProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CreatePropertyInput>) => {
      const { data, error } = await supabase
        .from('properties')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
        .single()
      if (error) throw error
      return data as { id: string }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['property', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['agency-properties'] })
      queryClient.invalidateQueries({ queryKey: ['agency-listings'] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
    },
  })
}

// ── Delete property (cascades to listing) ──

export function useDeleteProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-properties'] })
      queryClient.invalidateQueries({ queryKey: ['agency-listings'] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
    },
  })
}

// ── Update property status ──

export function useUpdatePropertyStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PropertyStatus }) => {
      const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      }
      // Set published_at when going active
      if (status === 'active') {
        updates.published_at = new Date().toISOString()
      }
      const { error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['property', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['agency-properties'] })
      queryClient.invalidateQueries({ queryKey: ['agency-listings'] })
    },
  })
}

// ── Upload property photos to Supabase Storage ──

export function useUploadPropertyPhotos() {
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async ({ propertyId, files }: { propertyId: string; files: File[] }) => {
      const agencyId = profile?.agency_id ?? 'default'
      const urls: string[] = []

      for (const file of files) {
        const ext = file.name.split('.').pop() ?? 'jpg'
        const filePath = `${agencyId}/properties/${propertyId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('property-photos')
          .upload(filePath, file, { contentType: file.type })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('property-photos')
          .getPublicUrl(filePath)

        urls.push(urlData.publicUrl)
      }

      return urls
    },
  })
}
