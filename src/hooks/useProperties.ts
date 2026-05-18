import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Property } from '@/types/listing'
import type { PropertyStatus } from '@/lib/constants'
import type { FloorPlanHotspot, PhotoTag } from '@/types/floorPlan'

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
        .is('deleted_at', null)
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
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as (Property & { listing: Array<{ id: string; views_count: number; favorites_count: number; published_at: string }> })[]
    },
  })
}

// ── Create property ──

export interface CreatePropertyInput {
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
  // Sprint 2 — migration 20260517_001
  energy_class?: string | null
  mandate_commission_pct?: number | null
  mandate_signed_at?: string | null
  mandate_expires_at?: string | null
  address: string
  city: string
  canton: string
  postal_code: string
  photos?: string[]
  video_url?: string
  features?: string[]
  floor_plan_url?: string | null
  floor_plan_hotspots?: FloorPlanHotspot[]
  photo_tags?: PhotoTag[]
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
        .select('id, updated_at')
        .single()
      if (error) throw error
      return data as { id: string; updated_at: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-properties'] })
      queryClient.invalidateQueries({ queryKey: ['agency-listings'] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
    },
  })
}

// ── Update property ──
// Optimistic locking: if the caller passes `expected_updated_at` we add it to
// the WHERE clause. A concurrent edit from another tab/agent will have moved
// `updated_at` forward, the .eq() filter matches no rows, and we throw a
// conflict error rather than silently overwriting their work.

export class PropertyUpdateConflictError extends Error {
  constructor() {
    super('Ce bien a été modifié ailleurs. Rechargez la page avant de re-sauvegarder.')
    this.name = 'PropertyUpdateConflictError'
  }
}

export function useUpdateProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      expected_updated_at,
      ...updates
    }: { id: string; expected_updated_at?: string } & Partial<CreatePropertyInput>) => {
      let query = supabase
        .from('properties')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (expected_updated_at) {
        query = query.eq('updated_at', expected_updated_at)
      }

      const { data, error } = await query.select('id, updated_at')
      if (error) throw error

      if (!data || data.length === 0) {
        if (expected_updated_at) throw new PropertyUpdateConflictError()
        throw new Error('Bien introuvable')
      }

      return data[0] as { id: string; updated_at: string }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['property', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['agency-properties'] })
      queryClient.invalidateQueries({ queryKey: ['agency-listings'] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
    },
  })
}

// ── Soft-delete property ──
// Soft-delete by default (sets deleted_at). The audit trigger turns this
// into a `bien_soft_deleted` event so the audit trail survives the deletion
// (LBA art. 7 al. 3 retention). Hard delete is reserved for the pg_cron
// orphan-draft cleanup; agents should never need it.

export function useDeleteProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('properties')
        .update({ deleted_at: new Date().toISOString() })
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

// ── Upload floor plan image to Supabase Storage ──

export function useUploadFloorPlan() {
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async ({ propertyId, file }: { propertyId: string; file: File }) => {
      const agencyId = profile?.agency_id ?? 'default'
      const ext = file.name.split('.').pop() ?? 'jpg'
      const filePath = `${agencyId}/properties/${propertyId}/floor-plan/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('property-photos')
        .upload(filePath, file, { contentType: file.type })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('property-photos')
        .getPublicUrl(filePath)

      return urlData.publicUrl
    },
  })
}

// ── Upload property photos to Supabase Storage ──

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EXT_FOR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function useUploadPropertyPhotos() {
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async ({ propertyId, files }: { propertyId: string; files: File[] }) => {
      const agencyId = profile?.agency_id
      // Refuse to upload without a real agency_id: the bucket RLS now requires
      // the first path segment to equal `get_my_agency_id()`, so the previous
      // `'default'` fallback would fail server-side anyway and leak photos.
      if (!agencyId) throw new Error('Agence introuvable — connectez-vous')
      if (!UUID_RE.test(propertyId)) throw new Error('propertyId invalide')

      const urls: string[] = []

      for (const file of files) {
        // Trust the MIME type, but validate against the bucket whitelist before
        // the upload to give a clear error rather than a 415 from Storage.
        if (!ALLOWED_PHOTO_MIME.has(file.type)) {
          throw new Error(`Format ${file.type || 'inconnu'} refusé (JPG/PNG/WebP uniquement)`)
        }
        const ext = EXT_FOR_MIME[file.type]
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
