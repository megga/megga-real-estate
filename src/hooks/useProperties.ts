// Migrated to @supabase-cache-helpers/postgrest-react-query (partial).
//
// What migrated:
//   - useProperty (single read)
//   - useAgencyProperties (list read)
//   - useCreateProperty
//   - useDeleteProperty (soft-delete via UPDATE deleted_at)
//
// What stayed on classic React Query (with reason):
//   - useUpdateProperty: optimistic locking adds `.eq('updated_at', expected)`
//     to the WHERE clause and inspects affected rows to raise
//     PropertyUpdateConflictError. Cache Helpers' useUpdateMutation forces
//     PK-only WHERE and discards row count. Migrating it would lose the
//     conflict detection used by ListingFormPage.
//   - useUploadFloorPlan / useUploadPropertyPhotos: storage uploads, not
//     postgrest mutations.
//
// Cache Helpers auto-invalidates queries against the `properties` table on
// each migrated mutation, so the manual invalidate(['agency-properties']),
// invalidate(['agency-listings']), invalidate(['listings']) calls are gone.
// (Note: the related `listings` and `agency-listings` queries live in other
// hooks; they'll only auto-invalidate once those hooks are migrated too.)

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useQuery,
  useInsertMutation,
} from '@supabase-cache-helpers/postgrest-react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Property } from '@/types/listing'
import type { PropertyStatus } from '@/lib/constants'
import type { FloorPlanHotspot, PhotoTag } from '@/types/floorPlan'
import type { TablesInsert, TablesUpdate } from '@/types/database'

// ── Query single property (for edit mode) ──

export function useProperty(id: string | undefined) {
  // Cache Helpers needs a valid query expression even when disabled; we pass
  // a sentinel UUID and gate via `enabled`.
  const result = useQuery(
    supabase
      .from('properties')
      .select('*')
      .eq('id', id ?? '00000000-0000-0000-0000-000000000000')
      .is('deleted_at', null)
      .single(),
    { enabled: !!id }
  )
  return {
    ...result,
    data: result.data as unknown as Property | undefined,
  }
}

// ── Query all agency properties (including drafts without listings) ──

export function useAgencyProperties() {
  const result = useQuery(
    supabase
      .from('properties')
      .select('id, title, type, status, price, rooms, bedrooms, surface_m2, address, city, canton, postal_code, photos, created_at, updated_at, listing:listings(id, views_count, favorites_count, published_at)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
  )
  return {
    ...result,
    data: result.data as unknown as
      | (Property & { listing: Array<{ id: string; views_count: number; favorites_count: number; published_at: string }> })[]
      | undefined,
  }
}

// ── Create property ──

export interface CreatePropertyInput {
  title: string
  description?: string
  private_notes?: string | null
  type: string
  /** 'buy' (vente) | 'rent' (location). Sans valeur explicite, la DB applique son
   *  défaut → le choix Vente/Location de l'agent serait silencieusement perdu. */
  transaction_type?: 'buy' | 'rent'
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
  const insert = useInsertMutation(
    supabase.from('properties'),
    ['id'],
    'id, updated_at'
  )

  return {
    mutateAsync: async (input: CreatePropertyInput): Promise<{ id: string; updated_at: string }> => {
      const payload = {
        ...input,
        agency_id: profile?.agency_id,
        created_by: user?.id,
        features: input.features ?? [],
        photos: input.photos ?? [],
      } as unknown as TablesInsert<'properties'>
      const rows = await insert.mutateAsync([payload])
      const row = Array.isArray(rows) ? rows[0] : rows
      return row as unknown as { id: string; updated_at: string }
    },
    isPending: insert.isPending,
  }
}

// ── Update property ──
// Optimistic locking: if the caller passes `expected_updated_at` we add it to
// the WHERE clause. A concurrent edit from another tab/agent will have moved
// `updated_at` forward, the .eq() filter matches no rows, and we throw a
// conflict error rather than silently overwriting their work.
//
// Kept on raw supabase + useMutation because Cache Helpers' useUpdateMutation
// only filters by primary key. The conflict-detection contract used by
// ListingFormPage would break otherwise.

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
        .update({ ...updates, updated_at: new Date().toISOString() } as unknown as TablesUpdate<'properties'>)
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
      // Manual invalidate kept here: Cache Helpers can't observe writes that
      // bypass its mutation hooks (this is a raw supabase update).
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
// Miroir des photos staging Supabase → Cloudflare R2 via le broker agent-auth
// `property-photo-r2` (ownership vérifié server-side). Renvoie les URLs R2 dans le
// MÊME ordre, ou null si échec/partiel (l'appelant garde alors les URLs Supabase :
// dégradation gracieuse, la photo n'est jamais perdue).
async function mirrorPhotosToR2(
  propertyId: string,
  supabaseUrls: string[],
  kind: 'photos' | 'floorplan',
): Promise<string[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke<{ success?: boolean; photos?: string[] }>(
      'property-photo-r2',
      { body: { propertyId, photoUrls: supabaseUrls, kind } },
    )
    if (error || !data?.success || !Array.isArray(data.photos) || data.photos.length !== supabaseUrls.length) {
      return null
    }
    return data.photos
  } catch {
    return null
  }
}

// ── Upload floor plan image to Supabase Storage (puis miroir R2) ──

export function useUploadFloorPlan() {
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async ({ propertyId, file }: { propertyId: string; file: File }) => {
      const agencyId = profile?.agency_id ?? 'default'
      const ext = file.name.split('.').pop() ?? 'jpg'
      const filePath = `${agencyId}/properties/${propertyId}/floor-plan/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

      // Strip EXIF/GPS (nLPD) avant le staging public — no-op pour les SVG (zéro EXIF).
      const stripped = await stripImageMetadata(file)
      const { error: uploadError } = await supabase.storage
        .from('property-photos')
        .upload(filePath, stripped, { contentType: file.type })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('property-photos')
        .getPublicUrl(filePath)

      // Miroir vers R2 (egress gratuit) ; échec → on garde la copie Supabase.
      const r2 = await mirrorPhotosToR2(propertyId, [urlData.publicUrl], 'floorplan')
      if (r2 && r2[0]) {
        await supabase.storage.from('property-photos').remove([filePath])
        return r2[0]
      }
      return urlData.publicUrl
    },
  })
}

// ── Upload property photos to Supabase Storage (staging) puis miroir R2 ──

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EXT_FOR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// Re-encode through a Canvas to strip ALL metadata (EXIF, IPTC, XMP). The Swiss
// privacy law (nLPD art. 6) treats GPS coordinates as sensitive personal data;
// a real estate photo uploaded straight from a phone leaks the agent's home/
// office position in the JPEG EXIF GPS block.
//
// Trade-off : Canvas re-encoding is technically lossy for JPEG, but at quality
// 0.95 the visual delta is imperceptible and listing photos pass through
// further compression anyway (CDN, Flatfox sync, OG image scrapers).
//
// Defensive: any failure (huge image, decode error, missing Canvas context)
// falls back to the original file so an upload never gets blocked by EXIF
// stripping. The bucket RLS + MIME whitelist still enforce server-side limits.
async function stripImageMetadata(file: File): Promise<File> {
  if (!ALLOWED_PHOTO_MIME.has(file.type)) return file
  if (typeof window === 'undefined' || typeof document === 'undefined') return file

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode-failed'))
      el.src = url
    })

    // Skip ridiculously large images — Canvas refuses > ~16K on most browsers
    // and the re-encode would blow memory. Server has its own 10 Mo cap.
    if (img.naturalWidth > 12_000 || img.naturalHeight > 12_000) return file

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, file.type, 0.95)
    })
    if (!blob) return file

    return new File([blob], file.name, { type: file.type, lastModified: Date.now() })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Upload d'UNE photo dans le staging du chat copilote (bucket public property-photos,
// préfixe {agencyId}/chat-staging/ — imposé par la policy d'insertion ET par la garde
// SSRF de l'exécuteur execWebAttachPropertyPhotos). EXIF strippé côté client. Renvoie
// l'URL publique ; le copilote (attach_property_photos) la miroir vers R2, l'attache au
// bien résolu, puis nettoie le staging. Une photo par appel (le composer parallélise).
export function useUploadChatPhoto() {
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const agencyId = profile?.agency_id
      if (!agencyId) throw new Error('Agence introuvable — connectez-vous')
      if (!ALLOWED_PHOTO_MIME.has(file.type)) {
        throw new Error(`Format ${file.type || 'inconnu'} refusé (JPG/PNG/WebP uniquement)`)
      }
      if (file.size > 10 * 1024 * 1024) throw new Error('Photo trop lourde (10 Mo max)')

      const stripped = await stripImageMetadata(file)
      const ext = EXT_FOR_MIME[file.type]
      const uid = crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      const filePath = `${agencyId}/chat-staging/${uid}.${ext}`

      const { error } = await supabase.storage
        .from('property-photos')
        .upload(filePath, stripped, { contentType: file.type })
      if (error) throw error

      return supabase.storage.from('property-photos').getPublicUrl(filePath).data.publicUrl
    },
  })
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
      const filePaths: string[] = []

      for (const file of files) {
        // Trust the MIME type, but validate against the bucket whitelist before
        // the upload to give a clear error rather than a 415 from Storage.
        if (!ALLOWED_PHOTO_MIME.has(file.type)) {
          throw new Error(`Format ${file.type || 'inconnu'} refusé (JPG/PNG/WebP uniquement)`)
        }
        // Strip EXIF/IPTC/XMP before upload (LPD GPS protection). If the
        // helper returns the same File reference it means the strip was
        // skipped (e.g. oversized image) — we upload as-is in that case.
        const stripped = await stripImageMetadata(file)
        const ext = EXT_FOR_MIME[file.type]
        const filePath = `${agencyId}/properties/${propertyId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('property-photos')
          .upload(filePath, stripped, { contentType: file.type })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('property-photos')
          .getPublicUrl(filePath)

        urls.push(urlData.publicUrl)
        filePaths.push(filePath)
      }

      // Miroir vers R2 (egress gratuit). Succès → on sert depuis R2 + on supprime
      // les copies Supabase (rien ne persiste sur Supabase Storage). Échec → on
      // garde les copies Supabase et on renvoie leurs URLs (photo jamais perdue).
      const r2Urls = await mirrorPhotosToR2(propertyId, urls, 'photos')
      if (r2Urls) {
        await supabase.storage.from('property-photos').remove(filePaths)
        return r2Urls
      }
      return urls
    },
  })
}
